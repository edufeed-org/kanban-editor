<!--
  OER Result Card Component
  
  Zeigt ein einzelnes OER-Suchergebnis mit:
  - Titel, Beschreibung, Typ, Publisher/Creator
  - Klickbarer Link (öffnet in neuem Tab)
  - "Als Karte hinzufügen" Button
  
  @see docs/FEATURE/MCP-EDUFEED.md
-->
<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import type { OerResultData } from '$lib/classes/ChatModel.js';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  import { toast } from 'svelte-sonner';

  // Props
  let { 
    result,
    targetColumnId = ''
  }: { 
    result: OerResultData;
    targetColumnId?: string;
  } = $props();

  // State
  let isAdding = $state(false);

  /**
   * Fügt das OER-Ergebnis als neue Karte hinzu
   */
  async function addAsCard() {
    if (!targetColumnId) {
      // Finde erste Spalte als Fallback
      const columns = boardStore.uiData;
      if (columns.length === 0) {
        toast.error('Kein Board geladen. Bitte erst ein Board öffnen.');
        return;
      }
      targetColumnId = columns[0].id;
    }

    isAdding = true;
    try {
      // Publisher/Creator für Author-Info
      const authorInfo = result.publisher || result.creator || result.source;
      
      // Beschreibung mit Link am Ende
      const content = [
        result.description || '',
        '',
        `📎 Typ: ${result.type}`,
        `👤 ${authorInfo}`,
        result.license ? `⚖️ ${result.license}` : '',
        '',
        `🔗 ${result.url}`
      ].filter(Boolean).join('\n');

      // Labels aus Typ und Lizenz
      const labels: string[] = ['OER'];
      if (result.type) labels.push(result.type);
      if (result.license) labels.push(result.license);

      // Karte erstellen über boardStore
      const cardId = boardStore.createCard(
        targetColumnId,
        result.title,
        content
      );

      // Bild und Labels hinzufügen falls vorhanden
      if (cardId) {
        boardStore.editCard(cardId, {
          image: result.image,
          labels,
          links: result.url ? [{ id: crypto.randomUUID(), url: result.url, title: result.title }] : []
        });
      }

      toast.success(`"${result.title}" als Karte hinzugefügt!`);
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      toast.error('Fehler beim Erstellen der Karte');
    } finally {
      isAdding = false;
    }
  }

  // Computed
  const authorInfo = $derived(result.publisher || result.creator || result.source);
</script>

<Card.Root class="mb-2 hover:shadow-md transition-shadow">
  <Card.Content class="p-3">
    <!-- Header: Nummer + Titel -->
    <div class="flex items-start justify-between gap-2 mb-1">
      <div class="flex items-start gap-2 flex-1 min-w-0">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
          {result.number}
        </span>
        <h4 class="text-sm font-medium leading-tight truncate" title={result.title}>
          {result.title}
        </h4>
      </div>
    </div>

    <!-- Beschreibung -->
    {#if result.description}
      <p class="text-xs text-muted-foreground mb-2 line-clamp-2">
        {result.description}
      </p>
    {/if}

    <!-- Meta-Info -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground mb-2">
      <span>📎 {result.type}</span>
      <span>👤 {authorInfo}</span>
      {#if result.license}
        <span>⚖️ {result.license}</span>
      {/if}
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <!-- Link Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-7 text-xs flex-1"
        onclick={() => window.open(result.url, '_blank', 'noopener,noreferrer')}
      >
        <ExternalLinkIcon class="h-3 w-3 mr-1" />
        Öffnen
      </Button>

      <!-- Add as Card Button -->
      <Button
        variant="default"
        size="sm"
        class="h-7 text-xs flex-1"
        disabled={isAdding}
        onclick={addAsCard}
      >
        {#if isAdding}
          <span class="animate-spin mr-1">⏳</span>
        {:else}
          <PlusIcon class="h-3 w-3 mr-1" />
        {/if}
        Als Karte
      </Button>
    </div>
  </Card.Content>
</Card.Root>
