# Paste System Documentation

**Status:** ✅ Implementiert  
**Letzte Aktualisierung:** 26. Januar 2026 (NostrEventHandler mit njump + Original-Link)  
**Phase:** Feature Enhancement  
**Autor:** AI Assistant + User Request

---

## 📋 Übersicht

Das **Paste System** ermöglicht es Benutzern, Inhalte aus der Zwischenablage intelligent in Cards oder Columns einzufügen. Das System erkennt automatisch den Inhaltstyp und verarbeitet ihn entsprechend.

### Unterstützte Content-Typen

| Typ | Erkennung | Aktion |
|-----|-----------|--------|
| **YouTube URL** | `youtube.com/watch?v=...` | Embed Player in Card einfügen |
| **Bild-URL** | `.jpg`, `.png`, `.webp`, etc. | Als Card-Image setzen |
| **Binäres Bild** | Screenshot, kopiertes Bild | Blob → Data URL → Card-Image |
| **Nostr Event** | `naddr1...` (auch in URLs) | AMB Learning Resource → Card mit njump-Links |
| **HTML** | Rich Text aus Browser | HTML → Markdown konvertieren |
| **Plain Text** | Beliebiger Text | Direkt als Content einfügen |

---

## 🏗️ Architektur

### Verzeichnisstruktur

```
src/lib/paste/
├── types.ts                    # Interfaces & Types
├── PasteHandler.ts             # Main Orchestrator
└── handlers/                   # Handler-Implementierungen
    ├── UrlPasteHandler.ts      # URLs (YouTube, Bilder, etc.)
    ├── ImagePasteHandler.ts    # Binäre Bilder (Screenshots)
    ├── TextPasteHandler.ts     # Text & HTML
    └── NostrEventHandler.ts    # Nostr Events
```

### Handler-Prioritäten

Handler werden nach **Priorität** sortiert (höchste zuerst):

| Priorität | Handler | Erkennt |
|-----------|---------|---------|
| 20 | **ImagePasteHandler** | Binäre Bilder (Screenshots, kopierte Bilder) |
| 15 | **NostrEventHandler** | `naddr1...`, `nevent1...`, `note1...` (auch in URLs) |
| 10 | **UrlPasteHandler** | YouTube, Bild-URLs, andere Web-Links |
| 0 | **TextPasteHandler** | HTML → Markdown, Plain Text (**Fallback**) |

**Warum Prioritäten?**
- Screenshot (binär) soll nicht als URL-Text verarbeitet werden
- `naddr1...` soll von NostrEventHandler verarbeitet werden, nicht als Text
- Fallback garantiert: TextPasteHandler fängt alles auf

---

## 🔌 Integration

### 1. In bestehenden Komponenten (Card.svelte)

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';
    
    let { card } = $props();
    
    async function handlePaste(event: ClipboardEvent) {
        event.preventDefault();
        
        const result = await boardStore.handleCardPaste(card.id, event.clipboardData);
        
        if (result.success) {
            toast.success(`${result.type} eingefügt`);
        } else {
            toast.error(result.error);
        }
    }
</script>

<div onpaste={handlePaste}>
    <!-- Card Content -->
</div>
```

### 2. In Column.svelte (neue Card erstellen)

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    
    let { column } = $props();
    
    async function handlePaste(event: ClipboardEvent) {
        event.preventDefault();
        
        const result = await boardStore.handleColumnPaste(column.id, event.clipboardData);
        
        if (result.success && 'cardId' in result) {
            console.log('Neue Card erstellt:', result.cardId);
        }
    }
</script>

<div onpaste={handlePaste}>
    <!-- Column Content -->
</div>
```

### 3. Board-weites Paste (Strg+V)

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';

    async function handleGlobalPaste(event: ClipboardEvent) {
        if (event.target instanceof HTMLElement) {
            const tag = event.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) return;
        }

        event.preventDefault();
        const result = await boardStore.handleColumnPaste(firstColumnId, event.clipboardData);
        if (!result.success) toast.error(result.error);
    }
    window.addEventListener('paste', handleGlobalPaste);
</script>
```

### 3. BoardStore API

```typescript
// Update existierende Card
const result = await boardStore.handleCardPaste(cardId, clipboardData);

