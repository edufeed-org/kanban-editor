import { toast } from 'svelte-sonner';
import { requestEditorDialogStore } from '$lib/stores/requestEditorDialog.svelte';

const SUPPRESS_KEY_PREFIX = 'kanban-hide-editor-request-hint';

function getSuppressKey(boardId?: string): string {
    return boardId ? `${SUPPRESS_KEY_PREFIX}:${boardId}` : SUPPRESS_KEY_PREFIX;
}

function getSuppressFlag(boardId?: string): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(getSuppressKey(boardId)) === 'true';
}

function setSuppressFlag(value: boolean, boardId?: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getSuppressKey(boardId), value ? 'true' : 'false');
}

export function showEditorPermissionToast(description: string, boardId?: string): void {
    if (typeof window === 'undefined') return;
    if (getSuppressFlag(boardId)) return;

    toast.error('Keine Berechtigung', {
        id: 'editor-permission-toast',
        description,
        action: {
            label: 'Schreibrechte beantragen',
            onClick: () => requestEditorDialogStore.openDialog()
        },
        cancel: {
            label: 'Nicht mehr anzeigen',
            onClick: () => setSuppressFlag(true, boardId)
        }
    });
}
