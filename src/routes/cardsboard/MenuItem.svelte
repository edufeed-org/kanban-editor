<script lang="ts">
    import type { Component } from 'svelte';
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

    interface Props {
        icon: Component;
        label: string;
        onclick: () => void;
        disabled?: boolean;
        showBorder?: boolean;
        showChevron?: boolean;
        variant?: 'default' | 'danger';
    }

    let {
        icon: Icon,
        label,
        onclick,
        disabled = false,
        showBorder = true,
        showChevron = false,
        variant = 'default'
    }: Props = $props();
</script>

{#if showBorder}
    <div class="border-t"></div>
{/if}
<button
    type="button"
    class="menu-item w-full flex items-center px-4 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent"
    class:justify-between={showChevron}
    class:gap-3={!showChevron}
    class:menu-item-danger={variant === 'danger'}
    title={label}
    {onclick}
    {disabled}
>
    <div class="flex items-center gap-3 flex-shrink-0">
        <Icon class="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
    </div>
    {#if showChevron}
        <ChevronRightIcon class="h-4 w-4 text-muted-foreground flex-shrink-0 ml-auto" />
    {/if}
</button>
