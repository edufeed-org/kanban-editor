# Kommentar-System: Integrations-Status

**Datum:** 20. Oktober 2025  
**Status:** 📋 Planung Complete | 🔄 Implementierung Ready  
**Dokumentation:** ✅ Complete (5 Dateien, 100+ Seiten)

---

## 📊 Status-Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                  IMPLEMENTATION STATUS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PHASE A: UI-FORMULAR (CardViewDialog.svelte)                    │
│ Status: TODO                                                    │
│ Effort: 1-2 Stunden                                             │
│ Blocker: Keine                                                  │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Task: Textarea + Buttons im Comments-Tab                │     │
│ │ - [ ] Textarea import & render                          │     │
│ │ - [ ] SendIcon/LoaderIcon import                        │     │
│ │ - [ ] handleAddComment() handler                        │     │
│ │ - [ ] Form state (commentText, isLoading)               │     │
│ │ - [ ] Buttons disabled-states                           │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ PHASE B: STORE FIX (kanbanStore.svelte.ts)  CRITICAL            │
│ Status:  READY TO FIX (nur 1 Zeile!)                            │
│ Effort: 5 Minuten                                               │
│ Blocker: Keine                                                  │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Bug: triggerUpdate() fehlt in addComment()              │     │
│ │ Zeile ~295: Nach card.addComment() aufrufen             │     │
│ │ - [ ] this.triggerUpdate() hinzufügen                   │     │
│ │ - [ ] Test: Kommentar sichtbar nach Absenden            │     │
│ │ - [ ] Test: Kommentar bleibt nach Reload                │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ PHASE C: AUTHSTORE (authStore.svelte.ts)                        │
│ Status:  TODO (abhängig von Phase 1.4)                          │
│ Effort: 3-4 Stunden                                             │
│ Blocker: NIP-07 Signer                                          │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Task: currentUser State + NIP-07 Login                  │     │
│ │ - [ ] AuthStore.svelte.ts erstellen                     │     │
│ │ - [ ] loginWithNIP07() implementieren                   │     │
│ │ - [ ] currentUser npub State                            │     │
│ │ - [ ] In CardViewDialog: authStore.currentUser nutzen   │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ PHASE D: NOSTR EVENTS (nostrEvents.ts)                          │
│ Status:  TODO (kann mit Phase B parallel gehen)                 │
│ Effort: 2-3 Stunden                                             │
│ Blocker: Keine                                                  │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Task: createCommentEvent() für Kind 1 Events            │     │
│ │ - [ ] nostrEvents.ts erstellen                          │     │
│ │ - [ ] createCommentEvent() implementieren               │     │
│ │ - [ ] Kind 1 Event mit Tags                             │     │
│ │ - [ ] Integration in boardStore.publishToNostr()        │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
│ PHASE E: SYNCMANAGER (syncManager.svelte.ts)                    │
│ Status:  TODO (Phase 1.2 - Offline-First)                       │
│ Effort: 4-5 Stunden                                             │
│ Blocker: IndexedDB Implementation                               │
│ ┌─────────────────────────────────────────────────────────┐     │
│ │ Task: Event Queue für Offline-Sync                      │     │
│ │ - [ ] SyncManager.svelte.ts erstellen                   │     │
│ │ - [ ] IndexedDB Persisted Store Setup                   │     │
│ │ - [ ] publishOrQueue() method                           │     │
│ │ - [ ] Retry-Logic mit Backoff                           │     │
│ └─────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 Roadmap (Meilensteine)

```
Phase 1.3: KOMMENTAR-SYSTEM (CURRENT)
├─ 1.3.0: UI-Form + Store-Fix (Phase A + B)
│  └─ Meilenstein: "Kommentare hinzufügen funktioniert"
│     Effort: 2 Stunden
│     Acceptance: User kann Kommentare schreiben + speichern
│
├─ 1.3.1: Nostr Publishing (Phase D)
│  └─ Meilenstein: "Kommentare als Kind 1 Events"
│     Effort: 2-3 Stunden
│     Acceptance: Events zu Relays publiziert
│
├─ 1.3.2: Comment Management (Delete/Edit)
│  └─ Effort: 2-3 Stunden
│  └─ Features: Delete-Button, Edit-Modal, Kind 5 Events
│
└─ 1.3.3: Comment Features (Reactions, Threading)
   └─ Effort: 3-4 Stunden
   └─ Features: Reactions (Kind 7), Thread-Replies

Phase 1.4: AUTHENTIFICATION
├─ 1.4.1: AuthStore (Phase C)
│  └─ Effort: 3-4 Stunden
│  └─ Features: NIP-07, Session Management
│
└─ 1.4.2: User Profile Integration
   └─ Effort: 2-3 Stunden
   └─ Features: Profilbild, Name aus Nostr

Phase 1.2: OFFLINE-FIRST (kann parallel)
├─ 1.2.1: SyncManager (Phase E)
│  └─ Effort: 4-5 Stunden
│  └─ Features: IndexedDB Queue, Retry-Logic
│
└─ 1.2.2: Conflict Resolution
   └─ Effort: 2-3 Stunden
   └─ Features: Merge/Overwrite Strategies
```

