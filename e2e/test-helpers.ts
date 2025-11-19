import { type Page, type BrowserContext, expect } from '@playwright/test';

// Test constants
export const TEST_NSEC = 'nsec1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85';
export const TEST_PUBKEY = '79dff8f82963424e0bb02708a22e44b4980893e3a4be0fa3cb60a43b946764e3';
export const TEST_NPUB = 'npub1ufns5j7mngv80w8rn2j0rd2elds6ltd6ev6d5j3ex7dw3wpq6qqsz2uqmfhpm0';

/**
 * Mock NIP-07 window.nostr extension for testing
 */
export async function mockNip07Extension(page: Page, options: {
  shouldFail?: boolean;
  publicKey?: string;
  errorMessage?: string;
} = {}) {
  const publicKey = options.publicKey || TEST_PUBKEY;
  const shouldFail = options.shouldFail || false;
  const errorMessage = options.errorMessage || '';
  
  page.evaluate(({ shouldFail, publicKey, errorMessage }) => {
    if (shouldFail) {
      (window as any).nostr = {
        publicKey: () => {
          throw new Error(errorMessage);
        },
        getPublicKey: () => {
          throw new Error(errorMessage);
        },
        signEvent: () => {
          throw new Error(errorMessage);
        }
      };
    } else {
      (window as any).nostr = {
        publicKey,
        getPublicKey: async () => publicKey,
        signEvent: async (event: any) => {
          event.pubkey = publicKey;
          event.id = 'mock-event-id-' + Date.now();
          event.sig = 'mock-signature-' + Math.random().toString(36).substring(7);
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
      }
    };
  }, { shouldFail, publicKey, errorMessage });
}

/**
 * Login with nsec private key
 * need to be at /cardsboard first!
 */
export async function loginWithNsec(page: Page, nsec: string = TEST_NSEC) {
  await page.getByRole('button', { name: 'Anmelden' }).click();
  
  const nsecTab = page.getByRole('tab', { name: 'nsec' });
  await expect(nsecTab).toBeVisible();
  await nsecTab.click();
  
  await page.getByPlaceholder('nsec1...').fill(TEST_NSEC);
  await page.getByRole('button', { name: 'Mit nsec anmelden' }).click();
  
  await expect(page.locator('button.bg-secondary.rounded-md').filter({has: page.locator('p.text-sm.font-semibold')})).toBeVisible({ timeout: 10000 });
}

/**
 * Login with NIP-07 (requires mocked extension)
 * need to be at /cardsboard first!
 */
export async function loginWithNip07(page: Page) {
    await mockNip07Extension(page);
    
    // assure demo settings are loaded, otherwise it will interfere clicking login
    await expect(page.getByRole('button', { name: 'Mein KI Kanban' })).toBeVisible();

    page.getByRole('button', { name: 'Anmelden' }).click();
    
    const nip07Button = page.getByText('Mit NIP-07 anmelden');
    await expect(nip07Button).toBeVisible();
    await nip07Button.click();
}

/**
 * Clear all authentication-related storage and state
 */
export async function clearAuthState(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      try {
        // Clear localStorage
        localStorage.removeItem('nostr-user-session');
        localStorage.removeItem('nostr-nsec-temp');
        
        // Clear sessionStorage
        sessionStorage.removeItem('nostr-nsec-temp');
        sessionStorage.removeItem('nostr-user-session');
        
        console.log('🧹 Auth state cleared');
      } catch (error) {
        console.log('⚠️ Error clearing storage:', error);
      }
    });
  } catch (error) {
    console.log('⚠️ Security error accessing storage in clearAuthState:', error);
    // If localStorage/sessionStorage access is denied, continue without throwing
  }
}

/**
 * Get the current auth state from localStorage
 */
export async function getAuthState(page: Page): Promise<any> {
  try {
    return await page.evaluate(() => {
      const session = localStorage.getItem('nostr-user-session');
      console.log({session})
      return session ? JSON.parse(session) : null;
    });
  } catch (error) {
    console.log('⚠️ Error accessing localStorage in getAuthState:', error);
    return null;
  }
}

/**
 * Create a test board with sample data
 */
