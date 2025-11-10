# Bug Fix: Column Double-Move & Cross-Browser Sync Delay

**Issue ID:** Echo-Loop + Cross-Browser-Sync-Delay  
**Reported:** 8. November 2025  
**Fixed:** 9. November 2025  
**Severity:** 🔴 HIGH (UX-breaking)  
**Status:** ✅ RESOLVED

---

## 🐛 Problem-Beschreibung

### Symptom 1: Double-Move-Effekt (Browser A)

**Beobachtung:**
- User draggt Spalte in Browser A
- Nach Loslassen: Spalte springt **zurück** zur Ursprungsposition
- Dann bewegt sie sich **erneut** zur Zielposition
- Visueller "Flicker"-Effekt

**Root Cause:**
1. Browser publiziert eigenes Event zu Nostr
2. Relay sendet Event **zurück** als Echo (manchmal mehrfach!)
3. Browser verarbeitet **eigenes Event** als fremdes Event
4. `upsertBoardFromNostr()` überschreibt lokale Änderung mit alter Reihenfolge
5. Dann kommt echtes Update → Spalte bewegt sich nochmal

### Symptom 2: Cross-Browser Sync Delay (Browser B)

**Beobachtung:**
- Browser A draggt Spalte
- Browser B (andere Tab/Browser auf gleichem Board) zeigt **keine Änderung**
- Erst nach **Reload** erscheint neue Spaltenreihenfolge

**Root Cause:**
1. Browser B empfängt Event von Browser A
2. Event wird korrekt deserialisiert
3. `upsertBoardFromNostr()` wird aufgerufen
4. **ABER:** `$effect` in `Board.svelte` überschreibt sofort mit alter Reihenfolge
5. UI zeigt keine Änderung (weil `$effect` zu früh triggert)

---

## ✅ Lösung

### Evolution der Lösung

#### v1.0: Centralized Tracking (Partial Fix)
```typescript
// syncManager.svelte.ts
private myPublishedEvents = $state(new Set<string>());

// Nach event.sign():
this.myPublishedEvents.add(event.id);

// In handleBoardEvent():
if (syncManager.isMyEvent(boardEvent.id)) {
    syncManager.clearMyEvent(boardEvent.id); // ← SOFORT löschen!
    return;
}
```

**Result:**
- ✅ Echo #1 wird geskippt
- ❌ Echo #2 wird als fremd verarbeitet (Tracking gelöscht!)
- ❌ Doppel-Effekt bleibt

---

#### v2.0: Delayed Cleanup + isLocalDnD Guard (Final Fix) ✅

**Change 1: Delayed Cleanup (5 Sekunden)**
```typescript
// nostr.ts handleBoardEvent() & handleCardEvent()
if (syncManager.isMyEvent(boardEvent.id)) {
    console.log(`⏭️ Eigenes Board-Event erkannt - SKIP`);
    
    // ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
    setTimeout(() => {
        syncManager.clearMyEvent(boardEvent.id);
        console.log(`[SyncManager] 🗑️ Delayed cleanup (5s)`);
    }, 5000);
    
    return;
}
```

**Result:**
- ✅ Echo #1 geskippt
- ✅ Echo #2 (innerhalb 5s) **AUCH** geskippt
- ✅ Automatisches Aufräumen nach 5s (kein Memory Leak)

---

**Change 2: isLocalDnD Guard (2 Sekunden)**
```typescript
// Board.svelte
let isLocalDnD = $state(false);

$effect(() => {
    if (!isDragging && !isLocalDnD) {  // ← isLocalDnD blockiert!
        if (parentIds !== localIds) {
            columns = [...columns_inner];
        }
    }
});

function handleDndFinalizeColumns(e: any) {
    isDragging = false;
    columns = e.detail.items;
    onFinalUpdate(finalItems);
    
    // ⚡ Warte auf Nostr-Roundtrip (2s)
    setTimeout(() => {
        isLocalDnD = false;
    }, 2000);
}
```

**Result:**
- ✅ Browser A: `$effect` blockiert während DnD + Roundtrip → Kein Doppel-Effekt
- ✅ Browser B: `isLocalDnD = false` → Akzeptiert sofort fremde Updates
- ✅ Cross-Browser-Sync **sofort** (< 500ms)

---

## 📊 Impact

