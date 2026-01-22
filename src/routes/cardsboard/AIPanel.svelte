<!--
  🤖 AIPanel.svelte - AI-Agent Interface in rechter Sidebar
  
  Features:
  - Chat-Interface für AI-Interaktion
  - Tool-Based AI System (MCP-Style OpenAI Function Calling)
  - 12 verfügbare Tools für Board-Operationen
-->

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Separator } from '$lib/components/ui/separator';
  import { chatStore } from '$lib/stores/chatStore.svelte.js';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import SendIcon from '@lucide/svelte/icons/send';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import LoaderIcon from '@lucide/svelte/icons/loader';
  import XIcon from '@lucide/svelte/icons/x';
  
  // ?? Tool-Based AI System (MCP-Style)
  import {
    toolDefinitions,
    getToolDefinitions,
    buildToolSystemPrompt,
    executeToolCalls,
    summarizeResults,
    type ToolCall,
    type ToolResult,
    type SelectedCardContext
  } from '$lib/agent/tools';
  
  // Props
  let {
    boardId,
    selectedCard = null,
    onClearSelection
  }: {
    boardId: string;
    selectedCard?: {
      cardId: string;
      cardName: string;
      columnId: string;
      columnName: string;
    } | null;
    onClearSelection?: () => void;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // Chat Messages (derived from chatStore)
  let messages = $derived(chatStore.messages);
  
  // Chat Container Referenz für Auto-Scroll
  let chatContainer: HTMLDivElement | null = $state(null);
  
  // Auto-Scroll zur letzten Nachricht bei neuen Messages oder wenn Processing startet
  $effect(() => {
    // Dependency tracking: messages und isProcessing
    const _messages = messages;
    const _isProcessing = isProcessing;
    
    // Scroll zum Ende des Chat-Containers
    if (chatContainer) {
      // Timeout um sicherzustellen, dass DOM aktualisiert wurde
      setTimeout(() => {
        chatContainer?.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  });
  
  // ?? WICHTIG: Lade Chat-Session wenn boardId sich �ndert
  // Guard: Verhindere Endlosschleife durch Tracking der letzten geladenen ID
  let lastLoadedBoardId = $state<string | null>(null);
  
  $effect(() => {
    if (boardId !== lastLoadedBoardId) {
      console.log('?? AIPanel: Lade Chat-Session f�r Board:', boardId);
      chatStore.loadSession(boardId);
      lastLoadedBoardId = boardId;
    }
  });
  
  /**
   * Handle user message send - Uses Tool-Based AI System (MCP-Style)
   */
  async function handleSendMessage() {
    if (!userInput.trim() || isProcessing) return;
    
    const message = userInput.trim();
    userInput = '';
    
    // Always use Tool-Based System (MCP-Style)
    await handleToolBasedMessage(message);
  }
  
  // ============================================================================
  // ?? Tool-Based AI System (MCP-Style)
  // ============================================================================

  /**
   * Handle message using Tool-Based Architecture (OpenAI Function Calling)
   * This is the new, cleaner approach that properly handles single actions
   * like "erstelle eine Karte" without generating full board structures.
   */
  async function handleToolBasedMessage(message: string) {
    console.log('?? [Tool-Based] Processing message:', message);
    
    // Add user message to chat
    chatStore.addMessage(message, 'user');
    isProcessing = true;
    
    try {
      // Step 1: Build board context for system prompt
      const boardContext = boardStore.getContextData(true);
      console.log('?? [Tool-Based] Board context:', {
        columns: boardContext.columns?.length || 0,
        cards: boardContext.columns?.reduce((sum: number, c: any) => sum + (c.cards?.length || 0), 0) || 0
      });
      
      // Step 2: Build selected card context if available
      let selectedCardContext: SelectedCardContext | null = null;
      if (selectedCard) {
        // Find the full card data from board context
        const column = boardContext.columns?.find((c: { id: string }) => c.id === selectedCard.columnId);
        const card = column?.cards?.find((c: { id: string }) => c.id === selectedCard.cardId);
        selectedCardContext = {
          cardId: selectedCard.cardId,
          cardName: selectedCard.cardName,
          columnId: selectedCard.columnId,
          columnName: selectedCard.columnName,
          content: card?.content,
          labels: card?.labels
        };
        console.log('🎯 [Tool-Based] Selected card context:', selectedCardContext);
      }
      
      // Step 3: Build system prompt with full card context and selected card
      const systemPrompt = buildToolSystemPrompt(boardContext, selectedCardContext);
      
      // Step 4: Get tool definitions in OpenAI format
      const tools = getToolDefinitions();
      
      // Step 5: Send to LLM with tools
      console.log('🚀 [Tool-Based] Sending to LLM with', tools.length, 'tools');
      const result = await chatStore.sendToLLMWithTools(message, systemPrompt, tools);
      
      if (result.error) {
        console.error('❌ [Tool-Based] LLM Error:', result.error);
        chatStore.addMessage(result.error, 'assistant');
        isProcessing = false;
        return;
      }
      
      // Step 6: Process response
      if (result.tool_calls && result.tool_calls.length > 0) {
        // LLM wants to use tools
        console.log('?? [Tool-Based] Executing', result.tool_calls.length, 'tool calls');
        
        // Show processing message if multiple tools
        if (result.tool_calls.length > 1) {
          chatStore.addMessage(
            `?? F�hre ${result.tool_calls.length} Aktionen aus...`,
            'assistant'
          );
        }
        
        // Build execution context with boardStore API reference
        const executionContext = {
          board: boardStore.data,
          currentUserPubkey: null, // TODO: Get from authStore when available
          currentUserName: null,   // TODO: Get from authStore when available
          boardStore: {
            createColumn: (name: string, color?: string) => boardStore.createColumn(name, color),
            updateColumn: (columnId: string, updates: any) => boardStore.updateColumn(columnId, updates),
            deleteColumn: (columnId: string) => boardStore.deleteColumn(columnId),
            createCard: (columnId: string, heading: string, content?: string) => boardStore.createCard(columnId, heading, content),
            editCard: (cardId: string, updates: any) => boardStore.editCard(cardId, updates),
            deleteCard: (cardId: string) => boardStore.deleteCard(cardId),
            moveCard: (cardId: string, fromColumnId: string, toColumnId: string) => boardStore.handleCardMove(cardId, fromColumnId, toColumnId)
          },
          triggerUpdate: () => {} // Not needed when using boardStore API
        };
        
        // Execute tool calls
        const toolCalls: ToolCall[] = result.tool_calls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
        
        const toolResults = await executeToolCalls(toolCalls, executionContext);
        
        // Step 7: Handle results based on tool type
        // Check for respond/ask_clarification tools - these should show their message directly
        const responseResults = toolResults.filter(r => 
          r.tool_name === 'respond' || r.tool_name === 'ask_clarification'
        );
        const actionResults = toolResults.filter(r => 
          r.tool_name !== 'respond' && r.tool_name !== 'ask_clarification'
        );
        
        // Show action results summary (if any actions were performed)
        if (actionResults.length > 0) {
          const summary = summarizeResults(actionResults);
          console.log('?? [Tool-Based] Action results:', summary);
          if (summary.trim()) {
            chatStore.addMessage(summary, 'assistant');
          }
        }
        
        // Show response messages (respond/ask_clarification tools)
        for (const r of responseResults) {
          if (r.success && r.result) {
            if (r.tool_name === 'respond' && r.result.message) {
              console.log('?? [Tool-Based] Showing respond message');
              chatStore.addMessage(r.result.message, 'assistant');
            } else if (r.tool_name === 'ask_clarification' && r.result.question) {
              console.log('? [Tool-Based] Showing clarification question');
              let clarificationMsg = r.result.question;
              if (r.result.options && r.result.options.length > 0) {
                clarificationMsg += '\n\nOptionen:\n' + r.result.options.map((o: string) => `� ${o}`).join('\n');
              }
              chatStore.addMessage(clarificationMsg, 'assistant');
            }
          }
        }
        
        // If there was a text response too, show it
        if (result.content && result.content.trim()) {
          chatStore.addMessage(result.content, 'assistant');
        }
        
      } else if (result.content) {
        // LLM responded with text only (used respond/ask_clarification tools, or no tool needed)
        console.log('?? [Tool-Based] Text response received');
        chatStore.addMessage(result.content, 'assistant');
        
      } else {
        // Empty response
        console.warn('?? [Tool-Based] Empty response from LLM');
        chatStore.addMessage(
          '?? Ich konnte keine passende Antwort generieren. Bitte formulieren Sie Ihre Anfrage anders.',
          'assistant'
        );
      }
      
    } catch (error) {
      console.error('? [Tool-Based] Error:', error);
      chatStore.addMessage(
        `? Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'assistant'
      );
    } finally {
      isProcessing = false;
    }
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
    <div class="flex items-center gap-2 mb-1">
      <BrainIcon class="h-5 w-5 text-primary" />
      <h2 class="text-sm font-semibold">KI-Agent</h2>
    </div>
    <p class="text-xs text-muted-foreground">
      Intelligente Board-Assistenz
    </p>
    {#if selectedCard}
      <div class="mt-2 p-2 bg-primary/10 rounded-md border border-primary/20 relative">
        <button
          type="button"
          onclick={() => onClearSelection?.()}
          class="absolute top-1 right-1 p-0.5 rounded hover:bg-primary/20 transition-colors"
          aria-label="Auswahl aufheben"
          title="Auswahl aufheben"
        >
          <XIcon class="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </button>
        <p class="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Selektiert</p>
        <p class="text-xs font-medium text-primary truncate pr-4" title={selectedCard.cardName}>
          {selectedCard.cardName}
        </p>
        <p class="text-[10px] text-muted-foreground">
          in "{selectedCard.columnName}"
        </p>
      </div>
    {/if}
  </div>
  
  <Separator />
  
  <!-- Chat Messages (native scroll) -->
  <div bind:this={chatContainer} class="flex-1 overflow-y-auto p-4">
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
        
        <!-- Thinking Indicator während LLM Processing -->
        {#if isProcessing}
          <div class="flex gap-2 justify-start">
            <div class="max-w-[85%] rounded-lg px-3 py-2 bg-muted">
              <div class="flex items-center gap-2">
                <LoaderIcon class="h-3 w-3 animate-spin text-muted-foreground" />
                <p class="text-xs text-muted-foreground italic">
                  Denke nach...
                </p>
              </div>
            </div>
          </div>
        {/if}
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
        {#if isProcessing}
          <LoaderIcon class="h-4 w-4 animate-spin" />
        {:else}
          <SendIcon class="h-4 w-4" />
        {/if}
      </Button>
    </div>
    <p class="text-[10px] text-muted-foreground mt-2">
      Enter zum Senden, Shift+Enter für neue Zeile
    </p>
  </div>
  
</div>

