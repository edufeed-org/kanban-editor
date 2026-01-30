/**
 * Card Editing Flow mit Conflict Detection
 * 
 * KRITISCH: Nutzt BoardStore & SyncManager (nicht direkt NDK)
 * 
 * Integriert in CardDialog.svelte oder CardEditModal.svelte
 * 
 * Workflow:
 * 1. User öffnet Karte → createEditingSession() merkt sich base version
 * 2. User bearbeitet
 * 3. User klickt "Speichern" → checkForConflict() prüft ob neuer Event auf Relay
 * 4. Falls Konflikt → Merge Dialog anzeigen
 * 5. User resolved Konflikt → speichern via BoardStore.editCard()
 */

import type NDK from '@nostr-dev-kit/ndk';
import {
  detectConflict,
  threeWayMerge,
  applyMergeResolution,
  type EditingSession,
  type MergeResolution,
  type CardContent
} from '$lib/utils/mergeEngine.js';
import { generateDTag } from '$lib/utils/idGenerator.js';

export class CardEditingFlow {
  private currentSession: EditingSession | null = null;
  private ndk: NDK;
  private boardStore: any; // Type: BoardStore (aus kanbanStore.svelte.ts)

  constructor(ndk: NDK, boardStore?: any) {
    this.ndk = ndk;
    this.boardStore = boardStore;
  }

  /**
   * Schritt 1: User öffnet Karte zum Bearbeiten
   * → Speichere die aktuelle Version als "base"
   */
  async startEditing(card: CardContent): Promise<EditingSession> {
    this.currentSession = {
      cardId: card.id,
      baseVersion: { ...card }, // Deep copy
      baseEventId: card.id,
      baseTimestamp: Math.floor(new Date(card.updatedAt).getTime() / 1000),
      editStartTime: Date.now(),
      clientId: generateDTag() // Eindeutige Client-ID
    };

    console.log('📝 Editing session started:', this.currentSession.cardId);
    return this.currentSession;
  }

  /**
   * Schritt 2: User speichert Änderungen
   * → Prüfe ob zwischenzeitlich andere Änderungen auf Relay publiziert wurden
   */
  async checkForConflictBeforeSave(
    myDraft: CardContent
  ): Promise<{
    hasConflict: boolean;
    latestVersion: CardContent | null;
  }> {
    if (!this.currentSession) {
      throw new Error('No editing session active');
    }

    // Hole die aktuellste Version vom Relay
    const latestEvent = await this.ndk.fetchEvent({
      kinds: [30302 as any],
      '#d': [this.currentSession.cardId],
      limit: 1
    } as any);

    if (!latestEvent) {
      return { hasConflict: false, latestVersion: null };
    }

    const latestVersion = JSON.parse(latestEvent.content) as CardContent;

    // Konflikt-Check
    const { conflict } = await detectConflict(this.currentSession, latestEvent);

    if (conflict) {
      console.warn('⚠️  Conflict detected!', {
        baseTime: this.currentSession.baseTimestamp,
        latestTime: latestEvent.created_at,
        myChanges: myDraft
      });
    }

    return { hasConflict: conflict, latestVersion };
  }

  /**
   * Schritt 3: Falls Konflikt → Versuche automatisches Merge
   */
  async tryAutoMerge(myDraft: CardContent, theirVersion: CardContent) {
    if (!this.currentSession) {
      throw new Error('No editing session active');
    }

    const result = threeWayMerge(
      this.currentSession.baseVersion,
      myDraft,
      theirVersion
    );

    console.log('Merge attempt:', {
      status: result.status,
      conflictCount: result.conflicts.length,
      conflictPercentage: result.conflictPercentage
    });

    return result;
  }

  /**
   * Schritt 4: Falls Konflikt NICHT auto-lösbar → User manuell abfragen
   * Diese Methode wird vom MergeConflictDialog aufgerufen
   */
  async applyUserResolution(
    myDraft: CardContent,
    theirVersion: CardContent,
    userResolution: MergeResolution
  ): Promise<CardContent> {
    if (!this.currentSession) {
      throw new Error('No editing session active');
    }

    const finalVersion = applyMergeResolution(
      this.currentSession.baseVersion,
      myDraft,
      theirVersion,
      [], // würde vom Merge-Dialog gefüllt
      {
        resolution: userResolution,
        customValues: {}
      }
    );

    console.log('✅ Conflict resolved by user:', userResolution);
    return finalVersion;
  }