// Neue Card in Column erstellen
const result = await boardStore.handleColumnPaste(columnId, clipboardData);
```

---

## 🎯 Handler-Details

### UrlPasteHandler

**Erkennungslogik:**
```typescript
// YouTube
/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/

// Bilder
/\.(jpg|jpeg|png|gif|webp|svg)$/i

// Nostr (delegiert an NostrEventHandler)
/^(nostr:|)(nevent|note|npub|nprofile|naddr)[a-z0-9]+$/i
```

**YouTube-Verarbeitung:**
```typescript
// Input: https://youtube.com/watch?v=dQw4w9WgXcQ
// Output (Card-Update):
{
  content: `## YouTube Video\n\n[Video](url)\n\n<iframe ...></iframe>`,
  labels: ['video', 'youtube']
}
```

**Bild-URL-Verarbeitung:**
```typescript
// Input: https://example.com/image.jpg
// Output:
{
  image: 'https://example.com/image.jpg',
  content: `![Bild](https://example.com/image.jpg)`
}
```

---

### ImagePasteHandler

**Erkennungslogic:**
```typescript
// Prüft ob clipboard.items einen MIME-Type hat der mit 'image/' beginnt
items[i].type.startsWith('image/')
```

**Verarbeitung:**
1. Extrahiere Blob aus `clipboardData.items`
2. Konvertiere Blob zu Data URL via FileReader
3. Setze als Card-Image

**Output:**
```typescript
{
  heading: 'Screenshot 25.10.2025, 14:30',
  image: 'data:image/png;base64,iVBORw0KG...',
  labels: ['screenshot', 'image']
}
```

**⚠️ WICHTIG:** Data URLs können sehr groß werden (mehrere MB). Für Production sollte man einen Upload-Service integrieren!

---

### TextPasteHandler

**HTML → Markdown Konvertierung:**

| HTML | Markdown |
|------|----------|
| `<strong>bold</strong>` | `**bold**` |
| `<em>italic</em>` | `*italic*` |
| `<a href="...">text</a>` | `[text](url)` |
| `<h1>Heading</h1>` | `# Heading` |
| `<ul><li>Item</li></ul>` | `- Item` |
| `<code>code</code>` | `` `code` `` |
| `<pre>block</pre>` | ` ```block``` ` |

**Fallback:**
- Wenn HTML vorhanden → Konvertiere zu Markdown
- Sonst → Nutze Plain Text

**Smart Heading Extraction:**
```typescript
// Wenn erste Zeile < 60 Zeichen → Nutze als Heading
"Diese ist mein Titel\nUnd hier ist der Content"
↓
{
  heading: "Diese ist mein Titel",
  content: "Und hier ist der Content"
}
```

---

### NostrEventHandler

**Status:** ✅ Vollständig implementiert (26. Januar 2026)

**Erkennungslogik:**
```typescript
// Findet naddr/nevent/note/npub/nprofile in URLs, nostr: URIs oder direkt
/(n(?:event|ote|pub|profile|addr)1[a-z0-9]+)/i

// Beispiele:
// - naddr1qvzqqqr4hcpzq49rgqrjenrz25tv34...
// - https://edufeed.org/naddr1qvzqqqr4hcpzq49rgqrjenrz25tv34...
// - nostr:naddr1qvzqqqr4hcpzq49rgqrjenrz25tv34...
```

