# SyncManager: Offline-First Nostr Events

**Datei:** `src/lib/stores/syncManager.svelte.ts`  
**Technologie:** Svelte 5 Runes + TypeScript  
**Pattern:** Manuelles `localStorage` (für die Event-Queue)  
**Version:** 2.0 (Aktualisiert 02. Nov 2025)

---

## 🎯 Übersicht

Der **SyncManager** implementiert eine vollständige Offline-First Architektur für Nostr-Events. Er fängt alle ausgehenden Events ab, signiert sie und stellt sie entweder sofort zu oder reiht sie in eine persistente Warteschlange ein, wenn der Benutzer offline ist.

```mermaid
graph TD
    subgraph BoardStore
        A[1. User-Aktion: createCard()] -- ruft auf --> B{triggerUpdate()};
        B -- löst aus --> C{publishToNostr()};
    end

    subgraph SyncManager
        C -- übergibt Event --> D{publishOrQueue(event)};
        D -- Online? --> E{Sign & Publish};
        D -- Offline? --> F[Queue Event];
    end

    subgraph Browser Storage
        F -- speichert in --> G[localStorage: 'nostr-event-queue'];
    end
    
    subgraph Nostr Network
        E -- sendet an --> H((Relays));
    end

    subgraph "Bei Reconnect"
        I[window.online Event] -- löst aus --> J{syncQueue()};
        J -- liest aus --> G;
        J -- Online? --> E;
    end
```

---

## 📦 Komponenten

### 1. **SyncManager** (`src/lib/stores/syncManager.svelte.ts`)

Die zentrale Klasse für das Event-Queueing und das Nostr-Publishing.

**Key Features:**
- ✅ **Event Queueing** — Persistente Warteschlange in `localStorage`, wenn offline.
- ✅ **Automatisches Signieren** — Events werden vor dem Senden mit dem aktiven Nostr-Signer signiert.
- ✅ **Retry-Logik** — Exponentieller Backoff (z.B. 1s, 2s, 4s) bei fehlgeschlagenen Sendeversuchen.
- ✅ **Online/Offline Detection** — Automatischer Sync bei Wiederverbindung.
- ✅ **Priority System** — Events können als `high`, `normal` oder `low` priorisiert werden.
- ✅ **Typsicherheit** — Vollständige TypeScript-Unterstützung.

**Public API:**

```typescript
// Haupt-Einstiegspunkt
await syncManager.publishOrQueue(event, 'board', 'high');

// Hilfsfunktionen
syncManager.syncQueue();           // Manuellen Sync anstoßen
syncManager.getQueueStats();       // Statistiken für das Debugging
syncManager.updateSigner(signer);  // Signer bei Login/Logout aktualisieren
syncManager.dispose();             // Event-Listener aufräumen

// Reaktiver Status
let status = $derived(syncManager.status);
// { isOnline, isSyncing, queuedEvents, ... }
```

### 2. **nostrEvents Utilities** (`src/lib/utils/nostrEvents.ts`)

Hilfsfunktionen zur Serialisierung zwischen den `BoardModel`-Klassen und den Nostr-Events.

**Funktionen:**

```typescript
// Board Event (Kind 30301)
boardToNostrEvent(board, ndk) → NDKEvent
nostrEventToBoard(event) → BoardProps

// Card Event (Kind 30302)
cardToNostrEvent(card, columnName, rank, boardRef, ndk) → NDKEvent
nostrEventToCard(event) → CardProps

// Comment Event (Kind 1)
createCommentEvent(text, cardRef, cardEventId, ndk) → NDKEvent

// Andere Events
createDeletionEvent(eventId, reason, ndk) → NDKEvent
createSoftLockEvent(cardId, cardEventId, ttl, ndk) → NDKEvent

// Hilfsfunktionen
extractBoardRef(event) → string
validateEventSignature(event) → boolean
```

---

## 🔧 Integration in den BoardStore

### Initialisierung

Der `SyncManager` wird innerhalb des `BoardStore` initialisiert, sobald der `NDK`-Kontext verfügbar ist.

```typescript
// In kanbanStore.svelte.ts
export class BoardStore {
    private syncManager: SyncManager | null = null;

    public initializeNostr(ndk: NDK, signer: NDKSigner | null) {
        this.ndk = ndk;
        this.syncManager = new SyncManager(ndk, signer);
    }
}
```

### Mutations-Flow mit Publishing

