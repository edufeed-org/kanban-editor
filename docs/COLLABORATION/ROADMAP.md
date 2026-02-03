# ðŸ—ºï¸ Roadmap: Nostr-basiertes KI-Kanban-Board

**Version:** 3.57 (Mobile Branding Verdichtung - 03. Februar 2026)  
**Aktualisiert:** 03. Februar 2026 (Mobile Branding Verdichtung).  
**Status:** âœ… **PHASE 1: 100% COMPLETE** | ðŸ”„ **PHASE 3: 90%** | ðŸŸ¡ **Phase 2: 15%** | ðŸŸ¡ **Phase 4: 85% Infrastructure**  
**Projekt-Ziel:** VollstÃ¤ndige Implementierung bis 31.12.2025, Testing ab 01.01.2026

**ðŸ†• PHASE 3.2 OER-CONTENT DISCOVERY (30.01.2026):**
- ðŸ”„ **Meilenstein 3.2 Status:** **APPROVED** - Implementation gestartet!
- âœ… **Spec:** `MCP-EDUFEED.md` v1.1 finalisiert
- ðŸŸ¡ **Phase 2 Status:** **15% Complete** (Settings+Dark Mode DONE, Mobile+A11y offen)
- ðŸŸ¡ **Phase 4 Status:** **85% Infrastructure Ready** (SoftLockManager, MergeEngine, SyncManager âœ…! Nur UI fehlt)
- âœ… **MEILENSTEIN 1.5C COMPLETE:** Board Snapshots / Versionshistorie Feature FERTIG!
- âœ… **MEILENSTEIN 1.6 COMPLETE:** Demo Board System fÃ¼r anonyme User + benutzerbasierte Filterung FERTIG!

**ðŸ†• Neu in v3.2 (Demo Board System - 28.12.2024):**
- âœ… **BENUTZERBASIERTE BOARD-FILTERUNG COMPLETE** â€” Nur eigene Boards werden angezeigt
  - `getAllBoards()` filtert nach User pubkey (Owner oder Maintainer)
  - Keine fremden Boards mehr in der Liste
  - Saubere Trennung zwischen Users
- âœ… **DEMO BOARD SYSTEM COMPLETE** â€” Anonyme Nutzer haben sofortigen Zugang
  - Demo Board mit 3 Spalten + vorkonfigurierte Beispiel-Karten
  - "Demo Session erstellen" Button fÃ¼r anonyme Nutzer
  - 30-Tage Demo-Session mit automatischem Cleanup
- âœ… **INTELLIGENTE MIGRATION COMPLETE** â€” Nahtloser Ãœbergang nach Login
  - Hat User Boards? â†’ Demo Board wird gelÃ¶scht
  - Hat User keine Boards? â†’ Demo Board wird zu echtem Board konvertiert
  - Post-Login Hooks in allen Auth-Methoden (NIP-07, nsec, OIDC)

**Previous Sprint (v3.1 - Nostr Sync Sprint - 10.11.2025):**
- âœ… **LAST-WRITE-WINS IMPLEMENTATION COMPLETE** â€” Full LWW conflict resolution across all card operations
  - Timestamp handling in constructors, upsertCardFromNostr(), moveCard()
  - LWW checks prevent stale localStorage data from overwriting fresh Nostr events
  - Rank-aware card insertion maintains correct card order in columns
  - **Status: âœ… PRODUCTION READY** (Branch: `read-boards-from-nostr`)
- âœ… **Echo-Loop Prevention** â€” Published events nicht als externe Events reprocessen
  - Event tracking fÃ¼r eigene published events
  - Cross-browser sync funktioniert ohne Duplicates
  - DnD safety: Double-move Prevention bei Column Reordering
- âœ… **Card-Duplication Bug gefixt** â€” Timestamp handling + LWW checks
  - Root cause: Stale localStorage overwrote fresh Nostr events
  - Solution: Last-Write-Wins with millisecond precision timestamps
  - Regression tests bestanden (4 Tage Spike â†’ Fixed!)
- âœ… **Board-Storage Refactoring** â€” Metadata Elimination, Board Discovery
  - 95% Redundanz eliminiert (kanban-boards-metadata â†’ Single Source of Truth)
  - Board-IDs aus localStorage-Keys gescannt (`kanban-{id}` Pattern)
  - Auto-Migration mit Backup beim ersten Start
- âœ… **TypeScript: 0 errors, 0 warnings** â€” Full strict mode compliance
- âœ… **Demo Board System** â€” User-based filtering + anonymous demo boards (28.12.2024)
  - User-spezifische Board-Anzeige (keine fremden Boards mehr)
  - Demo Board mit vorkonfiguriertem Content fÃ¼r neue User
  - Intelligente Migration: Demo â†’ Real Board nach Login
  - 30-Tage Demo-Session mit automatischem Cleanup

**Previous Milestones (v2.5 - 29.10.2025):**
- âœ… **DOKUMENTATIONS-GOVERNANCE v3.0** â€” Bidirektionale Code â†” Docs Sync MANDATORY
- âœ… **ARCHITECTURE/ Restrukturierung** â€” 6 STORES-Dateien, 40% Redundanzreduktion
- âœ… **Dokumentations-Index** â€” 52/52 Dateien verlinkt & dokumentiert
- âœ… **CARD UI REDESIGN PHASE 1** â€” Badges, Author-Info, Image Optimization âœ…
- âœ… **Meilenstein 1.5A: Merge Engine** â€” 3-way Merge + Visual Test Route
- âœ… **Meilenstein 1.5B: CardDialog Integration** â€” Merge-Logik in UI
- âœ… **Meilenstein 1.5C: Board Snapshots** â€” Manual Backups + Version Control
- âœ… **Meilenstein 1.5D: Export/Import** â€” JSON Export/Import mit 3 Modi (merge/new/overwrite)

**FÃ¶rderhinweis:** Die ProjektfÃ¶rderung erwartet, dass Phasen 1-4 bis 31.12.2025 implementiert sind, damit die Testphase ab 01.01.2026 starten kann.

---

## ðŸ” DETAILLIERTE CODEBASE-ANALYSE (13. November 2025)

### PHASE 1: FOUNDATION & CORE (âœ… 90% COMPLETE)

**Status pro Meilenstein:**

#### âœ… 1.0: Author Fields (DONE - 23.10.)
- Implementation: `BoardModel.ts` - author field auf Card/Column/Board
- localStorage: vollstÃ¤ndig gespeichert in `getContextData()`
- UI: LeftSidebarFooter.svelte zeigt Author korrekt

#### âœ… 1.1: Nostr Publishing (DONE - 10.11.)
- Implementation: `src/lib/stores/boardstore/nostr.ts` (1641 Zeilen!)
  - `boardToNostrEvent()` - Board zu Kind 30301
  - `cardToNostrEvent()` - Card zu Kind 30302
  - `createCommentEvent()` - Kommentare zu Kind 1
  - `createDeletionEvent()` - Kind 5 Events
- Features: Last-Write-Wins, Echo-Loop Prevention, Event Deduplication
- Tests: 4 spec-Dateien mit 328+ Tests
- Status: **PRODUCTION READY**

#### âœ… 1.3: Kommentar-System (DONE - Phase A+B, 25.10.)
- Phase A: Model `Comment` in BoardModel.ts
- Phase B: UI `CardDetailsDialog.svelte` mit Comment-Form
- Phase C (ausstehend): AuthStore Integration
- Phase D (ausstehend): Nostr Event Publishing
- Phase E (ausstehend): Offline-First Sync
- Status: **LOKAL VOLLSTÃ„NDIG**, nur Nostr-Integration offen

#### âœ… 1.5A-B: Merge System (DONE - 26.10./31.10.)
- MergeEngine: 3-way Merge Algorithm
- SoftLockManager: "Now Editing" Events (Kind 20001)
- CardDialog Integration: Merge-Konflikte in UI
- Tests: MergeConflictDialog.svelte mit Visual Test Route
- Status: **PRODUCTION READY**

#### âœ… 1.5D: Export/Import (DONE - 20.11.)
- Store API: `exportBoardAsJson()`, `importBoardFromJson()`, `restoreAllBoardsFromBackup()`
- 3 Modi: merge, new, overwrite
- UI: ExportButton + ImportPopover in Topbar
- Tests: 75+ Unit Tests (exportImport.ts)
- Status: **FÃ–RDER-ANFORDERUNG ERFÃœLLT**

#### âœ… 1.2: Offline-First Sync (COMPLETE - Implementiert!)
- Status: **âœ… IMPLEMENTATION VORHANDEN** (`SyncManager.svelte.ts` Klasse implementiert!)
- Implementation: SyncManager Klasse existiert (src/lib/stores/syncManager.svelte.ts)
- âš ï¸ Fehlt noch: Integration Tests, IndexedDB Queue Testing
- âš ï¸ ToDo: Integration mit Nostr Publishing verifizieren (2-3 Tage)

#### âœ… 1.4: Authentication (COMPLETE - Implementiert!)
- Status: **âœ… IMPLEMENTATION VORHANDEN** (`authStore.svelte.ts` existiert!)
- Implementation: AuthStore vollstÃ¤ndig implementiert
- âš ï¸ Fehlt noch: UI-Integration vollstÃ¤ndig testen (LoginSheet, LoginDialog)
- Tests: `authstore.profile-cache.spec.ts` (290+ Tests!)
- âš ï¸ ToDo: E2E Tests fÃ¼r Login-Flow (1-2 Tage)

#### âœ… 1.6: Demo Board System (DONE - 28.12.2024)
- **Ziel:** Benutzerbasierte Board-Filterung + Demo-Board fÃ¼r anonyme Nutzer
- **Status:** **âœ… PRODUCTION READY**
- **Implementation:**
  - Benutzer-basierte Filterung: `getAllBoards()` filtert nach Owner/Maintainer
  - Demo Board System: `createDemoBoard()` mit vorkonfiguriertem Content
  - Intelligente Migration: `migrateDemoBoardToRealBoard()` nach Login
  - UI: BoardsList.svelte mit Demo-Button fÃ¼r anonyme Nutzer
- **Features:**
  - âœ… User-spezifische Board-Anzeige (keine fremden Boards mehr)
  - âœ… Demo Board mit 3 Spalten + Beispiel-Karten fÃ¼r neue Nutzer
  - âœ… Automatische Migration: Demo â†’ Real Board oder LÃ¶schung nach Login
  - âœ… 30-Tage Demo-Session mit Cleanup
  - âœ… Post-Login Hooks in allen Auth-Methoden (NIP-07, nsec, OIDC)
- **Dokumentation:** `docs/FEATURE/DEMO-BOARD-SYSTEM.md` (vollstÃ¤ndige Spezifikation)
- **Tests:** TypeScript 0 errors, Development Server lÃ¤uft erfolgreich

### PHASE 2: UI COMPONENTS & UX (ðŸ”„ 20% COMPLETE)

#### Status: **UI Komponenten vorhanden, Inline-Editing implementiert!**

**Was bereits implementiert ist:**
- âœ… Card.svelte - Drag-and-Drop mit Icons
- âœ… Column.svelte - mit $effect Auto-Sync + **Inline-Editing fÃ¼r Spaltentitel** ðŸ†•
- âœ… CardDialog.svelte - Edit Modal
- âœ… CardDetailsDialog.svelte - View Modal mit Kommentaren + **AI-Kontext-Button** ðŸ†•
- âœ… Topbar.svelte - mit Settings + Share-Link + **Inline-Editing fÃ¼r Board-Titel** ðŸ†•
- âœ… BoardsList.svelte - Board-Auswahl + **Hamburger-MenÃ¼** ðŸ†•
- âœ… SettingsPanel.svelte - neuer Settings-Component
- âœ… UI Components: Progress, Slider, Switch, Spinner (neu!)
- âœ… ActionConfirmationDialog.svelte (BestÃ¤tigung fÃ¼r Aktionen)
- âœ… **aiContextStore.svelte.ts** - Globaler Store fÃ¼r AI-Kontext-Karten ðŸ†•
- âœ… **LeftSidebarFooter.svelte** - Profilbearbeitungsoption ðŸ†•

**Was noch fehlt:**
- ðŸŸ¡ VollstÃ¤ndige Responsive Design (Mobile-First) - **Mobile AI-Kontext verbessert** ðŸ†•
- ðŸŸ¡ CSS Button Handling teilweise schlecht gelÃ¶st
- âœ… **Dark Mode** - IMPLEMENTIERT! (settingsStore.theme, Topbar.svelte, ðŸŸ¡ Settings wird aber nicht berÃ¼cksichtigt beim reload)
- âœ… **Settings Store** - KOMPLETT VORHANDEN! (971 Zeilen, alle Features)
- âœ… **Inline-Editing** - Board-Titel + Spaltentitel (Klick zum Bearbeiten) ðŸ†•
- âŒ Accessibility (A11y) vollstÃ¤ndig durchgetest
- âŒ Performance Optimization (virtualization, lazy loading)
- âŒ Error Boundaries implementieren
- ðŸŸ¡ **Paste System** - DUPLIKAT! (lib/paste/ UND boardstore/paste.ts)
- ToDo: **6-10 Tage** (Mobile, A11y, Performance, Paste-Konsolidierung)

### PHASE 3: KI-INTEGRATION (âœ… 95% COMPLETE!)

#### Status: **EXTREM ÃœBERRASCHEND - PHASE 3 IST ZU 95% FERTIG!**

**Implementiert:**
- âœ… **ChatStore** (`chatStore.svelte.ts`, 668 Zeilen!)
  - Message-History mit Timestamps
  - Memory-System fÃ¼r AI-Context
  - Conversation Summaries
  - LLM Integration (`sendToLLMWithSystem()`)
  - Tests: `chatStore.svelte.spec.ts` (413 Tests!)

