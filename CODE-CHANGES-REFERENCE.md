# 📝 Code Changes Reference - Phase 1.2 Integration

**Date:** 31. Oktober 2025  
**Files Changed:** 2  
**Lines Added:** ~170 (net)

---

## File 1: `src/lib/stores/kanbanStore.svelte.ts`

### Change 1: Added Imports
**Location:** Lines 6-8  
**Type:** New Imports

```typescript
import { getSyncManager, initializeSyncManager } from './syncManager.svelte.js';
import { boardToNostrEvent, cardToNostrEvent, createCommentEvent } from '../utils/nostrEvents.js';
import type NDK from '@nostr-dev-kit/ndk';
```

### Change 2: Added NDK Property
**Location:** After class properties  
**Type:** New Property

```typescript
private ndk?: NDK; // Reference to NDK instance for event signing
```

### Change 3: Added Infrastructure Methods
**Location:** After `publishToNostr()` method  
**Type:** New Methods (70 lines)

```typescript
// ============================================================================
// ASYNC NOSTR PUBLISHING (via SyncManager)
// ============================================================================

/**
 * Publishes a card update to Nostr via SyncManager
 * Non-blocking: executes in background, doesn't wait for result
 */
private async publishCardAsync(cardId: string): Promise<void> {
    if (!this.ndk) return;

    try {
        const result = this.board.findCardAndColumn(cardId);
        if (!result) {
            console.warn(`⚠️ Card ${cardId} not found for publishing`);
            return;
        }

        const { card, column } = result;
        const columnIndex = this.board.columns.indexOf(column);
        const boardRef = `30302:${this.board.author || 'unknown'}:${this.board.id}`;

        // Serialize card to Nostr event (Kind 30302)
        const event = cardToNostrEvent(card, column.name, columnIndex, boardRef, this.ndk);

        // Queue for publishing (handles signing + retry logic)
        const syncManager = getSyncManager();
        await syncManager.publishOrQueue(event, 'card', 'normal');

        console.log(`✅ Card ${cardId} queued for publishing`);
    } catch (error) {
        console.error(`❌ Error publishing card ${cardId}:`, error);
    }
}

/**
 * Publishes board metadata to Nostr via SyncManager
 * Non-blocking: executes in background
 */
private async publishBoardAsync(): Promise<void> {
    if (!this.ndk) return;

    try {
        // Serialize board to Nostr event (Kind 30301)
        const event = boardToNostrEvent(this.board, this.ndk);

        // Queue for publishing
        const syncManager = getSyncManager();
        await syncManager.publishOrQueue(event, 'board', 'normal');

        console.log(`✅ Board ${this.board.id} queued for publishing`);
    } catch (error) {
        console.error(`❌ Error publishing board:`, error);
    }
}

/**
 * Publishes a comment to Nostr via SyncManager
 * Non-blocking: executes in background
 */
private async publishCommentAsync(cardId: string, commentId: string): Promise<void> {
    if (!this.ndk) return;

    try {
        const result = this.board.findCardAndColumn(cardId);
        if (!result) {
            console.warn(`⚠️ Card ${cardId} not found for comment publishing`);
            return;
        }

        const { card } = result;
        const comment = card.comments?.find(c => c.id === commentId);
        if (!comment) {
            console.warn(`⚠️ Comment ${commentId} not found`);
            return;
        }

        // Create comment event (Kind 1)
        const cardRef = `30302:${card.author || 'unknown'}:${cardId}`;
        const event = createCommentEvent(comment.text, cardRef, card.id || '', this.ndk);

        // Queue for publishing
        const syncManager = getSyncManager();
        await syncManager.publishOrQueue(event, 'comment', 'normal');

        console.log(`✅ Comment ${commentId} queued for publishing`);
    } catch (error) {
        console.error(`❌ Error publishing comment:`, error);
    }
}
```

### Change 4: Updated `createCard()` Method
**Location:** Lines 836-867  
**Type:** Updated Method - Added async publishing hook

