# Feature: LiaScript Export

**Version:** 1.0  
**Datum:** 27. November 2025  
**Status:** 📋 SPEZIFIKATION  
**Phase:** 1.5E (Export/Import Erweiterung)

---

## I. Übersicht

### Kurzbeschreibung

Dieses Feature ermöglicht den Export von Kanban-Boards in das LiaScript-Markdown-Format. LiaScript ist ein Markdown-Dialekt für interaktive Lernmaterialien, der es ermöglicht, Board-Inhalte in eine didaktisch strukturierte Form zu überführen.

### Kernfunktion

Export eines vollständigen Boards als `.md`-Datei mit folgender Struktur:
- **H1 (`#`)**: Board-Titel
- **H2 (`##`)**: Spalten-Namen
- **H3 (`###`)**: Karten-Überschriften
- **Inhalt**: Karten-Beschreibung
- **H4 (`####`)**: Kommentare-Sektion (falls vorhanden)

### Zielgruppe

- Lehrkräfte, die Board-Inhalte als Unterrichtsmaterialien exportieren möchten
- Nutzer, die ihre Boards in LiaScript-kompatible Kurse integrieren wollen
- Content-Ersteller für OER (Open Educational Resources)

---

## II. Benutzer-Perspektive

### User Journey

```
1. Nutzer öffnet ein Board
   ↓
2. Klickt auf "Als LiaScript exportieren" Button
   ↓
3. Browser startet Download einer .md-Datei
   ↓
4. Datei kann direkt in LiaScript verwendet werden
```

### UI-Integration

**Position:** Neben dem JSON-Export-Button im Topbar/Settings-Bereich

**Button-Design:**
- Icon: LiaScript-Logo (falls verfügbar) oder Markdown-Icon (`FileTextIcon`)
- Text: "LiaScript Export"
- Variant: `ghost` oder `outline`
- Tooltip: "Board als LiaScript Markdown exportieren"

**Beispiel-Position:**
```svelte
<div class="flex gap-2">
  <!-- Bestehender JSON Export -->
  <ExportButton />
  
  <!-- NEU: LiaScript Export -->
  <Button variant="ghost" size="sm" onclick={exportAsLiaScript}>
    <FileTextIcon class="mr-2 h-4 w-4" />
    LiaScript
  </Button>
</div>
```

---

## III. Technische Spezifikation

### 3.1 Export-Format

#### Struktur-Mapping

| Board-Element | LiaScript-Markdown | Beispiel |
|---------------|-------------------|----------|
| **Meta-Informationen** | **LiaScript Frontmatter** | **YAML-Style Kommentare** |
| Board-Name | `# {name}` | `# Unterrichtsplanung Q1` |
| Autor | `author: {author}` | `author: Frau Müller` |
| Erstelldatum | `date: {createdAt}` | `date: 27.11.2025` |
| Version | `version: {version}` | `version: 1.0.0` |
| CC-Lizenz | `license: {ccLicense}` | `license: CC-BY-4.0` |
| Board-Tags | `tags: [{tags}]` | `tags: [Unterricht, Geschichte]` |
| **Inhalte** | | |
| Board-Beschreibung | Paragraph nach Meta | `Planung für das erste Quartal...` |
| Spalte | `## {columnName}` | `## To Do` |
| Karte | `### {cardHeading}` | `### Materialien vorbereiten` |
| Karten-Inhalt | Paragraph nach H3 | `Kopien und Arbeitsblätter...` |
| Kommentare | `#### Kommentare` + Liste | `- Alice: Wichtig!` |
| Labels | Badge-Liste | `**Tags:** #Dringend #Material` |
| Links | Markdown-Links | `[Ressource](https://...)` |

#### Beispiel-Output

```markdown
<!--
author: Frau Müller
date: 27.11.2025
version: 1.0.0
license: CC-BY-4.0
tags: [Unterricht, Geschichte, Planung]

comment: Exportiert aus Kanban-Board
board-id: board-abc123
exported: 2025-11-27T14:30:00.000Z
-->

# Unterrichtsplanung Q1

Planung für das erste Quartal 2025/26

## To Do

### Materialien vorbereiten

Kopien und Arbeitsblätter für die erste Woche erstellen.

**Tags:** #Dringend #Material

**Links:**
- [Vorlage Arbeitsblatt](https://example.com/template)

#### Kommentare

- **Alice** (2025-11-20): Bitte bis Freitag fertig!
- **Bob** (2025-11-21): Druckauftrag ist raus.

### Raumplanung

Raum 204 für Montag reservieren.

## In Progress

### Präsentation erstellen

Slides für die Einführung in das Thema.

**Tags:** #Präsentation

## Done

### Lehrbuch bestellt

Neue Ausgabe ist angekommen.
```

