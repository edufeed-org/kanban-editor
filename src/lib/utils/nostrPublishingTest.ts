/**
 * 🧪 Nostr Publishing Test Suite
 * 
 * Funktionen zum Testen der Nostr-Publishing-Funktionalität
 * Aufrufbar in der Browser-Console:
 * 
 *   window.testNostrPublishing()     - Vollständiger Test
 *   window.checkNostrConfig()        - Konfiguration überprüfen
 *   window.checkSyncQueue()          - Queue-Status anzeigen
 *   window.simulateCardUpdate()      - Card-Update simulieren & publishen
 */

import { boardStore } from '../stores/kanbanStore.svelte.js';
import { authStore } from '../stores/authStore.svelte.js';
import { settingsStore } from '../stores/settingsStore.svelte.js';
import { getSyncManager } from '../stores/syncManager.svelte.js';
import { getTargetRelays, getRelaySelectionDescription } from './relaySelection.js';
import type { PublishState } from '../stores/settingsStore.svelte.js';

/**
 * ✅ TEST 1: Überprüfe Nostr-Konfiguration
 */
export function checkNostrConfig(): void {
    console.group('🔍 Nostr Configuration Check');
    
    // 1. Relay-Konfiguration
    console.log('📡 Relay URLs (from settingsStore):');
    console.log('   Public Relays:', settingsStore.settings.relaysPublic);
    console.log('   Private Relays:', settingsStore.settings.relaysPrivate);
    console.log('   Draft Publishing Mode:', settingsStore.settings.draftPublishingMode);
    
    // 2. NDK Status
    const ndk = (boardStore as any).ndk;
    if (ndk) {
        console.log('✅ NDK initialized');
        console.log('   Connected Relays:', ndk.pool?.relays?.size || 0);
        console.log('   Relay URLs:', Array.from(ndk.pool?.relays?.keys() || []));
    } else {
        console.error('❌ NDK NOT initialized');
    }
    
    // 3. Auth Status
    const pubkey = authStore.getPubkey();
    const userName = authStore.getUserName();
    if (pubkey) {
        console.log('✅ User authenticated');
        console.log('   Pubkey:', pubkey);
        console.log('   Username:', userName || '(none)');
    } else {
        console.warn('⚠️ User NOT authenticated');
        console.log('   → Login required for event signing');
    }
    
    // 4. Signer Status
    const syncManager = getSyncManager();
    const signer = (syncManager as any).signer;
    if (signer) {
        console.log('✅ Signer configured in SyncManager');
    } else {
        console.warn('⚠️ Signer NOT configured');
        console.log('   → Events will be queued but not published');
    }
    
    console.groupEnd();
}

/**
 * ✅ TEST 2: Überprüfe Event Queue
 */
export function checkSyncQueue(): void {
    console.group('📦 Sync Queue Status');
    
    const syncManager = getSyncManager();
    const status = syncManager.status;
    
    console.log('Online Status:', status.isOnline ? '✅ Online' : '❌ Offline');
    console.log('Syncing:', status.isSyncing ? '🔄 Yes' : '✅ No');
    console.log('Queued Events:', status.queuedEvents);
    
    if (status.queuedEvents > 0) {
        console.log('📋 Queue Details:');
        const queue = JSON.parse(localStorage.getItem('nostr-event-queue') || '[]');
        queue.forEach((event: any, index: number) => {
            console.log(`  ${index + 1}. Type: ${event.type}, Retries: ${event.retries}`);
        });
    }
    
    console.groupEnd();
}

/**
 * ✅ TEST 3: Simuliere Card-Update und Publishing
 */
export function simulateCardUpdate(): void {
    console.group('🧪 Simulate Card Update & Publishing');
    
    // 1. Check Prerequisites
    const pubkey = authStore.getPubkey();
    if (!pubkey) {
        console.error('❌ TEST FAILED: User not authenticated');
        console.log('   → Please login first with:');
        console.log('      authStore.loginWithNip07()      // Browser extension');
        console.log('      authStore.loginWithNsec("...")   // Private key (dev)');
        console.groupEnd();
        return;
    }
    
    // 2. Get current board
    const board = (boardStore as any).board;
    if (!board || board.columns.length === 0) {
        console.error('❌ TEST FAILED: No board or columns found');
        console.log('   → Please create a board first with window.add_democontent()');
        console.groupEnd();
        return;
    }
    
    // 3. Find first card
    const firstColumn = board.columns[0];
    const firstCard = firstColumn.cards?.[0];
    
    if (!firstCard) {
        console.error('❌ TEST FAILED: No cards found in first column');
        console.log('   → Please add cards first with window.add_democontent()');
        console.groupEnd();
        return;
    }
    
    console.log('📝 Found test card:');
    console.log('   ID:', firstCard.id);
    console.log('   Heading:', firstCard.heading);
    console.log('   Current content:', firstCard.content?.substring(0, 50) + '...');
    
    // 4. Update card (triggers publishing)
    const testDescription = `[TEST UPDATE ${new Date().toISOString()}] This card was updated via nostrPublishingTest.ts`;
    
    console.log('🔄 Updating card description...');
    boardStore.editCard(firstCard.id, {
        description: testDescription
    });
    
    console.log('✅ Card updated!');
    console.log('   → This should trigger:');
    console.log('      1. boardStore.editCard()');
    console.log('      2. triggerUpdate()');
    console.log('      3. publishToNostr()');
    console.log('      4. publishBoardAsync()');
    console.log('      5. SyncManager.publishOrQueue()');
    
    // 5. Check queue
    setTimeout(() => {
        console.log('⏱️ Checking queue after 1 second...');
        checkSyncQueue();
    }, 1000);
    
    console.groupEnd();
}