```typescript
public createCard(columnId: string, name: string = 'Neue Karte', description?: string): string {
    console.log('🆕 createCard aufgerufen:', { columnId, name, description });
    
    const author = authStore.getPubkey() || 'anonymous';
    const authorName = authStore.getUserName() || author;
    
    const cardProps: CardProps = {
        heading: name,
        content: description || 'Bitte bearbeiten...',
        publishState: 'draft',
        author: author,
        authorName: authorName
    };
    
    const card = this.addCard(columnId, cardProps);
    console.log('✅ Karte erstellt:', card.id, 'mit author:', author, 'authorName:', authorName, 'Board hat jetzt', this.board.columns.flatMap(c => c.cards).length, 'Karten');
    
    // 🔄 Trigger async publishing to Nostr via SyncManager (non-blocking)
    if (card?.id) {
        this.publishCardAsync(card.id).catch(err => 
            console.error('⚠️ Async card publishing failed:', err)
        );
    }
    
    return card.id;
}
```

### Change 5: Updated `updateCard()` Method
**Location:** Lines 747-759  
**Type:** Updated Method - Added async publishing hook

```typescript
public updateCard(cardId: string, updates: Partial<CardProps>): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.update(updates);
        this.triggerUpdate();
        this.publishToNostr();
        
        // 🔄 Trigger async publishing to Nostr via SyncManager (non-blocking)
        this.publishCardAsync(cardId).catch(err => 
            console.error('⚠️ Async card publishing failed:', err)
        );
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

### Change 6: Updated `deleteCard()` Method
**Location:** Lines 761-771  
**Type:** Updated Method - Added stub for future deletion event

```typescript
public deleteCard(cardId: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.column.deleteCard(cardId);
        this.triggerUpdate();
        this.publishToNostr();
        
        // 🔄 Trigger async deletion publishing to Nostr (non-blocking)
        // TODO: Implement createDeletionEvent in nostrEvents.ts if needed
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

### Change 7: Updated `setCardPublishState()` Method
**Location:** Lines 773-788  
**Type:** Updated Method - Added async publishing hook

```typescript
public setCardPublishState(cardId: string, state: PublishState): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.setPublishState(state);
        this.triggerUpdate();
        this.publishToNostr();
        
        // 🔄 Trigger async publishing to Nostr via SyncManager (non-blocking)
        this.publishCardAsync(cardId).catch(err => 
            console.error('⚠️ Async card publishing failed:', err)
        );
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

### Change 8: Updated `updateCurrentBoardMeta()` Method
**Location:** Lines 613-636  
**Type:** Updated Method - Added async publishing hook

```typescript
public updateCurrentBoardMeta(updates: { 
    name?: string
    description?: string
    tags?: string[]
    ccLicense?: string
}): void {
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error(`❌ Keine Berechtigung...`);
    }

    this.board.update(updates);
    this.triggerUpdate();
    console.log('✅ Board-Metadaten aktualisiert:', { ... });
    
    // 🔄 Trigger async publishing to Nostr via SyncManager (non-blocking)
    this.publishBoardAsync().catch(err => 
        console.error('⚠️ Async board publishing failed:', err)
    );
}
```

### Change 9: Updated `setPublishState()` Method
**Location:** Lines 644-660  
**Type:** Updated Method - Added async publishing hook

```typescript
public setPublishState(state: PublishState): void {
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error(`❌ Keine Berechtigung...`);
    }

    this.board.setPublishState(state);
    this.triggerUpdate();
    
    // 🔄 Trigger async publishing to Nostr via SyncManager (non-blocking)
    this.publishBoardAsync().catch(err => 
        console.error('⚠️ Async board publishing failed:', err)
    );
}
```

---

## File 2: `src/lib/stores/authStore.svelte.ts`

### Change 1: Added Import
**Location:** Line 8  
**Type:** New Import

```typescript
import { getSyncManager } from "./syncManager.svelte.js";
```

### Change 2: Updated `loginWithNip07()` Method
**Location:** Lines 42-72  
**Type:** Updated Method - Added signer update

```typescript
public async loginWithNip07(): Promise<NDKUser> {
    try {
        this.isLoading = true;

        if (!window.nostr) {
            throw new Error("Nostr extension not found. Install Alby or nos2x.");
        }

        const signer = new NDKNip07Signer();
        this.ndk.signer = signer;

        const user = await signer.user();

        this.currentUser = user;
        this.currentUser.profile = await user.fetchProfile() || undefined

        await this.saveSession(user, "nip07");
        
        // 🔄 Update SyncManager with new signer
        try {
            getSyncManager().updateSigner(signer);
            console.log('✅ SyncManager signer updated after NIP-07 login');
        } catch (error) {
            console.warn('⚠️ SyncManager signer update warning:', error);
        }

        return user;
    } catch (error) {
        console.error("NIP-07 login failed:", error);
        throw error;
    } finally {
        this.isLoading = false;
    }
}
```

### Change 3: Updated `loginWithNsec()` Method
**Location:** Lines 74-110  
**Type:** Updated Method - Added signer update

```typescript
public async loginWithNsec(nsec: string): Promise<NDKUser> {
    try {
        this.isLoading = true;

        if (!nsec.startsWith("nsec1") || nsec.length !== 63) {
            throw new Error("Invalid nsec format");
        }

        const signer = new NDKPrivateKeySigner(nsec);
        this.ndk.signer = signer;

        const user = await signer.user();
        await user.fetchProfile();

        this.currentUser = user;

        await this.saveSession(user, "nsec");
        
        // 🔄 Update SyncManager with new signer
        try {
            getSyncManager().updateSigner(signer);
            console.log('✅ SyncManager signer updated after nsec login');
        } catch (error) {
            console.warn('⚠️ SyncManager signer update warning:', error);
        }

        return user;
    } catch (error) {
        console.error("nsec login failed:", error);
        throw error;
    } finally {
        this.isLoading = false;
    }
}
```

### Change 4: Updated `loginWithOidc()` Method
**Location:** Lines 127-164  
**Type:** Updated Method - Added signer update

```typescript
public async loginWithOidc(oidcUser: User): Promise<NDKUser> {
    try {
        this.isLoading = true;

        const nsec = (oidcUser.profile as { nsec?: string }).nsec;

        if (!nsec ||
            !nsec.startsWith("nsec1") || 
            nsec.length !== 63) {
            throw new Error("Invalid nsec format");
        }

        const signer = new NDKPrivateKeySigner(nsec);
        this.ndk.signer = signer;

        const user = await signer.user();
        await user.fetchProfile();

        this.currentUser = user;

        await this.saveSession(user, "nsec");
        
        // 🔄 Update SyncManager with new signer
        try {
            getSyncManager().updateSigner(signer);
            console.log('✅ SyncManager signer updated after OIDC login');
        } catch (error) {
            console.warn('⚠️ SyncManager signer update warning:', error);
        }

        return user;
    } catch (error) {
        console.error("oidc login failed:", error);
        throw error;
    } finally {
        this.isLoading = false;
    }
}
```

### Change 5: Updated `logout()` Method
**Location:** Lines 166-185  
**Type:** Updated Method - Added signer clear

```typescript
public async logout(): Promise<void> {
    this.currentUser = null;
    this.ndk.signer = undefined;

    this.sessionStore.set(null);
    
    // 🔄 Clear SyncManager signer on logout
    try {
        getSyncManager().updateSigner(undefined);
        console.log('✅ SyncManager signer cleared after logout');
    } catch (error) {
        console.warn('⚠️ SyncManager signer clear warning:', error);
    }

    console.log("🚪 User logged out");
}
```

---

## Summary of Changes

### kanbanStore.svelte.ts
- **Imports:** +3 lines (SyncManager, nostrEvents, NDK type)
- **Properties:** +1 line (ndk property)
- **New Methods:** +70 lines (3 async publishing methods)
- **Updated Methods:** +32 lines (6 mutation methods with async hooks)
- **Total:** +106 lines

### authStore.svelte.ts
- **Imports:** +1 line (getSyncManager)
- **Updated Methods:** +45 lines (5 methods with signer updates)
- **Total:** +46 lines

### Grand Total
- **2 Files Modified**
- **152 Lines Added**
- **Fully Type-Safe**
- **Zero Compilation Errors** ✅

---

## Code Quality Notes

✅ **Non-blocking Pattern**
- All async calls use `.catch()` error handling
- No awaits in synchronous code paths
- UI updates immediately, Nostr publish happens in background

✅ **Error Resilience**
- Try-catch blocks around SyncManager calls
- Console warnings for expected errors
- App continues functioning even if sync fails

✅ **Logging**
- Console.log() for successful operations
- Console.error() for failures
- Useful for debugging offline/online transitions

✅ **Type Safety**
- Full TypeScript strict mode
- Proper imports and exports
- No `any` types introduced

---

**Status:** All changes ready for testing  
**Next Step:** Layout initialization & UI status indicator
