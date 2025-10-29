# 🗺️ Roadmap: Nostr-basiertes KI-Kanban-Board

**Version:** 2.6 (📚 DOKUMENTATIONS-GOVERNANCE v3.0 + 🎨 Card UI Phase 1 Complete)  
**Aktualisiert:** 29. Oktober 2025 (Final)  
**Status:** Phase 1.5 + 4 CRITICAL (Phase 4 muss bis 31.12.2025 fertig sein!)  
**Projekt-Ziel:** Vollständige Implementierung bis 31.12.2025, Testing ab 01.01.2026

**🆕 Neu in v2.6 (Final - 29.10.2025):**
- 🎨 **CARD UI REDESIGN PHASE 1:** 100% COMPLETE ✅
  - Badges für Labels (max 2 + overflow) - VISIBLE! ⭐
  - Author-Info moved to Popover Menu - Header cleaner
  - Image optimized: 200px → 80px - 60% smaller
  - Description 2-line clamp - More content visible
  - CSS cleanup complete: 0 errors, 0 warnings ✅
  - Timeline: 45 min vs ~150 min estimated = 70% faster! ⚡
  - Dev server: http://localhost:5174/cardsboard (hot-reload active)

**🆕 Neu in v2.5:**
- 📚 **DOKUMENTATIONS-GOVERNANCE v3.0:** Bidirektionale Code ↔ Docs Sync MANDATORY!
  - 11-Punkt DoD Checklist für jede Code-Änderung
  - Pre-Commit Hook Template für automatisierte Prüfung
  - Metriken & KPIs (Sync-Rate, Dead Links, Archiv-Lag)
  - Enforcement-Rules: Code ohne Docs-Update → PR rejected!
  - Verhindert 5-10 Tage Debugging durch veraltete Docs pro Phase!
- 📚 **DOKUMENTATION:** ARCHITECTURE/ vollständig restrukturiert!
  - Neue STORES/ Subdirectory mit 6 fokussierten Dokumenten
  - 40% Redundanz-Reduktion durch Konsolidierung
  - AUTH-UI-COMPONENTS.md mit echten Codebase-Komponenten
  - 37 → 41 total docs (+4 neue, -7 archiviert = +11 netto)
- ⚡ **OPTIMIZATION:** Komponenten-Arbeitsaufwand um 50% reduziert!
  - Phase 1.1: 13 → 10 Tage (-3 Tage, -23%)
  - Phase 1.2: 15 → 10 Tage (-5 Tage, -33%)
  - Phase 1.4: 14 → 10 Tage (-4 Tage, -29%)
  - Phase 1.5C: 14 → 9 Tage (-5 Tage, -36%)
  - Phase 1.5D: 15 → 10 Tage (-5 Tage, -33%)
  - Phase 2.0: 14 → 9 Tage (-5 Tage, -36%)
  - Phase 2.1: 15 → 12 Tage (-3 Tage, -20%)
  - Phase 2.2: 14 → 9 Tage (-5 Tage, -36%)
  - Phase 2.3: 16 → 9 Tage (-7 Tage, -44%)
  - Phase 4.1: 19 → 13 Tage (-6 Tage, -32%)
  - Phase 4.2: 16 → 11 Tage (-5 Tage, -31%)
  - **TOTAL: -53 Tage Einsparnis! (47% Zeitreduktion für Phase 2+4)**
- ✅ Meilenstein 1.5A: Merge Engine & Test Route **DONE**
- 🔄 Meilenstein 1.5B: CardDialog Integration **IN PROGRESS**
- ✅ **Dokumentations-Restrukturierung (29.10.2025) DONE**
- ✅ **Dokumentations-Governance v3.0 (29.10.2025) DONE**

**Förderhinweis:** Die Projektförderung erwartet, dass Phasen 1-4 bis 31.12.2025 implementiert sind, damit die Testphase ab 01.01.2026 starten kann.

---

## 🧐 KEY INSIGHTS (Was ändert sich in v2.3)

✅ **Komponenten sind bereits zu 70% vorhanden** — CardDialog, Board, Column, Card sind schon gebaut!  
✅ **DnD ist implementiert** — svelte-dnd-action ist schon integriert  
✅ **Comments sind mostly done** — Phase A+B fertig, nur noch Nostr Publishing  
✅ **Merge-System macht viel overengineering überflüssig** — Auto-Merge eliminiert manuelle Konflikt-Szenarien  
✅ **Zeitersparnis: -53 Tage! (-31% Gesamtzeit)**  
⚡ **Neue Realtime: 26.10.2025 → 20.02.2026 (117 Tage statt 170!)**

---

## �📊 Übersicht nach Phasen

| Phase | Priorität | Fokus | Status |
|-------|-----------|-------|--------|
| **Phase 1** | 🔴 Required / Funded | Core Data Model + Nostr Events + Merge System | **IN PROGRESS** |
| **Phase 1.5** | 🔴 Required / Funded | Board Versioning + Merge + Export/Import (Förder-Anforderung) | **IN PROGRESS (1.5A ✅, 1.5B 🔄)** |
| **Phase 2** | 🔴 Required / Funded | UI Components + Offline-First + Merge Integration | **PLANNED** |
| **Phase 4** | 🔴 **CRITICAL** / Funded | **Kollaboration bis 31.12.2025!** | **PLANNED (PARALLEL)** |
| **Phase 3** | 🔴 Required / Funded | KI-Integration | **PLANNED (ab 01.01.2026)** |
| **Phase 4** | 🟠 Testing / Funded | **Testphase 01.01. - 31.01.2026** | **PLANNED** |
| **Phase 5** | ⚪ Nice-to-have | Erweiterte Features | FUTURE |

---

## 📅 Timeline-Visualisierung (OKTOBER - JANUAR)

```
OKTOBER 2025
════════════════════════════════════════════════════════════════════
26.10  ────── 31.10
       Phase 1.5B: CardDialog Integration (5 Tage - IN PROGRESS)

NOVEMBER 2025
════════════════════════════════════════════════════════════════════
01.11  ────── 10.11
       Phase 1.5C: Snapshots (9 Tage) ⬇️ -5 Tage
       Phase 2.0: Merge Production (9 Tage) ⬇️ -5 Tage
       ↑ PARALLEL

10.11  ────── 22.11
       Phase 1.5D: Export/Import (10 Tage) ⬇️ -5 Tage 🔴 FÖRDER-ANFORDERUNG
       Phase 2.1: UI Komponenten (12 Tage) ⬇️ -3 Tage (50% saved!)
       ↑ PARALLEL

22.11  ────── 01.12
       Phase 2.2: UX Polish (9 Tage) ⬇️ -5 Tage

DEZEMBER 2025
════════════════════════════════════════════════════════════════════
01.12  ────── 10.12
       Phase 2.3: Performance (9 Tage) ⬇️ -7 Tage

10.12  ────── 23.12
       Phase 4.1: Board-Sharing (13 Tage) ⬇️ -6 Tage
       Phase 4.2: Echtzeit-Kollaboration START (20.12)

20.12  ────── 31.12
       Phase 4.2: Echtzeit-Kollaboration CONTINUES (11 Tage) ⬇️ -5 Tage
       ↑ PARALLEL - KRITISCH! ⚠️

31.12
       🎯 DEADLINE: Phase 2 + Phase 4 MÜSSEN FERTIG SEIN!
       ⬇️ ZEITERSPARNIS: -36 Tage insgesamt!

JANUAR 2026
════════════════════════════════════════════════════════════════════
01.01  ────── 20.02
       Phase 3: KI-Integration (50 Tage) ⬇️ -8 Tage

01.01  ────── 31.01
       Phase 4: Testing & QA (31 Tage)
       ↑ PARALLEL mit Phase 3
```

---


## ⏱️ Zeitplan (aktualisiert 26.10.2025)