### 3.2 Store-API Erweiterung

#### Neue Methode in `BoardStore`

```typescript
/**
 * Exportiert das aktuelle Board als LiaScript Markdown
 * @param includeMetadata - Fügt Metadaten-Kommentar am Anfang hinzu
 * @returns Markdown-String im LiaScript-Format
 */
public exportBoardAsLiaScript(includeMetadata: boolean = true): string {
    if (!this.board) {
        throw new Error('Kein Board geladen');
    }
    
    return boardToLiaScript(this.board, includeMetadata);
}
```

#### Utility-Funktion

**Datei:** `src/lib/utils/liascriptExport.ts`

```typescript
import type { Board, Column, Card, Comment } from '$lib/classes/BoardModel';

/**
 * Konvertiert ein Board zu LiaScript Markdown
 */
export function boardToLiaScript(board: Board, includeMetadata: boolean = true): string {
    let markdown = '';
    
    // LiaScript Frontmatter mit Meta-Informationen
    if (includeMetadata) {
        markdown += `<!--\n`;
        
        // Autor (deduziert aus board.author oder 'Anonym')
        const author = board.author || 'Anonym';
        markdown += `author: ${author}\n`;
        
        // Datum (aktuelles Datum beim Export)
        const date = new Date().toLocaleDateString('de-DE');
        markdown += `date: ${date}\n`;
        
        // Version (immer 1.0.0 für initiale Exporte)
        markdown += `version: 1.0.0\n`;
        
        // CC-Lizenz (aus board.ccLicense oder Default)
        const license = board.ccLicense || 'CC-BY-4.0';
        markdown += `license: ${license}\n`;
        
        // Tags (aus board.tags falls vorhanden)
        if (board.tags && board.tags.length > 0) {
            markdown += `tags: [${board.tags.join(', ')}]\n`;
        }
        
        // Zusätzliche technische Metadaten
        markdown += `\n`;
        markdown += `comment: Exportiert aus Kanban-Board\n`;
        markdown += `board-id: ${board.id}\n`;
        markdown += `exported: ${new Date().toISOString()}\n`;
        
        markdown += `-->\n\n`;
    }
    
    // H1: Board-Titel
    markdown += `# ${board.name}\n\n`;
    
    // Board-Beschreibung (falls vorhanden)
    if (board.description) {
        markdown += `${board.description}\n\n`;
    }
    
    // Tags (falls vorhanden)
    if (board.tags && board.tags.length > 0) {
        markdown += `**Board-Tags:** ${board.tags.map(t => `#${t}`).join(' ')}\n\n`;
    }
    
    // Spalten durchlaufen
    for (const column of board.columns) {
        markdown += columnToLiaScript(column);
    }
    
    return markdown;
}

/**
 * Konvertiert eine Spalte zu LiaScript Markdown
 */
function columnToLiaScript(column: Column): string {
    let markdown = '';
    
    // H2: Spalten-Name
    markdown += `## ${column.name}\n\n`;
    
    // Karten durchlaufen
    for (const card of column.cards) {
        markdown += cardToLiaScript(card);
    }
    
    return markdown;
}

/**
 * Konvertiert eine Karte zu LiaScript Markdown
 */
function cardToLiaScript(card: Card): string {
    let markdown = '';
    
    // H3: Karten-Überschrift
    markdown += `### ${card.heading}\n\n`;
    
    // Karten-Inhalt (falls vorhanden)
    if (card.content) {
        markdown += `${card.content}\n\n`;
    }
    
    // Labels (falls vorhanden)
    if (card.labels && card.labels.length > 0) {
        markdown += `**Tags:** ${card.labels.map(l => `#${l}`).join(' ')}\n\n`;
    }
    
    // Links (falls vorhanden)
    if (card.links && card.links.length > 0) {
        markdown += `**Links:**\n`;
        for (const link of card.links) {
            markdown += `- [${link.title || link.url}](${link.url})\n`;
        }
        markdown += `\n`;
    }
    
    // Kommentare (falls vorhanden)
    if (card.comments && card.comments.length > 0) {
        markdown += commentsToLiaScript(card.comments);
    }
    
    return markdown;
}

/**
 * Konvertiert Kommentare zu LiaScript Markdown
 */
