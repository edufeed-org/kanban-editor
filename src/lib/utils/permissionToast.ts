import { toast } from 'svelte-sonner';
import { requestEditorDialogStore } from '$lib/stores/requestEditorDialog.svelte';

const SUPPRESS_KEY = 'kanban-hide-editor-request-hint';

function getSuppressFlag(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SUPPRESS_KEY) === 'true';
}

function setSuppressFlag(value: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SUPPRESS_KEY, value ? 'true' : 'false');
}

export function showEditorPermissionToast(description: string): void {
    if (typeof window === 'undefined') return;
    if (getSuppressFlag()) return;

    toast.error('Keine Berechtigung', {
        id: 'editor-permission-toast',
        description,
        action: {
            label: 'Rechte beantragen',
            onClick: () => requestEditorDialogStore.openDialog()
        },
        cancel: {
            label: 'Nicht mehr anzeigen',
            onClick: () => setSuppressFlag(true)
        }
    });
}