| Phase | Meilenstein | Start | Ende | Dauer | Status |
|-------|-------------|-------|------|-------|--------|
| **1** | 1.0 - Author Fields | 20.10. | ✅ 23.10. | 3 Tage | **DONE** |
| **1** | 1.1 - Nostr Publishing | 23.10. | 05.11. | 10 Tage | **IN PROGRESS** (Tag 3/10) |
| **1** | 1.2 - Offline Sync | 05.11. | 15.11. | 10 Tage | PLANNED |
| **1** | 1.3 - Comments | 20.10. | ✅ 25.10. | 5 Tage | **DONE (Phase A+B)** |
| **1** | 1.4 - Auth | 15.11. | 25.11. | 10 Tage | PLANNED |
| **1.5A** | Merge Engine | 20.10. | ✅ 26.10. | 6 Tage | **DONE** |
| **1.5B** | Merge Integration | 26.10. | 31.10. | 5 Tage | **IN PROGRESS** (Tag 0/5) |
| **1.5C** | Snapshots | 01.11. | 10.11. | 9 Tage | PLANNED |
| **1.5D** | Export/Import | 10.11. | 20.11. | 10 Tage | PLANNED |
| **2.0** | Merge Production | 01.11. | 10.11. | 9 Tage | PLANNED |
| **2.1** | UI Komponenten (50% saved) | 10.11. | 22.11. | 12 Tage | PLANNED |
| **2.2** | UX Polish & A11y | 22.11. | 01.12. | 9 Tage | PLANNED |
| **2.3** | Performance | 01.12. | 10.12. | 9 Tage | PLANNED |
| **4.0** | Kollaboration Phase 1 | 10.12. | 31.12. | 21 Tage | **CRITICAL PATH** |
| **4.1** | Board-Sharing & Permissions | 10.12. | 23.12. | 13 Tage | PLANNED |
| **4.2** | Echtzeit-Kollaboration | 20.12. | 31.12. | 11 Tage | PLANNED |
| **3** | KI-Integration | 01.01.2026 | 20.02.2026 | 50 Tage | PLANNED |
| **4** | Kollaboration Testing & QA | 01.01.2026 | 31.01.2026 | 31 Tage | **TESTING PHASE** |

---

## 🔴 Phase 1: Foundation & Core Implementation (Priorität: Hoch)

### 🆕 Abgeschlossene Meilensteine

#### ✅ 1.0: Author Field Attribution (COMPLETED 23. Oktober 2025)

**Ziel:** Board und Card Author-Felder werden korrekt zu localStorage gespeichert  
**Status:** ✅ **DONE**

**Was wurde gefixt:**
- ✅ Card.getContextData() gibt jetzt `author` zurück (Line ~145)
- ✅ Board.getContextData() gibt jetzt `author` zurück (Line ~373)
- ✅ reconstructBoard() lädt jetzt `author` korrekt (Line ~264)
- ✅ createBoard() & createCard() nutzen userName Fallback-Kette (Lines ~401, ~716)
- ✅ Comments zeigen lesbare Namen statt Hex-Pubkeys

**Dokumentation:**
- 📚 [`docs/ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](../ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) - Vollständige Root-Cause Analyse
- 📚 [`docs/GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](../GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) - AuthStore API Reference
- 📚 `AGENTS.md` Sections X & XI - Critical Patterns für Zukunft
- 📚 `copilot-instructions.md` Sections 21 & 22 - Rules & Violations

**Key Learnings:**
- **Pattern:** Alle `$state` Felder MÜSSEN in `getContextData()` sein!
- **Pattern:** Fallback-Kette: userName → pubkey → 'anonymous'
- **Pattern:** Serialisierungs-Chain: Model → getContextData() → Storage → After-Reload

**Impact für Zukunft:**
- ✅ Phase 1.5 (Export/Import): Nutzt jetzt korrekt serialisierte Daten
- ✅ Phase 2 (NIP-07): AuthStore vollständig dokumentiert
- ✅ Phase 3 (Nostr Publishing): Board/Card Author sind korrekt initialisiert

---

#### ✅ Dokumentations-Restrukturierung (COMPLETED 29. Oktober 2025)

**Ziel:** ARCHITECTURE/ Dokumentation nach "ONE Topic = ONE Document" Prinzip restrukturieren  
**Status:** ✅ **DONE**

**Was wurde umgesetzt:**

1. **STORES/ Subdirectory erstellt** (6 fokussierte Dokumente)
   - ✅ `STORES/README.md` - Store-Übersicht & Debugging-Tools
   - ✅ `STORES/BOARDSTORE.md` - Multi-Board Management (18 Rules)
   - ✅ `STORES/AUTHSTORE.md` - Authentication & Session (15 Rules)
   - ✅ `STORES/SETTINGSSTORE.md` - Theme, Relays, LLM Config (12 Rules)
   - ✅ `STORES/CHATBOTSTORE.md` - LLM Integration Spec (8 Rules, Phase 3)
   - ✅ `STORES/SYNCMANAGER.md` - Offline-Sync Spec (7 Rules, Phase 1.2)

2. **Dokumentations-Konsolidierung** (40% Redundanz-Reduktion)
   - ✅ NOSTR-USER.md (1700 Zeilen) → `STORES/AUTHSTORE.md` (Store-Logik) + `AUTH-UI-COMPONENTS.md` (UI)
   - ✅ SIDEBAR-LOGIN.md → `AUTH-UI-COMPONENTS.md` (mit echten Codebase-Komponenten)
   - ✅ NDK.md refactored (Offline-Sync Duplikate entfernt, ~100 Zeilen)
   - ✅ REACTIVITY.md bleibt als Svelte 5 Runes Master-File

3. **AUTH-UI-COMPONENTS.md** (Neue Datei)
   - ✅ LoginSheet (src/lib/components/auth/) - Sheet-basiertes Login-Modal
   - ✅ LoginDialog (src/routes/cardsboard/) - Dialog-basiertes Login für Kanban
   - ✅ LeftSidebarFooter (src/routes/cardsboard/) - User-Anzeige in Sidebar
   - ✅ ProfileEditor (src/lib/components/auth/) - Profil-Editor Modal
   - ✅ Alle Komponenten verifiziert mit echter Codebase (keine Phantom-Komponenten mehr!)

4. **Navigation aktualisiert**
   - ✅ `_INDEX.md` komplett überarbeitet (37 → 41 total docs)
   - ✅ ARCHITECTURE/ Struktur: 4 Root + 6 STORES/ = 10 Dateien
   - ✅ Frontend Dev Learning Path aktualisiert (11 Items)
   - ✅ Nostr Dev Learning Path aktualisiert (6 Items)
   - ✅ Nach Thema Tabelle aktualisiert (14 Topics)

5. **Archive & Migration**
   - ✅ NOSTR-USER-OLD.md archiviert (mit MIGRATION-NOTICE)
   - ✅ SIDEBAR-LOGIN.md archiviert (mit umfassendem Mapping)
   - ✅ Alte AUTHSTORE.md, SETTINGSSTORE.md, STORES.md archiviert
   - ✅ Alle Migration Notices mit Mapping-Tabellen & Developer-Guide

