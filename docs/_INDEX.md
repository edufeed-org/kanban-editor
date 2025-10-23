# 📚 Dokumentations-Index & Navigation

**Willkommen in der offiziellen Dokumentation des Nostr-basierten KI-Kanban-Boards!**

Dieses Verzeichnis hilft dir, die richtige Dokumentation schnell zu finden. Wähle deine Rolle oder dein Ziel:

---

## 🎯 Nach Rolle

### 👨‍💼 Product Manager / Stakeholder
**Ziel:** Produkt-Vision, Roadmap, Features verstehen

1. **Start:** [`README.md`](../README.md) (15 min Überblick)
2. **Vertiefung:** [`KONZEPT.md`](../KONZEPT.md) (Vision & Use Cases)
3. **Planung:** [`COLLABORATION/ROADMAP.md`](./COLLABORATION/ROADMAP.md) (Phasen & Meilensteine)
4. **Support:** [`COLLABORATION/CONTRIBUTING.md`](./COLLABORATION/CONTRIBUTING.md) (Contribution Policy)

---

### 👨‍💻 Frontend Developer
**Ziel:** UI bauen mit Svelte, Komponenten mit shadcn-svelte

**Learning Path:**
1. **Einführung:** [`README.md`](../README.md)
2. **Core Spec:** [`AGENTS.md`](../AGENTS.md) (Tech Spezifikation)
3. **State Management:** [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md) (Svelte 5 $state, $derived)
4. **UI Guidelines:** [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) (shadcn-svelte Patterns)
5. **Reaktivität verstehen:** [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) (Svelte 5 Runes + $effect)
6. **🆕 Reactive Flow Bugs:** [`ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md`](./ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md) (Prop vs State Pattern!)
7. **🆕 Author Field Attribution:** [`ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) (Serialisierung & Persistierung!)
8. **🆕 Cheat Sheet:** [`GUIDES/PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) (Quick Reference)
9. **Quick Start:** [`GUIDES/QUICK-START.md`](./GUIDES/QUICK-START.md) (Copy-Paste Code Snippets)
10. **Tests verstehen:** [`TESTSUITE/INDEX.md`](./TESTSUITE/INDEX.md) (Test Suite Übersicht)

**Häufige Aufgaben:**
- Neue Komponente erstellen? → [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md)
- Store-Methode hinzufügen? → [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md)
- Props bearbeiten? → [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) oder [`GUIDES/PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md)
- Reactive Bugs fixen? → [`ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md`](./ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md)
- Tests ausführen? → [`TESTSUITE/INDEX.md`](./TESTSUITE/INDEX.md)
- Kommentare implementieren? → [`FEATURE/COMMENTS.md`](./FEATURE/COMMENTS.md)

---

### 🌐 Nostr / Backend Developer
**Ziel:** Nostr Events publizieren, NDK nutzen, Auth implementieren

**Learning Path:**
1. **Core Spec:** [`AGENTS.md`](../AGENTS.md)
2. **🆕 AuthStore Integration:** [`GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](./GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) (Komplette API Reference)
3. **NDK Integration:** [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md)
4. **Event Schema:** [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md)
5. **Benutzer & Signing:** [`ARCHITECTURE/NOSTR-USER.md`](./ARCHITECTURE/NOSTR-USER.md)
6. **State Management:** [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md)
7. **🆕 Author Field Attribution:** [`ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) (Serialisierung!)

**Häufige Aufgaben:**
- Event publizieren? → [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md)
- User authentifizieren? → [`GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](./GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md)
- Event-Schema verstehen? → [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md)
- Board/Card Author? → [`ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md)

---

### 🧠 KI / ML Developer
**Ziel:** KI-Integration, Chat-Klasse, Kontext-Serialisierung

**Learning Path:**
1. **Tech Spezifikation:** [`AGENTS.md`](../AGENTS.md) (Abschnitt: Chat-Klasse, getContextData)
2. **State Management:** [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md)
3. **Nostr Integration:** [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md)

**Kritische Methoden:**
- `Card.getContextData()` — KI-Kontext serialisieren
- `Chat.sendPromptToAI()` — Payload für KI vorbereiten
- `Chat.processAIAction()` — KI-Antworten verarbeiten

---

### 🧪 QA / Tester
**Ziel:** Testszenarien verstehen, Bugs reproduzieren

**Learning Path:**
1. **Überblick:** [`README.md`](../README.md)
2. **Tech Details:** [`AGENTS.md`](../AGENTS.md) (Abschnitt VIII: Test-Suite)
3. **Offline Testing:** [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md) (Offline-First Szenarien)

---

## 🗺️ Nach Thema

### 🏗️ Architektur & Design

| Thema | Dokument | Umfang |
|-------|----------|--------|
| **Svelte 5 Runes** | [`ARCHITECTURE/REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) | 30 min |
| **State Management** | [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md) | 45 min |
| **🆕 Reactive Flow Bugs** | [`ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md`](./ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md) | 20 min |
| **🆕 Author Field Attribution** | [`ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) | 25 min |
| **Nostr Events** | [`GUIDES/Kanban-NIP.md`](./GUIDES/Kanban-NIP.md) | 20 min |
| **UI Design** | [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) | 25 min |
| **Technical Spec** | [`AGENTS.md`](../AGENTS.md) | 90 min |
| **Test Suite** | [`TESTSUITE/STATUS.md`](./TESTSUITE/STATUS.md) | 15 min |
| **Kommentar-System** | [`FEATURE/COMMENTS.md`](./FEATURE/COMMENTS.md) | 30 min |

### 🔧 Integration & Technologie

| Thema | Dokument | Umfang |
|-------|----------|--------|
| **🆕 AuthStore Integration** | [`GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](./GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) | 30 min |
| **NDK Setup** | [`ARCHITECTURE/NDK.md`](./ARCHITECTURE/NDK.md) | 20 min |
| **User Auth** | [`ARCHITECTURE/NOSTR-USER.md`](./ARCHITECTURE/NOSTR-USER.md) | 40 min |
| **Offline-First** | [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md) (Abschnitt IV) | 30 min |

