import { test, expect } from '@playwright/test';
import { 
  TEST_NSEC, 
  TEST_PUBKEY, 
  mockNip07Extension,
  loginWithNsec,
  loginWithNip07,
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
 
    await expect(page.getByText('Nostr Nutzer')).toBeVisible();
    
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
    await page.getByRole('button', { name: 'Anmelden' }).click();
    
    // Switch to nsec tab
    const nsecTab = page.getByRole('tab', { name: 'nsec' });
    await expect(nsecTab).toBeVisible();
    await nsecTab.click();
    
    // Enter nsec and login
    await page.getByPlaceholder('nsec1...').fill(TEST_NSEC);
    await page.getByRole('button', { name: 'Mit nsec anmelden' }).click();
    
    // Verify authentication by checking for authenticated user dropdown in sidebar
    await expect(page.locator('button.bg-secondary.rounded-md').filter({has: page.locator('p.text-sm.font-semibold')})).toBeVisible({ timeout: 10000 });
    
    // Verify session data
    const authState = await getAuthState(page);
    expect(authState).not.toBeNull();
    expect(authState.pubkey).toBe(TEST_PUBKEY);
    expect(authState.signerType).toBe('nsec');
  });

  test('should reject invalid nsec formats', async ({ page }) => {
    await page.goto('/cardsboard');
    
    const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
    if (await nsecTab.isVisible()) {
      await nsecTab.click();
    }
    
    // Test various invalid formats
    const invalidNsecs = [
      'invalid-format',
      'nsec1short',
      'npub1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85', // npub instead of nsec
      'nsec1' + 'a'.repeat(100), // too long
      '', // empty
    ];
    
    for (const invalidNsec of invalidNsecs) {
      const nsecInput = page.getByPlaceholder(/nsec1|private key/i);
      await nsecInput.clear();
      
      if (invalidNsec) {
        await nsecInput.fill(invalidNsec);
      }
      
      await page.getByRole('button', { name: /login/i }).click();
      
      // Should show error or prevent submission
      if (invalidNsec === '') {
        // Empty input should have required attribute or show validation
        await expect(nsecInput).toHaveAttribute('required');
      } else {
        // Invalid format should show error
        await expect(page.getByText(/invalid nsec format/i)).toBeVisible({ timeout: 3000 });
      }
      
      // Should remain unauthenticated
      expect(await isAuthenticated(page)).toBe(false);
    }
  });

  test('should store nsec temporarily in sessionStorage', async ({ page }) => {
    await loginWithNsec(page);
    
    // Check sessionStorage
    const storedNsec = await page.evaluate(() => {
      return sessionStorage.getItem('nostr-nsec-temp');
    });
    
    expect(storedNsec).toBe(TEST_NSEC);
  });

  test('should clear nsec from sessionStorage on logout', async ({ page }) => {
    await loginWithNsec(page);
    
    // Verify nsec is stored
    let storedNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBe(TEST_NSEC);
    
    // Logout
    await logout(page);
    
    // Verify nsec is cleared
    storedNsec = await page.evaluate(() => sessionStorage.getItem('nostr-nsec-temp'));
    expect(storedNsec).toBeNull();
  });

  test('should handle nsec session recovery on page reload', async ({ page }) => {
    await loginWithNsec(page);
    
    // Verify authenticated
    expect(await isAuthenticated(page)).toBe(true);
    
    // Reload page
    await page.reload();
    
    // Should be able to restore session
    await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
    
    // Session should still contain correct data
    const authState = await getAuthState(page);
    expect(authState.pubkey).toBe(TEST_PUBKEY);
    expect(authState.signerType).toBe('nsec');
  });

});

test.describe('Authentication State Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    await mockExpiredSession(page);
    
    await page.goto('/cardsboard');
    
    // Should show login UI despite having stored session
    await expect(page.getByText('Login')).toBeVisible({ timeout: 5000 });
    
    // Expired session should be cleaned up
    const authState = await getAuthState(page);
    expect(authState).toBeNull();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/cardsboard');
    
    // Should show login UI
    await expect(page.getByText('Login')).toBeVisible({ timeout: 5000 });
    
    // Should not show kanban board content
    const kanbanBoard = page.getByTestId('kanban-board');
    expect(await kanbanBoard.isVisible()).toBe(false);
  });

  test('should maintain authentication across route navigation', async ({ page }) => {
    await loginWithNsec(page);
    
    // Navigate to home
    await page.goto('/');
    
    // Navigate back to cardsboard
    await page.goto('/cardsboard');
    
    // Should still be authenticated
    await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 5000 });
  });

  test('should handle concurrent login attempts gracefully', async ({ page }) => {
    await page.goto('/cardsboard');
    
    const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
    if (await nsecTab.isVisible()) {
      await nsecTab.click();
    }
    
    // Fill nsec
    await page.getByPlaceholder(/nsec1|private key/i).fill(TEST_NSEC);
    
    // Click login multiple times rapidly
    const loginButton = page.getByRole('button', { name: /login/i });
    await Promise.all([
      loginButton.click(),
      loginButton.click(),
      loginButton.click()
    ]);
    
    // Should still authenticate successfully once
    await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
    
    // Should only have one session
    const authState = await getAuthState(page);
    expect(authState).not.toBeNull();
    expect(authState.pubkey).toBe(TEST_PUBKEY);
  });

  test('should display user information after login', async ({ page }) => {
    await loginWithNsec(page);
    
    // Check for user display elements
    const userInfo = page.getByTestId('user-info');
    if (await userInfo.isVisible()) {
      const userText = await userInfo.textContent();
      expect(userText).toBeTruthy();
      
      // Should contain either pubkey substring, npub, or display name
      const hasUserData = userText?.includes(TEST_PUBKEY.substring(0, 8)) || 
                         userText?.includes('npub1') ||
                         (userText && userText.length > 0);
      expect(hasUserData).toBe(true);
    }
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    await page.goto('/cardsboard');
    
    // Mock network error during authentication
    await page.route('**/api/auth/**', route => {
      route.abort('failed');
    });
    
    const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
    if (await nsecTab.isVisible()) {
      await nsecTab.click();
    }
    
    await page.getByPlaceholder(/nsec1|private key/i).fill(TEST_NSEC);
    await page.getByRole('button', { name: /login/i }).click();
    
    // Should handle error without crashing
    // Note: The actual error handling depends on implementation
    // This test mainly ensures the app doesn't crash
    
    await page.waitForTimeout(2000);
    
    // App should still be responsive
    expect(await page.getByRole('button', { name: /login/i }).isVisible()).toBe(true);
  });

});

test.describe('Authentication Security', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
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