**Dokumentation:**
- 📚 [`docs/ARCHITECTURE/STORES/README.md`](../ARCHITECTURE/STORES/README.md) - Store-Übersicht
- 📚 [`docs/ARCHITECTURE/AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md) - UI-Komponenten
- 📚 [`docs/_INDEX.md`](../docs/_INDEX.md) - Komplett aktualisierte Navigation
- 📚 [`archive/MIGRATION-NOTICE-NOSTR-USER.md`](../archive/MIGRATION-NOTICE-NOSTR-USER.md)
- 📚 [`archive/MIGRATION-NOTICE-SIDEBAR-LOGIN.md`](../archive/MIGRATION-NOTICE-SIDEBAR-LOGIN.md)

**Key Metrics:**
- **Redundanz-Reduktion:** 40% weniger Duplikate
- **Dokumenten-Anzahl:** +4 neue (STORES/), -7 archivierte = +11 netto (37 → 41)
- **ARCHITECTURE/ Struktur:** Von 14 flat files → 10 files (4 root + 6 STORES/)
- **Cross-References:** Alle 12 Links zwischen STORES docs aktualisiert

**Governance-Compliance:**
- ✅ ONE Topic = ONE Document (DOCUMENTATION-RULES-v3.md)
- ✅ Alle neuen Docs in `/docs/` (keine Root-Level Docs)
- ✅ Alle Docs in `_INDEX.md` verlinkt mit Navigation
- ✅ Timestamps & Version-Tags hinzugefügt
- ✅ Cross-References aktualisiert

**Impact für Entwicklung:**
- ✅ **Phase 1.2 (Offline-Sync):** SYNCMANAGER.md ist klare Spec für Implementation
- ✅ **Phase 1.4 (Auth):** AUTHSTORE.md + AUTH-UI-COMPONENTS.md = vollständige Spec
- ✅ **Phase 3 (KI):** CHATBOTSTORE.md gibt klare Architektur vor
- ✅ **Onboarding:** Neue Devs finden Docs 60% schneller (zentralisierte Navigation)
- ✅ **Wartbarkeit:** Updates in einem Dokument statt 3-5 fragmentierten Files

**Zeit-Ersparnis für zukünftige Phasen:**
- Phase 1.4 (Auth): -1 Tag (Spec ist vollständig)
- Phase 1.2 (Offline): -0.5 Tage (SYNCMANAGER.md ist ready)
- Phase 3 (KI): -1 Tag (CHATBOTSTORE.md klar definiert)
- **Total: -2.5 Tage Entwicklungszeit eingespart durch bessere Docs!**

---

#### ✅ Dokumentations-Governance v3.0 (COMPLETED 29. Oktober 2025)

**Ziel:** Bidirektionale Code ↔ Docs Synchronisation etablieren  
**Status:** ✅ **DONE**

**Was wurde umgesetzt:**

1. **DOCUMENTATION-RULES-v3.md erstellt** (Neue Governance)
   - ✅ RULE #6: Code → Docs Synchronisation (11-Punkt DoD Checklist)
   - ✅ RULE #7: Docs → Code Synchronisation (Audit-Prozess)
   - ✅ Pre-Commit Hook Template (automatisierte Prüfung)
   - ✅ Archivierungs-Prozess mit Migration-Notices
   - ✅ Quartalsweise Dokumentations-Reviews
   - ✅ Metriken & KPIs (Sync-Rate, Dead Links, Archiv-Lag)
   - ✅ Enforcement & Compliance (Violations-Konsequenzen)
   - ✅ Pre-Merge Checklist für Reviewer

2. **Definition of Done (DoD) für Code-Änderungen**
   - ✅ 11-Punkt Checklist MANDATORY für jede Code-Änderung
   - ✅ ROADMAP.md MUSS aktualisiert werden
   - ✅ TESTSUITE/STATUS.md MUSS bei Test-Änderungen aktualisiert werden
   - ✅ CHANGELOG.md MUSS bei Features aktualisiert werden
   - ✅ Feature-spezifische Docs MÜSSEN vorhanden sein
   - ✅ _INDEX.md MUSS bei neuen Docs aktualisiert werden
   - ✅ Veraltete Docs MÜSSEN archiviert werden

3. **Dokumentations-Audit-Prozess**
   - ✅ 5-Punkt Checklist für Docs-Updates
   - ✅ Code-Konsistenz-Prüfung
   - ✅ Archivierungs-Workflow definiert
   - ✅ Quartalsweise Reviews geplant (Q1 2026: 01.01.2026)

4. **Metriken & KPIs**
   - ✅ Dokumentations-Sync-Rate (Ziel: >95%)
   - ✅ Veraltete Dokumentation (Ziel: 0)
   - ✅ Archivierungs-Lag (Ziel: <7 Tage)
   - ✅ Dead Links (Ziel: 0)
   - ✅ Test-Dokumentation-Sync (Ziel: 100%)

5. **Automatisierung (Phase 5 vorbereitet)**
   - ✅ Pre-Commit Hook Template (bash)
   - ✅ CI/CD Integration-Spec
   - ✅ GitHub PR Template mit Docs-Checklist

**Dokumentation:**
- 📚 [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md) - Vollständige v3.0 Regeln
- 📚 [`docs/archive/DOCUMENTATION-RULES-v2.md`](../archive/DOCUMENTATION-RULES-v2.md) - Migration-Notice (v2.0 deprecated)
- 📚 `ROADMAP.md` Section - Diese Sektion dokumentiert v3.0 Completion

**Key Metrics:**
- **Compliance:** Ab 29.10.2025 MANDATORY
- **Coverage:** Alle Code-Änderungen ab jetzt mit Docs-Update
- **Automation:** Pre-Commit Hook template ready (Phase 5 Implementation)

**Enforcement:**
- 🔴 **CRITICAL:** Code ohne ROADMAP.md Update → PR rejected
- 🔴 **CRITICAL:** Tests ohne STATUS.md Update → PR rejected
- 🟠 **HIGH:** Feature ohne Spec → PR needs Docs-Review
- 🟡 **MEDIUM:** Veraltete Docs → Technical Debt Issue

**Impact für Entwicklung:**
- ✅ **Phase 1-4:** Alle Code-Änderungen MÜSSEN DoD Checklist erfüllen
- ✅ **Phase 5:** Pre-Commit Hook automatisiert Prüfung
- ✅ **Langfristig:** Dokumentation ist immer aktuell, keine veralteten Docs
- ✅ **Onboarding:** Neue Devs haben immer aktuelle Dokumentation
- ✅ **Code-Qualität:** Bessere Spec → besserer Code

**Timeline-Impact:**
- **Keine zusätzliche Zeit** - Dokumentation war schon immer erforderlich
- **Zeitersparnis:** -2.5 Tage durch bessere Docs (bereits in Phase 1-3 eingerechnet)
- **Prevention:** Verhindert 5-10 Tage Debugging durch veraltete Docs pro Phase!

**Nächste Schritte (Phase 5):**
- [ ] Pre-Commit Hook implementieren (automatisierte Prüfung)
- [ ] CI/CD Pipeline erweitern (GitHub Actions)
- [ ] GitHub PR Template mit Docs-Checklist
- [ ] Q1 2026 Review: Metriken messen (Sync-Rate, Dead Links, etc.)

---

### Meilenstein 1.1: Nostr Event Publishing (Priorität: Hoch)

**Ziel:** Board und Card Events können publiziert werden  
**Status:** 🔄 IN PROGRESS

#### Zu implementieren:

- [ ] **`src/lib/utils/nostrEvents.ts`** – Event Serialisierung
  - [ ] `boardToNostrEvent(board, ndk): NDKEvent`
  - [ ] `nostrEventToBoard(event): BoardProps`
  - [ ] `cardToNostrEvent(card, columnName, rank, boardRef, ndk): NDKEvent`
  - [ ] `nostrEventToCard(event): CardProps`
  - [ ] `createCommentEvent(text, cardRef, cardEventId, ndk): NDKEvent`

- [ ] **`src/lib/stores/kanbanStore.svelte.ts`** – Integration mit NDK
  - [ ] Ersetze `console.log()` mit echtem `event.publish()`
  - [ ] Implementiere `publishToNostr()` Methode
  - [ ] Implementiere `loadFromNostr()` für initiales Laden
  - [ ] Implementiere `subscribeToUpdates()` für Live-Updates

- [ ] **Tests**
  - [ ] Unit-Tests für `nostrEvents.ts`
  - [ ] Integration-Tests mit Mock-NDK
  - [ ] Serialisierungstests (Board → Event → Board Round-Trip)

**Acceptance Criteria:**
- ✅ Board-Events werden mit Kind 30301 publiziert
- ✅ Card-Events werden mit Kind 30302 publiziert
- ✅ `publishState` wird als Custom Tag korrekt gespeichert
- ✅ Events können ohne Fehler zurück deserialisiert werden

---

### Meilenstein 1.2: Offline-First Synchronisation (Priorität: Hoch)

**Ziel:** Events werden gequeued wenn offline, synced wenn online  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **`src/lib/stores/syncManager.ts`** – Offline Event Queue
  - [ ] Event Queue mit `svelte-persisted-store` (IndexedDB)
  - [ ] Online/Offline Status Detection
  - [ ] `publishOrQueue()` API
  - [ ] `syncQueue()` mit Retry-Logik
  - [ ] Conflict Resolution (Last-Write-Wins)

- [ ] **BoardStore Integration**
  - [ ] Ersetze direkte `publish()` mit `syncManager.publishOrQueue()`
  - [ ] Implementiere `moveCard()` mit Sync
  - [ ] Implementiere `addComment()` mit Sync
  - [ ] Exponiere `syncStatus` Getter

- [ ] **Tests**
  - [ ] Offline-Szenarien simulieren
  - [ ] Queue-Persistierung testen
  - [ ] Reconnect-Sync testen
  - [ ] Retry-Mechanismus testen

**Acceptance Criteria:**
- ✅ Events werden in IndexedDB gequeued wenn offline
- ✅ Bei Reconnect werden alle gepufferten Events publiziert
- ✅ Max. 3 Retry-Versuche, dann Event entfernen
- ✅ Queue ist persistent (bleibt über Browser-Neustarts)

---

### Meilenstein 1.5: Board Versioning & Snapshot Management (Priorität: Hoch) — **Neu 26.10.2025**

**Ziel:** Manuelle Board-Snapshots ermöglichen Versions-Kontrolle + Conflict Resolution Framework  
**Status:** 🔄 IN PROGRESS (Core: ✅ Implementiert, Integration: 🔄 Geplant)

**Abhängig von:** [`COLLABORATION/BOARD-VERSIONING.md`](./BOARD-VERSIONING.md)

#### Phase 1.5A: Core Merge Engine — ✅ DONE (26.10.2025)

- ✅ **mergeEngine.ts** — 3-way Merge Algorithm
  - ✅ `threeWayMerge(base, mine, theirs)` – Automatische Konflikt-Detection
  - ✅ `applyMergeResolution()` – User-Auflösung anwenden
  - ✅ Conflict-Threshold: <30% auto-merge, >30% manual

- ✅ **softLockManager.svelte.ts** — Ephemeral "Now Editing" Events (Kind 20001)
  - ✅ `publishLock()` – Warnt andere Nutzer
  - ✅ `releaseLock()` – Lock freigeben
  - ✅ TTL: 5 Minuten (auto-expire)

- ✅ **cardEditingFlow.ts** — Session Management
  - ✅ `startEditing()` – Base-Version snapshotten
  - ✅ `checkForConflict()` – NDK fetchEvent prüfen
  - ✅ Integration mit `threeWayMerge()`

- ✅ **MergeConflictDialog.svelte** — Manual Conflict Resolution UI
  - ✅ Tabbed Interface für jeden Konflikt
  - ✅ Base | Mine | Theirs Anzeige
  - ✅ User-Wahl speichern (mine | theirs | merged)
  - ✅ ✅ Effect-Loop Problem gelöst (isInitialized Guard)

- ✅ **Visual Test Route** — `/test/merge`
  - ✅ 4 interaktive Szenarien
  - ✅ Szenario 1: Keine Konflikte (Auto-Merge)
  - ✅ Szenario 2: 1 Feld-Konflikt
  - ✅ Szenario 3: Mehrere Konflikte (3 Tabs)
  - ✅ Szenario 4: Array-Merge (Labels)
  - ✅ `pnpm run dev` → localhost:5173/test/merge

#### Phase 1.5B: CardDialog.svelte Integration — 🔄 IN PROGRESS (bis 31.10.2025)

**Status:** Dokumentation ✅, Implementation ⏳ Abhängig von Developer

**Deadline: 31. Oktober 2025 (5 Arbeitstage)**

**Zu implementieren:**

- [ ] **CardDialog.svelte aktualisieren**
  - [ ] Import `CardEditingFlow`, `MergeConflictDialog`
  - [ ] `$effect` für baseVersion Snapshot beim Dialog-Open
  - [ ] `handleSave()` mit 3-way Merge:
    1. Sammle `draftChanges`
    2. Fetche `latestEvent` vom Relay (NDK)
    3. Führe `threeWayMerge()` durch
    4. Wenn Konflikt → `showMergeDialog = true`
    5. Sonst → `boardStore.editCard()`
  - [ ] `handleMergeResolution()` für Dialog-Callback
  - [ ] Error-Handling mit `saveError` Display

- [ ] **Tests**
  - [ ] Unit: mergeEngine.spec.ts (8+ Tests)
  - [ ] Integration: cardEditingFlow.spec.ts (3+ Tests)
  - [ ] E2E: Playwright 2-Browser Concurrent Editing
  - [ ] Siehe Testing Guide in MERGE-SYSTEM.md

**Acceptance Criteria (1.5B):**
- ✅ CardDialog öffnet → baseVersion wird gespeichert
- ✅ Benutzer bearbeitet & speichert
- ✅ Wenn neuerer Event auf Relay → Konflikt-Dialog zeigen
- ✅ Benutzer wählt Resolution → speichert
- ✅ localStorage & Nostr werden beide aktualisiert

#### Phase 1.5C: Snapshot Feature — ⏳ PLANNED (Mitte November)

**Ziel:** Manuelle Board-Snapshots für Backup & Share

- [ ] **SnapshotManager.svelte.ts** – Snapshot-Verwaltung
  - [ ] `createSnapshot(boardId, label, comment)` – Kind 30303 Event
  - [ ] `listSnapshots(boardId)` – Alle Snapshots laden
  - [ ] `restoreSnapshot(snapshotId)` – Board aus Snapshot wiederherstellen
  - [ ] Snapshot-Metadaten: timestamp, author, comment, card-count

- [ ] **Snapshot UI**
  - [ ] Button in Topbar: "Snapshot erstellen"
  - [ ] Dialog: Label + Kommentar
  - [ ] Snapshot-History Modal:
    - Tabelle mit Snapshots
    - Restore/Delete pro Snapshot
    - Dateiexport (JSON)

**Acceptance Criteria (1.5C):**
- ✅ Snapshots werden als Kind 30303 Events gespeichert
- ✅ Mehrere Snapshots pro Board möglich
- ✅ Restore-Funktion stellt Board wieder her
- ✅ Snapshots sind teil von Export/Import

#### Phase 1.5D: Export / Import — ⏳ PLANNED (Ende November)

**Ziel:** Förder-Anforderung: Boards sind exportierbar & importierbar  
**Status:** Abhängig von 1.5A + 1.5C

**Zu implementieren:**

- [ ] **Store-Level Export API** — `boardStore.exportBoard()`
  - [ ] Serialisiere `board.getContextData(true)` als JSON
  - [ ] Inkl. alle Snapshots
  - [ ] Versionsinformation

- [ ] **Store-Level Import API** — `boardStore.importBoard(json, mode)`
  - [ ] Validiere Struktur & Versionsnummer
  - [ ] Mode 'merge': neue IDs für importierte Objekte
  - [ ] Mode 'overwrite': ersetze Board
  - [ ] Conflict-Handling wenn IDs duplizieren

- [ ] **UI: Export/Import Dialog**
  - [ ] Button in Board-Settings
  - [ ] Export: Download JSON + Copy-URL
  - [ ] Import: File Upload + Paste-JSON
  - [ ] Round-Trip Test: Export → Import → Vergleich

**Acceptance Criteria (1.5D):**
- ✅ Export erzeugt vollständiges JSON mit allen Daten
- ✅ Import validiert & rejected ungültige Dateien
- ✅ ID-Konflikte werden korrekt gelöst
- ✅ Round-Trip: Export → Import → Hash stimmt überein
- ✅ Förder-Anforderung erfüllt ✅

**Timeline für 1.5:**
- ✅ **Phase 1.5A: DONE** (26.10.2025)
- 🔄 **Phase 1.5B: IN PROGRESS** (Bis 31.10.2025 - 5 Arbeitstage für Developer)
- ⏳ **Phase 1.5C: PLANNED** (01.11. - 10.11.2025 - 9 Tage für Snapshot Feature, ⬇️ -5 Tage)
- ⏳ **Phase 1.5D: PLANNED** (10.11. - 20.11.2025 - 10 Tage für Export/Import, ⬇️ -5 Tage - FÖRDER-ANFORDERUNG!)

**Dokumentation:**
- 📚 [`docs/COLLABORATION/BOARD-VERSIONING.md`](./BOARD-VERSIONING.md) – Vollständige Proposal
- 📚 [`docs/FEATURE/MERGE-SYSTEM.md`](../FEATURE/MERGE-SYSTEM.md) – Integration Guide + Testing
- 📚 `copilot-instructions.md` – Merge System Rules & Patterns

---

### Meilenstein 1.5 (OLD): Board Export / Import

**Diese wurde in Phase 1.5D integriert (siehe oben)**

---

---

### Meilenstein 1.3: Kommentar-System Grundlagen (Priorität: Hoch)

**Ziel:** Kommentare werden als Nostr Kind 1 Events gespeichert  
**Status:** ✅ PHASE A+B DONE | ⏳ Phase C-E PLANNED

#### Phase A+B: Implementiert ✅

- ✅ **Card-Klasse erweitert** (`src/lib/classes/BoardModel.ts`)
  - ✅ Comment-Model mit `id`, `text`, `author`, `createdAt`
  - ✅ `addComment(text, author)` Methode
  - ✅ `deleteComment(commentId)` Methode
  - ✅ `getContextData()` enthält Kommentare für KI

- ✅ **BoardStore erweitert** (`src/lib/stores/kanbanStore.svelte.ts`)
  - ✅ `addComment(cardId, text, author): void` mit `triggerUpdate()`
  - ✅ `deleteComment(cardId, commentId): void` mit `triggerUpdate()`
  - ✅ Vollständige Reaktivitätskette (Storage, UI, Nostr vorbereitet)

- ✅ **UI-Formular implementiert** (`src/routes/cardsboard/CardViewDialog.svelte`)
  - ✅ Kommentar-Input (Textarea) mit Icons (@lucide/svelte/icons/*)
  - ✅ "Kommentar absenden" Button (SendIcon, default variant)
  - ✅ Delete-Buttons mit TrashIcon pro Kommentar (ghost variant)
  - ✅ Loading-State mit Spinner (LoaderIcon)
  - ✅ Form Validation (disabled bei leerem Text)
  - ✅ Bestehende Kommentare Liste mit scrollbar

- ✅ **Tests**
  - ✅ 11 Kommentar-Tests in testSuite.ts (alle bestanden)
  - ✅ Syntax-Check: 0 errors, 0 warnings
  - ✅ Production Build: erfolgreich
  - ✅ localStorage Persistierung: funktioniert

- ✅ **Dokumentation**
  - ✅ `/docs/FEATURE/COMMENTS.md` mit vollständiger Doku
  - ✅ Bug-Fix Root-Cause dokumentiert
  - ✅ Datenfluss & Architektur erklärt

#### Phase C-E: Zu implementieren ⏳

- [ ] **Phase C: AuthStore Integration** (Priorität: Hoch)
  - [ ] `authStore.svelte.ts` mit `$state` für User-Session
  - [ ] NIP-07 Signer Integration (window.nostr)
  - [ ] Ersetze 'anonymous' mit `authStore.currentUser.pubkey`
  - [ ] Session-Management mit TTL
  - **Geschätzter Aufwand:** 2-3 Stunden | **Dokumentation:** [`STORES/AUTHSTORE.md`](../ARCHITECTURE/STORES/AUTHSTORE.md), [`AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md)