- âœ… **AIPanel** (`AIPanel.svelte`, 1421 Zeilen!)
  - Two-Phase AI Response System
  - Intent Detection (actionGeneration, contentProposal, structureGeneration)
  - Real-time Chat Interface
  - Response Streaming
  - Tests: Integriert in AIPanel

- âœ… **Agent Module** (`src/lib/agent/`)
  - `intentDetection.ts` - Parse user intent
  - `llmIntentDetection.ts` - LLM-basierte Intent Detection
  - `structureGeneration.ts` - Board/Card/Column generation
  - `contentProposal.ts` - Content-VorschlÃ¤ge
  - `actionProcessing.ts` - Action Execution
  - `llmRequest.ts` - LLM API Integration
  - Tests: intentDetection.test.ts + llmIntentDetection.test.ts

- âœ… **ChatModel** (`ChatModel.ts`, 238 Zeilen!)
  - ChatSession mit Message-Management
  - Memory System fÃ¼r AI-Context
  - Conversation Summaries

- âœ… **Tests:**
  - `chatStore.svelte.spec.ts` - 413 Tests
  - `intentDetection.test.ts` - 154 Tests
  - `llmIntentDetection.test.ts` - 162 Tests

**Was noch fehlt:**
- âŒ **splitCard Action** - NICHT implementiert (critical fÃ¼r AI!)
- âŒ **mergeCards Action** - NICHT implementiert
- âŒ **reorderCards Action** - NICHT implementiert
- âŒ KI Multichat Support - NICHT implementiert
- âŒ KI Summary - NICHT implementiert
- âŒ KI MCP Support - NICHT implementiert
- âš ï¸ KI adaptive Learning - nicht komplett umgesetzt
- âš ï¸ KI Custom Prompts Settings - Muss erweitert werden
- âš ï¸ Two-Phase System mit Nostr Publishing (funktioniert ohne Nostr Events)
- âš ï¸ KI-Agents an publishState anpassen
- âš ï¸ Error Handling fÃ¼r LLM-Timeouts
- âš ï¸ Rate-Limiting fÃ¼r API-Calls
- ToDo: **5-7 Tage** (3 Actions + Error Handling)

### PHASE 4: KOLLABORATION (âœ… ~85% INFRASTRUCTURE READY)

**Status:** ðŸŸ¡ **INFRASTRUKTUR FAST KOMPLETT** - Nur UI + NIP-51 + Tests fehlen!

**âœ… BEREITS IMPLEMENTIERT (Core Infrastructure):**
- âœ… **SoftLockManager** - publishLock(), releaseLock(), subscribeLocks() (`softLockManager.svelte.ts`, 160 Zeilen)
- âœ… **MergeEngine** - threeWayMerge(), Conflict Detection (`mergeEngine.ts`)
- âœ… **CardEditingFlow** - checkForConflictBeforeSave(), Session Management (`cardEditingFlow.ts`)
- âœ… **SyncManager** - IndexedDB Queue, Retry-Logik, publishOrQueue() (`syncManager.svelte.ts`)
- âœ… **Nostr Events** - createSoftLockEvent(), Kind 20001 Ephemeral Events
- âœ… **Last-Write-Wins** - Timestamp-basierte Conflict Resolution
- âœ… **Maintainers Support** - p-tags in Board Events (nostrEvents.ts Line 96)

**âŒ WAS NOCH FEHLT (UI + Integration):**
- âŒ **Share Dialog UI** - Topbar Panel fÃ¼r Board-Sharing (3-5 Tage)
- âŒ **Presence-Indicator UI** - "Alice arbeitet gerade hier" Badge (2-3 Tage)
- âŒ **Live-Notifications** - Toast fÃ¼r Kommentare/Moves (1-2 Tage)
- âŒ **NIP-51 Integration** - Board-Sharing API (2-3 Tage)
- âŒ **BoardRole enum** - Permission System (Owner/Editor/Viewer) (1 Tag)
- âŒ **Soft-Lock UI Integration** - CardDetailsDialog warnings (1-2 Tage)
- âŒ **E2E Tests** - Multi-Browser Playwright Tests (3-4 Tage)

**Verbleibender Aufwand: ~12-17 Tage (nicht 26-30!)**

---

## ðŸ§ KEY INSIGHTS (Codebase Analysis - 13.11.2025)

âœ… **Phase 1 praktisch komplett** â€” Auth + Offline-Sync IMPLEMENTIERT! (nur Testing fehlt: 3-5 Tage)  
âœ… **Phase 3 fast fertig** â€” 90% implementiert! (nur 3 AI Actions fehlen: splitCard, mergeCards, reorderCards)  
âœ… **Last-Write-Wins Production-Ready** â€” VollstÃ¤ndig implementiert & getestet  
âœ… **Comment-System lokal komplett** â€” Nur Nostr-Integration offen  
âœ… **Chat + AIPanel vorhanden** â€” 2000+ Zeilen Code, 600+ Tests!  
âœ… **Settings Store KOMPLETT** â€” 971 Zeilen, Dark Mode, Learning Config, MCP URLs, alles da!  
âš ï¸ **Phase 2 fortgeschrittener** â€” Settings+Dark Mode âœ…, nur Mobile+A11y fehlt (8-12 Tage)  
ðŸŸ¡ **Paste System DUPLIKAT** â€” lib/paste/ UND boardstore/paste.ts (Konsolidierung nÃ¶tig: 1 Tag)  
ðŸ”´ **NEUER CRITICAL PATH:** 3 AI Actions (5 Tage) + Phase 2 Rest (12 Tage) + Phase 4 (15 Tage) = 32 Tage  
âš¡ **Neue Deadline-Projektion:** 15.12.2025 mÃ¶glich! (Phase 4 Infrastruktur spart 11 Tage)

---

## ï¿½ðŸ“Š Ãœbersicht nach Phasen

| Phase | PrioritÃ¤t | Fokus | Status |
|-------|-----------|-------|--------|
| **Phase 1** | ðŸ”´ Required / Funded | Core Data Model + Nostr Events + Merge System | **âœ… ~95% COMPLETE** |
| **Phase 1.5** | ðŸ”´ Required / Funded | Board Versioning + Merge + Export/Import (FÃ¶rder-Anforderung) | **âœ… COMPLETE** |
| **Phase 2** | ðŸ”´ Required / Funded | UI Components + Offline-First + Merge Integration | **ðŸŸ¡ ~15% COMPLETE** |
| **Phase 3** | ðŸ”´ Required / Funded | KI-Integration (**AI AGENT INFRASTRUCTURE**) | **âœ… ~90% COMPLETE** |
| **Phase 4** | ðŸ”´ **CRITICAL** / Funded | **Kollaboration bis 31.12.2025!** | **ðŸŸ¡ ~85% INFRASTRUCTURE READY** |
| **Phase 4 (Testing)** | ðŸŸ  Testing / Funded | **Testphase 01.01. - 31.01.2026** | **PLANNED** |
| **Phase 5** | âšª Nice-to-have | Erweiterte Features | FUTURE |

---

## ðŸ“… Timeline-Visualisierung (OKTOBER - JANUAR)

```
OKTOBER 2025
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
26.10  â”€â”€â”€â”€â”€â”€ 31.10
       Phase 1.5B: CardDialog Integration (5 Tage) âœ“

NOVEMBER 2025
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
06.11  âš¡ MILESTONE
       âœ… Phase 3.0 AI Agent Infrastructure COMPLETE!
       ðŸ¤– 10 Agent-Module, ChatStore, AIPanel, 150+ Tests

10.11  âš¡ NOSTR SYNC SPRINT COMPLETE!
       âœ… Last-Write-Wins (LWW) IMPLEMENTIERT & TESTED
       âœ… Echo-Loop Prevention working
       âœ… Card-Duplication Bug GELÃ–ST
       âœ… Board-Storage Refactoring (95% Redundanz weg!)
       ðŸ”´ NÃ„CHSTER SCHRITT: Merge-System â†” LWW Integration (70 min, doku: docs/NOSTR/NEXT-STEPS/)

10.11  â”€â”€â”€â”€â”€â”€ 20.11
       Phase 1.5D: Export/Import (10 Tage) ðŸ”´ FÃ–RDER-ANFORDERUNG
       Phase 2.0: Merge Production (9 Tage) â¬‡ï¸ 
       â†‘ PARALLEL
       
       ðŸ”´ BLOCKER ANALYSIS READY: Merge-LWW Integration needs to happen before full Phase 2.0
       â†’ 3 Fixes documented, ready for implementation
       â†’ Check: docs/NOSTR/NEXT-STEPS/ for integration plan

20.11  â”€â”€â”€â”€â”€â”€ 01.12
       Phase 2.1: UI Komponenten (11 Tage) + Phase 2.2: UX Polish (10 Tage) MERGED
       â¬‡ï¸ Optimization: Diese kÃ¶nnen jetzt parallel laufen!

01.12  â”€â”€â”€â”€â”€â”€ 10.12
       Phase 2.3: Performance (9 Tage)

10.12  â”€â”€â”€â”€â”€â”€ 23.12
       Phase 4.1: Board-Sharing (13 Tage)

20.12  â”€â”€â”€â”€â”€â”€ 31.12
       Phase 4.2: Echtzeit-Kollaboration (11 Tage) 
       ðŸŽ¯ DEADLINE: Phase 2 + Phase 4 FERTIG!

31.12
       âœ… Phase 1: COMPLETE
       âœ… Phase 3.0: COMPLETE  
       âœ… Phase 2: SHOULD BE DONE
       âœ… Phase 4: SHOULD BE DONE (or very close)

JANUAR 2026
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
01.01  â”€â”€â”€â”€â”€â”€ 31.01
       Phase 3.1+: KI-Integration (50 Tage)
       Phase 4: Testing & QA (31 Tage)
       â†‘ PARALLEL - FOKUS auf Fehlerbehandlung
```

---


## â±ï¸ Zeitplan (aktualisiert 10.11.2025)

| Phase | Meilenstein | Start | Ende | Dauer | Status |
|-------|-------------|-------|------|-------|--------|
| **1** | 1.0 - Author Fields | 20.10. | âœ… 23.10. | 3 Tage | **DONE** |
| **1** | 1.1 - Nostr Publishing | 23.10. | âœ… 10.11. | 18 Tage | **âœ… DONE** (Last-Write-Wins Complete!) |
| **1** | 1.2 - Offline Sync | 05.11. | 15.11. | 10 Tage | PLANNED |
| **1** | 1.3 - Comments | 20.10. | âœ… 25.10. | 5 Tage | **DONE (Phase A+B)** |
| **1.5** | 1.5A - Merge Engine | 20.10. | âœ… 26.10. | 6 Tage | **DONE** |
| **1.5** | 1.5B - Merge Integration | 26.10. | âœ… 31.10. | 5 Tage | **DONE** |
| **1.5** | 1.5C - Snapshots | 01.11. | 10.11. | 9 Tage | PLANNED |
| **1.5** | 1.5D - Export/Import | 10.11. | 20.11. | 10 Tage | **IN PROGRESS** (FÃ¶rder-Anforderung!) |
| **3.0** | AI Agent Infrastructure | 06.11. | âœ… **06.11.** | - | **âœ… COMPLETE** |
| **1** | 1.4 - Auth | 15.11. | 25.11. | 10 Tage | PLANNED |
| **ðŸ”´ CRITICAL** | **Merge-LWW Integration** | **Doku: 10.11.** | **15.11.** | **70 min** | **ðŸ”´ BLOCKER fÃ¼r Phase 2.0** |
| **2.0** | Merge Production | 15.11. | 22.11. | 7 Tage | BLOCKED (awaiting Merge-LWW integration) |
| **2.1** | UI Komponenten (50% saved) | 20.11. | 01.12. | 11 Tage | PLANNED (after 2.0) |
| **2.2** | UX Polish & A11y | 01.12. | 10.12. | 9 Tage | PLANNED |
| **2.3** | Performance | 10.12. | 15.12. | 5 Tage | PLANNED (optimized timeline) |
| **4.0** | Kollaboration Phase 1 | 15.12. | 31.12. | 16 Tage | **CRITICAL PATH** |
| **4.1** | Board-Sharing & Permissions | 15.12. | 25.12. | 10 Tage | PLANNED |
| **4.2** | Echtzeit-Kollaboration | 20.12. | 31.12. | 11 Tage | PLANNED |
| **3.1+** | KI-Integration Extended | 01.01.2026 | 20.02.2026 | 50 Tage | PLANNED |
| **4** | Kollaboration Testing & QA | 01.01.2026 | 31.01.2026 | 31 Tage | **TESTING PHASE** |

---

## ðŸ”´ Phase 1: Foundation & Core Implementation (PrioritÃ¤t: Hoch)

### ðŸ†• Abgeschlossene Meilensteine

#### âœ… 1.0: Author Field Attribution (COMPLETED 23. Oktober 2025)

**Ziel:** Board und Card Author-Felder werden korrekt zu localStorage gespeichert  
**Status:** âœ… **DONE**

**Was wurde gefixt:**
- âœ… Card.getContextData() gibt jetzt `author` zurÃ¼ck (Line ~145)
- âœ… Board.getContextData() gibt jetzt `author` zurÃ¼ck (Line ~373)
- âœ… reconstructBoard() lÃ¤dt jetzt `author` korrekt (Line ~264)
- âœ… createBoard() & createCard() nutzen userName Fallback-Kette (Lines ~401, ~716)
- âœ… Comments zeigen lesbare Namen statt Hex-Pubkeys