  /**
   * Schritt 5: Speichern (mit oder ohne Konflikt)
   * CRITICAL: Nutzt BoardStore.editCard() - NICHT direkt NDK!
   */
  async saveCard(finalVersion: CardContent): Promise<void> {
    if (!this.boardStore) {
      throw new Error(
        'BoardStore not available. Pass it to constructor or via setSyncManager()'
      );
    }

    // Rufe BoardStore auf (nicht direkt NDK)
    // BoardStore kümmert sich um:
    // - triggerUpdate() für localStorage
    // - SyncManager für Nostr Publishing
    // - uiData $derived Neuberechnung
    await this.boardStore.editCard(finalVersion.id, {
      heading: finalVersion.heading,
      content: finalVersion.content,
      labels: finalVersion.labels,
      updatedAt: new Date().toISOString()
    });

    console.log('💾 Card saved via BoardStore:', finalVersion.id);

    // Cleanup
    this.currentSession = null;
  }

  /**
   * Abbrechen: Beende Session ohne zu speichern
   */
  cancelEditing(): void {
    console.log('❌ Editing cancelled');
    this.currentSession = null;
  }

  /**
   * CRITICAL: Setter für BoardStore Injection (vermeidet zirkuläre Imports)
   */
  setSyncManager(boardStore: any): void {
    this.boardStore = boardStore;
  }

  /**
   * Get current session (für UI Debugging)
   */
  getCurrentSession(): EditingSession | null {
    return this.currentSession;
  }
}

/**
 * Praktischer UI-Flow (in CardDialog.svelte)
 */
export const cardEditingFlowExample = `
<script lang="ts">
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  import { ndk } from '$lib/stores/ndk';
  import MergeConflictDialog from './MergeConflictDialog.svelte';
  import { CardEditingFlow } from '$lib/utils/cardEditingFlow';
  
  let card = $props();
  let showDialog = $state(false);
  let showMergeDialog = $state(false);
  let editingFlow: CardEditingFlow;
  
  let draftChanges = $state({ ...card }); // User edits here
  
  async function handleSave() {
    editingFlow = new CardEditingFlow(ndk);
    
    // 1. Start session
    const session = await editingFlow.startEditing(card);
    
    // 2. Check conflicts
    const { hasConflict, latestVersion } = 
      await editingFlow.checkForConflictBeforeSave(draftChanges);
    
    if (!hasConflict) {
      // No conflict: save directly
      await boardStore.editCard(card.id, draftChanges);
      showDialog = false;
      return;
    }
    
    // 3. Attempt auto-merge
    const mergeResult = await editingFlow.tryAutoMerge(
      draftChanges,
      latestVersion
    );
    
    if (mergeResult.status === 'AUTO_MERGED') {
      // Auto-merge successful: save merged version
      await boardStore.editCard(card.id, mergeResult.merged);
      showDialog = false;
      return;
    }
    
    // 4. Manual merge required: show dialog
    showMergeDialog = true;
  }
  
  async function handleMergeResolution(event) {
    const userResolution = event.detail;
    const finalVersion = await editingFlow.applyUserResolution(
      draftChanges,
      latestVersion,
      userResolution
    );
    
    // 5. Save resolved version
    await boardStore.editCard(card.id, finalVersion);
    await editingFlow.saveCard(finalVersion);
    
    showMergeDialog = false;
    showDialog = false;
  }
</script>

<!-- Card Edit Dialog -->
<Dialog open={showDialog}>
  <!-- Edit form here -->
  <input bind:value={draftChanges.heading} />
  <textarea bind:value={draftChanges.content}></textarea>
  <button onclick={handleSave}>Speichern</button>
</Dialog>

<!-- Merge Conflict Dialog -->
<MergeConflictDialog 
  open={showMergeDialog}
  onResolve={handleMergeResolution}
/>
`;