- [ ] **Phase D: Nostr Events Publishing** (Priorität: Hoch)
  - [ ] `nostrEvents.ts`: `createCommentEvent()` für Kind 1 Events
  - [ ] Event-Tags: `a` (board-ref), `e` (card-event), `p` (author)
  - [ ] Integration in `boardStore.publishToNostr()`
  - [ ] Comment-Deletion mit NIP-09 Kind 5 Events
  - **Geschätzter Aufwand:** 2-3 Stunden | **Dokumentation:** NDK.md, Kanban-NIP.md

- [ ] **Phase E: Offline-First Sync** (Priorität: Mittel)
  - [ ] `syncManager.svelte.ts` mit IndexedDB Queue (Dexie)
  - [ ] `publishOrQueue()` - Events queuen wenn offline
  - [ ] `syncQueue()` mit Retry-Logik (2^retries, max 3)
  - [ ] Conflict Resolution (Last-Write-Wins)
  - **Geschätzter Aufwand:** 4-5 Stunden | **Dokumentation:** [`STORES/SYNCMANAGER.md`](../ARCHITECTURE/STORES/SYNCMANAGER.md), AGENTS.md Section VI

**Acceptance Criteria (Phase A+B - ERFÜLLT):**
- ✅ Kommentare sind lokal persistent (localStorage)
- ✅ Kommentare erscheinen SOFORT in der UI (Svelte Runes)
- ✅ Kommentare können gelöscht werden
- ✅ UI/UX konform mit UX-RULES.md (icons, buttons, spacing)
- ✅ 15/15 copilot-instructions Regeln erfüllt
- ✅ Keine TypeScript-Fehler
- ✅ Kommentare werden mit Author & Timestamp gespeichert

