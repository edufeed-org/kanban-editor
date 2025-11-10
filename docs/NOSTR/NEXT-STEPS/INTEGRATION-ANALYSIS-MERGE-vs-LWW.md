# 🔗 Integration Analysis: Merge-System vs Nostr Event-Handling (LWW)

**Datum:** 10. November 2025  
**Frage:** Hat das Merge-System bereits die LWW-Regel integriert oder fehlt was?

---

## ✅ Current Status: 95% INTEGRIERT - ABER LÜCKEN VORHANDEN

### Die gute Nachricht:
- ✅ **Merge-System existiert** (mergeEngine.ts, cardEditingFlow.ts, MergeConflictDialog.svelte)
- ✅ **LWW-Regel existiert** (EVENT-HANDLING-AND-SYNC.md dokumentiert)
- ✅ **CardEditingFlow hat Timestamp-Handling** (baseTimestamp wird gespeichert)

### Die schlechte Nachricht:
- ❌ **Merge-System nutzt LWW NICHT** beim Konflikt-Erkennen
- ❌ **detectConflict() prüft keine Timestamps** (nur ob Event neuer ist)
- ❌ **3-way Merge beachtet nicht die LWW-Regel bei Auto-Merge**
- ❌ **Integration zwischen beiden Systemen ist NICHT dokumentiert**

---

## 🎯 Wo fehlt die Integration?

### Problem 1: Conflict Detection ist nicht LWW-aware

**Datei:** `src/lib/utils/cardEditingFlow.ts` (Lines 60-85)

```typescript
async checkForConflictBeforeSave(myDraft: CardContent) {
  const latestEvent = await this.ndk.fetchEvent({
    kinds: [30302 as any],
    '#d': [this.currentSession.cardId],
    limit: 1
  } as any);

  if (!latestEvent) {
    return { hasConflict: false, latestVersion: null };
  }

  const latestVersion = JSON.parse(latestEvent.content) as CardContent;
  
  // ❌ HIER: detectConflict() wird aufgerufen
  // ABER: detectConflict() nimmt KEINE Timestamps!
  const { conflict } = await detectConflict(
    this.currentSession,
    latestEvent
  );
  
  return { hasConflict: conflict, latestVersion };
}
```

**Das Problem:**
```
detectConflict(session, latestEvent)
  └─ Signatur: (EditingSession, NDKEvent) => { conflict: boolean }
     
❌ FEHLT:
  - Timestamp-Vergleich (LWW)
  - baseTimestamp vs latestEvent.created_at
  - Logik: "wenn latestEvent älter ist als mein Base, kein Konflikt!"
```

---

### Problem 2: mergeEngine.ts hat keine LWW-Logik

**Datei:** `src/lib/utils/mergeEngine.ts` (Lines 100+)

```typescript
// ❌ Hier sollte LWW-Check sein BEVOR Merge versucht wird!

export function threeWayMerge(
  base: CardContent,
  my: CardContent,
  their: CardContent
): MergeResult {
  // 1. Identifiziere alle Felder, die sich unterscheiden
  // 2. Versuche auto-merge für keine/wenige Konflikte
  
  // ❌ ABER: Keine Timestamp-Checks!
  //    - Welcher Timestamp ist der Base?
  //    - Welcher der Their?
  //    - Was wenn Their älter ist als Base? (stale event)
}
```

---

### Problem 3: Fehlende LWW-Flow in CardDialog.svelte Integration

**Datei sollte sein:** `src/routes/cardsboard/CardDialog.svelte` (nicht vollständig sichtbar)

```svelte
async function handleSave() {
  const flow = new CardEditingFlow(ndk);
  
  // 1. Start session (speichert baseTimestamp)
  const session = await flow.startEditing(card);
  
  // 2. Check for conflict
  const { hasConflict, latestVersion } = 
    await flow.checkForConflictBeforeSave(draftChanges);
  
  // ❌ HIER FEHLT: LWW-PRÜFUNG!
  // Sollte sein:
  // const isLatestNewer = latestVersion.updatedAt > session.baseTimestamp?
  // if (!isLatestNewer) {
  //   // Seine Änderung ist älter - einfach speichern (LWW gewinnt)
  //   await boardStore.editCard(...)
  //   return;
  // }
  
  // 3. Try auto-merge (aber ohne LWW-Kontext!)
  const mergeResult = await flow.tryAutoMerge(draftChanges, latestVersion);
}
```

---

## 📊 Integrations-Architektur (SOLL-ZUSTAND)