#### Workflow für naddr (AMB Learning Resource)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. ERKENNUNG                                                    │
│     Paste: "https://edufeed.org/naddr1qvzqqqr4hcpzq49..."       │
│           ↓                                                      │
│     Regex extrahiert: "naddr1qvzqqqr4hcpzq49..."                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. NIP-19 DECODE                                                │
│     nip19.decode(identifier) → {                                │
│       type: 'naddr',                                            │
│       data: {                                                   │
│         kind: 30142,                                            │
│         pubkey: '0a29e...',                                     │
│         identifier: 'shoah-stories',                            │
│         relays: ['wss://relay.edufeed.org']                     │
│       }                                                         │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. RELAY CONNECTION                                             │
│     - Relay-Hints aus naddr werden zu NDK hinzugefügt           │
│     - Warten auf Verbindung (connect Event oder 3s Timeout)     │
│     - Filter: { kinds: [30142], authors: [...], '#d': [...] }   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. EVENT FETCH                                                  │
│     ndk.fetchEvent(filter) → NostrEvent {                       │
│       kind: 30142,                                              │
│       tags: [                                                   │
│         ['d', 'shoah-stories'],                                 │
│         ['name', 'Shoah Stories'],                              │
│         ['description', 'Digitales Erinnerungs...'],            │
│         ['learningResourceType:id', 'https://w3id.org/...'],    │
│         ['about:id', 'http://w3id.org/kim/...'],                │
│         ['creator:name', 'Gedenkstätte...'],                    │
│         ['license:id', 'https://creativecommons.org/...'],      │
│         ['image', 'https://shoahstories.video/poster.jpg']      │
│       ]                                                         │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. AMB KONVERTIERUNG                                            │
│     A) Primär: nostrToAmb(event) aus @edufeed-org/amb-converter │
│        → AmbLearningResource { name, description, type, ... }   │
│                                                                  │
│     B) Fallback: extractResourceFromTags(event)                 │
│        Falls nostrToAmb fehlschlägt (z.B. fehlendes 'type' Tag) │
│        → Manuelle Extraktion aus Event-Tags                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. CARD ERSTELLEN                                               │
│     {                                                           │
│       heading: 'Shoah Stories',                                 │
│       content: '## Beschreibung\nDigitales Erinnerungs...\n\n   │
│                 ### Metadaten\n- Autor: Gedenkstätte...\n...',  │
│       image: 'https://shoahstories.video/poster.jpg',           │
│       labels: ['nostr', 'amb', 'videoobject', 'geschichte'],    │
│       links: [                                                  │
│         { title: 'Lernressource', url: 'https://shoah...' },    │
│         { title: 'Nostr Event (njump)', url: 'https://njump..'}, │
│         { title: 'Ursprünglicher Link', url: 'https://edu...' } │
│       ]                                                         │
│     }                                                           │
└─────────────────────────────────────────────────────────────────┘
```

#### Konfiguration (config.json)

Die njump-URL ist konfigurierbar in `static/config.json`:

```json
{
  "nostr": {
    "relaysPublic": ["wss://relay.edufeed.org", ...],
    "njumpUrl": "https://njump.edufeed.org"
  }
}
```

**Zugriff im Code:**
```typescript
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

const njumpUrl = settingsStore.settings.njumpUrl || 'https://njump.edufeed.org';
const webUrl = `${njumpUrl}/${identifier}`;
```

#### Links in der Card

| # | Link | Beschreibung |
|---|------|--------------|
| 1 | **Lernressource** | Direkte URL zur Ressource (falls vorhanden) |
| 2 | **Nostr Event (njump)** | Web-Viewer für das Nostr Event |
| 3 | **Ursprünglicher Link** | Die ursprünglich gepastete URL (falls HTTP/HTTPS) |

#### Fallback: Tag-Extraktion

Wenn `nostrToAmb()` fehlschlägt (z.B. fehlendes `type` Tag), wird direkt aus Event-Tags extrahiert:

```typescript
private extractResourceFromTags(event: NostrEvent): AmbLearningResource {
    const tags = event.tags || [];
    const getTag = (name: string) => tags.find(t => t[0] === name)?.[1];
    
    return {
        '@context': 'https://w3id.org/amb/context.jsonld',
        id: getTag('id') || getTag('url'),
        type: ['LearningResource'],
        name: getTag('name'),
        description: getTag('description'),
        image: getTag('image'),
        creator: [{ name: getTag('creator:name') }],
        learningResourceType: [{ prefLabel: { de: getTag('learningResourceType:prefLabel:de') } }],
        about: [{ prefLabel: { de: getTag('about:prefLabel:de') } }],
        // ... weitere Felder
    };
}
```

#### Unterstützte Event-Tags

| Tag | Beispiel | Mapping |
|-----|----------|---------|
| `name` | `Shoah Stories` | → `resource.name` |
| `description` | `Digitales Erinnerungs...` | → `resource.description` |
| `image` | `https://...poster.jpg` | → `resource.image` |
| `id` / `url` | `https://shoahstories.video` | → `resource.id` |
| `creator:name` | `Gedenkstätte Bergen-Belsen` | → `resource.creator[0].name` |
| `learningResourceType:id` | `https://w3id.org/...` | → `resource.learningResourceType[0]` |
| `learningResourceType:prefLabel:de` | `Video` | → Label in UI |
| `about:id` | `http://w3id.org/kim/...` | → `resource.about[0]` |
| `about:prefLabel:de` | `Geschichte` | → Label in UI |
| `license:id` | `https://creativecommons...` | → `resource.license` |
| `inLanguage` | `de` | → `resource.inLanguage` |
| `keywords` | `Holocaust, Erinnerung` | → `resource.keywords` |

