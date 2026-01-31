<!--
  🤖 AIPanel.svelte - AI-Agent Interface in rechter Sidebar
  
  Features:
  - Chat-Interface für AI-Interaktion
  - Tool-Based AI System (MCP-Style OpenAI Function Calling)
  - 12 verfügbare Tools für Board-Operationen
  - OER-Suchergebnisse mit interaktiven Buttons
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
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import XIcon from '@lucide/svelte/icons/x';
  import SquareSigmaIcon from '@lucide/svelte/icons/square-sigma';
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
  import { onMount, onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';
  
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
  
  // OER Results Component
  import OerResultCard from './OerResultCard.svelte';
  import type { OerResultData } from '$lib/classes/ChatModel.js';
  
  // Props
  let {
    boardId
  }: {
    boardId: string;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // AI Summary State
  let aiSummary = $state<string | null>(null);
  let isGeneratingAiSummary = $state(false);
  let aiSummaryError = $state<string | null>(null);
  let showSummarySection = $state(false);
  
  // 🎯 Kontext-Karten (per CTRL+Klick oder Long-Press hinzugefügt)
  interface ContextCard {
    cardId: string;
    cardName: string;
    columnId: string;
    columnName: string;
  }
  let contextCards = $state<ContextCard[]>([]);
  
  function handleAddCardToContext(e: CustomEvent<ContextCard>) {
    const newCard = e.detail;
    // Verhindere Duplikate
    if (!contextCards.some(c => c.cardId === newCard.cardId)) {
      contextCards = [...contextCards, newCard];
    }
  }
  
  function removeContextCard(cardId: string) {
    contextCards = contextCards.filter(c => c.cardId !== cardId);
  }
  
  function clearAllContextCards() {
    contextCards = [];
  }
  
  // Event-Listener für CTRL+Klick/Long-Press
  onMount(() => {
    window.addEventListener('addCardToAIContext', handleAddCardToContext as EventListener);
  });
  
  onDestroy(() => {
    window.removeEventListener('addCardToAIContext', handleAddCardToContext as EventListener);
  });
  
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
   * Generiert eine KI-Zusammenfassung des Boards
   * - Erster Absatz: Ein Satz als Kurzbeschreibung
   * - Zweiter Teil: Detaillierte Beschreibung der Inhalte und des Anliegens
   */
  async function generateAiSummary() {
    if (isGeneratingAiSummary) return;
    
    const settings = settingsStore.settings;
    if (!settings.llmModel || !settings.llmBaseUrl) {
      aiSummaryError = '❌ LLM nicht konfiguriert. Bitte in Settings LLM-Model und Base URL eintragen.';
      return;
    }
    
    isGeneratingAiSummary = true;
    aiSummaryError = null;
    aiSummary = null;
    
    try {
      // Get board context
      const boardContext = boardStore.getContextData(true);
      const columnCount = boardContext.columns?.length || 0;
      const cardCount = boardContext.columns?.reduce((sum: number, c: any) => sum + (c.cards?.length || 0), 0) || 0;
      
      // Build a detailed board description for the prompt
      let boardDetails = `Board: "${boardContext.name || 'Unbenannt'}"\n`;
      boardDetails += `Beschreibung: ${boardContext.description || 'Keine'}\n`;
      boardDetails += `Spalten: ${columnCount}, Karten: ${cardCount}\n\n`;
      
      if (boardContext.columns && boardContext.columns.length > 0) {
        boardDetails += 'Struktur:\n';
        for (const column of boardContext.columns) {
          boardDetails += `\n## ${column.name} (${column.cards?.length || 0} Karten)\n`;
          if (column.cards && column.cards.length > 0) {
            for (const card of column.cards) {
              boardDetails += `- ${card.heading}`;
              if (card.content) boardDetails += `: ${card.content.substring(0, 100)}${card.content.length > 100 ? '...' : ''}`;
              boardDetails += '\n';
            }
          }
        }
      }
      
      const systemPrompt = `Du bist ein Assistent, der Kanban-Boards zusammenfasst.

Deine Aufgabe ist es, eine prägnante Zusammenfassung in Markdown zu erstellen:

1. **Erster Absatz**: EIN einziger Satz, der das Board kurz und prägnant beschreibt.

2. **Zweiter Teil**: Eine detaillierte Beschreibung der Inhalte, der Struktur und des Anliegens des Boards. Erkläre die Spalten, wichtige Karten und den Gesamtzweck.

Antworte NUR mit der Markdown-Zusammenfassung, ohne zusätzliche Erklärungen.`;
      
      const userMessage = `Erstelle eine Zusammenfassung für folgendes Board:\n\n${boardDetails}`;
      
      // Use chatStore's LLM method (without tools for simple text generation)
      const result = await chatStore.sendToLLMWithTools(userMessage, systemPrompt, []);
      
      if (result.error) {
        aiSummaryError = result.error;
      } else if (result.content) {
        aiSummary = result.content;
        
        // Speichere die KI-Zusammenfassung als Board-Beschreibung
        boardStore.updateCurrentBoardMeta({
          description: result.content
        });
        
        console.log('✅ KI-Zusammenfassung als Board-Beschreibung gespeichert');
        toast.success('✅ Zusammenfassung gespeichert', {
          description: 'Die KI-Zusammenfassung wurde als Board-Beschreibung übernommen.',
          duration: 3000
        });
      } else {
        aiSummaryError = '❌ Keine Antwort vom LLM erhalten.';
      }
      
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      aiSummaryError = error instanceof Error ? error.message : 'Unbekannter Fehler';
    } finally {
      isGeneratingAiSummary = false;
    }
  }
  
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
      
      // Step 2: Build selected card context from contextCards (if any)
      let selectedCardContext: SelectedCardContext | null = null;
      if (contextCards.length > 0) {
        // Wenn Kontext-Karten vorhanden, nutze die erste als Haupt-Kontext
        // und erwähne alle anderen im System-Prompt
        const primaryCard = contextCards[0];
        const column = boardContext.columns?.find((c: { id: string }) => c.id === primaryCard.columnId);
        const card = column?.cards?.find((c: { id: string }) => c.id === primaryCard.cardId);
        
        if (card) {
          selectedCardContext = {
            cardId: primaryCard.cardId,
            cardName: primaryCard.cardName,
            columnId: primaryCard.columnId,
            columnName: primaryCard.columnName,
            content: card?.content,
            labels: card?.labels
          };
          
          // Für mehrere Karten: erweitere Context
          if (contextCards.length > 1) {
            const additionalCards = contextCards.slice(1).map(cc => {
              const col = boardContext.columns?.find((c: { id: string }) => c.id === cc.columnId);
              const crd = col?.cards?.find((c: { id: string }) => c.id === cc.cardId);
              return `- "${cc.cardName}" (${cc.columnName})${crd?.content ? `: ${crd.content.slice(0, 100)}...` : ''}`;
            }).join('\n');
            selectedCardContext.content = `${selectedCardContext.content || ''}\n\n[Weitere ausgewählte Karten:]\n${additionalCards}`;
          }
          
          console.log('🎯 [Tool-Based] Context cards:', contextCards.length);
        }
      }
      
      // Step 3: Build system prompt with card context
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
            moveCard: (cardId: string, fromColumnId: string, toColumnId: string) => boardStore.handleCardMove(cardId, fromColumnId, toColumnId),
            updateBoardMeta: (updates: { name?: string; description?: string; tags?: string[] }) => boardStore.updateCurrentBoardMeta(updates)
          },
          triggerUpdate: () => console.warn('[AIPanel] triggerUpdate called - use boardStore API methods instead')
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
          console.log('📋 [Tool-Based] Action results:', summary);
          if (summary.trim()) {
            // 📚 Check for OER search results to show interactive buttons
            const oerSearchResult = actionResults.find(r => r.tool_name === 'search_oer');
            const oerResults = oerSearchResult?.result?.results as OerResultData[] | undefined;
            
            chatStore.addMessage(summary, 'assistant', oerResults);
          }
        }
        
        // Show response messages (respond/ask_clarification tools)
        for (const r of responseResults) {
          if (r.success && r.result) {
            if (r.tool_name === 'respond' && r.result.message) {
              console.log('💬 [Tool-Based] Showing respond message');
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
  
  /**
   * Retry a message - finds the user message before the given assistant message index
   * and re-sends it, replacing all messages from that point onwards
   */
  async function retryMessage(messageIndex: number) {
    if (isProcessing) return;
    
    // Find the user message before this assistant message
    let userMessageIndex = -1;
    let userMessageContent = '';
    
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageIndex = i;
        userMessageContent = messages[i].content;
        break;
      }
    }
    
    if (userMessageIndex === -1 || !userMessageContent) {
      console.warn('🔄 No user message found to retry');
      return;
    }
    
    console.log('🔄 Retrying message:', userMessageContent);
    
    // Delete all messages from userMessageIndex onwards
    const messagesToDelete = messages.slice(userMessageIndex).map(m => m.id);
    for (const id of messagesToDelete) {
      chatStore.deleteMessage(id);
    }
    
    // Re-send the user message
    await handleToolBasedMessage(userMessageContent);
  }
</script>

<!-- AI Panel Container -->
<div class="flex h-full flex-col overflow-hidden">
  
  <!-- Header -->
  <div class="p-4 border-b-2 max-h-14.5 overflow-hidden">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <BrainIcon class="h-5 w-5 text-primary" />
        <h2 class="text-sm font-semibold">KI-Agent</h2>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => showSummarySection = !showSummarySection}
        title={showSummarySection ? 'Zusammenfassung ausblenden' : 'Board-Zusammenfassung generieren'}
        class="h-7 gap-2"
      >
        <SquareSigmaIcon class="h-3 w-3" />
        <span class="text-xs hidden sm:inline">Summary</span>
      </Button>
    </div>
  </div>
  <!-- Main Content Area (shrink to content, not flex-1) -->
  <div class="overflow-y-auto flex flex-col p-4 space-y-4 shrink-0">
    <!-- AI Summary Section (Collapsible) -->
    {#if showSummarySection}
      <div class="mt-3 p-3 bg-muted/30 rounded-md border space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Board-Zusammenfassung</h3>
          <Button
            variant="outline"
            size="sm"
            onclick={generateAiSummary}
            disabled={isGeneratingAiSummary}
            title="KI-Zusammenfassung generieren"
            class="h-6 gap-1.5 px-2"
          >
            {#if isGeneratingAiSummary}
              <LoaderIcon class="h-3 w-3 animate-spin" />
            {:else}
              <SparklesIcon class="h-3 w-3" />
            {/if}
            <span class="text-[10px]">Generieren</span>
          </Button>
        </div>
        
        <!-- Current Description -->
        <div>
          <p class="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">Aktuelle Beschreibung</p>
          {#if boardStore.boardMeta?.description}
            <div class="text-[11px] text-foreground/80 bg-background rounded p-2 border max-h-32 overflow-y-auto prose prose-xs dark:prose-invert max-w-none">
              {@html boardStore.boardMeta.description
                .replace(/\n\n/g, '</p><p class="mt-1">')
                .replace(/\n/g, '<br />')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/^## (.+)$/gm, '<h4 class="font-semibold mt-2 mb-1 text-xs">$1</h4>')
                .replace(/^### (.+)$/gm, '<h5 class="font-medium mt-1 mb-0.5 text-[11px]">$1</h5>')
                .replace(/^- (.+)$/gm, '<li class="ml-3">• $1</li>')
              }
            </div>
          {:else}
            <p class="text-[11px] text-muted-foreground italic bg-background rounded p-2 border">Keine Beschreibung vorhanden</p>
          {/if}
        </div>
        
        <!-- AI Summary Status -->
        {#if aiSummaryError}
          <div class="rounded bg-destructive/10 border border-destructive/20 p-2">
            <p class="text-[11px] text-destructive">{aiSummaryError}</p>
          </div>
        {/if}
        
        {#if isGeneratingAiSummary}
          <div class="rounded bg-muted p-2">
            <div class="flex items-center gap-2">
              <LoaderIcon class="h-3 w-3 animate-spin text-muted-foreground" />
              <p class="text-[11px] text-muted-foreground italic">KI generiert Zusammenfassung...</p>
            </div>
          </div>
        {:else if aiSummary}
          <div class="rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-2">
            <div class="flex items-center gap-2">
              <CheckCircle2Icon class="h-3 w-3 text-green-600 dark:text-green-400" />
              <p class="text-[11px] text-green-700 dark:text-green-300">
                Zusammenfassung erstellt und gespeichert.
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- 🎯 Kontext-Karten Anzeige -->
    {#if contextCards.length > 0}
      <div class="mt-2 p-2 bg-primary/10 rounded-md border border-primary/20">
        <div class="flex items-center justify-between mb-1">
          <p class="text-[10px] text-muted-foreground uppercase tracking-wide">
            Kontext ({contextCards.length} {contextCards.length === 1 ? 'Karte' : 'Karten'}):
          </p>
          <button
            type="button"
            onclick={clearAllContextCards}
            class="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            title="Alle entfernen"
          >
            Alle entfernen
          </button>
        </div>
        <div class="flex flex-wrap gap-1">
          {#each contextCards as ctx (ctx.cardId)}
            <span class="inline-flex items-center gap-1 text-xs bg-primary/20 text-primary rounded px-1.5 py-0.5">
              <span class="truncate max-w-[100px]" title={ctx.cardName}>{ctx.cardName}</span>
              <button
                type="button"
                onclick={() => removeContextCard(ctx.cardId)}
                class="hover:bg-primary/30 rounded-sm p-0.5"
                title="Entfernen"
              >
                <XIcon class="h-3 w-3" />
              </button>
            </span>
          {/each}
        </div>
        <p class="text-[10px] text-muted-foreground mt-1 italic">
          Tipp: Strg+Klick oder langes Drücken auf Karten
        </p>
      </div>
    {:else}
      <p class="text-[10px] text-muted-foreground mt-2 italic">
        Tipp: Strg+Klick (Desktop) oder langes Drücken (Mobile) fügt Karten zum Kontext hinzu
      </p>
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
        {#each messages as message, index}
          <div class="chat-message {message.role === 'user' ? 'user-msg' : 'agent-msg'} flex gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="message-wrapper max-w-[85%]">
              <div class="message-bubble rounded-lg px-3 py-2 {
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }">
                <p class="message-content text-xs whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                
                <!-- 📚 OER Results mit interaktiven Buttons -->
                {#if message.oerResults && message.oerResults.length > 0}
                  <div class="oer-results mt-3 space-y-2">
                    <p class="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                      OER-Ergebnisse ({message.oerResults.length}):
                    </p>
                    {#each message.oerResults as result (result.number)}
                      <OerResultCard {result} />
                    {/each}
                  </div>
                {/if}
                
                <p class="message-timestamp text-[10px] mt-1 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString('de-DE', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
              <!-- Retry Button für Assistant-Nachrichten -->
              {#if message.role === 'assistant' && !isProcessing}
                <button
                  type="button"
                  onclick={() => retryMessage(index)}
                  class="message-retry flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                  title="Anfrage wiederholen"
                >
                  <RefreshCwIcon class="h-3 w-3" />
                  Wiederholen
                </button>
              {/if}
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

