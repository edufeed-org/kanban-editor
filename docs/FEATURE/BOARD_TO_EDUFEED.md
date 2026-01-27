# 📚 Board to Edufeed - AMB Learning Resource Publishing

## 🎯 Problem & Motivation

### Aktueller Stand

Die Funktion `publishBoardToEdufeed()` in `ambPublisher.ts` publiziert aktuell **nur Metadaten**:
- Board-Name, Beschreibung
- Autor-Informationen
- Tags, Lizenz
- Timestamps

**Was fehlt:** Der eigentliche **Inhalt** (Spalten + Karten) wird **nicht** mit publiziert!

Das macht die "Learning Resource" praktisch **nutzlos** – ein Kurs ohne Inhalt.

### Ziel

Ein publiziertes Board soll:
1. ✅ **Vollständigen Inhalt** enthalten (alle Spalten + Karten)
2. ✅ **Als Snapshot** gespeichert werden (konsistent mit Kind 30303)
3. ✅ **Importierbar** sein (Round-Trip: Export → Nostr → Import)
4. ✅ **In Nostr-Clients sichtbar** sein (njump, andere Clients)
5. ✅ **Per Link teilbar** sein (naddr-URL)

---

## 📐 Technische Architektur

### Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│  KANBAN BOARD (mit allen Spalten & Karten)                      │
│  board.getContextData(true) → vollständiger JSON-Snapshot       │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  AMB LEARNING RESOURCE (JSON-LD)                                │
│  {                                                              │
│    "@context": ["https://w3id.org/kim/amb/context.jsonld"],     │
│    "type": ["LearningResource", "Course"],                      │
│    "name": "Board-Titel",                                       │
│    "description": "Board-Beschreibung",                         │
│    "hasPart": [                                                 │
│      { "type": "Chapter", "name": "Spalte 1", ... },           │
│      { "type": "Chapter", "name": "Spalte 2", ... }            │
│    ],                                                           │
│    "encoding": {                                                │
│      "contentType": "application/json",                         │
│      "contentUrl": "data:application/json;base64,..."           │
│    }                                                            │
│  }                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NOSTR EVENT (Kind 30142 - AMB Learning Resource)               │
│  {                                                              │
│    "kind": 30142,                                               │
│    "tags": [                                                    │
│      ["d", "nostr:kanban:<board-id>"],                          │
│      ["title", "Board-Titel"],                                  │
│      ["summary", "Board-Beschreibung"],                         │
│      ["t", "tag1"], ["t", "tag2"],                              │
│      ["license", "https://creativecommons.org/..."],            │
│      ["kanban-snapshot", "1"] // Marker für importierbares Board│
│    ],                                                           │
│    "content": "<vollständiger JSON-Snapshot des Boards>"        │
│  }                                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NOSTR RELAYS (öffentlich)                                      │
│  wss://relay.damus.io, wss://relay.primal.net, etc.            │
└─────────────────────────────────────────────────────────────────┘
```

### Content-Struktur im Nostr Event

Der `content` des Events enthält den **vollständigen Board-Snapshot als JSON-String**:

```json
{
  "id": "board-uuid",
  "name": "Mein Kanban-Board",
  "description": "Projektplanung für Q1",
  "author": "hex-pubkey",
  "columns": [
    {
      "id": "col-1",
      "name": "To Do",
      "cards": [
        {
          "id": "card-1",
          "heading": "Feature X implementieren",
          "content": "Detaillierte Beschreibung...",
          "labels": ["feature", "priority-high"],
          "comments": [...]
        }
      ]
    },
    {
      "id": "col-2", 
      "name": "In Progress",
      "cards": [...]
    }
  ],
  "tags": ["projekt", "q1-2026"],
  "ccLicense": "cc-by-4.0",
  "publishState": "published",
  "createdAt": "2026-01-27T10:00:00Z",
  "updatedAt": "2026-01-27T15:30:00Z"
}
```

**Wichtig:** Der Snapshot ist ein **einfaches JSON-Objekt** (Ergebnis von `board.getContextData(true)`), 
und wird als String im `content`-Feld des AMB-Events gespeichert.

```json 
{
  "kind": 30142,
  "tags": [
    ["d", "nostr:kanban:board-123"],
    ["title", "Mein Board"],
    ["t", "religion"],
    ["t", "geschichte"],
    ["license", "..."],
    ["kanban-snapshot", "1"]
  ],
  "content": "{\"id\":\"board-123\",\"name\":\"Mein Board\",...}"
}
```
---

## 🔗 Link-Generierung & Sharing

### 1. Nostr naddr-Link (zum Beobachten)

Nach dem Publizieren wird ein **naddr-Link** generiert:

```typescript
// Nach erfolgreichem Publish
const naddr = nip19.naddrEncode({
  kind: 30142,                    // AMB Learning Resource Kind (Edufeed NIP)
  pubkey: authorPubkey,           // Hex-Format
  identifier: `nostr:kanban:${board.id}`,
  relays: ['wss://relay.damus.io', 'wss://nos.lol']
});

