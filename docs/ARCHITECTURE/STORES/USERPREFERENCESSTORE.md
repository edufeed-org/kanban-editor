# UserPreferencesStore Dokumentation

**Datei:** `src/lib/stores/userPreferencesStore.svelte.ts` *(noch zu erstellen)*  
**Technologie:** Svelte 5 Runes + Manual localStorage  
**Zweck:** Cross-Board Learning & User-Präferenzen-Management

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Problem & Lösung](#problem--lösung)
3. [Architektur](#architektur)
4. [Preference-Typen](#preference-typen)
5. [Learning-Algorithmus](#learning-algorithmus)
6. [API-Referenz](#api-referenz)
7. [Integration](#integration)
8. [Implementation Guide](#implementation-guide)

---

## Übersicht

Der `UserPreferencesStore` implementiert **Cross-Board Learning**: Die KI lernt aus User-Verhalten über alle Boards hinweg und wendet gelernte Präferenzen automatisch in neuen Boards an.

### Features

- ✅ **Cross-Board Memory** — Präferenzen gelten für ALLE Boards
- ✅ **Confidence-Scoring** — KI wird sicherer über Zeit
- ✅ **Pattern-Detection** — Automatische Erkennung von Mustern
- ✅ **Category-System** — Strukturierte Präferenz-Typen
- ✅ **Adaptive Learning** — Passt sich User-Änderungen an
- ✅ **Persistent Storage** — localStorage (global, nicht board-spezifisch)

### Status

⚠️ **TODO:** Diese Komponente ist noch **nicht implementiert** (Phase 3.1B - neu).

---

## Problem & Lösung

### ❌ Problem: Board-spezifisches Lernen

**Aktuell (ChatStore):**

```
Board A (Photosynthese):
User: "Ich nutze immer 4-Phasen-Modell: Einstieg, Erarbeitung, Vertiefung, Sicherung"
→ ChatStore speichert als Memory für Board A

Board B (Hamlet):
User: "Erstelle ein Board" 
→ AI kennt die 4-Phasen-Präferenz NICHT!
→ User muss ALLES neu erklären! ❌
```

### ✅ Lösung: Cross-Board Learning

**Mit UserPreferencesStore:**

```
Board A (Photosynthese):
User: "4-Phasen-Modell"
→ UserPreferencesStore lernt: lesson_flow = ['Einstieg', 'Erarbeitung', 'Vertiefung', 'Sicherung']
→ Confidence: 0.5

Board B (Hamlet):
User: "Erstelle ein Board"
→ AI: "Soll ich deine übliche 4-Phasen-Struktur nutzen?" ✅
→ User: "Ja!"
→ Confidence: 0.6 (erhöht!)

Board C (Mathe):
User: "Erstelle ein Board"
→ AI generiert AUTOMATISCH 4 Spalten (ohne zu fragen!) ✅
→ Confidence: 0.7
```

---

## Architektur

### Komponenten-Diagramm

```
┌────────────────────────────────────────────────────┐
│ UI (SettingsDialog.svelte)                         │
│ ├─ Anzeige aller gelernten Präferenzen            │
│ ├─ Manuelles Anpassen von Präferenzen             │
│ └─ Löschen von Präferenzen                        │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ UserPreferencesStore                               │
│ ├─ preferences = $state<TeachingPreference[]>([]) │
│ ├─ learnPreference() → Pattern-Detection          │
│ ├─ getPreferences() → Sortiert nach Confidence    │
│ ├─ getAIContext() → KI-Context String             │
│ └─ adaptPreference() → Anpassung bei Änderung     │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ localStorage (global!)                             │
│ Key: 'user-preferences'                           │
│ Value: JSON-Array von TeachingPreference          │
└────────────────────────────────────────────────────┘
```

### Datenfluss: Learning Cycle

```
User erstellt Board mit Pattern
    ↓
ChatBotStore.applyBoardStructure()
    ↓
userPreferencesStore.learnPreference(category, key, value, boardId)
    ↓
Pattern-Detection: Existiert bereits?
    ├─ JA → Confidence erhöhen (+0.1)
    └─ NEIN → Neue Präferenz (Confidence: 0.5)
    ↓
localStorage aktualisiert
    ↓
Nächstes Board:
ChatBotStore.generateBoardStructure()
    ↓
userPreferencesStore.getAIContext() → Starke Präferenzen (>0.7)
    ↓
LLM nutzt Präferenzen automatisch
```

---

## Preference-Typen

### TeachingPreference-Interface

```typescript
export interface TeachingPreference {
    id: string;                  // Unique ID
    category: PreferenceCategory;
    key: string;                 // z.B. 'lesson_flow'
    value: any;                  // z.B. ['Einstieg', 'Erarbeitung', ...]
    confidence: number;          // 0.0 - 1.0 (wie sicher?)
    learnedFrom: LearningSource[];
    lastUsed: string;            // ISO 8601
    createdAt: string;           // ISO 8601
}

export type PreferenceCategory = 
    | 'structure'     // Board-Struktur (Spalten, Layout)
    | 'workflow'      // Arbeitsabläufe (Reihenfolge)
    | 'pedagogy'      // Pädagogische Methoden
    | 'constraints'   // Zeitliche/Räumliche Constraints
    | 'content';      // Inhaltliche Präferenzen

export interface LearningSource {
    boardId: string;
    boardName: string;
    timestamp: string;
}
```

### Beispiel-Präferenzen

#### 1. Struktur (structure)

```typescript
{
    id: 'pref-001',
    category: 'structure',
    key: 'lesson_flow',
    value: ['Einstieg', 'Erarbeitung', 'Vertiefung', 'Sicherung'],
    confidence: 0.8,
    learnedFrom: [
        { boardId: 'board-1', boardName: 'Photosynthese', timestamp: '2025-11-01T10:00:00Z' },
        { boardId: 'board-2', boardName: 'Hamlet', timestamp: '2025-11-02T14:30:00Z' },
        { boardId: 'board-3', boardName: 'Mathe', timestamp: '2025-11-03T09:15:00Z' }
    ],
    lastUsed: '2025-11-03T09:15:00Z',
    createdAt: '2025-11-01T10:00:00Z'
}
```

#### 2. Workflow (workflow)

```typescript
{
    id: 'pref-002',
    category: 'workflow',
    key: 'materials_first',
    value: true,
    confidence: 0.9,
    learnedFrom: [
        { boardId: 'board-1', boardName: 'Photosynthese', timestamp: '...' },
        { boardId: 'board-2', boardName: 'Hamlet', timestamp: '...' },
        { boardId: 'board-4', boardName: 'Physik', timestamp: '...' }
    ],
    lastUsed: '2025-11-03T11:00:00Z',
    createdAt: '2025-11-01T10:00:00Z'
}
```

**Bedeutung:** User hat in 3 Boards immer "Materialien" als erste Spalte → KI lernt dies als Präferenz.

#### 3. Pädagogik (pedagogy)

```typescript
{
    id: 'pref-003',
    category: 'pedagogy',
    key: 'preferred_methods',
    value: ['Gruppenarbeit', 'Experimente', 'Diskussion'],
    confidence: 0.7,
    learnedFrom: [
        { boardId: 'board-1', boardName: 'Photosynthese', timestamp: '...' }
    ],
    lastUsed: '2025-11-01T10:00:00Z',
    createdAt: '2025-11-01T10:00:00Z'
}
```

#### 4. Constraints (constraints)

```typescript
{
    id: 'pref-004',
    category: 'constraints',
    key: 'lesson_duration',
    value: [45, 90],  // Entweder 45 oder 90 Minuten
    confidence: 0.85,
    learnedFrom: [
        { boardId: 'board-1', boardName: 'Photosynthese', timestamp: '...' },
        { boardId: 'board-2', boardName: 'Hamlet', timestamp: '...' }
    ],
    lastUsed: '2025-11-02T14:30:00Z',
    createdAt: '2025-11-01T10:00:00Z'
}
```

---

## Learning-Algorithmus

### Confidence-Scoring

```typescript
/**
 * Confidence-Berechnung basierend auf Häufigkeit
 */
function calculateConfidence(occurrences: number): number {
    // Initial: 0.5
    // Nach 2x: 0.6
    // Nach 3x: 0.7
    // Nach 5x: 0.8
    // Nach 10x: 0.9
    // Max: 1.0
    
    return Math.min(1.0, 0.5 + (occurrences - 1) * 0.1);
}
```

**Beispiel:**

```
Board 1: User setzt "4-Phasen-Modell"
→ Confidence: 0.5 (initial)

Board 2: User setzt wieder "4-Phasen-Modell"
→ Confidence: 0.6 (+ 0.1)

Board 3: User setzt wieder "4-Phasen-Modell"
→ Confidence: 0.7 (+ 0.1)

Board 4: User setzt wieder "4-Phasen-Modell"
→ Confidence: 0.8 (+ 0.1)

→ Ab 0.8: KI nutzt Präferenz AUTOMATISCH ohne zu fragen!
```

### Pattern-Detection

```typescript
/**
 * Erkennt, ob ein Pattern bereits existiert
 */
function detectPattern(
    newValue: any,
    existingPreference: TeachingPreference
): boolean {
    // Für Arrays: Deep-Equality Check
    if (Array.isArray(newValue) && Array.isArray(existingPreference.value)) {
        return JSON.stringify(newValue) === JSON.stringify(existingPreference.value);
    }
    
    // Für Objekte: Struktur-Vergleich
    if (typeof newValue === 'object' && typeof existingPreference.value === 'object') {
        return deepEqual(newValue, existingPreference.value);
    }
    
    // Für Primitives: Direct Equality
    return newValue === existingPreference.value;
}
```

### Adaptive Learning

```typescript
/**
 * Passt Präferenz an, wenn User etwas ändert
 */
function adaptPreference(
    key: string,
    newValue: any,
    boardId: string
): void {
    const existing = this.preferences.find(p => p.key === key);
    
    if (existing && !detectPattern(newValue, existing)) {
        // User hat Pattern geändert!
        
        // Option A: Confidence senken (User experimentiert?)
        existing.confidence = Math.max(0.3, existing.confidence - 0.2);
        
        // Option B: Neue Variante erstellen (alternative Präferenz)
        this.learnPreference(existing.category, `${key}_variant`, newValue, boardId);
    }
}
```

---

## API-Referenz

### Core Methods

#### 1. `learnPreference()`

Lernt eine neue Präferenz oder verstärkt eine existierende.

```typescript
public learnPreference(
    category: PreferenceCategory,
    key: string,
    value: any,
    boardId: string,
    boardName: string
): void {
    const existing = this.preferences.find(p => p.key === key);
    
    if (existing && detectPattern(value, existing)) {
        // Pattern erkannt → Confidence erhöhen
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        existing.learnedFrom.push({
            boardId,
            boardName,
            timestamp: new Date().toISOString()
        });
        existing.lastUsed = new Date().toISOString();
        
        console.log(`✅ Pattern verstärkt: ${key} (Confidence: ${existing.confidence.toFixed(2)})`);
    } else {
        // Neue Präferenz
        const newPref: TeachingPreference = {
            id: generateDTag(),
            category,
            key,
            value,
            confidence: 0.5,
            learnedFrom: [{
                boardId,
                boardName,
                timestamp: new Date().toISOString()
            }],
            lastUsed: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        this.preferences = [...this.preferences, newPref];
        this.saveToStorage();
        
        console.log(`📝 Neue Präferenz gelernt: ${key} (Confidence: 0.50)`);
    }
}
```

**Beispiel:**

```typescript
// User erstellt Board mit 4 Spalten
userPreferencesStore.learnPreference(
    'structure',
    'lesson_flow',
    ['Einstieg', 'Erarbeitung', 'Vertiefung', 'Sicherung'],
    'board-123',
    'Photosynthese Klasse 8'
);
```

---

#### 2. `getPreferences()`

Holt alle Präferenzen, optional gefiltert nach Kategorie.

```typescript
public getPreferences(
    category?: PreferenceCategory,
    minConfidence?: number
): TeachingPreference[] {
    let filtered = this.preferences;
    
    // Filter nach Kategorie
    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }
    
    // Filter nach Mindest-Confidence
    if (minConfidence !== undefined) {
        filtered = filtered.filter(p => p.confidence >= minConfidence);
    }
    
    // Sortiert nach Confidence (höchste zuerst)
    return filtered.sort((a, b) => b.confidence - a.confidence);
}
```

**Beispiel:**

```typescript
// Hole alle Struktur-Präferenzen mit hoher Confidence
const strongStructurePrefs = userPreferencesStore.getPreferences('structure', 0.7);

// Hole alle Präferenzen
const allPrefs = userPreferencesStore.getPreferences();
```

---

#### 3. `getAIContext()`

Gibt Präferenzen als KI-lesbaren Kontext zurück.

```typescript
public getAIContext(minConfidence: number = 0.7): string {
    const prefs = this.getPreferences(undefined, minConfidence);
    
    if (prefs.length === 0) {
        return 'Keine starken User-Präferenzen vorhanden.';
    }
    
    const prefStrings = prefs.map(p => {
        const sources = p.learnedFrom.length;
        return `- **${p.key}**: ${JSON.stringify(p.value)} (Confidence: ${(p.confidence * 100).toFixed(0)}%, gelernt aus ${sources} Boards)`;
    });
    
    return `## User-Präferenzen (Cross-Board Learning)

Der User hat folgende Präferenzen über ${this.getTotalBoards()} Boards entwickelt:

${prefStrings.join('\n')}

**Wichtig:** Nutze diese Präferenzen IMMER, außer der User sagt explizit etwas anderes!`;
}
```

**Beispiel-Output:**

```markdown
## User-Präferenzen (Cross-Board Learning)

Der User hat folgende Präferenzen über 5 Boards entwickelt:

- **lesson_flow**: ["Einstieg","Erarbeitung","Vertiefung","Sicherung"] (Confidence: 80%, gelernt aus 4 Boards)
- **materials_first**: true (Confidence: 90%, gelernt aus 5 Boards)
- **lesson_duration**: [45,90] (Confidence: 85%, gelernt aus 4 Boards)

**Wichtig:** Nutze diese Präferenzen IMMER, außer der User sagt explizit etwas anderes!
```

---

#### 4. `adaptPreference()`

Passt Präferenz an, wenn User etwas ändert.

```typescript
public adaptPreference(
    key: string,
    newValue: any,
    boardId: string,
    boardName: string
): void {
    const existing = this.preferences.find(p => p.key === key);
    
    if (!existing) {
        // Keine existierende Präferenz → Neu lernen
        this.learnPreference('structure', key, newValue, boardId, boardName);
        return;
    }
    
    if (detectPattern(newValue, existing)) {
        // Gleiches Pattern → Verstärken
        this.learnPreference(existing.category, key, newValue, boardId, boardName);
    } else {
        // Anderes Pattern → Confidence senken
        existing.confidence = Math.max(0.3, existing.confidence - 0.2);
        
        console.log(`⚠️  Pattern geändert für ${key}, Confidence gesenkt auf ${existing.confidence.toFixed(2)}`);
        
        // Neue Variante lernen?
        if (existing.confidence < 0.5) {
            console.log(`📝 Alte Präferenz verworfen, neue wird gelernt`);
            this.deletePreference(existing.id);
            this.learnPreference(existing.category, key, newValue, boardId, boardName);
        }
    }
    
    this.saveToStorage();
}
```

---

#### 5. `deletePreference()`

Löscht eine Präferenz (manuell oder automatisch).

```typescript
public deletePreference(id: string): void {
    this.preferences = this.preferences.filter(p => p.id !== id);
    this.saveToStorage();
    
    console.log(`🗑️  Präferenz gelöscht: ${id}`);
}
```

---

#### 6. `clearAllPreferences()`

Löscht alle Präferenzen (Factory Reset).

```typescript
public clearAllPreferences(): void {
    this.preferences = [];
    this.saveToStorage();
    
    console.log(`🗑️  Alle Präferenzen gelöscht`);
}
```

---

### Computed Properties

```typescript
// Anzahl Boards aus denen gelernt wurde
public get totalBoards(): number {
    const boardIds = new Set<string>();
    this.preferences.forEach(p => {
        p.learnedFrom.forEach(s => boardIds.add(s.boardId));
    });
    return boardIds.size;
}

// Durchschnittliche Confidence
public get averageConfidence(): number {
    if (this.preferences.length === 0) return 0;
    const sum = this.preferences.reduce((acc, p) => acc + p.confidence, 0);
    return sum / this.preferences.length;
}

// Stärkste Präferenz
public get strongestPreference(): TeachingPreference | null {
    const sorted = this.getPreferences();
    return sorted.length > 0 ? sorted[0] : null;
}
```

---

## Integration

### ChatBotStore Integration

```typescript
// src/lib/stores/chatBotStore.svelte.ts

import { userPreferencesStore } from './userPreferencesStore.svelte';

export class ChatBotStore {
    public async generateBoardStructure(requirements: string): Promise<BoardStructure> {
        // 1. Board-spezifischer Kontext (ChatStore)
        const boardContext = chatStore.getAIContext();
        
        // 2. User-Präferenzen (Global) ✅ NEU!
        const userPrefs = userPreferencesStore.getAIContext(0.7);
        
        // 3. LLM Prompt mit BEIDEN Kontexten
        const systemPrompt = `
Du bist ein Assistent für Unterrichtsplanung.

${userPrefs}

Board-spezifischer Kontext:
${boardContext}

User-Anfrage:
${requirements}

Generiere eine Board-Struktur als JSON.
`;
        
        const response = await this.callLLM(systemPrompt);
        
        return response;
    }
    
    public async applyBoardStructure(structure: BoardStructure): Promise<void> {
        // Spalten erstellen
        for (const column of structure.columns) {
            await boardStore.addColumn(column);
        }
        
        // Karten erstellen
        for (const card of structure.cards) {
            await boardStore.createCard(card.columnId, card.heading, card.content);
        }
        
        // ✅ NEU: Lerne aus der Struktur!
        this.learnFromStructure(structure);
    }
    
    private learnFromStructure(structure: BoardStructure): void {
        const currentBoardId = boardStore.currentBoardId;
        const currentBoardName = boardStore.data.name;
        
        // Lerne Spalten-Flow
        const columnNames = structure.columns.map(c => c.name);
        userPreferencesStore.learnPreference(
            'structure',
            'lesson_flow',
            columnNames,
            currentBoardId,
            currentBoardName
        );
        
        // Lerne ob "Materialien" erste Spalte
        if (columnNames[0]?.toLowerCase().includes('material')) {
            userPreferencesStore.learnPreference(
                'workflow',
                'materials_first',
                true,
                currentBoardId,
                currentBoardName
            );
        }
        
        // Lerne Stunden-Dauer (falls in Requirements erwähnt)
        const duration = this.extractDuration(structure.requirements);
        if (duration) {
            userPreferencesStore.learnPreference(
                'constraints',
                'lesson_duration',
                [duration],
                currentBoardId,
                currentBoardName
            );
        }
    }
}
```

---

### UI: Settings-Dialog

```svelte
<!-- src/lib/components/PreferencesDialog.svelte -->
<script lang="ts">
    import { userPreferencesStore } from '$lib/stores/userPreferencesStore.svelte';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Button } from '$lib/components/ui/button';
    import TrashIcon from '@lucide/svelte/icons/trash';
    
    let preferences = $derived(userPreferencesStore.getPreferences());
    let totalBoards = $derived(userPreferencesStore.totalBoards);
    let avgConfidence = $derived(userPreferencesStore.averageConfidence);
    
    function handleDelete(id: string) {
        if (confirm('Diese Präferenz wirklich löschen?')) {
            userPreferencesStore.deletePreference(id);
        }
    }
    
    function handleClearAll() {
        if (confirm('ALLE Präferenzen löschen? Dies kann nicht rückgängig gemacht werden!')) {
            userPreferencesStore.clearAllPreferences();
        }
    }
</script>

<Dialog.Root>
    <Dialog.Trigger asChild let:builder>
        <Button builders={[builder]} variant="outline">
            Präferenzen anzeigen
        </Button>
    </Dialog.Trigger>
    
    <Dialog.Content class="max-w-3xl">
        <Dialog.Header>
            <Dialog.Title>Gelernte Präferenzen</Dialog.Title>
            <Dialog.Description>
                Die KI hat aus {totalBoards} Boards gelernt. Durchschnittliche Confidence: {(avgConfidence * 100).toFixed(0)}%
            </Dialog.Description>
        </Dialog.Header>
        
        <!-- Präferenzen-Liste -->
        <div class="space-y-4 max-h-96 overflow-y-auto">
            {#each preferences as pref}
                <div class="border rounded p-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-semibold">{pref.key}</h4>
                            <p class="text-sm text-muted-foreground">{pref.category}</p>
                            <pre class="mt-2 text-xs bg-muted p-2 rounded">{JSON.stringify(pref.value, null, 2)}</pre>
                            
                            <div class="mt-2 flex items-center gap-4 text-xs">
                                <span>Confidence: {(pref.confidence * 100).toFixed(0)}%</span>
                                <span>Gelernt aus: {pref.learnedFrom.length} Boards</span>
                            </div>
                        </div>
                        
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => handleDelete(pref.id)}
                        >
                            <TrashIcon class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            {/each}
            
            {#if preferences.length === 0}
                <p class="text-center text-muted-foreground py-8">
                    Noch keine Präferenzen gelernt. Erstelle Boards, damit die KI lernen kann!
                </p>
            {/if}
        </div>
        
        <Dialog.Footer>
            <Button variant="destructive" onclick={handleClearAll}>
                Alle Präferenzen löschen
            </Button>
            <Dialog.Close asChild let:builder>
                <Button builders={[builder]} variant="outline">Schließen</Button>
            </Dialog.Close>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
```

---

## Implementation Guide

### Schritt 1: Store erstellen

```typescript
// src/lib/stores/userPreferencesStore.svelte.ts

import type { TeachingPreference, PreferenceCategory, LearningSource } from '$lib/types';
import { generateDTag } from '$lib/utils/idGenerator';

const STORAGE_KEY = 'user-preferences';

export class UserPreferencesStore {
    private preferences = $state<TeachingPreference[]>([]);
    private updateTrigger = $state(0);
    
    // Derived values
    public data = $derived(this.preferences);
    public totalBoards = $derived.by(() => {
        const boardIds = new Set<string>();
        this.preferences.forEach(p => {
            p.learnedFrom.forEach(s => boardIds.add(s.boardId));
        });
        return boardIds.size;
    });
    
    constructor() {
        this.loadFromStorage();
    }
    
    private loadFromStorage(): void {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                this.preferences = JSON.parse(stored);
            } catch (error) {
                console.error('Failed to load preferences:', error);
                this.preferences = [];
            }
        }
    }
    
    private saveToStorage(): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
        this.updateTrigger++;
    }
    
    // Public API hier...
}

export const userPreferencesStore = new UserPreferencesStore();
```

---

### Schritt 2: TypeScript Types

```typescript
// src/lib/types/preferences.ts

export type PreferenceCategory = 
    | 'structure'
    | 'workflow'
    | 'pedagogy'
    | 'constraints'
    | 'content';

export interface LearningSource {
    boardId: string;
    boardName: string;
    timestamp: string;
}

export interface TeachingPreference {
    id: string;
    category: PreferenceCategory;
    key: string;
    value: any;
    confidence: number;
    learnedFrom: LearningSource[];
    lastUsed: string;
    createdAt: string;
}
```

---

### Schritt 3: Integration in ChatBotStore

Siehe [Integration](#integration) Sektion oben.

---

### Schritt 4: UI erstellen

Siehe [UI: Settings-Dialog](#ui-settings-dialog) oben.

---

## Testing-Strategie

### Unit Tests

```typescript
// src/lib/stores/userPreferencesStore.spec.ts

describe('UserPreferencesStore', () => {
    beforeEach(() => {
        userPreferencesStore.clearAllPreferences();
    });
    
    it('sollte neue Präferenz lernen', () => {
        userPreferencesStore.learnPreference(
            'structure',
            'lesson_flow',
            ['A', 'B', 'C'],
            'board-1',
            'Test Board'
        );
        
        const prefs = userPreferencesStore.getPreferences();
        expect(prefs).toHaveLength(1);
        expect(prefs[0].confidence).toBe(0.5);
    });
    
    it('sollte Confidence bei wiederholtem Pattern erhöhen', () => {
        // Erstes Lernen
        userPreferencesStore.learnPreference('structure', 'flow', ['A', 'B'], 'b1', 'B1');
        expect(userPreferencesStore.getPreferences()[0].confidence).toBe(0.5);
        
        // Zweites Lernen
        userPreferencesStore.learnPreference('structure', 'flow', ['A', 'B'], 'b2', 'B2');
        expect(userPreferencesStore.getPreferences()[0].confidence).toBe(0.6);
        
        // Drittes Lernen
        userPreferencesStore.learnPreference('structure', 'flow', ['A', 'B'], 'b3', 'B3');
        expect(userPreferencesStore.getPreferences()[0].confidence).toBe(0.7);
    });
    
    it('sollte nur starke Präferenzen im AI-Context zurückgeben', () => {
        userPreferencesStore.learnPreference('structure', 'weak', 'value', 'b1', 'B1');
        // Confidence: 0.5
        
        const context = userPreferencesStore.getAIContext(0.7);
        expect(context).toContain('Keine starken User-Präferenzen');
    });
});
```

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | Präferenzen sind GLOBAL (nicht board-spezifisch) | 🔴 CRITICAL |
| **REGEL 2** | Confidence startet bei 0.5 und erhöht sich um 0.1 | 🔴 CRITICAL |
| **REGEL 3** | Ab Confidence 0.8: Automatische Anwendung | 🟠 HIGH |
| **REGEL 4** | Pattern-Detection via Deep-Equality | 🟠 HIGH |
| **REGEL 5** | Adaptive Learning bei Änderungen | 🟡 MEDIUM |
| **REGEL 6** | Immer in getAIContext() für LLM einbinden | 🔴 CRITICAL |
| **REGEL 7** | UI muss Präferenzen anzeigen & löschen können | 🟡 MEDIUM |

---

## Verwandte Dokumentation

- **[CHATSTORE.md](./CHATSTORE.md)** — Board-spezifische Memories
- **[CHATBOTSTORE.md](./CHATBOTSTORE.md)** — LLM Integration & Generation
- **[AI-COLLABORATIVE-GENERATION.md](../AGENT/AI-COLLABORATIVE-GENERATION.md)** — 3-Phase Workflow

---

**Status:** ⏳ Phase 3.1B (neu) — Noch zu implementieren!  
**Last Updated:** 3. November 2025  
**Autor:** AI Agent
