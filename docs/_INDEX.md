# 📚 Dokumentations-Index & Navigation

**Willkommen in der offiziellen Dokumentation des Nostr-basierten KI-Kanban-Boards!**

Dieses Verzeichnis hilft dir, die richtige Dokumentation schnell zu finden. Wähle deine Rolle oder dein Ziel:

---

## 🔴 WICHTIG: DOKUMENTATIONS-GOVERNANCE v3.0

**Neue Dokumentation? Lies ZUERST:** [`DOCUMENTATION-RULES-v3.md`](./DOCUMENTATION-RULES-v3.md)

**Die 7 Goldenen Regeln (v3.0):**
1. 🔴 Alles in `/docs/` speichern (keine Ausnahmen!)
2. 🔴 EIN Thema = EIN Dokument (nicht 5 Splits!)
3. 🟡 5-Abschnitt Struktur (Übersicht, Quick Start, Details, Fehler, Refs)
4. 🟢 In `_INDEX.md` verlinken (damit sichtbar)
5. 🟢 Ordner-Struktur einhalten (ARCHITECTURE/, GUIDES/, etc.)
6. 🔴 **NEU:** Code → Docs Sync (11-Punkt DoD bei Code-Änderungen)
7. 🔴 **NEU:** Docs → Code Sync (Audit bei Docs-Updates)

**Migration:** [`DOCUMENTATION-RULES-v2.md`](./DOCUMENTATION-RULES-v2.md) (v2.0 deprecated)

**Nicht befolgen = PR REJECTED! 📖⚠️**

---

## 📊 CODEBASE ANALYSIS RESULTS (13. November 2025) ⭐ NEW

**Umfassende Analyse aller Phasen durchgeführt! Überraschend viel Code gefunden!**

### 🎯 For Stakeholder / Product Owner

1. **[📊 EXECUTIVE-SUMMARY.md](./EXECUTIVE-SUMMARY.md)** ⭐ START HERE!
   - One-pager: Was ist der aktuelle Stand?
   - 🚨 Realistische Deadline: 25.01.2026 (nicht 31.12.2025!)
   - Kritische Erkenntnisse pro Phase
   - Risiken & Mitigationen

2. **[📈 PROGRESS-TRACKING.md](./PROGRESS-TRACKING.md)** ⭐ REFERENCE
   - Detaillierte Phase-Übersicht mit Code-Locations
   - Was ist DONE, was ist PENDING (mit Zeilen-Nummern!)
   - Realistic Timeline
   - Definition of Done pro Phase
   - Weekly Status Template

3. **[🎯 ACTION-ITEMS.md](./ACTION-ITEMS.md)** ⭐ IMMEDIATE ACTIONS
   - Was muss HEUTE passieren? (13.11)
   - Diese Woche (15-17.11)
   - Nächste Wochen
   - Sign-off Checkliste

4. **[🗺️ COLLABORATION/ROADMAP.md](./COLLABORATION/ROADMAP.md)**
   - Vollständige Roadmap mit zeitlichen Details
   - Kritische Pfade & Dependencies
   - Phase-Details

### 📊 Analyse-Highlights

| Finding | Details | Impact |
|---------|---------|--------|
| **Phase 1: 90% DONE** | Author, Publishing, Comments, Merge, Export/Import | Awesome! |
| **Phase 3: 95% DONE!** ⭐ | ChatStore (668L), AIPanel (1421L), Agents (2000L+!) | Can deploy early! |
| **Phase 2: 5% Done** | Components exist, need integration (15 days) | More work than expected |
| **Phase 4: 0% Done** | 26-30 days needed, only 19 days until 31.12 | ❌ IMPOSSIBLE DEADLINE |
| **Code Quality** | 3500+ lines + 800+ tests already done | Great foundation! |
| **Realistic Deadline** | 25.01.2026 (not 31.12.2025) | -8 Tage to deadline |

---

## 🧪 TESTING & VALIDIERUNG (7. November 2025)

**✅ Relay Selection Implementation COMPLETE:**
- [`TESTING/RELAY-SELECTION-TEST-GUIDE.md`](./TESTING/RELAY-SELECTION-TEST-GUIDE.md) — Vollständiger Test-Guide mit Validierungs-Checkliste
- [`ARCHITECTURE/NOSTR/DRAFT-PUBLISHING-STRATEGY.md`](./ARCHITECTURE/NOSTR/DRAFT-PUBLISHING-STRATEGY.md) — ✅ **UPDATED:** Von "PROPOSAL" zu "IMPLEMENTED & TESTED"
- ✅ **Alle Tests bestanden** - Stack trace validated single call path
- ✅ **4 Bugs identifiziert & gefixt:**
  1. Duplicate console logs (removed)
  2. Svelte $state Proxy conversion (fixed with spread operator)
  3. NDK auto-connect logs (clarified)
  4. "Duplicate event publishing" false alarm (investigated & resolved)

---

## 🎯 Nach Rolle

### 👨‍💼 Product Manager / Stakeholder
**Ziel:** Produkt-Vision, Roadmap, Features verstehen