#### Beispiel-Output

**Input:** `https://edufeed.org/naddr1qvzqqqr4hcpzq49rgqrjenrz25tv34tjkcu2s2x9hptsw3g3xqhmgwf0ym35uxgnqydhwumn8ghj7ctdvgkhyetvv9ujuetyw4nx2ety9ehhyecqp4eksmmpdqkhxar0wf5k2uc870c9e`

**Output Card:**
```typescript
{
    heading: 'Shoah Stories',
    content: `Digitales Erinnerungsprojekt mit Überlebenden-Geschichten...

### Metadaten
- Autor: Gedenkstätte Bergen-Belsen
- Typ: VideoObject
- Lernressourcentyp: Video
- Sprache: de
- Themen: Geschichte, Holocaust
- Lizenz: https://creativecommons.org/licenses/by/4.0/
- Kostenfrei: Ja
- Quelle: [https://shoahstories.video/](https://shoahstories.video/)`,
    image: 'https://shoahstories.video/poster.jpg',
    labels: ['nostr', 'amb', 'videoobject', 'video', 'geschichte'],
    links: [
        { url: 'https://shoahstories.video/', title: 'Shoah Stories' },
        { url: 'https://njump.edufeed.org/naddr1...', title: 'Nostr Event (njump)' },
        { url: 'https://edufeed.org/naddr1...', title: 'Ursprünglicher Link' }
    ]
}
```

---

## 🧪 Testing

### Manueller Test

1. **YouTube URL:**
   ```
   Kopiere: https://youtube.com/watch?v=dQw4w9WgXcQ
   Paste in Card → Sollte Embed-Player zeigen
   ```

2. **Screenshot:**
   ```
   Drücke Druck-Taste (Screenshot)
   Paste in Column → Sollte neue Card mit Bild erstellen
   ```

3. **Text mit Formatierung:**
   ```
   Kopiere formatierten Text aus Dokument
   Paste in Card → Sollte Markdown zeigen
   ```

4. **Nostr Event (naddr):**
    ```
    Kopiere: https://edufeed.org/naddr1...
    Paste in Card → Sollte AMB-Metadaten anzeigen
    ```

### Unit Tests (TODO)

```typescript
// tests/paste/handlers.test.ts
import { UrlPasteHandler } from '$lib/paste/handlers/UrlPasteHandler';

describe('UrlPasteHandler', () => {
  it('sollte YouTube URLs erkennen', async () => {
    const handler = new UrlPasteHandler();
    const clipboardData = createMockClipboard('https://youtube.com/watch?v=test');
    
    const canHandle = await handler.canHandle(clipboardData);
    expect(canHandle).toBe(true);
  });
});
```

---

## 🔧 Erweiterbarkeit

### Eigenen Handler hinzufügen

1. **Erstelle neue Datei:** `src/lib/paste/handlers/MyHandler.ts`

```typescript
import type { IPasteHandler, PasteContext, PasteResult } from '../types.js';

export class MyHandler implements IPasteHandler {
    readonly name = 'My Custom Handler';
    readonly priority = 5; // Zwischen URL (10) und Text (0)
    
