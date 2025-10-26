<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import MergeTestDialog from "./MergeTestDialog.svelte";
  import { 
    threeWayMerge, 
    type ConflictingField, 
    type MergeResolutionWithCustom 
  } from "../../../lib/utils/mergeEngine.js";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import PlayIcon from "@lucide/svelte/icons/play";

  // Test Szenarien
  interface TestScenario {
    name: string;
    description: string;
    base: any;
    mine: any;
    theirs: any;
    expectedConflicts: number;
  }

  const scenarios: TestScenario[] = [
    {
      name: "Keine Konflikte",
      description: "Base + unterschiedliche nicht-überlappende Änderungen",
      base: {
        id: "card-1",
        heading: "Original Karte",
        content: "Original Inhalt",
        labels: [],
        updatedAt: "2025-10-26T10:00:00Z"
      },
      mine: {
        id: "card-1",
        heading: "Meine Karte",
        content: "Original Inhalt",
        labels: ["urgent"],
        updatedAt: "2025-10-26T10:05:00Z"
      },
      theirs: {
        id: "card-1",
        heading: "Original Karte",
        content: "Paul hat Inhalt geändert",
        labels: [],
        updatedAt: "2025-10-26T10:04:00Z"
      },
      expectedConflicts: 0
    },
    {
      name: "Konflikt im Feld 'heading'",
      description: "Beide haben den Titel geändert",
      base: {
        id: "card-2",
        heading: "Original Titel",
        content: "Inhalt",
        labels: [],
        updatedAt: "2025-10-26T10:00:00Z"
      },
      mine: {
        id: "card-2",
        heading: "Mein neuer Titel",
        content: "Inhalt",
        labels: [],
        updatedAt: "2025-10-26T10:05:00Z"
      },
      theirs: {
        id: "card-2",
        heading: "Pauls neuer Titel",
        content: "Inhalt",
        labels: [],
        updatedAt: "2025-10-26T10:04:00Z"
      },
      expectedConflicts: 1
    },
    {
      name: "Mehrere Konflikte",
      description: "Sowohl Titel als auch Content geändert",
      base: {
        id: "card-3",
        heading: "Original",
        content: "Original Content",
        labels: ["todo"],
        updatedAt: "2025-10-26T10:00:00Z"
      },
      mine: {
        id: "card-3",
        heading: "Mein Titel",
        content: "Mein Content",
        labels: ["in-progress"],
        updatedAt: "2025-10-26T10:05:00Z"
      },
      theirs: {
        id: "card-3",
        heading: "Pauls Titel",
        content: "Pauls Content",
        labels: ["done"],
        updatedAt: "2025-10-26T10:04:00Z"
      },
      expectedConflicts: 3
    },
    {
      name: "Array Merge (Labels)",
      description: "Unterschiedliche Labels, sollten zusammengefasst werden",
      base: {
        id: "card-4",
        heading: "Karte",
        content: "Inhalt",
        labels: [],
        updatedAt: "2025-10-26T10:00:00Z"
      },
      mine: {
        id: "card-4",
        heading: "Karte",
        content: "Inhalt",
        labels: ["urgent", "review"],
        updatedAt: "2025-10-26T10:05:00Z"
      },
      theirs: {
        id: "card-4",
        heading: "Karte",
        content: "Inhalt",
        labels: ["urgent", "needs-help"],
        updatedAt: "2025-10-26T10:04:00Z"
      },
      expectedConflicts: 1
    }
  ];

  // State
  let selectedScenario: TestScenario | null = null;
  let mergeResult: any = null;
  let showDialog = false;
  let testLog: string[] = [];

  function runMergeTest(scenario: TestScenario) {
    selectedScenario = scenario;
    testLog = [];
    addLog(`🔄 Starte Merge-Test: ${scenario.name}`);
    addLog(`Base: ${JSON.stringify(scenario.base, null, 2)}`);
    addLog(`Mine: ${JSON.stringify(scenario.mine, null, 2)}`);
    addLog(`Theirs: ${JSON.stringify(scenario.theirs, null, 2)}`);

    try {
      mergeResult = threeWayMerge(scenario.base, scenario.mine, scenario.theirs);
      addLog(`✅ Merge erfolgreich`);
      addLog(`Konflikte: ${mergeResult.conflicts?.length || 0}`);
      
      if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
        addLog(`📋 Konflikt-Details:`);
        mergeResult.conflicts.forEach((conflict: ConflictingField, idx: number) => {
          addLog(`  ${idx + 1}. Feld "${conflict.field}"`);
          addLog(`     Base: ${JSON.stringify(conflict.baseVersion)}`);
          addLog(`     Mine: ${JSON.stringify(conflict.myVersion)}`);
          addLog(`     Theirs: ${JSON.stringify(conflict.theirVersion)}`);
        });
      } else {
        addLog(`✨ Kein Konflikt - Auto-Merged erfolgreich:`);
        addLog(`${JSON.stringify(mergeResult.result, null, 2)}`);
      }
    } catch (error) {
      addLog(`❌ Fehler: ${error}`);
    }
  }

  function addLog(msg: string) {
    testLog = [...testLog, msg];
  }

  function handleResolve(resolution: MergeResolutionWithCustom) {
    addLog(`✅ Benutzer hat Konflikte aufgelöst:`);
    addLog(`Resolution: ${JSON.stringify(resolution.resolution, null, 2)}`);
    showDialog = false;
  }

  function openConflictDialog() {
    if (mergeResult?.conflicts && mergeResult.conflicts.length > 0) {
      showDialog = true;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-slate-900 mb-2">🔀 Merge-System Test</h1>
      <p class="text-lg text-slate-600">Interaktive Tests für 3-Way Merge Algorithmus</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Linke Seite: Test Szenarien -->
      <div class="lg:col-span-1 space-y-4">
        <h2 class="text-2xl font-semibold text-slate-900">Test Szenarien</h2>
        {#each scenarios as scenario (scenario.name)}
          <Card.Root 
            class="cursor-pointer transition-all hover:shadow-lg {selectedScenario?.name === scenario.name ? 'ring-2 ring-blue-500' : ''}"
            onclick={() => runMergeTest(scenario)}
          >
            <Card.Header class="pb-3">
              <Card.Title class="text-sm flex items-center gap-2">
                <PlayIcon class="h-4 w-4" />
                {scenario.name}
              </Card.Title>
              <Card.Description class="text-xs">
                {scenario.description}
              </Card.Description>
            </Card.Header>
            <Card.Footer class="pt-2">
              <Badge variant="outline" class="text-xs">
                {scenario.expectedConflicts} erwartet
              </Badge>
            </Card.Footer>
          </Card.Root>
        {/each}
      </div>

      <!-- Rechte Seite: Ergebnisse -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Merge-Ergebnis Visualisierung -->
        {#if mergeResult}
          <Card.Root class="border-2 {mergeResult.conflicts?.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}">
            <Card.Header>
              <Card.Title class="flex items-center gap-2 {mergeResult.conflicts?.length > 0 ? 'text-amber-900' : 'text-green-900'}">
                {#if mergeResult.conflicts?.length > 0}
                  <AlertCircleIcon class="h-5 w-5" />
                  {mergeResult.conflicts.length} Konflikt{mergeResult.conflicts.length > 1 ? 'e' : ''} erkannt
                {:else}
                  <CheckIcon class="h-5 w-5" />
                  ✨ Erfolgreich gemergt (keine Konflikte)
                {/if}
              </Card.Title>
            </Card.Header>

            <!-- Konflikt-Liste oder Merged Result -->
            <Card.Content class="space-y-4">
              {#if mergeResult.conflicts?.length > 0}
                <!-- Konflikte anzeigen -->
                {#each mergeResult.conflicts as conflict, idx (conflict.field)}
                  <div class="border border-amber-200 rounded p-3 space-y-2">
                    <h4 class="font-semibold text-amber-900">Feld: {conflict.field}</h4>
                    <div class="grid grid-cols-3 gap-2 text-xs">
                      <div class="bg-slate-100 p-2 rounded">
                        <p class="font-semibold text-slate-600">Original</p>
                        <p class="font-mono break-words">{JSON.stringify(conflict.baseVersion)}</p>
                      </div>
                      <div class="bg-blue-100 p-2 rounded">
                        <p class="font-semibold text-blue-700">🔵 Meine</p>
                        <p class="font-mono break-words">{JSON.stringify(conflict.myVersion)}</p>
                      </div>
                      <div class="bg-green-100 p-2 rounded">
                        <p class="font-semibold text-green-700">🟢 Pauls</p>
                        <p class="font-mono break-words">{JSON.stringify(conflict.theirVersion)}</p>
                      </div>
                    </div>
                  </div>
                {/each}

                <Button class="w-full" onclick={openConflictDialog}>
                  <CheckIcon class="h-4 w-4 mr-2" />
                  Konflikte manuell auflösen
                </Button>
              {:else}
                <!-- Auto-Merged Result -->
                <div class="bg-slate-100 p-4 rounded font-mono text-xs overflow-auto max-h-64">
                  <pre>{JSON.stringify(mergeResult.result, null, 2)}</pre>
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        {/if}

        <!-- Test Log -->
        <Card.Root>
          <Card.Header>
            <Card.Title>📋 Test-Protokoll</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="bg-slate-900 text-slate-100 p-4 rounded font-mono text-xs h-64 overflow-y-auto space-y-1">
              {#if testLog.length === 0}
                <p class="text-slate-500">Wähle ein Szenario aus, um Test zu starten...</p>
              {:else}
                {#each testLog as log}
                  <div class="whitespace-pre-wrap break-words">{log}</div>
                {/each}
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  </div>
</div>

<!-- Merge Conflict Resolution Dialog -->
{#if showDialog && mergeResult?.conflicts}
  <MergeTestDialog 
    open={showDialog}
    conflicts={mergeResult.conflicts}
    onResolve={handleResolve}
    onCancel={() => { showDialog = false; }}
  />
{/if}