1. **Start:** [`README.md`](../README.md) (15 min Überblick)
2. **Vertiefung:** [`KONZEPT.md`](../KONZEPT.md) (Vision & Use Cases)
3. **🔴 KRITISCH:** [`PROGRESS-TRACKING.md`](./PROGRESS-TRACKING.md) ⭐ **NEW** - **Detaillierte Phase-Status mit Code-Locations!**
4. **Detailed Roadmap:** [`COLLABORATION/ROADMAP.md`](./COLLABORATION/ROADMAP.md) (Phasen, Meilensteine & Timeline)
5. **Support:** [`COLLABORATION/CONTRIBUTING.md`](./COLLABORATION/CONTRIBUTING.md) (Contribution Policy)

**🚨 WICHTIG - REALISTISCHE DEADLINE:** 
- **Phase 1:** ✅ 90% (1.0-1.5 DONE, 1.2+1.4 geplant)
- **Phase 3:** ✅ 95% (ChatStore 668L, AIPanel 1421L, Agents 600+ Tests!)
- **Phase 2:** 🟡 5% (UI da, Integration fehlt)
- **Phase 4:** ⚠️ 0% (CRITICAL PATH - 26-30 Tage!)
- **Realistische Deadline:** **25.01.2026** (nicht 31.12.2025!)
- **Benötigt:** 56 Tage | **Verfügbar:** 48 Tage | **Delta:** -8 Tage ⚠️

---

### 👨‍💻 Frontend Developer
**Ziel:** UI bauen mit Svelte, Komponenten mit shadcn-svelte

**Learning Path:**
1. **Einführung:** [`README.md`](../README.md)
2. **Core Spec:** [`AGENTS.md`](../AGENTS.md) (Tech Spezifikation)
3. **State Management:** [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md) (Store-Übersicht)
4. **UI Guidelines:** [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) (shadcn-svelte Patterns)
5. **Reaktivität verstehen:** [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) (Svelte 5 Runes + $effect + Verification)
6. **Authentifizierung:** [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) (Session Management & Login)
7. **Auth UI-Komponenten:** [`ARCHITECTURE/AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md) (LoginDialog, LeftSidebarFooter, ProfileEditor)
8. **Einstellungen:** [`ARCHITECTURE/STORES/SETTINGSSTORE.md`](./ARCHITECTURE/STORES/SETTINGSSTORE.md) (Theme, Relays, LLM)
9. **Cheat Sheet:** [`GUIDES/PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) (Quick Reference)
10. **Quick Start:** [`GUIDES/QUICK-START.md`](./GUIDES/QUICK-START.md) (Copy-Paste Code Snippets)
11. **Tests verstehen:** [`TESTS/GUIDE.md`](./TESTS/GUIDE.md) (Test-Szenarien & How-To)

**Häufige Aufgaben:**
- Neue Komponente erstellen? → [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md)
- Store-Methode hinzufügen? → [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md)
- Props bearbeiten? → [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) (inkl. Verification Checklist)
- Einstellungen UI? → [`ARCHITECTURE/STORES/SETTINGSSTORE.md`](./ARCHITECTURE/STORES/SETTINGSSTORE.md)
- Login & Auth? → [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) + [`ARCHITECTURE/AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md)
- Kommentare implementieren? → [`FEATURE/COMMENTS.md`](./FEATURE/COMMENTS.md)

---

### 🌐 Nostr / Backend Developer
**Ziel:** Nostr Events publizieren, NDK nutzen, Auth implementieren

**Learning Path:**
1. **Core Spec:** [`AGENTS.md`](../AGENTS.md)
2. **AuthStore Integration:** [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) (Komplette Spezifikation)
3. **NDK Integration:** [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md)
4. **Event Schema:** [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md)
5. **Auth UI-Komponenten:** [`ARCHITECTURE/AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md) (LoginDialog, LeftSidebarFooter)
6. **State Management:** [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md)

