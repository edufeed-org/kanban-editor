// Debug Script: Zeigt welche Boards gelöscht sein sollten vs. was tatsächlich geladen wird

import NDK from '@nostr-dev-kit/ndk';

async function debugDeletionMatching() {
    const ndk = new NDK({ 
        explicitRelayUrls: ['ws://localhost:7000'] 
    });
    
    await ndk.connect();
    console.log('✅ Connected to relay\n');
    
    const pubkey = '54a340072ccc625516c8d572b638a828c5b857074511302fb4392f26e34e1913';
    
    // 1. Fetch Board Events
    console.log('📋 Fetching Board Events (Kind 30301)...');
    const boards = await ndk.fetchEvents({ 
        kinds: [30301], 
        authors: [pubkey] 
    });
    
    console.log(`Found ${boards.size} board(s):\n`);
    const boardMap = new Map();
    
    for (const board of boards) {
        const dTag = board.tags.find(t => t[0] === 'd');
        const title = board.tags.find(t => t[0] === 'title');
        const boardId = dTag?.[1];
        const boardTitle = title?.[1] || 'unknown';
        
        boardMap.set(boardId, boardTitle);
        console.log(`  📌 Board: "${boardTitle}"`);
        console.log(`     ID: ${boardId}`);
        console.log(`     Created: ${new Date(board.created_at * 1000).toISOString()}`);
        console.log();
    }
    
    // 2. Fetch Deletion Events
    console.log('\n🗑️  Fetching Deletion Events (Kind 5)...');
    const deletions = await ndk.fetchEvents({ 
        kinds: [5], 
        authors: [pubkey] 
    });
    
    console.log(`Found ${deletions.size} deletion event(s):\n`);
    const deletedBoardIds = new Set();
    
    for (const delEvent of deletions) {
        console.log(`  🗑️  Deletion Event:`);
        console.log(`     Created: ${new Date(delEvent.created_at * 1000).toISOString()}`);
        console.log(`     Content: "${delEvent.content}"`);
        
        // Parse 'a' tags (NIP-09 für replaceable events)
        const aTags = delEvent.tags.filter(t => t[0] === 'a');
        
        if (aTags.length === 0) {
            console.log(`     ⚠️  NO 'a' TAGS FOUND!`);
        }
        
        for (const aTag of aTags) {
            const eventRef = aTag[1]; // z.B. "30301:pubkey:board-xxx"
            console.log(`     a-tag: ${eventRef}`);
            
            if (eventRef && eventRef.startsWith('30301:')) {
                const parts = eventRef.split(':');
                if (parts.length >= 3) {
                    const boardId = parts.slice(2).join(':');
                    deletedBoardIds.add(boardId);
                    
                    const wasOnRelay = boardMap.has(boardId);
                    console.log(`     → Board ID: ${boardId}`);
                    console.log(`     → Was on relay: ${wasOnRelay ? '✅ YES' : '❌ NO'}`);
                    
                    if (wasOnRelay) {
                        console.log(`     → Title: "${boardMap.get(boardId)}"`);
                    }
                }
            }
        }
        console.log();
    }
    
    // 3. Check localStorage deletions
    console.log('\n💾 Checking localStorage for deleted boards...');
    console.log('(This would be in the browser, not Node.js)\n');
    
    // 4. Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Boards on relay: ${boards.size}`);
    console.log(`   Deletion events: ${deletions.size}`);
    console.log(`   Unique deleted board IDs: ${deletedBoardIds.size}`);
    console.log();
    
    // 5. Which boards should be shown vs hidden?
    console.log('🎯 EXPECTED BEHAVIOR:');
    for (const [boardId, title] of boardMap) {
        const isDeleted = deletedBoardIds.has(boardId);
        const status = isDeleted ? '🚫 SHOULD BE HIDDEN' : '✅ SHOULD BE SHOWN';
        console.log(`   ${status}: "${title}" (${boardId})`);
    }
    
    process.exit(0);
}

debugDeletionMatching().catch(console.error);