    async canHandle(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<boolean> {
        // Deine Erkennungslogik
        return false;
    }
    
    async handle(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult> {
        // Deine Verarbeitungslogik
        return { success: true, type: 'custom', cardUpdates: { ... } };
    }
}
```

2. **Registriere Handler:** In `PasteHandler.ts`

```typescript
import { MyHandler } from './handlers/MyHandler.js';

constructor() {
    this.registerHandler(new MyHandler());
    // ...
}
```

### Beispiele für Custom Handler

**PDFHandler:**
```typescript
canHandle(clipboardData) {
    // Prüfe ob PDF-File in clipboard
    return clipboardData.items[0]?.type === 'application/pdf';
}

handle(clipboardData, context) {
    // Extrahiere PDF, upload zu Server, erstelle Card mit Link
    return { 
        success: true, 
        type: 'pdf',
        cardUpdates: { heading: 'PDF Dokument', links: [...] }
    };
}
```

**GitHubIssueHandler:**
```typescript
canHandle(clipboardData) {
    // Prüfe ob GitHub Issue URL
    return /github\.com\/.*\/issues\/\d+/.test(clipboardData.getData('text/plain'));
}

handle(clipboardData, context) {
    // Fetch Issue via API, erstelle Card mit Metadaten
    return {
        success: true,
        type: 'github-issue',
        cardUpdates: { 
            heading: issue.title,
            content: issue.body,
            labels: ['github', 'issue']
        }
    };
}
```

---

## 🚀 Roadmap

### Phase 1: ✅ Basic Implementation
- [x] Handler-Architektur
- [x] URL-Handler (YouTube, Bilder)
- [x] Image-Handler (Screenshots)
- [x] Text-Handler (HTML → Markdown)
- [x] Nostr-Handler (Placeholder)
- [x] BoardStore Integration

### Phase 2: 🔜 Advanced Features
- [ ] NDK Integration für Nostr Events
- [ ] File Upload Service (statt Data URLs)
- [ ] Drag & Drop Support
- [ ] Paste-History (zeige letzte 5 Pastes)
- [ ] Paste-Vorschau (Preview vor Einfügen)

### Phase 3: 🔮 Future
- [ ] OCR für Bilder (Text extrahieren)
- [ ] Audio/Video Upload
- [ ] PDF-Verarbeitung
- [ ] Webhook-Integration (n8n)
- [ ] AI-basierte Content-Analyse

---

## 📊 Performance

### Benchmarks (TODO)

| Handler | Avg. Time | Peak Memory |
|---------|-----------|-------------|
| URL | ~5ms | negligible |
| Image (Screenshot) | ~50ms | +2MB (Data URL) |
| Text | ~10ms | negligible |
| Nostr | ~5ms | negligible |

**Optimierungen:**
- Data URLs sollten in Production durch Upload-Service ersetzt werden
- HTML → Markdown Konvertierung könnte gecached werden
- Lazy Loading von Handlers (nur bei Bedarf laden)

---

## ❓ FAQ

**Q: Warum wird mein Paste nicht erkannt?**
A: Prüfe die Browser-Console. Der Handler sollte loggen welcher Handler verwendet wird.

**Q: Kann ich mehrere Inhalte gleichzeitig pasten?**
A: Aktuell wird nur der erste erkannte Typ verarbeitet. Multi-Content-Paste ist für Phase 2 geplant.

**Q: Funktioniert das auch auf Mobile?**
A: Paste-API ist limitiert auf Mobile. Für Touch-Geräte sollte man File-Upload nutzen.

**Q: Wie groß dürfen Screenshots sein?**
A: Data URLs haben keine technische Grenze, aber localStorage ist limitiert (~5-10MB). Production sollte Upload-Service nutzen.

**Q: Kann ich Handler deaktivieren?**
A: Ja, via `pasteHandler.unregisterHandler('Handler Name')`.

---

## 🔗 Verwandte Dokumentation

- **[COMMENTS.md](./COMMENTS.md)** — Kommentar-System
- **[AI-INTEGRATION.md](./AI-INTEGRATION.md)** — KI-Features
- **[../ARCHITECTURE/STORES.md](../ARCHITECTURE/STORES.md)** — BoardStore Architektur
- **[../GUIDES/QUICK-START.md](../GUIDES/QUICK-START.md)** — Erste Schritte

---

**Stand:** 25. Oktober 2025  
**Version:** 1.0.0  
**Lizenz:** CC-BY-4.0
