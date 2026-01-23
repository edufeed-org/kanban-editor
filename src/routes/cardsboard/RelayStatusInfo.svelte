<script lang="ts">
	import * as Popover from "$lib/components/ui/popover";
	import { Card } from "$lib/components/ui/card";
	import WifiIcon from "@lucide/svelte/icons/wifi";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import { getSyncManager } from "$lib/stores/syncManager.svelte";
	import { onMount, onDestroy } from "svelte";
    import { NDKRelayStatus } from "@nostr-dev-kit/ndk";

	// Local state
	let showPopover = $state(false);
	let relayDetails = $state<Array<{ url: string; connected: boolean; connecting?: boolean; error?: string }>>([]);
	let connectedCount = $state(0);
	let totalCount = $state(0);
	let isReconnecting = $state(false);
	let pollIntervalId: number | undefined;

	onMount(() => {
		pollIntervalId = window.setInterval(() => {
			updateRelayDetails();
		}, 5000);
		
		// Initial fetch
		updateRelayDetails();
	});

	onDestroy(() => {
		if (pollIntervalId) {
			clearInterval(pollIntervalId);
		}
	});

	function updateRelayDetails() {
		try {
			const syncManager = getSyncManager();
			const ndk = syncManager.ndk;
			
			if (ndk?.pool?.relays) {
				const relayMap = ndk.pool.relays;
				
				const relays = Array.from(relayMap.values());
				
				totalCount = relays.length;
				connectedCount = relays.filter(r => r.status === NDKRelayStatus.CONNECTED).length;
				
				relayDetails = relays.map((relay) => {
					const isConnected = relay.status === NDKRelayStatus.CONNECTED;
					const isConnecting = relay.status === NDKRelayStatus.CONNECTING;
					
					return {
						url: relay.url,
						connected: isConnected,
						connecting: isConnecting,
						error: relay.status === NDKRelayStatus.DISCONNECTING ? 'Connection failed' : 
						       relay.status === NDKRelayStatus.DISCONNECTED ? 'Disconnected' : 
						       relay.status === NDKRelayStatus.CONNECTING ? 'Connecting...' : undefined
					};
				});
			
			} else {
				relayDetails = [];
				totalCount = 0;
				connectedCount = 0;
			}
		} catch (error) {
			console.warn('[RelayStatusInfo] Could not fetch relay details:', error);
			relayDetails = [];
		}
	}

	function handleReconnect() {
		console.log('[RelayStatusInfo] Reconnect requested');
		isReconnecting = true;
		
		const syncManager = getSyncManager();
		const ndk = syncManager.ndk;
		
		if (ndk.pool) {
			ndk.pool.relays.forEach(async (relay) => {
				if (relay.status !== NDKRelayStatus.CONNECTED) { 
					await relay.connect(5000).catch((err: any) => {
						console.error(`Failed to reconnect to ${relay.url}:`, err);
					});
				}
			});
		}

		updateRelayDetails();
		isReconnecting = false;
	}
</script>

<Popover.Root bind:open={showPopover}>
	<Popover.Trigger>
		<button
			type="button"
			class="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
			aria-label="Server status: {connectedCount} of {totalCount} servers connected"
		>
			{#if connectedCount > 0}
				<WifiIcon class="h-4 w-4 text-green-500" aria-hidden="true" />
			{:else}
				<WifiOffIcon class="h-4 w-4 text-red-500" aria-hidden="true" />
			{/if}
			<span class="text-xs" aria-hidden="true">
				{connectedCount}/{totalCount}
			</span>
		</button>
	</Popover.Trigger>
	
	<Popover.Content class="w-80" align="end" role="dialog" aria-labelledby="relay-status-heading">
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<h4 class="font-semibold" id="relay-status-heading">Relay Status</h4>
				<button
					type="button"
					class="text-xs px-2 py-1 rounded hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleReconnect}
					disabled={isReconnecting}
					aria-label={isReconnecting ? 'Reconnecting to relays...' : 'Reconnect to all relays'}
				>
					<RefreshCwIcon class="h-3 w-3 inline mr-1 {isReconnecting ? 'animate-spin' : ''}" aria-hidden="true" />
					Reconnect
				</button>
			</div>
			
			<div class="text-sm text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
				{connectedCount} of {totalCount} servers connected
			</div>
			
			{#if relayDetails.length === 0}
				<div class="text-sm text-muted-foreground py-4 text-center" role="status">
					Keine Relays konfiguriert
				</div>
			{:else}
				<ul class="space-y-2" role="list" aria-label="Relay connections">
					{#each relayDetails as relay, index}
						<li>
							<Card class="p-3">
								<div class="flex items-start gap-2">
									<div class="mt-0.5" aria-hidden="true">
										{#if relay.connected}
											<CheckCircleIcon class="h-4 w-4 text-green-500" />
										{:else}
											<XCircleIcon class="h-4 w-4 text-red-500" />
										{/if}
									</div>
									<div class="flex-1 min-w-0">
									<div class="text-sm font-medium truncate" title={relay.url}>
											{relay.url}
										</div>
										<div class="sr-only">
											Relay {index + 1} of {relayDetails.length}: {relay.connected ? 'Connected' : 'Disconnected'}
										</div>
										{#if relay.error}
											<div class="text-xs text-muted-foreground" role="alert">
												{relay.error}
											</div>
										{/if}
									</div>
								</div>
							</Card>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>

