# 🌍 Nostr Architecture & Integration - Index

**Version:** 1.0  
**Datum:** 10. November 2025  
**Status:** ✅ Phase 1.1 Complete (Publishing, Loading, Subscription)  
**Nächste Phase:** Phase 1.2 (Card-Events Kind 30302)

---

## 🎯 Schnell-Navigation: "Wer nutzt was?"

| Ich brauche... | 📄 Datei | 🎯 Zielgruppe |
|----------------|---------|--------------|
| **Architektur-Übersicht** | [README.md](./README.md) | Alle Developer |
| **Wie funktionieren Events?** | [EVENT-HANDLING-AND-SYNC.md](./EVENT-HANDLING-AND-SYNC.md) | Architekt, Backend |
| **Board-Loading implementieren** | [LOADING-SUBSCRIPTION.md](./LOADING-SUBSCRIPTION.md) | Backend Developer |
| **Relay-Strategie verstehen** | [IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md](./IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md) | Backend Developer |
| **Was waren die Bug-Fixes?** | [REFERENCE/](./REFERENCE/) | Debugging, Archaeologie |
| **Nächste Phase 1.2 planen** | [NEXT-STEPS/](./NEXT-STEPS/) | Tech Lead, Architect |

---

## 📂 Ordner-Struktur

```
docs/ARCHITECTURE/NOSTR/
├── README.md                           ← Phase 1.1 Summary & Übersicht
├── _INDEX.md                           ← Du bist hier!
│
├── EVENT-HANDLING-AND-SYNC.md          ← Core Architektur (LWW, Echo, DnD)
├── LOADING-SUBSCRIPTION.md             ← Implementation: Board-Loading
│
├── IMPLEMENTATION/                     ← Implementierungs-Details
│   └── DRAFT-PUBLISHING-STRATEGY.md   └─ Relay-Auswahl Logik
│
├── REFERENCE/                          ← Historisch & Debugging
│   ├── BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md
│   └── FIX-SUMMARY.md
│
└── NEXT-STEPS/                         ← Geplant für Phase 1.2+
    ├── INTEGRATION-ANALYSIS-MERGE-vs-LWW.md
    ├── MERGE-LWW-INTEGRATION-TODO.md
    └── MERGE-vs-LWW-OVERVIEW.md
```

---

## 🚀 Für Neue Developer: Start hier!

### 1. **Die Grundlagen** (15 min)
   - Lies: [README.md](./README.md) - Phase 1.1 Übersicht
   - Verstehe: Board-Events (Kind 30301), Card-Events (Kind 30302)

### 2. **Wie lädt man Boards?** (30 min)
   - Lies: [LOADING-SUBSCRIPTION.md](./LOADING-SUBSCRIPTION.md)
   - Implementiere: Nostr Board Loading in BoardStore
   - Test: Boards erscheinen nach Login

### 3. **Publishing verstehen** (20 min)
   - Lies: [IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md](./IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md)
   - Verstehe: Relay-Auswahl nach PublishState

### 4. **Events in der Praxis** (30 min)
   - Lies: [EVENT-HANDLING-AND-SYNC.md](./EVENT-HANDLING-AND-SYNC.md)
   - Lerne: Last-Write-Wins, Echo-Prevention, Snapshot-Sync

---

## 🐛 Wenn es Bugs gibt: Debugging-Pfad

**Problem: Karten verschwinden nach Publish**
1. Lies: [REFERENCE/FIX-SUMMARY.md](./REFERENCE/FIX-SUMMARY.md) - Quick Summary
2. Studiere: [REFERENCE/BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md](./REFERENCE/BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md) - Root Cause
3. Implementierungsfixes: [LOADING-SUBSCRIPTION.md](./LOADING-SUBSCRIPTION.md) Abschnitt 3.2

**Problem: Events werden doppelt publiziert**
1. Lies: [EVENT-HANDLING-AND-SYNC.md](./EVENT-HANDLING-AND-SYNC.md) Abschnitt 2 (Echo-Prevention)
2. Checke: [IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md](./IMPLEMENTATION/DRAFT-PUBLISHING-STRATEGY.md) Relay-Logik

**Problem: Alte Änderungen überschreiben neue**
1. Lies: [EVENT-HANDLING-AND-SYNC.md](./EVENT-HANDLING-AND-SYNC.md) Abschnitt 1 (Last-Write-Wins)
2. Debugge: Timestamps in localStorage vs. Nostr

---

## 📊 Phase-Status

| Phase | Status | Docs | Nächste Schritte |
|-------|--------|------|-----------------|
| **Phase 1.1** ✅ | COMPLETE | Architektur dokumentiert | → Phase 1.2 |
| **Phase 1.2** 🔄 | PLANNED | In `NEXT-STEPS/` | Card-Event Loading |
| **Phase 2.0** 🔴 | BLOCKED | [NEXT-STEPS/MERGE-LWW-*.md](./NEXT-STEPS/) | Merge-LWW Integration (70 min) |

---

## 📚 Weiterführende Ressourcen

- **Nostr Standards:** [NIP-01 (Basic Protocol)](https://github.com/nostr-protocol/nips/blob/master/01.md)
- **Replaceable Events:** [NIP-16](https://github.com/nostr-protocol/nips/blob/master/16.md)
- **NDK Docs:** [Nostr Development Kit](https://docs.nostr.com/)
- **Projekt ROADMAP:** [`docs/COLLABORATION/ROADMAP.md`](../../../COLLABORATION/ROADMAP.md)
- **Governance Rules:** [`docs/DOCUMENTATION-RULES-v3.md`](../../DOCUMENTATION-RULES-v3.md)

---

## 🔗 Verwandte Dokumentation (außerhalb NOSTR/)

| Thema | Datei | Grund |
|-------|-------|-------|
| BoardStore API | [`STORES/BOARDSTORE.md`](../STORES/BOARDSTORE.md) | Implementiert NOSTR-Logik |
| SyncManager | [`STORES/SYNCMANAGER.md`](../STORES/SYNCMANAGER.md) | Queuing & Offline |
| AuthStore | [`STORES/AUTHSTORE.md`](../STORES/AUTHSTORE.md) | User-Context für Pubkey |
| Event Schema | [`../../Kanban-NIP.md`](../../Kanban-NIP.md) | Kind 30301/30302 Definition |

---

## 🎓 Checkliste: "Bin ich bereit für Entwicklung?"

- [ ] Ich verstehe Kind 30301 vs. Kind 30302
- [ ] Ich weiß, wie Last-Write-Wins funktioniert
- [ ] Ich kann Echo-Prevention erklären
- [ ] Ich habe LOADING-SUBSCRIPTION.md gelesen
- [ ] Ich kenne die Relay-Auswahl-Strategie
- [ ] Ich bin bereit, Phase 1.2 zu implementieren 🚀

---

**Zuletzt aktualisiert:** 10. November 2025  
**Maintainer:** AI Agent (edufeed-org)  
**Status:** ✅ Ready for Development
