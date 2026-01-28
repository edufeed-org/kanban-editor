# 🔍 MCP-EDUFEED: Intelligente OER-Suche für das Kanban-Board

**Version:** 1.0 (Proposal)  
**Datum:** 27. Januar 2026  
**Status:** 🟡 PROPOSAL  
**Abhängigkeiten:** `@edufeed-org/oer-finder-api-client`, Tool-Based AI System

---

## I. Übersicht

### Problemstellung

Lehrkräfte möchten beim Erstellen von Unterrichtsplanungen im Kanban-Board **passende OER-Materialien** finden, die zum Thema des Boards oder einer bestimmten Karte passen. Aktuell müssen sie:

1. Manuell externe Plattformen durchsuchen (WLO, Openverse, etc.)
2. Links kopieren und in Karten einfügen
3. Metadaten (Titel, Beschreibung, Lizenz) selbst übertragen

### Lösung

Integration einer **KI-gesteuerten OER-Suche** in den Chat-Assistenten, die:

- ✅ Board/Card-Kontext für intelligente Suchanfragen nutzt
- ✅ Edufeed (Nostr Kind 30142) und externe Quellen durchsucht
- ✅ Ergebnisse direkt als Karten ins Board übernimmt
- ✅ Metadaten automatisch extrahiert (AMB-Format)

---

## II. Architektur

### Zwei-Phasen-Ansatz

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Tool-Integration (Quick Win)                          │
│  ════════════════════════════════════════                       │
│  Neue Tools im bestehenden AIPanel:                             │
│  • search_oer - Sucht OER-Materialien                           │
│  • add_cards_from_oer - Erstellt Cards aus Suchergebnissen      │
│                                                                  │
│  Nutzt: @edufeed-org/oer-finder-api-client (bereits vorhanden!) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: MCP Server (Optional, für externe Integration)        │
│  ════════════════════════════════════════════════════════       │
│  Eigenständiger MCP Server für:                                 │
│  • Nutzung durch externe AI-Assistenten (Claude, ChatGPT)       │
│  • Integration in andere Bildungs-Apps                          │
│  • Standardisierte Tool-Schnittstelle                           │
└─────────────────────────────────────────────────────────────────┘
```

### Bestehende Infrastruktur

| Komponente | Status | Beschreibung |
|------------|--------|--------------|
| `@edufeed-org/oer-finder-api-client` | ✅ Vorhanden | Type-safe API Client für OER-Suche |
| `@edufeed-org/oer-finder-plugin` | ✅ Vorhanden | Web Components (für UI, optional) |
| `@edufeed-org/amb-nostr-converter` | ✅ Vorhanden | Nostr ↔ AMB Konvertierung |
| Tool-Based AI System | ✅ Vorhanden | OpenAI Function Calling in AIPanel |
| Paste-System (Kind 30142) | ✅ Vorhanden | Verarbeitet bereits naddr-Links |

---

## III. Tool-Spezifikationen

### Tool 1: `search_oer`

**Beschreibung:** Sucht OER-Materialien im Edufeed-Netzwerk und externen Quellen.

```typescript
// src/lib/agent/tools/toolDefinitions.ts

