import NDK from '@nostr-dev-kit/ndk';

async function checkRelay() {
    const ndk = new NDK({ explicitRelayUrls: ['ws://localhost:7000'] });
    await ndk.connect();
    console.log('✅ Connected to relay\n');
    
    const pubkey = '54a340072ccc625516c8d572b638a828c5b857074511302fb4392f26e34e1913';
    
    // Fetch Boards
    console.log('📋 Fetching Board Events (Kind 30301)...');
    const boards = await ndk.fetchEvents({ kinds: [30301], authors: [pubkey] });
    console.log('Boards found:', boards.size);
    for (const board of boards) {
        const dTag = board.tags.find(t => t[0] === 'd');
        const title = board.tags.find(t => t[0] === 'title');
        console.log('  - Board:', title?.[1] || 'unknown', 'ID:', dTag?.[1]);
    }
    
    // Fetch Deletions
    console.log('\n🗑️ Fetching Deletion Events (Kind 5)...');
    const deletions = await ndk.fetchEvents({ kinds: [5], authors: [pubkey] });
    console.log('Deletions found:', deletions.size, '\n');
    
    for (const del of deletions) {
        const aTags = del.tags.filter(t => t[0] === 'a');
        const eTags = del.tags.filter(t => t[0] === 'e');
        console.log('Deletion Event:', del.id);
        console.log('  - a-tags:', aTags.map(t => t[1]).join(', ') || 'keine');
        console.log('  - e-tags:', eTags.map(t => t[1]).join(', ') || 'keine');
        console.log('  - Content:', del.content);
        console.log('');
    }
    
    process.exit(0);
}

checkRelay().catch(console.error);
