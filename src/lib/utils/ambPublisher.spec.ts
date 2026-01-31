import { describe, it, expect } from 'vitest';
import { publishBoardToEdufeed } from './ambPublisher';

describe('ambPublisher publish gate', () => {
  it('refuses to publish when board is not published', async () => {
    const mockBoard: any = {
      getContextData: (full = false) => ({ publishState: 'private', id: 'board-1' }),
      id: 'board-1'
    };

    const res = await publishBoardToEdufeed(mockBoard as any, { pubkey: 'pk' });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    // Error message is in German and mentions "Veröffentlicht"
    expect(String(res.error).toLowerCase()).toContain('veröffentlicht');
  });
});
