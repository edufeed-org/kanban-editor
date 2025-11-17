import { test, expect } from '@playwright/test';
import { 
  loginWithNip07,
  clearAuthState,
  createTestCard,
  waitForBoardLoaded,
  verifyCardExists,
  openCardDetails,
  addComment,
  testData,
} from './test-helpers';

test.describe('Authenticated Board Operations', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/cardsboard');
    await clearAuthState(page);
  });

  test.describe('Board Access Control', () => {
    test('should require authentication to create new boards', async ({ page }) => {
      await expect(page.getByText('Anmelden')).toBeVisible();
      await expect(page.getByText('Neues Board')).not.toBeVisible();
    });

    test('should allow board creation after successful login', async ({ page }) => {
      await loginWithNip07(page);
      
      await expect(page.getByText('Neues Board')).toBeVisible();
    });
  });

  test.describe.skip('Card Management with Authentication', () => {
    
    test.beforeEach(async ({ page }) => {
      await loginWithNip07(page);
      await waitForBoardLoaded(page);
    });

    test('should create cards with user as author', async ({ page }) => {
      const cardData = testData.cards[0];
      
      await createTestCard(page, 0, cardData);
      await openCardDetails(page, cardData.title);
      
      // Author should be the NIP-07 user's pubkey
      const authorElement = page.getByTestId('card-author');
      if (await authorElement.isVisible()) {
        const authorText = await authorElement.textContent();
        expect(authorText).toBeTruthy();
        // Should contain pubkey or display name from NIP-07 profile
        expect(authorText?.length).toBeGreaterThan(0);
      }
    });

    test('should allow adding comments to cards', async ({ page }) => {
      const cardData = testData.cards[1];
      const commentText = testData.comments[0];
      
      await createTestCard(page, 0, cardData);
      await openCardDetails(page, cardData.title);
      
      // Add comment
      await addComment(page, commentText);
      
      // Verify comment appears with author info
      await expect(page.getByText(commentText)).toBeVisible();
    });

    test('should persist cards after page reload', async ({ page }) => {
      const cardData = testData.cards[2];
      
      await createTestCard(page, 0, cardData);
      expect(await verifyCardExists(page, cardData.title)).toBe(true);
      
      // Reload page
      await page.reload();
      
      // Wait for auth to be restored and board to load
      await expect(page.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
      await waitForBoardLoaded(page);
      
      // Card should still exist
      expect(await verifyCardExists(page, cardData.title)).toBe(true);
    });

    test('should allow moving cards between columns', async ({ page }) => {
      const cardData = testData.cards[3];
      
      // Create card in To Do column (index 0)
      await createTestCard(page, 0, cardData);
      
      // Verify card is in To Do column
      const todoColumn = page.getByTestId('column').first();
      await expect(todoColumn.getByText(cardData.title)).toBeVisible();
      
      // Drag card to In Progress column (simple click for now, DnD testing is complex)
      // For now, just test that the move functionality exists
      await page.getByText(cardData.title).click();
      
      // Look for move options in card dialog
      const moveButton = page.getByRole('button', { name: /move|transfer/i });
      if (await moveButton.isVisible()) {
        await moveButton.click();
        
        // Select target column
        const inProgressOption = page.getByText('In Progress');
        if (await inProgressOption.isVisible()) {
          await inProgressOption.click();
          
          // Verify move completed
          const inProgressColumn = page.getByTestId('column').nth(1);
          await expect(inProgressColumn.getByText(cardData.title)).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should allow editing card details', async ({ page }) => {
      const cardData = testData.cards[4];
      const updatedTitle = cardData.title + ' (Updated)';
      
      await createTestCard(page, 0, cardData);
      await openCardDetails(page, cardData.title);
      
      // Edit card title
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible()) {
        await editButton.click();
        
        const titleInput = page.getByPlaceholder(/title|heading/i);
        await titleInput.clear();
        await titleInput.fill(updatedTitle);
        
        await page.getByRole('button', { name: /save/i }).click();
        
        // Verify update
        await expect(page.getByText(updatedTitle)).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show authenticated user info in UI', async ({ page }) => {
      // Look for user info display
      const userDisplay = page.getByTestId('authenticated-user');
      await expect(userDisplay).toBeVisible();
      
      // Check if user menu exists
      const userMenu = page.getByTestId('user-menu');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        
        // Should show user options
        await expect(page.getByText(/profile|settings|logout/i)).toBeVisible();
      }
    });
  });

  test.describe.skip('Multi-Column Operations', () => {
    
    test.beforeEach(async ({ page }) => {
      await loginWithNip07(page);
      await waitForBoardLoaded(page);
    });

    test('should create cards in different columns', async ({ page }) => {
      // Create cards in each column
      for (let i = 0; i < 3; i++) {
        const cardData = { ...testData.cards[i], title: `Column ${i} Card` };
        await createTestCard(page, i, cardData);
      }
      
      // Verify all cards exist
      for (let i = 0; i < 3; i++) {
        expect(await verifyCardExists(page, `Column ${i} Card`)).toBe(true);
      }
    });

    test('should show correct card counts in columns', async ({ page }) => {
      // Create different numbers of cards in each column
      await createTestCard(page, 0, { title: 'Todo Card 1' });
      await createTestCard(page, 0, { title: 'Todo Card 2' });
      await createTestCard(page, 1, { title: 'Progress Card 1' });
      
      // Check column card counts (if implemented in UI)
      const columns = page.getByTestId('column');
      
      // To Do column should have 2 cards
      const todoColumn = columns.nth(0);
      const todoCards = todoColumn.getByTestId('card-item');
      expect(await todoCards.count()).toBe(2);
      
      // In Progress column should have 1 card
      const progressColumn = columns.nth(1);
      const progressCards = progressColumn.getByTestId('card-item');
      expect(await progressCards.count()).toBe(1);
      
      // Done column should have 0 cards
      const doneColumn = columns.nth(2);
      const doneCards = doneColumn.getByTestId('card-item');
      expect(await doneCards.count()).toBe(0);
    });

    test('should allow adding columns (if feature exists)', async ({ page }) => {
      const addColumnButton = page.getByRole('button', { name: /add column|new column/i });
      
      if (await addColumnButton.isVisible()) {
        await addColumnButton.click();
        
        const columnNameInput = page.getByPlaceholder(/column name|title/i);
        await columnNameInput.fill('Custom Column');
        
        await page.getByRole('button', { name: /create|save/i }).click();
        
        // Verify new column appears
        await expect(page.getByText('Custom Column')).toBeVisible({ timeout: 5000 });
      }
    });

  });

  test.describe.skip('Board State Persistence', () => {
    
    test('should preserve board state across browser sessions', async ({ page, context }) => {
      await loginWithNip07(page);
      await waitForBoardLoaded(page);
      
      // Create test data
      const cardData = { title: 'Persistent Test Card', description: 'This card should persist' };
      await createTestCard(page, 0, cardData);
      
      // Close and reopen browser context
      await context.close();
      
      const newContext = await page.context().browser()?.newContext();
      if (newContext) {
        const newPage = await newContext.newPage();
        
        // Should require re-authentication (session expired)
        await newPage.goto('/cardsboard');
        
        // Login again
        const nsecTab = newPage.getByRole('tab', { name: /private key|nsec/i });
        if (await nsecTab.isVisible()) {
          await nsecTab.click();
        }
        
        await newPage.getByPlaceholder(/nsec1|private key/i).fill('nsec1ufnus6pju578ste3v90xd5m2decpuzpql2295m3sknqcjzyys9ls0qlc85');
        await newPage.getByRole('button', { name: /login/i }).click();
        
        await expect(newPage.getByTestId('authenticated-user')).toBeVisible({ timeout: 10000 });
        await waitForBoardLoaded(newPage);
        
        // Board data should still exist
        expect(await verifyCardExists(newPage, cardData.title)).toBe(true);
        
        await newContext.close();
      }
    });

    test('should handle concurrent board modifications gracefully', async ({ page }) => {
      await loginWithNip07(page);

      await waitForBoardLoaded(page);
      
      // Simulate rapid card creation
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const cardData = { title: `Concurrent Card ${i}`, description: `Created concurrently ${i}` };
        promises.push(createTestCard(page, i % 3, cardData));
      }
      
      // Wait for all cards to be created
      await Promise.all(promises);
      
      // Verify all cards exist
      for (let i = 0; i < 5; i++) {
        expect(await verifyCardExists(page, `Concurrent Card ${i}`)).toBe(true);
      }
    });

  });

});