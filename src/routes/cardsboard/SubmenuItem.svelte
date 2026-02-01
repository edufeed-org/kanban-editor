<script lang="ts">
    import type { Component } from 'svelte';

    interface Props {
        icon: Component;
        label: string;
        onclick: () => void;
    }

    let { icon: Icon, label, onclick }: Props = $props();
</script>

<button
    type="button"
    class="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded transition-colors"
    title={label}
    {onclick}
>
    <Icon class="h-4 w-4 text-muted-foreground" />
    <span>{label}</span>
</button>