// Ergebnis: naddr1qqxnzd3e8q6nwden8qunzwpe...
```

### 2. njump-URL (Web-Ansicht)

Für User ohne Nostr-Client:

```
https://njump.me/naddr1qqxnzd3e8q6nwden8qunzwpe...
```

Oder mit konfiguriertem Edufeed-njump (aus `config.json`):

```
https://njump.edufeed.org/naddr1qqxnzd3e8q6nwden8qunzwpe...
```

**Was der User auf njump sieht:**
- Board-Titel & Beschreibung
- Autor-Profil (aus Nostr-Metadaten)
- Tags
- Lizenz-Information
- Raw JSON-Content (expandierbar)
- Relay-Liste wo das Event zu finden ist

### 3. Import-Link (zum Importieren in Kanban-App)

Direkt-Import in die Kanban-App:

```
https://app.edufeed.org/cardsboard/naddr1qqxnzd3e...
```

**Workflow beim Import:**

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User öffnet Import-Link                                     │
│     /cardsboard/naddr1qqxnzd3e...                               │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. naddr dekodieren                                            │
│     nip19.decode() → { kind, pubkey, identifier, relays }       │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Event von Relays laden                                      │
│     NDK.fetchEvent({ kinds: [30142], #d: identifier })          │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Content parsen & Board rekonstruieren                       │
│     JSON.parse(event.content) → Board-Snapshot                  │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Import-Modus wählen (Dialog)                                │
│     - Merge: Neue IDs generieren (konfliktfrei)                 │
│     - New: Board als Kopie speichern                            │
│     - Subscribe: Board beobachten (Live-Updates)                │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Weiterleitung zu /cardsboard/                               │
│     Board ist nun lokal verfügbar & bearbeitbar                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📤 Rückgabewerte nach Publish

Das erweiterte `AmbPublishResult`:

```typescript
export interface AmbPublishResult {
    success: boolean;
    eventId?: string;          // Nostr Event-ID
    error?: string;
    ambResource?: AmbLearningResource;
    
