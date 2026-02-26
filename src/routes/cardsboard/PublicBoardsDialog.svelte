<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { getContext } from "svelte";
	import type NDK from "@nostr-dev-kit/ndk";
	import { NDKEvent } from "@nostr-dev-kit/ndk";
	import { nostrEventToBoard } from "$lib/utils/nostrEvents.js";
	import type { BoardProps } from "$lib/classes/BoardModel.js";
	import { goto } from "$app/navigation";
	import { nip19 } from "@nostr-dev-kit/ndk";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import UserIcon from "@lucide/svelte/icons/user";
	import CalendarIcon from "@lucide/svelte/icons/calendar";
	import TagIcon from "@lucide/svelte/icons/tag";
	import ColumnsIcon from "@lucide/svelte/icons/columns-3";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

	// Props
	let { open = $bindable(false) } = $props();

	// Get NDK from context
	const ndk = getContext<NDK>("ndk");

	// State
	let allBoards = $state<BoardProps[]>([]);
	let displayedBoards = $state<BoardProps[]>([]);
	let currentPage = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	
	const BOARDS_PER_PAGE = 20;

	// Fetch public boards when dialog opens
	// Use untrack to avoid running on mount
	$effect(() => {
		// Only fetch if explicitly opened by user
		if (open === true && allBoards.length === 0 && !isLoading) {
			fetchPublicBoards();
		}
	});

	async function fetchPublicBoards() {
		if (!ndk) {
			console.error("❌ NDK ist nicht verfügbar");
			error = "NDK ist nicht verfügbar";
			return;
		}

		console.log("🔍 NDK instance:", ndk);
		console.log("🔍 NDK pool:", ndk.pool);

		// Check if NDK is connected
		if (!ndk.pool || ndk.pool.connectedRelays().length === 0) {
			console.warn("⚠️ NDK is not connected to any relays yet, waiting...");
			// Wait a bit and try again
			await new Promise(resolve => setTimeout(resolve, 2000));
			if (!ndk.pool || ndk.pool.connectedRelays().length === 0) {
				error = "Keine Verbindung zu Relays. Bitte prüfe deine Relay-Einstellungen.";
				console.error("❌ No relay connections available");
				return;
			}
		}

		isLoading = true;
		error = null;
		allBoards = [];
		displayedBoards = [];
		currentPage = 0;

		try {
			console.log("🌐 Fetching public boards from relays...");
			console.log("🔗 Connected relays:", ndk.pool?.connectedRelays().length || 0);
			const connectedRelays = ndk.pool?.connectedRelays() || [];
			connectedRelays.forEach(relay => {
				console.log(`  - ${relay.url}`);
			});

			// Use subscription-based fetch with timeout (more reliable than fetchEvents)
			const fetchWithTimeout = async (filter: any, timeoutMs = 5000): Promise<Set<NDKEvent>> => {
				return new Promise((resolve, reject) => {
					const events = new Set<NDKEvent>();
					let eoseCount = 0;
					const totalRelays = connectedRelays.length;
					
					console.log(`⏱️  Starting subscription with ${timeoutMs}ms timeout...`);
					
					const sub = ndk.subscribe(filter, { closeOnEose: false });
					
					const cleanup = () => {
						console.log(`🛑 Cleaning up subscription (found ${events.size} events)`);
						sub.stop();
						clearTimeout(timeout);
					};
					
					sub.on('event', (event: NDKEvent) => {
						console.log(`📨 Received event from relay`);
						events.add(event);
					});
					
					sub.on('eose', () => {
						eoseCount++;
						console.log(`✅ EOSE ${eoseCount}/${totalRelays} | Events so far: ${events.size}`);
						
						// Wait for all relays to respond with EOSE
						if (eoseCount >= totalRelays) {
							cleanup();
							resolve(events);
						}
					});
					
					// Timeout fallback
					const timeout = setTimeout(() => {
						console.log(`⏰ Timeout reached (${timeoutMs}ms) with ${events.size} events`);
						cleanup();
						resolve(events);
					}, timeoutMs);
				});
			};

			// Try multiple approaches to fetch boards
			console.log("📋 Approach 1: Fetching with state filter...");
			const filter1 = {
				kinds: [30301] as number[],
				"#state": ["published"],
				limit: 100,
			} as any;
			
			console.log("📋 Filter 1:", JSON.stringify(filter1));

			let events = await fetchWithTimeout(filter1, 8000); // 8 second timeout
			console.log(`✅ Approach 1 found ${events.size} events`);

			// If no events, try without state filter
			if (events.size === 0) {
				console.log("📋 Approach 2: Fetching without state filter...");
				const filter2 = {
					kinds: [30301] as number[],
					limit: 100,
				} as any;
				
				events = await fetchWithTimeout(filter2, 8000);
				console.log(`✅ Approach 2 found ${events.size} events`);
				
				// Log states of found boards
				if (events.size > 0) {
					console.log("📊 Board states found:");
					for (const evt of events) {
						const stateTag = evt.tags.find(t => t[0] === 'state');
						const titleTag = evt.tags.find(t => t[0] === 'title');
						console.log(`  - "${titleTag?.[1] || 'unknown'}" | State: ${stateTag ? stateTag[1] : 'none'} | Author: ${evt.pubkey.slice(0, 8)}`);
					}
				}
			}

			if (events.size === 0) {
				error = "Keine Boards in den Relays gefunden";
				console.log("❌ No boards found in any approach");
				return;
			}

			// Convert events to board props
			const boards: BoardProps[] = [];
			let parseErrors = 0;
			
			for (const event of events) {
				try {
					const boardProps = nostrEventToBoard(event);
					console.log(`📝 Parsed board: "${boardProps.name}" | State: ${boardProps.publishState} | Author: ${(boardProps.author || '').slice(0, 8)}`);
					
					// Only include published boards (or if no state is set)
					if (!boardProps.publishState || boardProps.publishState === 'published') {
						boards.push(boardProps);
					} else {
						console.log(`   ⏭️  Skipping non-published board: ${boardProps.publishState}`);
					}
				} catch (err) {
					parseErrors++;
					console.warn("⚠️ Failed to parse board event:", err);
					console.warn("   Event:", event);
				}
			}

			if (parseErrors > 0) {
				console.warn(`⚠️ Failed to parse ${parseErrors} out of ${events.size} events`);
			}

			// Deduplicate boards by author-id combination
			const uniqueBoardsMap = new Map<string, BoardProps>();
			for (const board of boards) {
				const key = `${board.author}-${board.id}`;
				if (!uniqueBoardsMap.has(key)) {
					uniqueBoardsMap.set(key, board);
				}
			}
			const uniqueBoards = Array.from(uniqueBoardsMap.values());
			
			console.log(`🔄 Deduplicated: ${boards.length} boards → ${uniqueBoards.length} unique boards`);

			// Sort by newest first
			uniqueBoards.sort((a, b) => {
				const timeA = a.createdAt ?? 0;
				const timeB = b.createdAt ?? 0;
				return timeB - timeA;
			});

			allBoards = uniqueBoards;
			displayedBoards = uniqueBoards.slice(0, BOARDS_PER_PAGE);
			
			console.log(`✅ Loaded ${allBoards.length} public boards (displaying ${displayedBoards.length})`);
			
			if (allBoards.length === 0) {
				error = "Keine veröffentlichten Boards gefunden";
			}
		} catch (err) {
			console.error("❌ Failed to fetch public boards:", err);
			console.error("❌ Error stack:", err instanceof Error ? err.stack : 'no stack');
			error = err instanceof Error ? err.message : "Fehler beim Laden der Boards";
		} finally {
			isLoading = false;
		}
	}

	function loadMore() {
		const nextPage = currentPage + 1;
		const start = nextPage * BOARDS_PER_PAGE;
		const end = start + BOARDS_PER_PAGE;
		
		displayedBoards = [...displayedBoards, ...allBoards.slice(start, end)];
		currentPage = nextPage;
		
		console.log(`📄 Loaded page ${nextPage + 1}, now displaying ${displayedBoards.length} of ${allBoards.length} boards`);
	}

	function formatPubkey(pubkey: string): string {
		if (!pubkey) return "Unknown";
		return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
	}

	function formatDate(timestamp: number | undefined): string {
		if (!timestamp) return "Unknown";
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString("de-DE", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	async function openBoardViewer(board: BoardProps) {
		try {
			// Encode board to naddr for viewing
			const naddr = nip19.naddrEncode({
				kind: 30301,
				pubkey: board.author || "",
				identifier: board.id,
				relays: [],
			});

			// Navigate to viewer mode
			await goto(`/cardsboard/${naddr}`);
			open = false;
		} catch (err) {
			console.error("❌ Failed to open board:", err);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-4xl max-h-[85vh] flex flex-col">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<GlobeIcon class="h-5 w-5" />
				Öffentliche Boards
				{#if allBoards.length > 0}
					<Badge variant="secondary" class="ml-2">
						{displayedBoards.length} / {allBoards.length}
					</Badge>
				{/if}
			</Dialog.Title>
			<Dialog.Description class="flex items-center justify-between">
				<span>Entdecke veröffentlichte Boards aus dem Nostr-Netzwerk</span>
				{#if !isLoading}
					<Button onclick={fetchPublicBoards} variant="ghost" size="sm" class="gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
						Aktualisieren
					</Button>
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex-1 overflow-hidden">
			{#if isLoading}
				<!-- Loading State -->
				<div class="space-y-4 p-4">
					<div class="text-center text-muted-foreground mb-4">
						<p>Suche nach veröffentlichten Boards...</p>
					</div>
					{#each Array(3) as _}
						<div class="border rounded-lg p-4 space-y-3">
							<Skeleton class="h-6 w-3/4" />
							<Skeleton class="h-4 w-full" />
							<div class="flex gap-2">
								<Skeleton class="h-4 w-20" />
								<Skeleton class="h-4 w-20" />
							</div>
						</div>
					{/each}
				</div>
			{:else if error}
				<!-- Error State -->
				<div class="p-8 text-center">
					<div class="text-destructive mb-2 text-lg font-semibold">Fehler beim Laden der Boards</div>
					<p class="text-sm text-muted-foreground mb-4">{error}</p>
					<p class="text-xs text-muted-foreground mb-4">
						Bitte überprüfe deine Relay-Verbindungen in den Einstellungen.
					</p>
					<Button onclick={fetchPublicBoards} variant="default" class="mt-2">
						Erneut versuchen
					</Button>
				</div>
			{:else if allBoards.length === 0}
				<!-- Empty State -->
				<div class="p-8 text-center">
					<GlobeIcon class="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
					<p class="text-lg font-medium">Keine öffentlichen Boards gefunden</p>
					<p class="text-sm mt-2 text-muted-foreground">
						Es sind derzeit keine veröffentlichten Boards in den Relays verfügbar.
					</p>
					<Button onclick={fetchPublicBoards} variant="outline" class="mt-4">
						Erneut suchen
					</Button>
				</div>
			{:else}
				<!-- Boards Grid -->
				<div class="overflow-y-auto h-[calc(85vh-10rem)]">
					<div class="p-4 pb-24">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each displayedBoards as board (`${board.author}-${board.id}`)}
							<Card.Root class="hover:shadow-lg transition-shadow cursor-pointer group">
								<Card.Header>
									<Card.Title class="text-lg group-hover:text-primary transition-colors">
										{board.name}
									</Card.Title>
									{#if board.description}
										<Card.Description class="line-clamp-2">
											{board.description}
										</Card.Description>
									{/if}
								</Card.Header>

								<Card.Content class="space-y-3">
									<!-- Author -->
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<UserIcon class="h-4 w-4" />
										<span class="font-mono">{formatPubkey(board.author || "")}</span>
									</div>

									<!-- Columns Count -->
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<ColumnsIcon class="h-4 w-4" />
										<span>{board.columns?.length || 0} Spalten</span>
									</div>

									<!-- Created Date -->
									{#if board.createdAt}
										<div class="flex items-center gap-2 text-sm text-muted-foreground">
											<CalendarIcon class="h-4 w-4" />
											<span>{formatDate(board.createdAt)}</span>
										</div>
									{/if}

									<!-- Tags -->
									{#if board.tags && board.tags.length > 0}
										<div class="flex items-start gap-2">
											<TagIcon class="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
											<div class="flex flex-wrap gap-1">
												{#each board.tags.slice(0, 3) as tag}
													<Badge variant="secondary" class="text-xs">
														{tag}
													</Badge>
												{/each}
												{#if board.tags.length > 3}
													<Badge variant="outline" class="text-xs">
														+{board.tags.length - 3}
													</Badge>
												{/if}
											</div>
										</div>
									{/if}
								</Card.Content>

								<Card.Footer class="pt-3">
									<Button
										onclick={() => openBoardViewer(board)}
										class="w-full gap-2"
										variant="outline"
									>
										<EyeIcon class="h-4 w-4" />
										Board ansehen
									</Button>
								</Card.Footer>
							</Card.Root>
						{/each}
						</div>
						
						<!-- Load More Button -->
						{#if displayedBoards.length < allBoards.length}
							<div class="mt-4 text-center">
								<Button onclick={loadMore} variant="outline" class="gap-2">
									<ChevronDownIcon class="h-4 w-4" />
									Mehr laden ({allBoards.length - displayedBoards.length} weitere)
								</Button>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<Dialog.Footer class="border-t pt-4">
			<Button onclick={() => (open = false)} variant="outline">
				Schließen
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
