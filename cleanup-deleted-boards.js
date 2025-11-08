import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * WARNUNG: Dieses Script LÖSCHT Board-Events vom Relay!
 * Es erstellt für gelöschte Boards neue replaceable Events mit deleted=true tag.
 */

async function cleanupDeletedBoards() {
    const ndk = new NDK({ explicitRelayUrls: ['ws://localhost:7000'] });
    await ndk.connect();
    console.log('✅ Connected to relay\n');
    
    const pubkey = '54a340072ccc625516c8d572b638a828c5b857074511302fb4392f26e34e1913';
    
    // 1. Lade Deletions
    const deletions = await ndk.fetchEvents({ kinds: [5], authors: [pubkey] });
    console.log('🗑️  Found', deletions.size, 'deletion events\n');
    
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
                    console.log(`🗑️  Board zu löschen: ${boardId.substring(0, 30)}...`);
                }
            }
        }
    }
    
    if (deletedBoardIds.size === 0) {
        console.log('✅ Keine Boards zum Löschen gefunden');
        process.exit(0);
    }
    
    console.log(`\n⚠️  WARNUNG: Ich werde jetzt ${deletedBoardIds.size} Board-Events ÜBERSCHREIBEN!`);
    console.log('Drücke Ctrl+C um abzubrechen, oder warte 5 Sekunden...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. Lade Boards
    const boards = await ndk.fetchEvents({ kinds: [30301], authors: [pubkey] });
    
    console.log(`📋 Found ${boards.size} boards on relay:\n`);
    for (const board of boards) {
        const dTag = board.tags.find(t => t[0] === 'd');
        const titleTag = board.tags.find(t => t[0] === 'title');
        if (dTag) {
            const boardId = dTag[1];
            const title = titleTag ? titleTag[1] : '(no title)';
            const isDeleted = deletedBoardIds.has(boardId);
            console.log(`   ${isDeleted ? '🗑️' : '📌'} ${boardId.substring(0, 30)}... - "${title}"`);
        }
    }
    
    console.log('');
    
    let deleted = 0;
    for (const board of boards) {
        const dTag = board.tags.find(t => t[0] === 'd');
        if (!dTag) continue;
        
        const boardId = dTag[1];
        
        if (deletedBoardIds.has(boardId)) {
            // Erstelle ein "gelöschtes" replaceable Event
            // (überschreibt das alte Event)
            const deleteEvent = new NDKEvent(ndk);
            deleteEvent.kind = 30301;
            deleteEvent.tags = [
                ['d', boardId],
                ['deleted', 'true'],
                ['title', '(Deleted)']
            ];
            deleteEvent.content = '';
            
            await deleteEvent.publish();
            deleted++;
            console.log(`✅ Board überschrieben: ${boardId.substring(0, 30)}...`);
        }
    }
    
    console.log(`\n🎉 ${deleted} Boards wurden als gelöscht markiert`);
    console.log('WICHTIG: Der Client muss jetzt Boards mit deleted=true Tag ignorieren!');
    
    process.exit(0);
}

cleanupDeletedBoards().catch(console.error);