    // NEU: Link-Generierung
    links?: {
        /** naddr string (nostr:naddr1...) */
        naddr: string;
        
        /** Vollständige njump-URL */
        njumpUrl: string;
        
        /** Import-URL für Kanban-App */
        importUrl: string;
        
        /** Nostr-URI (nostr:naddr1...) */
        nostrUri: string;
    };
}
```

### Beispiel-Rückgabe

```typescript
{
  success: true,
  eventId: "abc123...",
  ambResource: { ... },
  links: {
    naddr: "naddr1qqxnzd3e8q6nwden8qunzwpe...",
    njumpUrl: "https://njump.edufeed.org/naddr1qqxnzd3e...",
    importUrl: "https://app.edufeed.org/cardsboard/naddr1qqxnzd3e...",
    nostrUri: "nostr:naddr1qqxnzd3e..."
  }
}
```

---

## 🎨 UI-Integration

### Publish-Dialog (erweiterter Topbar-Flow)

Nach erfolgreichem Publish zeigt der Dialog:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Board erfolgreich veröffentlicht!                       │
│                                                             │
│  📋 Links zum Teilen:                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔗 Nostr-Link (für Nostr-Apps)                      │   │
│  │ nostr:naddr1qqxnzd3e8q6nwden8qunzwpe...   [Kopieren]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🌐 Web-Link (für alle)                              │   │
│  │ https://njump.edufeed.org/naddr1...       [Kopieren]│   │
│  │                                           [Öffnen ↗]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📥 Import-Link (für Kanban-App)                     │   │
│  │ https://app.edufeed.org/cardsboard/naddr1...        │   │
│  │                                  [Kopieren] [Öffnen]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐                                            │
│  │   [QR-Code] │  Scanne für mobilen Import                │
│  │             │                                            │
│  └─────────────┘                                            │
│                                                             │
│                                          [Schließen]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Unterschied zu bestehenden Features

| Feature | Kind | Zweck | Sichtbarkeit |
|---------|------|-------|--------------|
| **Board Snapshot** | 30303 | Private Versionshistorie | Nur eigene Relays |
| **Board Event** | 30301 | Live-Sync zwischen Geräten | Private + Public |
| **Card Event** | 30302 | Live-Sync einzelner Karten | Private + Public |
| **AMB Learning Resource** | 30142 | **Öffentliche Veröffentlichung** | **Nur Public Relays** |

### Warum ein eigener Event-Typ?

1. **Semantik:** AMB Learning Resources sind ein standardisiertes Format für OER
2. **Discovery:** Andere Edufeed-Clients können Learning Resources finden
3. **Interoperabilität:** AMB ist ein breiterer Standard, nicht Kanban-spezifisch
4. **Trennung:** Private Snapshots (30303) vs. öffentliche Publikationen (30142)

---

## 🤖 KI-gestützte Metadaten-Generierung

Viele AMB-Properties lassen sich automatisch via KI aus dem Board-Inhalt ableiten:

### Automatisch ableitbare Properties

| AMB Property | Nostr Tag | KI-Ermittlung | Quelle |
|--------------|-----------|---------------|--------|
| **`about`** | `["about:id", <uri>]`, `["about:prefLabel:de", <label>]` | ✅ **Fachzuordnung** aus Karten-Inhalten | Analyse aller Card-Texte → Mapping zu [KIM Schulfächer](http://w3id.org/kim/schulfaecher/) |
| **`keywords`** | `["t", <keyword>]` | ✅ **Keyword-Extraktion** | Board-Tags + KI-extrahierte Schlüsselwörter aus Karten |
| **`learningResourceType`** | `["learningResourceType:id", <uri>]` | ✅ **Ressourcentyp** | Board-Struktur → "Kurs", "Lerneinheit", "Arbeitsblatt" etc. |
| **`educationalLevel`** | `["educationalLevel:id", <uri>]` | ✅ **Bildungsstufe** | Textanalyse → Komplexität → [KIM Educational Level](https://w3id.org/kim/educationalLevel/) |
| **`audience`** | `["audience:id", <uri>]` | ✅ **Zielgruppe** | Sprachstil-Analyse → "student", "teacher", "parent" |
| **`inLanguage`** | `["inLanguage", <code>]` | ✅ **Sprache** | Automatische Spracherkennung der Karten-Texte |
| **`teaches`** | `["teaches:id", <uri>]` | 🟡 **Lernziele** | Extraktion aus Karten mit "Lernziel"-Labels oder Headings |
| **`competencyRequired`** | `["competencyRequired:id", <uri>]` | 🟡 **Voraussetzungen** | Analyse von "Voraussetzung"-Karten oder -Spalten |
| **`duration`** | `["duration", <ISO8601>]` | 🟡 **Zeitschätzung** | Anzahl Karten × durchschnittliche Bearbeitungszeit |
| **`interactivityType`** | `["interactivityType:id", <uri>]` | 🟡 **Interaktivitätsgrad** | Board-Typ → "active", "expositive", "mixed" |

### Beispiel: KI-Prompt für Metadaten-Generierung

```typescript
const AI_METADATA_PROMPT = `
Analysiere folgendes Kanban-Board und extrahiere AMB-Metadaten:

Board: ${board.name}
Beschreibung: ${board.description}

Spalten und Karten:
${board.columns.map(col => `
## ${col.name}
${col.cards.map(card => `- ${card.heading}: ${card.content}`).join('\n')}
`).join('\n')}

Ermittle folgende Metadaten im JSON-Format:
{
  "about": [{ "id": "<KIM Schulfächer URI>", "prefLabel": "<Fachname>" }],
  "keywords": ["<keyword1>", "<keyword2>", ...],
  "learningResourceType": { "id": "<URI>", "prefLabel": "<Typ>" },
  "educationalLevel": { "id": "<URI>", "prefLabel": "<Stufe>" },
  "audience": { "id": "<URI>", "prefLabel": "<Zielgruppe>" },
  "inLanguage": "<ISO 639-1 code>",
  "teaches": [{ "id": "<URI>", "prefLabel": "<Lernziel>" }],
  "estimatedDuration": "<ISO 8601 duration>"
}
`;
```

### Implementierungsvorschlag

```typescript
// ambPublisher.ts - KI-gestützte Metadaten

