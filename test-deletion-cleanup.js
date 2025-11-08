import NDK from '@nostr-dev-kit/ndk';

async function testDeletions() {
    const ndk = new NDK({ explicitRelayUrls: ['ws://localhost:7000'] });
    await ndk.connect();
    console.log('✅ Connected\n');
    
    const pubkey = '54a340072ccc625516c8d572b638a828c5b857074511302fb4392f26e34e1913';
    
    // 1. Lade alle Boards
    const boards = await ndk.fetchEvents({ kinds: [30301], authors: [pubkey] });
    console.log('📋 Boards auf Relay:', boards.size);
    
    const boardMap = new Map();
    for (const board of boards) {
        const dTag = board.tags.find(t => t[0] === 'd');
        const title = board.tags.find(t => t[0] === 'title');
        if (dTag) {
            boardMap.set(dTag[1], title?.[1] || 'unknown');
        }
    }
    
    // 2. Lade Deletions
    const deletions = await ndk.fetchEvents({ kinds: [5], authors: [pubkey] });
    console.log('🗑️  Deletion Events:', deletions.size, '\n');
    
    const deletedBoardIds = new Set();
    
    // Parse a-tags (neue Deletion Events)
    for (const del of deletions) {
        const aTags = del.tags.filter(t => t[0] === 'a');
        for (const aTag of aTags) {
            const ref = aTag[1]; // "30301:pubkey:board-id"
            if (ref && ref.startsWith('30301:')) {
                const parts = ref.split(':');
                if (parts.length >= 3) {
                    const boardId = parts.slice(2).join(':');
                    deletedBoardIds.add(boardId);
                }
            }
        }
    }
    
    console.log('📊 Analyse:');
    console.log('Total Boards auf Relay:', boardMap.size);
    console.log('Davon gelöscht (a-tags):', deletedBoardIds.size);
    console.log('Sollten angezeigt werden:', boardMap.size - deletedBoardIds.size);
    console.log('\nGelöschte Boards:');
    for (const id of deletedBoardIds) {
        console.log(`  - ${id.substring(0, 20)}... (${boardMap.get(id) || 'unknown'})`);
    }
    
    console.log('\nNOCH SICHTBAR (sollten gelöscht sein):');
    for (const [id, title] of boardMap) {
        if (deletedBoardIds.has(id)) {
            console.log(`  ⚠️  ${id.substring(0, 20)}... - "${title}"`);
        }
    }
    
    process.exit(0);
}

testDeletions().catch(console.error);
