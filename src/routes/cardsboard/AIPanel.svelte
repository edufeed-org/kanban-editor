<!--
  🤖 AIPanel.svelte - AI-Agent Interface in rechter Sidebar
  
  Features:
  - Chat-Interface für AI-Interaktion
  - Zeigt AI-Action-Vorschläge
  - Integriert ActionConfirmationDialog
  - Zeigt Learned Patterns Status
-->

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import ActionConfirmationDialog from '$lib/components/ui/ActionConfirmationDialog.svelte';
  import { chatStore } from '$lib/stores/chatStore.svelte.js';
  import { userPreferencesStore } from '$lib/stores/userPreferencesStore.svelte.js';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import SendIcon from '@lucide/svelte/icons/send';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
  import type { AIAction } from '$lib/classes/BoardModel.js';
  
  // Props
  let {
    boardId
  }: {
    boardId: string;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // Action Confirmation Dialog State
  let showConfirmDialog = $state(false);
  let pendingAction = $state<AIAction | null>(null);
  let pendingPatternHash = $state('');
  let pendingConfidence = $state(0);
  let pendingUsageCount = $state(0);
  
  // Chat Messages (derived from chatStore)
  let messages = $derived(chatStore.messages);
  
  // 🔥 WICHTIG: Lade Chat-Session wenn boardId sich ändert
  // Guard: Verhindere Endlosschleife durch Tracking der letzten geladenen ID
  let lastLoadedBoardId = $state<string | null>(null);
  
  $effect(() => {
    if (boardId !== lastLoadedBoardId) {
      console.log('🤖 AIPanel: Lade Chat-Session für Board:', boardId);
      chatStore.loadSession(boardId);
      lastLoadedBoardId = boardId;
    }
  });
  
  // Learning Stats (echte Werte von UserPreferencesStore)
  let learnedPatternsCount = $derived(userPreferencesStore.getAllLearnedPatterns().size);
  
  let confidenceThreshold = $derived(
    settingsStore.settings.learningConfidenceThreshold
  );
  
  // Auto-Executable Patterns Count (Patterns mit confidence >= threshold)
  let autoExecutableCount = $derived.by(() => {
    let count = 0;
    for (const [_, pattern] of userPreferencesStore.getAllLearnedPatterns()) {
      if (pattern.confidence >= confidenceThreshold) {
        count++;
      }
    }
    return count;
  })
  
  /**
   * Handle user message send
   */
  async function handleSendMessage() {
    if (!userInput.trim() || isProcessing) return;
    
    const message = userInput.trim();
    userInput = '';
    isProcessing = true;
    
    try {
      // Add user message
      chatStore.addMessage(message, 'user');
      
      // Send to AI (simulated - in real app, this would call your AI API)
      await simulateAIResponse(message);
      
    } catch (error) {
      console.error('AI Error:', error);
      chatStore.addMessage(
        'Entschuldigung, es gab einen Fehler bei der Verarbeitung.',
        'assistant'
      );
    } finally {
      isProcessing = false;
    }
  }
  
  /**
   * Send message to LLM and process response
   */
  async function simulateAIResponse(userMessage: string) {
    // 🔍 DEBUG: Log user message
    console.log('🔍 User Message:', userMessage);
    console.log('🔍 Contains "aufteilen"?', userMessage.toLowerCase().includes('aufteilen'));
    console.log('🔍 Contains "split"?', userMessage.toLowerCase().includes('split'));
    
    // Get board context for AI
    const boardContext = boardStore.getContextData(false); // false = summary only
    
    // Send to LLM
    const { content, error } = await chatStore.sendToLLM(userMessage, boardContext);
    
    if (error) {
      chatStore.addMessage(error, 'assistant');
      return;
    }
    
    // Add LLM response
    chatStore.addMessage(content, 'assistant');
    
    // Check if user asks for card splitting (example pattern for learning system)
    if (userMessage.toLowerCase().includes('aufteilen') || 
        userMessage.toLowerCase().includes('split')) {
      
      console.log('🎯 "aufteilen" keyword detected! Preparing action...');
      
      // Create mock AI action
      const action: AIAction = {
        type: 'split_card',
        sourceCardId: 'mock-card-id',
        columnId: 'mock-column-id',
        newCards: [
          { heading: 'Subtask 1: Frontend' },
          { heading: 'Subtask 2: Backend' },
          { heading: 'Subtask 3: Testing' }
        ]
      };
      
      // Check confidence
      const result = await chatStore.checkActionConfidence(action);
      
      console.log('🎯 Confidence check result:', result);
      
      if (result.shouldAutoExecute) {
        // Auto-execute
        chatStore.addMessage(
          '✅ Aktion wird automatisch ausgeführt (Confidence: ' + 
          Math.round(result.confidence * 100) + '%).',
          'assistant'
        );
        
        // Execute action (placeholder)
        executeAction(action);
        
        // Record success
        chatStore.recordActionSuccess(result.patternHash, true);
        
      } else {
        // Show confirmation dialog
        chatStore.addMessage(
          '🤔 Ich schlage vor, die Karte in 3 Subtasks aufzuteilen. ' +
          'Confidence: ' + Math.round(result.confidence * 100) + '%. ' +
          'Möchten Sie bestätigen?',
          'assistant'
        );
        
        // Prepare dialog
        pendingAction = action;
        pendingPatternHash = result.patternHash;
        pendingConfidence = result.confidence;
        pendingUsageCount = result.usageCount;
        showConfirmDialog = true;
        
        console.log('🎯 Confirmation dialog prepared, showing...');
      }
    }
  }
  
  /**
   * Execute AI action (placeholder - implement with boardStore)
   */
  function executeAction(action: AIAction) {
    console.log('🤖 Executing action:', action);
    
    // TODO: Implement real action execution via boardStore
    // Example:
    // if (action.type === 'split_card') {
    //   boardStore.splitCard(action.columnId, action.sourceCardId, action.newCards);
    // }
    
    chatStore.addMessage(
      '✅ Aktion erfolgreich ausgeführt!',
      'assistant'
    );
  }
  
  /**
   * Handle dialog confirm (Execute & Learn)
   */
  function handleConfirm() {
    if (!pendingAction) return;
    
    // Execute action
    executeAction(pendingAction);
    
    // Record success (triggers toast)
    chatStore.recordActionSuccess(pendingPatternHash, false);
    
    // Cleanup
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle dialog cancel
   */
  function handleCancel() {
    if (pendingPatternHash) {
      chatStore.recordActionRejection(pendingPatternHash);
    }
    
    chatStore.addMessage(
      'Aktion wurde abgebrochen.',
      'assistant'
    );
    
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle execute once (without learning)
   */
  function handleExecuteOnce() {
    if (!pendingAction) return;
    
    executeAction(pendingAction);
    
    chatStore.addMessage(
      'Aktion einmalig ausgeführt (ohne Learning).',
      'assistant'
    );
    
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle Enter key in textarea
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }
</script>

<!-- AI Panel Container -->
<div class="flex h-full flex-col overflow-hidden">
  
  <!-- Header -->
  <div class="p-4 border-b">
    <div class="flex items-center gap-2 mb-2">
      <BrainIcon class="h-5 w-5 text-primary" />
      <h2 class="text-sm font-semibold">KI-Agent</h2>
    </div>
    <p class="text-xs text-muted-foreground">
      Intelligente Assistenz mit adaptivem Lernsystem
    </p>
  </div>
  
  <!-- Learning Stats -->
  <div class="px-4 py-3 bg-muted/30 border-b space-y-2">
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Gelernte Patterns:</span>
      <Badge variant="secondary" class="text-xs">
        {learnedPatternsCount}
      </Badge>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Auto-Execute bereit:</span>
      <Badge variant={autoExecutableCount > 0 ? 'default' : 'outline'} class="text-xs">
        {autoExecutableCount}
      </Badge>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Confidence Threshold:</span>
      <span class="font-mono text-foreground">
        {Math.round(confidenceThreshold * 100)}%
      </span>
    </div>
  </div>
  
  <Separator />
  
  <!-- Chat Messages (native scroll) -->
  <div class="flex-1 overflow-y-auto p-4">
    <div class="space-y-4">
      {#if messages.length === 0}
        <!-- Empty State -->
        <div class="flex flex-col items-center justify-center h-full text-center py-12">
          <SparklesIcon class="h-12 w-12 text-muted-foreground mb-4" />
          <p class="text-sm text-muted-foreground mb-2">
            Starten Sie eine Konversation
          </p>
          <p class="text-xs text-muted-foreground">
            Fragen Sie nach Vorschlägen zur<br />Kartenorganisation
          </p>
        </div>
      {:else}
        {#each messages as message}
          <div class="flex gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] rounded-lg px-3 py-2 {
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            }">
              <p class="text-xs whitespace-pre-wrap break-words">
                {message.content}
              </p>
              <p class="text-[10px] mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  
  <Separator />
  
  <!-- Input Area -->
  <div class="p-4 border-t bg-background">
    <div class="flex gap-2">
      <Textarea
        bind:value={userInput}
        onkeydown={handleKeyDown}
        placeholder="Fragen Sie den KI-Agent..."
        class="min-h-[60px] resize-none text-sm"
        disabled={isProcessing}
      />
      <Button
        onclick={handleSendMessage}
        disabled={!userInput.trim() || isProcessing}
        size="icon"
        class="shrink-0"
      >
        <SendIcon class="h-4 w-4" />
      </Button>
    </div>
    <p class="text-[10px] text-muted-foreground mt-2">
      Enter zum Senden, Shift+Enter für neue Zeile
    </p>
  </div>
  
</div>

<!-- Action Confirmation Dialog -->
{#if pendingAction}
  <ActionConfirmationDialog
    bind:open={showConfirmDialog}
    action={pendingAction}
    patternHash={pendingPatternHash}
    currentConfidence={pendingConfidence}
    threshold={confidenceThreshold}
    usageCount={pendingUsageCount}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
    onExecuteOnce={handleExecuteOnce}
  />
{/if}
