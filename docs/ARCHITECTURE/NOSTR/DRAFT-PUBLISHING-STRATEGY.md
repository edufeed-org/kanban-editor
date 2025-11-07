# 📝 Draft Publishing Strategy - Proposal

**Datum:** 7. November 2025  
**Status:** 🟡 **PROPOSAL - Benötigt Entscheidung**  
**Context:** PublishState 'draft' Handling für Boards/Cards

---

## 🎯 Problem Statement

Aktuell haben wir 3 PublishStates:
- `'published'` - Öffentlich sichtbar
- `'draft'` - Work in Progress
- `'private'` - Privat (nur für User)

**Frage:** Wie sollen Draft-Events behandelt werden?

Derzeit:
- ✅ relaysPublic und relaysPrivate sind in settingsStore konfigurierbar
- ❌ Keine Logik für unterschiedliche Publishing basierend auf PublishState
- ❌ Alles wird gleich behandelt (an alle Relays)

---

## 💡 Drei Optionen im Detail

### Option A: Draft → Private Relays (wenn vorhanden) ⭐ **EMPFOHLEN**

**Konzept:**
```typescript
if (publishState === 'draft') {
  if (relaysPrivate.length > 0) {
    // Publish nur zu Private Relays
    publishToRelays(relaysPrivate);
  } else {
    // Fallback: Nur localStorage (kein Nostr)
    saveToLocalStorageOnly();
  }
} else if (publishState === 'published') {
  // Publish zu Public Relays
  publishToRelays(relaysPublic);
} else if (publishState === 'private') {
  if (relaysPrivate.length > 0) {
    publishToRelays(relaysPrivate);
  } else {
    saveToLocalStorageOnly();
  }
}
```

**Vorteile:**
- ✅ Flexibel: User entscheidet via Settings
- ✅ Privacy: Drafts bleiben privat wenn gewünscht
- ✅ Collaboration: Team-Drafts über Private Relay möglich
- ✅ Fallback: Funktioniert auch ohne Private Relay (localStorage)

**Nachteile:**
- ⚠️ Komplexer: Zusätzliche Logik nötig
- ⚠️ Settings-Abhängig: User muss Private Relays konfigurieren

**Use Cases:**
- 🎓 **Lehrkraft alleine:** Keine Private Relays → Draft bleibt lokal
- 👥 **Team:** Private Relay konfiguriert → Drafts werden geteilt
- 🏫 **Schule:** Gemeinsamer Private Relay für Fachgruppe

---

### Option B: Draft → Nur localStorage (NIEMALS Nostr)

**Konzept:**
```typescript
if (publishState === 'draft') {
  // NIEMALS zu Nostr publishen
  saveToLocalStorageOnly();
  console.log('📦 Draft saved locally only');
} else {
  // Alle anderen States zu Nostr
  publishToNostr(relaysPublic);
}
```

**Vorteile:**
- ✅ Einfach: Klare Regel, keine Konfiguration nötig
- ✅ Privacy: Drafts sind GARANTIERT lokal
- ✅ Performance: Kein Netzwerk-Traffic für Drafts

**Nachteile:**
- ❌ Keine Collaboration: Drafts können nicht geteilt werden
- ❌ Kein Backup: Drafts gehen verloren bei Browser-Datenverlust
- ❌ Kein Multi-Device: Drafts nur auf einem Gerät

**Use Cases:**
- 📝 **Personal Notes:** Ideensammlung, private Gedanken
- 🔒 **Sensitive Content:** Absolut vertrauliche Inhalte

---

### Option C: Draft → IMMER zu Nostr (wie 'published')

**Konzept:**
```typescript
// PublishState wird ignoriert für Relay-Auswahl
publishToNostr(relaysPublic);
```

**Vorteile:**
- ✅ Sehr einfach: Keine Sonderlogik
- ✅ Backup: Alles auf Nostr gesichert
- ✅ Multi-Device: Funktioniert überall

**Nachteile:**
- ❌ KEINE Privacy: Drafts sind öffentlich sichtbar!
- ❌ Spam: Viele unfertige Entwürfe in Relays
- ❌ Confusion: Was ist der Unterschied zu 'published'?

**Use Cases:**
- 🤷 Keiner sinnvoll - PublishState wäre bedeutungslos

