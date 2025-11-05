<!--
  🤖 ActionConfirmationDialog.svelte - User-Confirmation für AI-Aktionen
  
  Zeigt Dialog wenn AI-Action Confidence < Threshold
  User kann:
  - Action bestätigen (Execute & Learn → Confidence steigt)
  - Action ablehnen (Cancel → keine Änderung)
  - Action einmalig ausführen (Execute Once → keine Confidence-Änderung)
-->

<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import CheckIcon from '@lucide/svelte/icons/check';
  import XIcon from '@lucide/svelte/icons/x';
  import PlayIcon from '@lucide/svelte/icons/play';
  import type { AIAction } from '$lib/classes/BoardModel.js';
  
  // Props
  let { 
    open = $bindable(false),
    action,
    patternHash,
    currentConfidence,
    threshold,
    usageCount = 0,
    onConfirm,
    onCancel,
    onExecuteOnce
  }: {
    open?: boolean;
    action: AIAction;
    patternHash: string;
    currentConfidence: number;
    threshold: number;
    usageCount?: number;
    onConfirm: () => void;
    onCancel: () => void;
    onExecuteOnce: () => void;
  } = $props();
  
  // Berechne Confidence-Prozent
  let confidencePercent = $derived(Math.round(currentConfidence * 100));
  let thresholdPercent = $derived(Math.round(threshold * 100));
  
  // Confidence Color Coding
  let confidenceColor = $derived.by(() => {
    if (currentConfidence >= threshold) return 'text-green-500';
    if (currentConfidence >= threshold * 0.7) return 'text-orange-500';
    return 'text-red-500';
  });
  
  // Action Type Display
  let actionTypeDisplay = $derived.by(() => {
    switch (action.type) {
      case 'add_column': return '➕ Spalte hinzufügen';
      case 'add_card': return '➕ Karte hinzufügen';
      case 'split_card': return '📋 Karte aufteilen';
      case 'update_card': return '✏️ Karte bearbeiten';
      case 'move_card': return '🔄 Karte verschieben';
      default: return '🤖 AI-Aktion';
    }
  });
  
  // Action Preview Content
  let actionPreview = $derived.by(() => {
    if (action.type === 'add_column') {
      const name = (action as any).columnName || 'Unbenannt';
      const color = (action as any).color || 'slate';
      return `Spaltenname: ${name}\nFarbe: ${color}`;
    }
    if (action.type === 'add_card') {
      const heading = (action as any).heading || 'Unbenannt';
      const content = (action as any).content || '';
      return `Titel: ${heading}\nBeschreibung: ${content || '(leer)'}`;
    }
    if (action.type === 'split_card' && (action as any).newCards) {
      return (action as any).newCards
        .map((c: any, i: number) => `${i + 1}. ${c.heading}`)
        .join('\n');
    }
    if (action.type === 'move_card') {
      const fromCol = (action as any).fromColumnId || 'unbekannt';
      const toCol = (action as any).toColumnId || 'unbekannt';
      return `Von Spalte: ${fromCol}\nNach Spalte: ${toCol}`;
    }
    if (action.type === 'update_card') {
      const updates = (action as any).updates || {};
      return Object.entries(updates)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    }
    return JSON.stringify(action, null, 2);
  });
  
  // Handle-Funktionen mit Dialog-Close
  function handleConfirm() {
    onConfirm();
    open = false;
  }
  
  function handleCancel() {
    onCancel();
    open = false;
  }
  
  function handleExecuteOnce() {
    onExecuteOnce();
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-lg min-w-[800px]">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <BrainIcon class="h-5 w-5" />
        AI-Aktion bestätigen
      </Dialog.Title>
      <Dialog.Description>
        Diese Aktion hat noch nicht genügend Confidence für Auto-Ausführung
      </Dialog.Description>
    </Dialog.Header>
    
    <!-- Action Type Badge -->
    <div class="flex items-center gap-2">
      <Badge variant="outline" class="text-sm">
        {actionTypeDisplay}
      </Badge>
      <Badge variant="secondary" class="text-xs font-mono">
        {patternHash}
      </Badge>
    </div>
    
    <Separator />
    
    <!-- Confidence Progress -->
    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span>Confidence Level</span>
        <span class={confidenceColor + ' font-semibold'}>
          {confidencePercent}%
        </span>
      </div>
      <!-- Simple Progress Bar -->
      <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div 
          class="h-full transition-all duration-300 {currentConfidence >= threshold ? 'bg-green-500' : currentConfidence >= threshold * 0.7 ? 'bg-orange-500' : 'bg-red-500'}"
          style="width: {confidencePercent}%"
        ></div>
      </div>
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>Threshold: {thresholdPercent}%</span>
        <span>Verwendungen: {usageCount}x</span>
      </div>
    </div>
    
    <Separator />
    
    <!-- Action Preview -->
    <div class="space-y-2">
      <Label class="text-sm font-medium">Aktion Vorschau</Label>
      <div class="bg-muted p-4 rounded-lg">
        <pre class="text-xs font-mono whitespace-pre-wrap">{actionPreview}</pre>
      </div>
    </div>
    
    <!-- Learning System Explanation -->
    <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
      <p class="text-xs text-muted-foreground">
        <strong>🧠 Learning System:</strong> Wenn Sie diese Aktion bestätigen, 
        lernt die AI aus Ihrer Entscheidung. Bei wiederholter Bestätigung steigt 
        die Confidence und zukünftige ähnliche Aktionen werden automatisch ausgeführt.
      </p>
      <p class="text-xs text-muted-foreground">
        <strong>Aktuell:</strong> Nach {Math.ceil((threshold - currentConfidence) / 0.15)} weiteren 
        Bestätigungen wird diese Art von Aktion auto-ausgeführt.
      </p>
    </div>
    
    <Separator />
    
    <!-- Action Buttons -->
    <Dialog.Footer class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
      <!-- Cancel Button -->
      <Button variant="ghost" onclick={handleCancel} class="mt-2 sm:mt-0">
        <XIcon class="mr-2 h-4 w-4" />
        Abbrechen
      </Button>
      
      <!-- Execute Once Button -->
      <Button variant="outline" onclick={handleExecuteOnce}>
        <PlayIcon class="mr-2 h-4 w-4" />
        Einmalig ausführen
      </Button>
      
      <!-- Execute & Learn Button -->
      <Button variant="default" onclick={handleConfirm}>
        <CheckIcon class="mr-2 h-4 w-4" />
        Ausführen & Lernen
      </Button>
    </Dialog.Footer>
    
  </Dialog.Content>
</Dialog.Root>