{
  type: 'function',
  function: {
    name: 'search_oer',
    description: `Sucht Open Educational Resources (OER) in Edufeed und externen Quellen.
Nutze dieses Tool wenn der User nach Materialien, Ressourcen, Videos, Bildern 
oder Lernmaterialien zu einem Thema sucht.

Beispiele:
- "Finde Material zu Fake News"
- "Suche Videos zum Thema Klimawandel"
- "Gibt es Bilder zur Photosynthese?"
- "Zeig mir Ressourcen für Medienkompetenz Klasse 9"`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Suchbegriff(e), z.B. "Fake News Medienkompetenz"'
        },
        type: {
          type: 'string',
          enum: ['LearningResource', 'VideoObject', 'ImageObject', 'AudioObject', 'Document'],
          description: 'Typ der Ressource (optional, default: alle)'
        },
        source: {
          type: 'string',
          enum: ['nostr', 'openverse', 'all'],
          description: 'Datenquelle (optional, default: "nostr")'
        },
        license: {
          type: 'string',
          enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA'],
          description: 'Lizenzfilter (optional)'
        },
        educational_level: {
          type: 'string',
          enum: ['primary', 'secondary', 'tertiary'],
          description: 'Bildungsstufe (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximale Anzahl Ergebnisse (default: 5, max: 10)'
        }
      },
      required: ['query']
    }
  }
}
```

**Rückgabe-Format:**

```typescript
interface OerSearchResult {
  success: boolean;
  message: string;
  results: Array<{
    id: string;           // naddr oder externe ID
    title: string;
    description: string;
    type: string;         // LearningResource, VideoObject, etc.
    image?: string;       // Vorschaubild-URL
    url: string;          // Link zur Ressource
    license?: string;
    creator?: string;
    source: 'nostr' | 'openverse' | 'arasaac';
  }>;
  totalCount: number;
}
```

---

### Tool 2: `add_cards_from_oer`

**Beschreibung:** Erstellt Karten aus OER-Suchergebnissen in einer Spalte (z.B. "Material"). Pro relevantem Treffer wird eine Karte erstellt (analog zu NostrEventHandler).

**KI-Relevanz-Auswahl:** Die KI analysiert die Suchergebnisse und wählt die relevantesten basierend auf:
- Board-Kontext (Thema, Klassenstufe)
- Bereits vorhandene Karten (Duplikat-Vermeidung)
- Diversität (verschiedene Medientypen bevorzugt)

```typescript
{
  type: 'function',
  function: {
    name: 'add_cards_from_oer',
    description: `Erstellt eine oder mehrere Karten aus OER-Suchergebnissen.
Nutze dieses Tool NACHDEM search_oer Ergebnisse geliefert hat.

Die KI wählt die relevantesten Ergebnisse basierend auf dem Board-Kontext.
Beispiele:
- "Füge die passenden Materialien zur Spalte Material hinzu"
- "Nimm die ersten 3 Ergebnisse für Einstieg"
- "Pack alle Videos in die Spalte Medien"`,
    parameters: {
      type: 'object',
      properties: {
        oer_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs oder Nummern der OER-Ergebnisse (z.B. ["1", "3", "5"] für Ergebnis 1, 3 und 5)'
        },
        column_name: {
          type: 'string',
          description: 'Ziel-Spalte für die neuen Karten (z.B. "Material", "Einstieg")'
        },
        include_metadata: {
          type: 'boolean',
          description: 'Metadaten (Lizenz, Autor) in Beschreibung aufnehmen (default: true)'
        }
      },
      required: ['oer_ids', 'column_name']
    }
  }
}
```

---

### Tool 3: `search_oer_for_card` (Kontext-basiert)

**Beschreibung:** Sucht automatisch passende Materialien basierend auf einer Karte.

```typescript
{
  type: 'function',
  function: {
    name: 'search_oer_for_card',
    description: `Sucht OER-Materialien, die zum Thema einer bestehenden Karte passen.
Analysiert Titel, Beschreibung und Labels der Karte und generiert optimierte Suchanfragen.

Nutze dieses Tool wenn der User sagt:
- "Finde Material für diese Karte"
- "Suche passende Ressourcen zur ausgewählten Karte"
- "Gibt es OER zum Thema der Karte?"`,
    parameters: {
      type: 'object',
      properties: {
        card_id: {
          type: 'string',
          description: 'ID der Karte, für die Material gesucht werden soll'
        },
        type: {
          type: 'string',
          enum: ['LearningResource', 'VideoObject', 'ImageObject', 'AudioObject', 'Document'],
          description: 'Typ der Ressource (optional)'
        },
        limit: {
          type: 'number',
          description: 'Maximale Anzahl Ergebnisse (default: 5)'
        }
      },
      required: ['card_id']
    }
  }
}
```

---

## IV. Implementierung

### Dateistruktur

```
src/lib/agent/tools/
├── index.ts                    # Exports (erweitern)
├── toolDefinitions.ts          # Tool-Schemas (erweitern)
├── toolExecutor.ts             # Tool-Dispatcher (erweitern)
├── toolSystemPrompt.ts         # System Prompt (erweitern)
│
└── oer/                        # 🆕 NEU
    ├── index.ts                # OER-Tool Exports
    ├── oerSearchTool.ts        # search_oer Implementation
    ├── oerCardsTool.ts         # add_cards_from_oer Implementation (Plural!)
    ├── oerContextTool.ts       # search_oer_for_card Implementation
    └── oerClient.ts            # Wrapper für oer-finder-api-client