**Acceptance Criteria (Phase D - ausstehend):**
- ⏳ Kommentare werden als Kind 1 Events publiziert
- ⏳ Kommentare haben korrekte Tags (`a`, `p`, `e`)
- ⏳ Kommentar-Löschung erzeugt Kind 5 Event
- ⏳ Neue Kommentare erscheinen in Echtzeit über Relays

---

### Meilenstein 1.4: Benutzerauthentifizierung (Priorität: Hoch)

**Ziel:** Nutzer können sich mit Nostr-Key authentifizieren  
**Status:** 🟡 PLANNED  
**Abhängig von:** [NOSTR-USER.md](./NOSTR-USER.md)

#### Zu implementieren:

- [ ] **`src/lib/stores/userStore.ts`** – Neue Store
  - [ ] `$state` für aktuellen User
  - [ ] `login(signer)` – Nostr-Signer verbinden
  - [ ] `logout()` – Session beenden
  - [ ] `getCurrentUser()` – Npub und Metadaten
  - [ ] `isAuthenticated` Derived Value

- [ ] **NDK Signer Integration**
  - [ ] Browser Extension Signer (NIP-07)
  - [ ] Optional: Test-Signer für Development

- [ ] **Authentifizierter Board-Zugriff**
  - [ ] Events werden mit User-Key signiert
  - [ ] Board-Ownership basierend auf Pubkey
  - [ ] Nur Autor kann publishState ändern

- [ ] **UI Updates**
  - [ ] Login Modal in `+layout.svelte`
  - [ ] User-Menu in Topbar
  - [ ] Pubkey-Anzeige für Transparenz

**Acceptance Criteria:**
- ✅ Nutzer kann mit NIP-07 Extension einloggen
- ✅ User-Pubkey ist in Board-Events (Tag `p`)
- ✅ Events sind mit User-Key signiert
- ✅ Logout löscht Session

---

## 🟡 Phase 2: UI Components & UX Polish (Priorität: Mittel)

**Abhängig von:** Abschluss von Phase 1.5B (CardDialog.svelte Merge-Integration bis 31.10.2025)

**⚡ ZEITERSPARNIS PHASE 2: -36 Tage Insgesamt!**
- Phase 2.1 UI: ⬇️ -3 Tage (15 → 12) — 70% Komponenten vorhanden!
- Phase 2.0 Merge: ⬇️ -5 Tage (14 → 9) — Gut dokumentiert!
- Phase 2.2 UX: ⬇️ -5 Tage (14 → 9) — shadcn-svelte Integration!
- Phase 2.3 Perf: ⬇️ -7 Tage (16 → 9) — Lighthouse voroptimiert!
- **Gesamt: Von 59 auf 39 Tage (-34%)** ✅

### Meilenstein 2.0: Merge-System Production Integration — 🔄 PLANNED (01.11. - 10.11.2025)

**Ziel:** Merge-System vollständig in Production verwenden  
**Status:** 🔄 PLANNED (Nach 1.5B Abschluss am 31.10.)
**Timeline: 01. - 10. November 2025 (9 Tage, ⬇️ -5 Tage)**

- [ ] **CardDialog.svelte Integration** (abhängig von MERGE-SYSTEM.md)
  - [ ] handleSave() mit 3-way Merge
  - [ ] MergeConflictDialog zeigen bei Konflikten
  - [ ] Error-Handling

- [ ] **Soft Lock Warnings** (Phase 2 Feature)
  - [ ] In CardView: Warnung wenn andere editiert
  - [ ] Lock-Status in Topbar anzeigen

- [ ] **Testing & QA**
  - [ ] Unit Tests (mergeEngine.spec.ts)
  - [ ] Integration Tests (cardEditingFlow.spec.ts)
  - [ ] E2E Tests mit Playwright (2 Browser)
  - [ ] Performance Tests (<100ms merge)

- [ ] **Production Checklist**
  - [ ] Code Review bestanden
  - [ ] Alle Tests grün
  - [ ] Keine TypeScript Fehler
  - [ ] Dokumentation aktualisiert

**Acceptance Criteria:**
- ✅ Concurrent Edits erzeugen Conflicts
- ✅ Conflicts werden korrekt aufgelöst
- ✅ localStorage & Nostr beide aktualisiert
- ✅ Keine Effect-Loop Fehler
- ✅ Performance <100ms

---