interface AiGeneratedMetadata {
    about: Array<{ id: string; prefLabel: string }>;
    keywords: string[];
    learningResourceType: { id: string; prefLabel: string };
    educationalLevel: { id: string; prefLabel: string };
    audience: { id: string; prefLabel: string };
    inLanguage: string;
    teaches?: Array<{ id: string; prefLabel: string }>;
    estimatedDuration?: string;
}

export async function generateAmbMetadataWithAI(
    board: Board
): Promise<AiGeneratedMetadata> {
    const boardContext = board.getContextData(true);
    
    // LLM-Request mit strukturiertem Output
    const response = await chatStore.sendToLLMWithSystem(
        AI_METADATA_PROMPT,
        JSON.stringify(boardContext),
        { responseFormat: 'json' }
    );
    
    return JSON.parse(response) as AiGeneratedMetadata;
}

export async function publishBoardToEdufeedWithAI(
    board: Board,
    options: AmbPublishOptions
): Promise<AmbPublishResult> {
    // 1. KI-Metadaten generieren (optional, mit User-Bestätigung)
    const aiMetadata = options.useAiMetadata 
        ? await generateAmbMetadataWithAI(board)
        : null;
    
    // 2. Metadaten in AMB-Event integrieren
    const ambResource = boardToAmbResource(board, {
        ...options,
        aiMetadata  // Merge mit manuellen Daten
    });
    
    // 3. Publish...
}
```

### Verwendete Vokabulare (URIs)

| Vokabular | Basis-URI | Verwendung |
|-----------|-----------|------------|
| **KIM Schulfächer** | `http://w3id.org/kim/schulfaecher/` | `about` - Fachzuordnung |
| **KIM Hochschulfächer** | `https://w3id.org/kim/hochschulfaechersystematik/` | `about` - Hochschulkontext |
| **KIM Educational Level** | `https://w3id.org/kim/educationalLevel/` | `educationalLevel` |
| **HCRT** | `https://w3id.org/kim/hcrt/` | `learningResourceType` |
| **OpenEduHub LRT** | `http://w3id.org/openeduhub/vocabs/new_lrt/` | `learningResourceType` |
| **LRMI Audience** | `http://purl.org/dcx/lrmi-vocabs/educationalAudienceRole/` | `audience` |

### UI-Flow mit KI-Vorschlägen

```
┌─────────────────────────────────────────────────────────────┐
│  📤 Board veröffentlichen                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🤖 KI-Vorschläge generieren?          [Ja] [Nein]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Nach KI-Analyse:                                           │
│                                                             │
│  📚 Fach:        [Mathematik ▼] (KI-Vorschlag: Mathematik) │
│  🎓 Bildungsstufe: [Sekundarstufe I ▼] (KI: Sek I)         │
│  👥 Zielgruppe:  [Schüler ▼] (KI: student)                 │
│  🌐 Sprache:     [Deutsch ▼] (KI: de)                      │
│  🏷️ Keywords:    [Bruchrechnung, Dezimalzahlen, ...]       │
│                   ↑ KI-generiert, editierbar                │
│                                                             │
│  ⏱️ Geschätzte Dauer: [45 min] (KI: PT45M)                 │
│                                                             │
│                          [Abbrechen] [Veröffentlichen]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementierungsplan

### Phase 1: Content-Integration (Priorität: Hoch)

```typescript
// ambPublisher.ts - boardToAmbResource() erweitern

export function boardToAmbResource(
    board: Board,
    options: Partial<AmbPublishOptions> = {}
): AmbLearningResource {
    // Vollständigen Board-Snapshot erstellen
    const boardSnapshot = board.getContextData(true);
    
    // ... bestehende Metadaten-Logik ...
    
    // NEU: Board-Content als encoding hinzufügen
    const ambResource: AmbLearningResource = {
        // ... bestehende Felder ...
        
        // Strukturierte Darstellung (für AMB-kompatible Clients)
        hasPart: boardSnapshot.columns.map((col, index) => ({
            type: 'Chapter',
            name: col.name,
            position: index + 1,
            hasPart: col.cards?.map((card, cardIndex) => ({
                type: 'LearningObject',
                name: card.heading,
                description: card.content,
                position: cardIndex + 1
            }))
        })),
        
        // Vollständiger Snapshot als Encoding (für Import)
        encoding: {
            contentType: 'application/json',
            // Base64-kodierter Snapshot für kompakte Übertragung
            encodingFormat: 'base64',
            contentUrl: `data:application/json;base64,${btoa(JSON.stringify(boardSnapshot))}`
        }
    };
    
    return ambResource;
}
```

### Phase 2: Link-Generierung (Priorität: Hoch)

```typescript
// ambPublisher.ts - publishBoardToEdufeed() erweitern