**Häufige Aufgaben:**
- Event publizieren? → [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md)
- User authentifizieren? → [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) + [`ARCHITECTURE/AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md)
- Event-Schema verstehen? → [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md)

---

### 🧠 KI / ML Developer
**Ziel:** KI-Integration, Chat-Klasse, Kontext-Serialisierung

**Learning Path (Phase 3.0 ✅ COMPLETE):**
1. **🆕 AI Foundation Overview:** [`FEATURE/AI-INTEGRATION.md`](./FEATURE/AI-INTEGRATION.md) (Vollständige Spezifikation, Phase 3.0)
2. **🆕 2-Phase Response System:** [`FEATURE/TWO-PHASE-AI-RESPONSE.md`](./FEATURE/TWO-PHASE-AI-RESPONSE.md) (Content Proposal → Structure Generation)
3. **🆕 LLM Intent Detection:** [`FEATURE/LLM-INTENT-DETECTION.md`](./FEATURE/LLM-INTENT-DETECTION.md) (Intelligente Intent-Erkennung mit Fallbacks)
4. **🆕 Intelligent Structure Analysis:** [`FEATURE/INTELLIGENT-STRUCTURE-ANALYSIS.md`](./FEATURE/INTELLIGENT-STRUCTURE-ANALYSIS.md) (Board-Struktur erkennen & Strategien)
5. **🆕 Agent System Architecture:** [`ARCHITECTURE/AGENT/README.md`](./ARCHITECTURE/AGENT/README.md) (System-Übersicht & Module)
6. **🆕 AI Actions Reference:** [`ARCHITECTURE/AGENT/AI-ACTIONS-REFERENCE.md`](./ARCHITECTURE/AGENT/AI-ACTIONS-REFERENCE.md) (Board-Manipulation API)
7. **🆕 AI Collaborative Generation:** [`ARCHITECTURE/AGENT/AI-COLLABORATIVE-GENERATION.md`](./ARCHITECTURE/AGENT/AI-COLLABORATIVE-GENERATION.md) (Multi-Phase Flows)
8. **ChatStore API:** [`ARCHITECTURE/STORES/CHATSTORE.md`](./ARCHITECTURE/STORES/CHATSTORE.md) (Persistent Chat Sessions)
9. **ChatBotStore Design:** [`ARCHITECTURE/STORES/CHATBOTSTORE.md`](./ARCHITECTURE/STORES/CHATBOTSTORE.md) (Phase 3.1+ Preview)
10. **Tech Spezifikation:** [`AGENTS.md`](../AGENTS.md) (Section V: Chat-Klasse, getContextData)
11. **State Management:** [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md)

**Neue Module in Phase 3.0:**
- **contentProposal.ts** — Phase 1: Content Parsing & User Preview
- **structureGeneration.ts** — Phase 2: JSON Structure Generation & Validation
- **intentDetection.ts** — Rule-based Intent Recognition
- **llmIntentDetection.ts** — LLM-based Intent Detection (context-aware)
- **actionProcessing.ts** — Board Action Execution & Validation
- **learningManager.ts** — Pattern Recognition & Confidence Scoring
- **structureAnalysis.ts** — Board Structure Analysis & Strategy Selection
- **llmRequest.ts** — LLM API Integration (OpenAI-compatible)

**Kritische Methoden:**
- `Card.getContextData()` — KI-Kontext serialisieren
- `Chat.sendPromptToAI()` — Payload für KI vorbereiten
- `Chat.processAIAction()` — KI-Antworten verarbeiten
- **`llmRequest(prompt, context?)`** — LLM API Calls
- **`contentProposal(llmResponse)`** — Phase 1 Content Parsing
- **`structureGeneration(content, boardContext)`** — Phase 2 Structure JSON
- **`llmDetectIntention(userText, context)`** — LLM Intent Recognition
- **`analyzeExistingStructure(columns)`** — Board Pattern Analysis

---

### 🧪 QA / Tester
**Ziel:** Testszenarien verstehen, Bugs reproduzieren

**Learning Path:**
1. **Überblick:** [`README.md`](../README.md)
2. **Tech Details:** [`AGENTS.md`](../AGENTS.md) (Abschnitt VIII: Test-Suite)
3. **Offline Testing:** [`ARCHITECTURE/STORES/SYNCMANAGER.md`](./ARCHITECTURE/STORES/SYNCMANAGER.md) (Offline-First Szenarien)

---

## 🗺️ Nach Thema

### 🗺️ Nach Thema

| Thema | Dokument | Umfang |
|-------|----------|--------|
| **Svelte 5 Runes** | [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) | 40 min |
| **Svelte 5 Runes (Verification Checklist)** | [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) (Section VI) | 20 min |
| **State Management (Store-Übersicht)** | [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md) | 30 min |
| **BoardStore (Multi-Board Management)** | [`ARCHITECTURE/STORES/BOARDSTORE.md`](./ARCHITECTURE/STORES/BOARDSTORE.md) | 45 min |
| **Authentifizierung (Store)** | [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) | 35 min |
| **Auth UI-Komponenten** | [`ARCHITECTURE/AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md) | 30 min |
| **Einstellungen & Konfiguration** | [`ARCHITECTURE/STORES/SETTINGSSTORE.md`](./ARCHITECTURE/STORES/SETTINGSSTORE.md) | 30 min |
| **Nostr Events** | [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md) | 25 min |
| **🆕 AI Collaborative Generation** | [`ARCHITECTURE/AGENT/AI-COLLABORATIVE-GENERATION.md`](./ARCHITECTURE/AGENT/AI-COLLABORATIVE-GENERATION.md) | 40 min | ✅ Neu (03.11.) - GitHub Copilot Pattern
| **UI Design** | [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) | 25 min |
| **🆕 Store-Patterns Guide** | [`GUIDES/STORE-PATTERNS.md`](./GUIDES/STORE-PATTERNS.md) | 20 min | ✅ Neu (02.11.) - persisted() vs Manual localStorage
| **🆕 Dokumentations-Governance v3.0** | [`DOCUMENTATION-RULES-v3.md`](./DOCUMENTATION-RULES-v3.md) | 20 min | ✅ Neu (29.10.)
| **Technical Spec** | [`AGENTS.md`](../AGENTS.md) | 90 min |
| **Tests Status** | [`TESTS/STATUS.md`](./TESTS/STATUS.md) | 15 min |
| **Kommentar-System** | [`FEATURE/COMMENTS.md`](./FEATURE/COMMENTS.md) | 30 min |
| **KI-Chatbot Integration (Spec)** | [`ARCHITECTURE/STORES/CHATBOTSTORE.md`](./ARCHITECTURE/STORES/CHATBOTSTORE.md) | 30 min |
| **Base Store Abstraktion (Zukunft)** | [`ARCHITECTURE/STORES/BASESTORES.md`](./ARCHITECTURE/STORES/BASESTORES.md) | 15 min | ✅ Neu (08.11.) |

