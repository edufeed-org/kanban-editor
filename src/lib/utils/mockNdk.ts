// Lightweight mocks for NDK and NDKEvent used in the test suite
export class MockNDKEvent {
    public kind: number = 0;
    public tags: any[] = [];
    public content: string = "";
    public id: string | undefined;
    public pubkey: string | undefined;
    public created_at: number | undefined;

    constructor(init?: Partial<MockNDKEvent>) {
        Object.assign(this, init || {});
        // ensure created_at and id if not present
        if (!this.created_at) this.created_at = Math.floor(Date.now() / 1000);
        if (!this.id) this.id = `evt_${Math.random().toString(36).slice(2,9)}`;
        if (!this.pubkey) this.pubkey = 'npub_test';
    }

    rawEvent() {
        return {
            id: this.id,
            kind: this.kind,
            tags: this.tags,
            content: this.content,
            pubkey: this.pubkey,
            created_at: this.created_at
        };
    }

    async publish(simulateFail = false): Promise<Set<string>> {
        if (simulateFail) return Promise.reject(new Error('publish failed'));
        // return set of relays
        return Promise.resolve(new Set(['wss://relay.test']));
    }
}

export class MockNDK {
    public signer: any = null;

    createEvent(raw?: Partial<MockNDKEvent>) {
        return new MockNDKEvent(raw);
    }

    // simple fetchEvents stub
    async fetchEvents(filter: any): Promise<MockNDKEvent[]> {
        return [];
    }

    // subscribe stub returns an object with on and stop
    subscribe(_filter: any, _opts?: any) {
        return {
            on: (_ev: string, cb: Function) => { /* no-op */ return this; },
            stop: () => { /* no-op */ }
        };
    }
}
