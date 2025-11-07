# ⚡ Aktionsplan: Publishing-Flow Fix (AKTUALISIERT)

**Priorität:** � **MITTEL** für Phase 1.1 (nicht KRITISCH!)  
**Zeitschätzung:** 45 Min (reduziert von 2-3 Stunden!)  
**Schwierigkeit:** � **EINFACH**

---

## ✅ WICHTIG: Analyse-Korrektur

Die ursprüngliche Analyse war **FALSCH** in mehreren Punkten:

### Was FUNKTIONIERT (ursprünglich als BROKEN gemeldet):

1. ✅ **Signer wird automatisch synchronisiert** 
   - authStore.svelte.ts, Line 63-68 (NIP-07)
   - authStore.svelte.ts, Line 108-113 (nsec)
   - authStore.svelte.ts, Line 155+ (OIDC)
   - **KEIN FIX NÖTIG!**

2. ✅ **Events werden nach Login publiziert**
   - Queue wird automatisch processed nach Login
   - updateSigner() triggert syncQueue()
   - **KEIN FIX NÖTIG!**

3. ✅ **NDK nutzt Relays**
   - +layout.svelte, Line 15-21: explicitRelayUrls sind gesetzt
   - **Aber: hardcoded statt aus settingsStore!**

---

## Quick Fix #1: ~~Signer automatisch synchronisieren~~ ✅ BEREITS IMPLEMENTIERT

~~### Problem~~
~~SyncManager wird mit `signer: undefined` initialisiert, daher landen **ALLE** Events in der Queue und werden NICHT publiziert.~~

**STATUS:** ✅ **FUNKTIONIERT BEREITS KORREKT**

Der Signer wird automatisch bei **jedem Login** synchronisiert:
- NIP-07 Login
- nsec Login  
- OIDC Login
- Dummy Login

**KEIN FIX NÖTIG!**

---

## Quick Fix #2: Relays aus settingsStore zu NDK (30 Min)

### Problem
NDK nutzt hardcoded Relays statt aus settingsStore.

### Lösung

**Datei:** `src/routes/+layout.svelte`

```typescript
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore';
  import NDK from '@nostr-dev-kit/ndk';
  
  // 🔴 ÄNDERN:
  // const ndk = new NDK({
  //   explicitRelayUrls: [
  //     "wss://relay-rpi.edufeed.org/",  // ← HARDCODED!
  //     "wss://relay.damus.io/",
  //   ],
  //   enableOutboxModel: false
  // });
  
  // NEU (RICHTIG):
  const ndk = new NDKSvelte({
    explicitRelayUrls: settingsStore.settings.relaysPublic,  // ← DYNAMIC!
    enableOutboxModel: false
  });
</script>
```

### Test
```typescript
// Browser Console:
const ndk = window.__ndk;  // Wenn NDK als global exportiert
console.log('Relay URLs:', ndk.pool.relays.keys());

// Sollte zeigen:
// ['wss://relay-rpi.edufeed.org', 'wss://relay.primal.net', 'wss://nos.lol']

// Test mit config.json Änderung:
// 1. Ändere config.json relaysPublic
// 2. Reload Page
// 3. console.log sollte neue Relays zeigen
```

---

## Quick Fix #3: publishToNostr() Stub entfernen (15 Min)

### Problem
`publishToNostr()` macht nichts außer console.log.

### Lösung: Stub komplett entfernen

**Datei:** `kanbanStore.svelte.ts`, Linie 1394

```typescript
// ❌ ENTFERNEN:
private publishToNostr(): void {
    console.log('Publishing board state to Nostr...', this.board.getContextData(true));
    this.saveToStorage();
}

// Und in triggerUpdate():
private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveToStorage();
    // this.publishToNostr();  ← ENTFERNEN
}
```

Publishing läuft bereits über die async Methods (publishCardAsync, etc.)

---

### Problem
NDK weiß nicht, welche Relays es nutzen soll.

### Lösung

**Datei:** `src/routes/+layout.svelte`

