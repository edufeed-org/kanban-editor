// e2e/permission-checks.spec.ts
// Detaillierte E2E Tests für Permission-System

import { test, expect, type Page } from '@playwright/test';

// Test Helpers
async function setupTestBoard(page: Page, boardName: string) {
    await page.goto('/cardsboard');
    
    // Login als Test-User
    await page.evaluate(() => {
        // @ts-ignore - Development-Modus
        if (window.authStore) {
            // @ts-ignore
            window.authStore.loginWithDummy('Test Owner', 'owner123');
        }
    });
    
    // Erstelle Test-Board
    await page.locator('button:has-text("Neues Board")').click();
    await expect(page.locator('text="Neues Board"')).toBeVisible();
    
    // Benenne um
    const titleElement = page.locator('h1').first();
    await titleElement.dblclick();
    await page.fill('input', boardName);
    await page.keyboard.press('Enter');
    
    return boardName;
}

async function setUserRole(page: Page, role: 'OWNER' | 'EDITOR' | 'VIEWER' | null) {
    await page.evaluate((userRole) => {
        // Mock getCurrentUserRole für Tests
        // @ts-ignore
        if (window.boardStore) {
            // @ts-ignore
            window.boardStore.getCurrentUserRole = () => userRole;
        }
    }, role);
}

async function testPermissionForAction(
    page: Page, 
    action: string, 
    buttonSelector: string,
    expectedAllowed: boolean
) {
    let actionSucceeded = false;
    let errorMessage = '';
    
    try {
        const button = page.locator(buttonSelector);
        
        if (await button.isVisible()) {
            await button.click();
            
            // Prüfe auf Success-Indikatoren
            if (action === 'create-card') {
                await page.fill('input[placeholder*="Titel"]', 'Test Karte');
                await page.locator('button:has-text("Speichern")').click();
                await expect(page.locator('text="Test Karte"')).toBeVisible({ timeout: 3000 });
                actionSucceeded = true;
            } else if (action === 'delete-board') {
                await page.locator('button:has-text("Löschen bestätigen")').click();
                await expect(page.locator('text="Board gelöscht"')).toBeVisible({ timeout: 3000 });
                actionSucceeded = true;
            }
        } else {
            errorMessage = 'Button nicht sichtbar (Permission denied)';
        }
    } catch (error) {
        errorMessage = String(error);
    }
    
    if (expectedAllowed) {
        expect(actionSucceeded).toBe(true);
    } else {
        expect(actionSucceeded).toBe(false);
        expect(errorMessage.length > 0).toBe(true);
    }
}