---

## 🔄 Abhängigkeiten

### Kommentar-System hängt von:
```
✅ AGENTS.md              → Comment Interface (fertig)
✅ BoardModel.ts          → Card.addComment() (fertig)
✅ kanbanStore.svelte.ts  → addComment() Methode (fertig, nur Bug zu fixen)
✅ Svelte 5 Runes         → $state/$derived (fertig)
✅ Textarea Component     → UI (fertig via shadcn)
✅ NDK Context            → publishToNostr() (Phase 1.1, fertig)

⏳ AuthStore              → currentUser npub (Phase 1.4 - abhängig!)
⏳ NIP-07 Signer          → Event-Signierung (Phase 1.4 - abhängig!)
⏳ SyncManager            → Offline Queue (Phase 1.2 - optional)
⏳ createCommentEvent()   → Nostr Events (Phase D - abhängig!)
```

### Was Kommentar-System enabled:
```
✅ Nachher Phase A+B: Lokale Kommentare funktionieren
✅ Nachher Phase D: Nostr Publishing funktioniert
✅ Nachher Phase C: Multi-User Comments funktionieren
✅ Nachher Phase E: Offline-Sync funktioniert
✅ Enables: Comment Reactions (Kind 7)
✅ Enables: Comment Threading (Replies)
✅ Enables: Comment Search (NDK Subscriptions)
```

---

## 💼 Geschätzter Aufwand (Person-Stunden)