export async function publishBoardToEdufeed(
    board: Board,
    options: AmbPublishOptions
): Promise<AmbPublishResult> {
    // ... bestehende Publish-Logik ...
    
    if (result.success && ndkEvent.id) {
        // Link-Generierung nach erfolgreichem Publish
        const naddr = nip19.naddrEncode({
            kind: 30142,
            pubkey: options.pubkey,
            identifier: ambResource.id,
            relays: settingsStore.settings.relaysPublic || []
        });
        
        const njumpBaseUrl = settingsStore.settings.njumpUrl || 'https://njump.me';
        const appBaseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : 'https://app.edufeed.org';
        
        return {
            success: true,
            eventId: ndkEvent.id,
            ambResource,
            links: {
                naddr,
                njumpUrl: `${njumpBaseUrl}/${naddr}`,
                importUrl: `${appBaseUrl}/cardsboard/${naddr}`,
                nostrUri: `nostr:${naddr}`
            }
        };
    }
    
    // ... Error-Handling ...
}
```

### Phase 3: Import-Unterstützung (Priorität: Mittel)

Die bestehende `/cardsboard/[naddr]/+page.svelte` Route erweitern:

```typescript
// Unterstützung für Kind 30142 (AMB Learning Resource) hinzufügen
async function loadBoardFromNostr(naddrData: NaddrData): Promise<void> {
    const filter = {
        kinds: [30301, 30142], // Board ODER AMB Learning Resource
        authors: [naddrData.pubkey],
        '#d': [naddrData.identifier]
    };
    
    const event = await ndk.fetchEvent(filter);
    
    if (event?.kind === 30142) {
        // AMB Learning Resource: Content parsen
        const snapshot = JSON.parse(event.content);
        // Board aus Snapshot rekonstruieren...
    } else if (event?.kind === 30301) {
        // Standard Board Event (bestehende Logik)
    }
}
```

### Phase 4: KI-Metadaten-Generierung (Priorität: Niedrig - Nice to have)

**Ziel:** Automatische Generierung von Bildungsmetadaten via LLM

#### 4.1 KI-Service Integration

```typescript
// src/lib/utils/ambPublisher.ts

import { chatStore } from '$lib/stores/chatStore.svelte';

interface AiMetadataOptions {
    /** Welche Properties sollen generiert werden? */
    fields?: Array<'about' | 'keywords' | 'learningResourceType' | 'educationalLevel' | 'audience' | 'inLanguage' | 'teaches' | 'duration'>;
    
    /** KI-Modell (falls mehrere verfügbar) */
    model?: string;
    
    /** Timeout in Millisekunden */
    timeout?: number;
}

export async function generateAmbMetadataWithAI(
    board: Board,
    options: AiMetadataOptions = {}
): Promise<AiGeneratedMetadata> {
    const { fields = ['about', 'keywords', 'educationalLevel', 'inLanguage'], timeout = 30000 } = options;
    
    // Board-Kontext für KI aufbereiten
    const boardContext = board.getContextData(true);
    const contextSummary = {
        name: boardContext.name,
        description: boardContext.description,
        tags: boardContext.tags,
        columns: boardContext.columns.map(col => ({
            name: col.name,
            cardCount: col.cards?.length || 0,
            sampleCards: col.cards?.slice(0, 3).map(c => ({
                heading: c.heading,
                content: c.content?.substring(0, 200) // Limit für Token-Effizienz
            }))
        }))
    };
    
    const prompt = buildAiMetadataPrompt(contextSummary, fields);
    
    try {
        const response = await Promise.race([
            chatStore.sendToLLMWithSystem(
                prompt,
                JSON.stringify(contextSummary),
                { responseFormat: 'json' }
            ),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('AI timeout')), timeout)
            )
        ]);
        
        const metadata = JSON.parse(response);
        
        // Validierung & Mapping zu URIs
        return validateAndMapMetadata(metadata);
        
    } catch (error) {
        console.error('❌ AI Metadata generation failed:', error);
        // Fallback: Basis-Metadaten ohne KI
        return {
            inLanguage: detectLanguageBasic(boardContext),
            keywords: boardContext.tags || [],
            learningResourceType: { 
                id: 'http://w3id.org/openeduhub/vocabs/new_lrt/c2e7e1f1-6c8f-4b1f-a5b5-7c1f6c8f4b1f',
                prefLabel: 'Kurs' 
            },
            about: [],
            educationalLevel: { id: '', prefLabel: '' },
            audience: { id: '', prefLabel: '' }
        };
    }
}

