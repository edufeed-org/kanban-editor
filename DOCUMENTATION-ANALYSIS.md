# 📋 Analyse: Abhängigkeiten & Integrationsstatus der Dokumentation

**Datum:** 18. Oktober 2025  
**Status:** Review für Vollständigkeit  
**Ziel:** Prüfung wie `NDK.md`, `NOSTR-USER.md` und `UX-RULES.md` in bestehende Specs eingebunden sind

---

## 1. Abhängigkeits-Matrix

### Überblick

| Doc | Referenziert in | Status | Kritikalität |
|-----|-----------------|--------|--------------|
| **AGENTS.md** | ROADMAP.md, KONZEPT.md | ✅ Zentral | 🔴 Kritisch |
| **NDK.md** | ROADMAP.md (2x erwähnt), AGENTS.md (❌ nicht!) | 🟡 Unvollständig | 🔴 Kritisch |
| **NOSTR-USER.md** | ROADMAP.md (1x erwähnt), AGENTS.md (❌ nicht!) | 🟡 Unvollständig | 🔴 Kritisch |
| **UX-RULES.md** | ROADMAP.md (1x erwähnt), AGENTS.md (❌ nicht!) | 🟡 Unvollständig | 🟡 Wichtig |
| **Kanban-NIP.md** | ROADMAP.md, AGENTS.md, NDK.md | ✅ Gut | 🔴 Kritisch |

---

## 2. Detaillierte Abhängigkeits-Analyse

### A. AGENTS.md — Core Spezifikation

**Aktuelle Situation:**
- ✅ Definiert `BoardModel.ts` (Card, Column, Board, Chat Klassen)
- ✅ Definiert `kanbanStore.ts` (Svelte 5 Stores)
- ✅ Definiert `nostrEvents.ts` (Event Serialisierung)
- ✅ Definiert `syncManager.ts` (Offline-First Queue)
- ❌ **Referenziert NICHT:** NDK.md, NOSTR-USER.md, UX-RULES.md

**Problem:**
- AGENTS.md schreibt vor: _„Klasse `Chat` serialisiert Kontext mit `getContextData()`"_, aber spezifiziert nicht die **UI-Struktur** für diese Chat-Komponente → UX-RULES.md wird nicht eingebunden
- AGENTS.md schreibt vor: _„`BoardStore` nutzt NDK"_, aber spezifiziert nicht die **NDK-Initialisierung, Signer-Integration oder Relay-Handling** → NDK.md wird nicht eingebunden
- AGENTS.md schreibt vor: _„Events werden mit User-Key signiert"_, aber referenziert nicht die **Authentifizierungs-Anforderungen** → NOSTR-USER.md wird nicht eingebunden

**Kritikalität:** 🔴 **HOCH** — Entwickler müssen manual alle 4 Docs kombinieren

---

### B. NDK.md — Nostr Integration

**Aktuelle Situation:**
- ✅ Erklärt NDK-Initialisierung in `+layout.svelte`
- ✅ Zeigt Event-Struktur (Kind 30301, 30302, 1)
- ✅ Erklärt Signer-Integration (NIP-07, nsec, NIP-46)
- ✅ Verweist auf NOSTR-USER.md für _„vollständige Authentifizierungs-Implementation"_
- ❌ **Wird in AGENTS.md nicht erwähnt**

**Abhängigkeiten (fehlend in AGENTS.md):**
1. `src/lib/stores/kanbanStore.ts` muss **NDK Kontext** empfangen (via `setContext('ndk', ndk)`)
2. `src/lib/utils/nostrEvents.ts` muss **NDK Instanz** als Parameter erhalten
3. `src/lib/stores/syncManager.ts` muss **NDK** für `event.publish()` nutzen

**Kritikalität:** 🔴 **HOCH** — Ohne diese Verknüpfung ist `BoardStore` nicht implementierbar

---

### C. NOSTR-USER.md — Authentifizierung & Profilverwaltung

**Aktuelle Situation:**
- ✅ Definiert `authStore.ts` (Session Management, Svelte 5 Runes)
- ✅ Definiert Login-Komponenten (LoginSheet, UserHeader, ProfileEditor)
- ✅ Erklärt Security Best Practices (Private Key Schutz, Session Expiration)
- ✅ Verweist auf NDK.md für Signer-Integration
- ❌ **Wird in AGENTS.md nicht erwähnt**

