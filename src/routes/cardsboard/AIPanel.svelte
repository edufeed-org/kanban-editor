<!--
  ?? AIPanel.svelte - AI-Agent Interface in rechter Sidebar
  
  Features:
  - Chat-Interface f�r AI-Interaktion
  - Zeigt AI-Action-Vorschl�ge
  - Integriert ActionConfirmationDialog
  - Zeigt Learned Patterns Status
-->

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import * as Dialog from '$lib/components/ui/dialog';
  import ActionConfirmationDialog from '$lib/components/ui/ActionConfirmationDialog.svelte';
  import { chatStore } from '$lib/stores/chatStore.svelte.js';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import SendIcon from '@lucide/svelte/icons/send';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
  import LoaderIcon from '@lucide/svelte/icons/loader';
  import XIcon from '@lucide/svelte/icons/x';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import type { AIAction } from '$lib/classes/BoardModel.js';
  
  // ?? Agent Modules (refactored) - Legacy Phase 1/2 (kept for backward compatibility)
  import {
    parseContentProposal,
    analyzeExistingStructure,
    generateStructurePrompt,
    validateStructureJSON,
    validateColumnAlignment,
    parseStructureProposal,
    structureToActions,
    createBoardPreview,
    executeActions,
    STRUCTURE_GENERATION_SYSTEM_PROMPT,
    type ContentProposal,
    type StructureProposal,
    type BoardPreview
  } from '$lib/agent';
  
  // ?? Tool-Based AI System (MCP-Style)
  import {
    toolDefinitions,
    getToolDefinitions,
    buildToolSystemPrompt,
    executeToolCalls,
    summarizeResults,
    type ToolCall,
    type ToolResult
  } from '$lib/agent/tools';
  
  // Props
  let {
    boardId
  }: {
    boardId: string;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // ?? 2-Phase System State
  let currentContentProposal = $state<ContentProposal | null>(null);
  let showContentDialog = $state(false);
  let isGeneratingStructure = $state(false);
  let structureRetries = $state(0);
  let structureGenerationError = $state('');
  let phase1MarkdownContent = $state<string>(''); // ?? Phase 1 Markdown anzeigen
  let isPhase2Running = $state(false); // ?? Phase 2 l�uft
  let phase2Toast = $state<string>(''); // ?? Toast Nachricht
  const MAX_STRUCTURE_RETRIES = 3;
  
  // Legacy state (kept for backward compatibility with Phase 1/2 system)
  let awaitingUserConfirmation = $state(false);
  let lastProposalContent = $state<string>('');
  let pendingProposal = $state<ContentProposal | null>(null);
  let waitingForConfirmation = $state(false);
  
  // ?? Board Confirmation State
  let showBoardConfirmationDialog = $state(false);
  let pendingBoardActions = $state<AIAction[]>([]);
  let pendingBoardPreview = $state<{
    columns: Array<{ name: string; cardCount: number; cards: string[] }>;
    totalCards: number;
  } | null>(null);
  
  // Action Confirmation Dialog State
  let showConfirmDialog = $state(false);
  let pendingAction = $state<AIAction | null>(null);
  let pendingPatternHash = $state('');
  let pendingConfidence = $state(0);
  let pendingUsageCount = $state(0);
  
  // Chat Messages (derived from chatStore)
  let messages = $derived(chatStore.messages);
  
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
  

  // ?? handlePhase1Response() - REMOVED (Tool-Based is now the only architecture)
  // Legacy Phase 1/2 system has been archived. See archive/AI-INTEGRATION.md
  
  /**
   * Phase 2: Generiere Struktur aus Proposal
   * ?? Mit Toast-Notification & Spinner
   */
  async function handleApproveProposal() {
    if (!currentContentProposal) return;
    
    showContentDialog = false;
    isGeneratingStructure = true;
    structureRetries = 0;
    structureGenerationError = '';
    
    chatStore.addMessage(
      '? Generiere Board-Struktur als JSON...',
      'assistant'
    );
    
    await generateBoardStructure();
  }
  
  /**
   * Rekursive Struktur-Generierung mit Retry-Logik (FIXED!)
   * 
   * FIX: Nutzt jetzt sendToLLMWithSystem() mit spezialisiertem System-Prompt
   * Das verhindert Prompt-Injections und stellt sicher, dass LLM valides JSON liefert
   */
  async function generateBoardStructure() {
    if (!currentContentProposal) return;
    
    if (structureRetries >= MAX_STRUCTURE_RETRIES) {
      chatStore.addMessage(
        `? Struktur-Generierung fehlgeschlagen nach ${MAX_STRUCTURE_RETRIES} Versuchen. Bitte versuchen Sie es sp�ter erneut.`,
        'assistant'
      );
      isGeneratingStructure = false;
      isPhase2Running = false;
      phase2Toast = '';
      return;
    }
    
    try {
      // ?? Zeige Spinner f�r Phase 2 (JSON-Generierung)
      isPhase2Running = true;
      phase2Toast = '?? Generiere Board-Struktur (JSON)...';
      
      // Get existing columns for structure prompt
      const existingColumns = boardStore.uiData.map(col => col.name);
      
      // ?? Analyze existing structure to get strategy
      const structureAnalysis = analyzeExistingStructure(existingColumns);
      
      // Generate ONLY user prompt (system prompt wird separat �bergeben!)
      const userPrompt = generateStructurePrompt(
        currentContentProposal.content,
        {
          existingColumns
        }
      );
      
      // Use SPECIALIZED system prompt for JSON generation from module
      const systemPrompt = STRUCTURE_GENERATION_SYSTEM_PROMPT;
      
      // Append user context to prompt
      const fullUserPrompt = `${userPrompt}

Jetzt generiere JSON f�r den Lerninhalt:`;

      // Send to LLM with CUSTOM system prompt!
      const { content: jsonResponse, error } = await chatStore.sendToLLMWithSystem(
        fullUserPrompt,
        systemPrompt
      );
      
      if (error) {
        throw new Error(error);
      }

      // Log f�r Debugging
      console.log('?? Raw JSON Response:', jsonResponse);
      
      // Validate JSON structure
      const validation = validateStructureJSON(jsonResponse);
      
      if (!validation.valid) {
        structureRetries++;
        structureGenerationError = validation.error || 'Unbekannter Fehler';
        
        console.log(`?? Validation failed (Attempt ${structureRetries}/${MAX_STRUCTURE_RETRIES}):`, validation.error);
        console.log('?? Response was:', jsonResponse.substring(0, 200));
        
        // ?? Reset Spinner bei Validation-Fehler
        isPhase2Running = false;
        phase2Toast = '';
        
        const formattedError = `? Struktur-Validierung fehlgeschlagen:\n${validation.error || 'Unbekannter Fehler'}\n\nBitte versuchen Sie erneut.`;
        chatStore.addMessage(
          `?? Versuch ${structureRetries}: ${formattedError}`,
          'assistant'
        );
        
        // Retry
        await generateBoardStructure();
        return;
      }
      
      // ?? Validate column alignment with detected strategy
      const columnValidation = validateColumnAlignment(
        validation.data.columns,
        existingColumns,
        structureAnalysis.strategy
      );
      
      if (!columnValidation.valid) {
        structureRetries++;
        structureGenerationError = columnValidation.error || 'Spalten-Alignment fehlgeschlagen';
        
        console.log(`?? Column alignment failed (Attempt ${structureRetries}/${MAX_STRUCTURE_RETRIES}):`, columnValidation.error);
        console.log('?? Generated columns:', validation.data.columns.map((c: any) => c.name));
        console.log('?? Existing columns:', existingColumns);
        console.log('?? Expected strategy:', structureAnalysis.strategy);
        
        // Reset Spinner
        isPhase2Running = false;
        phase2Toast = '';
        
        const formattedError = `? Spalten-Validierung fehlgeschlagen:\n${columnValidation.error}\n\nBitte versuchen Sie erneut.`;
        chatStore.addMessage(
          `?? Versuch ${structureRetries}: ${formattedError}`,
          'assistant'
        );
        
        // Retry
        await generateBoardStructure();
        return;
      }
      
      // Parse und execute actions
      const proposal = parseStructureProposal(validation.data);
      if (!proposal) {
        throw new Error('Failed to parse structure proposal');
      }
      
      chatStore.addMessage(
        `? Struktur generiert! Erstelle ${proposal.columns.length} Spalten mit ${proposal.columns.reduce((sum, c) => sum + c.cards.length, 0)} Karten...`,
        'assistant'
      );
      
      await processStructureAndCreateActions(proposal);
      
    } catch (err) {
      structureRetries++;
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      structureGenerationError = errorMsg;
      
      console.error(`? Generation error (Attempt ${structureRetries}):`, err);
      
      // ?? Reset Spinner bei Fehler
      isPhase2Running = false;
      phase2Toast = '';
      
      if (structureRetries < MAX_STRUCTURE_RETRIES) {
        chatStore.addMessage(
          `?? Fehler bei Versuch ${structureRetries}: ${errorMsg}\nWiederhole...`,
          'assistant'
        );
        await generateBoardStructure();
      } else {
        chatStore.addMessage(
          `? Generierung fehlgeschlagen nach ${MAX_STRUCTURE_RETRIES} Versuchen: ${errorMsg}`,
          'assistant'
        );
        isGeneratingStructure = false;
      }
    }
  }
  
  /**
   * Konvertiere Struktur zu Aktionen und f�hre sie aus
   * ?? Mit Phase 2 Toast & Spinner
   * ???? Mit Confirmation Dialog STATT direkter Ausf�hrung
   */
  async function processStructureAndCreateActions(proposal: any) {
    try {
      const actions = structureToActions(proposal);
      console.log(`?? Generated ${actions.length} actions for preview...`);
      
      // ?? Phase 2 starten - Toast zeigen
      isPhase2Running = true;
      phase2Toast = `? Board-Struktur wird generiert... (${actions.length} Aktionen)`;
      
      // ???? STATT: Direkt ausf�hren ? Erstelle Preview
      // for (const action of actions) {
      //   await executeAction(action);
      // }
      
      // Erstelle Board-Preview aus Actions
      const preview = createBoardPreview(actions);
      
      // Speichere Actions f�r sp�tere Ausf�hrung
      pendingBoardActions = actions;
      pendingBoardPreview = preview;
      
      // ?? Phase 2 erfolgreich - zeige Confirmation Dialog
      isPhase2Running = false;
      phase2Toast = '';
      
      // Zeige Confirmation Dialog
      showBoardConfirmationDialog = true;
      
      chatStore.addMessage(
        `? Board-Struktur generiert! ${preview.columns.length} Spalten mit ${preview.totalCards} Karten. Bitte best�tigen.`,
        'assistant'
      );
      
    } catch (err) {
      console.error('? Action generation error:', err);
      phase2Toast = '';
      isPhase2Running = false;
      chatStore.addMessage(
        `? Fehler bei Board-Generierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
        'assistant'
      );
    } finally {
      isGeneratingStructure = false;
    }
  }
  
  /**
   * ?? Handler f�r Board Confirmation Dialog
   * 
   * @param action - 'confirm' | 'reject' | 'adjust'
   */
  async function handleBoardConfirmation(action: 'confirm' | 'reject' | 'adjust') {
    switch (action) {
      case 'confirm':
        // ? BEST�TIGEN: Board speichern + Learning aktivieren
        console.log('? User best�tigt Board-Struktur');
        
        try {
          // F�hre alle Actions aus
          for (const act of pendingBoardActions) {
            await executeAction(act);
          }
          
          chatStore.addMessage(
            `? Board erfolgreich erstellt! ${pendingBoardActions.length} Aktionen ausgef�hrt.`,
            'assistant'
          );
          
          // ?? LearningManager: Lerne von diesem Board!
          // TODO Phase 2: boardLearningManager Integration
          // if (boardLearningManager?.isEnabled) {
          //   const results = boardLearningManager.learnBoardStructure();
          //   console.log('? Patterns gelernt:', results);
          //   chatStore.addMessage(
          //     `? Pattern gelernt! Beim n�chsten Mal kann ich �hnliche Boards schneller erstellen.`,
          //     'assistant'
          //   );
          // }
          
        } catch (err) {
          console.error('? Board creation error:', err);
          chatStore.addMessage(
            `? Fehler beim Erstellen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
            'assistant'
          );
        } finally {
          showBoardConfirmationDialog = false;
          pendingBoardActions = [];
          pendingBoardPreview = null;
          currentContentProposal = null;
        }
        break;
        
      case 'reject':
        // ? ABLEHNEN: Verwerfen und zur�ck zu Input
        console.log('? User lehnt Board-Struktur ab');
        
        chatStore.addMessage(
          '? Board-Struktur abgelehnt. Was m�chtest du anders haben?',
          'assistant'
        );
        
        showBoardConfirmationDialog = false;
        pendingBoardActions = [];
        pendingBoardPreview = null;
        currentContentProposal = null;
        break;
        
      case 'adjust':
        // ?? ANPASSEN: Neue Phase 1 mit Context
        console.log('?? User m�chte Board-Struktur anpassen');
        
        // Erstelle Anpassungs-Kontext
        const adjustmentContext = `
Der Benutzer hat folgende Board-Struktur erhalten:

${pendingBoardPreview?.columns.map(col => 
  `- Spalte "${col.name}" mit ${col.cardCount} Karten:\n  ${col.cards.map(c => `  � ${c}`).join('\n')}`
).join('\n')}

Der Benutzer m�chte Anpassungen vornehmen. Bitte zeige eine VERBESSERTE Struktur, basierend auf den folgenden W�nschen:
`;
        
        chatStore.addMessage(
          '?? Was m�chtest du an der Struktur �ndern? (Spalten umbenennen, Karten hinzuf�gen/entfernen, etc.)',
          'assistant'
        );
        
        // Setze Input mit Context vor (User kann erg�nzen)
        userInput = ''; // User muss eigene W�nsche eingeben
        
        // Speichere Context f�r n�chste LLM-Anfrage
        // TODO: Context in chatStore speichern f�r n�chste Anfrage
        
        showBoardConfirmationDialog = false;
        // Behalte pendingBoardActions/Preview f�r Vergleich (optional)
        break;
    }
  }
  
  /**
   * Reject proposal (cancel 2-phase generation)
   */
  function handleRejectProposal() {
    showContentDialog = false;
    currentContentProposal = null;
    chatStore.addMessage(
      'Struktur-Generierung abgebrochen.',
      'assistant'
    );
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
  
  //  simulateAIResponse() - REMOVED (Tool-Based is now the only architecture)
  // Legacy Phase 1/2 system has been archived. See archive/AI-INTEGRATION.md
  // handleSendMessage() now always uses handleToolBasedMessage()
  
  /**
   * Get human-readable description of action
   */
  function getActionDescription(action: AIAction): string {
    switch (action.type) {
      case 'add_column':
        return `? Spalte "${(action as any).columnName}"`;
      case 'add_card':
        return `? Karte "${(action as any).heading}"`;
      case 'split_card':
        return `?? Karte aufteilen`;
      case 'move_card':
        return `?? Karte verschieben`;
      case 'update_card':
        return `?? Karte bearbeiten`;
      default:
        return `?? ${action.type}`;
    }
  }
  
  /**
   * Track column ID mapping during execution
   * Map from column name (from AI) to actual column ID (from boardStore)
   */
  let columnNameToIdMap: Record<string, string> = {};
  
  /**
   * Execute AI action via boardStore
   * ?? FIXED: Unterst�tzt jetzt details-Struktur UND flache Struktur (Backward Compatibility)
   */
  function executeAction(action: AIAction) {
    console.log('?? Executing action:', action);
    
    try {
      switch (action.type) {
        case 'add_column': {
          // ?? Support both: action.details.name AND action.columnName (backward compat)
          const colName = (action as any).details?.name || (action as any).columnName || 'Neue Spalte';
          // Note: boardStore.createColumn() only accepts name parameter
          // color is always set to 'slate' internally
          const colId = boardStore.createColumn(colName);
          console.log('? Column created:', colId);
          
          // Store the mapping for add_card actions
          columnNameToIdMap[colName] = colId;
          console.log('?? Column name?ID mapping:', columnNameToIdMap);
          
          chatStore.addMessage(
            `? Spalte "${colName}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'add_card': {
          // ?? Support both: action.details.heading AND action.heading (backward compat)
          const heading = (action as any).details?.heading || (action as any).heading || 'Neue Karte';
          const content = (action as any).details?.content || (action as any).content || '';
          
          // Try to find columnId in three ways:
          // 1. Direct columnId (if already mapped)
          // 2. Look up via details.columnName in our mapping
          // 3. Look up via columnName in our mapping (backward compat)
          let columnId = (action as any).columnId;
          
          const columnNameFromDetails = (action as any).details?.columnName;
          const columnNameDirect = (action as any).columnName;
          
          if (!columnId && columnNameFromDetails) {
            columnId = columnNameToIdMap[columnNameFromDetails];
            console.log(`?? Column ID gefunden via details.columnName: ${columnNameFromDetails} ? ${columnId}`);
          }
          
          if (!columnId && columnNameDirect) {
            columnId = columnNameToIdMap[columnNameDirect];
            console.log(`?? Column ID gefunden via columnName: ${columnNameDirect} ? ${columnId}`);
          }
          
          if (!columnId) {
            const colName = columnNameFromDetails || columnNameDirect;
            throw new Error(`Spalten-ID fehlt (columnName: "${colName}")`);
          }
          
          const cardId = boardStore.createCard(columnId, heading, content);
          console.log('? Card created:', cardId);
          chatStore.addMessage(
            `? Karte "${heading}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'split_card': {
          // TODO: Implement split_card when boardStore has this method
          console.log('?? split_card not yet implemented in boardStore');
          chatStore.addMessage(
            '?? Karte aufteilen ist noch nicht implementiert.',
            'assistant'
          );
          break;
        }
        
        case 'update_card': {
          const cardId = (action as any).cardId;
          const updates = (action as any).updates || {};
          
          if (!cardId) {
            throw new Error('Karten-ID fehlt');
          }
          
          boardStore.editCard(cardId, updates);
          console.log('? Card updated:', cardId);
          chatStore.addMessage(
            '? Karte erfolgreich aktualisiert!',
            'assistant'
          );
          break;
        }
        
        case 'move_card': {
          const cardId = (action as any).cardId;
          const fromColId = (action as any).fromColumnId;
          const toColId = (action as any).toColumnId;
          
          if (!cardId || !fromColId || !toColId) {
            throw new Error('Karten-ID oder Spalten-ID fehlt');
          }
          
          boardStore.moveCard(cardId, fromColId, toColId);
          console.log('? Card moved:', cardId);
          chatStore.addMessage(
            '? Karte erfolgreich verschoben!',
            'assistant'
          );
          break;
        }
        
        default:
          console.warn('?? Unknown action type:', action.type);
          chatStore.addMessage(
            `?? Aktion "${action.type}" ist nicht implementiert.`,
            'assistant'
          );
      }
      
    } catch (error) {
      console.error('? Action execution failed:', error);
      chatStore.addMessage(
        `? Fehler beim Ausf�hren der Aktion: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'assistant'
      );
    }
  }
  
  /**
   * Handle dialog confirm (Execute & Learn)
   */
  async function handleConfirm() {
    if (!pendingAction) return;
    
    // Execute first action
    await executeAction(pendingAction);
    
    // Record success (triggers toast)
    chatStore.recordActionSuccess(pendingPatternHash, false);
    
    // ?? Process remaining actions if any
    const remainingActions = (pendingAction as any)._remainingActions || [];
    if (remainingActions.length > 0) {
      chatStore.addMessage(
        `? F�hre ${remainingActions.length} weitere Aktion(en) aus...`,
        'assistant'
      );
      
      for (const action of remainingActions) {
        await executeAction(action);
      }
      
      chatStore.addMessage(
        `? Alle ${remainingActions.length + 1} Aktionen erfolgreich ausgef�hrt!`,
        'assistant'
      );
    }
    
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
      'Aktion einmalig ausgef�hrt (ohne Learning).',
      'assistant'
    );
    
    pendingAction = null;
    showConfirmDialog = false;
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
      
      // Step 2: Build system prompt with full card context
      const systemPrompt = buildToolSystemPrompt(boardContext);
      
      // Step 3: Get tool definitions in OpenAI format
      const tools = getToolDefinitions();
      
      // Step 4: Send to LLM with tools
      console.log('?? [Tool-Based] Sending to LLM with', tools.length, 'tools');
      const result = await chatStore.sendToLLMWithTools(message, systemPrompt, tools);
      
      if (result.error) {
        console.error('? [Tool-Based] LLM Error:', result.error);
        chatStore.addMessage(result.error, 'assistant');
        isProcessing = false;
        return;
      }
      
      // Step 5: Process response
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
        
        // Step 6: Handle results based on tool type
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
    <div class="flex items-center gap-2 mb-2">
      <BrainIcon class="h-5 w-5 text-primary" />
      <h2 class="text-sm font-semibold">KI-Agent</h2>
    </div>
    <p class="text-xs text-muted-foreground">
      Intelligente Board-Assistenz
    </p>
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
        
        <!-- ?? Phase 2 Spinner (unter Markdown) -->
        {#if isPhase2Running}
          <div class="flex gap-2 justify-start">
            <div class="rounded-lg px-3 py-2 bg-blue-50 border border-blue-200">
              <div class="flex items-center gap-2">
                <LoaderIcon class="h-4 w-4 animate-spin text-blue-600" />
                <p class="text-xs text-blue-900">{phase2Toast}</p>
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
  
  <!-- ?? Toast Notification (oben rechts, �berlagert) -->
  {#if phase2Toast}
    <div class="fixed top-20 right-4 max-w-xs animate-in fade-in slide-in-from-right-4">
      <div class="rounded-lg bg-green-50 border border-green-200 px-4 py-3 shadow-lg">
        <div class="flex items-center gap-2">
          <CheckCircleIcon class="h-4 w-4 text-green-600" />
          <p class="text-sm text-green-900">{phase2Toast}</p>
        </div>
      </div>
    </div>
  {/if}
  
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

<!-- ?? Content Proposal Dialog (Phase 1) -->
{#if currentContentProposal}
  <Dialog.Root bind:open={showContentDialog}>
    <Dialog.Content class="max-w-md">
      <Dialog.Header>
        <Dialog.Title>?? Board-Struktur generieren?</Dialog.Title>
      </Dialog.Header>
      
      <div class="space-y-4 py-4">
        <div>
          <p class="text-sm font-medium mb-2">Erkannter Content:</p>
          <div class="text-sm text-muted-foreground max-h-40 overflow-y-auto rounded-md bg-muted/30 p-3">
            <pre class="whitespace-pre-wrap text-xs">{currentContentProposal.content}</pre>
          </div>
        </div>
        
        {#if !currentContentProposal.canGenerate}
          <div class="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
            <p class="font-medium mb-1">?? Struktur-Generierung nicht möglich</p>
            <p class="text-xs">{currentContentProposal.reason || 'Keine klare Struktur erkannt'}</p>
          </div>
        {/if}
        
        {#if structureGenerationError}
          <div class="rounded-md bg-red-50 p-3 text-sm text-red-900">
            {structureGenerationError}
            <p class="text-xs mt-2">Versuch {structureRetries}/{MAX_STRUCTURE_RETRIES}</p>
          </div>
        {/if}
        
        <div class="rounded-md bg-blue-50 p-3">
          <p class="text-xs text-blue-900">
            Ich kann KI-Vorschläge automatisch in ein funktionierendes Board-Layout umwandeln.
            Klicken Sie <strong>Generieren</strong>, um zu starten!
          </p>
        </div>
      </div>
      
      <Dialog.Footer>
        <Button
          variant="outline"
          onclick={handleRejectProposal}
          disabled={isGeneratingStructure}
        >
          Abbrechen
        </Button>
        <Button
          onclick={handleApproveProposal}
          disabled={isGeneratingStructure}
          class="gap-2"
        >
          {#if isGeneratingStructure}
            <LoaderIcon class="h-4 w-4 animate-spin" />
            Generiere...
          {:else}
            <SparklesIcon class="h-4 w-4" />
            ? Generieren
          {/if}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- ???? Board Confirmation Dialog (Phase 2 Complete) -->
{#if showBoardConfirmationDialog && pendingBoardPreview}
  <Dialog.Root bind:open={showBoardConfirmationDialog}>
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
      <Dialog.Header>
        <Dialog.Title>? Board-Struktur bestätigen?</Dialog.Title>
        <Dialog.Description>
          Das Board wurde generiert. Bitte überprüfen Sie die Struktur.
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="space-y-4 py-4">
        <!-- Statistik -->
        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-2">
            <Badge variant="outline">{pendingBoardPreview.columns.length} Spalten</Badge>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline">{pendingBoardPreview.totalCards} Karten</Badge>
          </div>
        </div>
        
        <Separator />
        
        <!-- Spalten-Preview -->
        <div class="space-y-3">
          {#each pendingBoardPreview.columns as column, i}
            <div class="border-l-4 border-blue-500 pl-3 py-2 bg-muted/30 rounded-r">
              <div class="flex items-center justify-between mb-2">
                <p class="font-semibold text-sm">{i + 1}. {column.name}</p>
                <Badge variant="secondary" class="text-xs">
                  {column.cardCount} {column.cardCount === 1 ? 'Karte' : 'Karten'}
                </Badge>
              </div>
              
              {#if column.cards.length > 0}
                <div class="space-y-1 mt-2">
                  {#each column.cards as card}
                    <div class="text-xs text-muted-foreground pl-2 border-l-2 border-muted">
                      � {card}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        
        <Separator />
        
        <!-- Info Box -->
        <div class="rounded-md bg-blue-50 p-3">
          <p class="text-xs text-blue-900 mb-2">
            <strong>? Best�tigen:</strong> Board wird gespeichert und das System lernt von dieser Struktur.
          </p>
          <p class="text-xs text-blue-900 mb-2">
            <strong>?? Anpassen:</strong> Sie können Änderungswünsche äußern und eine neue Struktur erhalten.
          </p>
          <p class="text-xs text-blue-900">
            <strong>? Ablehnen:</strong> Board wird verworfen, keine Speicherung.
          </p>
        </div>
      </div>
      
      <Dialog.Footer class="flex gap-2">
        <Button
          variant="outline"
          onclick={() => handleBoardConfirmation('reject')}
          class="gap-2"
        >
          <XIcon class="h-4 w-4" />
          Ablehnen
        </Button>
        
        <Button
          variant="outline"
          onclick={() => handleBoardConfirmation('adjust')}
          class="gap-2"
        >
          <RefreshCwIcon class="h-4 w-4" />
          Anpassen
        </Button>
        
        <Button
          onclick={() => handleBoardConfirmation('confirm')}
          class="gap-2"
        >
          <CheckCircleIcon class="h-4 w-4" />
          ? Best�tigen
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- Action Confirmation Dialog -->
{#if pendingAction}
  <ActionConfirmationDialog
    bind:open={showConfirmDialog}
    action={pendingAction}
    patternHash={pendingPatternHash}
    currentConfidence={pendingConfidence}
    threshold={0.8}
    usageCount={pendingUsageCount}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
    onExecuteOnce={handleExecuteOnce}
  />
{/if}