### 🔧 Integration & Technologie

| Thema | Dokument | Umfang |
|-------|----------|--------|
| **NDK Setup** | [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md) | 20 min |
| **Offline-First** | [`ARCHITECTURE/STORES/SYNCMANAGER.md`](./ARCHITECTURE/STORES/SYNCMANAGER.md) | 30 min |

### 📚 Learning Resources

| Learning Resource | Dokument |
|---|---|
| **🆕 AI Foundation Overview (50 min)** | [`FEATURE/AI-INTEGRATION.md`](./FEATURE/AI-INTEGRATION.md) |
| **🆕 AI Phase System (30 min)** | [`FEATURE/TWO-PHASE-AI-RESPONSE.md`](./FEATURE/TWO-PHASE-AI-RESPONSE.md) |
| **🆕 LLM Intent Detection (35 min)** | [`FEATURE/LLM-INTENT-DETECTION.md`](./FEATURE/LLM-INTENT-DETECTION.md) |
| **🆕 Board Structure Analysis (30 min)** | [`FEATURE/INTELLIGENT-STRUCTURE-ANALYSIS.md`](./FEATURE/INTELLIGENT-STRUCTURE-ANALYSIS.md) |
| **🆕 Agent Architecture (40 min)** | [`ARCHITECTURE/AGENT/README.md`](./ARCHITECTURE/AGENT/README.md) |
| **Quick Start (10 min)** | [`GUIDES/QUICK-START.md`](./GUIDES/QUICK-START.md) |
| **🆕 Store-Patterns Guide (20 min)** | [`GUIDES/STORE-PATTERNS.md`](./GUIDES/STORE-PATTERNS.md) |
| **Prop vs State (5 min Cheat Sheet)** | [`GUIDES/PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) |
| **Store-Übersicht (30 min)** | [`ARCHITECTURE/STORES/README.md`](./ARCHITECTURE/STORES/README.md) |
| **ChatStore API (25 min)** | [`ARCHITECTURE/STORES/CHATSTORE.md`](./ARCHITECTURE/STORES/CHATSTORE.md) |
| **Authentifizierung Store (35 min)** | [`ARCHITECTURE/STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) |
| **Settings Verwaltung (30 min)** | [`ARCHITECTURE/STORES/SETTINGSSTORE.md`](./ARCHITECTURE/STORES/SETTINGSSTORE.md) |
| **Svelte 5 Runes (40 min)** | [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) |
| **Unit Tests (5 min)** | [`TESTS/GUIDE.md`](./TESTS/GUIDE.md) |
| **Vollständige Spezifikation** | [`AGENTS.md`](../AGENTS.md) |
| **Produktvision** | [`KONZEPT.md`](../KONZEPT.md) |
| **Roadmap & Meilensteine** | [`COLLABORATION/ROADMAP.md`](./COLLABORATION/ROADMAP.md) |

---

## 🔗 Schnelle Links

### 📦 Top-Level Dateien
- [`README.md`](../README.md) — Projekt-Übersicht
- [`AGENTS.md`](../AGENTS.md) — Vollständige technische Spezifikation
- [`CHANGELOG.md`](../CHANGELOG.md) — Versionshistorie
- [`KONZEPT.md`](../KONZEPT.md) — Stakeholder-freundliche Produktvision

### 🏛️ docs/ Struktur (Komplette Liste)

```
docs/
├── DOCUMENTATION-RULES-v3.md   ← 🆕 Dokumentations-Governance v3.0 (REGELN!)
├── _INDEX.md                   ← Sie sind hier
│
├── REFERENCE/
│   └── _INDEX.md              ← Navigation Hub
│
├── ARCHITECTURE/
│   ├── AUTH-UI-COMPONENTS.md
│   ├── NDK.md
│   ├── REACTIVITY.md
│   ├── UX-RULES.md
│   └── STORES/
│       ├── README.md                ← Store-Übersicht & Navigation
│       ├── AUTHSTORE.md             ← Authentication & Session
│       ├── BOARDSTORE.md            ← Multi-Board Management
│       ├── CHATBOTSTORE.md          ← KI-Integration (TODO)
│       ├── SETTINGSSTORE.md         ← Theme, Relays, LLM
│       ├── SYNCMANAGER.md           ← Offline-Sync (TODO)
│       └── BASESTORES.md            ← ✅ Neu (08.11.) - Base Class Abstraktion
│
├── GUIDES/
│   ├── Kanban-NIP.md
│   ├── PROP-VS-STATE-CHEATSHEET.md
│   ├── QUICK-START.md
│   ├── STORE-PATTERNS.md
│   ├── TEST-RUNNER.md
│   └── THEME-BUTTONS.md
│
├── COLLABORATION/
│   ├── CONSOLIDATION-SUMMARY.md
│   ├── CONTRIBUTING.md
│   └── ROADMAP.md
│
├── TESTS/
│   ├── GUIDE.md
│   └── STATUS.md
│
└── FEATURE/
    └── COMMENTS.md
```

---

## ⏱️ Zeitbudget zum Lernen