```

### oerClient.ts - API-Wrapper

```typescript
// src/lib/agent/tools/oer/oerClient.ts

import { createOerClient, type OerResource } from '@edufeed-org/oer-finder-api-client';
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

// Singleton Client
let client: ReturnType<typeof createOerClient> | null = null;

function getClient() {
  if (!client) {
    // API URL aus Settings oder Default
    const baseUrl = settingsStore.settings.oerFinderApiUrl || 'https://finder.edufeed.org';
    client = createOerClient({ baseUrl });
  }
  return client;
}

export interface OerSearchParams {
  query: string;
  type?: 'LearningResource' | 'VideoObject' | 'ImageObject' | 'AudioObject' | 'Document';
  source?: 'nostr' | 'openverse' | 'all';
  license?: string;
  educational_level?: string;
  limit?: number;
}

export interface OerSearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
  image?: string;
  url: string;
  license?: string;
  creator?: string;
  source: string;
  naddr?: string;  // Falls Nostr-Ressource
}

/**
 * Sucht OER-Materialien
 */
export async function searchOer(params: OerSearchParams): Promise<{
  results: OerSearchResult[];
  totalCount: number;
  error?: string;
}> {
  try {
    const client = getClient();
    
    const response = await client.GET('/search', {
      params: {
        query: {
          searchTerm: params.query,
          source: params.source || 'nostr',
          type: params.type,
          license: params.license,
          educational_level: params.educational_level,
          pageSize: Math.min(params.limit || 5, 10),
          page: 1
        }
      }
    });

    if (response.error) {
      return { results: [], totalCount: 0, error: response.error.message };
    }

    const data = response.data;
    
    return {
      results: (data?.items || []).map(item => ({
        id: item.id || item.naddr || crypto.randomUUID(),
        title: item.name || 'Unbenannt',
        description: item.description || '',
        type: item.type || 'LearningResource',
        image: item.image,
        url: item.url || '',
        license: item.license?.id,
        creator: item.creator?.name,
        source: item.source || 'nostr',
        naddr: item.naddr
      })),
      totalCount: data?.totalCount || 0
    };
  } catch (error) {
    console.error('❌ OER Search failed:', error);
    return { 
      results: [], 
      totalCount: 0, 
      error: error instanceof Error ? error.message : 'Unbekannter Fehler' 
    };
  }
}

/**
 * Lädt Details zu einer OER-Ressource
 */
export async function getOerDetails(id: string): Promise<OerSearchResult | null> {
  // Wenn naddr, direkt über NDK laden (wie im Paste-System)
  if (id.startsWith('naddr1')) {
    // Siehe: src/lib/stores/boardstore/paste.ts NostrEventHandler
    // Kann wiederverwendet werden
    return null; // TODO: Implementierung aus paste.ts extrahieren
  }
  
  // Sonst über API
  try {
    const client = getClient();
    const response = await client.GET('/resource/{id}', {
      params: { path: { id } }
    });
    
    if (response.data) {
      return {
        id: response.data.id,
        title: response.data.name || 'Unbenannt',
        description: response.data.description || '',
        type: response.data.type || 'LearningResource',
        image: response.data.image,
        url: response.data.url || '',
        license: response.data.license?.id,
        creator: response.data.creator?.name,
        source: 'nostr'
      };
    }
    return null;
  } catch {
    return null;
  }
}
```

### oerSearchTool.ts - Tool-Executor

```typescript
// src/lib/agent/tools/oer/oerSearchTool.ts

