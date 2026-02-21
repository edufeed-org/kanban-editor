<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TabsPrimitive.TriggerProps = $props();
</script>

<TabsPrimitive.Trigger
	bind:ref
	data-slot="tabs-trigger"
	class={cn(
		"inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1 text-sm font-medium transition-all cursor-pointer",
		"text-muted-foreground",
		"data-[state=active]:text-foreground",
		"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		className
	)}
	{...restProps}
/>

<style>
	:global([data-slot="tabs-trigger"]) {
		border-bottom: 2px solid transparent;
		transition: border-color 0.2s;
	}

	:global([data-slot="tabs-trigger"]:hover) {
		border-bottom-color: var(--muted-foreground);
	}

	:global([data-slot="tabs-trigger"][data-state="active"]) {
		border-bottom-color: var(--foreground);
	}
</style>