/**
 * ✅ TEST 4: Vollständiger Publishing Test
 */
export function testNostrPublishing(): void {
    console.group('🚀 NOSTR PUBLISHING FULL TEST');
    
    console.log('Running comprehensive test suite...\n');
    
    // Test 1: Configuration
    checkNostrConfig();
    console.log('\n');
    
    // Test 2: Queue Status
    checkSyncQueue();
    console.log('\n');
    
    // Test 3: Simulate Update (if authenticated)
    const pubkey = authStore.getPubkey();
    if (pubkey) {
        console.log('✅ User authenticated, running card update simulation...\n');
        simulateCardUpdate();
    } else {
        console.warn('⚠️ User NOT authenticated - skipping card update simulation');
        console.log('   → Login first:');
        console.log('      authStore.loginWithNip07()');
        console.log('      authStore.loginWithNsec("nsec1...")');
    }
    
    console.log('\n📊 TEST SUMMARY:');
    console.log('   ✅ Configuration check: Complete');
    console.log('   ✅ Queue status: Complete');
    console.log(pubkey ? '   ✅ Card update simulation: Complete' : '   ⏭️ Card update simulation: Skipped (no auth)');
    
    console.groupEnd();
}

/**
 * ✅ HELPER: Quick Login für Tests
 */
export function quickTestLogin(): void {
    console.log('🔑 Logging in for testing...');
    console.log('   Please use one of these methods:');
    console.log('   1. window.authStore.loginWithNip07()     // Browser extension (production)');
    console.log('   2. window.authStore.loginWithNsec("...")  // Private key (dev only!)');
    console.log('   3. Or check if already logged in');
    
    const pubkey = authStore.getPubkey();
    if (pubkey) {
        console.log('✅ Already logged in!');
        console.log('   Pubkey:', pubkey);
        console.log('   You can run: window.testNostrPublishing()');
    }
}

/**
 * 🆕 TEST 5: Relay Selection Logic Tests
 */
export function testRelaySelection(): void {
    console.group('🎯 RELAY SELECTION TESTS');
    
    const { relaysPublic, relaysPrivate, draftPublishingMode } = settingsStore.settings;
    
    console.log('📋 Current Settings:');
    console.log('   Public Relays:', relaysPublic.length, 'relay(s)');
    console.log('   Private Relays:', relaysPrivate.length, 'relay(s)');
    console.log('   Draft Mode:', draftPublishingMode);
    console.log('');
    
    // Test verschiedene PublishState Szenarien
    const testCases: Array<{ state: PublishState; description: string }> = [
        { state: 'published', description: 'PUBLISHED Event' },
        { state: 'draft', description: 'DRAFT Event' },
        { state: 'private', description: 'PRIVATE Event' }
    ];
    
    testCases.forEach(({ state, description }) => {
        console.group(`📌 ${description} (publishState='${state}')`);
        
        const targetRelays = getTargetRelays({
            publishState: state,
            draftPublishingMode,
            relaysPublic,
            relaysPrivate
        });
        
        const desc = getRelaySelectionDescription({
            publishState: state,
            draftPublishingMode,
            relaysPublic,
            relaysPrivate
        });
        
        console.log('Target Relays:', targetRelays);
        console.log('Count:', targetRelays.length);
        console.log('Description:', desc);
        
        // Zeige welche Relays genau
        if (targetRelays.length > 0) {
            const isPublic = targetRelays.some(r => relaysPublic.includes(r));
            const isPrivate = targetRelays.some(r => relaysPrivate.includes(r));
            console.log('Contains Public?', isPublic ? '✅ Yes' : '❌ No');
            console.log('Contains Private?', isPrivate ? '✅ Yes' : '❌ No');
        } else {
            console.warn('⚠️ No relays selected → Event will be LOCAL-ONLY');
        }
        
        console.groupEnd();
    });
    
    console.log('');
    console.log('🎯 EXPECTED BEHAVIOR:');
    console.log('   • PUBLISHED → Public + Private relays (vollständiges Backup!)');
    console.log('   • DRAFT → Private relays (based on draftPublishingMode)');
    console.log('   • PRIVATE → Private relays only');
    
    console.groupEnd();
}

/**
 * 🆕 TEST 6: Edge Cases testen
 */
