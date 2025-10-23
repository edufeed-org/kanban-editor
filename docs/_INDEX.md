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

### 🏛️ docs/ Struktur
```
docs/
├── REFERENCE/
│   ├── _INDEX.md              ← Sie sind hier
│   └── 🆕 PROP-VS-STATE-CHEATSHEET.md  # Quick Ref
├── ARCHITECTURE/
│   ├── REACTIVITY.md          # Svelte 5 Runes + $effect
│   ├── STORES.md              # State Management
│   ├── 🆕 REACTIVE-FLOW-VERIFICATION.md  # Debugging Guide
│   ├── 🆕 AUTHOR-FIELD-ATTRIBUTION.md  # Serialisierung & Persistierung
│   ├── NDK.md                 # Nostr Integration
│   ├── NOSTR-USER.md          # Authentication
│   └── UX-RULES.md            # shadcn-svelte Guidelines
├── COLLABORATION/
│   ├── ROADMAP.md             # Phasen & Meilensteine
│   └── CONTRIBUTING.md        # Beitrag-Richtlinien
├── GUIDES/
│   ├── QUICK-START.md         # Schnelleinstieg
│   ├── 🆕 AUTHSTORE-INTEGRATION-GUIDE.md  # AuthStore API Reference
│   └── Kanban-NIP.md          # Event Schema
├── TESTSUITE/
│   ├── INDEX.md               # Test Suite Navigation Hub
│   ├── STATUS.md              # Quick Status & Überblick
│   └── GUIDE.md               # Ausführliche Anleitung
└── FEATURE/
    └── COMMENTS.md            # Kommentar-System Feature
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

## 🚀 Nächste Schritte

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