| Rollen-spezifisch | Zeitbudget | Dokumente |
|---|---|---|
| **PM / Stakeholder** | 30 min | README + KONZEPT + ROADMAP |
| **Frontend Dev** | 3-4 Std. | README + AGENTS + UX-RULES + REACTIVITY + STORES/README.md + PROP-VS-STATE-CHEATSHEET |
| **Nostr Dev** | 1.5-2 Std. | AGENTS + NDK + Kanban-NIP + STORES/AUTHSTORE.md |
| **KI Dev** | 1-1.5 Std. | AGENTS (Chat Sektion) + STORES/README.md + STORES/CHATBOTSTORE.md |
| **Vollständiges Team** | 5-6 Std. | Alle Dokumente |

**Priorisiert für Frontend Devs (Zeit sparen):**
1. PROP-VS-STATE-CHEATSHEET.md (5 min)
2. REACTIVITY.md (Section VI - Verification) (20 min)
3. Dann REACTIVITY.md (30 min)

---

## ✅ Checkliste: Bin ich vorbereitet?

### Für alle:
- [ ] README.md gelesen
- [ ] Project-Struktur verstanden

### Frontend Devs zusätzlich:
- [ ] AGENTS.md überflogen (Schnell-Spezifikation)
- [ ] STORES/README.md Kapitel I gelesen (Store-Übersicht)
- [ ] REACTIVITY.md verstanden (Runes-Kette + Verification)
- [ ] STORES/AUTHSTORE.md verstanden (Session Management)
- [ ] AUTH-UI-COMPONENTS.md für UI-Komponenten
- [ ] STORES/SETTINGSSTORE.md als Referenz gebookmarkt
- [ ] UX-RULES.md als Referenz gebookmarkt

### Nostr Devs zusätzlich:
- [ ] NDK.md gelesen
- [ ] Kanban-NIP.md verstanden
- [ ] STORES/AUTHSTORE.md + AUTH-UI-COMPONENTS.md gelesen

### KI Devs zusätzlich:
- [ ] AGENTS.md Kapitel III gelesen (Chat-Klasse)
- [ ] getContextData() Patterns verstanden
- [ ] STORES/README.md State-Flow verstanden
- [ ] STORES/CHATBOTSTORE.md als Referenz

---

## 📚 Vollständige Dokumentations-Übersicht (Alle Dateien)