function commentsToLiaScript(comments: Comment[]): string {
    let markdown = '';
    
    markdown += `#### Kommentare\n\n`;
    
    for (const comment of comments) {
        const date = new Date(comment.createdAt).toLocaleDateString('de-DE');
        const author = comment.author || 'Anonym';
        markdown += `- **${author}** (${date}): ${comment.text}\n`;
    }
    
    markdown += `\n`;
    
    return markdown;
}

/**
 * Erzeugt einen Dateinamen für den LiaScript-Export
 */
export function generateLiaScriptFilename(boardName: string): string {
    // Sanitize board name für Dateinamen
    const sanitized = boardName
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    const date = new Date().toISOString().split('T')[0];
    return `${sanitized}-${date}.md`;
}
```

### 3.3 UI-Komponente

**Datei:** `src/lib/components/LiaScriptExportButton.svelte`

```svelte
<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import FileTextIcon from '@lucide/svelte/icons/file-text';
    import { boardStore } from '$lib/stores/kanbanStore.svelte';
    import { exportBoardAsLiaScript, generateLiaScriptFilename } from '$lib/utils/liascriptExport';
    
    function handleExport() {
        try {
            // Markdown generieren
            const markdown = boardStore.exportBoardAsLiaScript(true);
            
            // Dateinamen generieren
            const filename = generateLiaScriptFilename(boardStore.data?.name || 'board');
            
            // Download starten
            const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('✅ LiaScript Export erfolgreich:', filename);
        } catch (error) {
            console.error('❌ LiaScript Export fehlgeschlagen:', error);
        }
    }
</script>

<Button 
    variant="ghost" 
    size="sm" 
    onclick={handleExport}
    title="Board als LiaScript Markdown exportieren"
>
    <FileTextIcon class="mr-2 h-4 w-4" />
    <span class="hidden sm:inline">LiaScript</span>
</Button>
```

---

## IV. Integration

### 4.1 In Topbar einbinden

**Datei:** `src/routes/cardsboard/Topbar.svelte`

```svelte
<script lang="ts">
    import ExportButton from '$lib/components/ExportButton.svelte';
    import LiaScriptExportButton from '$lib/components/LiaScriptExportButton.svelte';
    // ... andere Imports
</script>

<header class="h-16 border-b bg-background flex items-center px-4 gap-4">
    <!-- ... linke Sidebar-Toggles ... -->
    
    <!-- Export-Buttons gruppiert -->
    <div class="flex items-center gap-1">
        <ExportButton />
        <LiaScriptExportButton />
    </div>
    
    <!-- ... restliche Topbar ... -->
</header>
```

### 4.2 Alternative: In Settings-Sheet

**Datei:** `src/lib/components/SettingsPanel.svelte`

```svelte
<Sheet.Content>
    <Sheet.Header>
        <Sheet.Title>Board-Einstellungen</Sheet.Title>
    </Sheet.Header>
    
    <div class="space-y-4 py-4">
        <!-- Export-Optionen -->
        <div class="space-y-2">
            <h4 class="font-medium">Export</h4>
            
            <div class="flex flex-col gap-2">
                <ExportButton />
                <LiaScriptExportButton />
            </div>
        </div>
        
        <!-- ... andere Settings ... -->
    </div>
</Sheet.Content>
```

---

## V. Tests

### 5.1 Unit Tests

**Datei:** `src/lib/utils/liascriptExport.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Board, Column, Card } from '$lib/classes/BoardModel';
import { boardToLiaScript, generateLiaScriptFilename } from './liascriptExport';