export async function createTestBoard(page: Page, boardName: string = 'Test Board') {
  // Assuming there's a create board button/functionality
  const createBoardButton = page.getByRole('button', { name: /create board|new board/i });
  if (await createBoardButton.isVisible()) {
    await createBoardButton.click();
    await page.getByPlaceholder(/board name|title/i).fill(boardName);
    await page.getByRole('button', { name: /create|save/i }).click();
  }
}

/**
 * Create a test card in the specified column
 */
export async function createTestCard(page: Page, columnIndex: number = 0, cardData: {
  title: string;
  description?: string;
}) {
  const addCardButtons = page.getByTestId('add-card-button');
  await addCardButtons.nth(columnIndex).click();
  
  await page.getByPlaceholder(/card title|heading/i).fill(cardData.title);
  
  if (cardData.description) {
    await page.getByPlaceholder(/description/i).fill(cardData.description);
  }
  
  await page.getByRole('button', { name: /save|create/i }).click();
  
  await page.waitForSelector(`text=${cardData.title}`, { timeout: 5000 });
}

/**
 * Wait for the kanban board to be fully loaded
 */
export async function waitForBoardLoaded(page: Page) {
  await page.waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 });
  
  // Wait for default columns to be visible
  await page.waitForSelector('text=To Do', { timeout: 5000 });
  await page.waitForSelector('text=In Progress', { timeout: 5000 });
  await page.waitForSelector('text=Done', { timeout: 5000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for the authenticated user dropdown in the sidebar
    return await page.locator('button.bg-secondary.rounded-md').isVisible({ timeout: 1000 });
  } catch {
    // If that fails, check localStorage as backup
    try {
      return await page.evaluate(() => {
        return localStorage.getItem('nostr-user-session') !== null;
      });
    } catch {
      return false;
    }
  }
}

export async function logout(page: Page) {
  const userDropdown = page.getByTestId('user-dropdown');
  await userDropdown.click();
  
  const logoutButton = page.getByText('Abmelden');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }
  
  await page.waitForSelector('button:has-text("Anmelden")', { timeout: 5000 });
}

/**
 * Mock expired session in localStorage
 */
export async function mockExpiredSession(page: Page) {
  await page.evaluate(() => {
    const expiredSession = {
      pubkey: 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8',
      npub: 'npub1ufns5j7mngv80w8rn2j0rd2elds6ltd6ev6d5j3ex7dw3wpq6qqsz2uqmfhpm0',
      signerType: 'nsec',
      lastLogin: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      expires: Date.now() - 24 * 60 * 60 * 1000, // expired yesterday
      profile: {}
    };
    return localStorage.setItem('nostr-user-session', JSON.stringify(expiredSession));
  });
}

/**
 * Verify that a specific card exists on the board
 */
export async function verifyCardExists(page: Page, cardTitle: string): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${cardTitle}`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open card details dialog
 */
export async function openCardDetails(page: Page, cardTitle: string) {
  await page.getByText(cardTitle).click();
  
  // Wait for dialog to open
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}

/**
 * Add a comment to a card (assumes card details dialog is open)
 */
export async function addComment(page: Page, commentText: string) {
  const commentInput = page.getByPlaceholder(/comment|message/i);
  await commentInput.fill(commentText);
  await page.getByRole('button', { name: /send|post|add comment/i }).click();
  
  // Wait for comment to appear
  await page.waitForSelector(`text=${commentText}`, { timeout: 5000 });
}

/**
 * Test data generators
 */
export const testData = {
  boards: [
    { name: 'Project Alpha', description: 'Main project board' },
    { name: 'Marketing Campaign', description: 'Q4 marketing initiatives' },
    { name: 'Bug Tracking', description: 'Development issues' }
  ],
  
  cards: [
    { title: 'Setup Development Environment', description: 'Install Node.js, configure IDE' },
    { title: 'Design Database Schema', description: 'Create ERD and define relationships' },
    { title: 'Implement Authentication', description: 'Add login/logout functionality' },
    { title: 'Write Unit Tests', description: 'Test coverage for core functions' },
    { title: 'Deploy to Production', description: 'Configure CI/CD pipeline' }
  ],
  
  comments: [
    'This looks good to me',
    'We need to discuss this in the next meeting',
    'Can you add more details?',
    'Blocked by external dependency',
    'Ready for review'
  ]
};