function buildAiMetadataPrompt(context: any, fields: string[]): string {
    return `
Du bist ein Experte für Bildungsmetadaten nach dem AMB-Standard (Allgemeines Metadatenprofil für Bildungsressourcen).

Analysiere das folgende Kanban-Board und extrahiere Metadaten:

**Board-Titel:** ${context.name}
**Beschreibung:** ${context.description}
**Bestehende Tags:** ${context.tags?.join(', ')}

**Spalten:**
${context.columns.map(col => `
- ${col.name} (${col.cardCount} Karten)
  Beispiele: ${col.sampleCards?.map(c => c.heading).join(', ')}
`).join('\n')}

Ermittle folgende Metadaten im JSON-Format:

{
  ${fields.includes('about') ? '"about": [{ "id": "<KIM Schulfächer URI>", "prefLabel": "<Fachname>" }],' : ''}
  ${fields.includes('keywords') ? '"keywords": ["<keyword1>", "<keyword2>", ...],' : ''}
  ${fields.includes('learningResourceType') ? '"learningResourceType": { "id": "<HCRT URI>", "prefLabel": "<Typ>" },' : ''}
  ${fields.includes('educationalLevel') ? '"educationalLevel": { "id": "<KIM Level URI>", "prefLabel": "<Stufe>" },' : ''}
  ${fields.includes('audience') ? '"audience": { "id": "<LRMI URI>", "prefLabel": "<Zielgruppe>" },' : ''}
  ${fields.includes('inLanguage') ? '"inLanguage": "<ISO 639-1 code>",' : ''}
  ${fields.includes('teaches') ? '"teaches": [{ "id": "<URI>", "prefLabel": "<Lernziel>" }],' : ''}
  ${fields.includes('duration') ? '"estimatedDuration": "<ISO 8601 duration>"' : ''}
}

**Wichtig:**
- Verwende IMMER offizielle URIs aus KIM, HCRT, LRMI Vokabularen
- Falls kein passendes Fach gefunden: about = []
- Schätze educationalLevel realistisch (Grundschule, Sek I, Sek II, Hochschule)
- Duration in ISO 8601 Format (z.B. "PT2H30M" für 2.5 Stunden)
`;
}

function validateAndMapMetadata(raw: any): AiGeneratedMetadata {
    // Validierung der URIs
    const validated: AiGeneratedMetadata = {
        inLanguage: raw.inLanguage || 'de',
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        learningResourceType: raw.learningResourceType || { id: '', prefLabel: 'Kurs' },
        about: Array.isArray(raw.about) ? raw.about : [],
        educationalLevel: raw.educationalLevel || { id: '', prefLabel: '' },
        audience: raw.audience || { id: '', prefLabel: '' }
    };
    
    if (raw.teaches) validated.teaches = raw.teaches;
    if (raw.estimatedDuration) validated.estimatedDuration = raw.estimatedDuration;
    
    return validated;
}

