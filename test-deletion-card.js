// Test ob Card-Deletion auf dem Relay funktioniert
const NDK = require('@nostr-dev-kit/ndk').default;

async function testCardDeletion() {
    const ndk = new NDK({ 
        explicitRelayUrls: ['ws://localhost:7000'] 
    });
    
    await ndk.connect();
    console.log('✅ Connected to relay\n');
    
    const pubkey = '54a340072ccc625516c8d572b638a828c5b857074511302fb4392f26e34e1913';
    
    // 1. Fetch alle Card Events VORHER
    console.log('📥 Fetching Card Events (Kind 30302) BEFORE deletion...');
    const cardsBefore = await ndk.fetchEvents({
        kinds: [30302],
        authors: [pubkey]
    });
    console.log('Cards found:', cardsBefore.size);
    
    const cardIds = [];
    for (const card of cardsBefore) {
        const dTag = card.tags.find(t => t[0] === 'd');
        const title = card.tags.find(t => t[0] === 'title');
        const cardId = dTag?.[1];
        console.log(`  - Card: ${title?.[1] || 'unknown'} | ID: ${cardId?.substring(0, 20)}...`);
        if (cardId) cardIds.push(cardId);
    }
    
    if (cardIds.length === 0) {
        console.log('\n❌ Keine Cards zum Löschen gefunden!');
        process.exit(0);
    }
    
    // 2. Lösche die ERSTE Card
    const cardIdToDelete = cardIds[0];
    console.log(`\n🗑️ Deleting card: ${cardIdToDelete.substring(0, 20)}...`);
    
    const deletionEvent = new (require('@nostr-dev-kit/ndk').NDKEvent)(ndk);
    deletionEvent.kind = 5; // Deletion
    deletionEvent.tags = [
        ['a', `30302:${pubkey}:${cardIdToDelete}`]
    ];
    deletionEvent.content = 'Test deletion';
    
    console.log('📋 Deletion Event:');
    console.log('  Kind:', deletionEvent.kind);
    console.log('  Tags:', JSON.stringify(deletionEvent.tags));
    console.log('  Content:', deletionEvent.content);
    
    // Signieren (mit dummy signer)
    const { NDKPrivateKeySigner } = require('@nostr-dev-kit/ndk');
    const nsec = 'nsec1xs5pvcn9dqj4gg5k62qetm8dhx7kz4s5hkfr7q8f2lj3k5s7cprqnq5xj4';
    ndk.signer = new NDKPrivateKeySigner(nsec);
    
    console.log('\n🚀 Publishing deletion event...');
    const relays = await deletionEvent.publish();
    console.log(`✅ Published to ${relays.size} relay(s)`);
    
    // 3. Warte kurz
    console.log('\n⏳ Waiting 2 seconds for relay to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Fetch Card Events NACHHER
    console.log('\n📥 Fetching Card Events AFTER deletion...');
    const cardsAfter = await ndk.fetchEvents({
        kinds: [30302],
        authors: [pubkey]
    });
    console.log('Cards found:', cardsAfter.size);
    
    let foundDeleted = false;
    for (const card of cardsAfter) {
        const dTag = card.tags.find(t => t[0] === 'd');
        const title = card.tags.find(t => t[0] === 'title');
        const cardId = dTag?.[1];
        console.log(`  - Card: ${title?.[1] || 'unknown'} | ID: ${cardId?.substring(0, 20)}...`);
        
        if (cardId === cardIdToDelete) {
            foundDeleted = true;
        }
    }
    
    // 5. Auswertung
    console.log('\n📊 ERGEBNIS:');
    if (foundDeleted) {
        console.log('❌ FEHLER: Gelöschte Card wurde IMMER NOCH vom Relay zurückgegeben!');
        console.log('   → Relay unterstützt KEINE automatische Deletion (NIP-09)');
        console.log('   → Wir müssen MANUELL filtern (localStorage-Ansatz ist korrekt)');
    } else {
        console.log('✅ SUCCESS: Gelöschte Card wurde NICHT mehr vom Relay zurückgegeben!');
        console.log('   → Relay unterstützt automatische Deletion (NIP-09)');
    }
    
    // 6. Prüfe ob Deletion Event gespeichert wurde
    console.log('\n📥 Fetching Deletion Events (Kind 5)...');
    const deletions = await ndk.fetchEvents({
        kinds: [5],
        authors: [pubkey]
    });
    console.log('Deletion events found:', deletions.size);
    
    for (const del of deletions) {
        const aTags = del.tags.filter(t => t[0] === 'a');
        console.log('  - Deleted:', aTags.map(t => t[1]).join(', '));
        console.log('    Content:', del.content);
    }
    
    process.exit(0);
}

testCardDeletion().catch(console.error);