import { searchOer, type OerSearchParams, type OerSearchResult } from './oerClient.js';
import type { ToolResult } from '../types.js';

// Cache für letzte Suchergebnisse (für add_card_from_oer)
let lastSearchResults: OerSearchResult[] = [];

export function getLastSearchResults(): OerSearchResult[] {
  return lastSearchResults;
}

/**
 * Führt search_oer Tool aus
 */
export async function executeSearchOer(args: {
  query: string;
  type?: string;
  source?: string;
  license?: string;
  educational_level?: string;
  limit?: number;
}): Promise<ToolResult> {
  console.log('🔍 [search_oer] Suche:', args.query);
  
  const params: OerSearchParams = {
    query: args.query,
    type: args.type as OerSearchParams['type'],
    source: (args.source || 'nostr') as OerSearchParams['source'],
    license: args.license,
    educational_level: args.educational_level,
    limit: args.limit || 5
  };

  const { results, totalCount, error } = await searchOer(params);

  if (error) {
    return {
      success: false,
      message: `❌ Suche fehlgeschlagen: ${error}`
    };
  }

  if (results.length === 0) {
    return {
      success: true,
      message: `🔍 Keine Ergebnisse für "${args.query}" gefunden. Versuche andere Suchbegriffe.`
    };
  }

  // Cache für spätere Nutzung
  lastSearchResults = results;

  // Formatierte Ausgabe für Chat
  const resultList = results.map((r, i) => 
    `${i + 1}. **${r.title}** (${r.type})\n   ${r.description?.slice(0, 100)}${r.description && r.description.length > 100 ? '...' : ''}\n   📎 ${r.url}`
  ).join('\n\n');

  return {
    success: true,
    message: `🔍 **${totalCount} Ergebnisse gefunden** (zeige ${results.length}):\n\n${resultList}\n\n💡 Sage z.B. "Füge Ergebnis 1 zur Spalte Material hinzu" um eine Karte zu erstellen.`,
    result: {
      results,
      totalCount
    }
  };
}
```

### oerCardsTool.ts - Batch-Karten-Erstellung

```typescript
// src/lib/agent/tools/oer/oerCardsTool.ts

import { getLastSearchResults, type OerSearchResult } from './oerSearchTool.js';
import { getOerDetails } from './oerClient.js';
import type { ToolResult, ExecutionContext } from '../types.js';

/**
 * Erstellt eine einzelne Karte aus OER-Daten (analog zu NostrEventHandler)
 */
function createCardFromOer(
  oerData: OerSearchResult,
  columnId: string,
  includeMetadata: boolean,
  boardStore: any
): { success: boolean; title: string; error?: string } {
  try {
    // Card-Content erstellen
    let content = oerData.description || '';
    
    if (includeMetadata) {
      const metadata: string[] = [];
      if (oerData.creator) metadata.push(`**Autor:** ${oerData.creator}`);
      if (oerData.license) metadata.push(`**Lizenz:** ${oerData.license}`);
      if (oerData.type) metadata.push(`**Typ:** ${oerData.type}`);
      
      if (metadata.length > 0) {
        content += '\n\n---\n' + metadata.join('\n');
      }
    }

    // Karte erstellen
    const cardId = boardStore.createCard(columnId, oerData.title, content);
    
    if (cardId) {
      const updates: Record<string, any> = {};
      
      if (oerData.image) {
        updates.image = oerData.image;
      }
      
      if (oerData.url) {
        updates.links = [{ 
          id: crypto.randomUUID(),
          title: 'Zur Ressource',
          url: oerData.url 
        }];
      }
      
      // Labels basierend auf Typ
      const labels: string[] = ['oer'];
      if (oerData.type) {
        labels.push(oerData.type.toLowerCase().replace('object', ''));
      }
      if (oerData.source !== 'nostr') {
        labels.push(oerData.source);
      }
      updates.labels = labels;
      
      boardStore.editCard(cardId, updates);
    }

    return { success: true, title: oerData.title };
  } catch (error) {
    return { 
      success: false, 
      title: oerData.title,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    };
  }
}