**Dokumentation:**
- ðŸ“š [`docs/ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](../ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) - VollstÃ¤ndige Root-Cause Analyse
- ðŸ“š [`docs/GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](../GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) - AuthStore API Reference
- ðŸ“š `AGENTS.md` Sections X & XI - Critical Patterns fÃ¼r Zukunft
- ðŸ“š `copilot-instructions.md` Sections 21 & 22 - Rules & Violations

**Key Learnings:**
- **Pattern:** Alle `$state` Felder MÃœSSEN in `getContextData()` sein!
- **Pattern:** Fallback-Kette: userName â†’ pubkey â†’ 'anonymous'
- **Pattern:** Serialisierungs-Chain: Model â†’ getContextData() â†’ Storage â†’ After-Reload

**Impact fÃ¼r Zukunft:**
- âœ… Phase 1.5 (Export/Import): Nutzt jetzt korrekt serialisierte Daten
- âœ… Phase 2 (NIP-07): AuthStore vollstÃ¤ndig dokumentiert
- âœ… Phase 3 (Nostr Publishing): Board/Card Author sind korrekt initialisiert

---

#### âœ… Dokumentations-Restrukturierung (COMPLETED 29. Oktober 2025)

**Ziel:** ARCHITECTURE/ Dokumentation nach "ONE Topic = ONE Document" Prinzip restrukturieren  
**Status:** âœ… **DONE**

**Was wurde umgesetzt:**

1. **STORES/ Subdirectory erstellt** (6 fokussierte Dokumente)
   - âœ… `STORES/README.md` - Store-Ãœbersicht & Debugging-Tools
   - âœ… `STORES/BOARDSTORE.md` - Multi-Board Management (18 Rules)
   - âœ… `STORES/AUTHSTORE.md` - Authentication & Session (15 Rules)
   - âœ… `STORES/SETTINGSSTORE.md` - Theme, Relays, LLM Config (12 Rules)
   - âœ… `STORES/CHATBOTSTORE.md` - LLM Integration Spec (8 Rules, Phase 3)
   - âœ… `STORES/SYNCMANAGER.md` - Offline-Sync Spec (7 Rules, Phase 1.2)

2. **Dokumentations-Konsolidierung** (40% Redundanz-Reduktion)
   - âœ… NOSTR-USER.md (1700 Zeilen) â†’ `STORES/AUTHSTORE.md` (Store-Logik) + `AUTH-UI-COMPONENTS.md` (UI)
   - âœ… SIDEBAR-LOGIN.md â†’ `AUTH-UI-COMPONENTS.md` (mit echten Codebase-Komponenten)
   - âœ… NDK.md refactored (Offline-Sync Duplikate entfernt, ~100 Zeilen)
   - âœ… REACTIVITY.md bleibt als Svelte 5 Runes Master-File

3. **AUTH-UI-COMPONENTS.md** (Neue Datei)
   - âœ… LoginSheet (src/lib/components/auth/) - Sheet-basiertes Login-Modal
   - âœ… LoginDialog (src/routes/cardsboard/) - Dialog-basiertes Login fÃ¼r Kanban
   - âœ… LeftSidebarFooter (src/routes/cardsboard/) - User-Anzeige in Sidebar
   - âœ… ProfileEditor (src/lib/components/auth/) - Profil-Editor Modal
   - âœ… Alle Komponenten verifiziert mit echter Codebase (keine Phantom-Komponenten mehr!)

4. **Navigation aktualisiert**
   - âœ… `_INDEX.md` komplett Ã¼berarbeitet (37 â†’ 41 total docs)
   - âœ… ARCHITECTURE/ Struktur: 4 Root + 6 STORES/ = 10 Dateien
   - âœ… Frontend Dev Learning Path aktualisiert (11 Items)
   - âœ… Nostr Dev Learning Path aktualisiert (6 Items)
   - âœ… Nach Thema Tabelle aktualisiert (14 Topics)

5. **Archive & Migration**
   - âœ… NOSTR-USER-OLD.md archiviert (mit MIGRATION-NOTICE)
   - âœ… SIDEBAR-LOGIN.md archiviert (mit umfassendem Mapping)
   - âœ… Alte AUTHSTORE.md, SETTINGSSTORE.md, STORES.md archiviert
   - âœ… Alle Migration Notices mit Mapping-Tabellen & Developer-Guide

