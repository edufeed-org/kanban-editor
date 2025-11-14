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
 */
export async function loginWithNip07(page: Page) {
  await mockNip07Extension(page);
  await page.goto('/cardsboard');
  
  // Click NIP-07 login
  await page.getByRole('button', { name: /nip.07|extension|browser extension/i }).click();
  
  // Wait for authentication
  await page.waitForSelector('[data-testid="authenticated-user"]', { timeout: 10000 });
}

/**
 * Clear all authentication state
 */
export async function clearAuthState(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
// {"kanban-config":"{\"$comment\":\"Kanban Board Configuration - Single Source of Truth\",\"$schema_version\":\"1.1.0\",\"$last_updated\":\"2025-11-04\",\"ui\":{\"maxCardsBeforeScroll\":20,\"alignColumnsToMaxHeight\":true,\"columnWidth\":350,\"theme\":\"auto\",\"$comment\":\"UI-spezifische Einstellungen für Layout und Darstellung\"},\"nostr\":{\"relaysPublic\":[\"ws://localhost:7000\"],\"relaysPrivate\":[]},\"llm\":{\"model\":\"ollama/mistral\",\"baseUrl\":\"http://localhost:11434\",\"apiKey\":\"\",\"$comment_apiKey\":\"⚠️ SECURITY: Nur für lokales Ollama speichern! Remote APIs: .env.local nutzen!\",\"systemPrompt\":\"Du bist ein hilfreicher KI-Assistant für Kanban Board Management. Helfe dem Benutzer beim Organisieren und Strukturieren von Aufgaben.\",\"useLlmIntent\":false,\"$comment_useLlmIntent\":\"LLM-basierte Intent Detection (experimentell). false = regelbasiert (schneller, offline), true = LLM-basiert (flexibler, benötigt API)\"},\"oidc\":{\"authority\":\"http://localhost:8080/realms/master\",\"clientId\":\"kanban-board\"},\"mcp\":{\"urls\":[]},\"shareTokenMaxSize\":200000,\"defaults\":{\"columns\":[\"Material\",\"Einstieg\",\"Erarbeitung\",\"Sicherung\"],\"boardPublishState\":\"private\",\"cardPublishState\":\"private\"},\"sidebar\":{\"showLeft\":true,\"showRight\":true},\"learning\":{\"useLearningManager\":true,\"confidenceThreshold\":0.7,\"initialConfidence\":0.3,\"confidenceIncrement\":0.15,\"minUsageCount\":3,\"$comment_useLearningManager\":\"Aktiviert das Cross-Board Learning System (UserPreferencesStore + BoardLearningManager)\",\"$comment_confidenceThreshold\":\"Ab diesem Wert (0.0-1.0) werden KI-Aktionen automatisch ausgeführt ohne User-Confirmation\",\"$comment_initialConfidence\":\"Startwert für neu gelernte Patterns\",\"$comment_confidenceIncrement\":\"Um wie viel steigt Confidence bei jeder erfolgreichen Nutzung\",\"$comment_minUsageCount\":\"Mindestanzahl Nutzungen bevor Pattern als 'learned' gilt\"},\"allow_demo_session\":{\"enabled\":false}}","kanban-board-7edb4afa2e637b302828b9dca5f128ec23ea879622948b0c1547e42d1445bc74":"{\"id\":\"board-7edb4afa2e637b302828b9dca5f128ec23ea879622948b0c1547e42d1445bc74\",\"name\":\"Mein KI Kanban Board\",\"description\":\"Ein intelligentes Kanban-Board mit KI-Unterstützung\",\"tags\":[],\"ccLicense\":\"cc-by-4.0\",\"publishState\":\"draft\",\"createdAt\":\"2025-11-13T14:54:56.010Z\",\"updatedAt\":\"2025-11-13T14:54:56.010Z\",\"lastAccessedAt\":\"2025-11-13T14:54:56.010Z\",\"hasUnseenChanges\":false,\"author\":\"e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8\",\"maintainers\":[\"e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8\"],\"columns\":[{\"id\":\"column-a8cffab7326b8ae3e616014b7249f75d36cfe1e2de745e2014185af458e8e6e5\",\"name\":\"To Do\",\"color\":\"blue\",\"cards\":[]},{\"id\":\"column-45721b74f01cb6488dfde28e84246617b54ec3b6adb5847f5a49f5ac03856f1b\",\"name\":\"In Progress\",\"color\":\"orange\",\"cards\":[]},{\"id\":\"column-10febceefd2ab8347b39b641e075af5df7596c7b57c4a614daa565474f09777d\",\"name\":\"Done\",\"color\":\"green\",\"cards\":[]}]}","kanban-settings":"{\"maxCardsBeforeScroll\":20,\"alignColumnsToMaxHeight\":true,\"columnWidth\":350,\"theme\":\"auto\",\"relaysPublic\":[\"ws://localhost:7000\"],\"relaysPrivate\":[],\"draftPublishingMode\":\"private-relays\",\"llmModel\":\"ollama/mistral\",\"llmBaseUrl\":\"http://localhost:11434\",\"llmApiKey\":\"\",\"llmUseLlmIntent\":false,\"llmSystemPrompt\":\"Du bist ein hilfreicher KI-Assistant für Kanban Board Management. Helfe dem Benutzer beim Organisieren und Strukturieren von Aufgaben.\",\"mcpUrls\":[],\"defaultColumns\":[\"Material\",\"Einstieg\",\"Erarbeitung\",\"Sicherung\"],\"defaultBoardPublishState\":\"private\",\"defaultCardPublishState\":\"private\",\"showLeftSidebar\":true,\"showRightSidebar\":true,\"maxBoardsInSidebar\":10,\"useLearningManager\":true,\"learningConfidenceThreshold\":0.7,\"learningInitialConfidence\":0.3,\"learningConfidenceIncrement\":0.15,\"learningMinUsageCount\":3}"}
/**
 * Get current authentication state from localStorage
 */
export async function getAuthState(page: Page) {
  return await page.evaluate(() => {
    const authData = localStorage.getItem('nostr-user-session');
    return authData ? JSON.parse(authData) : null;
  });
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
  // Find add card button in the specified column
  const addCardButtons = page.getByTestId('add-card-button');
  await addCardButtons.nth(columnIndex).click();
  
  // Fill card details
  await page.getByPlaceholder(/card title|heading/i).fill(cardData.title);
  
  if (cardData.description) {
    await page.getByPlaceholder(/description/i).fill(cardData.description);
  }
  
  // Save the card
  await page.getByRole('button', { name: /save|create/i }).click();
  
  // Wait for card to appear
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

/**
 * Check if user is authenticated by looking for UI indicators
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return localStorage.getItem('nostr-user-session') !== null;
  });
}

/**
 * Logout the current user
 */
export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }
  
  // Wait for logout to complete
  await page.waitForSelector('text=Login', { timeout: 5000 });
}

/**
 * Mock expired session in localStorage
 */
export async function mockExpiredSession(page: Page) {
  await page.addInitScript(() => {
    const expiredSession = {
      pubkey: 'e7270a4bede9167e2e03eaa4f1bb59fb62c9b2ad4a2639b1bb88b40d0001a2b8',
      npub: 'npub1ufns5j7mngv80w8rn2j0rd2elds6ltd6ev6d5j3ex7dw3wpq6qqsz2uqmfhpm0',
      signerType: 'nsec',
      lastLogin: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      expires: Date.now() - 24 * 60 * 60 * 1000, // expired yesterday
      profile: {}
    };
    localStorage.setItem('nostr-user-session', JSON.stringify(expiredSession));
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