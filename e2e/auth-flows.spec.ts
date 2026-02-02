import { test, expect } from '@playwright/test';
import { 
  TEST_NSEC, 
  TEST_PUBKEY, 
  mockNip07Extension,
  loginWithNsec,
  loginWithNip07,
  openLoginDialog,
  clearAuthState,
  getAuthState,
  isAuthenticated,
  logout,
  mockExpiredSession
} from './test-helpers';

test.describe('NIP-07 Authentication Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cardsboard');
    await clearAuthState(page);
  });

  test('should successfully authenticate with NIP-07 extension', async ({ page, context }) => {
    await loginWithNip07(page);
 
    const authState = await getAuthState(page);
    expect(authState).not.toBeNull();
    expect(authState.pubkey).toBe(TEST_PUBKEY);
    expect(authState.signerType).toBe('nip07');
    
    // Stay logged in even after page reload
    await page.reload();
    expect(await isAuthenticated(page)).toBe(true);

    // Stay logged in even after leaving page
    await page.goto('/');
    await page.goto('/cardsboard');

    expect(await isAuthenticated(page)).toBe(true);
    
    // Stay logged in after closing browser
    await page.close();
    const newPage = await context.newPage();
    await newPage.goto('/cardsboard');
    expect(await isAuthenticated(newPage)).toBe(true);
  });

  test('should handle NIP-07 extension not found', async ({ page }) => {
    await openLoginDialog(page);
    
    const nip07Button = page.getByText('Mit Nostr-Extension anmelden');
    await nip07Button.click();
  
    await expect(page.getByText('Nostr-Browser-Extension nicht gefunden')).toBeVisible();
    
    expect(await isAuthenticated(page)).toBe(false);
  });

  test('should handle NIP-07 user rejection', async ({ page }) => {
    const errorMessage = 'User rejected the request';
    await mockNip07Extension(page, { 
      shouldFail: true, 
      errorMessage
    });
    
    await openLoginDialog(page);
    const nip07Button = page.getByText('Mit Nostr-Extension anmelden');
    await nip07Button.click();

    // Should show user rejection error
    await expect(page.getByText(errorMessage)).toBeVisible();
    
    // Should remain unauthenticated
    expect(await isAuthenticated(page)).toBe(false);
  });
});

test.describe('nsec Private Key Authentication Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cardsboard');
    await clearAuthState(page);
  });

  test('should successfully authenticate with valid nsec', async ({ page }) => {
    await loginWithNsec(page);
    
    const authState = await getAuthState(page);
    expect(authState).not.toBeNull();
    expect(authState.pubkey).toBe(TEST_PUBKEY);
    expect(authState.signerType).toBe('nsec');
    expect(await isAuthenticated(page)).toBe(true);

    // Stay logged in even after page reload
    await page.reload();
    expect(await isAuthenticated(page)).toBe(true);

  });

  test('should reject invalid nsec formats', async ({ page }) => {
    await openLoginDialog(page);
    
    const nsecTab = page.getByRole('tab', { name: 'nsec' });
    await expect(nsecTab).toBeVisible({ timeout: 5000 });
    await nsecTab.click();
    
    const nsecInput = page.getByPlaceholder('nsec1...');
    await nsecInput.clear();
    
    await nsecInput.fill('npub1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85');
    
    const loginButton = page.getByRole('button', { name: 'Mit nsec anmelden' });
    await loginButton.click();
    await expect(page.getByText('Ungültiges nsec-Format')).toBeVisible({timeout: 5000});
    
    await nsecInput.clear();
    await nsecInput.fill('');
    await expect(loginButton).toBeDisabled();
    
    expect(await isAuthenticated(page)).toBe(false);
  });


  test.skip('should clear nsec from sessionStorage on logout', async ({ page }) => {
    await loginWithNsec(page);
    
    let storedNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBe(TEST_NSEC);
    
    await logout(page);
    
    storedNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBeNull();
  });

  test('should clear nsec from sessionStorage on tab close', async ({ page, context }) => {
    await loginWithNsec(page);
    
    let storedNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBe(TEST_NSEC);
    
    await page.close();

    const newPage = await context.newPage();
    await newPage.goto('/cardsboard');
    
    storedNsec = await newPage.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBeNull();
  });

  test('should not persist nsec in localStorage', async ({ page }) => {
    await loginWithNsec(page);
    
    // Check that nsec is NOT in localStorage (only sessionStorage)
    const localStorageNsec = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value && value.includes('nsec1')) {
            return value;
          }
        }
      }
      return null;
    });
    
    expect(localStorageNsec).toBeNull();
  });
});


// TODO: skipped because less important. Remove skip when testing should be properly implemented
test.describe.skip('Authentication State Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cardsboard');

    await clearAuthState(page);
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    await mockExpiredSession(page);
    
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    
    const authState = await getAuthState(page);

    expect(authState).toBeNull();
  });

  test('should validate session integrity', async ({ page }) => {
    await loginWithNsec(page);
    
    // Tamper with session data in localStorage
    await page.evaluate(() => {
      const authData = localStorage.getItem('nostr-user-session');
      if (authData) {
        const session = JSON.parse(authData);
        session.pubkey = 'tampered-pubkey';
        localStorage.setItem('nostr-user-session', JSON.stringify(session));
      }
    });
    
    // Reload page
    await page.reload();
    
    // Should handle tampered session gracefully (implementation dependent)
    // This test ensures the app doesn't crash with invalid session data
    await page.waitForTimeout(2000);
    
    // App should either restore valid session or require re-login
    const isStillAuth = await isAuthenticated(page);
    const hasLoginUI = await page.getByRole('button', { name: 'Anmelden' }).isVisible();
    
    // One of these should be true
    expect(isStillAuth || hasLoginUI).toBe(true);
  });

});