export function testRelaySelectionEdgeCases(): void {
    console.group('⚠️ RELAY SELECTION EDGE CASES');
    
    console.log('Testing edge cases with missing relay configurations...\n');
    
    // Edge Case 1: Keine Private Relays
    console.group('Case 1: Keine Private Relays konfiguriert');
    const result1 = getTargetRelays({
        publishState: 'draft',
        draftPublishingMode: 'private-relays',
        relaysPublic: ['wss://relay.damus.io'],
        relaysPrivate: []  // ← LEER!
    });
    console.log('DRAFT mit mode=private-relays, aber relaysPrivate=[]');
    console.log('→ Ergebnis:', result1);
    console.log('→ Erwartung: [] (local-only mit Warnung)');
    console.log(result1.length === 0 ? '✅ PASS' : '❌ FAIL');
    console.groupEnd();
    
    console.log('');
    
    // Edge Case 2: Keine Public Relays
    console.group('Case 2: Keine Public Relays konfiguriert');
    const result2 = getTargetRelays({
        publishState: 'published',
        draftPublishingMode: 'private-relays',
        relaysPublic: [],  // ← LEER!
        relaysPrivate: ['wss://private.relay']
    });
    console.log('PUBLISHED mit relaysPublic=[] aber relaysPrivate=[...]');
    console.log('→ Ergebnis:', result2);
    console.log('→ Erwartung: ["wss://private.relay"] (nur Private als Backup)');
    console.log(result2.length === 1 ? '✅ PASS' : '❌ FAIL');
    console.groupEnd();
    
    console.log('');
    
    // Edge Case 3: Beide leer
    console.group('Case 3: KEINE Relays konfiguriert');
    const result3 = getTargetRelays({
        publishState: 'published',
        draftPublishingMode: 'private-relays',
        relaysPublic: [],  // ← LEER!
        relaysPrivate: []  // ← LEER!
    });
    console.log('PUBLISHED mit relaysPublic=[] UND relaysPrivate=[]');
    console.log('→ Ergebnis:', result3);
    console.log('→ Erwartung: [] (CRITICAL local-only)');
    console.log(result3.length === 0 ? '✅ PASS' : '❌ FAIL');
    console.groupEnd();
    
    console.log('');
    
    // Edge Case 4: Gleiche Relays in beiden Listen
    console.group('Case 4: Gleiche Relays in Public + Private');
    const result4 = getTargetRelays({
        publishState: 'published',
        draftPublishingMode: 'private-relays',
        relaysPublic: ['wss://relay.damus.io'],
        relaysPrivate: ['wss://relay.damus.io']  // ← GLEICHER!
    });
    console.log('PUBLISHED mit gleichen Relays in beiden Listen');
    console.log('→ Ergebnis:', result4);
    console.log('→ Erwartung: ["wss://relay.damus.io"] (dedupliziert)');
    console.log(result4.length === 1 ? '✅ PASS (dedupliziert)' : '❌ FAIL (doppelt!)');
    console.groupEnd();
    
    console.groupEnd();
}

/**
 * 🆕 TEST 7: Vollständiger Relay Selection Test
 */
export function testRelaySelectionFull(): void {
    console.group('🚀 RELAY SELECTION FULL TEST');
    
    console.log('Running comprehensive relay selection tests...\n');
    
    // Test 1: Normale Szenarien
    testRelaySelection();
    console.log('\n');
    
    // Test 2: Edge Cases
    testRelaySelectionEdgeCases();
    
    console.log('\n📊 TEST SUMMARY:');
    console.log('   ✅ Normal scenarios: Complete');
    console.log('   ✅ Edge cases: Complete');
    console.log('   ℹ️ Check console output above for PASS/FAIL results');
    
    console.groupEnd();
}

// Registriere Funktionen im globalen window-Objekt
if (typeof window !== 'undefined') {
    (window as any).testNostrPublishing = testNostrPublishing;
    (window as any).checkNostrConfig = checkNostrConfig;
    (window as any).checkSyncQueue = checkSyncQueue;
    (window as any).simulateCardUpdate = simulateCardUpdate;
    (window as any).quickTestLogin = quickTestLogin;
    (window as any).testRelaySelection = testRelaySelection;
    (window as any).testRelaySelectionEdgeCases = testRelaySelectionEdgeCases;
    (window as any).testRelaySelectionFull = testRelaySelectionFull;
    
    console.log('🧪 Nostr Publishing Test Suite loaded!');
    console.log('   Available commands:');
    console.log('   - window.testNostrPublishing()          // Vollständiger Test');
    console.log('   - window.checkNostrConfig()             // Nur Konfiguration');
    console.log('   - window.checkSyncQueue()               // Nur Queue Status');
    console.log('   - window.simulateCardUpdate()           // Card Update simulieren');
    console.log('   - window.quickTestLogin()               // Dummy Login für Tests');
    console.log('   🆕 RELAY SELECTION TESTS:');
    console.log('   - window.testRelaySelection()           // Relay Selection Tests');
    console.log('   - window.testRelaySelectionEdgeCases()  // Edge Case Tests');
    console.log('   - window.testRelaySelectionFull()       // Vollständiger Relay Test');
}
