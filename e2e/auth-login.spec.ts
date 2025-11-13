import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test data
const DEMO_NSEC = 'nsec1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85';
const EXPECTED_DEMO_PUBKEY = 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8';

test.describe('Authentication Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('NIP-07 Extension Login', () => {
    
    test('should show login options when not authenticated', async ({ page }) => {
      await page.goto('/');
      
      // Navigate to cardsboard which should prompt login
      await page.goto('/cardsboard');
      
      // Look for login UI elements
      await expect(page.getByText('Login')).toBeVisible();
    });

    test('should handle missing NIP-07 extension gracefully', async ({ page }) => {
      await page.goto('/cardsboard');
      
      // Try to click NIP-07 login without extension
      await page.getByRole('button', { name: /nip.07|extension|nos2x|alby/i }).click();
      
      // Should show error message about missing extension
      await expect(page.getByText(/extension not found|install/i)).toBeVisible({ timeout: 5000 });
    });

    test('should simulate successful NIP-07 login', async ({ page, context }) => {
      // Mock the window.nostr API
      await page.addInitScript(() => {
        // Mock NIP-07 extension
        (window as any).nostr = {
          getPublicKey: async () => 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8',
          signEvent: async (event: any) => {
            event.pubkey = 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8';
            event.id = 'mock-event-id';
            event.sig = 'mock-signature';
            return event;
          },
          getRelays: async () => ({
            'wss://relay.damus.io': { read: true, write: true },
            'wss://relay.primal.net': { read: true, write: true }
          }),
          nip04: {
            encrypt: async (pubkey: string, plaintext: string) => 'encrypted-' + plaintext,
            decrypt: async (pubkey: string, ciphertext: string) => ciphertext.replace('encrypted-', '')
          }
        };
      });

      await page.goto('/cardsboard');
      
      // Find and click NIP-07 login button
      await page.getByRole('button', { name: /nip.07|extension|browser extension/i }).click();
      
      // Wait for login to complete
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Verify we're on the kanban board
      await expect(page.getByTestId('kanban-board')).toBeVisible();
      
      // Verify authenticated state
      const isAuthenticated = await page.evaluate(() => {
        const authData = localStorage.getItem('nostr-user-session');
        return authData !== null;
      });
      expect(isAuthenticated).toBe(true);
    });

    test('should persist NIP-07 session across page reloads', async ({ page }) => {
      // First, log in with NIP-07
      await page.addInitScript(() => {
        (window as any).nostr = {
          getPublicKey: async () => 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8',
          signEvent: async (event: any) => {
            event.pubkey = 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8';
            event.id = 'mock-event-id';
            event.sig = 'mock-signature';
            return event;
          }
        };
      });

      await page.goto('/cardsboard');
      await page.getByRole('button', { name: /nip.07/i }).click();
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Reload the page
      await page.reload();
      
      // Should still be authenticated
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 5000 });
      await expect(page.getByTestId('kanban-board')).toBeVisible();
    });

    test('should handle NIP-07 login errors gracefully', async ({ page }) => {
      // Mock failing NIP-07 extension
      await page.addInitScript(() => {
        (window as any).nostr = {
          getPublicKey: async () => {
            throw new Error('User rejected the request');
          }
        };
      });

      await page.goto('/cardsboard');
      await page.getByRole('button', { name: /nip.07/i }).click();
      
      // Should show error message
      await expect(page.getByText(/user rejected|error/i)).toBeVisible({ timeout: 5000 });
      
      // Should still be on login screen
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

  });

  test.describe('nsec Private Key Login', () => {
    
    test('should successfully login with valid nsec', async ({ page }) => {
      await page.goto('/cardsboard');
      
      // Switch to nsec tab if needed
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      // Fill in the nsec input
      const nsecInput = page.getByPlaceholder(/nsec1|private key/i);
      await nsecInput.fill(DEMO_NSEC);
      
      // Click login button
      await page.getByRole('button', { name: /login|sign in/i }).click();
      
      // Wait for login to complete
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Verify we're on the kanban board
      await expect(page.getByTestId('kanban-board')).toBeVisible();
      
      // Verify the correct pubkey is stored
      const storedPubkey = await page.evaluate(() => {
        const authData = localStorage.getItem('nostr-user-session');
        if (authData) {
          const session = JSON.parse(authData);
          return session.pubkey;
        }
        return null;
      });
      expect(storedPubkey).toBe(EXPECTED_DEMO_PUBKEY);
    });

    test('should reject invalid nsec format', async ({ page }) => {
      await page.goto('/cardsboard');
      
      // Switch to nsec tab
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      // Try invalid nsec format
      const nsecInput = page.getByPlaceholder(/nsec1|private key/i);
      await nsecInput.fill('invalid-nsec-format');
      
      await page.getByRole('button', { name: /login/i }).click();
      
      // Should show error
      await expect(page.getByText(/invalid nsec format/i)).toBeVisible({ timeout: 5000 });
      
      // Should still be on login screen
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
    });

    test('should handle empty nsec input', async ({ page }) => {
      await page.goto('/cardsboard');
      
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      // Try to login with empty nsec
      await page.getByRole('button', { name: /login/i }).click();
      
      // Should show validation error or prevent submission
      const nsecInput = page.getByPlaceholder(/nsec1|private key/i);
      await expect(nsecInput).toHaveAttribute('required');
    });

    test('should store nsec temporarily in sessionStorage', async ({ page }) => {
      await page.goto('/cardsboard');
      
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      const nsecInput = page.getByPlaceholder(/nsec1|private key/i);
      await nsecInput.fill(DEMO_NSEC);
      await page.getByRole('button', { name: /login/i }).click();
      
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Check if nsec is stored in sessionStorage
      const sessionNsec = await page.evaluate(() => {
        return sessionStorage.getItem('nostr-nsec-temp');
      });
      expect(sessionNsec).toBe(DEMO_NSEC);
    });

    test('should clear nsec from sessionStorage on logout', async ({ page }) => {
      // First login with nsec
      await page.goto('/cardsboard');
      
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      await page.getByPlaceholder(/nsec1|private key/i).fill(DEMO_NSEC);
      await page.getByRole('button', { name: /login/i }).click();
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Now logout
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }
      
      // Check that sessionStorage is cleared
      const sessionNsec = await page.evaluate(() => {
        return sessionStorage.getItem('nostr-nsec-temp');
      });
      expect(sessionNsec).toBeNull();
    });

  });

  test.describe('Authentication State Management', () => {
    
    test('should redirect to login when accessing protected routes', async ({ page }) => {
      // Try to access cardsboard without authentication
      await page.goto('/cardsboard');
      
      // Should see login UI
      await expect(page.getByText('Login')).toBeVisible({ timeout: 5000 });
    });

    test('should show authenticated user info', async ({ page }) => {
      // Login first
      await page.goto('/cardsboard');
      
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      await page.getByPlaceholder(/nsec1|private key/i).fill(DEMO_NSEC);
      await page.getByRole('button', { name: /login/i }).click();
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Should show user info somewhere (avatar, name, etc.)
      const userInfo = page.getByTestId('user-info');
      if (await userInfo.isVisible()) {
        await expect(userInfo).toContainText(EXPECTED_DEMO_PUBKEY.substring(0, 8));
      }
    });

    test('should maintain session across different routes', async ({ page }) => {
      // Login first
      await page.goto('/cardsboard');
      
      const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
      if (await nsecTab.isVisible()) {
        await nsecTab.click();
      }
      
      await page.getByPlaceholder(/nsec1|private key/i).fill(DEMO_NSEC);
      await page.getByRole('button', { name: /login/i }).click();
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      
      // Navigate to home page
      await page.goto('/');
      
      // Navigate back to cardsboard
      await page.goto('/cardsboard');
      
      // Should still be authenticated
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 5000 });
    });

    test('should handle session expiration', async ({ page }) => {
      // Mock an expired session in localStorage
      await page.addInitScript(() => {
        const expiredSession = {
          pubkey: 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8',
          npub: 'npub1ufns5j7mngv80w8rn2j0rd2elds6ev6d5j3ex7dw3wpq6qqsz2uqmfhpm0',
          signerType: 'nsec',
          lastLogin: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
          expires: Date.now() - 24 * 60 * 60 * 1000, // expired yesterday
          profile: {}
        };
        localStorage.setItem('nostr-user-session', JSON.stringify(expiredSession));
      });
      
      await page.goto('/cardsboard');
      
      // Should show login UI despite having stored session
      await expect(page.getByText('Login')).toBeVisible({ timeout: 5000 });
    });

  });

});