### 📚 Learning Resources

| Ziel | Dokument |
|------|----------|
| **Quick Start (10 min)** | [`GUIDES/QUICK-START.md`](./GUIDES/QUICK-START.md) |
| **Prop vs State (5 min Cheat Sheet)** | [`GUIDES/PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) |
| **🆕 AuthStore Integration** | [`GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md`](./GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) |
| **🆕 Author Field Attribution** | [`ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) |
| **Reactive Flow Debugging** | [`ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md`](./ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md) |
| **Test Suite (5 min)** | [`TESTSUITE/INDEX.md`](./TESTSUITE/INDEX.md) |
| **Kommentar-System** | [`FEATURE/COMMENTS.md`](./FEATURE/COMMENTS.md) |
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
├── REFERENCE/
│   └── _INDEX.md              ← Sie sind hier
│
├── ARCHITECTURE/
│   ├── AUTHOR-FIELD-ATTRIBUTION.md  ← ✅ Neu (23.10.)
│   ├── AUTHSTORE-FLOWCHART.md
│   ├── AUTHSTORE-IMPLEMENTATION.md
│   ├── COMPONENT-ARCHITECTURE-LEFT-SIDEBAR-FOOTER.md
│   ├── NDK.md
│   ├── NOSTR-USER.md
│   ├── REACTIVE-FLOW-VERIFICATION.md
│   ├── REACTIVITY.md
│   ├── STORES.md
│   ├── UX-RULES.md
│   └── VISUAL-SIDEBAR-LOGIN-REFERENCE.md
│
├── GUIDES/
│   ├── AUTHSTORE-BASICS.md
│   ├── AUTHSTORE-INTEGRATION-GUIDE.md  ← ✅ Neu (23.10.)
│   ├── Kanban-NIP.md
│   ├── PROP-VS-STATE-CHEATSHEET.md
│   ├── QUICK-START.md
│   ├── SIDEBAR-LOGIN-DOCS-INDEX.md
│   ├── SIDEBAR-LOGIN-INTEGRATION.md
│   └── TEST-RUNNER.md
│
├── COLLABORATION/
│   ├── CONSOLIDATION-SUMMARY.md
│   ├── CONTRIBUTING.md
│   └── ROADMAP.md
│
├── TESTSUITE/
│   ├── AUTHSTORE-TEST-PAGE.md
│   ├── GUIDE.md
│   ├── INDEX.md
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
| **Frontend Dev** | 3-4 Std. | README + AGENTS + UX-RULES + REACTIVITY + REACTIVE-FLOW-VERIFICATION + STORES + PROP-VS-STATE-CHEATSHEET |
| **Nostr Dev** | 1.5-2 Std. | AGENTS + NDK + NOSTR-USER + Kanban-NIP |
| **KI Dev** | 1-1.5 Std. | AGENTS (Chat Sektion) + STORES |
| **Vollständiges Team** | 5-6 Std. | Alle Dokumente |

