<script lang="ts">
  import {
    Root as DialogRoot,
    Content as DialogContent,
    Description as DialogDescription,
    Footer as DialogFooter,
    Header as DialogHeader,
    Title as DialogTitle
  } from "$lib/components/ui/dialog/index.js";
  import {
    Root as TabsRoot,
    Content as TabsContent,
    List as TabsList,
    Trigger as TabsTrigger
  } from "$lib/components/ui/tabs/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import type { ConflictingField, MergeResolutionWithCustom } from "$lib/utils/mergeEngine.ts";

  // ✅ KRITISCH: Svelte 5 Pattern - let { } = $props(), NICHT export let!
  let {
    open = false,
    conflicts = [],
    onResolve = null,
    onCancel = null
  } = $props<{
    open?: boolean;
    conflicts?: ConflictingField[];
    onResolve?: ((resolution: MergeResolutionWithCustom) => void) | null;
    onCancel?: (() => void) | null;
  }>();

  // Lokale State: User-Auswahl für jeden Konflikt
  let resolutions = $state<Record<string, 'mine' | 'theirs' | 'merged'>>({});

  // Initialize resolutions
  $effect(() => {
    if (open && conflicts.length > 0) {
      resolutions = {};
      for (const c of conflicts) {
        resolutions[c.field as string] = 'mine'; // Default: meine Version
      }
    }
  });

  // Format field value for display
  function formatValue(value: any): string {
    if (typeof value === 'string') {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
    if (Array.isArray(value)) {
      return value.join(', ') || '(leer)';
    }
    return JSON.stringify(value) || '(leer)';
  }

  // Resolve conflict
  function handleResolve() {
    if (onResolve) {
      onResolve({
        resolution: resolutions,
        customValues: {}
      });
    }
    open = false;
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    open = false;
  }
</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-3xl max-h-[90vh] overflow-hidden">
    <DialogHeader>
      <DialogTitle class="flex items-center gap-2">
        <AlertCircleIcon class="h-5 w-5 text-amber-500" />
        Merge-Konflikt erkannt
      </DialogTitle>
      <DialogDescription>
        Paul hat diese Karte in der Zwischenzeit auch bearbeitet.
        <br />
        Wähle, welche Änderung du behalten möchtest.
      </DialogDescription>
    </DialogHeader>

    <!-- Tabs für jeden Konflikt -->
    <div class="overflow-y-auto max-h-[calc(90vh-200px)]">
      <TabsRoot value={conflicts[0]?.field || ''}>
        <!-- Tab-Liste -->
        <TabsList class="grid w-full" style={`grid-template-columns: repeat(${Math.min(conflicts.length, 4)}, 1fr)`}>
          {#each conflicts as conflict (conflict.field)}
            <TabsTrigger value={conflict.field as string} class="text-xs">
              {conflict.field}
            </TabsTrigger>
          {/each}
        </TabsList>

        <!-- Tab-Inhalte -->
        {#each conflicts as conflict (conflict.field)}
          <TabsContent value={conflict.field as string} class="space-y-4 mt-4">
            <!-- Grid: 3 Spalten (Base, Mine, Theirs) -->
            <div class="grid grid-cols-3 gap-3">
              <!-- Column 1: Original (Basis) -->
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-slate-600">Original (Basis)</h4>
                <div class="bg-slate-50 border border-slate-200 p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                  {formatValue(conflict.baseVersion)}
                </div>
              </div>

              <!-- Column 2: My Version (Meine Änderung) -->
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-blue-600">🔵 Meine Änderung</h4>
                <div class="bg-blue-50 border-2 border-blue-200 p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                  {formatValue(conflict.myVersion)}
                </div>
                <Button
                  variant={resolutions[conflict.field as string] === 'mine' ? 'default' : 'outline'}
                  size="sm"
                  class="w-full text-xs"
                  onclick={() => (resolutions[conflict.field as string] = 'mine')}
                >
                  <CheckIcon class="h-3 w-3 mr-1" />
                  Diese Version
                </Button>
              </div>

              <!-- Column 3: Their Version (Pauls Änderung) -->
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-green-600">🟢 Pauls Änderung</h4>
                <div class="bg-green-50 border-2 border-green-200 p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                  {formatValue(conflict.theirVersion)}
                </div>
                <Button
                  variant={resolutions[conflict.field as string] === 'theirs' ? 'default' : 'outline'}
                  size="sm"
                  class="w-full text-xs"
                  onclick={() => (resolutions[conflict.field as string] = 'theirs')}
                >
                  <CheckIcon class="h-3 w-3 mr-1" />
                  Diese Version
                </Button>
              </div>
            </div>

            <!-- Auto-Merged Result (wenn verfügbar) -->
            {#if conflict.mergeResult?.resolved}
              <div class="space-y-2 border-t pt-3">
                <h4 class="text-xs font-semibold text-purple-600">
                  🟣 Auto-Merged Vorschlag
                </h4>
                <div class="bg-purple-50 border-2 border-purple-200 p-3 rounded text-xs font-mono whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                  {formatValue(conflict.mergeResult.result)}
                </div>
                <Button
                  variant={resolutions[conflict.field as string] === 'merged' ? 'default' : 'outline'}
                  size="sm"
                  class="w-full text-xs"
                  onclick={() => (resolutions[conflict.field as string] = 'merged')}
                >
                  <CheckIcon class="h-3 w-3 mr-1" />
                  Merged Version
                </Button>
              </div>
            {:else if conflict.mergeResult?.conflicts && conflict.mergeResult.conflicts.length > 0}
              <div class="space-y-2 border-t pt-3">
                <h4 class="text-xs font-semibold text-red-600">⚠️ Konflikt-Details</h4>
                <ul class="text-xs space-y-1 text-slate-600">
                  {#each conflict.mergeResult.conflicts as msg}
                    <li class="flex gap-2">
                      <XIcon class="h-3 w-3 flex-shrink-0 mt-0.5 text-red-500" />
                      <span>{msg}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <!-- Conflict Percentage -->
            <div class="text-xs text-slate-500 italic">
              Feld: {conflict.field} (Konflikt-Typ: beide haben geändert)
            </div>
          </TabsContent>
        {/each}
      </TabsRoot>
    </div>

    <!-- Dialog-Footer -->
    <DialogFooter class="gap-2">
      <Button variant="outline" onclick={handleCancel}>
        <XIcon class="h-4 w-4 mr-2" />
        Abbrechen (nicht speichern)
      </Button>
      <Button onclick={handleResolve}>
        <CheckIcon class="h-4 w-4 mr-2" />
        Speichern mit Lösungen
      </Button>
    </DialogFooter>

    <!-- Summary Stats -->
    <div class="text-xs text-slate-600 border-t pt-2">
      Konflikte: {conflicts.length} Feld{conflicts.length !== 1 ? 'er' : ''} betroffen
    </div>
  </DialogContent>
</DialogRoot>