/**
 * Führt add_cards_from_oer Tool aus (Batch-Verarbeitung)
 */
export async function executeAddCardsFromOer(
  args: {
    oer_ids: string[];
    column_name: string;
    include_metadata?: boolean;
  },
  context: ExecutionContext
): Promise<ToolResult> {
  const { boardStore, board } = context;
  
  // 1. Spalte finden
  const column = board?.columns.find(
    c => c.name.toLowerCase() === args.column_name.toLowerCase()
  );
  
  if (!column) {
    const availableColumns = board?.columns.map(c => c.name).join(', ') || 'keine';
    return {
      success: false,
      message: `❌ Spalte "${args.column_name}" nicht gefunden. Verfügbar: ${availableColumns}`
    };
  }

  // 2. OER-Daten für alle IDs sammeln
  const lastResults = getLastSearchResults();
  const oerDataList: OerSearchResult[] = [];
  const notFound: string[] = [];

  for (const oerId of args.oer_ids) {
    // Prüfe ob es eine Nummer ist (z.B. "1" für erstes Ergebnis)
    const resultIndex = parseInt(oerId) - 1;
    
    if (!isNaN(resultIndex) && resultIndex >= 0 && resultIndex < lastResults.length) {
      oerDataList.push(lastResults[resultIndex]);
    } else {
      // Versuche direkt per ID zu laden
      const oerData = await getOerDetails(oerId);
      if (oerData) {
        oerDataList.push(oerData);
      } else {
        notFound.push(oerId);
      }
    }
  }

  if (oerDataList.length === 0) {
    return {
      success: false,
      message: `❌ Keine OER-Ressourcen gefunden. Führe zuerst eine Suche durch.`
    };
  }

  // 3. Karten erstellen (Batch)
  const includeMetadata = args.include_metadata !== false;
  const created: string[] = [];
  const failed: string[] = [];

  for (const oerData of oerDataList) {
    const result = createCardFromOer(oerData, column.id, includeMetadata, boardStore);
    if (result.success) {
      created.push(result.title);
    } else {
      failed.push(`${result.title}: ${result.error}`);
    }
  }

  // 4. Ergebnis-Nachricht formatieren
  let message = '';
  
  if (created.length > 0) {
    message += `✅ **${created.length} Karte(n)** in Spalte **"${column.name}"** erstellt:\n`;
    message += created.map(t => `- ${t}`).join('\n');
  }
  
  if (failed.length > 0) {
    message += `\n\n⚠️ ${failed.length} Fehler:\n`;
    message += failed.map(f => `- ${f}`).join('\n');
  }
  
  if (notFound.length > 0) {
    message += `\n\n❌ Nicht gefunden: ${notFound.join(', ')}`;
  }

  return {
    success: created.length > 0,
    message,
    result: {
      created: created.length,
      failed: failed.length,
      notFound: notFound.length
    }
  };
}
```

### oerContextTool.ts - Kontext-basierte Suche

```typescript
// src/lib/agent/tools/oer/oerContextTool.ts

import { searchOer } from './oerClient.js';
import type { ToolResult, ExecutionContext } from '../types.js';