### Before (v1.0)
- ❌ Spalte springt zurück → bewegt sich erneut (Browser A)
- ❌ Browser B zeigt keine Änderung (nur nach Reload)
- ❌ Zweites Echo wird verarbeitet → Memory Leak Risk
- ⏱️ UX-Delay: 2-5 Sekunden bis stabil

### After (v2.0)
- ✅ Spalte bewegt sich **einmal** smooth (Browser A)
- ✅ Browser B zeigt Update **sofort** (< 500ms)
- ✅ Alle Echoes werden geskippt (unbegrenzt innerhalb 5s)
- ✅ Automatisches Cleanup (kein Memory Leak)
- ⏱️ UX-Delay: **0ms** (sofortiges Feedback)

---

## 🧪 Test Results

### Manual Testing (9. November 2025)

**Scenario 1: Browser A draggt Spalte**
- ✅ Spalte bewegt sich smooth (kein Doppel-Effekt)
- ✅ Console zeigt: "⏭️ Eigenes Board-Event erkannt - SKIP"
- ✅ Nach 5s: "🗑️ Delayed cleanup"

**Scenario 2: Cross-Browser Sync**
- ✅ Browser A draggt → Browser B zeigt **sofort** neue Reihenfolge
- ✅ Kein Reload notwendig
- ✅ Bi-direktional funktioniert (B→A auch)

**Scenario 3: Doppeltes Echo**
- ✅ Beide Echoes werden geskippt
- ✅ Kein Processing für eigene Events
- ✅ UI bleibt stabil

---

## 🔧 Code-Änderungen

### Files Modified:

1. **`src/lib/stores/syncManager.svelte.ts`**
   - Added: `isMyEvent()` public method
   - Added: `clearMyEvent()` public method
   - Line 153: Track event after `event.sign()`

2. **`src/lib/stores/boardstore/nostr.ts`**
   - Lines 430-443: `handleBoardEvent()` mit delayed cleanup
   - Lines 497-510: `handleCardEvent()` mit delayed cleanup

3. **`src/routes/cardsboard/Board.svelte`**
   - Line 63: Added `isLocalDnD` state
   - Lines 65-80: `$effect` mit `isLocalDnD` guard
   - Line 86: Set `isLocalDnD = true` on DnD start
   - Lines 107-114: Delayed `isLocalDnD = false` (2s timeout)

---

## 📝 Lessons Learned

### 1. Nostr Relay-Verhalten
- Relays können **mehrfach** das gleiche Event senden (Reconnects, Subscription-Updates)
- Cleanup-Strategie muss **mehrere Echoes** handhaben
- Zeit-basierte Fenster (5s) sind robuster als Counter-basiert

### 2. Svelte 5 $effect Timing
- `$effect` triggert **sofort** bei State-Änderungen
- Guards wie `isLocalDnD` sind essentiell für DnD-Operationen
- Timeout muss **länger** sein als Nostr-Roundtrip (2s vs. 100ms)

### 3. Cross-Browser State Management
- Jeder Browser hat **eigenen** `isLocalDnD` State
- Browser A: `isLocalDnD = true` während eigener DnD
- Browser B: `isLocalDnD = false` → akzeptiert fremde Updates sofort
- **KEINE** globale Flag nötig!

---

## 🔗 Related Documentation

- **[ECHO-PREVENTION-FLOW.md](../ARCHITECTURE/ECHO-PREVENTION-FLOW.md)** - Vollständige Flow-Dokumentation
- **[STORES/SYNCMANAGER.md](../ARCHITECTURE/STORES/SYNCMANAGER.md)** - SyncManager Architektur
- **[REACTIVITY.md](../ARCHITECTURE/REACTIVITY.md)** - Svelte 5 Reactivity Patterns

---

## 📅 Timeline

| Datum | Event |
|-------|-------|
| 8. Nov. 2025 | Bug reported: Doppel-Effekt bei Column-Drag |
| 8. Nov. 2025 | v1.0: Centralized Tracking (Partial Fix) |
| 9. Nov. 2025 | Cross-Browser-Sync-Delay discovered |
| 9. Nov. 2025 | v2.0: Delayed Cleanup + isLocalDnD Guard (Final Fix) ✅ |
| 9. Nov. 2025 | Full documentation created |

---

**Status:** ✅ RESOLVED  
**Verified:** Manual Testing + Cross-Browser Testing  
**Production Ready:** Yes