```
Total für Kommentar-System: ~20-25 Stunden
(bei Vollzeit-Entwickler: 2-3 Tage)

Breakdown:
├─ Phase A (UI-Form)        : 1-2h   (leicht)
├─ Phase B (Store-Fix)      : 0.1h   (trivial - nur 1 Zeile!)
├─ Phase C (AuthStore)      : 3-4h   (mittel - abhängig!)
├─ Phase D (Nostr Events)   : 2-3h   (mittel)
├─ Phase E (SyncManager)    : 4-5h   (komplex)
├─ Testing/QA               : 3-4h   (unit + integration)
└─ Documentation            : 2-3h   (fertig!)

Priority (für schnelle Lieferung):
1️⃣ Phase A+B (2h) → Lokal-First funktioniert ✅
2️⃣ Phase C (4h)   → Multi-User funktioniert ✅
3️⃣ Phase D (3h)   → Nostr funktioniert ✅
4️⃣ Phase E (5h)   → Offline funktioniert ✅
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: triggerUpdate() fehlt (BUG FOUND!)
**Status:** 🔴 CRITICAL  
**Impact:** UI wird nicht aktualisiert nach Kommentar-Absenden  
**Fix:** 1 Zeile hinzufügen in kanbanStore.addComment()  
**Workaround:** Keine (muss gefixt werden)

```typescript
// FIX:
result.card.addComment(text, author);
this.triggerUpdate();  // ← ADD THIS LINE!
this.publishToNostr();
```

### Issue 2: Author hardcoded
**Status:** 🟡 KNOWN  
**Impact:** Alle Kommentare haben falschen Author bis AuthStore kommt  
**Fix:** Phase C implementieren  
**Workaround:** Hardcode testing npub, dann zu AuthStore wechseln

### Issue 3: Kein Nostr Publishing ohne createCommentEvent()
**Status:** 🟡 KNOWN  
**Impact:** Kommentare nur lokal, nicht auf Nostr  
**Fix:** Phase D implementieren  
**Workaround:** Nur localStorage verwenden (bis Phase D)

### Issue 4: Offline Queue fehlt
**Status:** 🟡 FUTURE  
**Impact:** Events gehen verloren wenn offline  
**Fix:** Phase E implementieren  
**Workaround:** User muss warten bis online

---

## ✅ Akzeptanz-Kriterien (Definition of Done)

### MVP (Minimum Viable Product) - Phase A+B
```
✅ User kann Kommentar schreiben
✅ Kommentar wird nach Absenden angezeigt (sofort)
✅ Kommentar bleibt nach Browser-Reload
✅ Multiple Kommentare sind getrennt nach Card
✅ Author wird gespeichert (Placeholder OK)
✅ createdAt wird automatisch gesetzt
```

### With Auth - Phase A+B+C
```
✅ Obige MVP Kriterien +
✅ Author wird korrekt aus AuthStore gelesen
✅ Verschiedene Users haben verschiedene Authors
✅ User-Session wird gespeichert
✅ Logout funktioniert
```

### With Nostr - Phase A+B+C+D
```
✅ Obige Kriterien +
✅ Kind 1 Events werden erstellt
✅ Events haben richtige Tags ("a", "p")
✅ Events werden zu Relays publiziert
✅ Andere Clients können Kommentare sehen
```

### With Offline - Phase A+B+C+D+E
```
✅ Obige Kriterien +
✅ Kommentare funktionieren offline (lokal gespeichert)
✅ Events werden gequeued wenn offline
✅ Queue wird automatisch synced wenn online
✅ Retry-Logic funktioniert (max 3x)
✅ Dead-Letter nach Failed Events
```

---

## 📊 Sprint-Planning

### Sprint 1 (Heute: 20.10.2025) - 2 Stunden
**Goal:** Kommentare funktionieren lokal

- Task 1: Phase B-Fix (triggerUpdate) - 5 Min ✅ Ready
- Task 2: Phase A-UI (Form) - 1.5h ✅ Ready
- Task 3: Testing & Bug-Fixes - 30 Min ✅ Ready

**Definition of Done:** User kann Kommentare schreiben + speichern

---

### Sprint 2 (Morgen: 21.10.2025) - 4 Stunden
**Goal:** AuthStore implementieren

- Task 1: AuthStore.svelte.ts Setup - 2h
- Task 2: NIP-07 Integration - 1.5h
- Task 3: Testing - 30 Min

**Definition of Done:** Author wird korrekt aus AuthStore gelesen

---

### Sprint 3 (21.10-22.10) - 3 Stunden
**Goal:** Nostr Publishing funktioniert

- Task 1: createCommentEvent() - 1.5h
- Task 2: Integration in publishToNostr() - 1h
- Task 3: Testing mit Relays - 30 Min

**Definition of Done:** Kommentare erscheinen in Nostr Clients

---

### Sprint 4 (22.10-23.10) - 5 Stunden
**Goal:** Offline-First funktioniert

- Task 1: SyncManager Setup - 2h
- Task 2: IndexedDB Queue - 2h
- Task 3: Retry-Logic - 1h

**Definition of Done:** Offline/Online Szenarien funktionieren

---

## 🎯 Start-Empfehlung

**Schnellster Weg zu Working Comments (heute):**

1. ✅ Lese KOMMENTAR-SUMMARY.md (10 Min)
2. ✅ Lese KOMMENTAR-QUICK-REF.md (5 Min)
3. ✅ Implementiere Phase A (UI-Form) - 1.5h
4. ✅ Implementiere Phase B-Fix (triggerUpdate) - 5 Min
5. ✅ Teste: User kann Kommentare schreiben + speichern
6. ✅ Commit!

**Gesamt:** ~2 Stunden → Funktionierendes Kommentar-System ✅

**Nachher:** Phase C (Auth) + Phase D (Nostr) können parallel gehen

---

## 📞 Support während Implementation

**Fragen?** Siehe entsprechender Datei:
- Konzept unklar? → KOMMENTAR-ARCHITEKTUR.md
- Code-Probleme? → KOMMENTAR-IMPLEMENTATION.md
- Schnelle Antwort? → KOMMENTAR-QUICK-REF.md
- Details? → KOMMENTAR-SYSTEM.md

**Alle Dateien sind miteinander verlinkt!**

---

## 🎓 Learning Path

```
Anfänger:
  1. KOMMENTAR-SUMMARY.md (Überblick)
  2. KOMMENTAR-ARCHITEKTUR.md (Konzepte verstehen)
  3. KOMMENTAR-IMPLEMENTATION.md (Code schreiben)
  4. KOMMENTAR-QUICK-REF.md (Debugging)

Erfahren:
  1. KOMMENTAR-QUICK-REF.md (Copy-Paste)
  2. KOMMENTAR-IMPLEMENTATION.md (Details prüfen)
  3. Code schreiben!

Manager:
  1. KOMMENTAR-SUMMARY.md (Roadmap)
  2. Dieser Status (Sprint-Planning)
  3. Tracking in JIRA/GitHub Issues
```

---

**Status:** 🟢 Ready for Implementation  
**Next:** Starten Sie mit Phase A + Phase B!  
**Questions?** Siehe KOMMENTAR-DOKUMENTATIONS-INDEX.md

---

**Erstellt:** 20. Oktober 2025  
**Nächste Aktualisierung:** Nach Implementation Phase A+B
