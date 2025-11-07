# 🧠 LearningManager + 2-Phase System Integration

**Datum:** 5. November 2025  
**Status:** 📋 Design-Dokumentation (nicht implementiert)

---

## 🎯 Die Frage: Wie passt das zusammen?

**User-Intent:** "Sollte Phase 1 wiederholt werden, bis der User die Umsetzung im Board bestätigt?"

**Das Puzzle hat 3 Teile:**

1. **2-Phase AI System** (AKTUELL ✅ IMPLEMENTIERT)
   - Phase 1: User-Anfrage → LLM-Vorschlag (Markdown)
   - Phase 2: Markdown → Board-Struktur (automatische Umsetzung)

2. **LearningManager** (EXISTIERT aber NICHT INTEGRIERT)
   - Speichert gelehrte Spalten-Strukturen (z.B. "Materialien"-Spalte)
   - Speichert gelehrte Karten-Templates (z.B. häufige Labels)
   - Könnte bei nächster Planung automatisch angewendet werden

3. **User Confirmation Loop** (NOCH ZU IMPLEMENTIEREN)
   - After Phase 2: Board zeigen mit Bestätigungs-Dialog
   - User kann: Bestätigen → Lernen, Ablehnen → Verwerfen, Anpassen → Phase 1 neu

---

## 📊 Die 3 möglichen Szenarien

### Szenario A: Aktuell (Keine Learning, Keine Confirmation)

```
User Input
    ↓
Phase 1: LLM erzeugt Markdown
    ↓
Chat zeigt Markdown (SINGLE INSTANCE ✅)
    ↓
Phase 2: Auto → Board generiert
    ↓
Toast: "✅ Fertig! 35 Aktionen ausgeführt"
    ↓
FERTIG! (Keine Confirmation, Keine Learning)
```

**Vorteile:** Schnell, einfach
**Nachteile:** Wenn Board falsch → User muss manuell korrigieren, nichts gelernt

---

### Szenario B: Mit Confirmation (Deine Frage!)

```
User Input
    ↓
Phase 1: LLM erzeugt Markdown
    ↓
Chat zeigt Markdown
    ↓
Phase 2: Auto → Board generiert
    ↓
🆕 Toast: "Board erstellt. Gefällt dir die Struktur?"
      [✅ Bestätigen] [❌ Ablehnen] [🔄 Anpassen]
    ↓
(User macht Wahl)
```

**Option 1: User klickt ✅ Bestätigen**
```
    → 🆕 LearningManager.learnBoardStructure()
    → Speichert alle Spalten-Namen + Karten-Templates
    → userPreferencesStore aktualisiert
    → FERTIG!
```

**Option 2: User klickt ❌ Ablehnen**
```
    → Board wird NICHT gespeichert
    → Zurück zu Eingabe-Form
    → Neue Phase 1 (mit anderen Parametern?)
    → NEUER VERSUCH
```

**Option 3: User klickt 🔄 Anpassen**
```
    → Board ZWISCHENSPEICHERN (für Vergleich später)
    → Zurück zu Phase 1 (mit Current Board als Context?)
    → Neue Suggestion basierend auf bisheriger Struktur
    → Iterativer Prozess
```

---

### Szenario C: Vollständiger Learning Loop (Phase 1 repeats)

```
User Input ("Reformation 7. Klasse")
    ↓
Phase 1.1: LLM erzeugt Markdown-Vorschlag #1
    ↓
🆕 Confirmation Dialog:
      [✅] [❌] [🔄 Anpassen]
    ↓
User klickt 🔄 Anpassen
    ↓
Phase 1.2: LLM erzeugt NEUE Markdown-Vorschlag #2
           (Mit Context: "Benutzer wünscht sich mehr Fokus auf...")
    ↓
🆕 Chat zeigt: Phase 1.2-Vorschlag
    ↓
Confirmation Dialog wieder...
    ↓
(Repeat bis User ✅ Bestätigt)
    ↓
✅ User Confirmation
    ↓
🆕 LearningManager.learnBoardStructure()
    → Pattern gespeichert
    ↓
FERTIG! Nächste Reformation-Planung nutzt Template
```

---

## 🔗 Das Zusammenspiel: Wo passen die Teile zusammen?

### Die Klammer: `AIPanel.svelte` Komponente

Aktuell (FUNKTIONIERT):
```typescript
// src/routes/cardsboard/AIPanel.svelte

let userInput = $state('');
let currentContentProposal = $state<ContentProposal | null>(null);

// Phase 1: LLM-Anfrage
async function handleSendMessage() {
  const response = await sendToLLMWithSystem(userInput);
  await handlePhase1Response(response);  // ← Phase 1 parsen
}

// Phase 2: Struktur generieren
async function handlePhase1Response(responseText: string) {
  const proposal = await parseContentProposal(responseText);
  currentContentProposal = proposal;
  phase1MarkdownContent = proposal.content;
  
  if (proposal.canGenerate) {
    await generateBoardStructure();  // ← Phase 2 auto-start
  }
}
```