function detectLanguageBasic(boardContext: any): string {
    // Einfache Heuristik ohne KI
    const text = `${boardContext.name} ${boardContext.description}`.toLowerCase();
    
    if (/[äöüß]/.test(text)) return 'de';
    if (/[àâéèêëôùûç]/.test(text)) return 'fr';
    if (/[áéíóúñ]/.test(text)) return 'es';
    
    return 'en'; // Default
}
```

#### 4.2 UI-Integration: Publish-Dialog mit KI-Vorschau

```svelte
<!-- PublishToEdufeedDialog.svelte (NEU) -->
<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import SparklesIcon from '@lucide/svelte/icons/sparkles';
    import CheckIcon from '@lucide/svelte/icons/check';
    
    let { board } = $props();
    
    let useAiMetadata = $state(false);
    let aiMetadata = $state<AiGeneratedMetadata | null>(null);
    let isGenerating = $state(false);
    
    async function handleGenerateMetadata() {
        isGenerating = true;
        try {
            aiMetadata = await generateAmbMetadataWithAI(board, {
                fields: ['about', 'keywords', 'educationalLevel', 'audience', 'inLanguage']
            });
        } catch (error) {
            console.error('AI generation failed:', error);
        } finally {
            isGenerating = false;
        }
    }
    
    async function handlePublish() {
        const result = await publishBoardToEdufeed(board, {
            pubkey: authStore.getPubkey()!,
            aiMetadata: useAiMetadata ? aiMetadata : undefined
        });
        
        if (result.success) {
            // Show links dialog
        }
    }
</script>

