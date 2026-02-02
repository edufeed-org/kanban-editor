<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea/index.js";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { requestEditorDialogStore } from "$lib/stores/requestEditorDialog.svelte";
    import { toast } from "svelte-sonner";

    let reason = $state('');
    let isSubmitting = $state(false);

    async function submitRequest() {
        if (isSubmitting) return;
        isSubmitting = true;
        try {
            await boardStore.requestEditorRole(reason.trim());
            toast.success('Anfrage gesendet', {
                description: 'Der Board-Owner kann deine Anfrage jetzt prüfen.'
            });
            reason = '';
            requestEditorDialogStore.closeDialog();
        } catch (error: any) {
            toast.error('Anfrage fehlgeschlagen', {
                description: error?.message || 'Bitte versuche es später erneut.'
            });
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog.Root bind:open={requestEditorDialogStore.open}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>Editorrechte anfragen</Dialog.Title>
            <Dialog.Description>
                Sende eine Anfrage an den Board-Owner. Ohne Bestätigung erhältst du keine Bearbeitungsrechte.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-3 py-2">
            <label for="editor-request-reason" class="text-xs font-medium text-muted-foreground">
                Optionaler Hinweis für den Owner
            </label>
            <Textarea
                id="editor-request-reason"
                bind:value={reason}
                placeholder="Warum möchtest du mitarbeiten? (optional)"
                rows={3}
            />
        </div>

        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={() => requestEditorDialogStore.closeDialog()}>
                Abbrechen
            </Button>
            <Button onclick={submitRequest} disabled={isSubmitting}>
                {isSubmitting ? 'Sende…' : 'Anfrage senden'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