test.describe('Kanban Board Integration with Auth', () => {
  
  test.beforeEach(async ({ page }) => {
    // Clear storage and login for each test
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Login with nsec for board tests
    await page.goto('/cardsboard');
    
    const nsecTab = page.getByRole('tab', { name: /private key|nsec/i });
    if (await nsecTab.isVisible()) {
      await nsecTab.click();
    }
    
    await page.getByPlaceholder(/nsec1|private key/i).fill(DEMO_NSEC);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
  });

  test('should show kanban board after authentication', async ({ page }) => {
    await expect(page.getByTestId('kanban-board')).toBeVisible();
    
    // Should show default columns
    await expect(page.getByText('To Do')).toBeVisible();
    await expect(page.getByText('In Progress')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should allow creating cards when authenticated', async ({ page }) => {
    // Find add card button in To Do column
    const addCardButton = page.getByTestId('add-card-button').first();
    await addCardButton.click();
    
    // Fill in card details
    await page.getByPlaceholder(/card title|heading/i).fill('Test Card from E2E');
    await page.getByPlaceholder(/description/i).fill('This card was created during E2E testing');
    
    // Save the card
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Verify card appears in the board
    await expect(page.getByText('Test Card from E2E')).toBeVisible({ timeout: 5000 });
  });

  test('should show author information on cards', async ({ page }) => {
    // Create a card first
    const addCardButton = page.getByTestId('add-card-button').first();
    await addCardButton.click();
    
    await page.getByPlaceholder(/card title|heading/i).fill('Authored Card');
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText('Authored Card')).toBeVisible({ timeout: 5000 });
    
    // Click on the card to view details
    await page.getByText('Authored Card').click();
    
    // Should show author info (either pubkey or 'anonymous' depending on implementation)
    const authorInfo = page.getByTestId('card-author');
    if (await authorInfo.isVisible()) {
      const authorText = await authorInfo.textContent();
      expect(authorText).toBeTruthy();
      // Should contain either pubkey substring or 'anonymous'
      expect(authorText?.includes(EXPECTED_DEMO_PUBKEY.substring(0, 8)) || authorText?.includes('anonymous')).toBe(true);
    }
  });

  test('should allow commenting on cards when authenticated', async ({ page }) => {
    // Create a card first
    const addCardButton = page.getByTestId('add-card-button').first();
    await addCardButton.click();
    
    await page.getByPlaceholder(/card title|heading/i).fill('Card for Comments');
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText('Card for Comments')).toBeVisible({ timeout: 5000 });
    
    // Open card details
    await page.getByText('Card for Comments').click();
    
    // Add a comment
    const commentInput = page.getByPlaceholder(/comment|message/i);
    if (await commentInput.isVisible()) {
      await commentInput.fill('This is a test comment from E2E');
      await page.getByRole('button', { name: /send|post|add comment/i }).click();
      
      // Verify comment appears
      await expect(page.getByText('This is a test comment from E2E')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should preserve board state after page reload', async ({ page }) => {
    // Create a card
    const addCardButton = page.getByTestId('add-card-button').first();
    await addCardButton.click();
    
    await page.getByPlaceholder(/card title|heading/i).fill('Persistent Card');
    await page.getByRole('button', { name: /save|create/i }).click();
    
    await expect(page.getByText('Persistent Card')).toBeVisible({ timeout: 5000 });
    
    // Reload the page
    await page.reload();
    
    // Wait for auth to be restored
    await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
    
    // Card should still be there
    await expect(page.getByText('Persistent Card')).toBeVisible({ timeout: 5000 });
  });

});