---

## 🎯 Empfehlung: **Option A + Settings-Toggle**

Ich empfehle **Option A** mit zusätzlichem Settings-Toggle für Flexibilität:

### Neue Settings-Felder:

```typescript
export interface SettingsState {
  // ... existing fields ...
  
  // 🆕 Draft Publishing Strategy
  draftPublishingMode: 'private-relays' | 'local-only' | 'public-relays';
  
  // Alternativ als separate Booleans:
  publishDraftsToPrivateRelays: boolean;  // Default: true
  publishDraftsToPublicRelays: boolean;   // Default: false
}
```

### Publishing-Logik:

```typescript
// In syncManager.svelte.ts oder nostrEvents.ts

function getTargetRelays(publishState: PublishState, settings: SettingsState): string[] {
  if (publishState === 'published') {
    return settings.relaysPublic;
  }
  
  if (publishState === 'draft') {
    switch (settings.draftPublishingMode) {
      case 'private-relays':
        return settings.relaysPrivate.length > 0 
          ? settings.relaysPrivate 
          : []; // Empty = localStorage only
          
      case 'local-only':
        return []; // Never publish drafts
        
      case 'public-relays':
        return settings.relaysPublic; // Same as published
        
      default:
        return []; // Safe default
    }
  }
  
  if (publishState === 'private') {
    return settings.relaysPrivate.length > 0 
      ? settings.relaysPrivate 
      : []; // Empty = localStorage only
  }
  
  return [];
}
```

### UI in Settings Panel:

```svelte
<Field.Root>
  <Label>Draft Publishing Strategy</Label>
  <Select bind:value={draftPublishingMode}>
    <option value="private-relays">
      Private Relays (if configured, else local-only)
    </option>
    <option value="local-only">
      Local-Only (never publish drafts to Nostr)
    </option>
    <option value="public-relays">
      Public Relays (same as published - NOT RECOMMENDED)
    </option>
  </Select>
  <Description>
    Controls where draft boards/cards are published.
    Private Relays allow team collaboration on drafts.
  </Description>
</Field.Root>
```

---

## 📊 Vergleichstabelle

| Aspekt | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Privacy** | ✅ Flexibel (User wählt) | ✅ Garantiert | ❌ Keine |
| **Collaboration** | ✅ Möglich (Private Relay) | ❌ Nicht möglich | ✅ Möglich |
| **Backup** | ✅ Wenn gewünscht | ❌ Nur lokal | ✅ Immer |
| **Multi-Device** | ✅ Wenn gewünscht | ❌ Nicht möglich | ✅ Immer |
| **Komplexität** | 🟡 Medium | ✅ Einfach | ✅ Sehr einfach |
| **Settings UI** | 🟡 Toggle nötig | ✅ Keine Settings | ✅ Keine Settings |
| **Use Cases** | ✅ Alle abgedeckt | 🟡 Nur Personal | ❌ Sinnlos |

---

## 🛠️ Implementation Plan (für Option A)

### Phase 1: Settings erweitern (15 Min)

```typescript
// src/lib/stores/settingsStore.svelte.ts

export interface SettingsState {
  // ... existing ...
  
  // 🆕 Draft Publishing
  draftPublishingMode: 'private-relays' | 'local-only' | 'public-relays';
}

export const DEFAULT_SETTINGS: SettingsState = {
  // ... existing ...
  draftPublishingMode: 'private-relays', // Default: Private if available
};
```

### Phase 2: getTargetRelays() Funktion (20 Min)

```typescript
// src/lib/utils/nostrEvents.ts oder neue Datei publishingUtils.ts

export function getTargetRelays(
  publishState: PublishState, 
  settings: SettingsState
): string[] {
  // Implementation wie oben
}
```

### Phase 3: SyncManager Integration (30 Min)