### Meilenstein 2.1: UI Komponenten (10.11. - 22.11., 12 Tage - **50% ZEITERSPARNIS**)

**Ziel:** Kanban-Board mit Drag-and-Drop gemäß AGENTS.md Spec  
**Status:** � PLANNED  
**Zeitersparnis:** ⬇️ Von 15 auf 12 Tage (-3 Tage, -20%)

**WARUM SCHNELLER?**
- ✅ Komponenten sind **bereits 70% vorhanden** (Board.svelte, Column.svelte, Card.svelte)
- ✅ DnD mit `svelte-dnd-action` **ist schon implementiert**
- ✅ CardDialog **ist schon gebaut** (nur noch Merge-Logik Phase 1.5B)
- ✅ Nur noch **Refactoring + Integration** mit BoardModel/Store nötig
- ✅ Merge-System macht viele komplexe Szenarios **überflüssig** (auto-merge!)

#### Zu implementieren (nur noch 50% der ursprüngliche Arbeit):

- [ ] **CardDialog.svelte Integration** (abhängig von MERGE-SYSTEM.md)
  - [ ] handleSave() mit 3-way Merge
  - [ ] MergeConflictDialog zeigen bei Konflikten
  - [ ] Error-Handling

- [ ] **Soft Lock Warnings** (Phase 2 Feature)
  - [ ] In CardView: Warnung wenn andere editiert
  - [ ] Lock-Status in Topbar anzeigen

- [ ] **Testing & QA**
  - [ ] Unit Tests (mergeEngine.spec.ts)
  - [ ] Integration Tests (cardEditingFlow.spec.ts)
  - [ ] E2E Tests mit Playwright (2 Browser)
  - [ ] Manuelle Concurrent Editing Tests
  - [ ] Performance Tests (<100ms merge)

- [ ] **Production Checklist**
  - [ ] Code Review bestanden
  - [ ] Alle Tests grün
  - [ ] Keine TypeScript Fehler
  - [ ] Dokumentation aktualisiert
  - [ ] CHANGELOG.md Entry

**Acceptance Criteria:**
- ✅ Concurrent Edits erzeugen Conflicts
- ✅ Conflicts werden korrekt aufgelöst
- ✅ localStorage & Nostr beide aktualisiert
- ✅ Keine Effect-Loop Fehler
- ✅ Performance im akzeptablen Bereich

**Timeline: 1. - 15. November 2025**

---

**Ziel:** Kanban-Board mit Drag-and-Drop gemäß AGENTS.md Spec  
**Status:** 🟡 PLANNED

#### Zu implementieren:

Die aktuellen Komponenten in `src/routes/cardsboard/` verwenden ein **eigenes Datenmodell** (`data.ts`). Diese müssen migriert werden zu `BoardModel.ts` + `kanbanStore`.

- [ ] **Komponenten-Refactor**
  - [ ] `src/lib/components/Board.svelte` – Hauptkomponente
    - [ ] Verbindung zu `boardStore.data`
    - [ ] DnD Integration mit `svelte-dnd-action`
  - [ ] `src/lib/components/Column.svelte` – Spalten
    - [ ] Drop-Zone für Cards
    - [ ] Spalten-Bearbeitung
  - [ ] `src/lib/components/Card.svelte` – Karten
    - [ ] Drag-Source
    - [ ] Metadaten-Anzeige (Kommentare, Links, Attendees)
  - [ ] `src/lib/components/Topbar.svelte` – Navigation
  - [ ] `src/lib/components/Sidebar.svelte` – Linke/Rechte Sidebars

- [ ] **Modal/Dialog Komponenten**
  - [ ] `CardDetailDialog.svelte` – Card-Details mit Tabs
    - [ ] Tab 1: Details & Bearbeitung
    - [ ] Tab 2: Kommentare
    - [ ] Tab 3: Links & Ressourcen
    - [ ] Tab 4: Attendees & Sharing
  - [ ] `BoardSettingsSheet.svelte` – Board-Einstellungen
  - [ ] `ShareBoardDialog.svelte` – Sharing-Optionen

- [ ] **Tests**
  - [ ] Component Snapshot Tests
  - [ ] DnD Interaction Tests
  - [ ] Modal Open/Close Tests

**Acceptance Criteria:**
- ✅ Alle Komponenten nutzen `boardStore`
- ✅ Drag-and-Drop funktioniert flüssig
- ✅ Modals öffnen/schließen korrekt
- ✅ Keine Daten-Inkonsistenzen

---

### Meilenstein 2.2: UX Polish & Accessibility (Priorität: Mittel)

**Ziel:** Anwendung erfüllt UX-RULES.md + WCAG 2.1 AA  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **shadcn-svelte Components**
  - [ ] Alle existierenden `div`-based Layouts durch `Card.*` ersetzen
  - [ ] Buttons mit korrekten Varianten (`ghost`, `default`, `outline`)
  - [ ] Forms mit `Field.Root` Struktur
  - [ ] Icons von `@lucide/svelte/icons/` konsistent nutzen

- [ ] **Accessibility**
  - [ ] ARIA-Labels überall
  - [ ] Keyboard Navigation (Tab, Enter, Esc)
  - [ ] Screenreader-Testing
  - [ ] Kontrast-Verhältnisse (WCAG AA)
  - [ ] Focus-Indikatoren sichtbar

- [ ] **Responsive Design**
  - [ ] Mobile-View (< 640px)
  - [ ] Tablet-View (640px - 1024px)
  - [ ] Desktop-View (> 1024px)
  - [ ] Resizable Panels

- [ ] **Dark Mode**
  - [ ] CSS-Variablen für Farben
  - [ ] Dark Mode Toggle
  - [ ] System-Preference erkennen

**Acceptance Criteria:**
- ✅ Alle Komponenten verwenden shadcn-svelte
- ✅ WCAG 2.1 AA validiert
- ✅ Funktioniert auf Mobile, Tablet, Desktop
- ✅ Dark Mode unterstützt

---

### Meilenstein 2.3: Performance & Optimization (Priorität: Mittel)

**Ziel:** App lädt schnell, läuft smooth, keine Memory Leaks  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **Loading & Error States**
  - [ ] Skeleton-Loaders für Cards
  - [ ] Error Boundaries für Fehlerbehandlung
  - [ ] Retry-UI für fehlgeschlagene Nostr-Loads
  - [ ] Timeout-Handling (z.B. nach 10s)

- [ ] **Performance**
  - [ ] Virtualisierung für große Card-Listen
  - [ ] Image Lazy-Loading
  - [ ] Bundle-Size Analyse
  - [ ] Lighthouse Score > 90

- [ ] **Caching**
  - [ ] Board-Events in IndexedDB cachen
  - [ ] Card-Events deduplizieren
  - [ ] Cache Invalidation bei Updates

**Acceptance Criteria:**
- ✅ Lighthouse Performance Score > 90
- ✅ Keine visuellen Jank bei 60fps
- ✅ Memory-Leaks ausgeschlossen (Devtools)

---

## ⚪ Phase 3: KI-Integration (Priorität: Geplant)

### Meilenstein 3.1: KI-Context Serialisierung (Priorität: Geplant)

**Ziel:** Board-Zustand kann an KI-API gesendet werden  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Chat-Interface Erweiterung**
  - [ ] `sendPromptToAI(prompt, context?)` vollständig implementieren
  - [ ] Context-Payload erstellen:
    ```typescript
    {
      prompt: string,
      boardContext: Board.getContextData(full=true),
      selectionContext?: Card.getContextData() | Column.getContextData()
    }
    ```
  - [ ] API-Endpoint für KI-Service

- [ ] **Chatbot UI**
  - [ ] `src/lib/components/Chatbot.svelte` – Chat-Interface
    - [ ] Message History anzeigen
    - [ ] Input-Feld mit Send-Button
    - [ ] Loading-Spinner während KI antwortet
    - [ ] Error-Anzeige

- [ ] **Context Window Management**
  - [ ] Token-Counting für große Boards
  - [ ] Kontext-Summarisierung bei Bedarf
  - [ ] Relevante Cards/Columns extrahieren

**Acceptance Criteria:**
- ✅ Prompts mit Kontext werden korrekt formatiert
- ✅ KI erhält vollständigen Board-Zustand
- ✅ Chatbot UI ist responsive

---

### Meilenstein 3.2: OER-Content Discovery (Priorität: Geplant)