```
Nostr Event kommt an
    ↓
handleCardEvent() in nostr.ts
    ├─ LWW-Check: event.created_at > localCard.updatedAt?
    │  └─ NEIN → Skip (älteres Event)
    │  └─ JA → Continue
    ↓
User öffnet CardDialog
    ├─ cardEditingFlow.startEditing(card)
    │  └─ Speichert baseTimestamp (für später)
    ↓
User speichert
    ├─ cardEditingFlow.checkForConflictBeforeSave(myDraft)
    │  ├─ Fetch latestEvent vom Relay
    │  ├─ ❌ FEHLT: LWW-Check vor Merge-Versuch!
    │  │  └─ if (latestEvent.created_at <= baseTimestamp) { keine Konflikte }
    │  └─ Return { conflict, latestVersion }
    ↓
Falls Konflikt
    ├─ cardEditingFlow.tryAutoMerge(myDraft, theirVersion)
    │  ├─ threeWayMerge(base, my, their)
    │  │  └─ ❌ FEHLT: LWW-Kontext!
    │  │     (Sollte wissen: welcher Timestamp gehört zu 'their'?)
    │  └─ Return { status, conflicts, ... }
    ↓
Falls Auto-Merge erfolgreich
    └─ Save merged version (LWW-gewinner!)
    
Falls manuelle Auflösung nötig
    ├─ MergeConflictDialog zeigt 3 Versionen
    │  ├─ Base (mit Base-Timestamp)
    │  ├─ My (mit meinem Edit-Time)
    │  └─ Their (mit Their-Timestamp) ← ❌ FEHLT ANZEIGE!
    └─ User wählt → speichern
```

---

## 🔧 Was muss IMPLEMENTIERT werden?

### FIX 1: detectConflict() muss LWW-aware sein

**Datei:** `src/lib/utils/mergeEngine.ts`

**Neuer Code:**
```typescript
// Alte Signatur:
// export async function detectConflict(
//   session: EditingSession,
//   latestEvent: NDKEvent
// ): Promise<{ conflict: boolean }> { ... }

// ✅ Neue Signatur:
export async function detectConflict(
  session: EditingSession,
  latestEvent: NDKEvent
): Promise<{
  conflict: boolean;
  isLWWOlder: boolean;  // ← NEU! True wenn latestEvent älter ist
  eventTimestamp: number;
}> {
  // 1. Timestamp-Vergleich (LWW-Regel)
  const eventTime = latestEvent.created_at || 0;
  const baseTime = session.baseTimestamp;
  
  // ✅ Ist das Event älter? → LWW sagt: kein Konflikt!
  if (eventTime <= baseTime) {
    return {
      conflict: false,
      isLWWOlder: true,
      eventTimestamp: eventTime
    };
  }
  
  // 2. Event ist neuer - jetzt prüfe Inhalts-Konflikt
  const latestVersion = JSON.parse(latestEvent.content || '{}');
  
  // ❓ Hat der neuer Event die Felder geändert, die ich auch geändert habe?
  // (später in threeWayMerge genauer berechnet)
  
  return {
    conflict: true, // Potentieller Konflikt
    isLWWOlder: false,
    eventTimestamp: eventTime
  };
}
```

---

### FIX 2: cardEditingFlow.ts muss LWW-Check machen

**Datei:** `src/lib/utils/cardEditingFlow.ts` (Lines 60-85)

**Neuer Code:**
```typescript
async checkForConflictBeforeSave(myDraft: CardContent) {
  if (!this.currentSession) {
    throw new Error('No editing session active');
  }

  const latestEvent = await this.ndk.fetchEvent({
    kinds: [30302 as any],
    '#d': [this.currentSession.cardId],
    limit: 1
  } as any);

  if (!latestEvent) {
    return { hasConflict: false, latestVersion: null };
  }

  const latestVersion = JSON.parse(latestEvent.content) as CardContent;
  
  // ✅ FIX 1: Hier LWW-Check mit detectConflict()
  const { conflict, isLWWOlder, eventTimestamp } = await detectConflict(
    this.currentSession,
    latestEvent
  );
  
  // ✅ FIX 2: Wenn LWW älter ist, kein Konflikt!
  if (isLWWOlder) {
    console.log('✅ Latest event is older (LWW) - no conflict');
    return { hasConflict: false, latestVersion: null };
  }
  
  // ✅ FIX 3: Nur wenn Event neuer ist, kann es Konflikt geben
  if (!conflict) {
    return { hasConflict: false, latestVersion };
  }
  
  if (conflict) {
    console.warn('⚠️  Conflict detected!', {
      baseTime: this.currentSession.baseTimestamp,
      latestTime: eventTimestamp,
      myChanges: myDraft
    });
  }

  return { hasConflict: conflict, latestVersion };
}
```

---

### FIX 3: MergeConflictDialog.svelte muss Timestamps zeigen

**Datei:** `src/routes/cardsboard/MergeConflictDialog.svelte` (Lines ~80-120)