/**
 * Führt search_oer_for_card Tool aus
 * Analysiert Card-Kontext und generiert optimierte Suchanfragen
 */
export async function executeSearchOerForCard(
  args: {
    card_id: string;
    type?: string;
    limit?: number;
  },
  context: ExecutionContext
): Promise<ToolResult> {
  const { board } = context;
  
  // 1. Karte finden
  let targetCard: any = null;
  let targetColumn: any = null;
  
  for (const col of board?.columns || []) {
    const card = col.cards?.find((c: any) => c.id === args.card_id);
    if (card) {
      targetCard = card;
      targetColumn = col;
      break;
    }
  }

  if (!targetCard) {
    return {
      success: false,
      message: `❌ Karte mit ID "${args.card_id}" nicht gefunden.`
    };
  }

  // 2. Suchbegriffe aus Karte extrahieren
  const searchTerms: string[] = [];
  
  // Titel (wichtigste Quelle)
  if (targetCard.heading) {
    searchTerms.push(targetCard.heading);
  }
  
  // Labels
  if (targetCard.labels && targetCard.labels.length > 0) {
    searchTerms.push(...targetCard.labels.filter((l: string) => 
      !['draft', 'published', 'archived', 'oer'].includes(l.toLowerCase())
    ));
  }
  
  // Board-Kontext (falls relevant)
  if (board?.name) {
    // Nur wenn Board-Name nicht generisch ist
    const genericNames = ['board', 'kanban', 'projekt', 'untitled'];
    if (!genericNames.some(g => board.name.toLowerCase().includes(g))) {
      searchTerms.push(board.name);
    }
  }

  // Kombinierte Suchanfrage
  const query = searchTerms.slice(0, 3).join(' ');

  console.log('🔍 [search_oer_for_card] Generierte Suche:', query);
  console.log('   Basierend auf Karte:', targetCard.heading);
  console.log('   In Spalte:', targetColumn?.name);

  // 3. Suche ausführen (via search_oer)
  const { results, totalCount, error } = await searchOer({
    query,
    type: args.type as any,
    limit: args.limit || 5
  });

  if (error) {
    return {
      success: false,
      message: `❌ Suche fehlgeschlagen: ${error}`
    };
  }

  if (results.length === 0) {
    return {
      success: true,
      message: `🔍 Keine passenden Materialien für **"${targetCard.heading}"** gefunden.\n\nVersuche eine manuelle Suche mit anderen Begriffen.`
    };
  }

  // Formatierte Ausgabe
  const resultList = results.map((r, i) => 
    `${i + 1}. **${r.title}** (${r.type})\n   ${r.description?.slice(0, 80)}...`
  ).join('\n\n');

  return {
    success: true,
    message: `🔍 **${totalCount} passende Materialien** für Karte **"${targetCard.heading}"**:\n\n${resultList}\n\n💡 Sage "Füge Ergebnis 1 zur Spalte ${targetColumn?.name || 'Material'} hinzu"`,
    result: { results, totalCount, cardContext: targetCard.heading }
  };
}
```

---

## V. Integration in toolDefinitions.ts

```typescript
// Zu src/lib/agent/tools/toolDefinitions.ts hinzufügen:

// ═══════════════════════════════════════════════════════════════════
// OER SEARCH TOOLS
// ═══════════════════════════════════════════════════════════════════

{
  type: 'function',
  function: {
    name: 'search_oer',
    description: `Sucht Open Educational Resources (OER) in Edufeed und externen Quellen.
Nutze dieses Tool wenn der User nach Materialien, Ressourcen, Videos, Bildern 
oder Lernmaterialien zu einem Thema sucht.`,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff(e)' },
        type: { 
          type: 'string', 
          enum: ['LearningResource', 'VideoObject', 'ImageObject', 'AudioObject', 'Document']
        },
        source: { type: 'string', enum: ['nostr', 'openverse', 'all'] },
        license: { type: 'string', enum: ['CC0', 'CC-BY', 'CC-BY-SA', 'CC-BY-NC'] },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  }
},