**Priorisiert für Frontend Devs (Zeit sparen):**
1. PROP-VS-STATE-CHEATSHEET.md (5 min)
2. REACTIVE-FLOW-VERIFICATION.md (20 min)
3. Dann REACTIVITY.md (30 min)

---

## ✅ Checkliste: Bin ich vorbereitet?

### Für alle:
- [ ] README.md gelesen
- [ ] Project-Struktur verstanden

### Frontend Devs zusätzlich:
- [ ] AGENTS.md überflogen (Schnell-Spezifikation)
- [ ] STORES.md Kapitel I gelesen ($state/$derived Paradigma)
- [ ] REACTIVITY.md verstanden (Runes-Kette)
- [ ] UX-RULES.md als Referenz gebookmarkt

### Nostr Devs zusätzlich:
- [ ] NDK.md gelesen
- [ ] Kanban-NIP.md verstanden
- [ ] NOSTR-USER.md Kapitel I-III gelesen

### KI Devs zusätzlich:
- [ ] AGENTS.md Kapitel III gelesen (Chat-Klasse)
- [ ] getContextData() Patterns verstanden
- [ ] STORES.md State-Flow verstanden

---

## � Vollständige Dokumentations-Übersicht (Alle Dateien)

### ARCHITECTURE/ (11 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`AUTHOR-FIELD-ATTRIBUTION.md`](./ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md) | Root Cause: Author Field Bug Fix | ✅ Neu (23.10.) |
| [`AUTHSTORE-FLOWCHART.md`](./ARCHITECTURE/AUTHSTORE-FLOWCHART.md) | AuthStore Ablauf-Diagramm | ✅ |
| [`AUTHSTORE-IMPLEMENTATION.md`](./ARCHITECTURE/AUTHSTORE-IMPLEMENTATION.md) | AuthStore technische Details | ✅ |
| [`COMPONENT-ARCHITECTURE-LEFT-SIDEBAR-FOOTER.md`](./ARCHITECTURE/COMPONENT-ARCHITECTURE-LEFT-SIDEBAR-FOOTER.md) | LeftSidebarFooter Komponenten-Architektur | ✅ |
| [`NDK.md`](./ARCHITECTURE/NDK.md) | Nostr Development Kit Integration | ✅ |
| [`NOSTR-USER.md`](./ARCHITECTURE/NOSTR-USER.md) | Benutzerauthentifizierung & NIP-07 | ✅ |
| [`REACTIVE-FLOW-VERIFICATION.md`](./ARCHITECTURE/REACTIVE-FLOW-VERIFICATION.md) | Svelte 5 Reactive Flow Debugging | ✅ |
| [`REACTIVITY.md`](./ARCHITECTURE/REACTIVITY.md) | Svelte 5 Runes Konzepte | ✅ |
| [`STORES.md`](./ARCHITECTURE/STORES.md) | Store-Architektur & Export/Import API | ✅ |
| [`UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) | shadcn-svelte UI Guidelines | ✅ |
| [`VISUAL-SIDEBAR-LOGIN-REFERENCE.md`](./ARCHITECTURE/VISUAL-SIDEBAR-LOGIN-REFERENCE.md) | Sidebar Login UI Referenz | ✅ |

### GUIDES/ (8 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`AUTHSTORE-BASICS.md`](./GUIDES/AUTHSTORE-BASICS.md) | AuthStore Quick Start | ✅ |
| [`AUTHSTORE-INTEGRATION-GUIDE.md`](./GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md) | Vollständige AuthStore API Reference | ✅ Neu (23.10.) |
| [`Kanban-NIP.md`](./GUIDES/Kanban-NIP.md) | Nostr Event Schema | ✅ |
| [`PROP-VS-STATE-CHEATSHEET.md`](./GUIDES/PROP-VS-STATE-CHEATSHEET.md) | Svelte 5 Prop vs State Quick Reference | ✅ |
| [`QUICK-START.md`](./GUIDES/QUICK-START.md) | 10-Minuten Einstieg | ✅ |
| [`SIDEBAR-LOGIN-DOCS-INDEX.md`](./GUIDES/SIDEBAR-LOGIN-DOCS-INDEX.md) | Sidebar Login Dokumentations-Index | ✅ |
| [`SIDEBAR-LOGIN-INTEGRATION.md`](./GUIDES/SIDEBAR-LOGIN-INTEGRATION.md) | Sidebar Login Integration Guide | ✅ |
| [`TEST-RUNNER.md`](./GUIDES/TEST-RUNNER.md) | Test Suite Runner Guide | ✅ |

### COLLABORATION/ (5 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`CONSOLIDATION-SUMMARY.md`](./COLLABORATION/CONSOLIDATION-SUMMARY.md) | Documentation Consolidation Summary | ✅ Meta-Datei |
| [`CONTRIBUTING.md`](./COLLABORATION/CONTRIBUTING.md) | Contribution Richtlinien | ✅ |
| [`ROADMAP.md`](./COLLABORATION/ROADMAP.md) | Entwicklungs-Roadmap (Phase 1-5) | ✅ |
| [`DOCUMENTATION-AUDIT-SUMMARY.md`](./COLLABORATION/DOCUMENTATION-AUDIT-SUMMARY.md) | Audit Summary Report | ✅ Neu (24.10.) |
| [`DOCUMENTATION-AUDIT-REPORT.md`](./COLLABORATION/DOCUMENTATION-AUDIT-REPORT.md) | Detailed Audit Report | ✅ Neu (24.10.) |

### TESTSUITE/ (4 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`AUTHSTORE-TEST-PAGE.md`](./TESTSUITE/AUTHSTORE-TEST-PAGE.md) | AuthStore Test-Dokumentation | ✅ |
| [`GUIDE.md`](./TESTSUITE/GUIDE.md) | Ausführliches Test-Guide | ✅ |
| [`INDEX.md`](./TESTSUITE/INDEX.md) | Test Suite Navigation Hub | ✅ |
| [`STATUS.md`](./TESTSUITE/STATUS.md) | Test Suite Status & Überblick | ✅ |

### FEATURE/ (1 Datei)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`COMMENTS.md`](./FEATURE/COMMENTS.md) | Kommentar-System Feature Dokumentation | ✅ |

### REFERENCE/ (1 Datei)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`_INDEX.md`](.//_INDEX.md) | Diese Datei - Dokumentations-Navigation | ✅ |

---

## 🔗 Alle Dokumentationen verlinkt?

✅ **ARCHITECTURE/** — 11/11 Dateien verlinkt  
✅ **GUIDES/** — 8/8 Dateien verlinkt  
✅ **COLLABORATION/** — 5/5 Dateien verlinkt  
✅ **TESTSUITE/** — 4/4 Dateien verlinkt  
✅ **FEATURE/** — 1/1 Dateien verlinkt  
✅ **REFERENCE/** — 1/1 Dateien verlinkt  

**Total: 30/30 Dateien in /docs verlinkt und dokumentiert**

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

## � Nächste Schritte

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

## 📊 Dokumentations-Status

| Kategorie | Status | Letzte Aktualisierung |
|-----------|--------|----------------------|
| **Architecture** | ✅ Komplett | 21. Oktober 2025 |
| **🆕 Author Field Attribution** | ✅ Neu | 23. Oktober 2025 |
| **🆕 AuthStore Integration Guide** | ✅ Neu | 23. Oktober 2025 |
| **🆕 Reactive Flow Debugging** | ✅ Neu | 21. Oktober 2025 |
| **🆕 Prop vs State Cheat Sheet** | ✅ Neu | 21. Oktober 2025 |
| **Guides** | ✅ Komplett | 21. Oktober 2025 |
| **Collaboration** | ✅ Komplett | 21. Oktober 2025 |
| **Test Suite** | ✅ Komplett | 22. Oktober 2025 |
| **Features** | ✅ Komplett (Comments) | 22. Oktober 2025 |
| **Examples** | 🟡 Teilweise | — |
| **Troubleshooting** | 🟡 Teilweise | — |

**Bitte update diesen Index, wenn neue Dokumente hinzukommen!**

---

**Letzte Aktualisierung:** 23. Oktober 2025 (Author Field Attribution + AuthStore Integration Guide hinzugefügt)  
**Nächste Überprüfung:** Mit jedem Release
