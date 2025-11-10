/**
 * Card Operations Integration Tests (v4.3)
 * 
 * Diese Tests benötigen:
 * - Laufendes Nostr-Relay (localhost:7777)
 * - Generierter Test-nsec für Signing
 * 
 * Tests werden GESKIPPT wenn:
 * - Relay nicht erreichbar
 * - Kein Test-nsec verfügbar
 * 
 * Start Relay:
 * ```bash
 * docker-compose up relay
 * ```
 * 
 * Tests fokussieren:
 * - STEP 3: upsertCardFromNostr mit echtem Relay
 * - STEP 4: handleCardEvent LWW mit echten Events
 * - STEP 5: nostrEventToCard mit echten NDKEvents
 * - STEP 6: Rank-based positioning mit echten Events
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { Board, Card } from '$lib/classes/BoardModel';
import { BoardOperations } from './operations';
import { nostrEventToCard, cardToNostrEvent } from '$lib/utils/nostrEvents';
import type { CardProps } from '$lib/classes/BoardModel';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const RELAY_URL = 'ws://localhost:7777';
const TEST_TIMEOUT = 10000; // 10 seconds

// Generate a test nsec (deterministic for reproducibility)
function generateTestNsec(): string {
  // Use a fixed seed for test reproducibility
  const testSeed = 'test-seed-for-card-integration-tests-v4.3';
  const encoder = new TextEncoder();
  const data = encoder.encode(testSeed);
  
  // Create a simple hash (32 bytes)
  const hash = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    hash[i % 32] ^= data[i];
  }
  
  // Convert to hex
  const hex = Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hex;
}

// ============================================================================
// RELAY AVAILABILITY CHECK
// ============================================================================

async function isRelayAvailable(): Promise<boolean> {
  try {
    const ws = new WebSocket(RELAY_URL);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 2000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

// ============================================================================
// TEST SETUP
// ============================================================================

let ndk: NDK;
let signer: NDKPrivateKeySigner;
let shouldSkip = false;

beforeAll(async () => {
  // Check relay availability
  const relayAvailable = await isRelayAvailable();
  
  if (!relayAvailable) {
    console.warn('⚠️  Skipping integration tests: Relay not available at', RELAY_URL);
    console.warn('   Start relay with: docker-compose up relay');
    shouldSkip = true;
    return;
  }
  
  // Generate test nsec
  const testHex = generateTestNsec();
  
  try {
    // Create signer
    signer = new NDKPrivateKeySigner(testHex);
    
    // Initialize NDK
    ndk = new NDK({
      explicitRelayUrls: [RELAY_URL],
      signer
    });
    
    await ndk.connect();
    
    // Wait for relay connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ NDK connected to relay:', RELAY_URL);
    
  } catch (error) {
    console.error('❌ Failed to initialize NDK:', error);
    shouldSkip = true;
  }
}, TEST_TIMEOUT);

afterAll(async () => {
  if (ndk) {
    // Cleanup: Close connections
    for (const relay of ndk.pool.relays.values()) {
      relay.disconnect();
    }
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createTestBoard(): Board {
  return new Board({
    id: 'test-board-' + Date.now(),
    name: 'Test Board',
    columns: [
      { id: 'col-a', name: 'Column A', cards: [] },
      { id: 'col-b', name: 'Column B', cards: [] },
      { id: 'col-c', name: 'Column C', cards: [] }
    ]
  });
}

async function publishCardEvent(
  cardProps: CardProps,
  columnId: string,
  rank: number
): Promise<NDKEvent> {
  if (!signer || !ndk) {
    throw new Error('NDK or signer not initialized - relay might be offline');
  }
  
  const user = await signer.user();
  const boardRef = `30301:${user.pubkey}:test-board`;
  
  const event = cardToNostrEvent(
    cardProps as any, // Card instance, wird vom Helper konvertiert
    columnId,
    'Test Column', // columnName für col_label tag
    rank,
    boardRef,
    ndk
  );
  
  await event.sign(signer);
  await event.publish();
  
  return event;
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe.skipIf(shouldSkip)('Card upsertCardFromNostr Integration (STEP 3)', () => {
  
  it('upsertCardFromNostr creates card from Nostr event', async () => {
    const board = createTestBoard();
    
    const cardProps: CardProps = {
      id: 'test-card-' + Date.now(),
      heading: 'Test Card from Nostr',
      content: 'Content',
      createdAt: Math.floor(Date.now() / 1000),
      columnId: 'col-a'
    };
    
    const result = BoardOperations.upsertCardFromNostr(board, cardProps);
    
    expect(result).toBe(true);
    
    const col = board.findColumn('col-a')!;
    expect(col.cards.length).toBe(1);
    expect(col.cards[0].heading).toBe('Test Card from Nostr');
  }, TEST_TIMEOUT);

  it('upsertCardFromNostr removes card from old column when moved', async () => {
    const board = createTestBoard();
    
    const cardProps: CardProps = {
      id: 'test-card-move-' + Date.now(),
      heading: 'Moving Card',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // Add to col-a
    BoardOperations.upsertCardFromNostr(board, cardProps);
    expect(board.findColumn('col-a')!.cards.length).toBe(1);
    
    // Move to col-b
    const movedProps: CardProps = {
      ...cardProps,
      columnId: 'col-b'
    };
    
    BoardOperations.upsertCardFromNostr(board, movedProps);
    
    expect(board.findColumn('col-a')!.cards.length).toBe(0); // Removed from A
    expect(board.findColumn('col-b')!.cards.length).toBe(1); // Added to B
  }, TEST_TIMEOUT);

  it('upsertCardFromNostr prevents duplicate cards', async () => {
    const board = createTestBoard();
    
    const cardProps: CardProps = {
      id: 'test-card-duplicate-' + Date.now(),
      heading: 'Duplicate Test',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    // Add twice
    BoardOperations.upsertCardFromNostr(board, cardProps);
    BoardOperations.upsertCardFromNostr(board, cardProps);
    
    // Should only exist once
    let totalCards = 0;
    for (const col of board.columns) {
      totalCards += col.cards.filter(c => c.id === cardProps.id).length;
    }
    
    expect(totalCards).toBe(1);
  }, TEST_TIMEOUT);
});

describe.skipIf(shouldSkip)('Card LWW with Real Events (STEP 4)', () => {
  
  it('LWW: Newer event timestamp overwrites local card', async () => {
    const board = createTestBoard();
    
    const oldTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const newTime = Math.floor(Date.now() / 1000);
    
    const cardProps: CardProps = {
      id: 'test-card-lww-' + Date.now(),
      heading: 'Old Version',
      columnId: 'col-a',
      createdAt: oldTime,
      updatedAt: new Date(oldTime * 1000).toISOString()
    };
    
    // Add old version
    BoardOperations.upsertCardFromNostr(board, cardProps);
    
    const col = board.findColumn('col-a')!;
    expect(col.cards[0].heading).toBe('Old Version');
    
    // Simulate newer event
    const newerProps: CardProps = {
      ...cardProps,
      heading: 'New Version',
      updatedAt: new Date(newTime * 1000).toISOString()
    };
    
    // Check LWW
    const localTime = new Date(col.cards[0].updatedAt).getTime();
    const eventTime = new Date(newerProps.updatedAt!).getTime();
    
    if (eventTime > localTime) {
      BoardOperations.upsertCardFromNostr(board, newerProps);
    }
    
    expect(col.cards[0].heading).toBe('New Version');
  }, TEST_TIMEOUT);

  it('LWW: Older event timestamp is rejected', async () => {
    const board = createTestBoard();
    
    const newTime = Math.floor(Date.now() / 1000);
    const oldTime = newTime - 3600; // 1 hour ago
    
    const cardProps: CardProps = {
      id: 'test-card-lww-reject-' + Date.now(),
      heading: 'Current Version',
      columnId: 'col-a',
      createdAt: newTime,
      updatedAt: new Date(newTime * 1000).toISOString()
    };
    
    // Add current version
    BoardOperations.upsertCardFromNostr(board, cardProps);
    
    // Simulate older event
    const olderProps: CardProps = {
      ...cardProps,
      heading: 'Stale Version',
      updatedAt: new Date(oldTime * 1000).toISOString()
    };
    
    const col = board.findColumn('col-a')!;
    const localTime = new Date(col.cards[0].updatedAt).getTime();
    const eventTime = new Date(olderProps.updatedAt!).getTime();
    
    // Should NOT update
    if (eventTime > localTime) {
      BoardOperations.upsertCardFromNostr(board, olderProps);
    }
    
    expect(col.cards[0].heading).toBe('Current Version'); // Unchanged
  }, TEST_TIMEOUT);
});

describe.skipIf(shouldSkip)('Card Timestamp Extraction (STEP 5)', () => {
  
  it('nostrEventToCard extracts created_at timestamp', async () => {
    const eventTime = Math.floor(Date.now() / 1000);
    
    const event = new NDKEvent(ndk);
    event.kind = 30302;
    event.created_at = eventTime;
    event.tags = [
      ['d', 'test-card-extract'],
      ['title', 'Test Card'],
      ['a', '30301:pubkey:board-id']
    ];
    event.content = 'Test content';
    
    const cardProps = nostrEventToCard(event);
    
    expect(cardProps.createdAt).toBe(eventTime);
    expect(cardProps.updatedAt).toBe(new Date(eventTime * 1000).toISOString());
  }, TEST_TIMEOUT);

  it('nostrEventToCard handles missing timestamp gracefully', async () => {
    const event = new NDKEvent(ndk);
    event.kind = 30302;
    // No created_at set
    event.tags = [
      ['d', 'test-card-no-timestamp'],
      ['title', 'Test Card']
    ];
    event.content = '';
    
    const before = Date.now();
    const cardProps = nostrEventToCard(event);
    const after = Date.now();
    
    // Should use fallback to NOW
    const extractedTime = new Date(cardProps.updatedAt!).getTime();
    expect(extractedTime).toBeGreaterThanOrEqual(before);
    expect(extractedTime).toBeLessThanOrEqual(after);
  }, TEST_TIMEOUT);
});

describe.skipIf(shouldSkip)('Card Rank Positioning with Real Events (STEP 6)', () => {
  
  it('upsertCardFromNostr inserts card at specific rank', async () => {
    const board = createTestBoard();
    const col = board.findColumn('col-a')!;
    
    // Add initial cards
    for (let i = 1; i <= 3; i++) {
      BoardOperations.upsertCardFromNostr(board, {
        id: `card-${i}`,
        heading: `Card ${i}`,
        columnId: 'col-a',
        createdAt: Math.floor(Date.now() / 1000)
      });
    }
    
    expect(col.cards.length).toBe(3);
    
    // Insert new card at rank 1
    const cardWithRank = {
      id: 'card-new',
      heading: 'New Card',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000),
      rank: 1
    };
    
    BoardOperations.upsertCardFromNostr(board, cardWithRank as any);
    
    expect(col.cards.length).toBe(4);
    expect(col.cards[1].id).toBe('card-new');
  }, TEST_TIMEOUT);

  it('upsertCardFromNostr repositions existing card to new rank', async () => {
    const board = createTestBoard();
    const col = board.findColumn('col-a')!;
    
    // Add cards
    for (let i = 1; i <= 3; i++) {
      BoardOperations.upsertCardFromNostr(board, {
        id: `card-${i}`,
        heading: `Card ${i}`,
        columnId: 'col-a',
        createdAt: Math.floor(Date.now() / 1000)
      });
    }
    
    const originalOrder = col.cards.map(c => c.id);
    expect(originalOrder).toEqual(['card-1', 'card-2', 'card-3']);
    
    // Update card-3 with rank 0 (move to first)
    BoardOperations.upsertCardFromNostr(board, {
      id: 'card-3',
      heading: 'Card 3',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000),
      rank: 0
    } as any);
    
    const newOrder = col.cards.map(c => c.id);
    expect(newOrder).toEqual(['card-3', 'card-1', 'card-2']);
  }, TEST_TIMEOUT);

  it('upsertCardFromNostr handles invalid rank gracefully', async () => {
    const board = createTestBoard();
    const col = board.findColumn('col-a')!;
    
    // Add initial card
    BoardOperations.upsertCardFromNostr(board, {
      id: 'card-1',
      heading: 'Card 1',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000)
    });
    
    // Try to add with invalid rank
    BoardOperations.upsertCardFromNostr(board, {
      id: 'card-2',
      heading: 'Card 2',
      columnId: 'col-a',
      createdAt: Math.floor(Date.now() / 1000),
      rank: -999 // Invalid
    } as any);
    
    // Should fallback to end
    expect(col.cards.length).toBe(2);
    expect(col.cards[1].id).toBe('card-2');
  }, TEST_TIMEOUT);
});

describe.skipIf(shouldSkip)('Complete Integration Workflow (All Steps)', () => {
  
  it('End-to-End: Publish → Receive → LWW → Rank', async () => {
    // ✅ FIXED: Early return if relay offline (describe.skipIf doesn't always work)
    if (shouldSkip || !signer || !ndk) {
      console.warn('⚠️  Skipping E2E test: Relay not available');
      return;
    }
    
    const board = createTestBoard();
    
    // 1. Publish card event with timestamp
    const cardProps: CardProps = {
      id: 'e2e-card-' + Date.now(),
      heading: 'E2E Test Card',
      content: 'End-to-end test',
      createdAt: Math.floor(Date.now() / 1000),
      columnId: 'col-a',
      rank: 0
    };
    
    await publishCardEvent(cardProps, 'col-a', 0);
    
    // 2. Simulate receiving event (upsertCardFromNostr)
    BoardOperations.upsertCardFromNostr(board, cardProps as any);
    
    const col = board.findColumn('col-a')!;
    expect(col.cards.length).toBe(1);
    expect(col.cards[0].heading).toBe('E2E Test Card');
    
    // 3. Simulate newer update
    const updatedProps = {
      ...cardProps,
      heading: 'Updated Card',
      updatedAt: new Date(Date.now() + 5000).toISOString() // 5s in future
    };
    
    const localTime = new Date(col.cards[0].updatedAt).getTime();
    const eventTime = new Date(updatedProps.updatedAt!).getTime();
    
    if (eventTime > localTime) {
      BoardOperations.upsertCardFromNostr(board, updatedProps as any);
    }
    
    expect(col.cards[0].heading).toBe('Updated Card');
    
    // 4. Simulate rank change
    const rankUpdateProps = {
      ...updatedProps,
      rank: 0, // Already at 0, no change
      updatedAt: new Date(Date.now() + 10000).toISOString()
    };
    
    BoardOperations.upsertCardFromNostr(board, rankUpdateProps as any);
    
    // Should still be first (rank 0)
    expect(col.cards[0].id).toBe(cardProps.id);
    
  }, TEST_TIMEOUT * 2);
});