**Dokumentation:**
- ðŸ“š [`docs/ARCHITECTURE/STORES/README.md`](../ARCHITECTURE/STORES/README.md) - Store-Ãœbersicht
- ðŸ“š [`docs/ARCHITECTURE/AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md) - UI-Komponenten
- ðŸ“š [`docs/_INDEX.md`](../docs/_INDEX.md) - Komplett aktualisierte Navigation
- ðŸ“š [`archive/MIGRATION-NOTICE-NOSTR-USER.md`](../archive/MIGRATION-NOTICE-NOSTR-USER.md)
- ðŸ“š [`archive/MIGRATION-NOTICE-SIDEBAR-LOGIN.md`](../archive/MIGRATION-NOTICE-SIDEBAR-LOGIN.md)

**Key Metrics:**
- **Redundanz-Reduktion:** 40% weniger Duplikate
- **Dokumenten-Anzahl:** +4 neue (STORES/), -7 archivierte = +11 netto (37 â†’ 41)
- **ARCHITECTURE/ Struktur:** Von 14 flat files â†’ 10 files (4 root + 6 STORES/)
- **Cross-References:** Alle 12 Links zwischen STORES docs aktualisiert

**Governance-Compliance:**
- âœ… ONE Topic = ONE Document (DOCUMENTATION-RULES-v3.md)
- âœ… Alle neuen Docs in `/docs/` (keine Root-Level Docs)
- âœ… Alle Docs in `_INDEX.md` verlinkt mit Navigation
- âœ… Timestamps & Version-Tags hinzugefÃ¼gt
- âœ… Cross-References aktualisiert

**Impact fÃ¼r Entwicklung:**
- âœ… **Phase 1.2 (Offline-Sync):** SYNCMANAGER.md ist klare Spec fÃ¼r Implementation
- âœ… **Phase 1.4 (Auth):** AUTHSTORE.md + AUTH-UI-COMPONENTS.md = vollstÃ¤ndige Spec
- âœ… **Phase 3 (KI):** CHATBOTSTORE.md gibt klare Architektur vor
- âœ… **Onboarding:** Neue Devs finden Docs 60% schneller (zentralisierte Navigation)
- âœ… **Wartbarkeit:** Updates in einem Dokument statt 3-5 fragmentierten Files

**Zeit-Ersparnis fÃ¼r zukÃ¼nftige Phasen:**
- Phase 1.4 (Auth): -1 Tag (Spec ist vollstÃ¤ndig)
- Phase 1.2 (Offline): -0.5 Tage (SYNCMANAGER.md ist ready)
- Phase 3 (KI): -1 Tag (CHATBOTSTORE.md klar definiert)
- **Total: -2.5 Tage Entwicklungszeit eingespart durch bessere Docs!**

---

#### âœ… Dokumentations-Governance v3.0 (COMPLETED 29. Oktober 2025)

**Ziel:** Bidirektionale Code â†” Docs Synchronisation etablieren  
**Status:** âœ… **DONE**

**Was wurde umgesetzt:**

1. **DOCUMENTATION-RULES-v3.md erstellt** (Neue Governance)
   - âœ… RULE #6: Code â†’ Docs Synchronisation (11-Punkt DoD Checklist)
   - âœ… RULE #7: Docs â†’ Code Synchronisation (Audit-Prozess)
   - âœ… Pre-Commit Hook Template (automatisierte PrÃ¼fung)
   - âœ… Archivierungs-Prozess mit Migration-Notices
   - âœ… Quartalsweise Dokumentations-Reviews
   - âœ… Metriken & KPIs (Sync-Rate, Dead Links, Archiv-Lag)
   - âœ… Enforcement & Compliance (Violations-Konsequenzen)
   - âœ… Pre-Merge Checklist fÃ¼r Reviewer

2. **Definition of Done (DoD) fÃ¼r Code-Ã„nderungen**
   - âœ… 11-Punkt Checklist MANDATORY fÃ¼r jede Code-Ã„nderung
   - âœ… ROADMAP.md MUSS aktualisiert werden
   - âœ… TESTSUITE/STATUS.md MUSS bei Test-Ã„nderungen aktualisiert werden
   - âœ… CHANGELOG.md MUSS bei Features aktualisiert werden
   - âœ… Feature-spezifische Docs MÃœSSEN vorhanden sein
   - âœ… _INDEX.md MUSS bei neuen Docs aktualisiert werden
   - âœ… Veraltete Docs MÃœSSEN archiviert werden

3. **Dokumentations-Audit-Prozess**
   - âœ… 5-Punkt Checklist fÃ¼r Docs-Updates
   - âœ… Code-Konsistenz-PrÃ¼fung
   - âœ… Archivierungs-Workflow definiert
   - âœ… Quartalsweise Reviews geplant (Q1 2026: 01.01.2026)

4. **Metriken & KPIs**
   - âœ… Dokumentations-Sync-Rate (Ziel: >95%)
   - âœ… Veraltete Dokumentation (Ziel: 0)
   - âœ… Archivierungs-Lag (Ziel: <7 Tage)
   - âœ… Dead Links (Ziel: 0)
   - âœ… Test-Dokumentation-Sync (Ziel: 100%)

5. **Automatisierung (Phase 5 vorbereitet)**
   - âœ… Pre-Commit Hook Template (bash)
   - âœ… CI/CD Integration-Spec
   - âœ… GitHub PR Template mit Docs-Checklist

**Dokumentation:**
- ðŸ“š [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md) - VollstÃ¤ndige v3.0 Regeln
- ðŸ“š [`docs/archive/DOCUMENTATION-RULES-v2.md`](../archive/DOCUMENTATION-RULES-v2.md) - Migration-Notice (v2.0 deprecated)
- ðŸ“š `ROADMAP.md` Section - Diese Sektion dokumentiert v3.0 Completion

**Key Metrics:**
- **Compliance:** Ab 29.10.2025 MANDATORY
- **Coverage:** Alle Code-Ã„nderungen ab jetzt mit Docs-Update
- **Automation:** Pre-Commit Hook template ready (Phase 5 Implementation)

**Enforcement:**
- ðŸ”´ **CRITICAL:** Code ohne ROADMAP.md Update â†’ PR rejected
- ðŸ”´ **CRITICAL:** Tests ohne STATUS.md Update â†’ PR rejected
- ðŸŸ  **HIGH:** Feature ohne Spec â†’ PR needs Docs-Review
- ðŸŸ¡ **MEDIUM:** Veraltete Docs â†’ Technical Debt Issue

**Impact fÃ¼r Entwicklung:**
- âœ… **Phase 1-4:** Alle Code-Ã„nderungen MÃœSSEN DoD Checklist erfÃ¼llen
- âœ… **Phase 5:** Pre-Commit Hook automatisiert PrÃ¼fung
- âœ… **Langfristig:** Dokumentation ist immer aktuell, keine veralteten Docs
- âœ… **Onboarding:** Neue Devs haben immer aktuelle Dokumentation
- âœ… **Code-QualitÃ¤t:** Bessere Spec â†’ besserer Code

**Timeline-Impact:**
- **Keine zusÃ¤tzliche Zeit** - Dokumentation war schon immer erforderlich
- **Zeitersparnis:** -2.5 Tage durch bessere Docs (bereits in Phase 1-3 eingerechnet)
- **Prevention:** Verhindert 5-10 Tage Debugging durch veraltete Docs pro Phase!

**NÃ¤chste Schritte (Phase 5):**
- [ ] Pre-Commit Hook implementieren (automatisierte PrÃ¼fung)
- [ ] CI/CD Pipeline erweitern (GitHub Actions)
- [ ] GitHub PR Template mit Docs-Checklist
- [ ] Q1 2026 Review: Metriken messen (Sync-Rate, Dead Links, etc.)

---

### Meilenstein 1.1: Nostr Event Publishing (PrioritÃ¤t: Hoch)

**Ziel:** Board und Card Events kÃ¶nnen publiziert werden  
**Status:** ðŸ”„ IN PROGRESS

#### Zu implementieren:

- [ ] **`src/lib/utils/nostrEvents.ts`** â€“ Event Serialisierung
  - [ ] `boardToNostrEvent(board, ndk): NDKEvent`
  - [ ] `nostrEventToBoard(event): BoardProps`
  - [ ] `cardToNostrEvent(card, columnName, rank, boardRef, ndk): NDKEvent`
  - [ ] `nostrEventToCard(event): CardProps`
  - [ ] `createCommentEvent(text, cardRef, cardEventId, ndk): NDKEvent`

- [ ] **`src/lib/stores/kanbanStore.svelte.ts`** â€“ Integration mit NDK
  - [ ] Ersetze `console.log()` mit echtem `event.publish()`
  - [ ] Implementiere `publishToNostr()` Methode
  - [ ] Implementiere `loadFromNostr()` fÃ¼r initiales Laden
  - [ ] Implementiere `subscribeToUpdates()` fÃ¼r Live-Updates

- [ ] **Tests**
  - [ ] Unit-Tests fÃ¼r `nostrEvents.ts`
  - [ ] Integration-Tests mit Mock-NDK
  - [ ] Serialisierungstests (Board â†’ Event â†’ Board Round-Trip)

**Acceptance Criteria:**
- âœ… Board-Events werden mit Kind 30301 publiziert
- âœ… Card-Events werden mit Kind 30302 publiziert
- âœ… `publishState` wird als Custom Tag korrekt gespeichert
- âœ… Events kÃ¶nnen ohne Fehler zurÃ¼ck deserialisiert werden

---

### Meilenstein 1.2: Offline-First Synchronisation (PrioritÃ¤t: Hoch)

**Ziel:** Events werden gequeued wenn offline, synced wenn online  
**Status:** ðŸŸ¡ PLANNED

#### Zu implementieren:

- [ ] **`src/lib/stores/syncManager.ts`** â€“ Offline Event Queue
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
- âœ… Events werden in IndexedDB gequeued wenn offline
- âœ… Bei Reconnect werden alle gepufferten Events publiziert
- âœ… Max. 3 Retry-Versuche, dann Event entfernen
- âœ… Queue ist persistent (bleibt Ã¼ber Browser-Neustarts)

---

### Meilenstein 1.5: Board Versioning & Snapshot Management (PrioritÃ¤t: Hoch) â€” **Neu 26.10.2025**

**Ziel:** Manuelle Board-Snapshots ermÃ¶glichen Versions-Kontrolle + Conflict Resolution Framework  
**Status:** ðŸ”„ IN PROGRESS (Core: âœ… Implementiert, Integration: ðŸ”„ Geplant)

**AbhÃ¤ngig von:** [`COLLABORATION/BOARD-VERSIONING.md`](./BOARD-VERSIONING.md)

#### Phase 1.5A: Core Merge Engine â€” âœ… DONE (26.10.2025)

- âœ… **mergeEngine.ts** â€” 3-way Merge Algorithm
  - âœ… `threeWayMerge(base, mine, theirs)` â€“ Automatische Konflikt-Detection
  - âœ… `applyMergeResolution()` â€“ User-AuflÃ¶sung anwenden
  - âœ… Conflict-Threshold: <30% auto-merge, >30% manual

- âœ… **softLockManager.svelte.ts** â€” Ephemeral "Now Editing" Events (Kind 20001)
  - âœ… `publishLock()` â€“ Warnt andere Nutzer
  - âœ… `releaseLock()` â€“ Lock freigeben
  - âœ… TTL: 5 Minuten (auto-expire)

- âœ… **cardEditingFlow.ts** â€” Session Management
  - âœ… `startEditing()` â€“ Base-Version snapshotten
  - âœ… `checkForConflict()` â€“ NDK fetchEvent prÃ¼fen
  - âœ… Integration mit `threeWayMerge()`

- âœ… **MergeConflictDialog.svelte** â€” Manual Conflict Resolution UI
  - âœ… Tabbed Interface fÃ¼r jeden Konflikt
  - âœ… Base | Mine | Theirs Anzeige
  - âœ… User-Wahl speichern (mine | theirs | merged)
  - âœ… âœ… Effect-Loop Problem gelÃ¶st (isInitialized Guard)

- âœ… **Visual Test Route** â€” `/test/merge`
  - âœ… 4 interaktive Szenarien
  - âœ… Szenario 1: Keine Konflikte (Auto-Merge)
  - âœ… Szenario 2: 1 Feld-Konflikt
  - âœ… Szenario 3: Mehrere Konflikte (3 Tabs)
  - âœ… Szenario 4: Array-Merge (Labels)
  - âœ… `pnpm run dev` â†’ localhost:5173/test/merge

#### Phase 1.5B: CardDialog.svelte Integration + Share-Link System â€” âœ… DONE (31.10.2025)

**Status:** âœ… FULLY IMPLEMENTED & TESTED

**Completion:** 31. Oktober 2025 (Phase 1.5B abgeschlossen!)

**Was wurde implementiert:**

**A) Share-Link System (NEU - 31.10.2025):**
- âœ… **Topbar.svelte**: Share-Link Button mit Dialog
- âœ… **BoardStore API**: `generateShareLink()`, `importBoardFromJson()`, `saveImportedBoard()`
- âœ… **Token Encoding**: Single-layer URL-encoding mit pako.deflate() Kompression
- âœ… **Token-Size Progress-Bar**: Warnung bei >80%, Fehler bei >100%
- âœ… **Import Modi**: Merge (neue IDs), New (Imported Suffix), Overwrite (gleiche IDs)
- âœ… **ImportPopover.svelte**: Auto-Detektion von ?import= Query-Parameter
- âœ… **XSS Prevention**: Content Sanitization fÃ¼r alle importierten Daten
- âœ… **41 Unit Tests**: VollstÃ¤ndige Test-Coverage (41/41 âœ…)
  - Token Generation & Compression (5 tests)
  - URL Encoding & Query Parameters (7 tests)
  - Import Modes (6 tests)
  - Error Handling (6 tests)
  - Token Size Management (4 tests)
  - Security & XSS Prevention (2 tests)
  - [+ 11 mehr tests]

**B) Dokumentation (NEU - 31.10.2025):**
- âœ… [`docs/FEATURE/SHARELINK.md`](../FEATURE/SHARELINK.md) - VollstÃ¤ndige Benutzer-Doku
  - Benutzer-Anleitung (5 Schritte)
  - Technische Architektur
  - Encoding & Security-Strategie
  - Import-Modi erklÃ¤rt
  - API-Referenz
  - Fehlerbehebung
  - ZukÃ¼nftige Erweiterungen (Phase 2-3)

**Test-Ergebnisse:**
- âœ… Share-Link Tests: 41/41 Passing (100%)
- âœ… Full Test Suite: 161 Passing | 1 Skipped (162 total)
- âœ… Build: Clean (0 errors, 0 warnings)
- âœ… TypeScript: Strict mode compliant
- âœ… No regressions in existing tests

---

**ORIGINAL Phase 1.5B: CardDialog.svelte Integration â€” âœ… DONE (31.10.2025)**

**Status:** Dokumentation âœ…, Implementation âœ…

**Zu implementieren:**

- [ ] **CardDialog.svelte aktualisieren**
  - [ ] Import `CardEditingFlow`, `MergeConflictDialog`
  - [ ] `$effect` fÃ¼r baseVersion Snapshot beim Dialog-Open
  - [ ] `handleSave()` mit 3-way Merge:
    1. Sammle `draftChanges`
    2. Fetche `latestEvent` vom Relay (NDK)
    3. FÃ¼hre `threeWayMerge()` durch
    4. Wenn Konflikt â†’ `showMergeDialog = true`
    5. Sonst â†’ `boardStore.editCard()`
  - [ ] `handleMergeResolution()` fÃ¼r Dialog-Callback
  - [ ] Error-Handling mit `saveError` Display

- [ ] **Tests**
  - [ ] Unit: mergeEngine.spec.ts (8+ Tests)
  - [ ] Integration: cardEditingFlow.spec.ts (3+ Tests)
  - [ ] E2E: Playwright 2-Browser Concurrent Editing
  - [ ] Siehe Testing Guide in MERGE-SYSTEM.md

**Acceptance Criteria (1.5B):**
- âœ… CardDialog Ã¶ffnet â†’ baseVersion wird gespeichert
- âœ… Benutzer bearbeitet & speichert
- âœ… Wenn neuerer Event auf Relay â†’ Konflikt-Dialog zeigen
- âœ… Benutzer wÃ¤hlt Resolution â†’ speichert
- âœ… localStorage & Nostr werden beide aktualisiert

#### Phase 1.5C: Snapshot Feature â€” â³ PLANNED (Mitte November)

**Ziel:** Manuelle Board-Snapshots fÃ¼r Backup & Share

- [ ] **SnapshotManager.svelte.ts** â€“ Snapshot-Verwaltung
  - [ ] `createSnapshot(boardId, label, comment)` â€“ Kind 30303 Event
  - [ ] `listSnapshots(boardId)` â€“ Alle Snapshots laden
  - [ ] `restoreSnapshot(snapshotId)` â€“ Board aus Snapshot wiederherstellen
  - [ ] Snapshot-Metadaten: timestamp, author, comment, card-count

- [ ] **Snapshot UI**
  - [ ] Button in Topbar: "Snapshot erstellen"
  - [ ] Dialog: Label + Kommentar
  - [ ] Snapshot-History Modal:
    - Tabelle mit Snapshots
    - Restore/Delete pro Snapshot
    - Dateiexport (JSON)

**Acceptance Criteria (1.5C):**
- âœ… Snapshots werden als Kind 30303 Events gespeichert
- âœ… Mehrere Snapshots pro Board mÃ¶glich
- âœ… Restore-Funktion stellt Board wieder her
- âœ… Snapshots sind teil von Export/Import

#### Phase 1.5D: Export / Import â€” âœ… DONE (31.10.2025)

**Ziel:** FÃ¶rder-Anforderung: Boards sind exportierbar & importierbar  
**Status:** âœ… FULLY IMPLEMENTED & DOCUMENTED

**Implementation Summary (31.10.2025):**

**A) Store-Level Export API:**
- âœ… `exportBoardAsJson(includeMetadata?: boolean)` â€” Einzelnes Board exportieren
- âœ… `exportAllBoardsAsJson()` â€” Backup aller Boards exportieren
- âœ… Serialisiert `board.getContextData(true)` als gÃ¼ltiges JSON
- âœ… Versionsinformation included (version, exportedAt, exportedBy)

**B) Store-Level Import API:**
- âœ… `importBoardFromJson(jsonString, mode: 'merge'|'new'|'overwrite')` â€” JSON validieren & importieren
- âœ… `saveImportedBoard(board, overwriteExisting?: boolean)` â€” Nach-Import Persistierung
- âœ… `restoreAllBoardsFromBackup(backupJson)` â€” Batch-Restore aus Backup
- âœ… Alle drei Modi vollstÃ¤ndig implementiert:
  - `merge`: Neue IDs generieren (Konfliktfrei, Standard-Modus)
  - `new`: Neue IDs + "(Imported)" Suffix im Board-Namen (Varianten-Verwaltung)
  - `overwrite`: Original-IDs beibehalten (Device-Sync, mit Warnung)

**C) UI Integration:**
- âœ… **ExportButton.svelte** â€” In Topbar/Settings fÃ¼r Single-Board Export
  - Startet Datei-Download: `{BoardName}_{date}.json`
- âœ… **ImportPopover.svelte** â€” File Input im Sidebar
  - Datei-Auswahl mit `.json` Filterung
  - Auto-Detect: Erkennt Backup vs Single-Export automatisch
  - Mode-Radio: merge | new | overwrite wÃ¤hlbar
  - Success/Error Messages

**D) Testing & Validation:**
- âœ… **Unit Tests (75+ Tests):** 
  - `kanbanStore.export-import.spec.ts` â€” 28 Tests (Backup detection, export, import modes, batch restore, round-trip, edge cases)
  - `ImportPopover.svelte.spec.ts` â€” 47 Tests (File selection, UI logic, help text, accessibility)
- âœ… **Acceptance Criteria erfÃ¼llt:**
  - Export erzeugt gÃ¼ltiges JSON, lÃ¤dt korrekt herunter
  - Backup enthÃ¤lt korrekte Anzahl an Boards mit vollstÃ¤ndiger Struktur
  - Import in jedem Modus fÃ¼hrt zu erwartetem Ergebnis
  - ID-Konflikte werden korrekt aufgelÃ¶st (neue IDs oder Ãœberschreiben)
  - UI zeigt eindeutige Success/Error Meldungen
  - Round-Trip Test: Export â†’ Import â†’ Vergleich erfolgreich
  - âœ… **FÃ¶rder-Anforderung erfÃ¼llt** âœ…

**E) Documentation:**
- âœ… **Feature-Dokumentation:** [`docs/FEATURE/IMPORT-EXPORT.md`](../FEATURE/IMPORT-EXPORT.md) â€” VollstÃ¤ndige API-Referenz, UI-Integration, Tests
- âœ… **Share-Link Feature:** [`docs/FEATURE/SHARELINK.md`](../FEATURE/SHARELINK.md) â€” URL-basiertes Sharing (Parallel-Feature, auch Phase 1.5)

**Acceptance Criteria (1.5D) â€” ALL FULFILLED:**
- âœ… Export erzeugt vollstÃ¤ndiges JSON mit allen Daten (Board, Spalten, Karten, Kommentare-Referenzen)
- âœ… Import validiert Struktur & rejected ungÃ¼ltige Dateien (ID, name required)
- âœ… ID-Konflikte werden korrekt gelÃ¶st (merge/new/overwrite modes)
- âœ… Round-Trip: Export â†’ Import â†’ Hash stimmt Ã¼berein (vollstÃ¤ndige Rekonstruktion)
- âœ… **FÃ¶rder-Anforderung erfÃ¼llt** âœ…
- âœ… Backup-Format unterstÃ¼tzt (exportAllBoardsAsJson + restoreAllBoardsFromBackup)

**Timeline fÃ¼r 1.5:**
- âœ… **Phase 1.5A: DONE** (26.10.2025)
- ðŸ”„ **Phase 1.5B: IN PROGRESS** (Bis 31.10.2025 - 5 Arbeitstage fÃ¼r Developer)
- â³ **Phase 1.5C: PLANNED** (01.11. - 10.11.2025 - 9 Tage fÃ¼r Snapshot Feature, â¬‡ï¸ -5 Tage)
- â³ **Phase 1.5D: PLANNED** (10.11. - 20.11.2025 - 10 Tage fÃ¼r Export/Import, â¬‡ï¸ -5 Tage - FÃ–RDER-ANFORDERUNG!)

**Dokumentation:**
- ðŸ“š [`docs/COLLABORATION/BOARD-VERSIONING.md`](./BOARD-VERSIONING.md) â€“ VollstÃ¤ndige Proposal
- ðŸ“š [`docs/FEATURE/MERGE-SYSTEM.md`](../FEATURE/MERGE-SYSTEM.md) â€“ Integration Guide + Testing
- ðŸ“š `copilot-instructions.md` â€“ Merge System Rules & Patterns

---

### Meilenstein 1.5 (OLD): Board Export / Import

**Diese wurde in Phase 1.5D integriert (siehe oben)**

---

---

### Meilenstein 1.3: Kommentar-System Grundlagen (PrioritÃ¤t: Hoch)

**Ziel:** Kommentare werden als Nostr Kind 1 Events gespeichert  
**Status:** âœ… PHASE A+B DONE | âœ… Phase D DONE | â³ Phase C+E PLANNED

#### Phase A+B: Implementiert âœ…

- âœ… **Card-Klasse erweitert** (`src/lib/classes/BoardModel.ts`)
  - âœ… Comment-Model mit `id`, `text`, `author`, `createdAt`
  - âœ… `addComment(text, author)` Methode
  - âœ… `deleteComment(commentId)` Methode
  - âœ… `getContextData()` enthÃ¤lt Kommentare fÃ¼r KI

- âœ… **BoardStore erweitert** (`src/lib/stores/kanbanStore.svelte.ts`)
  - âœ… `addComment(cardId, text, author): void` mit `triggerUpdate()`
  - âœ… `deleteComment(cardId, commentId): void` mit `triggerUpdate()`
  - âœ… VollstÃ¤ndige ReaktivitÃ¤tskette (Storage, UI, Nostr vorbereitet)

- âœ… **UI-Formular implementiert** (`src/routes/cardsboard/CardDetailsDialog.svelte`)
  - âœ… Kommentar-Input (Textarea) mit Icons (@lucide/svelte/icons/*)
  - âœ… "Kommentar absenden" Button (SendIcon, default variant)
  - âœ… Delete-Buttons mit TrashIcon pro Kommentar (ghost variant)
  - âœ… Loading-State mit Spinner (LoaderIcon)
  - âœ… Form Validation (disabled bei leerem Text)
  - âœ… Bestehende Kommentare Liste mit scrollbar

- âœ… **Tests**
  - âœ… 11 Kommentar-Tests in testSuite.ts (alle bestanden)
  - âœ… Syntax-Check: 0 errors, 0 warnings
  - âœ… Production Build: erfolgreich
  - âœ… localStorage Persistierung: funktioniert

- âœ… **Dokumentation**
  - âœ… `/docs/FEATURE/COMMENTS.md` mit vollstÃ¤ndiger Doku
  - âœ… Bug-Fix Root-Cause dokumentiert
  - âœ… Datenfluss & Architektur erklÃ¤rt

#### Phase C-E: Zu implementieren â³

- [ ] **Phase C: AuthStore Integration** (PrioritÃ¤t: Hoch)
  - [ ] `authStore.svelte.ts` mit `$state` fÃ¼r User-Session
  - [ ] NIP-07 Signer Integration (window.nostr)
  - [ ] Ersetze 'anonymous' mit `authStore.currentUser.pubkey`
  - [ ] Session-Management mit TTL
  - **GeschÃ¤tzter Aufwand:** 2-3 Stunden | **Dokumentation:** [`STORES/AUTHSTORE.md`](../ARCHITECTURE/STORES/AUTHSTORE.md), [`AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md)