### ARCHITECTURE/ (15 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`AUTH-UI-COMPONENTS.md`](./ARCHITECTURE/AUTH-UI-COMPONENTS.md) | ✅ **NEU (29.10.)**: Auth UI-Komponenten (LoginDialog, LeftSidebarFooter, ProfileEditor) | ✅ Neu (29.10.) |
| [`NDK.md`](./ARCHITECTURE/NDK.md) | Nostr Development Kit Integration | ✅ |
| [`REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) | ✅ Master File: Svelte 5 Runes + Verification | ✅ Master (25.10.) |
| [`UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) | shadcn-svelte UI Guidelines | ✅ |
| **AGENT/** | **KI-Integration Pattern (4 Dateien - Phase 3.0 Complete)** | |
| [`AGENT/README.md`](./ARCHITECTURE/AGENT/README.md) | 🆕 **NEU (06.11.)**: Agent Module Übersicht & Architecture | ✅ Neu (06.11.) |
| [`AGENT/AI-ACTIONS-REFERENCE.md`](./ARCHITECTURE/AGENT/AI-ACTIONS-REFERENCE.md) | 🆕 **NEU (06.11.)**: Vollständige Referenz aller 11 AI-Action Types (addCard, moveCard, splitCard, etc.) | ✅ Neu (06.11.) |
| [`AGENT/AI-COLLABORATIVE-GENERATION.md`](./ARCHITECTURE/AGENT/AI-COLLABORATIVE-GENERATION.md) | 🆕 **NEU (06.11.)**: GitHub Copilot-ähnlicher Workflow (2-Phase Processing mit Learning Manager) | ✅ Neu (06.11.) |
| [`AGENT/MIGRATION-AIACTIONGENERATOR.md`](./ARCHITECTURE/AGENT/MIGRATION-AIACTIONGENERATOR.md) | 🆕 **NEU (06.11.)**: Migration Guide von altem AIActionGenerator zu neuem 2-Phase System | ✅ Neu (06.11.) |
| **STORES/** | **Store-Architektur (7 Dateien)** | |
| [`STORES/README.md`](./ARCHITECTURE/STORES/README.md) | Store-Übersicht & Navigation | ✅ Neu (08.11.) |
| [`STORES/AUTHSTORE.md`](./ARCHITECTURE/STORES/AUTHSTORE.md) | Authentication & Session Management + Author Patterns | ✅ Neu (08.11.) |
| [`STORES/BOARDSTORE.md`](./ARCHITECTURE/STORES/BOARDSTORE.md) | Multi-Board Management mit MRU Pattern | ✅ Neu (08.11.) |
| [`STORES/SETTINGSSTORE.md`](./ARCHITECTURE/STORES/SETTINGSSTORE.md) | Theme, Relays, LLM Config | ✅ Neu (08.11.) |
| [`STORES/SYNCMANAGER.md`](./ARCHITECTURE/STORES/SYNCMANAGER.md) | Offline-Sync Manager (TODO Phase 1.2) | ✅ Neu (08.11.) |
| [`STORES/BASESTORES.md`](./ARCHITECTURE/STORES/BASESTORES.md) | Base Class Abstraktion für neue, einfache Stores | ✅ Neu (08.11.) |
| [`STORES/CHATSTORE.md`](./ARCHITECTURE/STORES/CHATSTORE.md) | 🆕 **NEU (06.11.)**: Chat-Session Persistence per Board mit Memory & Summaries (Phase 3.0) | ✅ Neu (06.11.) |
| [`STORES/USERPREFERENCESSTORE.md`](./ARCHITECTURE/STORES/USERPREFERENCESSTORE.md) | 🆕 **NEU (06.11.)**: Cross-Board Learning & User-Präferenzen (Phase 3.0) | ✅ Neu (06.11.) |
| **NOSTR/** | **Nostr-spezifische Dokumentation (Reorganisiert 10.11.)** | |
| [`NOSTR/_INDEX.md`](./ARCHITECTURE/NOSTR/_INDEX.md) | 🆕 **NEU (10.11.)**: NOSTR Folder Navigation & "Wer nutzt was?" | ✅ Neu (10.11.) |
| [`NOSTR/EVENT-HANDLING-AND-SYNC.md`](./ARCHITECTURE/NOSTR/EVENT-HANDLING-AND-SYNC.md) | ✅ **UPDATED (10.11.)**: Single Source of Truth für Nostr Sync, LWW, Echo-Prävention, DnD-Fixes | ✅ Neu (10.11.) |
| [`NOSTR/LOADING-SUBSCRIPTION.md`](./ARCHITECTURE/NOSTR/LOADING-SUBSCRIPTION.md) | ✅ **UPDATED (10.11.)**: Board-Loading & Subscription Implementation Guide | ✅ Updated (10.11.) |
| [`NOSTR/IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md`](./ARCHITECTURE/NOSTR/IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md) | ✅ **MOVED (10.11.)**: Relay Selection Strategie (Status: IMPLEMENTED & TESTED) | ✅ Reorganisiert (10.11.) |
| [`NOSTR/REFERENCE/BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md`](./ARCHITECTURE/NOSTR/REFERENCE/BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md) | 🔍 **MOVED (10.11.)**: Detaillierte Root-Cause Analyse des Card-Deletion-Bugs | ✅ Reorganisiert (10.11.) |
| [`NOSTR/REFERENCE/FIX-SUMMARY.md`](./ARCHITECTURE/NOSTR/REFERENCE/FIX-SUMMARY.md) | 📝 **MOVED (10.11.)**: Quick-Reference für Bugs | ✅ Reorganisiert (10.11.) |
| [`NOSTR/NEXT-STEPS/MERGE-vs-LWW-OVERVIEW.md`](./ARCHITECTURE/NOSTR/NEXT-STEPS/MERGE-vs-LWW-OVERVIEW.md) | 🔮 **CONSOLIDATED (10.11.)**: Phase 2.0 Merge-LWW Integration Planning | ✅ Reorganisiert (10.11.) |
| [`NOSTR/NEXT-STEPS/MERGE-LWW-INTEGRATION-TODO.md`](./ARCHITECTURE/NOSTR/NEXT-STEPS/MERGE-LWW-INTEGRATION-TODO.md) | 🔮 **CONSOLIDATED (10.11.)**: Phase 2.0 Implementation Checklist | ✅ Reorganisiert (10.11.) |
| [`NOSTR/NEXT-STEPS/INTEGRATION-ANALYSIS-MERGE-vs-LWW.md`](./ARCHITECTURE/NOSTR/NEXT-STEPS/INTEGRATION-ANALYSIS-MERGE-vs-LWW.md) | 🔮 **CONSOLIDATED (10.11.)**: Detaillierte Analyse für Phase 2.0 | ✅ Reorganisiert (10.11.) |

### GUIDES/ (6 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`QUICK-START.md`](./GUIDES/QUICK-START.md) | 10-Minuten Einstieg | ✅ |
| [`PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) | Svelte 5 Prop vs State Quick Reference | ✅ |
| [`Kanban-NIP.md`](./GUIDES/Kanban-NIP.md) | Nostr Event Schema | ✅ |
| [`TEST-RUNNER.md`](./GUIDES/TEST-RUNNER.md) | Test Suite Runner Guide | ✅ |
| [`STORE-PATTERNS.md`](./GUIDES/STORE-PATTERNS.md) | persisted() vs. Manual localStorage | ✅ Neu (02.11.) |
| [`THEME-BUTTONS.md`](./GUIDES/THEME-BUTTONS.md) | Theme-Buttons für Sidebar | ✅ Neu (30.10.) |

### COLLABORATION/ (6 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`CONSOLIDATION-SUMMARY.md`](./COLLABORATION/CONSOLIDATION-SUMMARY.md) | Documentation Consolidation Summary | ✅ Meta-Datei |
| [`CONTRIBUTING.md`](./COLLABORATION/CONTRIBUTING.md) | Contribution Richtlinien | ✅ |
| [`ROADMAP.md`](./COLLABORATION/ROADMAP.md) | Entwicklungs-Roadmap (Phase 1-5) | ✅ |
| [`DOCUMENTATION-AUDIT-SUMMARY.md`](./COLLABORATION/DOCUMENTATION-AUDIT-SUMMARY.md) | Audit Summary Report | ✅ Neu (24.10.) |
| [`DOCUMENTATION-AUDIT-REPORT.md`](./COLLABORATION/DOCUMENTATION-AUDIT-REPORT.md) | Detailed Audit Report | ✅ Neu (24.10.) |
| [`BOARD-VERSIONING.md`](./COLLABORATION/BOARD-VERSIONING.md) | ✅ Neu (26.10.) Manual Snapshots + Conflict Resolution | ✅ Neu (26.10.) |

### TESTS/ (2 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`GUIDE.md`](./TESTS/GUIDE.md) | Ausführliches Test-Guide | ✅ |
| [`STATUS.md`](./TESTS/STATUS.md) | Test Suite Status & Überblick | ✅ |

### FEATURE/ (11 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`COMMENTS.md`](./FEATURE/COMMENTS.md) | Kommentar-System Feature Dokumentation | ✅ |
| [`AI-INTEGRATION.md`](./FEATURE/AI-INTEGRATION.md) | KI-Chatbot Integration (Phase 3 Foundation) | ✅ Neu (03.11.) |
| [`TWO-PHASE-AI-RESPONSE.md`](./FEATURE/TWO-PHASE-AI-RESPONSE.md) | 🆕 **NEU (06.11.)**: Phase 3.1 - 2-Phase Response Architecture (Content Proposal → Structure Generation) | ✅ Neu (06.11.) |
| [`TWO-PHASE-AI-RESPONSE-INTEGRATION.md`](./FEATURE/TWO-PHASE-AI-RESPONSE-INTEGRATION.md) | 🆕 **NEU (06.11.)**: Phase 3.1 - Integration Guide für 2-Phase System in BoardStore | ✅ Neu (06.11.) |
| [`LLM-INTENT-DETECTION.md`](./FEATURE/LLM-INTENT-DETECTION.md) | 🆕 **NEU (06.11.)**: Phase 3.1 - Kontext-bewusste Intent-Erkennung via LLM | ✅ Neu (06.11.) |
| [`INTELLIGENT-STRUCTURE-ANALYSIS.md`](./FEATURE/INTELLIGENT-STRUCTURE-ANALYSIS.md) | 🆕 **NEU (06.11.)**: Phase 3.1 - Bestehende Spalten intelligent berücksichtigen | ✅ Neu (06.11.) |
| [`PASTE-SYSTEM.md`](./FEATURE/PASTE-SYSTEM.md) | Phase 1.5 - Paste Handler für URLs, Bilder, Text, Nostr | ✅ Neu (25.10.) |
| [`MERGE-SYSTEM.md`](./FEATURE/MERGE-SYSTEM.md) | Phase 1.5 - Git-like 3-way Merge + Visual Test Route | ✅ Neu (26.10.) |
| [`SHARELINK.md`](./FEATURE/SHARELINK.md) | Phase 1.5 - URL-basiertes Board-Sharing mit Token-Encoding | ✅ Neu (31.10.) |
| [`IMPORT-EXPORT.md`](./FEATURE/IMPORT-EXPORT.md) | Phase 1.5 - JSON-Export/Import mit 3 Modi (merge/new/overwrite) | ✅ Neu (31.10.) |
| [`CARD-DESIGN.md`](./FEATURE/CARD-DESIGN.md) | 🆕 **NEU (06.11.)**: UI/UX Design für Card-Komponente mit Badges & Popover | ✅ Neu (06.11.) |
| [`RELAY-SELECTION-IMPLEMENTATION.md`](./FEATURE/RELAY-SELECTION-IMPLEMENTATION.md) | ✅ Relay Selection Implementation Summary (referenziert von Test Guide) | ✅ |

### REFERENCE/ (1 Datei)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`_INDEX.md`](.//_INDEX.md) | Diese Datei - Dokumentations-Navigation | ✅ |

---

## 🔗 Alle Dokumentationen verlinkt?

✅ **ARCHITECTURE/** — 15/15 Dateien verlinkt (4 root + 7 STORES/ + 4 AGENT/)  
✅ **GUIDES/** — 6/6 Dateien verlinkt  
✅ **COLLABORATION/** — 6/6 Dateien verlinkt  
✅ **TESTS/** — 2/2 Dateien verlinkt  
✅ **FEATURE/** — 11/11 Dateien verlinkt (neue Phase 3.0 Docs!)  
✅ **REFERENCE/** — 1/1 Dateien verlinkt  

**Total: 53/53 Dateien in /docs verlinkt und dokumentiert** (Phase 3.0 Complete!)

---

---

## 🔍 Audit & Quality Assurance

- **[DOCUMENTATION-AUDIT-SUMMARY.md](./COLLABORATION/DOCUMENTATION-AUDIT-SUMMARY.md)** ← Kurzzusammenfassung
  - ✅ 28/28 Dateien verlinkt
  - ✅ 0 defekte Links  
  - ✅ 100% Abdeckung validiert

- **[DOCUMENTATION-AUDIT-REPORT.md](./COLLABORATION/DOCUMENTATION-AUDIT-REPORT.md)** ← Ausführlicher Bericht
  - Detaillierte Link-Verifizierung
  - Quality Metrics & Statistiken
  - Audit Procedures & Findings
  - Sign-off & Appendix

---

## 👣 Nächste Schritte

**Nach dem Lesen dieses Index:**

1. **Wähle deine Rolle** → Folge dem Learning Path
2. **Lies die Core Docs** → Start mit deinem Bereich
3. **Schaue QUICK-START.md** → Code-Snippets kopieren
4. **Starte die Entwicklung!** → `pnpm run dev`

---

## 🤝 Hilfe & Support

- **Fragen zur Dokumentation?** → Öffne ein GitHub Issue
- **Fehler im Code?** → Siehe [`GUIDES/QUICK-START.md`](./GUIDES/QUICK-START.md) - Debugging Section
- **Beitragen?** → Lies [`COLLABORATION/CONTRIBUTING.md`](./COLLABORATION/CONTRIBUTING.md)

---

##  Phase 3.0 Release: AI Agent Framework Complete!

**Branch:** `feature/agent-chatstore`  
**Status:** ✅ READY FOR REVIEW & MERGE  
**Documentation:** [`PR.md`](../PR.md) (Vollständige PR-Dokumentation)

### Was ist neu?

#### 🧠 AI-Agent System (Phase 3.0)
- **Agent Modules:** 10 TypeScript-Module mit 2-Phase Response Processing
- **ContentProposal Phase:** Parse user-friendly content, extract structure suggestions
- **StructureGeneration Phase:** Generate validated JSON from proposals
- **Learning Manager:** Pattern recognition with confidence scoring (0.0-1.0)
- **Intent Detection:** Both rule-based and LLM-based strategies
- **Structure Analysis:** Board pattern recognition & strategy selection

#### 💬 ChatStore Integration
- Persistent chat sessions per board
- Message history with timestamps
- Memory system for important information
- Conversation summaries for long chats
- 30+ unit tests, 98%+ pass rate

#### 📚 Documentation
- **15+ neue Feature & Architecture Docs** (+6.000 LOC)
- **52/52 Dateien verlinkt** in Dokumentations-Index
- **DOCUMENTATION-RULES v3.0** mit Code ↔ Docs Sync
- **Phase 3.0 Complete:** All AI infrastructure in place

#### ✅ Quality Assurance
- **150+ Agent-Tests:** 98%+ pass rate
- **0 Breaking Changes:** Fully backward compatible
- **Bundle Size:** +45KB (reasonable for AI features)
- **No new dependencies:** Uses existing NDK, Zod, OpenAI-compatible APIs

### Learning Paths Updated

**For KI Developers (Phase 3.0):** 11-step learning path with NEW:
- [`FEATURE/AI-INTEGRATION.md`](./FEATURE/AI-INTEGRATION.md) — Full spec
- [`FEATURE/TWO-PHASE-AI-RESPONSE.md`](./FEATURE/TWO-PHASE-AI-RESPONSE.md) — Content → Structure
- [`FEATURE/LLM-INTENT-DETECTION.md`](./FEATURE/LLM-INTENT-DETECTION.md) — Smart intent recognition
- [`ARCHITECTURE/AGENT/README.md`](./ARCHITECTURE/AGENT/README.md) — System overview
- [`ARCHITECTURE/STORES/CHATSTORE.md`](./ARCHITECTURE/STORES/CHATSTORE.md) — Chat persistence

### Next Steps

1. **Review:** See [`PR.md`](../PR.md) for full documentation
2. **Test:** Run `pnpm run test` to verify 150+ tests
3. **Merge:** When ready, merge to `main` and tag v4.0
4. **Phase 3.1:** Continue with extended AI features

---

## 📊 Dokumentations-Status

| Kategorie | Status | Letzte Aktualisierung |
|-----------|--------|----------------------|
| **✅ MASTER: AGENT/** | ✅ Complete (Phase 3.0) | 06. November 2025 |
| **✅ MASTER: STORES/** | ✅ Erweitert (7 Dateien) | 08. November 2025 |
| **✅ MASTER: FEATURE/** | ✅ Erweitert (11 Dateien) | 06. November 2025 |
| **✅ MASTER: REACTIVITY.md** | ✅ Konsolidiert (2 → 1) | 25. Oktober 2025 |
| **Architecture** | ✅ Phase 3.0 Complete (15/15) | 08. November 2025 |
| **Guides** | ✅ Komplett | 02. November 2025 |
| **Collaboration** | ✅ Komplett | 21. Oktober 2025 |
| **Test Suite** | ✅ Komplett | 22. Oktober 2025 |
| **Features** | ✅ Phase 3.0 Complete (11/11) | 06. November 2025 |
| **KI-Agent Integration** | ✅ **PHASE 3.0 COMPLETE** | 06. November 2025 |
| **ChatStore & Learning** | ✅ **PHASE 3.0 COMPLETE** | 06. November 2025 |

**🎉 PHASE 3.0 MILESTONE ACHIEVED:**
- ✅ 4 AGENT-Dateien (Collaborative Generation Framework)
- ✅ 3 neue STORES-Dateien (ChatStore, UserPreferencesStore)
- ✅ 5 neue FEATURE-Dateien (2-Phase Processing, Intent Detection, Structure Analysis)
- ✅ Total: +12 neue Dateien, +15.000 LOC Dokumentation
- ✅ 150+ Agent-Tests mit 98%+ Pass Rate
- ✅ 0 Breaking Changes

**Status: PHASE 3.0 COMPLETE! 🚀**