describe('LiaScript Export', () => {
    it('exportiert Board-Titel als H1', () => {
        const board = new Board({ name: 'Test Board' });
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('# Test Board');
    });
    
    it('exportiert Spalten als H2', () => {
        const board = new Board({ name: 'Board' });
        board.addColumn({ name: 'To Do' });
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('## To Do');
    });
    
    it('exportiert Karten als H3', () => {
        const board = new Board({ name: 'Board' });
        const col = board.addColumn({ name: 'Column' });
        col.addCard({ heading: 'Task 1', content: 'Description' });
        
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('### Task 1');
        expect(markdown).toContain('Description');
    });
    
    it('exportiert Kommentare als H4-Sektion', () => {
        const board = new Board({ name: 'Board' });
        const col = board.addColumn({ name: 'Column' });
        const card = col.addCard({ heading: 'Task' });
        card.addComment('Great idea!', 'Alice');
        
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('#### Kommentare');
        expect(markdown).toContain('**Alice**');
        expect(markdown).toContain('Great idea!');
    });
    
    it('exportiert Labels als Tags', () => {
        const board = new Board({ name: 'Board' });
        const col = board.addColumn({ name: 'Column' });
        col.addCard({ heading: 'Task', labels: ['urgent', 'important'] });
        
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('**Tags:** #urgent #important');
    });
    
    it('exportiert Links als Markdown-Links', () => {
        const board = new Board({ name: 'Board' });
        const col = board.addColumn({ name: 'Column' });
        const card = col.addCard({ heading: 'Task' });
        card.links = [{ id: '1', url: 'https://example.com', title: 'Example' }];
        
        const markdown = boardToLiaScript(board, false);
        
        expect(markdown).toContain('**Links:**');
        expect(markdown).toContain('[Example](https://example.com)');
    });
    
    it('generiert korrekten Dateinamen', () => {
        const filename = generateLiaScriptFilename('Mein Test Board!');
        
        expect(filename).toMatch(/^mein-test-board-\d{4}-\d{2}-\d{2}\.md$/);
    });
    
    it('fügt LiaScript Frontmatter-Metadaten hinzu wenn gewünscht', () => {
        const board = new Board({ 
            name: 'Board', 
            id: 'board-123',
            author: 'Test User',
            tags: ['education', 'planning'],
            ccLicense: 'CC-BY-SA-4.0'
        });
        const markdown = boardToLiaScript(board, true);
        
        expect(markdown).toContain('<!--');
        expect(markdown).toContain('author: Test User');
        expect(markdown).toContain('version: 1.0.0');
        expect(markdown).toContain('license: CC-BY-SA-4.0');
        expect(markdown).toContain('tags: [education, planning]');
        expect(markdown).toContain('board-id: board-123');
        expect(markdown).toContain('-->');
    });
    
    it('verwendet Default-Werte für fehlende Meta-Informationen', () => {
        const board = new Board({ name: 'Board' });
        const markdown = boardToLiaScript(board, true);
        
        expect(markdown).toContain('author: Anonym');
        expect(markdown).toContain('license: CC-BY-4.0');
    });
});
```

### 5.2 Integration Tests

```typescript
describe('LiaScript Export Integration', () => {
    it('exportiert vollständiges Board korrekt', () => {
        // Erstelle komplexes Board
        const board = new Board({ 
            name: 'Projektplanung',
            description: 'Q1 2025'
        });
        
        const todo = board.addColumn({ name: 'To Do' });
        const card1 = todo.addCard({ 
            heading: 'Recherche',
            content: 'Literatur sammeln',
            labels: ['research', 'priority-high']
        });
        card1.addComment('Start am Montag', 'Alice');
        
        const inProgress = board.addColumn({ name: 'In Progress' });
        const card2 = inProgress.addCard({ heading: 'Konzept schreiben' });
        
        // Export
        const markdown = boardToLiaScript(board, true);
        
        // Validierungen
        expect(markdown).toContain('# Projektplanung');
        expect(markdown).toContain('Q1 2025');
        expect(markdown).toContain('## To Do');
        expect(markdown).toContain('## In Progress');
        expect(markdown).toContain('### Recherche');
        expect(markdown).toContain('### Konzept schreiben');
        expect(markdown).toContain('#### Kommentare');
        expect(markdown).toContain('**Alice**');
        expect(markdown).toContain('#research #priority-high');
    });
});
```

---

## VI. Acceptance Criteria

- ✅ **Export-Button** ist neben JSON-Export positioniert
- ✅ **Button-Design** zeigt LiaScript-Logo oder Markdown-Icon
- ✅ **Meta-Informationen** werden als LiaScript Frontmatter exportiert:
  - ✅ Autor (aus `board.author` oder 'Anonym')
  - ✅ Datum (Exportdatum)
  - ✅ Version (1.0.0)
  - ✅ CC-Lizenz (aus `board.ccLicense` oder 'CC-BY-4.0')
  - ✅ Tags (aus `board.tags`)
  - ✅ Board-ID und Export-Timestamp
- ✅ **Board-Titel** wird als H1 exportiert
- ✅ **Spalten** werden als H2 exportiert
- ✅ **Karten** werden als H3 exportiert
- ✅ **Karten-Inhalt** erscheint als Paragraph unter H3
- ✅ **Kommentare** werden als H4-Sektion mit Liste formatiert
- ✅ **Labels** werden als Tags exportiert
- ✅ **Links** werden als Markdown-Links exportiert
- ✅ **Dateiname** ist sanitized und enthält Datum
- ✅ **Download** startet automatisch beim Klick
- ✅ **Unit Tests** sind grün (>80% Coverage)
- ✅ **Integration Tests** validieren vollständigen Export inkl. Metadaten

---

## VII. Beispiel-Use-Cases

### Use Case 1: Unterrichtsmaterial erstellen

**Szenario:** Lehrkraft plant Unterricht in Kanban-Board und exportiert für LiaScript-Kurs.

```markdown
<!--
author: Frau Müller
date: 27.11.2025
version: 1.0.0
license: CC-BY-4.0
tags: [Geschichte, Klasse7, RömischesReich]