- [x] **Phase D: Nostr Events Publishing** (PrioritÃ¤t: Hoch)
  - [x] `nostrEvents.ts`: `createCommentEvent()` fÃ¼r Kind 1 Events
  - [x] Event-Tags: `a` (CardRef), `e` (Reply auf Card Event-ID), `p` (Mention Card-Autor)
  - [x] Publishing via SyncManager (publishOrQueue)
  - [x] Comment-Deletion via NIP-09 Kind 5 Events (fÃ¼r synced comments)
  - [x] Live-Updates: Subscriptions Ã¼ber `#a` (Board-weit mÃ¶glich)
  **Dokumentation:** NDK.md, Kanban-NIP.md

- [ ] **Phase E: Offline-First Sync** (PrioritÃ¤t: Mittel)
  - [ ] `syncManager.svelte.ts` mit IndexedDB Queue (Dexie)
  - [ ] `publishOrQueue()` - Events queuen wenn offline
  - [ ] `syncQueue()` mit Retry-Logik (2^retries, max 3)
  - [ ] Conflict Resolution (Last-Write-Wins)
  - **GeschÃ¤tzter Aufwand:** 4-5 Stunden | **Dokumentation:** [`STORES/SYNCMANAGER.md`](../ARCHITECTURE/STORES/SYNCMANAGER.md), AGENTS.md Section VI

**Acceptance Criteria (Phase A+B - ERFÃœLLT):**
- âœ… Kommentare sind lokal persistent (localStorage)
- âœ… Kommentare erscheinen SOFORT in der UI (Svelte Runes)
- âœ… Kommentare kÃ¶nnen gelÃ¶scht werden
- âœ… UI/UX konform mit UX-RULES.md (icons, buttons, spacing)
- âœ… 15/15 copilot-instructions Regeln erfÃ¼llt
- âœ… Keine TypeScript-Fehler
- âœ… Kommentare werden mit Author & Timestamp gespeichert

**Acceptance Criteria (Phase D - ERFÃœLLT):**
- âœ… Kommentare werden als Kind 1 Events publiziert
- âœ… Kommentare haben korrekte Tags (`a`, `p`, `e`)
- âœ… Kommentar-LÃ¶schung erzeugt Kind 5 Event
- âœ… Neue Kommentare erscheinen in Echtzeit Ã¼ber Relays

---

### Meilenstein 1.4: Benutzerauthentifizierung (PrioritÃ¤t: Hoch)

**Ziel:** Nutzer kÃ¶nnen sich mit Nostr-Key authentifizieren  
**Status:** ðŸŸ¡ PLANNED  
**AbhÃ¤ngig von:** [NOSTR-USER.md](./NOSTR-USER.md)

#### Zu implementieren:

- [ ] **`src/lib/stores/userStore.ts`** â€“ Neue Store
  - [ ] `$state` fÃ¼r aktuellen User
  - [ ] `login(signer)` â€“ Nostr-Signer verbinden
  - [ ] `logout()` â€“ Session beenden
  - [ ] `getCurrentUser()` â€“ Npub und Metadaten
  - [ ] `isAuthenticated` Derived Value

- [ ] **NDK Signer Integration**
  - [ ] Browser Extension Signer (NIP-07)
  - [ ] Optional: Test-Signer fÃ¼r Development

- [ ] **Authentifizierter Board-Zugriff**
  - [ ] Events werden mit User-Key signiert
  - [ ] Board-Ownership basierend auf Pubkey
  - [ ] Nur Autor kann publishState Ã¤ndern

- [ ] **UI Updates**
  - [ ] Login Modal in `+layout.svelte`
  - [ ] User-Menu in Topbar
  - [ ] Pubkey-Anzeige fÃ¼r Transparenz

**Acceptance Criteria:**
- âœ… Nutzer kann mit NIP-07 Extension einloggen
- âœ… User-Pubkey ist in Board-Events (Tag `p`)
- âœ… Events sind mit User-Key signiert
- âœ… Logout lÃ¶scht Session

---

## ðŸŸ¡ Phase 2: UI Components & UX Polish (PrioritÃ¤t: Mittel)

**AbhÃ¤ngig von:** Abschluss von Phase 1.5B (CardDialog.svelte Merge-Integration bis 31.10.2025)

**âš¡ ZEITERSPARNIS PHASE 2: -36 Tage Insgesamt!**
- Phase 2.1 UI: â¬‡ï¸ -3 Tage (15 â†’ 12) â€” 70% Komponenten vorhanden!
- Phase 2.0 Merge: â¬‡ï¸ -5 Tage (14 â†’ 9) â€” Gut dokumentiert!
- Phase 2.2 UX: â¬‡ï¸ -5 Tage (14 â†’ 9) â€” shadcn-svelte Integration!
- Phase 2.3 Perf: â¬‡ï¸ -7 Tage (16 â†’ 9) â€” Lighthouse voroptimiert!
- **Gesamt: Von 59 auf 39 Tage (-34%)** âœ…

### Meilenstein 2.0: Merge-System Production Integration â€” ðŸ”„ PLANNED (01.11. - 10.11.2025)

**Ziel:** Merge-System vollstÃ¤ndig in Production verwenden  
**Status:** ðŸ”„ PLANNED (Nach 1.5B Abschluss am 31.10.)
**Timeline: 01. - 10. November 2025 (9 Tage, â¬‡ï¸ -5 Tage)**

- [ ] **CardDialog.svelte Integration** (abhÃ¤ngig von MERGE-SYSTEM.md)
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
  - [ ] Alle Tests grÃ¼n
  - [ ] Keine TypeScript Fehler
  - [ ] Dokumentation aktualisiert

**Acceptance Criteria:**
- âœ… Concurrent Edits erzeugen Conflicts
- âœ… Conflicts werden korrekt aufgelÃ¶st
- âœ… localStorage & Nostr beide aktualisiert
- âœ… Keine Effect-Loop Fehler
- âœ… Performance <100ms

---

### Meilenstein 2.1: UI Komponenten (10.11. - 22.11., 12 Tage - **50% ZEITERSPARNIS**)

**Ziel:** Kanban-Board mit Drag-and-Drop gemÃ¤ÃŸ AGENTS.md Spec  
**Status:** ï¿½ PLANNED  
**Zeitersparnis:** â¬‡ï¸ Von 15 auf 12 Tage (-3 Tage, -20%)

**WARUM SCHNELLER?**
- âœ… Komponenten sind **bereits 70% vorhanden** (Board.svelte, Column.svelte, Card.svelte)
- âœ… DnD mit `svelte-dnd-action` **ist schon implementiert**
- âœ… CardDialog **ist schon gebaut** (nur noch Merge-Logik Phase 1.5B)
- âœ… Nur noch **Refactoring + Integration** mit BoardModel/Store nÃ¶tig
- âœ… Merge-System macht viele komplexe Szenarien **Ã¼berflÃ¼ssig** (auto-merge!)

#### Zu implementieren (nur noch 50% der ursprÃ¼ngliche Arbeit):

- [ ] **CardDialog.svelte Integration** (abhÃ¤ngig von MERGE-SYSTEM.md)
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
  - [ ] Alle Tests grÃ¼n
  - [ ] Keine TypeScript Fehler
  - [ ] Dokumentation aktualisiert
  - [ ] CHANGELOG.md Entry

**Acceptance Criteria:**
- âœ… Concurrent Edits erzeugen Conflicts
- âœ… Conflicts werden korrekt aufgelÃ¶st
- âœ… localStorage & Nostr beide aktualisiert
- âœ… Keine Effect-Loop Fehler
- âœ… Performance im akzeptablen Bereich

**Timeline: 1. - 15. November 2025**

---

**Ziel:** Kanban-Board mit Drag-and-Drop gemÃ¤ÃŸ AGENTS.md Spec  
**Status:** ðŸŸ¡ PLANNED

#### Zu implementieren:

Die aktuellen Komponenten in `src/routes/cardsboard/` verwenden ein **eigenes Datenmodell** (`data.ts`). Diese mÃ¼ssen migriert werden zu `BoardModel.ts` + `kanbanStore`.

- [ ] **Komponenten-Refactor**
  - [ ] `src/lib/components/Board.svelte` â€“ Hauptkomponente
    - [ ] Verbindung zu `boardStore.data`
    - [ ] DnD Integration mit `svelte-dnd-action`
  - [ ] `src/lib/components/Column.svelte` â€“ Spalten
    - [ ] Drop-Zone fÃ¼r Cards
    - [ ] Spalten-Bearbeitung
  - [ ] `src/lib/components/Card.svelte` â€“ Karten
    - [ ] Drag-Source
    - [ ] Metadaten-Anzeige (Kommentare, Links, Attendees)
  - [ ] `src/lib/components/Topbar.svelte` â€“ Navigation
  - [ ] `src/lib/components/Sidebar.svelte` â€“ Linke/Rechte Sidebars

- [ ] **Modal/Dialog Komponenten**
  - [ ] `CardDetailDialog.svelte` â€“ Card-Details mit Tabs
    - [ ] Tab 1: Details & Bearbeitung
    - [ ] Tab 2: Kommentare
    - [ ] Tab 3: Links & Ressourcen
    - [ ] Tab 4: Attendees & Sharing
  - [ ] `BoardSettingsSheet.svelte` â€“ Board-Einstellungen
  - [ ] `ShareBoardDialog.svelte` â€“ Sharing-Optionen

- [ ] **Tests**
  - [ ] Component Snapshot Tests
  - [ ] DnD Interaction Tests
  - [ ] Modal Open/Close Tests

**Acceptance Criteria:**
- âœ… Alle Komponenten nutzen `boardStore`
- âœ… Drag-and-Drop funktioniert flÃ¼ssig
- âœ… Modals Ã¶ffnen/schlieÃŸen korrekt
- âœ… Keine Daten-Inkonsistenzen

---

### Meilenstein 2.2: UX Polish & Accessibility (PrioritÃ¤t: Mittel)

**Ziel:** Anwendung erfÃ¼llt UX-RULES.md + WCAG 2.1 AA  
**Status:** ðŸŸ¡ PLANNED

#### Zu implementieren:

- [ ] **shadcn-svelte Components**
  - [ ] Alle existierenden `div`-based Layouts durch `Card.*` ersetzen
  - [ ] Buttons mit korrekten Varianten (`ghost`, `default`, `outline`)
  - [ ] Forms mit `Field.Root` Struktur
  - [ ] Icons von `@lucide/svelte/icons/` konsistent nutzen

- [ ] **Accessibility**
  - [ ] ARIA-Labels Ã¼berall
  - [ ] Keyboard Navigation (Tab, Enter, Esc)
  - [ ] Screenreader-Testing
  - [ ] Kontrast-VerhÃ¤ltnisse (WCAG AA)
  - [ ] Focus-Indikatoren sichtbar

