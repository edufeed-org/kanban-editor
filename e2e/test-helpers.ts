import { type Page, type BrowserContext, expect } from '@playwright/test';

export const TEST_NSEC = 'nsec1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85';
export const TEST_PUBKEY = '79dff8f82963424e0bb02708a22e44b4980893e3a4be0fa3cb60a43b946764e3';
export const TEST_NPUB = 'npub1ufns5j7mngv80w8rn2j0rd2elds6pwd6ev6d5j3ex7dw3wpq6qqsz2uqmfhpm0';

export interface TestUser {
    name: string;
    pubkey: string;
    nsec?: string;
}

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
  // Warte auf den Anmelden-Button via data-testid
  const loginButton = page.getByTestId('login-button');
  await expect(loginButton).toBeVisible({ timeout: 10000 });
  
  // Echte Maus-Klick-Aktion: Bounding Box holen und auf Mitte klicken
  const box = await loginButton.boundingBox();
  if (!box) throw new Error('Login button has no bounding box');
  
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  
  // Warte auf den Dialog
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  
  // Jetzt ist Dialog offen, klicke auf den nsec Tab
  const nsecTab = page.getByRole('tab', { name: 'nsec' });
  await expect(nsecTab).toBeVisible({ timeout: 5000 });
  await nsecTab.click();
  
  // Fülle nsec ein
  await page.getByPlaceholder('nsec1...').fill(nsec);
  await page.getByRole('button', { name: 'Mit nsec anmelden' }).click();

  await expect(page.getByTestId('auth-user-avatar')).toBeVisible({ timeout: 10000 });
}

/**
 * Login with NIP-07 (requires mocked extension)
 * need to be at /cardsboard first!
 */
export async function loginWithNip07(page: Page) {
    await mockNip07Extension(page);

    await page.getByRole('button', { name: 'Anmelden' }).click();
    
    const nip07Button = page.getByText('Mit Nostr-Extension anmelden');
    await expect(nip07Button).toBeVisible();
    await nip07Button.click();

    await expect(page.getByTestId('auth-user-avatar')).toBeVisible({ timeout: 3000 });
}

/**
 * Clear all authentication-related storage and state
 * TODO: Not working because browser is denying access to localStorage/sessionStorage
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
 * Clear all cached board-related state
 * TODO: Not working because browser is denying access to localStorage
 */
export async function clearBoardState(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      try {
        localStorage.removeItem('kanban-config');
        localStorage.removeItem('kanban-settings');
        // Maybe add more keys to
        
        console.log('🧹 Board state cleared');
      } catch (error) {
        console.log('⚠️ Error clearing board storage:', error);
      }
    });
  } catch (error) {
    console.log('⚠️ Error accessing storage in clearBoardState:', error);
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

// Funktion entfernt - siehe erweiterte Version weiter unten in der Datei

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
  getAuthState(page);
  const authState = await getAuthState(page);
  if (authState) {
    return true;
  }
  return false;
}

export async function logout(page: Page) {
  const userDropdown = page.getByTestId('auth-user-avatar');
  await userDropdown.click();
  
  const logoutButton = page.getByText('Abmelden');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }
  
  await expect(page.getByText('Anmelden')).toBeVisible({ timeout: 3000 });
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

// ============================================================================
// SHARING-FUNKTIONALITÄT TEST-HELPERS
// ============================================================================

/**
 * Login mit spezifischem Test-User für Sharing-Tests
 */
export async function loginWithTestUser(page: Page, user: TestUser) {
    await page.goto('/cardsboard');
    
    // Prüfe ob bereits als dieser User angemeldet
    const currentUserElement = page.locator('[data-testid="current-user"]');
    if (await currentUserElement.isVisible()) {
        const currentUser = await currentUserElement.textContent();
        if (currentUser?.includes(user.name)) {
            console.log(`Bereits als ${user.name} angemeldet`);
            return;
        }
        
        // Logout vom aktuellen User
        await logout(page);
    }
    
    // Development-Login (wenn verfügbar)
    await page.evaluate((userData) => {
        // @ts-expect-error
        if (window.authStore && window.authStore.loginWithDummy) {
            // @ts-expect-error
            window.authStore.loginWithDummy(userData.name, userData.pubkey);
        }
    }, user);
    
    // Fallback: UI-basierter Login
    try {
        const loginButton = page.locator('button:has-text("Login")').first();
        if (await loginButton.isVisible()) {
            await loginButton.click();
            
            // Dummy/Development-Login verwenden
            const dummyOption = page.locator('text="Demo Login"').or(
                page.locator('text="Development"')
            );
            
            if (await dummyOption.isVisible()) {
                await dummyOption.click();
                await page.fill('input[placeholder*="Name"]', user.name);
                await page.fill('input[placeholder*="pubkey"]', user.pubkey);
                await page.locator('button:has-text("Anmelden")').click();
            } else if (user.nsec) {
                // nsec-Login als Fallback
                await page.locator('text="Private Key"').click();
                await page.fill('input[placeholder*="nsec"]', user.nsec);
                await page.locator('button:has-text("Anmelden")').click();
            }
        }
    } catch {
        console.log('UI-Login fehlgeschlagen, nutze Development-API');
    }
    
    // Verifiziere erfolgreichen Login
    await expect(page.locator(`text="${user.name}"`)).toBeVisible({ timeout: 5000 });
    console.log(`✅ Angemeldet als: ${user.name}`);
}