<Dialog.Content class="max-w-2xl">
    <Dialog.Header>
        <Dialog.Title>📤 Board veröffentlichen</Dialog.Title>
    </Dialog.Header>
    
    <div class="space-y-4">
        <!-- KI-Toggle -->
        <div class="flex items-center gap-2 p-4 border rounded-lg">
            <Checkbox bind:checked={useAiMetadata} />
            <div class="flex-1">
                <p class="font-medium">🤖 KI-Metadaten generieren</p>
                <p class="text-sm text-muted-foreground">
                    Automatische Analyse für Fach, Bildungsstufe, Keywords, etc.
                </p>
            </div>
            
            {#if useAiMetadata && !aiMetadata}
                <Button size="sm" onclick={handleGenerateMetadata} disabled={isGenerating}>
                    <SparklesIcon class="mr-2 h-4 w-4" />
                    {isGenerating ? 'Analysiere...' : 'Generieren'}
                </Button>
            {/if}
            
            {#if aiMetadata}
                <CheckIcon class="h-5 w-5 text-green-600" />
            {/if}
        </div>
        
        <!-- KI-Vorschau -->
        {#if isGenerating}
            <div class="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-4 w-1/2" />
            </div>
        {/if}
        
        {#if aiMetadata}
            <div class="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 class="font-medium flex items-center gap-2">
                    <SparklesIcon class="h-4 w-4 text-purple-600" />
                    KI-Vorschläge
                </h4>
                
                <div class="grid gap-2 text-sm">
                    {#if aiMetadata.about.length > 0}
                        <div>
                            <span class="font-medium">📚 Fach:</span>
                            {aiMetadata.about.map(a => a.prefLabel).join(', ')}
                        </div>
                    {/if}
                    
                    {#if aiMetadata.educationalLevel.prefLabel}
                        <div>
                            <span class="font-medium">🎓 Bildungsstufe:</span>
                            {aiMetadata.educationalLevel.prefLabel}
                        </div>
                    {/if}
                    
                    {#if aiMetadata.audience.prefLabel}
                        <div>
                            <span class="font-medium">👥 Zielgruppe:</span>
                            {aiMetadata.audience.prefLabel}
                        </div>
                    {/if}
                    
                    <div>
                        <span class="font-medium">🌐 Sprache:</span>
                        {aiMetadata.inLanguage}
                    </div>
                    
                    {#if aiMetadata.keywords.length > 0}
                        <div>
                            <span class="font-medium">🏷️ Keywords:</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                                {#each aiMetadata.keywords.slice(0, 5) as keyword}
                                    <Badge variant="secondary">{keyword}</Badge>
                                {/each}
                                {#if aiMetadata.keywords.length > 5}
                                    <Badge variant="outline">+{aiMetadata.keywords.length - 5}</Badge>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
                
                <p class="text-xs text-muted-foreground italic">
                    Diese Vorschläge wurden automatisch generiert und können vor der Veröffentlichung bearbeitet werden.
                </p>
            </div>
        {/if}
    </div>
    
    <Dialog.Footer>
        <Button variant="outline" onclick={close}>Abbrechen</Button>
        <Button onclick={handlePublish}>
            Veröffentlichen
        </Button>
    </Dialog.Footer>
</Dialog.Content>
```

#### 4.3 Manuelle Bearbeitungsmöglichkeit

Falls KI-Vorschläge nicht passen, sollte der User sie editieren können:

```svelte
<!-- Nach KI-Generierung: Editable Fields -->
{#if aiMetadata}
    <div class="space-y-3">
        <Select.Root bind:value={aiMetadata.educationalLevel}>
            <Select.Trigger>
                <Select.Value placeholder="Bildungsstufe" />
            </Select.Trigger>
            <Select.Content>
                <Select.Item value={{ id: 'https://w3id.org/kim/educationalLevel/level_A', prefLabel: 'Grundschule' }}>
                    Grundschule
                </Select.Item>
                <Select.Item value={{ id: 'https://w3id.org/kim/educationalLevel/level_B', prefLabel: 'Sekundarstufe I' }}>
                    Sekundarstufe I
                </Select.Item>
                <!-- ... weitere Optionen ... -->
            </Select.Content>
        </Select.Root>
        
        <!-- Keywords editierbar -->
        <TagInput bind:tags={aiMetadata.keywords} />
    </div>
{/if}
```

#### 4.4 Performance-Optimierung

```typescript
// Cache für KI-Metadaten (Board-Hash → Metadata)
const metadataCache = new Map<string, AiGeneratedMetadata>();

export async function generateAmbMetadataWithAI(
    board: Board,
    options: AiMetadataOptions = {}
): Promise<AiGeneratedMetadata> {
    // Hash des Board-Inhalts berechnen
    const boardHash = hashBoardContent(board);
    
    // Cache-Lookup
    if (metadataCache.has(boardHash)) {
        console.log('✅ Using cached AI metadata');
        return metadataCache.get(boardHash)!;
    }
    
    // Neu generieren
    const metadata = await generateMetadataFromLLM(board, options);
    
    // Cache speichern
    metadataCache.set(boardHash, metadata);
    
    return metadata;
}

function hashBoardContent(board: Board): string {
    const content = JSON.stringify({
        name: board.name,
        description: board.description,
        tags: board.tags,
        columnCount: board.columns.length,
        cardCount: board.columns.reduce((sum, col) => sum + col.cards.length, 0)
    });
    
    // Einfacher Hash (für echte Impl: crypto.subtle.digest)
    return btoa(content);
}
```

#### 4.5 Konfiguration in settings.json

```json
{
  "ai": {
    "metadataGeneration": {
      "enabled": true,
      "autoSuggest": false,
      "defaultFields": ["about", "keywords", "educationalLevel", "inLanguage"],
      "timeout": 30000,
      "cacheEnabled": true
    }
  }
}
```

---

## ✅ Akzeptanzkriterien

### Muss-Kriterien

- [ ] Board-Content (Spalten + Karten) wird im Event-Content gespeichert
- [ ] `getContextData(true)` Format wird verwendet (konsistent mit Snapshots)
- [ ] naddr-Link wird nach Publish generiert und zurückgegeben
- [ ] njump-URL zeigt Board-Metadaten korrekt an
- [ ] Import via `/cardsboard/[naddr]` funktioniert für Kind 30142

### Soll-Kriterien

- [ ] QR-Code für Import-Link wird generiert
- [ ] Publish-Dialog zeigt alle Links übersichtlich an
- [ ] Board-Struktur wird als `hasPart` im AMB-Format dargestellt
- [ ] Relay-Hints im naddr für bessere Auffindbarkeit

### Kann-Kriterien

- [ ] Live-Subscription auf publizierte Boards
- [ ] Update-Funktion (existierendes AMB-Event aktualisieren)
- [ ] Versionsvergleich zwischen lokalem Board und publizierter Version

---

## 📚 Referenzen

- [AMB (Allgemeines Metadatenprofil für Bildungsressourcen)](https://w3id.org/kim/amb/)
- [NIP-19: bech32-encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [Kind 30142: AMB Learning Resource (Edufeed NIP)](https://github.com/edufeed-org/nips/blob/edufeed-amb/edufeed.md)
- [Bestehendes ShareLink-Feature](./SHARELINK.md)
- [Board Snapshots (Kind 30303)](./BOARD-SNAPSHOTS.md)
- [Paste-System Nostr-Handler](./PASTE-SYSTEM.md)

---

## 📝 Offene Fragen

1. **Relay-Strategie:** Nur Public Relays oder auch Private?
2. **Update-Semantik:** Replaceable Event oder neue Version?
3. **Größenlimit:** Wie groß darf der Content sein? (Relay-abhängig)
4. **Kompression:** Soll der Snapshot komprimiert werden (pako)?