**Abhängigkeiten (fehlend in AGENTS.md):**
1. `BoardStore` braucht **authentifizierten Nutzer** (npub/signer von `authStore`)
2. Events müssen mit **User-Pubkey signiert** sein → `ndk.signer` muss gesetzt sein
3. `Board.author` muss auf **aktuellen User** verweisen

**Kritikalität:** 🔴 **HOCH** — Ohne Authentifizierung funktioniert keine Event-Signierung

---

### D. UX-RULES.md — Design- & Komponenten-Standards

**Aktuelle Situation:**
- ✅ Definiert shadcn-svelte Komponenten-Patterns
- ✅ Erklärt Icon-Import-Syntax (@lucide/svelte/icons/)
- ✅ Definiert Form-Validierung, Accessibility, Dark Mode
- ❌ **Wird in AGENTS.md nicht erwähnt**

**Abhängigkeiten (fehlend in AGENTS.md):**
1. `src/lib/components/Chatbot.svelte` (für Chat-Interface) muss UX-RULES.md folgen
2. `src/lib/components/auth/LoginSheet.svelte` (von NOSTR-USER.md) muss UX-RULES.md folgen
3. Alle UI-Komponenten müssen **shadcn-svelte Patterns** verwenden

**Kritikalität:** 🟡 **MITTEL** — Design ist wichtig, aber nicht funktional blockierend

---

## 3. Fehlende Querverweise

### In AGENTS.md müssten hinzugefügt werden:

```markdown
## ⚠️ Kritische Abhängigkeiten (Ergänzung)

Dieses Dokument spezifiziert die Core-Datenmodell und Stores. 
Für die vollständige Implementierung sind folgende **zwingend erforderlich**:

- **[NDK.md](./NDK.md)** — NDK-Initialisierung, Relay-Handling, Event Publishing
  - Wie `BoardStore` NDK-Kontext erhält
  - Wie `nostrEvents.ts` NDK-Instanz nutzt
  - Wie `syncManager.ts` Events published

- **[NOSTR-USER.md](./NOSTR-USER.md)** — Benutzerauthentifizierung & Session Management (KRITISCH!)
  - AuthStore Setup (im Gegensatz zum UserStore, den AGENTS.md erwähnt)
  - Signer-Integration für NDK
  - Wie `BoardStore` den authentifizierten User erhält
  - Security Best Practices

- **[UX-RULES.md](./UX-RULES.md)** — Design-Standards für alle UI-Komponenten
  - Chatbot-Komponenten müssen diese Regeln befolgen
  - Auth-Komponenten müssen diese Regeln befolgen
```

---

## 4. Integration der STORES.md (Empfehlung)

Basierend auf deiner Frage zu einem separaten `STORES.md`:

### Sinnvollheit: ✅ **JA, dringend empfohlen**

**Gründe:**

1. **Zu viele Store-Definitionen in AGENTS.md:**
   - `BoardStore` (kanbanStore.ts)
   - `ChatStore` (kanbanStore.ts)
   - `AuthStore` (authStore.ts, aber in NOSTR-USER.md)
   - `SyncManager` (syncManager.ts)
   - *(Potenziell) `SettingsStore`, `UserStore` später*

2. **Unklar, wo Store-Verantwortlichkeiten liegen:**
   - Welcher Store ist für NDK-Kontext zuständig?
   - Wie interagieren `BoardStore` und `AuthStore`?
   - Wie wird Export/Import in Stores integriert?

3. **Export/Import-Anforderung (Meilenstein 1.5):**
   - **Store-Level** Export/Import ist explizit gefordert
   - Das bedeutet: `BoardStore.exportBoard()` und `BoardStore.importBoard()`
   - Diese Methoden gehören in eine dedizierte Spec

### Empfohlene Struktur für STORES.md:

```
# 📦 Svelte 5 Stores Spezifikation

## I. Store-Architektur & Verantwortlichkeiten
- BoardStore (kanbanStore.ts)
- ChatStore (kanbanStore.ts)
- AuthStore (authStore.ts)
- SettingsStore (settingsStore.ts) — optional

## II. Store-Interaktionen
- Abhängigkeits-Diagramm
- Wie BoardStore NDK erhält (via Context)
- Wie BoardStore AuthStore nutzt (für Benutzer-Info)

## III. Store-Export/Import API (Meilenstein 1.5)
- boardStore.exportBoard(): JSON
- boardStore.importBoard(json): Board
- Validierung, ID-Konflikt-Handling

## IV. Persistenz-Strategie
- IndexedDB via svelte-persisted-store
- Session-Speicherung vs. Datenpersistenz
- Cache-Invalidation

## V. Svelte 5 Runes Best Practices
- $state Verwendung in Stores
- $derived für computed values
- Cleanup mit $effect
```

