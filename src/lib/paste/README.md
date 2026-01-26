# Paste System

Erweiterbares System zum intelligenten Verarbeiten von Zwischenablage-Inhalten.

## Quick Start

```typescript
// In Card.svelte
async function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const result = await boardStore.handleCardPaste(card.id, event.clipboardData);
    if (result.success) {
        toast.success(`${result.type} eingefügt`);
    }
}

<div onpaste={handlePaste} tabindex="0">
    <!-- Card Content -->
</div>
```

## Unterstützte Content-Typen

✅ **YouTube URLs** → Embed Player  
✅ **Bild-URLs** → Card Image  
✅ **Screenshots** → Data URL → Card Image  
✅ **Nostr Events (naddr)** → AMB Learning Resource Card  
✅ **HTML** → Markdown Konvertierung  
✅ **Plain Text** → Direkt einfügen  

## Dateien

- `types.ts` — Interfaces & Types
- `PasteHandler.ts` — Main Orchestrator
- `handlers/` — Handler-Implementierungen
  - `UrlPasteHandler.ts`
  - `ImagePasteHandler.ts`
  - `TextPasteHandler.ts`
    - `NostrEventHandler.ts` (NDK Fetch + AMB Konvertierung)

## Dokumentation

Siehe: [`/docs/FEATURE/PASTE-SYSTEM.md`](../../../docs/FEATURE/PASTE-SYSTEM.md)

## Beispiele

- `Card.paste-example.txt` — Integration in Card.svelte
- `Column.paste-example.txt` — Integration in Column.svelte
- `components/paste/PasteContainer.svelte` — Wrapper-Komponente

## Eigene Handler hinzufügen

```typescript
import type { IPasteHandler, PasteContext, PasteResult } from '../types.js';

export class MyHandler implements IPasteHandler {
    readonly name = 'My Handler';
    readonly priority = 5;
    
    async canHandle(clipboardData) {
        // Erkennungslogik
        return false;
    }
    
    async handle(clipboardData, context) {
        // Verarbeitungslogik
        return { success: true, type: 'custom', cardUpdates: { ... } };
    }
}
```

Dann registrieren in `PasteHandler.ts`:
```typescript
this.registerHandler(new MyHandler());
```