---

### 🆕 Erweiterung 1: Confirmation Dialog hinzufügen

**Neu in `AIPanel.svelte`:**

```typescript
// State für Confirmation
let showBoardConfirmationDialog = $state(false);
let pendingBoard = $state<Board | null>(null);

// Nach Phase 2: Show Confirmation Dialog
async function processStructureAndCreateActions(proposal: any) {
  try {
    const actions = structureToActions(proposal);
    
    // Erstelle Board (aber speichere noch nicht!)
    const tempBoard = boardStore.createBoardFromActions(actions);
    
    // STATT: Direkt zu speichern → Show Dialog!
    // ALT: boardStore.syncBoardState(...)
    
    // 🆕 NEU: Board zeigen und auf Bestätigung warten
    pendingBoard = tempBoard;
    showBoardConfirmationDialog = true;
  } catch (err) {
    console.error('Phase 2 failed:', err);
  }
}

// Handler für Bestätigungs-Dialog
async function handleBoardConfirmation(action: 'confirm' | 'reject' | 'adjust') {
  switch (action) {
    case 'confirm':
      // ✅ BESTÄTIGEN: Board speichern + LERNEN
      boardStore.syncBoardState(...);
      
      // 🆕 LearningManager: Lerne von diesem Board!
      if (boardLearningManager?.isEnabled) {
        const results = boardLearningManager.learnBoardStructure();
        console.log('✨ Patterns gelernt:', results);
      }
      
      showBoardConfirmationDialog = false;
      pendingBoard = null;
      break;
      
    case 'reject':
      // ❌ ABLEHNEN: Verwerfen
      showBoardConfirmationDialog = false;
      pendingBoard = null;
      userInput = '';  // Clear input
      break;
      
    case 'adjust':
      // 🔄 ANPASSEN: Neue Phase 1 mit Context
      showBoardConfirmationDialog = false;
      
      // Board ZWISCHENSPEICHERN für Context
      const boardContext = JSON.stringify(pendingBoard?.getContextData());
      
      // Phase 1 NEU mit Anpassungs-Kontext
      const adjustmentPrompt = `
        Der Benutzer hat folgende Struktur erhalten:
        ${boardContext}
        
        Er möchte folgende Anpassung:
        ${userInput}
        
        Bitte zeige die ANGEPASSTE Struktur.
      `;
      
      userInput = adjustmentPrompt;
      pendingBoard = null;
      
      // Trigger neue Phase 1
      await handleSendMessage();
      break;
  }
}
```

**Template-Erweiterung:**

```svelte
<!-- 🆕 Confirmation Dialog nach Phase 2 -->
{#if showBoardConfirmationDialog && pendingBoard}
  <Dialog.Root bind:open={showBoardConfirmationDialog}>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Board-Struktur bestätigen?</Dialog.Title>
      </Dialog.Header>
      
      <!-- Preview des generierten Boards -->
      <div class="space-y-4">
        <div class="text-sm text-muted-foreground">
          {pendingBoard.columns.length} Spalten, 
          {pendingBoard.columns.reduce((s, c) => s + c.cards.length, 0)} Karten
        </div>
        
        <!-- Spalten-Übersicht -->
        {#each pendingBoard.columns as column}
          <div class="border-l-2 border-blue-500 pl-3">
            <p class="font-semibold text-sm">{column.name}</p>
            <div class="text-xs text-muted-foreground mt-1">
              {column.cards.length} Karten: {column.cards.map(c => c.heading).join(', ')}
            </div>
          </div>
        {/each}
      </div>
      
      <!-- Buttons -->
      <Dialog.Footer class="flex gap-2">
        <Button 
          variant="outline"
          onclick={() => handleBoardConfirmation('reject')}
        >
          ❌ Ablehnen
        </Button>
        
        <Button 
          variant="outline"
          onclick={() => handleBoardConfirmation('adjust')}
        >
          🔄 Anpassen
        </Button>
        
        <Button 
          onclick={() => handleBoardConfirmation('confirm')}
        >
          ✅ Bestätigen
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
```

---

### 🆕 Erweiterung 2: LearningManager Integration

**Neu in `BoardStore`:**