test.describe('Permission System - Detailed Tests', () => {
    
    test('OWNER-Rolle: Alle Berechtigungen verfügbar', async ({ page }) => {
        const boardName = await setupTestBoard(page, 'Owner Test Board');
        await setUserRole(page, 'OWNER');
        
        // Owner sollte Karten erstellen können
        await testPermissionForAction(page, 'create-card', 'button:has-text("Neue Karte")', true);
        
        // Owner sollte Spalten erstellen können
        await testPermissionForAction(page, 'create-column', 'button:has-text("Neue Spalte")', true);
        
        // Owner sollte Board löschen können
        await testPermissionForAction(page, 'delete-board', 'button:has-text("Board löschen")', true);
    });

    test('EDITOR-Rolle: Bearbeitungsrechte ohne Löschung', async ({ page }) => {
        const boardName = await setupTestBoard(page, 'Editor Test Board');
        await setUserRole(page, 'EDITOR');
        
        // Editor sollte Karten erstellen können
        await testPermissionForAction(page, 'create-card', 'button:has-text("Neue Karte")', true);
        
        // Editor sollte NICHT Board löschen können
        const deleteButton = page.locator('button:has-text("Board löschen")');
        await expect(deleteButton).not.toBeVisible();
    });

    test('VIEWER-Rolle: Nur Leserechte', async ({ page }) => {
        const boardName = await setupTestBoard(page, 'Viewer Test Board');
        await setUserRole(page, 'VIEWER');
        
        // Viewer sollte KEINE Karten erstellen können
        const createButton = page.locator('button:has-text("Neue Karte")');
        await expect(createButton).not.toBeVisible();
        
        // Viewer sollte KEINE Spalten erstellen können
        const columnButton = page.locator('button:has-text("Neue Spalte")');
        await expect(columnButton).not.toBeVisible();
        
        // Viewer sollte Content sehen können
        await expect(page.locator(`text="${boardName}"`)).toBeVisible();
    });

    test('UNAUTHENTICATED: Keine Berechtigungen außer Demo', async ({ page }) => {
        await page.goto('/cardsboard');
        await setUserRole(page, null);
        
        // Nicht angemeldet sollte Demo-Option haben
        await expect(page.locator('button:has-text("Demo ausprobieren")')).toBeVisible();
        
        // Aber keine Board-Erstellung
        const createButton = page.locator('button:has-text("Neues Board")');
        await expect(createButton).not.toBeVisible();
    });

    test('Permission-Nachrichten sind korrekt formuliert', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Teste verschiedene Permission-Nachrichten
        const messages = await page.evaluate(() => {
            // @ts-ignore
            const { checkPermission } = window.permissionCheck || {};
            if (!checkPermission) return {};
            
            return {
                viewerEdit: checkPermission('canEdit', 'VIEWER', 'eine Karte bearbeiten'),
                editorDelete: checkPermission('canDelete', 'EDITOR', 'das Board löschen'),
                unauthenticatedCreate: checkPermission('canEdit', null, 'ein Board erstellen')
            };
        });
        
        expect(messages.viewerEdit?.message).toContain('Als Betrachter');
        expect(messages.editorDelete?.message).toContain('Board-Besitzer');
        expect(messages.unauthenticatedCreate?.message).toContain('anmelden');
    });

    test('Demo-Board Exception: Alle Rechte für anonyme Benutzer', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Teste Demo-Board Permission-Exception
        const demoPermission = await page.evaluate(() => {
            // @ts-ignore
            const { checkPermission } = window.permissionCheck || {};
            if (!checkPermission) return null;
            
            return checkPermission('canEdit', null, 'eine Karte erstellen', 'demo-board');
        });
        
        expect(demoPermission?.allowed).toBe(true);
        
        // Normale Boards sollten weiterhin Permission-Checks haben
        const normalPermission = await page.evaluate(() => {
            // @ts-ignore
            const { checkPermission } = window.permissionCheck || {};
            if (!checkPermission) return null;
            
            return checkPermission('canEdit', null, 'eine Karte erstellen', 'normal-board');
        });
        
        expect(normalPermission?.allowed).toBe(false);
    });

    test('requirePermission zeigt Toast-Nachricht bei Verweigerung', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Listen for console/alert messages
        let alertMessage = '';
        page.on('dialog', dialog => {
            alertMessage = dialog.message();
            dialog.accept();
        });
        
        // Teste requirePermission mit verweigerten Rechten
        await page.evaluate(() => {
            // @ts-ignore
            const { requirePermission } = window.permissionCheck || {};
            if (requirePermission) {
                requirePermission('canDelete', 'VIEWER', 'das Board löschen');
            }
        });
        
        expect(alertMessage).toContain('Berechtigung verweigert');
    });

    test('Permission Shortcuts funktionieren korrekt', async ({ page }) => {
        await page.goto('/cardsboard');
        
        const permissionResults = await page.evaluate(() => {
            // @ts-ignore
            const { PermissionChecks } = window.permissionCheck || {};
            if (!PermissionChecks) return {};
            
            return {
                ownerCanDelete: PermissionChecks.canDeleteBoard('OWNER'),
                editorCanEdit: PermissionChecks.canEditCard('EDITOR'), 
                viewerCanCreate: PermissionChecks.canCreateCard('VIEWER'),
                demoCanCreate: PermissionChecks.canCreateCard(null, 'demo-board')
            };
        });
        
        expect(permissionResults.ownerCanDelete).toBe(true);
        expect(permissionResults.editorCanEdit).toBe(true);
        expect(permissionResults.viewerCanCreate).toBe(false);
        expect(permissionResults.demoCanCreate).toBe(true);
    });
});

test.describe('Permission System - Edge Cases', () => {
    
    test('Ungültige Rolle wird korrekt behandelt', async ({ page }) => {
        await page.goto('/cardsboard');
        
        const invalidPermission = await page.evaluate(() => {
            // @ts-ignore
            const { checkPermission } = window.permissionCheck || {};
            if (!checkPermission) return null;
            
            // @ts-ignore - Test mit ungültiger Rolle
            return checkPermission('canEdit', 'INVALID_ROLE', 'test action');
        });
        
        expect(invalidPermission?.allowed).toBe(false);
        expect(invalidPermission?.message).toBeDefined();
    });

    test('Fehlende Permission-Checks werfen keine Fehler', async ({ page }) => {
        await page.goto('/cardsboard');
        
        const noError = await page.evaluate(() => {
            try {
                // @ts-ignore
                const { checkPermission } = window.permissionCheck || {};
                if (checkPermission) {
                    // @ts-ignore - Test mit undefined values
                    checkPermission(undefined, undefined, undefined);
                }
                return true;
            } catch (e) {
                return false;
            }
        });
        
        expect(noError).toBe(true);
    });

    test('Permission-System funktioniert ohne AuthStore', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Mocke authStore als nicht verfügbar
        const result = await page.evaluate(() => {
            // @ts-ignore
            delete window.authStore;
            
            // @ts-ignore
            const { checkPermission } = window.permissionCheck || {};
            if (!checkPermission) return null;
            
            return checkPermission('canEdit', null, 'test action');
        });
        
        expect(result?.allowed).toBe(false);
        expect(result?.message).toContain('anmelden');
    });

    test('Performance: Permission-Checks sind schnell genug', async ({ page }) => {
        await page.goto('/cardsboard');
        
        const timing = await page.evaluate(() => {
            const start = performance.now();
            
            // @ts-ignore
            const { PermissionChecks } = window.permissionCheck || {};
            if (!PermissionChecks) return 0;
            
            // Führe 1000 Permission-Checks aus
            for (let i = 0; i < 1000; i++) {
                PermissionChecks.canEditCard('EDITOR');
                PermissionChecks.canDeleteBoard('OWNER');
                PermissionChecks.canCreateCard('VIEWER');
            }
            
            const end = performance.now();
            return end - start;
        });
        
        // Permission-Checks sollten unter 100ms für 1000 Aufrufe dauern
        expect(timing).toBeLessThan(100);
    });
});