{
  type: 'function',
  function: {
    name: 'add_cards_from_oer',
    description: `Erstellt Karten aus OER-Suchergebnissen (Batch).
Die KI wählt die relevantesten Ergebnisse basierend auf Board-Kontext.`,
    parameters: {
      type: 'object',
      properties: {
        oer_ids: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'IDs oder Nummern der OER-Ergebnisse (z.B. ["1", "3"])' 
        },
        column_name: { type: 'string', description: 'Ziel-Spalte' },
        include_metadata: { type: 'boolean' }
      },
      required: ['oer_ids', 'column_name']
    }
  }
},

{
  type: 'function',
  function: {
    name: 'search_oer_for_card',
    description: `Sucht OER-Materialien passend zum Thema einer Karte.
Analysiert automatisch Titel und Labels der Karte.`,
    parameters: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'ID der Karte' },
        type: { type: 'string', enum: ['LearningResource', 'VideoObject', 'ImageObject'] },
        limit: { type: 'number' }
      },
      required: ['card_id']
    }
  }
}
```

---

## VI. Integration in toolExecutor.ts

```typescript
// Zu src/lib/agent/tools/toolExecutor.ts hinzufügen:

import { executeSearchOer } from './oer/oerSearchTool.js';
import { executeAddCardsFromOer } from './oer/oerCardsTool.js';
import { executeSearchOerForCard } from './oer/oerContextTool.js';

// Im switch-Statement:
case 'search_oer':
  return await executeSearchOer(args);

case 'add_cards_from_oer':
  return await executeAddCardsFromOer(args, context);

case 'search_oer_for_card':
  return await executeSearchOerForCard(args, context);
```

---

## VII. Beispiel-Flows

### Flow 1: Einfache Suche

```
User: "Finde Material zu Fake News"

→ LLM ruft auf: search_oer({ query: "Fake News" })

→ Antwort:
🔍 **12 Ergebnisse gefunden** (zeige 5):

1. **Fake News erkennen** (LearningResource)
   Unterrichtseinheit zur Medienkompetenz...
   📎 https://edufeed.org/naddr1...

2. **So geht Medien: Fake News** (VideoObject)
   Video des BR zur Einführung...
   📎 https://www.br.de/...

💡 Sage z.B. "Füge die passenden Materialien zur Spalte Material hinzu"
```

### Flow 2: Mehrere Ergebnisse als Karten hinzufügen

```
User: "Füge die passenden Materialien zur Spalte Material hinzu"

→ LLM analysiert Relevanz und ruft auf: 
   add_cards_from_oer({ 
     oer_ids: ["1", "2", "4"],  // KI wählt die 3 relevantesten
     column_name: "Material" 
   })

→ Antwort:
✅ **3 Karte(n)** in Spalte **"Material"** erstellt:
- Fake News erkennen (Unterrichtseinheit)
- So geht Medien: Fake News (Video)
- Checkliste Faktencheck (Arbeitsblatt)
```

### Flow 2b: Einzelnes Ergebnis hinzufügen

```
User: "Nimm nur das erste Ergebnis für Einstieg"

→ LLM ruft auf: add_cards_from_oer({ 
    oer_ids: ["1"],
    column_name: "Einstieg" 
  })

→ Antwort:
✅ **1 Karte(n)** in Spalte **"Einstieg"** erstellt:
- Fake News erkennen
```

### Flow 3: Kontext-basierte Suche

```
User: (hat Karte "Photosynthese verstehen" ausgewählt)
      "Finde passendes Material für diese Karte"

→ LLM ruft auf: search_oer_for_card({ 
    card_id: "card-123" 
  })

→ Interne Verarbeitung:
   - Extrahiert: "Photosynthese verstehen"
   - Labels: ["biologie", "pflanzen"]
   - Generiert: "Photosynthese biologie pflanzen"