---

## 5. Empfohlene Verknüpfungs-Struktur (Überblick)

```
┌─────────────────────────────────────────┐
│        README.md (Einstieg)             │
│    [Links zu allen Docs]                │
└────────────┬────────────────────────────┘
             │
     ┌───────┴────────┬──────────┬─────────┐
     ↓                ↓          ↓         ↓
  KONZEPT.md    ROADMAP.md  README.md  (User docs)
     │              │
     └──────┬───────┴────────────┬─────────────┐
            ↓                    ↓             ↓
        AGENTS.md        ┌───────────────┐   UX-RULES.md
    (Core Classes)       │ NEUER KNOTEN: │
         │                │ STORES.md     │
         │               └───────────────┘
    ┌────┼──────────┬─────────┐
    ↓    ↓          ↓         ↓
  NDK  NOSTR-USER KANBAN-NIP  (impl. files)
  .md  .md        .md
```

---

## 6. Checkliste: Was muss noch getan werden?

### Sofort (🔴 KRITISCH):

- [ ] **AGENTS.md ergänzen** um Verweise auf NDK.md und NOSTR-USER.md
  - Section „Kritische Abhängigkeiten" um NDK & Auth hinzufügen
  - Beispiele zeigen, wie `BoardStore` NDK nutzt

- [ ] **README.md erweitern** um Dokumentations-Map
  - Klar darstellen, in welcher Reihenfolge die Docs gelesen werden sollten
  - Links zu STORES.md, NDK.md, NOSTR-USER.md, UX-RULES.md

- [ ] **STORES.md erstellen** (deine Frage!)
  - Export/Import API für Meilenstein 1.5
  - Store-Interaktionen & Verantwortlichkeiten

### Mittelfristig (🟡 WICHTIG):

- [ ] **Integrations-Checkliste** erstellen für Entwickler
  - _„Was musst du lesen/implementieren, wenn du Komponente X implementierst?"_

- [ ] **AGENTS.md Section V aktualisieren** um nostrEvents.ts & syncManager.ts
  - Dort jetzt nur BMM.ts, kanbanStore.ts erwähnt
  - Export/Import API sollte dort spezifiziert sein

- [ ] **UX-RULES.md in AGENTS.md Komponenten-Beispiele verlinken**
  - z.B. Card.svelte, CardDialog.svelte müssen UX-RULES.md folgen

---

## 7. Zusammenfassung

| Doku | Fehlt in | Empfehlung |
|------|----------|------------|
| **NDK.md** | AGENTS.md | ➕ In Section „Kritische Abhängigkeiten" verlinken + Beispiele wie BoardStore NDK nutzt |
| **NOSTR-USER.md** | AGENTS.md | ➕ In Section „Kritische Abhängigkeiten" verlinken + erwähnen dass AuthStore Prerequisite ist |
| **UX-RULES.md** | AGENTS.md | ➕ In Komponenten-Spec (Section VIII) verlinken |
| **STORES.md** | Nicht vorhanden! | ✨ **Neu erstellen** (basierend auf deiner Frage) |
| **Integrations-Map** | README.md | ➕ Visuelle Übersicht „Welche Docs gehören zusammen?" |

---

## 8. Nächste Schritte (Rekommendation)

1. **Sofort:** STORES.md erstellen (👈 deine Frage!)
2. **Sofort:** AGENTS.md „Kritische Abhängigkeiten"-Section erweitern
3. **Nächste Woche:** README.md mit Dokumentations-Index aktualisieren
4. **Optional:** INTEGRATION-CHECKLIST.md für Entwickler

---

**Fazit:** Die Dokumentation ist **fachlich vollständig**, aber die **Querverweise fehlen**. Entwickler müssen manuell alle Punkte verbinden. Ein `STORES.md` würde das stark vereinfachen, besonders für Meilenstein 1.5 (Export/Import).