/**
 * Erstellt ein neues Board mit gegebenem Namen
 */
export async function createTestBoard(page: Page, boardName: string): Promise<string> {
    // Erstelle neues Board
    await page.locator('button:has-text("Neues Board")').click();
    await expect(page.locator('text="Neues Board"')).toBeVisible({ timeout: 5000 });
    
    // Benenne Board um
    const titleElement = page.locator('h1').first();
    await titleElement.dblclick();
    
    const titleInput = page.locator('input').first();
    await titleInput.fill(boardName);
    await page.keyboard.press('Enter');
    
    // Warte bis Board gespeichert
    await expect(page.locator(`text="${boardName}"`)).toBeVisible({ timeout: 3000 });
    console.log(`✅ Board erstellt: ${boardName}`);
    
    return boardName;
}

/**
 * Teilt Board mit einem anderen User (via Store-API)
 */
export async function shareTestBoard(
    page: Page, 
    targetUserPubkey: string, 
    role: 'editor' | 'viewer'
): Promise<void> {
    console.log(`🔗 Teile Board mit ${targetUserPubkey} als ${role}`);
    
    // Verwende Store-API für programmatisches Teilen
    const success = await page.evaluate(async (args) => {
        const { pubkey, role } = args;
        
        try {
            // @ts-expect-error
            if (window.boardStore) {
                if (role === 'editor') {
                    // @ts-expect-error
                    await window.boardStore.addEditor(pubkey);
                } else {
                    // @ts-expect-error
                    await window.boardStore.addViewer(pubkey);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Share error:', error);
            return false;
        }
    }, { pubkey: targetUserPubkey, role });
    
    if (!success) {
        throw new Error(`Sharing fehlgeschlagen für ${targetUserPubkey}`);
    }
    
    console.log(`✅ Board erfolgreich geteilt mit ${targetUserPubkey} als ${role}`);
}

/**
 * Lädt ein spezifisches Board (aus der Board-Liste)
 */
export async function loadTestBoard(page: Page, boardName: string): Promise<void> {
    // Finde Board in der Liste
    const boardItem = page.locator(`text="${boardName}"`).first();
    await expect(boardItem).toBeVisible({ timeout: 10000 });
    
    // Klicke auf Board um es zu laden
    await boardItem.click();
    
    // Warte bis Board geladen
    await expect(page.locator(`h1:has-text("${boardName}")`)).toBeVisible({ timeout: 5000 });
    console.log(`✅ Board geladen: ${boardName}`);
}

/**
 * Prüft ob ein User bestimmte UI-Elemente sehen kann
 */
export async function checkUIPermissions(page: Page, expectedPermissions: {
    canCreateCard?: boolean;
    canCreateColumn?: boolean;
    canDeleteBoard?: boolean;
    canEditBoard?: boolean;
}): Promise<{ success: boolean; details: string[] }> {
    const results: string[] = [];
    let success = true;
    
    // Check: Neue Karte Button
    if (expectedPermissions.canCreateCard !== undefined) {
        const createCardButton = page.locator('button:has-text("Neue Karte")').or(
            page.locator('button[title*="Karte"]')
        ).first();
        
        const isVisible = await createCardButton.isVisible();
        if (isVisible !== expectedPermissions.canCreateCard) {
            success = false;
            results.push(`createCard: Expected ${expectedPermissions.canCreateCard}, got ${isVisible}`);
        } else {
            results.push(`createCard: ✅ ${isVisible}`);
        }
    }
    
    // Check: Neue Spalte Button
    if (expectedPermissions.canCreateColumn !== undefined) {
        const createColumnButton = page.locator('button:has-text("Neue Spalte")').or(
            page.locator('button[title*="Spalte"]')
        ).first();
        
        const isVisible = await createColumnButton.isVisible();
        if (isVisible !== expectedPermissions.canCreateColumn) {
            success = false;
            results.push(`createColumn: Expected ${expectedPermissions.canCreateColumn}, got ${isVisible}`);
        } else {
            results.push(`createColumn: ✅ ${isVisible}`);
        }
    }
    
    // Check: Board löschen
    if (expectedPermissions.canDeleteBoard !== undefined) {
        const deleteButton = page.locator('button:has-text("Board löschen")').or(
            page.locator('button[title*="löschen"]')
        ).first();
        
        const isVisible = await deleteButton.isVisible();
        if (isVisible !== expectedPermissions.canDeleteBoard) {
            success = false;
            results.push(`deleteBoard: Expected ${expectedPermissions.canDeleteBoard}, got ${isVisible}`);
        } else {
            results.push(`deleteBoard: ✅ ${isVisible}`);
        }
    }
    
    return { success, details: results };
}

/**
 * Attempt-Helper: Versucht eine Aktion und returned ob sie erfolgreich war
 */
export async function attemptBoardAction(
    page: Page, 
    action: 'createCard' | 'createColumn' | 'deleteBoard' | 'editCard',
    options?: any
): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
        switch (action) {
            case 'createCard': {
                const addButton = page.locator('button:has-text("Neue Karte")').first();
                if (!(await addButton.isVisible())) {
                    return { success: false, error: 'Add Card button not visible' };
                }
                
                await addButton.click();
                await page.fill('input[placeholder*="Titel"]', options?.title || 'Test Karte');
                await page.locator('button:has-text("Speichern")').click();
                
                await expect(page.locator(`text="${options?.title || 'Test Karte'}"`)).toBeVisible({ timeout: 3000 });
                return { success: true, data: { title: options?.title || 'Test Karte' } };
            }
            case 'createColumn': {
                const columnButton = page.locator('button:has-text("Neue Spalte")').first();
                if (!(await columnButton.isVisible())) {
                    return { success: false, error: 'Add Column button not visible' };
                }
                
                await columnButton.click();
                await page.fill('input[placeholder*="Name"]', options?.name || 'Test Spalte');
                await page.locator('button:has-text("Erstellen")').click();
                
                await expect(page.locator(`text="${options?.name || 'Test Spalte'}"`)).toBeVisible({ timeout: 3000 });
                return { success: true, data: { name: options?.name || 'Test Spalte' } };
            }
            case 'deleteBoard': {
                const settingsButton = page.locator('button:has-text("Einstellungen")').first();
                if (!(await settingsButton.isVisible())) {
                    return { success: false, error: 'Settings button not visible' };
                }
                
                await settingsButton.click();
                const deleteButton = page.locator('button:has-text("Board löschen")');
                if (!(await deleteButton.isVisible())) {
                    return { success: false, error: 'Delete button not visible' };
                }
                
                await deleteButton.click();
                await page.locator('button:has-text("Löschen bestätigen")').click();
                
                // Prüfe ob zur Board-Liste umgeleitet
                await expect(page.locator('text="Boards"')).toBeVisible({ timeout: 5000 });
                return { success: true };
            }
            case 'editCard': {
                const card = page.locator('[data-testid="card"]').or(
                    page.locator('text="Test Karte"')
                ).first();
                
                if (!(await card.isVisible())) {
                    return { success: false, error: 'No card found to edit' };
                }
                
                await card.click();
                const titleInput = page.locator('input[value*="Test"]').first();
                await titleInput.fill(options?.newTitle || 'Edited Card');
                await page.locator('button:has-text("Speichern")').click();
                
                await expect(page.locator(`text="${options?.newTitle || 'Edited Card'}"`)).toBeVisible({ timeout: 3000 });
                return { success: true, data: { newTitle: options?.newTitle || 'Edited Card' } };
            }
            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

/**
 * Multi-User Test Setup: Erstellt mehrere Browser-Contexts für parallele Tests
 */
export async function setupMultiUserTest(browser: any, users: TestUser[]): Promise<{
    contexts: BrowserContext[];
    pages: Page[];
    cleanup: () => Promise<void>;
}> {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    
    // Erstelle für jeden User einen eigenen Context
    for (const user of users) {
        const context = await browser.newContext({
            // Separate Session für jeden User
            storageState: undefined
        });
        
        const page = await context.newPage();
        
        // Login as User
        await loginWithTestUser(page, user);
        
        contexts.push(context);
        pages.push(page);
    }
    
    const cleanup = async () => {
        for (const page of pages) {
            await page.close();
        }
        for (const context of contexts) {
            await context.close();
        }
    };
    
    return { contexts, pages, cleanup };
}

/**
 * Wartet bis alle geöffneten Browser-Contexts bereit sind
 */
export async function waitForAllPagesReady(pages: Page[]): Promise<void> {
    await Promise.all(
        pages.map(page => 
            page.waitForLoadState('networkidle').catch(() => 
                console.log('Network idle timeout für eine Page')
            )
        )
    );
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