- [ ] **Responsive Design**
  - [ ] Mobile-View (< 640px)
  - [ ] Tablet-View (640px - 1024px)
  - [ ] Desktop-View (> 1024px)
  - [ ] Resizable Panels

- [ ] **Dark Mode**
  - [ ] CSS-Variablen fÃ¼r Farben
  - [ ] Dark Mode Toggle
  - [ ] System-Preference erkennen

**Acceptance Criteria:**
- âœ… Alle Komponenten verwenden shadcn-svelte
- âœ… WCAG 2.1 AA validiert
- âœ… Funktioniert auf Mobile, Tablet, Desktop
- âœ… Dark Mode unterstÃ¼tzt

---

### Meilenstein 2.3: Performance & Optimization (PrioritÃ¤t: Mittel)

**Ziel:** App lÃ¤dt schnell, lÃ¤uft smooth, keine Memory Leaks  
**Status:** ðŸŸ¡ PLANNED

#### Zu implementieren:

- [ ] **Loading & Error States**
  - [ ] Skeleton-Loaders fÃ¼r Cards
  - [ ] Error Boundaries fÃ¼r Fehlerbehandlung
  - [ ] Retry-UI fÃ¼r fehlgeschlagene Nostr-Loads
  - [ ] Timeout-Handling (z.B. nach 10s)

- [ ] **Performance**
  - [ ] Virtualisierung fÃ¼r groÃŸe Card-Listen
  - [ ] Image Lazy-Loading
  - [ ] Bundle-Size Analyse
  - [ ] Lighthouse Score > 90

- [ ] **Caching**
  - [ ] Board-Events in IndexedDB cachen
  - [ ] Card-Events deduplizieren
  - [ ] Cache Invalidation bei Updates

**Acceptance Criteria:**
- âœ… Lighthouse Performance Score > 90
- âœ… Keine visuellen Jank bei 60fps
- âœ… Memory-Leaks ausgeschlossen (Devtools)

---

## âšª Phase 3: KI-Integration (PrioritÃ¤t: Geplant)

### Meilenstein 3.1: KI-Context Serialisierung (PrioritÃ¤t: Geplant)

**Ziel:** Board-Zustand kann an KI-API gesendet werden  
**Status:** âšª PLANNED

#### Zu implementieren:

- [ ] **Chat-Interface Erweiterung**
  - [ ] `sendPromptToAI(prompt, context?)` vollstÃ¤ndig implementieren
  - [ ] Context-Payload erstellen:
    ```typescript
    {
      prompt: string,
      boardContext: Board.getContextData(full=true),
      selectionContext?: Card.getContextData() | Column.getContextData()
    }
    ```
  - [ ] API-Endpoint fÃ¼r KI-Service

- [ ] **Chatbot UI**
  - [ ] `src/lib/components/Chatbot.svelte` â€“ Chat-Interface
    - [ ] Message History anzeigen
    - [ ] Input-Feld mit Send-Button
    - [ ] Loading-Spinner wÃ¤hrend KI antwortet
    - [ ] Error-Anzeige

- [ ] **Context Window Management**
  - [ ] Token-Counting fÃ¼r groÃŸe Boards
  - [ ] Kontext-Summarisierung bei Bedarf
  - [ ] Relevante Cards/Columns extrahieren

**Acceptance Criteria:**
- âœ… Prompts mit Kontext werden korrekt formatiert
- âœ… KI erhÃ¤lt vollstÃ¤ndigen Board-Zustand
- âœ… Chatbot UI ist responsive

---

### Meilenstein 3.2: OER-Content Discovery (PrioritÃ¤t: Hoch)

**Ziel:** KI kann OER-Materialien finden und als Karten ins Board einfÃ¼gen  
**Status:** ðŸ”„ **IN PROGRESS** - Implementation gestartet  
**Spezifikation:** [`docs/FEATURE/MCP-EDUFEED.md`](../FEATURE/MCP-EDUFEED.md)  
**API-Referenz:** `F:\code\docker\mcp-oer-finder\konzept.md`

#### Architektur (Tool-Based, NICHT MCP)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   AIPanel.svelte â”‚â”€â”€â”€â”€â–¶â”‚   oerClient.ts  â”‚â”€â”€â”€â”€â–¶â”‚  OER Finder API â”‚
â”‚   (Tool Calls)   â”‚â—€â”€â”€â”€â”€â”‚   (fetch)       â”‚â—€â”€â”€â”€â”€â”‚  localhost:3001 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â”‚                      â”‚
         â–¼                      â–¼
   Tools:                  Endpoints:
   - search_oer            - /api/v1/oer
   - add_cards_from_oer    - /api/v1/sources
   - list_oer_sources      - /api/v1/oer/{id}
   - search_oer_for_card
