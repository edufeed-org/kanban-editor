<script lang="ts">
    import type { Component } from 'svelte';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';

    interface Props {
        open: boolean;
        title: string;
        icon: Component;
        tab: 'ui' | 'llm' | 'nostr' | 'defaults';
    }

    let { open = $bindable(), title, icon: Icon, tab }: Props = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <Icon class="h-5 w-5" />
                {title}
            </Dialog.Title>
        </Dialog.Header>
        <div class="py-4">
            <SettingsPanel defaultTab={tab} showHeader={false} showTabs={false} />
        </div>
    </Dialog.Content>
</Dialog.Root>