```typescript
// In kanbanStore.svelte.ts
public createCard(columnId: string, heading: string): string {
  const card = col.addCard({ heading });
  
  // 1. SYNC: UI und localStorage sofort aktualisieren
  this.triggerUpdate();
  
  // 2. ASYNC: Event an Nostr senden (blockiert die UI nicht)
  this.publishCardToNostr(card.id).catch(err => {
    // Fehlerbehandlung hier nicht nötig, da der SyncManager das Queuing übernimmt
    console.warn(`Publishing für Karte ${card.id} wird später versucht.`);
  });
  
  return card.id;
}

private async publishCardToNostr(cardId: string): Promise<void> {
  if (!this.syncManager) return;

  const { card, column } = this.board.findCardAndColumn(cardId);
  const boardRef = `30301:${this.board.author}:${this.board.id}`;
  const cardEvent = cardToNostrEvent(card, column.name, rank, boardRef, this.ndk);
  
  // Der SyncManager kümmert sich automatisch um das Queuing!
  await this.syncManager.publishOrQueue(cardEvent, 'card', 'normal');
}
```

---

## 📊 Event-Flow Beispiele

### Szenario 1: Online Publishing

```
User bearbeitet Karte
    ↓
triggerUpdate() → localStorage + UI werden synchron aktualisiert
    ↓
publishCardToNostr() wird asynchron aufgerufen
    ↓
SyncManager.publishOrQueue(event, 'card')
    ↓
isOnline? JA
    ↓
event.sign(signer) → Event wird mit dem Nostr-Key des Benutzers signiert
    ↓
event.publish() → Event wird an die Relays gesendet
    ↓
✅ Event an 3 Relays publiziert (kein Queuing nötig)
```

### Szenario 2: Offline-Fallback

```
User bearbeitet Karte (Browser ist OFFLINE)
    ↓
triggerUpdate() → localStorage + UI werden synchron aktualisiert
    ↓
publishCardToNostr() wird asynchron aufgerufen
    ↓
SyncManager.publishOrQueue(event, 'card')
    ↓
isOnline? NEIN
    ↓
queueEvent(event)
    - Serialisiere Event zu JSON-String
    - Speichere in localStorage: 'nostr-event-queue'
    ↓
📥 Event in die Warteschlange gestellt (Versuche: 0)
   Queue-Größe: 1
```

### Szenario 3: Reconnect + Retry

```
Browser wird wieder online (window.online Event)
    ↓
SyncManager erkennt: isOnline = true
    ↓
syncQueue() wird AUTOMATISCH gestartet
    ↓
Für jedes Event in der Queue:
  
  1. Deserialisiere JSON → NDKEvent
  2. event.sign(signer) → Signieren
  3. event.publish() → An Relays senden
  
  ERFOLGREICH? 
  → Aus der Queue entfernen ✅
  
  FEHLER?
  → retries++
  → Falls retries >= 3: Entfernen (Dead-Letter-Queue)
  → Falls retries < 3: Für späteren Versuch behalten
    (Exponentieller Backoff: 1s, 2s, 4s)
    ↓
💾 Queue wird in localStorage persistiert
📊 Status wird aktualisiert
```

---

## 🔐 Event Signing

### Signatur-Flow

```typescript
// Intern im SyncManager.signAndPublish(event)

// 1. Prüfen, ob ein Signer verfügbar ist
if (!this.signer) throw new Error('Kein Signer verfügbar');

// 2. Event mit dem Nostr-Key signieren
await event.sign(this.signer);
// → Erzeugt eine kryptographische Signatur
// → event.sig = '...' (hex string)
// → event.pubkey = '...' (public key)

// 3. Signatur validieren
if (!event.sig) throw new Error('Signieren fehlgeschlagen');

// 4. An Relays publizieren
const relays = await event.publish();
// → Relays validieren die Signatur
// → Nur gültig signierte Events werden akzeptiert   
// 5. Ergebnis zurückgeben
if (relays.size === 0) throw new Error('Kein Relay hat das Event akzeptiert');
```

### Signer-Quellen

Der Signer wird vom `AuthStore` bereitgestellt und an den `SyncManager` übergeben. Die Priorität ist:

1.  **`window.nostr` (NIP-07 Browser Extension)**: Sicherste Option, da private Schlüssel den Browser nie verlassen.
2.  **`NDKPrivateKeySigner(nsec)`**: Nur für die Entwicklung. **NIEMALS in Produktion verwenden!**
3.  **`NDKNip46Signer` (remote)**: Zukünftige Option für mobile Apps.

---

## 💾 Storage Persistence

### localStorage Schema

```javascript
// Key: 'nostr-event-queue'
// Value: JSON-Array von QueuedEvent-Objekten

[
  {
    "event": "{\"kind\":30302,\"content\":\"...\",\"tags\":[...]}",
    "timestamp": 1730445600000,
    "retries": 0,
    "type": "card",
    "priority": "normal"
  },
  {
    "event": "{\"kind\":1,\"content\":\"Kommentar...\",\"tags\":[...]}",
    "timestamp": 1730445605000,
    "retries": 1,
    "type": "comment",
    "priority": "normal"
  }
]
```