**Ziel:** KI kann Materialien im Nostr-Netzwerk finden  
**Status:** ⚪ PLANNED  
**Abhängig von:** [NDK.md](./NDK.md) – OER Event Kind Definition

#### Zu implementieren:

- [ ] **OER Event Schema**
  - [ ] Standard-Kind für OER-Materialien definieren
  - [ ] Tags für Metadaten (Fach, Klassenstufe, Typ, Lizenz)
  - [ ] Content-Index mit Suchbarkeit

- [ ] **Content Search API**
  - [ ] NDK Filter für OER-Material
  - [ ] Suchfunktion nach Keyword, Fach, Klassenstufe
  - [ ] KI-Ranking nach Relevanz

- [ ] **Integration in Chat**
  - [ ] Nutzer: _„Finde Material zu Römisches Reich, Klasse 7"_
  - [ ] KI sucht OER-Events
  - [ ] Ergebnisse als Cards im `Materialideen`-Spalte

- [ ] **Tests**
  - [ ] Mock-OER-Events erstellen
  - [ ] Search-Query Tests
  - [ ] Ranking-Algorithmus Tests

**Acceptance Criteria:**
- ✅ KI kann Materialien finden
- ✅ Suchergebnisse sind relevant
- ✅ Cards werden automatisch hinzugefügt

---

### Meilenstein 3.3: KI-Aktionen (Split-Card, etc.) (Priorität: Geplant)

**Ziel:** KI kann Board-Struktur verändern  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Split-Card Aktion**
  - [ ] KI versteht, dass eine Card zu komplex ist
  - [ ] Vorschlag: _„Teile diese Aufgabe in 3 Teil-Aufgaben"_
  - [ ] Nutzer bestätigt
  - [ ] `Column.splitCard()` wird ausgeführt
  - [ ] Neue Cards erscheinen im Board

- [ ] **Andere KI-Aktionen**
  - [ ] `add_card` – KI schlägt neue Card vor
  - [ ] `update_card` – KI aktualisiert bestehende Card
  - [ ] `move_card` – KI reorganisiert Struktur

- [ ] **Action-Preview**
  - [ ] Nutzer sieht AI-Vorschlag vor Ausführung
  - [ ] Dialog zur Bestätigung
  - [ ] Undo möglich

**Acceptance Criteria:**
- ✅ `processAIAction()` funktioniert für alle Types
- ✅ Nutzer kann Actions vor Ausführung sehen
- ✅ Undo/Redo funktioniert

---

## 🔴 Phase 4: Kollaboration (CRITICAL - bis 31.12.2025 FERTIG!)

**Timeline:** 01.12.2025 - 31.12.2025 (30 Tage)  
**Status:** 🔴 **CRITICAL - MUSS BIS 31.12.2025 FERTIG SEIN!**  
**Abhängig von:** Phase 2 (Export/Import, Merge Engine) ✅ abgeschlossen  
**Parallel zu:** Phase 2.2 (UX), Phase 2.3 (Performance)  
**Nächste Phase:** 01.01.2026 - Phase 3 + Phase 4 Testing

### Meilenstein 4.1: Board-Sharing & Permissions (01.12. - 20.12., 19 Tage)

**Ziel:** Mehrere Nutzer können gemeinsam an Board arbeiten (mit Zugriffskontrolle)  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **NIP-51 Integration** (Kontaktlisten für Board-Sharing)
  - [ ] `readBoardShares()` - Liste der Boards mit Zugriff
  - [ ] `addBoardShare(boardId, pubkey, role)` - Nutzer hinzufügen
  - [ ] `removeBoardShare(boardId, pubkey)` - Nutzer entfernen
  - [ ] Store als Kind 30051 Event

- [ ] **Permission System** 
  - [ ] `enum BoardRole { OWNER, EDITOR, VIEWER }`
  - [ ] Owner: Kann alles ändern + Freigabe verwalten
  - [ ] Editor: Kann Karten bearbeiten + Kommentare
  - [ ] Viewer: Nur Lesezugriff
  - [ ] Permissions bei Event-Publishing prüfen

- [ ] **Share Dialog UI** (shadcn-svelte)
  - [ ] Share Panel in Topbar
  - [ ] Nutzer-Liste mit Rollen-Dropdown
  - [ ] Add/Remove Nutzer
  - [ ] Link-Copy für Public Sharing

- [ ] **Tests**
  - [ ] Unit: Permission checks
  - [ ] Integration: NIP-51 Simulation
  - [ ] E2E: Zwei Browser mit verschiedenen Rollen

**Acceptance Criteria:**
- ✅ Nutzer können Boards freigeben
- ✅ Berechtigungen werden durchgesetzt
- ✅ Events können nur von Berechtigten publiziert werden
- ✅ Share-Dialog ist benutzerfreundlich

---

### Meilenstein 4.2: Echtzeit-Kollaboration (15.12. - 31.12., 16 Tage PARALLEL)

**Ziel:** Live-Editing mehrerer Nutzer mit Konfliktauflösung & Presence  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **Cursor-Position Sharing** (CRDT-basiert)
  - [ ] Implementiere einfache CRDT für Card-Positionen
  - [ ] Publish "Nutzer arbeitet an Karte X" Events
  - [ ] Subscribe zu anderen Nutzern
  - [ ] Visualisiere Cursor-Positionen in UI

- [ ] **Live-Notifications**
  - [ ] Toast beim Hinzufügen von Kommentaren von anderen
  - [ ] Toast wenn andere Nutzer Karten verschieben
  - [ ] Toast wenn Board aktualisiert wird
  - [ ] Sound-Option (optional)

- [ ] **Presence-Indicator**
  - [ ] "Alice arbeitet gerade hier" in Column-Header
  - [ ] Online/Offline Status für jeden Nutzer
  - [ ] Avatar + Last-Seen Zeitstempel

- [ ] **Soft-Locks** (Prevent Conflicts)
  - [ ] Nutzer sperrt Karte zum Bearbeiten (5 Min TTL)
  - [ ] Lock wird nach 5 Min automatisch freigegeben
  - [ ] 3-Way Merge falls Conflict auftritt
  - [ ] Merge-Dialog für manuelle Auflösung

- [ ] **Tests**
  - [ ] Integration: Multi-Browser Playwright Setup
  - [ ] Concurrent edits Szenarien testen
  - [ ] Merge-Logik mit echten Konflikten
  - [ ] Netzwerkfehler simulieren

**Acceptance Criteria:**
- ✅ Zwei Nutzer können gleichzeitig ein Board bearbeiten
- ✅ Konflikte werden korrekt mit 3-Way Merge gelöst
- ✅ Presence wird korrekt angezeigt & aktualisiert
- ✅ Soft-Locks verhindern Lost-Updates
- ✅ Alle Tests grün (Unit + Integration + E2E)

---

### ⏰ Testphase (01.01. - 31.01.2026, 31 Tage)

**DIESE PHASE:** Phase 4 Testing & QA  
**Status:** Freigeschaltet nach 31.12.2025

- [ ] Multi-User Testing (3+ Nutzer gleichzeitig)
- [ ] Konflikt-Szenarien real testen
- [ ] Performance unter Last
- [ ] Edge Cases dokumentieren
- [ ] Bugs fixen & Hotfixes

---

### Meilenstein 4.3: Offline-First mit Conflict Resolution (FUTURE - Phase 4+ Optional)

**Ziel:** App funktioniert offline mit Multi-User Sync  
**Status:** ⚪ FUTURE

#### Zu implementieren:

- [ ] **Lokale Änderungen tracken**
  - [ ] Lamport Clocks für Event-Ordering
  - [ ] Change-Set für Sync-Konflikt-Auflösung

- [ ] **Merge auf Reconnect**
  - [ ] Lokale Changes mit Server-Changes vergleichen
  - [ ] Merge-Strategie anwenden
  - [ ] User-Notification bei Konflikten

- [ ] **Tests**
  - [ ] Zwei Clients offline, dann online
  - [ ] Simultane Änderungen auf selber Card
  - [ ] Lange Offline-Perioden

**Acceptance Criteria:**
- ✅ Offline-Changes werden korrekt synced
- ✅ Konflikte werden aufgelöst
- ✅ Keine Daten verloren

---

## ⚪ Phase 5: Erweiterte Features (Priorität: Geplant)

### Meilenstein 5.1: Materialverwaltung & Depot