```typescript
// In src/lib/stores/kanbanStore.svelte.ts

import { boardLearningManager, initializeLearningManager } from './boardLearningManager.svelte.js';

export class BoardStore {
  private useLearningManager = false;
  
  constructor(useLearningManager: boolean = false) {
    this.useLearningManager = useLearningManager;
    
    if (useLearningManager) {
      initializeLearningManager(this);
    }
  }
  
  // 🆕 NEW: Neue Methode für Creating Board from Actions
  // (aktuell: createCard/addColumn - aber wir brauchen Atomic!)
  public createBoardFromActions(actions: AIAction[]): Board {
    // Erstelle Temporäres Board (wird noch nicht gespeichert!)
    const tempBoard = new Board({
      id: generateDTag(),
      name: this.data.name  // Könnte auch vom LLM kommen
    });
    
    // Wende alle Actions an
    for (const action of actions) {
      // ... executeAction logic ...
    }
    
    return tempBoard;  // Vor-Ansicht für User
  }
}
```

---

## 🧠 Die Learning Pipeline

### Aktuell (Nicht Implementiert):

```
Phase 1: "Reformation 7. Klasse"
    ↓
Phase 2: Board mit Standard-Spalten
    ↓
KEIN Learning passiert
```

### Mit Confirmation + Learning:

```
Phase 1: "Reformation 7. Klasse"
    ↓
Phase 2: Board generiert
    ↓
🆕 Confirmation Dialog (User klickt ✅)
    ↓
🆕 boardLearningManager.learnBoardStructure()
    ├→ boardLearningManager.learnColumnStructure('col-id-1')
    │  └→ Extrahiert: ["Einstieg", "Erarbeitungsphase", "Sicherung"]
    │  └→ userPreferencesStore.learnCardTemplate('Erarbeitungsphase', 
    │       ['Video anschauen', 'Arbeitsblatt', 'Diskussion'])
    │
    ├→ boardLearningManager.learnColumnStructure('col-id-2')
    │  └→ userPreferencesStore.learnCardTemplate('Materialien', [...])
    │
    └→ Confidence: 0.85 → userPreferencesStore speichert Pattern
    
    ↓
🆕 Pattern gespeichert! (confidence 0.85)
    ↓
Nächste Planung: "Mittelalter 7. Klasse"
    ├→ userPreferencesStore schlägt vor: "Willst du Template von Reformation nutzen?"
    └→ Oder: Auto-Anwendung wenn Pattern sehr ähnlich (confidence > 0.9)
```

---

## 🗓️ Die Implementation Roadmap

### Phase 1: TODAY - Confirmation Dialog ✅

```typescript
// ✅ SOFORT implementierbar
1. handleBoardConfirmation() Methode in AIPanel.svelte
2. Confirmation Dialog UI mit Preview
3. Three Button Handler: Confirm / Reject / Adjust

TimeEstimate: 2-3 Stunden
```

### Phase 2: Learning Integration (1-2 Tage später)

```typescript
// Nach Confirmation stabilisiert
1. boardLearningManager.learnBoardStructure() nach Bestätigung aufrufen
2. userPreferencesStore speichert Patterns
3. Show Toast: "✨ Pattern gelernt: Reformation (confidence 0.85)"

TimeEstimate: 2-3 Stunden
```

### Phase 3: Learning Application (1-2 Tage später)

```typescript
// Nächste Benutzersession
1. Prüfe: Gibt es ähnliche Patterns? (similarity matching)
2. Zeige Suggestion: "Ähnlicher zu Reformation-Pattern?"
3. Auto-Apply wenn User klickt "Ja"

TimeEstimate: 4-5 Stunden (complex pattern matching)
```

---

## 📋 DECISION TABLE

| Frage | Antwort | Implikation |
|-------|--------|-----------|
| **Soll Phase 1 repeat werden?** | JA (wenn User Anpassung wünscht) | Ajustment Prompt in Phase 1.2 |
| **Wann lernt das System?** | Nach User-Bestätigung | `handleBoardConfirmation('confirm')` |
| **Was wird gelernt?** | Spalten-Namen + Karten-Templates | `learnBoardStructure()` |
| **Wann wird Template angewendet?** | Bei nächster ähnlicher Anfrage | `getCardTemplate()` + Similarity |
| **Muss User zustimmen?** | JA! (für Pattern Learning) | Ohne Confirmation = kein Learning |

---

## ✅ RECOMMENDED IMPLEMENTATION ORDER

**Schritt 1: TODAY (2-3h)**
- [ ] Add Confirmation Dialog nach Phase 2
- [ ] Add Three Buttons: Confirm / Reject / Adjust
- [ ] Handle "Adjust" → neue Phase 1 mit Context

**Schritt 2: Tomorrow (2-3h)**
- [ ] Call `boardLearningManager.learnBoardStructure()` on Confirm
- [ ] Show Success Toast: "✨ Pattern gelernt"
- [ ] Verify patterns in localStorage

