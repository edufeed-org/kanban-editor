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
  import * as Dialog from '$lib/components/ui/dialog';
  import ActionConfirmationDialog from '$lib/components/ui/ActionConfirmationDialog.svelte';
  import { chatStore } from '$lib/stores/chatStore.svelte.js';
  import { userPreferencesStore } from '$lib/stores/userPreferencesStore.svelte.js';
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
  import {
    parseContentProposal,
    generateStructureFromContent,
    parseStructureProposal,
    structureToActions,
    validateStructureJSON,
    formatValidationError,
    type ContentProposal
  } from '$lib/utils/aiActionGenerator.js';
  
  // Props
  let {
    boardId
  }: {
    boardId: string;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // 🆕 2-Phase System State
  let currentContentProposal = $state<ContentProposal | null>(null);
  let showContentDialog = $state(false);
  let isGeneratingStructure = $state(false);
  let structureRetries = $state(0);
  let structureGenerationError = $state('');
  let phase1MarkdownContent = $state<string>(''); // 🆕 Phase 1 Markdown anzeigen
  let isPhase2Running = $state(false); // 🆕 Phase 2 läuft
  let phase2Toast = $state<string>(''); // 🆕 Toast Nachricht
  const MAX_STRUCTURE_RETRIES = 3;
  
  // 🆕 Intent Detection State
  let awaitingUserConfirmation = $state(false); // Wartet auf explizite Bestätigung
  let lastProposalContent = $state<string>(''); // Letzte LLM-Antwort für Retry
  let pendingProposal = $state<ContentProposal | null>(null); // Proposal wartet auf Bestätigung
  let waitingForConfirmation = $state(false); // Flag: Wartet auf User-Bestätigung
  let userIntent = $state<'explicit' | 'confirmation' | 'vague' | null>(null); // Detected intent
  
  // 🆕 Board Confirmation State
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
   * 🆕 Intent Detection: Prüft ob User explizit eine Aktion möchte
   * 
   * Explizite Intents:
   * - "Erstelle ein Board zu..."
   * - "Mach eine Karte in..."
   * - "Ja", "Ja bitte", "Los", "Mach das" (Bestätigung)
   * 
   * Vage Anfragen:
   * - "Reformation 7. Klasse" (ohne Verb)
   * → LLM soll fragen: "Soll ich ein Board erstellen?"
   */
  function detectUserIntent(userMessage: string): 'explicit' | 'confirmation' | 'vague' {
    const lowerMsg = userMessage.toLowerCase().trim();
    
    // Bestätigungen (nach LLM-Frage)
    const confirmationPhrases = [
      'ja', 'ja bitte', 'ja gerne', 'gerne', 'ok', 'okay',
      'mach das', 'los', 'go', 'setze um', 'umsetzen'
    ];
    
    if (confirmationPhrases.some(phrase => lowerMsg === phrase || lowerMsg.startsWith(phrase + ' '))) {
      return 'confirmation';
    }
    
    // Explizite Intents (Verben für Aktionen)
    const explicitVerbs = [
      'erstelle', 'mache', 'mach', 'generiere', 'lege an', 'erzeuge', 'baue',
      'füge hinzu', 'füg hinzu', 'hinzufügen', 'add',
      'ändere', 'bearbeite', 'aktualisiere', 'update', 'edit'
    ];
    
    const hasExplicitVerb = explicitVerbs.some(verb => lowerMsg.includes(verb));
    
    if (hasExplicitVerb) {
      return 'explicit';
    }
    
    // Vage Anfrage (kein erkennbares Verb)
    return 'vague';
  }
  
  /**
   * Phase 1: Parse KI-Antwort als Content-Vorschlag
   * 🆕 MIT Intent-Detection: Nur bei explizitem Intent oder Bestätigung → Phase 2
   * 
   * WICHTIG: chatStore.addMessage() wurde bereits in simulateAIResponse() aufgerufen!
   */
  async function handlePhase1Response(responseText: string, userIntent: 'explicit' | 'confirmation' | 'vague') {
    console.log('🔄 Phase 1: Parsing content proposal... (Intent:', userIntent, ')');
    
    const proposal = await parseContentProposal(responseText);
    currentContentProposal = proposal;
    
    // 🆕 Phase 1 Markdown speichern (bereits im Chat sichtbar von simulateAIResponse!)
    phase1MarkdownContent = proposal.content;
    lastProposalContent = responseText; // Für Retry speichern
    console.log('📝 Phase 1 Markdown gespeichert und bereits im Chat sichtbar');
    
    // 🆕 DECISION: Wann Phase 2 starten?
    
    // Fall 1: User hat expliziten Intent → Direkt Phase 2 starten
    if (userIntent === 'explicit' && proposal.canGenerate) {
      console.log('✅ Expliziter Intent erkannt → Starte Phase 2 direkt');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      isGeneratingStructure = true;
      structureRetries = 0;
      structureGenerationError = '';
      awaitingUserConfirmation = false;
      
      await generateBoardStructure();
      return;
    }
    
    // Fall 2: User bestätigt vorherigen Vorschlag → Phase 2 starten
    if (userIntent === 'confirmation' && awaitingUserConfirmation && proposal.canGenerate) {
      console.log('✅ User-Bestätigung erhalten → Starte Phase 2');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      isGeneratingStructure = true;
      structureRetries = 0;
      structureGenerationError = '';
      awaitingUserConfirmation = false;
      
      await generateBoardStructure();
      return;
    }
    
    // Fall 3: Vage Anfrage → LLM hat bereits geantwortet, warten auf Bestätigung
    if (userIntent === 'vague') {
      console.log('⏸️ Vage Anfrage → Warte auf User-Bestätigung für Phase 2');
      awaitingUserConfirmation = true;
      // Phase 2 wird NICHT gestartet! User muss bestätigen.
      return;
    }
    
    // Fall 4: Andere Fälle (z.B. kann nicht generieren)
    console.log('ℹ️ Phase 2 wird nicht gestartet (canGenerate:', proposal.canGenerate, ')');
    awaitingUserConfirmation = false;
  }
  
  /**
   * Phase 2: Generiere Struktur aus Proposal
   * 🆕 Mit Toast-Notification & Spinner
   */
  async function handleApproveProposal() {
    if (!currentContentProposal) return;
    
    showContentDialog = false;
    isGeneratingStructure = true;
    structureRetries = 0;
    structureGenerationError = '';
    
    chatStore.addMessage(
      '⏳ Generiere Board-Struktur als JSON...',
      'assistant'
    );
    
    await generateBoardStructure();
  }
  
  /**
   * Rekursive Struktur-Generierung mit Retry-Logik (FIXED!)
   * 
   * FIX: Nutzt jetzt sendToLLMWithSystem() mit spezialisi ertem System-Prompt
   * Das verhindert Prompt-Injections und stellt sicher, dass LLM valides JSON liefert
   */
  async function generateBoardStructure() {
    if (!currentContentProposal) return;
    
    if (structureRetries >= MAX_STRUCTURE_RETRIES) {
      chatStore.addMessage(
        `❌ Struktur-Generierung fehlgeschlagen nach ${MAX_STRUCTURE_RETRIES} Versuchen. Bitte versuchen Sie es später erneut.`,
        'assistant'
      );
      isGeneratingStructure = false;
      return;
    }
    
    try {
      // Generate ONLY user prompt (system prompt wird separat übergeben!)
      const userPrompt = generateStructureFromContent(
        currentContentProposal.content,
        { boardName: boardStore.uiData[0]?.name }
      );
      
      // SPEZIALISIERTEN System-Prompt für JSON-Generierung
      const systemPrompt = `Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.
Deine Aufgabe: Analysiere den Lerninhalt und generiere AUSSCHLIESSLICH eine valide JSON-Struktur.

REGELN (BEACHTE DIESE GENAU!):
1. Antworte NUR mit JSON - kein Text davor, kein Text danach
2. Keine Markdown-Code-Blöcke (keine \`\`\`json)
3. Valide JSON-Syntax (alle Strings in Anführungszeichen, kein Komma nach letztem Element)
4. Alle erforderlichen Felder: name, cards Array mit heading
5. Wenn unsicher: Einfach halten, aber struktur-treu

Beispiel OK:
{"columns":[{"name":"Phase 1","cards":[{"heading":"Einführung"}]}]}

Beispiel FALSCH:
\`\`\`json
{"columns": [...]}
\`\`\`

Jetzt generiere JSON für den Lerninhalt:`;

      // Send to LLM with CUSTOM system prompt!
      const { content: jsonResponse, error } = await chatStore.sendToLLMWithSystem(
        userPrompt,
        systemPrompt
      );
      
      if (error) {
        throw new Error(error);
      }

      // Log für Debugging
      console.log('📋 Raw JSON Response:', jsonResponse);
      
      // Validate JSON
      const validation = validateStructureJSON(jsonResponse);
      
      if (!validation.valid) {
        structureRetries++;
        structureGenerationError = validation.error || 'Unbekannter Fehler';
        
        console.log(`⚠️ Validation failed (Attempt ${structureRetries}/${MAX_STRUCTURE_RETRIES}):`, validation.error);
        console.log('📋 Response was:', jsonResponse.substring(0, 200));
        
        chatStore.addMessage(
          `⚠️ Versuch ${structureRetries}: ${formatValidationError(validation.error || 'Unbekannter Fehler')}`,
          'assistant'
        );
        
        // Retry
        await generateBoardStructure();
        return;
      }
      
      // Parse und execute actions
      const proposal = parseStructureProposal(jsonResponse);
      if (!proposal) {
        throw new Error('Failed to parse structure proposal');
      }
      
      chatStore.addMessage(
        `✅ Struktur generiert! Erstelle ${proposal.columns.length} Spalten mit ${proposal.columns.reduce((sum, c) => sum + c.cards.length, 0)} Karten...`,
        'assistant'
      );
      
      await processStructureAndCreateActions(proposal);
      
    } catch (err) {
      structureRetries++;
      const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      structureGenerationError = errorMsg;
      
      console.error(`❌ Generation error (Attempt ${structureRetries}):`, err);
      
      if (structureRetries < MAX_STRUCTURE_RETRIES) {
        chatStore.addMessage(
          `⚠️ Fehler bei Versuch ${structureRetries}: ${errorMsg}\nWiederhole...`,
          'assistant'
        );
        await generateBoardStructure();
      } else {
        chatStore.addMessage(
          `❌ Generierung fehlgeschlagen nach ${MAX_STRUCTURE_RETRIES} Versuchen: ${errorMsg}`,
          'assistant'
        );
        isGeneratingStructure = false;
      }
    }
  }
  
  /**
   * Konvertiere Struktur zu Aktionen und führe sie aus
   * 🆕 Mit Phase 2 Toast & Spinner
   * 🆕🆕 Mit Confirmation Dialog STATT direkter Ausführung
   */
  async function processStructureAndCreateActions(proposal: any) {
    try {
      const actions = structureToActions(proposal);
      console.log(`🎯 Generated ${actions.length} actions for preview...`);
      
      // 🆕 Phase 2 starten - Toast zeigen
      isPhase2Running = true;
      phase2Toast = `✅ Board-Struktur wird generiert... (${actions.length} Aktionen)`;
      
      // 🆕🆕 STATT: Direkt ausführen → Erstelle Preview
      // for (const action of actions) {
      //   await executeAction(action);
      // }
      
      // Erstelle Board-Preview aus Actions
      const preview = createBoardPreview(actions);
      
      // Speichere Actions für spätere Ausführung
      pendingBoardActions = actions;
      pendingBoardPreview = preview;
      
      // 🆕 Phase 2 erfolgreich - zeige Confirmation Dialog
      isPhase2Running = false;
      phase2Toast = '';
      
      // Zeige Confirmation Dialog
      showBoardConfirmationDialog = true;
      
      chatStore.addMessage(
        `✅ Board-Struktur generiert! ${preview.columns.length} Spalten mit ${preview.totalCards} Karten. Bitte bestätigen.`,
        'assistant'
      );
      
    } catch (err) {
      console.error('❌ Action generation error:', err);
      phase2Toast = '';
      isPhase2Running = false;
      chatStore.addMessage(
        `❌ Fehler bei Board-Generierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
        'assistant'
      );
    } finally {
      isGeneratingStructure = false;
    }
  }
  
  /**
   * 🆕 Erstelle Board-Preview aus Actions
   * Zeigt Spalten-Namen und Karten-Titel ohne tatsächlich zu speichern
   */
  function createBoardPreview(actions: AIAction[]) {
    const columns: Array<{ name: string; cardCount: number; cards: string[] }> = [];
    let currentColumn: { name: string; cardCount: number; cards: string[] } | null = null;
    
    for (const action of actions) {
      if (action.type === 'add_column') {
        // Neuer Spalte
        currentColumn = {
          name: action.name,
          cardCount: 0,
          cards: []
        };
        columns.push(currentColumn);
      } else if (action.type === 'add_card' && currentColumn) {
        // Karte zur aktuellen Spalte hinzufügen
        currentColumn.cards.push(action.heading);
        currentColumn.cardCount++;
      }
    }
    
    const totalCards = columns.reduce((sum, col) => sum + col.cardCount, 0);
    
    return { columns, totalCards };
  }
  
  /**
   * 🆕 Handler für Board Confirmation Dialog
   * 
   * @param action - 'confirm' | 'reject' | 'adjust'
   */
  async function handleBoardConfirmation(action: 'confirm' | 'reject' | 'adjust') {
    switch (action) {
      case 'confirm':
        // ✅ BESTÄTIGEN: Board speichern + Learning aktivieren
        console.log('✅ User bestätigt Board-Struktur');
        
        try {
          // Führe alle Actions aus
          for (const act of pendingBoardActions) {
            await executeAction(act);
          }
          
          chatStore.addMessage(
            `✅ Board erfolgreich erstellt! ${pendingBoardActions.length} Aktionen ausgeführt.`,
            'assistant'
          );
          
          // 🆕 LearningManager: Lerne von diesem Board!
          // TODO Phase 2: boardLearningManager Integration
          // if (boardLearningManager?.isEnabled) {
          //   const results = boardLearningManager.learnBoardStructure();
          //   console.log('✨ Patterns gelernt:', results);
          //   chatStore.addMessage(
          //     `✨ Pattern gelernt! Beim nächsten Mal kann ich ähnliche Boards schneller erstellen.`,
          //     'assistant'
          //   );
          // }
          
        } catch (err) {
          console.error('❌ Board creation error:', err);
          chatStore.addMessage(
            `❌ Fehler beim Erstellen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
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
        // ❌ ABLEHNEN: Verwerfen und zurück zu Input
        console.log('❌ User lehnt Board-Struktur ab');
        
        chatStore.addMessage(
          '❌ Board-Struktur abgelehnt. Was möchtest du anders haben?',
          'assistant'
        );
        
        showBoardConfirmationDialog = false;
        pendingBoardActions = [];
        pendingBoardPreview = null;
        currentContentProposal = null;
        break;
        
      case 'adjust':
        // 🔄 ANPASSEN: Neue Phase 1 mit Context
        console.log('🔄 User möchte Board-Struktur anpassen');
        
        // Erstelle Anpassungs-Kontext
        const adjustmentContext = `
Der Benutzer hat folgende Board-Struktur erhalten:

${pendingBoardPreview?.columns.map(col => 
  `- Spalte "${col.name}" mit ${col.cardCount} Karten:\n  ${col.cards.map(c => `  • ${c}`).join('\n')}`
).join('\n')}

Der Benutzer möchte Anpassungen vornehmen. Bitte zeige eine VERBESSERTE Struktur, basierend auf den folgenden Wünschen:
`;
        
        chatStore.addMessage(
          '🔄 Was möchtest du an der Struktur ändern? (Spalten umbenennen, Karten hinzufügen/entfernen, etc.)',
          'assistant'
        );
        
        // Setze Input mit Context vor (User kann ergänzen)
        userInput = ''; // User muss eigene Wünsche eingeben
        
        // Speichere Context für nächste LLM-Anfrage
        // TODO: Context in chatStore speichern für nächste Anfrage
        
        showBoardConfirmationDialog = false;
        // Behalte pendingBoardActions/Preview für Vergleich (optional)
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
   * Generate intent-aware system prompt
   */
  function getIntentAwareSystemPrompt(intent: 'explicit' | 'confirmation' | 'vague'): string {
    switch (intent) {
      case 'vague':
        return `Du bist ein Lern-Assistent für Kanban-Board-Erstellung.

Der User hat eine VAGE Anfrage gestellt (nur ein Thema oder Konzept genannt, ohne explizite Aufforderung).

Deine Aufgabe:
1. Fasse kurz zusammen, was du verstanden hast
2. Frage EXPLIZIT: "Soll ich ein Board zu [Thema] erstellen?"
3. Erstelle KEINE Struktur - warte auf Bestätigung

Beispiel:
User: "Reformation 7. Klasse"
Du: "Ich verstehe, du möchtest Materialien zur Reformation für die 7. Klasse strukturieren. Soll ich ein Kanban-Board mit Spalten und Karten zu diesem Thema erstellen?"`;
      
      case 'explicit':
        return `Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.

Der User hat EXPLIZIT eine Aktion angefordert (z.B. "Erstelle ein Board zu...").

Erstelle sofort eine Struktur im Markdown-Format:
# [Thema]
## Spalte 1: [Name]
- Karte: [Titel]
## Spalte 2: [Name]
- Karte: [Titel]
...

Die Struktur sollte pädagogisch sinnvoll sein mit Spalten für verschiedene Lernphasen.`;
      
      case 'confirmation':
        return `Du bist ein Lern-Assistent.

Der User hat eine BESTÄTIGUNG gegeben (z.B. "Ja bitte", "mach das").

Antworte kurz bestätigend: "Alles klar! Ich erstelle das Board jetzt."
Dann erstelle die Struktur im Markdown-Format:
# [Thema]
## Spalte 1: [Name]
- Karte: [Titel]
...`;
    }
  }

  /**
   * Send message to LLM and process response
   */
  async function simulateAIResponse(userMessage: string) {
    console.log('🔍 User Message:', userMessage);
    
    // 🆕 Step 1: Detect User Intent
    const intent = detectUserIntent(userMessage);
    userIntent = intent;
    console.log('🎯 Detected Intent:', intent);
    
    // 🆕 Step 2: Get intent-aware system prompt
    const systemPrompt = getIntentAwareSystemPrompt(intent);
    console.log('📋 System Prompt Type:', intent);
    
    // Step 3: Get board context for AI
    const boardContext = boardStore.getContextData(false);
    
    // 🆕 Step 4: Send to LLM with CUSTOM system prompt (intent-aware)
    // Signature: sendToLLMWithSystem(userMessage, systemPrompt, boardContext?)
    const { content, error } = await chatStore.sendToLLMWithSystem(
      userMessage,
      systemPrompt,  // ← Intent-aware prompt!
      boardContext
    );
    
    if (error) {
      chatStore.addMessage(error, 'assistant');
      return;
    }
    
    // Step 5: Add LLM response text
    chatStore.addMessage(content, 'assistant');
    
    // 🆕 Step 6: Phase 1 Handler with Intent
    await handlePhase1Response(content, intent);
    
    // 🆕 (Old fallback kept for backward compatibility)
    // Try to parse JSON response from LLM (supports multiple actions)
    let actions: AIAction[] = [];
    let responseText = content;
    let actionDescription = '';
    
    try {
      // Check if response is JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('📦 Parsed JSON from LLM:', parsed);
        
        // Extract response text
        if (parsed.response) {
          responseText = parsed.response;
        }
        
        // 🆕 Support for multiple actions (array) or single action
        const actionData = parsed.actions || (parsed.action ? [parsed.action] : []);
        
        for (const actionItem of actionData) {
          if (!actionItem || !actionItem.type) continue;
          
          let action: AIAction | null = null;
          const actionType = actionItem.type;
          const details = actionItem.details || {};
          
          switch (actionType) {
            case 'add_column':
              action = {
                type: 'add_column',
                columnName: details.columnName || 'Neue Spalte'
                // Note: color is not used - boardStore.createColumn() always uses 'slate'
              };
              console.log('🎯 Action: add_column', details);
              break;
              
            case 'add_card':
              // 🆕 Smart column selection: Use columnName if provided, otherwise last created column, otherwise first column
              let targetColumnId = details.columnId;
              
              if (!targetColumnId && details.columnName) {
                // Find column by name
                const columns = boardStore.uiData;
                const foundColumn = columns.find(c => c.name === details.columnName);
                targetColumnId = foundColumn?.id;
              }
              
              if (!targetColumnId) {
                // Use last created column (likely from previous action in sequence)
                const columns = boardStore.uiData;
                targetColumnId = columns.length > 0 ? columns[columns.length - 1].id : null;
              }
              
              if (targetColumnId) {
                action = {
                  type: 'add_card',
                  columnId: targetColumnId,
                  heading: details.heading || 'Neue Karte',
                  content: details.content || ''
                };
                console.log('🎯 Action: add_card', details);
              }
              break;
              
            case 'split_card':
              action = {
                type: 'split_card',
                sourceCardId: details.sourceCardId || 'mock-card-id',
                columnId: details.columnId || 'mock-column-id',
                newCards: details.newCards || [
                  { heading: 'Subtask 1' },
                  { heading: 'Subtask 2' },
                  { heading: 'Subtask 3' }
                ]
              };
              console.log('🎯 Action: split_card', details);
              break;
              
            case 'move_card':
              action = {
                type: 'move_card',
                cardId: details.cardId,
                fromColumnId: details.fromColumnId,
                toColumnId: details.toColumnId
              };
              console.log('🎯 Action: move_card', details);
              break;
          }
          
          if (action) {
            actions.push(action);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ No JSON in LLM response, using plain text');
      
      // 🔄 FALLBACK: Try keyword-based detection if no JSON
      const lowerMessage = responseText.toLowerCase();
      const lowerUserMessage = userMessage.toLowerCase();
      
      // Check if user requested board creation
      const userRequestsCreation = (lowerUserMessage.includes('erstell') || 
                                   lowerUserMessage.includes('create') ||
                                   lowerUserMessage.includes('leg') ||
                                   lowerUserMessage.includes('anlegen'));
      
      // Check if this is a multi-column creation (LLM listed columns in RESPONSE)
      // Format 1: **Kolumne X: Name**
      let columnMatches = responseText.match(/\*\*Kolumne \d+: (.+?)\*\*/gi);
      
      // Format 2: **Spalte X: Name**
      if (!columnMatches || columnMatches.length === 0) {
        columnMatches = responseText.match(/\*\*Spalte \d+: (.+?)\*\*/gi);
      }
      
      // Format 3: ### **Spalte X: Name** (with heading)
      if (!columnMatches || columnMatches.length === 0) {
        columnMatches = responseText.match(/###\s+\*\*Spalte \d+: (.+?)\*\*/gi);
      }
      
      // Only auto-create if user explicitly requested it
      if (columnMatches && columnMatches.length > 0 && userRequestsCreation) {
        // Extract all column names from markdown format
        console.log('🎯 FALLBACK: User requested creation, detected multiple columns from list', columnMatches);
        
        for (const match of columnMatches) {
          const nameMatch = match.match(/(?:Kolumne|Spalte) \d+: (.+?)\*\*/i);
          if (nameMatch && nameMatch[1]) {
            const columnName = nameMatch[1].trim();
            actions.push({
              type: 'add_column',
              columnName: columnName
            });
            console.log('🎯 FALLBACK Action: add_column', { columnName });
            
            // Try to extract cards for this column (lines starting with - after the column)
            const columnIndex = responseText.indexOf(match);
            const nextColumnIndex = responseText.indexOf('**Spalte', columnIndex + match.length);
            const columnSection = nextColumnIndex > 0 
              ? responseText.substring(columnIndex, nextColumnIndex)
              : responseText.substring(columnIndex);
            
            // Match lines starting with - (with optional emoji and **bold**)
            const cardLines = columnSection.match(/^-\s+(.+)$/gm);
            if (cardLines && cardLines.length > 0) {
              console.log('🎯 FALLBACK: Found', cardLines.length, 'cards for column', columnName);
              
              for (const cardLine of cardLines) {
                let cardText = cardLine.substring(1).trim(); // Remove "-"
                
                // Remove emoji if present (emoji at start)
                cardText = cardText.replace(/^[^\w\s]+\s*/, '');
                
                // Remove **bold** markdown
                cardText = cardText.replace(/\*\*(.+?)\*\*/g, '$1');
                
                // Remove any remaining markdown or special chars
                cardText = cardText.trim();
                
                if (cardText && cardText.length > 3) {
                  actions.push({
                    type: 'add_card',
                    heading: cardText,
                    content: '',
                    columnName: columnName
                  });
                  console.log('🎯 FALLBACK Action: add_card', { heading: cardText, columnName });
                }
              }
            }
          }
        }
      } else if ((lowerMessage.includes('spalte') || lowerMessage.includes('column')) && 
                 (lowerMessage.includes('erstell') || lowerMessage.includes('create'))) {
        // Single column creation
        let columnName = 'Neue Spalte';
        
        const quotesMatch = userMessage.match(/"([^"]+)"|'([^']+)'|„([^"]+)"|"([^"]+)"/);
        if (quotesMatch) {
          columnName = quotesMatch[1] || quotesMatch[2] || quotesMatch[3] || quotesMatch[4];
        } else {
          // Try to extract after "Spalte" or "namens"
          const afterMatch = userMessage.match(/(?:spalte|column)\s+["']?(\w+)["']?/i) ||
                            userMessage.match(/namens\s+["']?(\w+)["']?/i);
          if (afterMatch) {
            columnName = afterMatch[1];
          }
        }
        
        actions.push({
          type: 'add_column',
          columnName: columnName
        });
        actionDescription = `➕ Spalte hinzufügen: "${columnName}"`;
        console.log('🎯 FALLBACK Action: add_column', { columnName });
      }
      
    }
    
    // 🆕 Process multiple actions sequentially
    if (actions.length > 0) {
      console.log(`🎯 Processing ${actions.length} action(s)`);
      
      // If multiple actions, show summary message
      if (actions.length > 1) {
        chatStore.addMessage(
          `📋 Ich führe ${actions.length} Aktionen aus: ${actions.map((a, i) => `${i + 1}. ${getActionDescription(a)}`).join(', ')}`,
          'assistant'
        );
      }
      
      // Process first action with confidence check
      const firstAction = actions[0];
      const result = await chatStore.checkActionConfidence(firstAction);
      console.log('🎯 Confidence check result:', result);
      
      // Store remaining actions for sequential execution
      const remainingActions = actions.slice(1);
      
      if (result.shouldAutoExecute && remainingActions.length === 0) {
        // Auto-execute single action
        const desc = getActionDescription(firstAction);
        chatStore.addMessage(
          `✅ Aktion wird automatisch ausgeführt (Confidence: ${Math.round(result.confidence * 100)}%): ${desc}`,
          'assistant'
        );
        
        await executeAction(firstAction);
        chatStore.recordActionSuccess(result.patternHash, true);
      } else if (result.shouldAutoExecute && remainingActions.length > 0) {
        // Auto-execute first, then process remaining
        await executeAction(firstAction);
        chatStore.recordActionSuccess(result.patternHash, true);
        
        // Process remaining actions
        for (const action of remainingActions) {
          await executeAction(action);
        }
        
        chatStore.addMessage(
          `✅ Alle ${actions.length} Aktionen erfolgreich ausgeführt!`,
          'assistant'
        );
      } else {
        // Show confirmation dialog
        const desc = getActionDescription(firstAction);
        chatStore.addMessage(
          `🤔 Ich schlage vor: ${desc}. Confidence: ${Math.round(result.confidence * 100)}%. Möchten Sie bestätigen?`,
          'assistant'
        );
        
        pendingAction = firstAction;
        pendingPatternHash = result.patternHash;
        pendingConfidence = result.confidence;
        pendingUsageCount = result.usageCount;
        showConfirmDialog = true;
        
        // Store remaining actions for later
        if (remainingActions.length > 0) {
          (pendingAction as any)._remainingActions = remainingActions;
        }
        
        console.log('🎯 Confirmation dialog prepared, showing...');
      }
    }
  }
  
  /**
   * Get human-readable description of action
   */
  function getActionDescription(action: AIAction): string {
    switch (action.type) {
      case 'add_column':
        return `➕ Spalte "${(action as any).columnName}"`;
      case 'add_card':
        return `➕ Karte "${(action as any).heading}"`;
      case 'split_card':
        return `📋 Karte aufteilen`;
      case 'move_card':
        return `🔄 Karte verschieben`;
      case 'update_card':
        return `✏️ Karte bearbeiten`;
      default:
        return `🤖 ${action.type}`;
    }
  }
  
  /**
   * Track column ID mapping during execution
   * Map from column name (from AI) to actual column ID (from boardStore)
   */
  let columnNameToIdMap: Record<string, string> = {};
  
  /**
   * Execute AI action via boardStore
   */
  function executeAction(action: AIAction) {
    console.log('🤖 Executing action:', action);
    
    try {
      switch (action.type) {
        case 'add_column': {
          const colName = (action as any).columnName || 'Neue Spalte';
          // Note: boardStore.createColumn() only accepts name parameter
          // color is always set to 'slate' internally
          const colId = boardStore.createColumn(colName);
          console.log('✅ Column created:', colId);
          
          // Store the mapping for add_card actions
          columnNameToIdMap[colName] = colId;
          console.log('📌 Column name→ID mapping:', columnNameToIdMap);
          
          chatStore.addMessage(
            `✅ Spalte "${colName}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'add_card': {
          const heading = (action as any).heading || 'Neue Karte';
          const content = (action as any).content || '';
          
          // Try to find columnId in two ways:
          // 1. Direct columnId (if already mapped)
          // 2. Look up via columnName in our mapping
          let columnId = (action as any).columnId;
          
          if (!columnId && (action as any).columnName) {
            columnId = columnNameToIdMap[(action as any).columnName];
          }
          
          if (!columnId) {
            throw new Error(`Spalten-ID fehlt (columnName: "${(action as any).columnName}")`);
          }
          
          const cardId = boardStore.createCard(columnId, heading, content);
          console.log('✅ Card created:', cardId);
          chatStore.addMessage(
            `✅ Karte "${heading}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'split_card': {
          // TODO: Implement split_card when boardStore has this method
          console.log('⚠️ split_card not yet implemented in boardStore');
          chatStore.addMessage(
            '⚠️ Karte aufteilen ist noch nicht implementiert.',
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
          console.log('✅ Card updated:', cardId);
          chatStore.addMessage(
            '✅ Karte erfolgreich aktualisiert!',
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
          console.log('✅ Card moved:', cardId);
          chatStore.addMessage(
            '✅ Karte erfolgreich verschoben!',
            'assistant'
          );
          break;
        }
        
        default:
          console.warn('⚠️ Unknown action type:', action.type);
          chatStore.addMessage(
            `⚠️ Aktion "${action.type}" ist nicht implementiert.`,
            'assistant'
          );
      }
      
    } catch (error) {
      console.error('❌ Action execution failed:', error);
      chatStore.addMessage(
        `❌ Fehler beim Ausführen der Aktion: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
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
    
    // 🆕 Process remaining actions if any
    const remainingActions = (pendingAction as any)._remainingActions || [];
    if (remainingActions.length > 0) {
      chatStore.addMessage(
        `⏳ Führe ${remainingActions.length} weitere Aktion(en) aus...`,
        'assistant'
      );
      
      for (const action of remainingActions) {
        await executeAction(action);
      }
      
      chatStore.addMessage(
        `✅ Alle ${remainingActions.length + 1} Aktionen erfolgreich ausgeführt!`,
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
        
        <!-- 🆕 Phase 2 Spinner (unter Markdown) -->
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
  
  <!-- 🆕 Toast Notification (oben rechts, überlagert) -->
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

<!-- 🆕 Content Proposal Dialog (Phase 1) -->
{#if currentContentProposal}
  <Dialog.Root bind:open={showContentDialog}>
    <Dialog.Content class="max-w-md">
      <Dialog.Header>
        <Dialog.Title>📋 Board-Struktur generieren?</Dialog.Title>
      </Dialog.Header>
      
      <div class="space-y-4 py-4">
        <div>
          <p class="text-sm font-medium mb-2">Erkannter Titel:</p>
          <p class="text-sm text-muted-foreground">{currentContentProposal.title}</p>
        </div>
        
        <div>
          <p class="text-sm font-medium mb-2">Erkannte Struktur:</p>
          <Badge variant="outline" class="text-xs">
            {currentContentProposal.structure === 'spalten-mit-karten' ? '📊 Spalten mit Karten' :
             currentContentProposal.structure === 'phasen' ? '📅 Phasen-Struktur' :
             currentContentProposal.structure === 'nur-karten' ? '📇 Karten-Liste' :
             '❓ Unbekannt'}
          </Badge>
        </div>
        
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
            ✨ Generieren
          {/if}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}

<!-- 🆕🆕 Board Confirmation Dialog (Phase 2 Complete) -->
{#if showBoardConfirmationDialog && pendingBoardPreview}
  <Dialog.Root bind:open={showBoardConfirmationDialog}>
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
      <Dialog.Header>
        <Dialog.Title>✨ Board-Struktur bestätigen?</Dialog.Title>
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
                      • {card}
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
            <strong>✅ Bestätigen:</strong> Board wird gespeichert und das System lernt von dieser Struktur.
          </p>
          <p class="text-xs text-blue-900 mb-2">
            <strong>🔄 Anpassen:</strong> Sie können Änderungswünsche äußern und eine neue Struktur erhalten.
          </p>
          <p class="text-xs text-blue-900">
            <strong>❌ Ablehnen:</strong> Board wird verworfen, keine Speicherung.
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
          ✅ Bestätigen
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
    threshold={confidenceThreshold}
    usageCount={pendingUsageCount}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
    onExecuteOnce={handleExecuteOnce}
  />
{/if}

