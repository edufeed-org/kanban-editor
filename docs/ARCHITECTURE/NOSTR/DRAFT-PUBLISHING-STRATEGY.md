# 📝 Draft Publishing Strategy - Implementation


### Drei PublishStates:
- `'published'` - **Public + Private Relays** (vollständiges Backup!)
- `'draft'` - **Abhängig von draftPublishingMode** (siehe unten)
- `'private'` - **Nur Private Relays** (oder local-only)

### Aktueller Stand:
- ✅ relaysPublic und relaysPrivate sind in settingsStore konfigurierbar
- ✅ **NEUE** Relay Selection Logik basierend auf PublishState
- ✅ **NEUE** draftPublishingMode Setting (3 Modi)
- ✅ **NEUE** Smart Fallbacks bei fehlenden Relays
- ✅ Umfassende Console-Logs für Debugging
- ✅ Alle Tests bestanden ✅

---

## Implementierte Relay Selection Rules

### Rule 1: 'published' → Public + Private Relays ✅

**Konzept:**
```typescript
if (publishState === 'published') {
  targetRelays = [...relaysPublic, ...relaysPrivate];
  
  // Deduplizierung falls gleiche Relays in beiden Listen
  uniqueRelays = [...new Set(targetRelays)];
  
  // Smart Fallbacks:
  if (uniqueRelays.length === 0) {
    console.error('⚠️ CRITICAL: No relays configured! Event will be local-only.');
    return [];
  }
  
  if (relaysPublic.length === 0) {
    console.warn('⚠️ No public relays! Published content only to private.');
  }
  
  if (relaysPrivate.length === 0) {
    console.warn('⚠️ No private relays! Published content has no backup.');
  }
  
  return uniqueRelays; // Public + Private combined!
}
```

**Warum Public + Private?**
- ✅ **Master Storage:** Private Relays enthalten ALLE Events (published + draft + private)
- ✅ **Public Discovery:** Public Relays enthalten nur published Events
- ✅ **Vollständiges Backup:** Wenn Public Relays ausfallen, sind Events noch auf Private
- ✅ **Board Loading:** Alle Boards können von Private Relays geladen werden

**Beispiel:**
- relaysPublic: `['wss://relay.damus.io', 'wss://nos.lol']`
- relaysPrivate: `['wss://private.edufeed.org']`
- **Result:** `['wss://relay.damus.io', 'wss://nos.lol', 'wss://private.edufeed.org']`

---

### Rule 2: 'draft' → Abhängig von draftPublishingMode ✅

**3 Modi verfügbar:**

#### Mode: 'private-relays' (DEFAULT) ⭐

```typescript
if (publishState === 'draft' && draftPublishingMode === 'private-relays') {
  if (relaysPrivate.length === 0) {
    console.warn('⚠️ No private relays configured! Draft will be local-only.');
    return []; // Local-only Fallback
  }
  console.log('Draft → Using private relays');
  return relaysPrivate;
}
```

**Use Cases:**
- 👥 Team-Collaboration: Drafts werden über Private Relay geteilt
- 🔄 Multi-Device: Drafts sind auf allen Geräten verfügbar
- 💾 Backup: Drafts sind auf Nostr gesichert

**Beispiel:**
- relaysPrivate: `['wss://private.edufeed.org']`
- **Result:** `['wss://private.edufeed.org']`

#### Mode: 'local-only'

```typescript
if (publishState === 'draft' && draftPublishingMode === 'local-only') {
  console.log('Draft → No Nostr publishing (local-only)');
  return []; // NIEMALS zu Nostr publishen
}
```

**Use Cases:**
- 🔒 Privacy: Absolut vertrauliche Inhalte
- 📝 Personal Notes: Nur für lokale Verwendung
- 🚫 No Backup: User akzeptiert Datenverlust-Risiko