**Neuer Code:**
```svelte
<!-- In der "Column 3: Their Version" Sektion -->
<div class="space-y-2">
  <h4 class="text-xs font-semibold text-green-600">🟢 Pauls Änderung</h4>
  
  <!-- ✅ NEU: Timestamp-Info anzeigen -->
  {#if conflict.theirTimestamp}
    <div class="text-xs text-slate-500 bg-green-50 p-1 rounded">
      Geändert: {new Date(conflict.theirTimestamp * 1000).toLocaleString('de-DE')}
    </div>
  {/if}
  
  <div class="bg-green-50 border-2 border-green-200 p-3 rounded text-xs font-mono">
    {formatValue(conflict.theirVersion)}
  </div>
  
  <Button onclick={() => (resolutions[conflict.field as string] = 'theirs')>
    Diese Version
  </Button>
</div>
```

---

## 📋 Integration Checklist

### Schritt 1: mergeEngine.ts Update (15 min)
- [ ] `detectConflict()` LWW-Logik hinzufügen
- [ ] Neue Return-Felder: `isLWWOlder`, `eventTimestamp`
- [ ] Tests: LWW-Szenarien validieren

### Schritt 2: cardEditingFlow.ts Update (15 min)
- [ ] `checkForConflictBeforeSave()` LWW-Check aufrufen
- [ ] Kein Konflikt-Dialog wenn LWW älter
- [ ] Console-Logs für Debug

### Schritt 3: MergeConflictDialog.svelte Update (10 min)
- [ ] Timestamp-Info zu ConflictingField hinzufügen
- [ ] UI zeigt `theirTimestamp` an
- [ ] Tooltip erklärt "Wann wurde das geändert"

### Schritt 4: Dokumentation (10 min)
- [ ] MERGE-SYSTEM.md aktualisieren
- [ ] Integration mit LWW erklären
- [ ] Entscheidungslogik dokumentieren

### Schritt 5: Tests (20 min)
- [ ] Unit: detectConflict() LWW-Szenarien
- [ ] E2E: Zwei Browser, älter Event zuerst
- [ ] Manual: CardDialog zeigt Timestamps

**TOTAL: ~70 Minuten**

---

## 🎯 Warum ist diese Integration wichtig?

**Scenario:** Anna und Paul bearbeiten gleichzeitig eine Karte

```
Base (V1): heading="Original"

Anna (Browser A):
  └─ 09:00 öffnet Karte (baseTimestamp: 09:00)
  └─ 09:05 ändert auf "Annas Version"
  └─ 09:10 speichert
  └─ Event publiziert: V2 (created_at: 09:10)

Paul (Browser B):
  └─ 09:00 öffnet Karte (baseTimestamp: 09:00)
  └─ 09:08 ändert auf "Pauls Version"  ← VOR Annas Event!
  └─ 09:15 speichert ← NACH Annas Event!
  └─ Versucht zu speichern
```

**Problem OHNE LWW-Integration:**
```
Paul speichert um 09:15
  ├─ Holt latestEvent: Anna's V2 (09:10)
  ├─ detectConflict() sagt: "Ja, Konflikt!"
  ├─ Merge-Dialog zeigt 3 Versionen
  ├─ Paul sieht keine Info, dass Annas Event ÄLTER ist als sein Base!
  └─ ⚠️ Paul wählt Annas Version (obwohl Paul später war!)
```

**Vorteil MIT LWW-Integration:**
```
Paul speichert um 09:15
  ├─ Holt latestEvent: Anna's V2 (09:10)
  ├─ detectConflict() prüft LWW:
  │  └─ Annas V2 (09:10) > Pauls Base (09:00)? JA
  │  └─ Aber: Annas Edit war VOR Paul's Edit (09:08)
  │  └─ Wer gewinnt nach LWW? Der mit SPÄTEREM created_at!
  ├─ Merge-Logik merkt: "Annas Event ist älter, Paul ist neuer"
  ├─ Auto-Merge oder Smart-Dialog:
  │  └─ Zeigt wer WIRKLICH zuletzt editiert hat (basierend auf Timestamps)
  └─ ✅ Richtige Version gewinnt!
```

---

## ✨ Summary

| Aspekt | Status | Impact |
|--------|--------|--------|
| **Merge-System** | ✅ Existiert | Handles Konflikte |
| **LWW-Regel** | ✅ Existiert | In `nostr.ts` implementiert |
| **Integration** | ❌ FEHLT | 70 min Arbeit |
| **Timestamp-Handling** | 🟡 Teilweise | Base ja, Their nein |
| **UI-Feedback** | ❌ FEHLT | Benutzer sieht nicht wer neuer ist |

**Empfehlung:** Diese Integration sollte DIREKT nach den Card-Duplication & Background-Sync Fixes implementiert werden (~ 1 Stunde Aufwand).

**Priorität:** 🟠 **MEDIUM-HIGH** - Nicht kritisch, aber verhindert Race Conditions bei gleichzeitigen Edits.