```typescript
<script lang="ts">
    import { settingsStore } from '$lib/stores/settingsStore';
    import NDK from '@nostr-dev-kit/ndk';
    
    // ... onMount oder oben:
    
    // 🔴 HINZUFÜGEN:
    const relays = settingsStore.settings.relaysPublic;
    
    const ndk = new NDK({
        explicitRelayUrls: relays,  // ← USE CONFIGURED RELAYS!
        cacheAdapter: new NDKCacheAdapter(),
    });
</script>
```

### Test
```typescript
// Browser Console:
const ndk = window.__ndk;  // Wenn NDK als global exportiert
console.log('Relay URLs:', ndk.pool.relays.keys());

// Sollte zeigen:
// ['wss://relay-rpi.edufeed.org', 'wss://relay.primal.net', 'wss://nos.lol']
```

---

## Quick Fix #3: publishToNostr() Stub entfernen (15 Min)

### Problem
`publishToNostr()` macht nichts außer console.log.

### Lösung A: Stub komplett entfernen

**Datei:** `kanbanStore.svelte.ts`, Linie 1394

```typescript
// ❌ ENTFERNEN:
private publishToNostr(): void {
    console.log('Publishing board state to Nostr...', this.board.getContextData(true));
    this.saveToStorage();
}

// Und in triggerUpdate():
private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveToStorage();
    // this.publishToNostr();  ← ENTFERNEN
}
```

Dann `publishCardAsync()` überall direkt awaiten:

```typescript
// In addCard():
await this.publishCardAsync(card.id);  // ← AWAIT hinzufügen
```

---

## Verifikations-Checklist (AKTUALISIERT)

Nach den Fixes durchführen:

```bash
# 1. Build & Start
pnpm run build
pnpm run dev

# 2. ✅ Test Publishing mit Login (FUNKTIONIERT BEREITS!)
  [x] Mit NIP-07 einloggen
  [x] Karte erstellen
  [x] console.log sollte zeigen: "✅ Event published to X relay(s)"
  [x] localStorage['nostr-event-queue'] sollte LEER sein (oder wenige items)

# 3. Test Relay URLs (NACH FIX #2)
  [ ] In Console: settingsStore.settings.relaysPublic
  [ ] Sollte 3 Relays anzeigen
  [ ] Relays ändern in config.json
  [ ] Page reload
  [ ] console.log in NDK sollte neue Relays zeigen

# 4. Test Offline Queueing (FUNKTIONIERT BEREITS!)
  [x] DevTools → Network → Offline mode
  [x] Karte erstellen
  [x] localStorage['nostr-event-queue'] sollte Event enthalten
  [x] Network → Online mode
  [x] Event sollte automatisch publiziert werden

# 5. Stub-Entfernung (NACH FIX #3)
  [ ] publishToNostr() existiert nicht mehr
  [ ] triggerUpdate() ruft NICHT mehr publishToNostr() auf
  [ ] Async publishing funktioniert weiterhin
```

---

## Dateien zum Ändern (AKTUALISIERT)

| Datei | Zeilen | Change | Priorität | Status |
|-------|--------|--------|-----------|--------|
| **+layout.svelte** | 15-21 | NDK mit settingsStore.relaysPublic | � MEDIUM | TODO |
| **kanbanStore.svelte.ts** | 1394, 1432, 1473 | publishToNostr() entfernen | 🟢 LOW | TODO |
| ~~**authStore.svelte.ts**~~ | ~~63, 108, 155, 184, 257, 284~~ | ~~updateSigner() Fix~~ | ~~� HIGH~~ | ✅ BEREITS IMPLEMENTIERT |

---

## Phase 1.1 Completion Status (AKTUALISIERT)

Nach diesen Fixes:

- ✅ Events werden publiziert (bereits funktionsfähig!)
- ⚠️ Relays aus settingsStore werden verwendet (nach Fix #2)
- ✅ Offline/Online-Flow funktioniert vollständig (bereits!)
- ✅ Queue-Retry-Logik ist aktiv (bereits!)
- ⚠️ publishToNostr() Stub entfernt (nach Fix #3)

**Dann ist Phase 1.1 (Nostr Event Publishing) ✅ COMPLETE!**

---

**Geschätzter Aufwand:** ⬇️ **45 Minuten** (reduziert von 2-3 Stunden!)  
**Impact:** � **MEDIUM** - Nur noch kosmetische Verbesserungen, System funktioniert bereits!