comment: Exportiert aus Kanban-Board
board-id: board-unterricht-123
exported: 2025-11-27T10:30:00.000Z
-->

# Geschichtsunterricht: Römisches Reich

Einführung in die Geschichte des Römischen Reichs für Klasse 7

## Vorbereitung

### Materialien besorgen

Arbeitsblätter und Karten ausdrucken.

**Tags:** #Material #Dringend

#### Kommentare

- **Frau Müller** (2025-11-25): Kopierraum ab 14 Uhr frei

### Raum reservieren

Raum 204 für Dienstag buchen.

## Durchführung

### Einführungsvortrag

15 Minuten Überblick über die Epoche.

**Links:**
- [Präsentation](https://example.com/roemisches-reich.ppt)

### Gruppenarbeit

Schüler arbeiten an Stationenlernen.
```

### Use Case 2: Projekt-Dokumentation

**Szenario:** Team dokumentiert Software-Projekt und exportiert für Wissensbasis.

```markdown
<!--
author: Dev Team
date: 27.11.2025
version: 1.0.0
license: CC-BY-SA-4.0
tags: [Software, Entwicklung, Kanban]

comment: Exportiert aus Kanban-Board
board-id: board-projekt-456
exported: 2025-11-27T15:45:00.000Z
-->

# Projekt: Kanban-Editor v2.0

Entwicklung der neuen Board-Features

## Backlog

### Feature: LiaScript Export

Boards als Markdown exportieren.

**Tags:** #Feature #Export

#### Kommentare

- **Dev Team** (2025-11-27): Implementierung gestartet
- **Product Owner** (2025-11-27): Prio 1 für nächstes Release

## In Development

### Tests schreiben

Unit Tests für Export-Funktion.

**Tags:** #Testing
```

---

## VIII. Bekannte Einschränkungen

1. **Rich-Text**: Markdown-Formatierungen in Karten-Inhalt werden nicht interpretiert
2. **Bilder**: Card-Images werden nicht eingebettet (nur als Links möglich)
3. **Attendees**: Werden nicht exportiert (ggf. als Metadaten in Zukunft)
4. **PublishState**: Draft/Published Status wird nicht im Export berücksichtigt

---

## IX. Zukünftige Erweiterungen

### Phase 2: Erweiterte Features

- [ ] **Bilder einbetten**: Base64-Encoding für Card-Images
- [ ] **Interaktive Elemente**: LiaScript-Quizzes aus Card-Labels generieren
- [ ] **Metadaten**: CC-Lizenz und Autor-Informationen im Header
- [ ] **Attendees**: Als LiaScript-Autoren-Liste exportieren

### Phase 3: LiaScript-spezifische Features

- [ ] **Animationen**: LiaScript-Syntax für progressive Anzeige nutzen
- [ ] **Code-Blocks**: Syntax-Highlighting für Links zu Repositories
- [ ] **Multimedia**: Audio/Video-Links als LiaScript-Media-Elemente

---

## X. Referenzen

- **LiaScript Dokumentation**: https://liascript.github.io/
- **Verwandte Features**: 
  - [`IMPORT-EXPORT.md`](./IMPORT-EXPORT.md) - JSON Export/Import
  - [`SHARELINK.md`](./SHARELINK.md) - URL-basiertes Sharing
- **Store-Architektur**: [`docs/ARCHITECTURE/STORES/BOARDSTORE.md`](../ARCHITECTURE/STORES/BOARDSTORE.md)
- **UX-Regeln**: [`docs/ARCHITECTURE/UX-RULES.md`](../ARCHITECTURE/UX-RULES.md)

---

## XI. Changelog

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | 27.11.2025 | Initiale Spezifikation erstellt |

---

**Status:** 📋 **SPEZIFIKATION** - Ready for Implementation  
**Nächste Schritte:** 
1. Utility-Funktion `liascriptExport.ts` implementieren
2. UI-Komponente `LiaScriptExportButton.svelte` erstellen
3. Unit Tests schreiben
4. Integration in Topbar/Settings
5. Dokumentation in `_INDEX.md` verlinken

**Geschätzter Aufwand:** 4-6 Stunden (Implementation + Tests)