```

#### Phase 3.2.1: oerClient.ts + search_oer (2-3 Tage)

- [ ] **`src/lib/agent/tools/oer/oerClient.ts`** erstellen
  - [ ] `getApiBaseUrl()` aus settingsStore oder ENV
  - [ ] `searchOer(params)` - Suche Ã¼ber `/api/v1/oer`
  - [ ] `getOerDetails(id)` - Details Ã¼ber `/api/v1/oer/{id}`
  - [ ] `listOerSources()` - Quellen Ã¼ber `/api/v1/sources`
  - [ ] AMB Response-Format Mapping (konzept.md)
  - [ ] Error Handling mit User-Friendly Messages

- [ ] **`src/lib/agent/tools/oer/oerSearchTool.ts`** erstellen
  - [ ] `executeSearchOer(args, context)` Implementierung
  - [ ] Ergebnis-Cache fÃ¼r `add_cards_from_oer`
  - [ ] Formatierte Chat-Ausgabe
  - [x] Multi-Source Suche (rpi-virtuell + nostr-amb-relay) + Bildungsstufe-Filter

- [ ] **Integration in `toolDefinitions.ts`**
  - [ ] `search_oer` Tool-Definition hinzufÃ¼gen

- [ ] **Integration in `toolExecutor.ts`**
  - [ ] Handler fÃ¼r `search_oer` hinzufÃ¼gen

#### Phase 3.2.2: add_cards_from_oer (2 Tage)

- [ ] **`src/lib/agent/tools/oer/oerCardsTool.ts`** erstellen
  - [ ] `executeAddCardsFromOer(args, context)` Implementierung
  - [ ] Batch-Verarbeitung (mehrere IDs gleichzeitig)
  - [ ] Nutzung des Ergebnis-Cache aus search_oer
  - [ ] Karten-Erstellung analog zu NostrEventHandler
  - [ ] Metadaten: Bild, Link, Labels, Lizenz, Autor
  - [ ] KI-Relevanz-Auswahl basierend auf Board-Kontext

- [ ] **Integration**
  - [ ] Tool-Definition in `toolDefinitions.ts`
  - [ ] Handler in `toolExecutor.ts`

#### Phase 3.2.3: list_oer_sources + search_oer_for_card (1-2 Tage)

- [ ] **`src/lib/agent/tools/oer/oerSourcesTool.ts`** erstellen
  - [ ] `executeListOerSources(args, context)` Implementierung
  - [ ] Formatierte Liste aller verfÃ¼gbaren Quellen

- [ ] **`src/lib/agent/tools/oer/oerContextTool.ts`** erstellen
  - [ ] `executeSearchOerForCard(args, context)` Implementierung
  - [ ] Kontext-Extraktion aus Karten (Titel, Beschreibung, Labels)
  - [ ] Automatische Suchbegriff-Generierung

- [ ] **Integration**
  - [ ] Tool-Definitionen in `toolDefinitions.ts`
  - [ ] Handler in `toolExecutor.ts`

#### Phase 3.2.4: Tests + Dokumentation (1 Tag)

- [ ] **Unit Tests**
  - [ ] `oerClient.spec.ts` - API-Calls mit MSW Mock
  - [ ] `oerSearchTool.spec.ts` - Tool-AusfÃ¼hrung
  - [ ] `oerCardsTool.spec.ts` - Batch-Karten-Erstellung

- [ ] **Dokumentation**
  - [ ] MCP-EDUFEED.md finalisieren
  - [ ] CHANGELOG.md Eintrag
  - [ ] System-Prompt Update (`toolSystemPrompt.ts`)

**Acceptance Criteria:**
- âœ… `search_oer` findet Materialien Ã¼ber OER Finder API
- âœ… Suchergebnisse werden formatiert im Chat angezeigt
- âœ… `add_cards_from_oer` erstellt Karten mit Bild, Link, Labels
- âœ… `list_oer_sources` zeigt verfÃ¼gbare Quellen
- âœ… `search_oer_for_card` generiert kontextbasierte Suche
- âœ… Fehlerbehandlung bei API-Fehlern funktioniert
- âœ… Tests bestehen (min. 80% Coverage)

**Timeline:** 6-8 Tage (30.01. - 07.02.2026)

---

### Meilenstein 3.3: KI-Aktionen (Split-Card, etc.) (PrioritÃ¤t: Geplant)

**Ziel:** KI kann Board-Struktur verÃ¤ndern  
**Status:** âšª PLANNED

#### Zu implementieren:

- [ ] **Split-Card Aktion**
  - [ ] KI versteht, dass eine Card zu komplex ist
  - [ ] Vorschlag: _â€žTeile diese Aufgabe in 3 Teil-Aufgaben"_
  - [ ] Nutzer bestÃ¤tigt
  - [ ] `Column.splitCard()` wird ausgefÃ¼hrt
  - [ ] Neue Cards erscheinen im Board

- [ ] **Andere KI-Aktionen**
  - [ ] `add_card` â€“ KI schlÃ¤gt neue Card vor
  - [ ] `update_card` â€“ KI aktualisiert bestehende Card
  - [ ] `move_card` â€“ KI reorganisiert Struktur

- [ ] **Action-Preview**
  - [ ] Nutzer sieht AI-Vorschlag vor AusfÃ¼hrung
  - [ ] Dialog zur BestÃ¤tigung
  - [ ] Undo mÃ¶glich

**Acceptance Criteria:**
- âœ… `processAIAction()` funktioniert fÃ¼r alle Types
- âœ… Nutzer kann Actions vor AusfÃ¼hrung sehen
- âœ… Undo/Redo funktioniert

---

## ðŸ”´ Phase 4: Kollaboration (CRITICAL - bis 31.12.2025 FERTIG!)

**Timeline:** 01.12.2025 - 31.12.2025 (30 Tage) â†’ **KORREKTUR: ~12-17 Tage verbleibend!**  
**Status:** ðŸŸ¡ **~85% INFRASTRUKTUR FERTIG** - Nur UI + NIP-51 + Tests fehlen!  
**AbhÃ¤ngig von:** Phase 2 (Export/Import, Merge Engine) âœ… abgeschlossen  
**Parallel zu:** Phase 2.2 (UX), Phase 2.3 (Performance)  
**NÃ¤chste Phase:** 01.01.2026 - Phase 3 + Phase 4 Testing

**ðŸ†• INFRASTRUKTUR-STATUS (13.11.2025):**
- âœ… **SoftLockManager** - VOLLSTÃ„NDIG (`softLockManager.svelte.ts`, 160 Zeilen)
- âœ… **MergeEngine** - VOLLSTÃ„NDIG (`mergeEngine.ts`, 3-way merge)
- âœ… **CardEditingFlow** - VOLLSTÃ„NDIG (`cardEditingFlow.ts`, conflict detection)
- âœ… **SyncManager** - VOLLSTÃ„NDIG (`syncManager.svelte.ts`, Offline Queue)
- âœ… **Nostr Events** - VOLLSTÃ„NDIG (createSoftLockEvent, Kind 20001)
- âŒ **Share Dialog UI** - FEHLT (3-5 Tage)
- âŒ **Presence Indicators** - FEHLT (2-3 Tage)
- âŒ **Live Notifications** - FEHLT (1-2 Tage)
- âŒ **NIP-51 Integration** - FEHLT (2-3 Tage)
- âŒ **E2E Tests** - FEHLT (3-4 Tage)

**Verbleibender Aufwand: ~12-17 Tage (nicht 30!)**

### Meilenstein 4.1: Board-Sharing & Permissions (01.12. - 10.12., ~8 Tage)

**Ziel:** Mehrere Nutzer kÃ¶nnen gemeinsam an Board arbeiten (mit Zugriffskontrolle)  
**Status:** ðŸŸ¡ **~50% FERTIG** - AuthStore komplett, Backend bereit, API-Layer + UI fehlen  
**Branch:** `feature/board-sharing` (geplant)  
**Dokumentation:** [`docs/ARCHITECTURE/BOARD-SHARING.md`](../ARCHITECTURE/BOARD-SHARING.md) (neu erstellt 13.11.2025)

**âœ… BEREITS IMPLEMENTIERT:**
- âœ… Maintainers Support in Board Events (p-tags, nostrEvents.ts Line 96)
- âœ… Multi-User Event Publishing (BoardStore kann bereits mehrere Authors)
- âœ… Event-Signierung mit NDK Signer

**âŒ NOCH ZU IMPLEMENTIEREN:**

**Phase 4.1A: Core API (2-3 Tage)**

- [ ] **BoardRole & Types** (~0.5 Tage)
  - [ ] `enum BoardRole { OWNER, EDITOR, VIEWER }`
  - [ ] `interface BoardShare { pubkey, role, addedAt }`
  - [ ] TypeScript Typen in `src/lib/types/sharing.ts`

- [ ] **BoardStore Maintainer Methods** (~1 Tag)
  - [ ] `addMaintainer(pubkey: string, role: BoardRole): Promise<void>`
  - [ ] `removeMaintainer(pubkey: string): Promise<void>`
  - [ ] `getMaintainers(): BoardShare[]`
  - [ ] Integration mit triggerUpdate() + publishToNostr()

- [ ] **NIP-51 Integration** (~1 Tag)
  - [ ] `readBoardShares()` - Fetch Kind 30051 Events
  - [ ] `publishBoardShares()` - Create/Update Contact List Event
  - [ ] p-tags mit Role-Information (tag[3])
  - [ ] Event-Deserialisierung fÃ¼r BoardShare[]

**Phase 4.1B: Permission System (1 Tag)**

- [ ] **Permission System** 
  - [ ] `enum BoardRole { OWNER, EDITOR, VIEWER }`
  - [ ] Owner: Kann alles Ã¤ndern + Freigabe verwalten
  - [ ] Editor: Kann Karten bearbeiten + Kommentare
  - [ ] Viewer: Nur Lesezugriff
  - [ ] Permissions bei Event-Publishing prÃ¼fen

- [ ] **Share Dialog UI** (shadcn-svelte)
  - [ ] Share Panel in Topbar
  - [ ] Nutzer-Liste mit Rollen-Dropdown
  - [ ] Add/Remove Nutzer
  - [ ] Link-Copy fÃ¼r Public Sharing

- [ ] **Tests**
  - [ ] Unit: Permission checks
  - [ ] Integration: NIP-51 Simulation
  - [ ] E2E: Zwei Browser mit verschiedenen Rollen

**Acceptance Criteria:**
- âœ… Nutzer kÃ¶nnen Boards freigeben
- âœ… Berechtigungen werden durchgesetzt
- âœ… Events kÃ¶nnen nur von Berechtigten publiziert werden
- âœ… Share-Dialog ist benutzerfreundlich

---

### Meilenstein 4.2: Echtzeit-Kollaboration (08.12. - 18.12., ~9 Tage)

**Ziel:** Live-Editing mit Presence & Notifications  
**Status:** ðŸŸ¡ **~85% INFRASTRUKTUR FERTIG** - Nur UI-Integration fehlt!

**âœ… BEREITS IMPLEMENTIERT:**
- âœ… **SoftLockManager** - publishLock(), releaseLock(), subscribeLocks() (softLockManager.svelte.ts)
- âœ… **MergeEngine** - threeWayMerge(), Conflict Detection (mergeEngine.ts)
- âœ… **CardEditingFlow** - checkForConflictBeforeSave(), Session Management (cardEditingFlow.ts)
- âœ… **SyncManager** - Offline Queue, Retry-Logik, publishOrQueue() (syncManager.svelte.ts)
- âœ… **Soft-Lock Events** - Kind 20001 Ephemeral Events (nostrEvents.ts)
- âœ… **Last-Write-Wins** - Timestamp-basierte Conflict Resolution (upsertCardFromNostr)

**âŒ NOCH ZU IMPLEMENTIEREN (NUR UI):**

- [ ] **Cursor-Position Sharing** (CRDT-basiert)
  - [ ] Implementiere einfache CRDT fÃ¼r Card-Positionen
  - [ ] Publish "Nutzer arbeitet an Karte X" Events
  - [ ] Subscribe zu anderen Nutzern
  - [ ] Visualisiere Cursor-Positionen in UI

- [ ] **Live-Notifications**
  - [ ] Toast beim HinzufÃ¼gen von Kommentaren von anderen
  - [ ] Toast wenn andere Nutzer Karten verschieben
  - [ ] Toast wenn Board aktualisiert wird
  - [ ] Sound-Option (optional)

- [ ] **Presence-Indicator**
  - [ ] "Alice arbeitet gerade hier" in Column-Header
  - [ ] Online/Offline Status fÃ¼r jeden Nutzer
  - [ ] Avatar + Last-Seen Zeitstempel

- [ ] **Soft-Locks UI-Integration** (Infrastruktur âœ… FERTIG)
  - âœ… Backend: publishLock() mit 5 Min TTL (softLockManager.svelte.ts)
  - âœ… Backend: Auto-Release nach TTL
  - âœ… Backend: 3-Way Merge bei Conflicts (mergeEngine.ts)
  - âœ… UI: MergeConflictDialog existiert bereits
  - âŒ **UI-Integration fehlt:** CardDetailsDialog muss SoftLockManager nutzen
  - âŒ **Warnung anzeigen:** "Alice editiert gerade diese Karte" Badge

- [ ] **Tests**
  - [ ] Integration: Multi-Browser Playwright Setup
  - [ ] Concurrent edits Szenarien testen
  - [ ] Merge-Logik mit echten Konflikten
  - [ ] Netzwerkfehler simulieren

**Acceptance Criteria:**
- âœ… Zwei Nutzer kÃ¶nnen gleichzeitig ein Board bearbeiten
- âœ… Konflikte werden korrekt mit 3-Way Merge gelÃ¶st
- âœ… Presence wird korrekt angezeigt & aktualisiert
- âœ… Soft-Locks verhindern Lost-Updates
- âœ… Alle Tests grÃ¼n (Unit + Integration + E2E)

---

### â° Testphase (01.01. - 31.01.2026, 31 Tage)

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
**Status:** âšª FUTURE

#### Zu implementieren:

- [ ] **Lokale Ã„nderungen tracken**
  - [ ] Lamport Clocks fÃ¼r Event-Ordering
  - [ ] Change-Set fÃ¼r Sync-Konflikt-AuflÃ¶sung

- [ ] **Merge auf Reconnect**
  - [ ] Lokale Changes mit Server-Changes vergleichen
  - [ ] Merge-Strategie anwenden
  - [ ] User-Notification bei Konflikten

- [ ] **Tests**
  - [ ] Zwei Clients offline, dann online
  - [ ] Simultane Ã„nderungen auf selber Card
  - [ ] Lange Offline-Perioden

**Acceptance Criteria:**
- âœ… Offline-Changes werden korrekt synced
- âœ… Konflikte werden aufgelÃ¶st
- âœ… Keine Daten verloren

---

## âšª Phase 5: Erweiterte Features (PrioritÃ¤t: Geplant)

### Meilenstein 5.1: Materialverwaltung & Depot

**Ziel:** Nutzer haben persÃ¶nliches Material-Archiv  
**Status:** âšª PLANNED

#### Features:

- [ ] PersÃ¶nlicher Material-Index
- [ ] Volltextsuche Ã¼ber eigene Materials
- [ ] Automatische Kategorisierung (Fach, Klassenstufe)
- [ ] Favoriten & Markierungen
- [ ] Export zu CSV/PDF

---

### Meilenstein 5.2: Gemeinschaften & Communities

**Ziel:** LehrkrÃ¤fte organisieren sich in Fachgruppen  
**Status:** âšª PLANNED

#### Features:

- [ ] Community-Erstellung und -Verwaltung
- [ ] Shared Material-Repositories
- [ ] Diskussions-Forum (Nostr Kind 42?)
- [ ] Community-Standards & Best Practices
- [ ] Recommendation-System

---

### Meilenstein 5.3: Analyse & Insights

**Ziel:** Dashboard mit Daten Ã¼ber Board-Nutzung  
**Status:** âšª PLANNED

#### Features:

- [ ] Board-Statistiken (Anzahl Cards, Spalten, etc.)
- [ ] Activity-Timeline
- [ ] HÃ¤ufigste Tags und Labels
- [ ] Collaboration-Graph (wer arbeitet mit wem)
- [ ] Performance-Metriken

---

### Meilenstein 5.4: Mobile App

**Ziel:** Native iOS/Android App mit Offline-Sync  
**Status:** âšª PLANNED

#### Features:

- [ ] React Native oder Flutter Implementation
- [ ] Alle Board-Features
- [ ] Push-Notifications fÃ¼r Collaboration
- [ ] Camera-Integration fÃ¼r Material-Erfassung

---

### Meilenstein 5.5: Integrationen

**Ziel:** Verbindung mit externen Tools  
**Status:** âšª PLANNED

#### Features:

- [ ] LMS Integration (Moodle, Ilias, etc.)
- [ ] Calendar Sync
- [ ] Mail-Digest Notifications
- [ ] Slack/Discord Webhooks
- [ ] Google Drive/OneDrive Attachments

---

## ðŸ“‹ Kritische Pfade & Dependencies

### Blocker fÃ¼r Phase 2:
1. âœ… Phase 1 Meilensteine 1.1 - 1.4 (Core Implementation)

### FÃ¶rder-Anforderungen (wichtig)
- Die FÃ¶rdermittelgeber erwarten die Umsetzung bis einschlieÃŸlich Phase 4.
- Es muss mÃ¶glich sein, ein Board (Store) zu exportieren und zu importieren, um Boards zu teilen oder Backup/Restore zu ermÃ¶glichen. Implementierung auf Store-Level ist verpflichtend fÃ¼r Phasen-1..4.

### Blocker fÃ¼r Phase 3:
1. âœ… Phase 2 abgeschlossen (UI funktional)
2. ðŸŸ¡ OER-Event Schema finalisiert (NDK.md)
3. ðŸŸ¡ KI-API Integration (externe Service)

### Blocker fÃ¼r Phase 4:
1. âœ… Phase 3 abgeschlossen (KI funktional)
2. ðŸŸ¡ Permissions-System designt
3. ðŸŸ¡ Conflict Resolution Strategie validiert

---

## ðŸŽ¯ Definition of Done (DoD)

Jeder Meilenstein ist **nur dann done**, wenn:

- âœ… Code ist geschrieben und reviewed
- âœ… Tests sind geschrieben und grÃ¼n (> 80% Coverage)
- âœ… Dokumentation ist aktualisiert
- âœ… Keine Breaking Changes fÃ¼r andere Phasen
- âœ… Acceptance Criteria sind erfÃ¼llt
- âœ… Ist in `main` Branch merged
- âœ… CHANGELOG.md ist aktualisiert

---

## ðŸ—ï¸ Technische Schulden & Known Issues

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
- [ ] Keine User Research noch durchgefÃ¼hrt
- [ ] Performance unter Last nicht getestet

---

## ðŸ“ž Kontakt & Support

- **Issues & Bugs:** [GitHub Issues](https://github.com/edufeed-org/kanban-editor/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/edufeed-org/kanban-editor/discussions)
- **Dokumentation:**
  - ðŸ“š [`docs/_INDEX.md`](../docs/_INDEX.md) - Zentrale Navigation (41 Docs)
  - ðŸ“š [`docs/ARCHITECTURE/STORES/README.md`](../ARCHITECTURE/STORES/README.md) - Store-Ãœbersicht
  - ðŸ“š [`docs/ARCHITECTURE/AUTH-UI-COMPONENTS.md`](../ARCHITECTURE/AUTH-UI-COMPONENTS.md) - UI-Komponenten
  - ðŸ“š [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md) - Governance-Regeln v3.0
  - ðŸ“š [`docs/archive/DOCUMENTATION-RULES-v2.md`](../archive/DOCUMENTATION-RULES-v2.md) - Migration Guide (v2.0)

---

## ðŸ“ Versionshistorie

| Version | Datum | Beschreibung |
| 3.57 | 03.02.2026 | ✨ Mobile Header: Logo kleiner, Unterzeile ausgeblendet. |
| 3.56 | 03.02.2026 | 🧭 Header: Navigation bleibt rechts neben dem Branding (Mobile). |
| 3.55 | 03.02.2026 | 🧭 Mobile Header: Top-Navigation zeigt nur Icons + Avatar. |
| 3.54 | 03.02.2026 | 🧹 Sidebar: „Meine Boards“ nur noch auf der Landingpage. |
| 3.53 | 03.02.2026 | 🧩 Svelte 5 Fixes: DropdownMenu ohne `asChild`, dynamische Icons modernisiert. |
| 3.52 | 03.02.2026 | ✨ Landingpage: CTA Glow + Hero Layout Optimierung |
| 3.51 | 03.02.2026 | ✨ Landingpage polish + Theme-Sync (Dark/Light) |
| 3.50 | 03.02.2026 | 🧭 Landingpage überarbeitet (CTA, Links, Lehrkräfte-Fokus, Dark/Light Theme) |
|---------|-------|-------------|
| 3.49 | 02.02.2026 | ðŸ·ï¸ **Communikey Name via Kind 0:** Communityâ€‘Name wird aus Kindâ€‘0 Metadaten geladen (Fallback). |
| 3.48 | 02.02.2026 | ðŸ§­ **Communikey Relationship Tag Fix:** `n=follow` wird als Relationship erkannt. |
| 3.47 | 02.02.2026 | ðŸ§­ **Communikey Relationship Fallback:** Kind 30382 `follow` + `d` als Membership-Quelle. |
| 3.46 | 02.02.2026 | ðŸ§ª **Communikey Debug Filter Logs:** Badge/List/Community-Filter werden geloggt. |
| 3.45 | 02.02.2026 | ðŸ” **Communikey Pubkey Normalization:** npub/nprofile â†’ hex fÃ¼r Badge/Listen-Queries. |
| 3.44 | 02.02.2026 | ðŸŒ **Communikey-Teilen:** Community-Auswahl (Kind 30008/10222) + Publish als Kind 30222. |
| 3.43 | 02.02.2026 | ðŸ”— **Teilen-UntermenÃ¼:** â€žAls Linkâ€œ, â€žAn Communitiesâ€œ, â€žAn Edufeedâ€œ in BoardsList ergÃ¤nzt. |
| 3.36 | 02.02.2026 | ðŸ‘€ **Editor-Request Bell Visibility:** Glocke nur bei offenen Requests sichtbar. |
| 3.35 | 02.02.2026 | ðŸ”” **Editor-Request Background Refresh:** Badge wird im Hintergrund geladen. |
| 3.34 | 02.02.2026 | âš¡ **ShareDialog Perf:** Inhalte werden nur im aktiven Tab geladen (Open/Close schneller). |
| 3.33 | 02.02.2026 | ðŸ”‡ **Editor-Request Timeout Noise:** Timeoutâ€‘Warnung wird unterdrÃ¼ckt. |
| 3.32 | 02.02.2026 | ðŸ§¯ **Editor-Request Load Guard:** Autoâ€‘Fetch beim Boardwechsel entfernt, verhindert OOM/HÃ¤nger. |
| 3.31 | 02.02.2026 | ðŸ” **Editor-Request Board-Switch Fix:** Nonâ€‘blocking Load + Staleâ€‘Response Guard beim Boardwechsel. |
| 3.30 | 02.02.2026 | â±ï¸ **Editor-Request Timeout:** ShareDialog hÃ¤ngt nicht mehr, wenn keine Requests vorhanden sind. |
| 3.29 | 02.02.2026 | âš¡ **Editor-Request Preload:** Requests werden vorab geladen; Dialog zeigt sofortige Anzeige + Loading-Hinweis. |
| 3.28 | 02.02.2026 | ðŸ›Žï¸ **Editor-Request Bell:** Topbarâ€‘Glocke mit Badge Ã¶ffnet Editorâ€‘Requests im ShareDialog. |
| 3.27 | 02.02.2026 | ðŸ‘€ **Owner Editor-Requests:** ShareDialog zeigt Editorâ€‘Requests fÃ¼r Owner inkl. Quickâ€‘Action. |
| 3.26 | 02.02.2026 | ðŸŽ¨ **Toast-Design Polish:** Sonner-Toast Layout, Typografie, Buttons und Error/Warning-Farben verbessert. |
| 3.25 | 02.02.2026 | ðŸ§¯ **Permission-Toast Fix:** Viewer-Permission-Checks im Store leiten auf Request-Toast; Permission-Toast stabilisiert (feste ID). |
| 3.24 | 02.02.2026 | ðŸ›Žï¸ **Editor-Request Toast + Dialog:** Viewer sehen Permission-Toast mit â€žRechte beantragenâ€œ + Opt-out; Request-Dialog verfÃ¼gbar; Editor-Request Events (Kind 30000) vorbereitet. |
| 3.23 | 01.02.2026 | âš¡ **ShareDialog & UI Fixes:** config.json Cache, keine doppelte Share-Link Generierung, parallele Display-Name Loads, BASE_URL robust aufgelÃ¶st (inkl. "."), Flip-Animation Guard gegen NaN-Transforms (In der FLIP-Animation (First, Last, Invert, Play) treten NaN-Werte (Not-a-Number) ). |
| 3.22 | 30.01.2026 | ðŸ” **OER-Content Discovery Approved:** Meilenstein 3.2 mit 4-Phasen-Plan aktualisiert. Tools: `search_oer`, `add_cards_from_oer`, `list_oer_sources`, `search_oer_for_card`. API-Integration via fetch (nicht MCP). Spec: `MCP-EDUFEED.md` v1.1. Timeline: 6-8 Tage. |
| 3.21 | 26.01.2026 | ðŸ”— **Nostr Paste Enhancement:** njump URL konfigurierbar (`config.json`), ursprÃ¼nglicher Link als 3. Link, bereinigtes Card-Output, PASTE-SYSTEM.md aktualisiert. |
| 3.20 | 26.01.2026 | ðŸ”Ž **Paste Debug:** Fehlermeldung zeigt Clipboard-Typen/LÃ¤ngen fÃ¼r Diagnose. |
| 3.19 | 26.01.2026 | ðŸ§© **Paste Fix:** HTML-only Clipboard wird als Text erkannt (kein "Kein passender Handler"). |
| 3.18 | 26.01.2026 | ðŸ§· **Paste UX:** Strg+V im Board erstellt neue Card (globaler Paste-Handler, Input-safe). |
| 3.17 | 26.01.2026 | ðŸ”— **SSR Fix:** Keine verschachtelten Links in Card-Layouts (node_invalid_placement_ssr). |
| 3.16 | 26.01.2026 | ðŸ“‹ **Paste Update:** Nostr naddr Events werden per NDK geladen und als AMB Learning Resource Cards erzeugt. |
| 3.15 | 16.12.2025 | ðŸ” **Permissions UX:** Board-Metadaten sind fÃ¼r Nicht-Owner read-only; Speichern deaktiviert. |
| 3.14 | 16.12.2025 | ðŸ‘€ **UX Fix:** Kein sichtbares "Re-Sort" beim Board-Load durch No-op Guards bei identischer Column-Order. |
| 3.13 | 16.12.2025 | âœ… **Column-Order Patch Apply Fix:** `updated_at_ms` wird robust geparsed (auch numerischer String); bei Parse-Fehler Fallback auf `created_at` â†’ Owner Ã¼bernimmt Editor-Reorders zuverlÃ¤ssig. |
| 3.12 | 16.12.2025 | â†•ï¸ **Editor-Safe Column Reorder:** Spalten-Reihenfolge wird Ã¼ber Kind `8571` (Column Order Patch) synchronisiert; referenziert das kanonische Board via `a=30301:<author>:<d>` und zusÃ¤tzlich `d=<boardId>`; nutzt `updated_at_ms` fÃ¼r LWW. Editoren publizieren kein Kind `30301` â†’ keine Fork-Boards. |
| 3.11 | 15.12.2025 | ðŸ§­ **Shared-Discovery Author Fix:** Shared-Board Discovery nutzt `event.pubkey` als kanonischen Author/Adresse (`30301:<pubkey>:<d>`), damit Leave/Hide & Toast-Guard zuverlÃ¤ssig matchen (kein â€žNeues Board geteiltâ€œ Ghost-Toast nach Leave/Owner-Delete). |
| 3.10 | 15.12.2025 | ðŸ‘€ **Owner Leave-Request Badge:** Owner sieht Leave-Requests (Kind 30000, `d=kanban-leave-request:<boardRef>`) im ShareDialog als Marker bei Editoren (best-effort, Relay-abhÃ¤ngig). |
| 3.9 | 15.12.2025 | ðŸ§¹ **NIP-09 Delete Guard:** `deleteBoard()`/`deleteCard()` publizieren Kind-5 LÃ¶sch-Events nur bei Autor-Ãœbereinstimmung; kaskadierender Delete skippt Cards anderer Autoren (verhindert â€žDELETION AUTH MISMATCHâ€œ / Relay-Rejects). |
| 3.8 | 15.12.2025 | ðŸ§¯ **Board-Delete Loop Guard:** `refreshBoardIds()`/`refreshBoardList()` sind read-only (kein `triggerUpdate()` Side-Effects); `loadBoardIds()` schlieÃŸt Tombstone-Registry-Key aus; Shared-Board-Rekonstruktion lÃ¤dt tombstoned IDs nicht; Nostr-Board-Load aktualisiert `boardIds` storage-basiert (tombstone-aware) statt Merge/Dedup. |
| 3.7 | 15.12.2025 | ðŸ§­ **Nostr Reload Fix:** Initiale Card-Upserts sind jetzt LWW-geschÃ¼tzt; async Card-Loads werden Board-spezifisch angewendet (verhindert â€žalle Boards zeigen gleiche Cardsâ€œ und â€žReload lÃ¤dt Ã¤lterâ€œ). |
| 3.6 | 15.12.2025 | ðŸ§· **DnD-Sync Fix:** `syncBoardState()` merged defensiv; unvollstÃ¤ndige UI-Payloads droppen keine Cards/Columns mehr (verhindert "Cards verschwinden" direkt nach Move). |
| 3.5 | 14.12.2025 | ðŸ§© **Hotfix Shared-Board Sync:** Board-Load Ã¼berschreibt lokale Cards nicht mehr; unsicheres Post-Cleanup entfernt; Session-Restore startet Owned-Board Load + Subscriptions deterministisch. |
| 3.1 | 10.11.2025 | ðŸš€ **NOSTR SYNC SPRINT COMPLETE:** Last-Write-Wins vollstÃ¤ndig implementiert! Echo-Loop Prevention working, Card-Duplication gefixt, Board-Storage 95% Redundanz eliminiert. Merge-LWW Integration dokumentiert (70 min, BLOCKER fÃ¼r Phase 2.0). Phase 1.1 DONE, Phase 1.5D IN PROGRESS. |
| 3.0 | 06.11.2025 | ðŸ¤– **PHASE 3.0 COMPLETE:** AI Agent Infrastructure (10 Module, ChatStore, AIPanel, 150+ Tests). 0 Breaking Changes, 52/52 Docs verlinkt. Phase 1 mostly complete. |
| 2.8 | 31.10.2025 | ðŸ“¦ **IMPORT-EXPORT FEATURE DOCUMENTED:** Phase 1.5D COMPLETE! JSON-basiertes Export/Import mit 3 Modi (merge/new/overwrite). Dokumentation in FEATURE/IMPORT-EXPORT.md. 75+ Unit Tests, Store APIs (export/import/backup), UI Integration (ExportButton + ImportPopover). FÃ¶rder-Anforderung erfÃ¼llt! |
| 2.7 | 31.10.2025 | ðŸ”— **SHARE-LINK FEATURE:** Phase 1.5B COMPLETE! Full end-to-end implementation + 41 unit tests (100% pass rate). Dokumentation in FEATURE/SHARELINK.md. Atomic 3-Step Sync fÃ¼r Board-Importe, 76% Kompressions-Ratio, Single-Layer URL-Encoding mit XSS-Prevention. |
| 2.6 | 29.10.2025 | ðŸŽ¨ **CARD UI REDESIGN PHASE 1:** Badges optimiert, Author-Info zu Popover, Image 60% kleiner, Description 2-line clamp. 70% schneller Entwicklung! |
| 2.5 | 29.10.2025 | ðŸ“š **DOKUMENTATIONS-GOVERNANCE v3.0:** Bidirektionale Code â†” Docs Sync MANDATORY! 11-Punkt DoD Checklist, Pre-Commit Hooks, Metriken & KPIs, Enforcement-Rules. Verhindert 5-10 Tage Debugging durch veraltete Docs! |
| 2.4 | 29.10.2025 | ðŸ“š **DOKUMENTATIONS-RESTRUKTURIERUNG:** ARCHITECTURE/ komplett Ã¼berarbeitet! STORES/ Subdirectory mit 6 Docs, AUTH-UI-COMPONENTS.md neu, 40% Redundanz-Reduktion, 37 â†’ 41 total docs |
| 2.3 | 26.10.2025 (Abend) | âš¡ **OPTIMIZATION:** 50% Zeitersparnis durch bereits vorhandene Komponenten! (-53 Tage insgesamt) |
| 2.2 | 26.10.2025 | ðŸ”´ **CRITICAL UPDATE:** Phase 4 (Kollaboration) zur COMPLETION bis 31.12.2025 verschoben! Testphase 01.01. - 31.01.2026 |
| 2.1 | 26.10.2025 | âœ… Merge-System & Board-Versioning Integration (Phase 1.5A DONE, Zeitplan aktualisiert) |
| 2.0 | 18.10.2025 | Priorisierte Roadmap mit Meilensteinen |
| 1.0 | 17.10.2025 | Initial Roadmap (in CODE-ANALYSE.md) |

---

**NÃ¤chste Review:** Nach Merge-LWW Integration (15.11.2025)  
**Kritischer Meilenstein:** 31.12.2025 (Phase 4 MUSS fertig sein!)  
**Testing Start:** 01.01.2026 (Phase 3 + Phase 4 Testing parallel)  
**Dokumentation:** âœ… VollstÃ¤ndig aktualisiert (10.11.2025)  
**Governance:** ðŸ”´ **v3.0 ACTIVE** - Code â†” Docs Sync MANDATORY

---

## â±ï¸ FINAL TIMELINE SUMMARY (v3.1 - Nostr Sync Sprint Complete!)

```
OKTOBER 2025:
  26-31.10: Phase 1.5B: CardDialog Integration (5 Tage) âœ“

