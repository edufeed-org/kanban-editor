<script lang="ts">
	interface Props {
		attendees?: string[];
		maxVisible?: number;
	}

	let { attendees = [], maxVisible = 3 }: Props = $props();

	// Computed
	let visibleAvatars = $derived(attendees.slice(0, maxVisible));
	let overflowCount = $derived(Math.max(0, attendees.length - maxVisible));

	// Generate consistent color for attendee (based on pubkey hash)
	function getAvatarColor(pubkey: string): string {
		const colors = [
			'bg-blue-500',
			'bg-green-500',
			'bg-red-500',
			'bg-yellow-500',
			'bg-purple-500',
			'bg-pink-500',
			'bg-indigo-500',
			'bg-cyan-500'
		];
		const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	}

	// Get initials from pubkey (first 2 chars)
	function getInitials(pubkey: string): string {
		return pubkey.slice(0, 2).toUpperCase();
	}
</script>

<!-- AvatarStack Component -->
<div class="avatar-stack flex items-center -space-x-2">
	{#each visibleAvatars as pubkey}
		<div
			class="avatar w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white dark:border-slate-900 {getAvatarColor(
				pubkey
			)}"
			title={pubkey}
		>
			{getInitials(pubkey)}
		</div>
	{/each}

	{#if overflowCount > 0}
		<div
			class="avatar w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900"
			title="{overflowCount} weitere Mitwirkende"
		>
			+{overflowCount}
		</div>
	{/if}
</div>

<style>
	.avatar-stack {
		display: flex;
		align-items: center;
		margin: 0;
	}

	.avatar {
		transition: transform 0.2s ease;
	}

	.avatar:hover {
		transform: scale(1.2);
		z-index: 10;
	}
</style>
