# 📚 Kommentar-System: Dokumentations-Index

## 🎯 Quick Navigation

**Anfänger?** → Starten Sie hier: [KOMMENTAR-SUMMARY.md](./KOMMENTAR-SUMMARY.md)  
**Entwickler?** → Implementierungs-Details: [KOMMENTAR-IMPLEMENTATION.md](./KOMMENTAR-IMPLEMENTATION.md)  
**Visuelle Lerner?** → Diagramme & Flows: [KOMMENTAR-ARCHITEKTUR.md](./KOMMENTAR-ARCHITEKTUR.md)  
**Quick Lookup?** → Schnell-Referenz: [KOMMENTAR-QUICK-REF.md](./KOMMENTAR-QUICK-REF.md)  
**Vollständig?** → Alles: [KOMMENTAR-SYSTEM.md](./KOMMENTAR-SYSTEM.md)

---

## 📄 Datei-Übersicht

| Datei | Umfang | Zielgruppe | Fokus |
|-------|--------|-----------|-------|
| **KOMMENTAR-SUMMARY.md** | 8 Seiten | Manager, Tech Lead | TL;DR, Roadmap, Meilensteine |
| **KOMMENTAR-IMPLEMENTATION.md** | 12 Seiten | Frontend-Entwickler | Schritt-für-Schritt UI-Code |
| **KOMMENTAR-ARCHITEKTUR.md** | 15 Seiten | Architekten | Diagramme, State Flows, Datenfluss |
| **KOMMENTAR-QUICK-REF.md** | 10 Seiten | Schnelle Lookup | Copy-Paste Code, Fehler-Lösungen |
| **KOMMENTAR-SYSTEM.md** | 50+ Seiten | Alle (Referenz) | Vollständiger Plan + Details |
| **KOMMENTAR-DOKUMENTATIONS-INDEX.md** | Diese Datei | Navigation | Orientierung |

---

## 🗺️ Leseanleitung

### Für Anfänger (Keine Erfahrung mit Kommentar-System)

1. **Starten:** [KOMMENTAR-SUMMARY.md](./KOMMENTAR-SUMMARY.md)
   - 📌 TL;DR - Die 3 wichtigsten Dinge
   - 🔄 Der Complete Flow (Schritt-für-Schritt)
   - ⚠️ Kritische Fehler zu vermeiden
   - **Dauer:** 10-15 Min

2. **Implementieren:** [KOMMENTAR-IMPLEMENTATION.md](./KOMMENTAR-IMPLEMENTATION.md)
   - 🎯 Das Problem (AKTUELL)
   - 🔧 Die Lösung (3 Parts)
   - 🔍 Debugging Guide
   - 📝 Checklist
   - **Dauer:** 30-60 Min

3. **Vertiefen:** [KOMMENTAR-SYSTEM.md](./KOMMENTAR-SYSTEM.md)
   - Alle Details & Edge Cases
   - Error Handling
   - Best Practices

---

### Für erfahrene Entwickler (Schnell umsetzen)

1. **Quick Start:** [KOMMENTAR-QUICK-REF.md](./KOMMENTAR-QUICK-REF.md)
   - 🎯 Die 3 kritischen Teile
   - Copy-Paste Code snippets
   - Häufige Fehler & Lösungen
   - **Dauer:** 5-10 Min

2. **Implementieren:** Copy-Paste Code aus QUICK-REF oder IMPLEMENTATION

3. **Debuggen:** Checklist + Fehler-Lösungen

---

### Für Architekten (System verstehen)

1. **Überblick:** [KOMMENTAR-ARCHITEKTUR.md](./KOMMENTAR-ARCHITEKTUR.md)
   - Komponenten-Übersicht
   - Store State Management
   - Flow-Diagramme
   - State Diagram
   - **Dauer:** 20-30 Min

2. **Details:** [KOMMENTAR-SYSTEM.md](./KOMMENTAR-SYSTEM.md) (Relevante Sections)

---

## 🎯 Key Sections Quick Links

### Die 3 Implementierungs-Phasen

| Phase | Fokus | Datei | Zeit |
|-------|-------|-------|------|
| **Phase A** | UI-Formular | IMPLEMENTATION.md (PART 1) | 1-2h |
| **Phase B** | Store Fix (🔑 Critical) | IMPLEMENTATION.md (PART 2) + QUICK-REF.md | 5 Min |
| **Phase C+** | AuthStore + Nostr | SYSTEM.md | 3-8h |

### Die 3 kritischen Konzepte

1. **Array Reassignment** (Svelte 5 Requirement)
   - Wo: `src/lib/classes/BoardModel.ts` (BoardModel.Card.addComment)
   - Was: `this.comments = [...this.comments, comment]`
   - Warum: Nur Reassignments triggern Reaktivität
   - Lesen: QUICK-REF.md → Fehler 2

2. **triggerUpdate()** (The Missing Line)
   - Wo: `src/lib/stores/kanbanStore.svelte.ts` (~295)
   - Was: `this.triggerUpdate()` nach `result.card.addComment()`
   - Warum: Inkrementiert updateTrigger → $derived.by() neu berechnet
   - Lesen: QUICK-REF.md → Part 2, IMPLEMENTATION.md → PART 2

3. **Nostr Kind 1 Events** (Future)
   - Wo: `src/lib/utils/nostrEvents.ts` (zu erstellen)
   - Was: `createCommentEvent()` mit korrekten Tags
   - Warum: Dezentrale Speicherung & Cross-Device Sync
   - Lesen: ARCHITEKTUR.md → Section 6, SYSTEM.md → Section C

---

## ⚡ Häufige Fragen

**Q: Wo fange ich an?**  
A: 1. KOMMENTAR-SUMMARY.md (10 Min), 2. Phase A implementieren (1-2h)