**Beispiel:**
- **Result:** `[]` (empty = don't publish to Nostr)

#### Mode: 'public-relays' (NOT RECOMMENDED ⚠️)

```typescript
if (publishState === 'draft' && draftPublishingMode === 'public-relays') {
  if (relaysPublic.length === 0) {
    console.warn('⚠️ No public relays configured! Draft will be local-only.');
    return [];
  }
  console.warn('⚠️ Using public relays for drafts (NOT RECOMMENDED for privacy!)');
  return relaysPublic;
}
```

**Use Cases:**
- 🤷 Keiner sinnvoll - Drafts sollten nicht öffentlich sein!
- ⚠️ Nur für Testing/Development

**Beispiel:**
- relaysPublic: `['wss://relay.damus.io']`
- **Result:** `['wss://relay.damus.io']` (⚠️ Publicly visible draft!)

---

### Rule 3: 'private' → ALWAYS Private Relays ✅

```typescript
if (publishState === 'private') {
  if (relaysPrivate.length === 0) {
    console.error('⚠️ CRITICAL: No private relays for private content! Local-only.');
    return [];
  }
  console.log('Private content → Using private relays');
  return relaysPrivate;
}
```

**Use Cases:**
- 🔐 Sensitive Content: Nur für bestimmte User sichtbar
- 👥 Team-Internal: Boards nur für Team-Mitglieder
- 📊 Internal Planning: Nicht-öffentliche Strategien

**Beispiel:**
- relaysPrivate: `['wss://private.edufeed.org']`
- **Result:** `['wss://private.edufeed.org']`

---

---

## 🛠️ Implementierungs-Details

### Datei 1: `src/lib/utils/relaySelection.ts` (277 lines)

**Hauptfunktion:**
```typescript
export function getTargetRelays(options: RelaySelectionOptions): string[] {
  const { publishState, draftPublishingMode, relaysPublic, relaysPrivate } = options;
  
  // Rule 1: 'published' → Public + Private (with deduplication)
  if (publishState === 'published') {
    const targetRelays = [...relaysPublic, ...relaysPrivate];
    const uniqueRelays = [...new Set(targetRelays)];
    
    // Smart fallbacks with console warnings
    if (uniqueRelays.length === 0) {
      console.error('[RelaySelection] ⚠️ CRITICAL: No relays! Local-only.');
      return [];
    }
    
    return uniqueRelays;
  }
  
  // Rule 2: 'private' → Private relays only
  if (publishState === 'private') {
    if (relaysPrivate.length === 0) {
      console.error('[RelaySelection] ⚠️ CRITICAL: No private relays! Local-only.');
      return [];
    }
    return relaysPrivate;
  }
  
  // Rule 3: 'draft' → Depends on draftPublishingMode
  if (publishState === 'draft') {
    switch (draftPublishingMode) {
      case 'private-relays':
        return relaysPrivate.length > 0 ? relaysPrivate : [];
      case 'local-only':
        return [];
      case 'public-relays':
        return relaysPublic.length > 0 ? relaysPublic : [];
      default:
        return relaysPrivate.length > 0 ? relaysPrivate : [];
    }
  }
  
  return [];
}
```

**Zusätzliche Funktionen:**
- `shouldPublishToNostr(publishState, draftPublishingMode): boolean`
- `getRelaySelectionDescription(options): string` - UI-friendly descriptions

---

### Datei 2: `src/lib/stores/settingsStore.svelte.ts`

**Neue Settings-Felder:**
```typescript
export interface SettingsState {
  // ... existing fields ...
  
  // 🆕 Draft Publishing Strategy
  draftPublishingMode: 'private-relays' | 'local-only' | 'public-relays';
}

export const DEFAULT_SETTINGS: SettingsState = {
  // ... existing ...
  draftPublishingMode: 'private-relays', // DEFAULT: Private if available
};
```

**Neue Methode:**
```typescript
public setDraftPublishingMode(mode: DraftPublishingMode): void {
  this.settings.draftPublishingMode = mode;
  this.saveSettings();
  console.log(`[SettingsStore] Draft publishing mode set to: ${mode}`);
}
```

---

### Datei 3: `src/lib/stores/syncManager.svelte.ts`

**Integration:**
```typescript
import { getTargetRelays } from '$lib/utils/relaySelection';
import { settingsStore } from './settingsStore.svelte';

public async publishOrQueue(
  event: NDKEvent, 
  type: 'board' | 'card' | 'comment',
  priority: 'high' | 'normal' = 'normal'
): Promise<void> {
  
  // Extrahiere publishState aus Event tags
  const stateTag = event.tags.find(t => t[0] === 'state');
  const publishState = (stateTag?.[1] || 'published') as PublishState;
  
  // Bestimme Ziel-Relays basierend auf State + Settings
  const targetRelays = getTargetRelays({
    publishState,
    draftPublishingMode: settingsStore.settings.draftPublishingMode,
    relaysPublic: settingsStore.settings.relaysPublic,
    relaysPrivate: settingsStore.settings.relaysPrivate
  });
  
  if (targetRelays.length === 0) {
    console.log(`[SyncManager] ${type} with state '${publishState}' saved locally only (no relays)`);
    return; // Don't publish, only localStorage
  }
  
  // Publish zu den ermittelten Relays
  await this.signAndPublish(event, targetRelays, type);
}
```

---

### Datei 4: Test Suite (`src/lib/utils/nostrPublishingTest.ts`)

**3 neue Test-Funktionen:**

```typescript
// Test 1: Normale Szenarien
window.testRelaySelection = function() {
  // Testet published, draft, private mit verschiedenen Modi
}

// Test 2: Edge Cases
window.testRelaySelectionEdgeCases = function() {
  // Testet: Keine Private, Keine Public, Beide leer, Deduplizierung
}

// Test 3: Vollständiger Test
window.testRelaySelectionFull = function() {
  // Kombiniert Test 1 + 2 + Summary
}
```

## ✅ Testing Results

**Alle Tests erfolgreich bestanden!** ✅

### Test 1: Relay Selection - Normale Fälle ✅

```javascript
window.testRelaySelection()
```

**Ergebnis:**
- ✅ PUBLISHED → Public + Private Relays (dedupliziert)
- ✅ DRAFT → Private Relays (mode='private-relays')
- ✅ PRIVATE → Private Relays only

### Test 2: Edge Cases ✅

```javascript
window.testRelaySelectionEdgeCases()
```

**Ergebnis:**
- ✅ Keine Private Relays → local-only mit Warnung
- ✅ Keine Public Relays → nur Private Backup
- ✅ Beide leer → CRITICAL local-only
- ✅ Deduplizierung funktioniert

### Test 3: Vollständiger Test ✅

```javascript
window.testRelaySelectionFull()
```

**Ergebnis:**
- ✅ Alle Normal Scenarios: PASS
- ✅ Alle Edge Cases: PASS
- ✅ Console Output korrekt
- ✅ Smart Fallbacks aktiv

### Manuelle Tests ✅

- ✅ **Column Moving:** Event wird korrekt publiziert (keine Duplikate)
- ✅ **Board Creation:** DRAFT geht zu Private Relays
- ✅ **State Changes:** DRAFT → PUBLISHED wechselt Relays korrekt
- ✅ **Stack Traces:** Nur 1 Call-Path, keine Reactive Loops

**Dokumentation:** Siehe [`docs/TESTING/RELAY-SELECTION-TEST-GUIDE.md`](../../TESTING/RELAY-SELECTION-TEST-GUIDE.md)

---


## 🎯 Nächste Schritte

### Phase 2: Settings UI (TODO)

**Was fehlt noch:**
- [ ] Visual Feedback für aktuelle Relay Selection (Toaster)
- [ ] Help-Text & Tooltips für User-Guidance
- [ ] Settings-Export/-Import Integration


---

## 📚 Referenzen

- **Test Guide:** [`docs/TESTING/RELAY-SELECTION-TEST-GUIDE.md`](../../TESTING/RELAY-SELECTION-TEST-GUIDE.md)
- **Code Files:**
  - `src/lib/utils/relaySelection.ts` (277 lines)
  - `src/lib/stores/settingsStore.svelte.ts` (draftPublishingMode)
  - `src/lib/stores/syncManager.svelte.ts` (integration)
  - `src/lib/utils/nostrPublishingTest.ts` (test suite)

---

**Status:** ✅ **COMPLETE & TESTED**  
**Implementation Date:** 7. November 2025  
**Last Updated:** 7. November 2025  
**Branch:** fix-nostr-publishing-workflow  
**Ready for:** Production merge nach Settings UI (Phase 2)