**Schritt 3: Day After (4-5h)**
- [ ] Implement Pattern Matching (similarity algorithm)
- [ ] Add Template Suggestion UI
- [ ] Test with multiple lesson plans

---

## 🎯 User-Szenario: Praktisches Beispiel

```
SESSION 1: Reformation vorbereiten
─────────────────────────────────

User: "Ich möchte eine Unterrichtseinheit zur Reformation vorbereiten"

Phase 1: LLM schlägt vor:
  - Spalten: Einstieg | Erarbeitungsphase | Sicherung | Hausaufgaben
  - Karten: Wie geplant

User: ✅ Bestätigen

System:
  ✨ Pattern gelernt: "Reformation" 
  ├─ Spalten: [Einstieg, Erarbeitungsphase, Sicherung, Hausaufgaben]
  └─ Confidence: 0.88


SESSION 2: Mittelalter vorbereiten (1 Woche später)
─────────────────────────────────────────────

User: "Ich möchte eine Unterrichtseinheit zum Mittelalter vorbereiten"

Phase 1: LLM schlägt vor:
  - Spalten: Einstieg | Erarbeitungsphase | Sicherung | Hausaufgaben
  - (GLEICHE Struktur! LLM nutzt nicht bewusst Pattern, aber ähnlich)

System: 🆕 Detected!
  "Ähnlich zu 'Reformation' Pattern (87% Ähnlichkeit)"
  
  Suggestion: "Willst du das Mittelalter-Board mit Reformation-Template erstellen?"
  
  [Ja - Template anwenden] [Nein - Normal erstellen]

User: Ja
  → boardLearningManager.createColumnWithTemplate(...) für jede Spalte
  → Template-Karten werden automatisch generiert
  → User sieht sofort fertige Struktur
  → Kann noch anpassen, aber spart 10 Minuten!
```

---

## 🔧 Technical Notes

### Was braucht der LearningManager von BoardStore?

```typescript
// In BoardLearningManager:
class BoardLearningManager {
  constructor(boardStore: BoardStore) {
    this.boardStore = boardStore;
  }
  
  // Ruft auf:
  boardStore.findColumn(columnId)  // ← Existiert ✅
  boardStore.getCurrentBoardId()   // ← Neu zu erstellen
  boardStore.data.name             // ← Existiert ✅
  boardStore.createCard(...)       // ← Existiert ✅
}
```

### Was braucht der Confirmation Dialog?

```typescript
// In AIPanel.svelte:
// 1. Board-Vorschau anzeigen (nur Read, nicht speichern)
const tempBoard = boardStore.createBoardFromActions(actions);  // ← Neu!

// 2. Nach Bestätigung: Speichern + Learning
boardStore.syncBoardState(...);  // ← Existiert ✅
boardLearningManager.learnBoardStructure();  // ← Existiert ✅
```

---

## 📊 State Diagram

```
┌─────────────┐
│ User Input  │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ Phase 1: LLM erzeugt │
│ Markdown Vorschlag   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Phase 2: Generate    │
│ Board Structure      │
└──────┬───────────────┘
       │
       ▼
🆕 ┌────────────────────────────────┐
   │ Confirmation Dialog            │
   │ [Confirm] [Reject] [Adjust]    │
   └────┬────────────┬────────┬─────┘
        │            │        │
        ▼            ▼        ▼
    SAVE + LEARN  DISCARD  NEW PHASE 1
        │            │        │
        │            │        └──────────────┐
        │            │                       │
        ▼            ▼                       ▼
    ✨ Pattern    Back to     User adjusts &
      Learned     Input       asks again
        │                        │
        └────────────┬───────────┘
                     │
                     ▼ (next session)
              Pattern Applied?
              Suggestion shown
```

---

## ❓ DEINE FRAGE BEANTWORTET

> "Ist es denkbar, dass die Phase 1 solange wiederholt wird, bis der User die Umsetzung im Board bestätigt?"

**Antwort: JA! Aber mit Nuance:**

1. **Phase 1 kann direkt wiederholt werden** (User klickt "Anpassen")
   - → Neue LLM-Anfrage mit Anpassungs-Context
   - → Neuer Vorschlag
   - → Neue Confirmation Dialog
   - → Loop bis Bestätigung

2. **NUR Bei Bestätigung → Learning aktiviert**
   - Verhindert: Speichern von abgelehnten Patterns
   - Verhindert: Lernen von False-Positives
   - Ermöglicht: User hat Kontrolle über was gelernt wird

3. **Pattern wird gespeichert nach Bestätigung**
   - Bei nächster ähnlicher Anfrage: Wird angeboten/angewendet
   - Beschleunigt künftige Planung

---

**🚀 NÄCHSTER SCHRITT:**

Sollen wir die Confirmation Dialog implementieren? (Schritt 1)