**Q: Warum funktioniert mein Kommentar nicht?**  
A: 99% Wahrscheinlichkeit: `triggerUpdate()` fehlt → QUICK-REF Fehler 1

**Q: Was ist `triggerUpdate()`?**  
A: QUICK-REF.md → Part 2 → "Was triggerUpdate() macht"

**Q: Wie publishe ich zu Nostr?**  
A: ARCHITEKTUR.md → Section 6 (Kind 1 Schema)

**Q: Was ist Array Reassignment?**  
A: QUICK-REF.md → Fehler 2 + ARCHITEKTUR.md → Section 1

---

## 🗂️ Daten-Struktur Referenz

### Comment Object
```typescript
interface Comment {
  id: string;                    // generateDTag()
  text: string;                  // User input
  author: string;                // npub (von AuthStore)
  createdAt: string;             // ISO 8601 (generateTimestamp())
}
```

### Speicherung-Hierachie
```
LocalStorage
  └─ board
      └─ columns
          └─ cards
              └─ comments[]  ← Arrays mit Kommentaren
                  └─ Comment

Nostr (Kind 1)
  └─ Event
      ├─ kind: 1
      ├─ content: "Kommentar Text"
      ├─ tags: ["a", "30302:author:card-id"]
      └─ tags: ["p", "card-author-npub"]
```

---

## 🔄 State Update Flow (Kurz)

```
UI Input → Store Handler → Board Mutation → triggerUpdate()
    ↓          ↓                  ↓               ↓
textarea  boardStore.         card.comments   updateTrigger++
  bind   addComment()     = [..., comment]  localStorage save
                                                    ↓
                            $derived.by() neu berechnet
                                    ↓
                            uiData aktualisiert
                                    ↓
                            Column.svelte $effect
                                    ↓
                            UI re-rendert ✅
```

---

## 🚀 Implementierungs-Reihenfolge

### Sprint 1 (Tag 1-2)
1. ✅ Phase A: UI-Formular (1-2h)
2. ✅ Phase B-Fix: triggerUpdate() (5 Min) 🔑
3. ✅ Testen: Kommentare hinzufügen + Reload-Test

### Sprint 2 (Tag 3-4)
4. ⏳ Phase C: AuthStore (3-4h)
5. ⏳ Testen: Author wird richtig gespeichert

### Sprint 3 (Tag 5-7)
6. ⏳ Phase D: Nostr Events (2-3h)
7. ⏳ Phase E: SyncManager (4-5h)
8. ⏳ Testen: Offline/Online Scenarios

---

## 📊 Komplexitäts-Matrix

| Komponente | Komplexität | Abhängigkeiten | Est. Zeit |
|-----------|-------------|----------------|-----------|
| UI-Form | ⭐ Einfach | Textarea, Button | 1-2h |
| triggerUpdate() Fix | ⭐ Trivial | Store Wissen | 5 Min |
| AuthStore | ⭐⭐ Mittel | NIP-07 | 3-4h |
| Nostr Events | ⭐⭐ Mittel | NDK, Kanban-NIP | 2-3h |
| SyncManager | ⭐⭐⭐ Komplex | IndexedDB, Async | 4-5h |
| Delete/Edit | ⭐⭐ Mittel | Kind 5, Replaceable | 2-3h |

---

## 🔐 Sicherheits-Checklist

- [ ] Private Keys werden NICHT in localStorage gespeichert
- [ ] Nur npub wird lokal gespeichert
- [ ] Session-Expiration: 7 Tage
- [ ] Kommentar-Text wird sanitiziert (XSS-Protection)
- [ ] Event-Signatures werden validiert

---

## 🎓 Relevante Dokumente (Projekt)

- **AGENTS.md** → Comment Interface + BoardModel.Card.addComment()
- **STORES.md** → BoardStore $state/$derived Mechanik
- **Kanban-NIP.md** → Event Schema (Kind 1, Tags)
- **NOSTR-USER.md** → AuthStore + NIP-07
- **NDK.md** → Event Publishing
- **MULTI-LAYER STORAGE.md** → Array Reassignments

---

## ✅ Acceptance Criteria (Gesamt)

### Kommentar-Form (Phase A)
- ✅ Textarea wird angezeigt
- ✅ Placeholder-Text sichtbar
- ✅ Submit disabled bei leerem Text
- ✅ Loading-State während Absenden

### Kommentar speichern (Phase B)
- ✅ Neuer Kommentar erscheint sofort in UI
- ✅ Kommentar bleibt nach Reload
- ✅ localStorage wird aktualisiert

### Kommentar-Autor (Phase C)
- ✅ Kommentar hat korrekten Author (npub)
- ✅ Unterschiedliche Authors für verschiedene User
- ✅ "anonymous" wenn nicht authentifiziert

### Nostr Publishing (Phase D)
- ✅ Kind 1 Event wird erstellt
- ✅ Event hat "a"-Tag mit Card-Ref
- ✅ Event wird zu Relays publiziert
- ✅ Andere Clients können Kommentar sehen

---

## 📞 Support

**Bug im Code?**  
→ Siehe KOMMENTAR-IMPLEMENTATION.md → Debugging Guide

**Konzept unklar?**  
→ Siehe KOMMENTAR-ARCHITEKTUR.md mit Diagrammen

**Code-Beispiel?**  
→ Siehe KOMMENTAR-QUICK-REF.md → Copy-Paste Snippets

**Alles?**  
→ Siehe KOMMENTAR-SYSTEM.md (vollständige Referenz)

---

**Last Updated:** 20. Oktober 2025  
**Status:** 📋 Dokumentation Complete, Implementierung Ready  
**Nächste Schritte:** Phase A UI + Phase B-Fix starten!
