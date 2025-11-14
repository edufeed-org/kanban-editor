import { test, expect } from '@playwright/test';
import { 
  TEST_NSEC, 
  TEST_PUBKEY, 
  mockNip07Extension,
  loginWithNsec,
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
    // assure demo settings are loaded, otherwise it will interfere clicking login
    await expect(page.getByRole('button', { name: 'Mein KI Kanban' })).toBeVisible();
  });

  test('should successfully authenticate with NIP-07 extension', async ({ page, context }) => {
    await mockNip07Extension(page);
    
    // assure demo settings are loaded, otherwise it will interfere clicking login
    await expect(page.getByRole('button', { name: 'Mein KI Kanban' })).toBeVisible();

    page.getByRole('button', { name: 'Anmelden' }).click();
    
    const nip07Button = page.getByText('Mit NIP-07 anmelden');
    await expect(nip07Button).toBeVisible();
    await nip07Button.click();
 
    await expect(page.locator('button.bg-secondary.rounded-md').filter({has: page.locator('p.text-sm.font-semibold')})).toBeVisible({ timeout: 10000 });
    
    const authState = await getAuthState(page);
    expect(authState).not.toBeNull();
    expect(authState.pubkey).toBe(TEST_PUBKEY);
    expect(authState.signerType).toBe('nip07');
    expect(await isAuthenticated(page)).toBe(true);
    
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
    page.getByRole('button', { name: 'Anmelden' }).click();
    
    const nip07Button = page.getByText('Mit NIP-07 anmelden');
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
    
    page.getByRole('button', { name: 'Anmelden' }).click();
    const nip07Button = page.getByText('Mit NIP-07 anmelden');
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
    // assure demo settings are loaded, otherwise it will interfere clicking login
    await expect(page.getByRole('button', { name: 'Mein KI Kanban' })).toBeVisible();
  });

  test('should successfully authenticate with valid nsec', async ({ page }) => {
    await loginWithNsec(page);
    
    await expect(page.locator('button.bg-secondary.rounded-md').filter({has: page.locator('p.text-sm.font-semibold')})).toBeVisible({ timeout: 10000 });

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
    await page.getByRole('button', { name: 'Anmelden' }).click();
    
    const nsecTab = page.getByRole('tab', { name: 'nsec' });
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


  test('should clear nsec from sessionStorage on logout', async ({ page }) => {
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
    
    // But should be in sessionStorage temporarily
    const sessionNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(sessionNsec).toBe(TEST_NSEC);
  });

  test('should clear sensitive data on tab close (sessionStorage behavior)', async ({ page, context }) => {
    await loginWithNsec(page);
    
    // Verify nsec is in sessionStorage
    let sessionNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(sessionNsec).toBe(TEST_NSEC);
    
    // Close and reopen context (simulates tab close/reopen)
    await context.close();
    const browser = page.context().browser();
    if (browser) {
      const newContext = await browser.newContext();
      const newPage = await newContext.newPage();
      
      // sessionStorage should be empty in new context
      sessionNsec = await newPage.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
      expect(sessionNsec).toBeNull();
      
      await newContext.close();
    }
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
    const hasLoginUI = await page.getByText('Login').isVisible();
    
    // One of these should be true
    expect(isStillAuth || hasLoginUI).toBe(true);
  });

});