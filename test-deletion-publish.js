import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

async function testDeletion() {
    console.log('🔧 Testing Deletion Event Publishing...\n');
    
    // 1. Setup NDK mit lokalem Relay
    const ndk = new NDK({
        explicitRelayUrls: ['ws://localhost:7000']
    });
    
    await ndk.connect();
    console.log('✓ Connected to ws://localhost:7000\n');
    
    // 2. Setup Signer (verwende echten Test-Key)
    // Generiere zufälligen gültigen Private Key für Test
    const crypto = await import('crypto');
    const testPrivateKey = crypto.randomBytes(32).toString('hex');
    const signer = new NDKPrivateKeySigner(testPrivateKey);
    ndk.signer = signer;
    
    const user = await signer.user();
    console.log('✓ Signer initialized');
    console.log('  Pubkey:', user.pubkey, '\n');
    
    // 3. Erstelle ein Test-Board Event
    console.log('📦 Creating test board event...');
    const boardEvent = new NDKEvent(ndk);
    boardEvent.kind = 30301;
    boardEvent.tags = [
        ['d', 'test-board-to-delete'],
        ['title', 'Test Board']
    ];
    boardEvent.content = '';
    
    await boardEvent.sign(signer);
    console.log('✓ Board event signed');
    
    const boardPublish = await boardEvent.publish();
    console.log('✓ Board event published to', boardPublish.size, 'relay(s)\n');
    
    // 4. Erstelle Deletion Event
    console.log('🗑️ Creating deletion event...');
    const deletionEvent = new NDKEvent(ndk);
    deletionEvent.kind = 5;
    deletionEvent.tags = [
        ['e', `30301:${user.pubkey}:test-board-to-delete`]
    ];
    deletionEvent.content = 'Test deletion';
    
    await deletionEvent.sign(signer);
    console.log('✓ Deletion event signed');
    console.log('  Event ID:', deletionEvent.id);
    console.log('  Signature:', deletionEvent.sig?.substring(0, 20) + '...');
    console.log('  Tags:', JSON.stringify(deletionEvent.tags));
    console.log('  Content:', deletionEvent.content, '\n');
    
    // 5. Publiziere Deletion Event
    console.log('📤 Publishing deletion event...');
    try {
        const deletionPublish = await deletionEvent.publish();
        console.log('✓ Deletion event published to', deletionPublish.size, 'relay(s)\n');
    } catch (error) {
        console.error('❌ Publishing failed:', error);
        console.error('   Error details:', error.message, '\n');
    }
    
    // 6. Warte kurz und überprüfe
    console.log('⏳ Waiting 2 seconds for relay to process...');
    await new Promise(res => setTimeout(res, 2000));
    
    // 7. Überprüfe ob Deletion Event am Relay ist
    console.log('🔍 Checking relay for deletion events...');
    const deletions = await ndk.fetchEvents({
        kinds: [5],
        authors: [user.pubkey]
    });
    
    console.log('✓ Deletions found:', deletions.size);
    for (const del of deletions) {
        const eTag = del.tags.find(t => t[0] === 'e');
        console.log('  - Deleted:', eTag?.[1]);
    }
    
    process.exit(0);
}

testDeletion().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});
