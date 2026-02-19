/**
 * Reactive state for "follow / import foreign board" CTA in Topbar.
 *
 * Set by [naddr]/+page.svelte when a foreign (viewer-only) board is loaded.
 * Read by Topbar.svelte to show a discreet "Speichern" action-button.
 *
 * Lifecycle:
 *   [naddr]/+page loads board → setPending()  → Topbar shows button
 *   User clicks button         → requestOpen() → naddr page opens FollowBoardDialog
 *   User navigates away        → clear()       → button disappears
 */
class FollowBoardState {
    boardId     = $state<string | null>(null);
    boardAuthor = $state<string | null>(null);

    /** True if shouldOpen was set by requestOpen() and the page hasn't consumed it yet */
    shouldOpen = $state(false);

    /** True when a foreign board is currently displayed (follow CTA available) */
    get hasPending(): boolean {
        return this.boardId !== null;
    }

    /** Called by [naddr]/+page after loading a foreign board as viewer */
    setPending(boardId: string, boardAuthor: string): void {
        this.boardId     = boardId;
        this.boardAuthor = boardAuthor;
        this.shouldOpen  = false;
    }

    /** Called by Topbar button — the naddr page $effect picks this up and opens the dialog */
    requestOpen(): void {
        if (this.boardId) {
            this.shouldOpen = true;
        }
    }

    /** Called by onDestroy in [naddr]/+page when user navigates away */
    clear(): void {
        this.boardId     = null;
        this.boardAuthor = null;
        this.shouldOpen  = false;
    }
}

export const followBoardState = new FollowBoardState();