**Wichtige Hinweise:**
- ✅ **Event als String:** Das `event`-Feld speichert das serialisierte `NDKEvent` als JSON-String. Dies verhindert Probleme mit zirkulären Referenzen und sorgt für eine robuste Speicherung.
- ✅ **Persistenz:** Die Queue überlebt einen Browser-Neustart.
- ✅ **Größe:** Typischerweise 5-10 KB pro Event.

---

## 🔄 Retry-Logik

### Exponentieller Backoff

Die Verzögerung zwischen den Sendeversuchen erhöht sich exponentiell, um die Relays nicht zu überlasten.

```
Formel: delay = 2^retries × baseDelayMs
```

- **Versuch 1:** Sofort
- **Versuch 2:** nach 1s (2^0 × 1000ms)
- **Versuch 3:** nach 2s (2^1 × 1000ms)
- **Versuch 4:** nach 4s (2^2 × 1000ms)
- **Nach 3 Fehlversuchen:** Event wird aus der Queue entfernt (Dead-Letter-Prinzip).

### Stop-on-First-Error

Der `syncQueue()`-Prozess stoppt beim ersten Fehler, um eine Überlastung der Relays zu verhindern. Der nächste Sync-Versuch erfolgt automatisch nach einer kurzen Pause (z.B. 30 Sekunden) oder bei der nächsten Benutzerinteraktion.

---

## 🌐 Online/Offline Detection

Der `SyncManager` nutzt die Standard-Browser-APIs, um den Netzwerkstatus zu überwachen.

```typescript
// Browser-Events
window.addEventListener('online', () => {
  this.isOnline = true;
  this.syncQueue();  // ← Automatischer Sync bei Wiederverbindung!
});

window.addEventListener('offline', () => {
  this.isOnline = false;
});
```

Zusätzlich wird ein **periodischer Sync** alle 30 Sekunden ausgeführt, solange der Browser online ist und die Queue nicht leer ist.

---

## 📊 Debug Utilities

### Queue-Statistiken

```typescript
const stats = syncManager.getQueueStats();

// Beispiel-Output:
{
  total: 5,
  byType: { board: 1, card: 3, comment: 1 },
  byPriority: { high: 1, normal: 3, low: 1 },
  byRetries: { '0': 3, '1': 2 }
}
```

### UI-Integration (Beispiel für eine Topbar)

```svelte
<script>
    import { syncManager } from '$lib/stores/syncManager.svelte.js';
    let status = $derived(syncManager.status);
</script>

<div class="sync-indicator">
  {#if status.isOnline}
    <span>🌐 Online</span>
  {:else}
    <span class="text-orange-500">📡 Offline</span>
  {/if}
  
  {#if status.isSyncing}
    <span>⏳ Syncing...</span>
  {/if}
  
  {#if status.queuedEvents > 0}
    <span class="text-blue-500">📥 {status.queuedEvents} in Queue</span>
  {/if}
</div>
```

---

## ⚙️ Konfiguration

Die Konfiguration erfolgt über ein Objekt, das an den `SyncManager`-Konstruktor übergeben wird.

```typescript
const config = {
  maxRetries: 3,           // Events nach 3 Versuchen entfernen
  baseDelayMs: 1000,       // 1 Sekunde Basis-Verzögerung für Backoff
  syncIntervalMs: 30000    // Automatischer Sync alle 30 Sekunden
};

const syncManager = new SyncManager(ndk, signer, config);
```

---

## Kritische Regeln für Entwickler

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | **Niemals `event.publish()` direkt aufrufen.** Immer `syncManager.publishOrQueue()` verwenden, um die Offline-Fähigkeit zu gewährleisten. | 🔴 CRITICAL |
| **REGEL 2** | **Signer muss aktuell gehalten werden.** Bei Login/Logout `syncManager.updateSigner()` aufrufen, um sicherzustellen, dass Events korrekt signiert werden. | 🔴 CRITICAL |
| **REGEL 3** | **Events als String speichern.** Beim Hinzufügen zur Queue muss das Event serialisiert werden, um Persistenzprobleme zu vermeiden. | 🟠 HIGH |
| **REGEL 4** | **UI-Feedback geben.** Den reaktiven `status` des SyncManagers nutzen, um dem Benutzer den aktuellen Sync-Status anzuzeigen. | 🟡 MEDIUM |

---

## 📚 Weitere Dokumentation

- [`SYNCMANAGER-INTEGRATION.md`](./SYNCMANAGER-INTEGRATION.md) — Detaillierter Integrations-Guide
- [`nostrEvents.ts`](../../utils/nostrEvents.ts) — Code für die Event-Serialisierung
- [`STORES/README.md`](./README.md) — Übersicht der Store-Architektur
- [`ROADMAP.md`](../../COLLABORATION/ROADMAP.md) — Zeitplan für die Implementierung

---