```typescript
// src/lib/stores/syncManager.svelte.ts

import { getTargetRelays } from '$lib/utils/publishingUtils';
import { settingsStore } from './settingsStore.svelte';

public async publishOrQueue(
  event: NDKEvent, 
  type: 'board' | 'card' | 'comment',
  priority: 'high' | 'normal' = 'normal'
): Promise<void> {
  
  // 🆕 Extrahiere publishState aus Event tags
  const stateTag = event.tags.find(t => t[0] === 'state');
  const publishState = (stateTag?.[1] || 'published') as PublishState;
  
  // 🆕 Bestimme Ziel-Relays basierend auf State + Settings
  const targetRelays = getTargetRelays(publishState, settingsStore.settings);
  
  if (targetRelays.length === 0) {
    console.log(`📦 ${type} with state '${publishState}' saved locally only (no relays configured)`);
    return; // Don't publish, only localStorage
  }
  
  // Publish zu den ermittelten Relays
  // ... existing logic mit targetRelays statt all relays
}
```

### Phase 4: Settings UI (45 Min)

```svelte
<!-- src/routes/cardsboard/SettingsPanel.svelte -->

<Tabs.Content value="nostr">
  <div class="space-y-4">
    
    <!-- Existing Relay Configuration -->
    <Field.Root>
      <Label>Public Relays</Label>
      <!-- ... existing ... -->
    </Field.Root>
    
    <Field.Root>
      <Label>Private Relays</Label>
      <!-- ... existing ... -->
    </Field.Root>
    
    <!-- 🆕 Draft Publishing Mode -->
    <Field.Root>
      <Label>Draft Publishing Strategy</Label>
      <Select 
        bind:value={draftPublishingMode}
        onValueChange={(value) => settingsStore.setDraftPublishingMode(value)}
      >
        <Select.Trigger>
          <Select.Value placeholder="Select strategy" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="private-relays">
            📝 Private Relays (if configured)
          </Select.Item>
          <Select.Item value="local-only">
            🔒 Local-Only (never publish)
          </Select.Item>
          <Select.Item value="public-relays">
            🌐 Public Relays (not recommended)
          </Select.Item>
        </Select.Content>
      </Select>
      <Description>
        {#if draftPublishingMode === 'private-relays'}
          Drafts will be published to private relays if configured, 
          otherwise saved locally only. Allows team collaboration on drafts.
        {:else if draftPublishingMode === 'local-only'}
          Drafts will NEVER be published to Nostr, only saved in browser.
          Best for sensitive or personal content.
        {:else}
          Drafts will be published to public relays (same as 'published' state).
          ⚠️ Not recommended - drafts will be publicly visible!
        {/if}
      </Description>
    </Field.Root>
    
  </div>
</Tabs.Content>
```

---

## ✅ Testing Checklist

Nach Implementation:

- [ ] **Test 1: Private Relays konfiguriert + Mode 'private-relays'**
  - Draft Board erstellen → sollte zu Private Relays publishen
  - Verifizieren: Event erscheint NUR in Private Relays, NICHT in Public
  
- [ ] **Test 2: Keine Private Relays + Mode 'private-relays'**
  - Draft Board erstellen → sollte NUR localStorage nutzen
  - Verifizieren: Kein Nostr Event publiziert
  
- [ ] **Test 3: Mode 'local-only'**
  - Draft Board erstellen → NIEMALS zu Nostr
  - Verifizieren: Nur localStorage, auch wenn Private Relays konfiguriert
  
- [ ] **Test 4: Mode 'public-relays' (nicht empfohlen)**
  - Draft Board erstellen → zu Public Relays
  - Verifizieren: Event erscheint in Public Relays
  
- [ ] **Test 5: State 'published'**
  - Published Board → IMMER zu Public Relays (unabhängig von Draft Mode)
  
- [ ] **Test 6: State 'private'**
  - Private Board → zu Private Relays (oder localStorage wenn keine vorhanden)

---

## 🎯 Entscheidung erforderlich

**Welche Option soll implementiert werden?**

- [ ] **Option A + Settings Toggle** ⭐ (Empfohlen - maximal flexibel)
- [ ] **Option B** (Einfach - nur localStorage)
- [ ] **Option C** (Nicht empfohlen)
- [ ] **Andere Variante** (bitte beschreiben)

**Geschätzter Aufwand für Option A:**
- Settings: 15 Min
- getTargetRelays(): 20 Min
- SyncManager Integration: 30 Min
- Settings UI: 45 Min
- Testing: 30 Min
**Total: ~2.5 Stunden**

---

**Status:** 🟡 **AWAITING DECISION**  
**Nächster Schritt:** User-Feedback zu Option A/B/C