→ Antwort:
🔍 **8 passende Materialien** für Karte **"Photosynthese verstehen"**:

1. **Die Photosynthese** (VideoObject)
   Animiertes Erklärvideo...

2. **Arbeitsblatt Photosynthese** (Document)
   Lückentext mit Lösungen...
```

---

## VIII. Konfiguration

### settingsStore Erweiterung

```typescript
// In src/lib/stores/settingsStore.svelte.ts

interface SettingsState {
  // ... bestehende Settings
  
  // OER Search Settings
  oerFinderApiUrl: string;      // Default: 'https://finder.edufeed.org'
  oerDefaultSource: 'nostr' | 'openverse' | 'all';
  oerDefaultLimit: number;       // Default: 5
}
```

### config.json Erweiterung

```json
{
  "oer": {
    "finderApiUrl": "https://finder.edufeed.org",
    "defaultSource": "nostr",
    "defaultLimit": 5,
    "enabledSources": ["nostr", "openverse"]
  }
}
```

---

## IX. Acceptance Criteria

### Phase 1: Tool-Integration

- [ ] `search_oer` Tool ist im AIPanel verfügbar
- [ ] Suche in Edufeed (Nostr) funktioniert
- [ ] Suchergebnisse werden formatiert im Chat angezeigt
- [ ] `add_cards_from_oer` erstellt Karten batch-weise mit allen Metadaten
- [ ] KI-Relevanz-Auswahl funktioniert (basierend auf Board-Kontext)
- [ ] Bild, Link und Labels werden korrekt gesetzt
- [ ] `search_oer_for_card` extrahiert Kontext aus Karten
- [ ] Fehlerbehandlung bei API-Fehlern
- [ ] Tests für alle drei Tools

### Phase 2: MCP Server (Optional)

- [ ] Eigenständiger MCP Server implementiert
- [ ] Server ist über stdio oder HTTP erreichbar
- [ ] Dokumentation für externe Integration
- [ ] Rate-Limiting implementiert

---

## X. Timeline

| Phase | Aufwand | Beschreibung |
|-------|---------|--------------|
| **Phase 1.1** | 2-3 Tage | oerClient.ts + search_oer Tool |
| **Phase 1.2** | 2 Tage | add_cards_from_oer Tool (Batch + KI-Relevanz) |
| **Phase 1.3** | 1 Tag | search_oer_for_card Tool |
| **Phase 1.4** | 1 Tag | Tests + Dokumentation |
| **Gesamt Phase 1** | **5-7 Tage** | Tool-Integration |
| **Phase 2** | 3-5 Tage | MCP Server (optional) |

---

## XI. Offene Fragen

1. **API-Authentifizierung:** Braucht der oer-finder-api-client Auth-Token?
2. **Rate-Limiting:** Wie viele Anfragen pro Minute sind erlaubt?
3. **Caching:** Sollen Suchergebnisse gecached werden? (localStorage, SessionStorage)
4. **Openverse-Integration:** Soll auch Openverse durchsucht werden können?
5. **MCP Server:** Wird externe Integration benötigt, oder reicht die Tool-Integration?

---

## XII. Referenzen

- [TOOL-BASED-AI.md](./TOOL-BASED-AI.md) - Bestehende Tool-Architektur
- [PASTE-SYSTEM.md](./PASTE-SYSTEM.md) - Nostr naddr Handling (wiederverwendbar)
- [@edufeed-org/oer-finder-plugin](https://github.com/edufeed-org/oer-finder-plugin) - Plugin Repository
- [@edufeed-org/oer-finder-api-client](https://github.com/edufeed-org/oer-finder-api-client) - API Client

---

**Status:** 🟡 PROPOSAL  
**Autor:** AI Assistant  
**Review erforderlich:** ✅ Ja  
**Nächster Schritt:** Review + Freigabe für Phase 1 Implementation