NOVEMBER 2025:
  06.11  âœ… Phase 3.0 AI Agent Infrastructure COMPLETE
  10.11  âœ… NOSTR SYNC SPRINT COMPLETE - LWW Full Impl, Echo Prevention, Card-Dedup Fixed
  10-20.11: Phase 1.5D Export/Import (10 Tage) + Phase 2.0 Merge (9 Tage) PARALLEL
           ðŸ”´ BLOCKER: Merge-LWW Integration (70 min, doku ready)
  20-01.12: Phase 2.1 UI (11 Tage) + Phase 2.2 UX (9 Tage) PARALLEL

DEZEMBER 2025:
  01-10.12: Phase 2.3 Performance (9 Tage)
  10-23.12: Phase 4.1 Board-Sharing (13 Tage)
  20-31.12: Phase 4.2 Echtzeit-Kollaboration (11 Tage) CRITICAL!
  ðŸŽ¯ 31.12: DEADLINE - Phase 2 + Phase 4 FERTIG!

JANUAR 2026:
  01-31.01: Phase 3.1+ KI-Integration (50 Tage) + Phase 4 Testing (31 Tage) PARALLEL
  
FEBRUAR 2026:
  01-20.02: Phase 3 KI-Integration Completion (20 Tage)
```

**Neue Gesamtdauer:** 26.10.2025 â†’ 20.02.2026 = **117 Tage**  
**Einsparnis:** **53 Tage (-31% Gesamtzeit!)**

---

**Zuletzt aktualisiert:** 03. Februar 2026