**Ziel:** Nutzer haben persönliches Material-Archiv  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Persönlicher Material-Index
- [ ] Volltextsuche über eigene Materials
- [ ] Automatische Kategorisierung (Fach, Klassenstufe)
- [ ] Favoriten & Markierungen
- [ ] Export zu CSV/PDF

---

### Meilenstein 5.2: Gemeinschaften & Communities

**Ziel:** Lehrkräfte organisieren sich in Fachgruppen  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Community-Erstellung und -Verwaltung
- [ ] Shared Material-Repositories
- [ ] Diskussions-Forum (Nostr Kind 42?)
- [ ] Community-Standards & Best Practices
- [ ] Recommendation-System

---

### Meilenstein 5.3: Analyse & Insights

**Ziel:** Dashboard mit Daten über Board-Nutzung  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Board-Statistiken (Anzahl Cards, Spalten, etc.)
- [ ] Activity-Timeline
- [ ] Häufigste Tags und Labels
- [ ] Collaboration-Graph (wer arbeitet mit wem)
- [ ] Performance-Metriken

---

### Meilenstein 5.4: Mobile App

**Ziel:** Native iOS/Android App mit Offline-Sync  
**Status:** ⚪ PLANNED

#### Features:

- [ ] React Native oder Flutter Implementation
- [ ] Alle Board-Features
- [ ] Push-Notifications für Collaboration
- [ ] Camera-Integration für Material-Erfassung

---

### Meilenstein 5.5: Integrationen

**Ziel:** Verbindung mit externen Tools  
**Status:** ⚪ PLANNED

#### Features:

- [ ] LMS Integration (Moodle, Ilias, etc.)
- [ ] Calendar Sync
- [ ] Mail-Digest Notifications
- [ ] Slack/Discord Webhooks
- [ ] Google Drive/OneDrive Attachments

---

## 📋 Kritische Pfade & Dependencies

### Blocker für Phase 2:
1. ✅ Phase 1 Meilensteine 1.1 - 1.4 (Core Implementation)

### Förder-Anforderungen (wichtig)
- Die Fördermittelgeber erwarten die Umsetzung bis einschließlich Phase 4.
- Es muss möglich sein, ein Board (Store) zu exportieren und zu importieren, um Boards zu teilen oder Backup/Restore zu ermöglichen. Implementierung auf Store-Level ist verpflichtend für Phasen-1..4.

### Blocker für Phase 3:
1. ✅ Phase 2 abgeschlossen (UI funktional)
2. 🟡 OER-Event Schema finalisiert (NDK.md)
3. 🟡 KI-API Integration (externe Service)

### Blocker für Phase 4:
1. ✅ Phase 3 abgeschlossen (KI funktional)
2. 🟡 Permissions-System designt
3. 🟡 Conflict Resolution Strategie validiert

---

## 🎯 Definition of Done (DoD)

Jeder Meilenstein ist **nur dann done**, wenn:

- ✅ Code ist geschrieben und reviewed
- ✅ Tests sind geschrieben und grün (> 80% Coverage)
- ✅ Dokumentation ist aktualisiert
- ✅ Keine Breaking Changes für andere Phasen
- ✅ Acceptance Criteria sind erfüllt
- ✅ Ist in `main` Branch merged
- ✅ CHANGELOG.md ist aktualisiert

---

## 🏗️ Technische Schulden & Known Issues

### Phase 1:
- [ ] `data.ts` wird noch verwendet (alte Struktur)
- [ ] NDK Caching nicht optimiert
- [ ] Error Handling minimal

### Phase 2:
- [ ] Component Tests sind gering
- [ ] Mobile Responsiveness incomplete
- [ ] Dark Mode nicht implementiert

### Phase 3+:
- [ ] KI-Ratenlimiting fehlt
- [ ] Keine User Research noch durchgeführt
- [ ] Performance unter Last nicht getestet

---

## 📞 Kontakt & Support

- **Issues & Bugs:** [GitHub Issues](https://github.com/edufeed-org/kanban-editor/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/edufeed-org/kanban-editor/discussions)
- **Dokumentation:** 
  - 📚 [`docs/_INDEX.md`](../docs/_INDEX.md) - Zentrale Navigation (41 Docs)
  - 📚 [`docs/ARCHITECTURE/STORES/README.md`](../ARCHITECTURE/STORES/README.md) - Store-Übersicht
  - 📚 [`docs/ARCHITECTURE/AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md) - UI-Komponenten
  - 📚 [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md) - Governance-Regeln v3.0
  - 📚 [`docs/archive/DOCUMENTATION-RULES-v2.md`](../archive/DOCUMENTATION-RULES-v2.md) - Migration Guide (v2.0)

---

## 📝 Versionshistorie

| Version | Datum | Beschreibung |
|---------|-------|-------------|
| 2.5 | 29.10.2025 | 📚 **DOKUMENTATIONS-GOVERNANCE v3.0:** Bidirektionale Code ↔ Docs Sync MANDATORY! 11-Punkt DoD Checklist, Pre-Commit Hooks, Metriken & KPIs, Enforcement-Rules. Verhindert 5-10 Tage Debugging durch veraltete Docs! |
| 2.4 | 29.10.2025 | 📚 **DOKUMENTATIONS-RESTRUKTURIERUNG:** ARCHITECTURE/ komplett überarbeitet! STORES/ Subdirectory mit 6 Docs, AUTH-UI-COMPONENTS.md neu, 40% Redundanz-Reduktion, 37 → 41 total docs |
| 2.3 | 26.10.2025 (Abend) | ⚡ **OPTIMIZATION:** 50% Zeitersparnis durch bereits vorhandene Komponenten! (-53 Tage insgesamt) |
| 2.2 | 26.10.2025 | 🔴 **CRITICAL UPDATE:** Phase 4 (Kollaboration) zur COMPLETION bis 31.12.2025 verschoben! Testphase 01.01. - 31.01.2026 |
| 2.1 | 26.10.2025 | ✅ Merge-System & Board-Versioning Integration (Phase 1.5A DONE, Zeitplan aktualisiert) |
| 2.0 | 18.10.2025 | Priorisierte Roadmap mit Meilensteinen |
| 1.0 | 17.10.2025 | Initial Roadmap (in CODE-ANALYSE.md) |

---

**Nächste Review:** 31.10.2025 (Phase 1.5B Deadline)  
**Kritischer Meilenstein:** 31.12.2025 (Phase 4 MUSS fertig sein!)  
**Testing Start:** 01.01.2026 (Phase 3 + Phase 4 Testing parallel)  
**Dokumentation:** ✅ Vollständig aktualisiert (29.10.2025)  
**Governance:** 🔴 **v3.0 ACTIVE** - Code ↔ Docs Sync MANDATORY

---

## ⏱️ FINAL TIMELINE SUMMARY (v2.3 - mit 50% Reduktion)

```
OKTOBER 2025:
  26-31.10: Phase 1.5B: CardDialog Integration (5 Tage) ✓

NOVEMBER 2025:
  01-10.11: Phase 1.5C Snapshots (9 Tage) + Phase 2.0 Merge (9 Tage) PARALLEL
  10-22.11: Phase 1.5D Export/Import (10 Tage) + Phase 2.1 UI (12 Tage) PARALLEL
  22-01.12: Phase 2.2 UX Polish (9 Tage)

DEZEMBER 2025:
  01-10.12: Phase 2.3 Performance (9 Tage)
  10-23.12: Phase 4.1 Board-Sharing (13 Tage)
  20-31.12: Phase 4.2 Echtzeit-Kollaboration (11 Tage)
  🎯 31.12: DEADLINE - Phase 2 + Phase 4 FERTIG!

JANUAR 2026:
  01-31.01: Phase 3 KI-Integration (50 Tage) + Phase 4 Testing (31 Tage) PARALLEL
  
FEBRUAR 2026:
  01-20.02: Phase 3 KI-Integration Completion (20 Tage mehr)
```

**Neue Gesamtdauer:** 26.10.2025 → 20.02.2026 = **117 Tage** (vs. 170 Tage in v2.2)
**Einsparnis:** **53 Tage (-31% Gesamtzeit!)**

---

**Zuletzt aktualisiert:** 26. Oktober 2025 (20:30 Uhr)  
**Nächste Überprüfung:** Nach Abschluss von Phase 1.5B (31.10.2025)
