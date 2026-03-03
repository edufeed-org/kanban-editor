<script lang="ts">
	import { presenceStore } from '$lib/stores/presenceStore.svelte.js';
	import { authStore } from '$lib/stores/authStore.svelte.js';
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { nip19 } from 'nostr-tools';
	
	// Props
	let { maxVisible = 5 }: { maxVisible?: number } = $props();
	
	// Current user pubkey for styling
	let currentUserPubkey = $derived(authStore.getPubkey());
	
	// Derived values from presence store - filter out current user
	let onlineUsers = $derived(
		presenceStore.userList.filter(user => user.pubkey !== currentUserPubkey)
	);
	let visibleUsers = $derived(onlineUsers.slice(0, maxVisible));
	let overflowCount = $derived(Math.max(0, onlineUsers.length - maxVisible));
	
	// Helper: Get avatar color based on pubkey
	function getAvatarColor(pubkey: string): string {
		const colors = [
			'bg-blue-500',
			'bg-green-500',
			'bg-red-500',
			'bg-yellow-500',
			'bg-purple-500',
			'bg-pink-500',
			'bg-indigo-500',
			'bg-cyan-500',
			'bg-teal-500',
			'bg-orange-500'
		];
		const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	}
	
	// Helper: Get initials from pubkey or display name
	function getInitials(pubkey: string, displayName?: string): string {
		if (displayName) {
			const parts = displayName.split(' ');
			if (parts.length > 1) {
				return (parts[0][0] + parts[1][0]).toUpperCase();
			}
			return displayName.substring(0, 2).toUpperCase();
		}
		
		// Fallback to pubkey
		return pubkey.slice(0, 2).toUpperCase();
	}
	
	// Helper: Get display name with fallback
	function getDisplayName(pubkey: string, displayName?: string): string {
		if (displayName) return displayName;
		
		// Truncate pubkey for display
		return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
	}
	
	// Helper: Get chopped pubkey for tooltip
	function getChoppedPubkey(pubkey: string): string {
		return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
	}
	
	// Helper: Convert hex pubkey to npub format
	function hexToNpub(hexPubkey: string): string {
		try {
			return nip19.npubEncode(hexPubkey);
		} catch (error) {
			console.warn('Failed to encode npub:', error);
			return hexPubkey; // Fallback to hex
		}
	}
	
	// Helper: Get chopped npub for display
	function getChoppedNpub(hexPubkey: string): string {
		const npub = hexToNpub(hexPubkey);
		return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
	}
	
	// Helper: Format time since last seen
	function getTimeSinceLastSeen(lastSeen: number): string {
		const seconds = Math.floor((Date.now() - lastSeen) / 1000);
		
		if (seconds < 30) return 'Gerade aktiv';
		if (seconds < 60) return 'Vor wenigen Sekunden';
		if (seconds < 120) return 'Vor 1 Minute';
		
		const minutes = Math.floor(seconds / 60);
		return `Vor ${minutes} Minuten`;
	}
</script>

{#if onlineUsers.length > 0}
	<Tooltip.Provider>
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-1">
				<!-- Small indicator text (optional, hidden on mobile) -->
				<span class="hidden sm:inline text-xs text-muted-foreground mr-1">
					Online:
				</span>
				
				<!-- Avatar Stack with Tooltips -->
				<div class="flex items-center -space-x-2">
					{#each visibleUsers as user (user.pubkey)}
					<Tooltip.Root>
						<Tooltip.Trigger 
							class="relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-110 hover:z-10 cursor-pointer border-2 border-background {getAvatarColor(user.pubkey)}"
						>
							{getInitials(user.pubkey, user.displayName)}
							
							<!-- Online indicator dot -->
							<div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full"></div>
						</Tooltip.Trigger>
					<Tooltip.Content class="bg-popover text-popover-foreground border border-border shadow-md">
						<div class="space-y-1.5 p-2">
							<p class="font-semibold text-sm text-foreground">{getDisplayName(user.pubkey, user.displayName)}</p>
							<p class="text-xs font-mono text-muted-foreground">{getChoppedNpub(user.pubkey)}</p>
							<p class="text-xs text-muted-foreground">{getTimeSinceLastSeen(user.lastSeen)}</p>
							</div>
						</Tooltip.Content>
					</Tooltip.Root>
				{/each}
				
				<!-- Overflow indicator -->
				{#if overflowCount > 0}
					<Tooltip.Root>
						<Tooltip.Trigger class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground bg-muted border-2 border-background transition-transform hover:scale-110 cursor-pointer">
							+{overflowCount}
						</Tooltip.Trigger>
						<Tooltip.Content class="bg-popover text-popover-foreground border border-border shadow-md">
							<p class="text-sm p-2">{overflowCount} weitere Nutzer online</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>
		</div>
	</div>
	</Tooltip.Provider>
{/if}

<style>
	/* Smooth transitions for avatar interactions */
	.flex.-space-x-2 > div {
		transition: transform 0.2s ease, z-index 0s ease;
	}
	
	.flex.-space-x-2 > div:hover {
		z-index: 20;
	}
</style>
