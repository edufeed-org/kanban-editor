# 🧪 QUICK TEST CHECKLIST - Board Deletion Fix

**Geschätzte Zeit:** 10-15 Minuten  
**Zweck:** Validierung der Event-ID Implementation

---

## ✅ Schritt 1: Neues Board erstellen (5 Minuten)

**Browser A:**
```
1. [ ] Developer Console öffnen (F12)
2. [ ] Neues Board erstellen: "Deletion Test 1"
3. [ ] Warte auf Publish (1-2 Sekunden)

PRÜFE LOGS:
4. [ ] ✅ "[SyncManager] 🔑 Event ID: <hex-string>" VORHANDEN?
5. [ ] ✅ "[NostrIntegration] 🔑 Board Event-ID captured: <hex-string>" VORHANDEN?
6. [ ] ❌ NICHT "Event-ID not available" oder "NOT SET"

WENN ALLES OK: ✅ WEITER ZU SCHRITT 2
WENN FEHLER: ⚠️ Siehe EVENTID-IMPLEMENTATION-SUMMARY.md → Fehler 1
```

---

## ✅ Schritt 2: Board löschen (5 Minuten)

**Browser A:**
```
1. [ ] Board "Deletion Test 1" aus Sidebar löschen
2. [ ] Prüfe Console-Logs:

ERWARTE:
3. [ ] ✅ "Board Event ID: <hex-string>" (NICHT "NOT SET")
4. [ ] ✅ "[SyncManager] Event signed"
5. [ ] ✅ "[SyncManager] ✅ Event published to X relay(s)"

DOCKER RELAY:
6. [ ] Terminal öffnen
7. [ ] docker logs nostr-cli-nostr-relay-1 --tail 20
8. [ ] ✅ "hid 1 deleted events for author ..." (MUSS 1 SEIN, NICHT 0!)

WENN "hid 0": ❌ Deletion fehlgeschlagen → Debug
WENN "hid 1": ✅ WEITER ZU SCHRITT 3
```

---

## ✅ Schritt 3: Reload & Persistenz (2 Minuten)

**Browser A:**
```
1. [ ] Seite neu laden (F5)
2. [ ] Warte auf Boards geladen (1-2 Sekunden)

PRÜFE SIDEBAR:
3. [ ] ✅ "Deletion Test 1" ist NICHT mehr sichtbar
4. [ ] ✅ Andere Boards sind noch da

WENN Board wieder da: ❌ localStorage nicht gelöscht → Debug
WENN Board weg: ✅ SUCCESS! Board-Deletion funktioniert!
```

---

## ✅ Schritt 4: Multi-Browser Sync (Optional - 3 Minuten)

**Browser B (separates Fenster):**
```
1. [ ] Board-Liste im zweiten Browser öffnen
2. [ ] In Browser A: Neues Board "Multi-Sync Test" erstellen
3. [ ] Warte 2-5 Sekunden

PRÜFE BROWSER B:
4. [ ] ✅ "Multi-Sync Test" erscheint automatisch

IN BROWSER A:
5. [ ] Board "Multi-Sync Test" löschen

PRÜFE BROWSER B:
6. [ ] ✅ Board verschwindet automatisch (oder nach F5)

WENN funktioniert: ✅ Multi-Browser Sync OK!
```

---

## 📋 Ergebnis-Matrix

| Test | Status | Zeit | Notizen |
|------|--------|------|---------|
| **Schritt 1:** Event-ID Capture | ⬜ | 5 Min | Console muss Event-ID zeigen |
| **Schritt 2:** Deletion Event | ⬜ | 5 Min | Relay muss "hid 1" zeigen |
| **Schritt 3:** Persistenz | ⬜ | 2 Min | Board bleibt weg nach Reload |
| **Schritt 4:** Multi-Browser | ⬜ | 3 Min | Optional |

**GESAMT:** 15 Minuten

---

## ⚠️ Quick Debug

### Problem: Event-ID nicht captured
```javascript
// Browser Console:
console.log('Signer:', authStore.getPubkey());
console.log('Online:', navigator.onLine);
console.log('Board:', JSON.parse(localStorage.getItem('kanban-<board-id>')).eventId);
```

### Problem: Relay zeigt "hid 0"
```bash
# Terminal:
docker logs nostr-cli-nostr-relay-1 --tail 30 | grep "deleted"
# Suche nach der Event-ID des Boards
```

### Problem: Board nach Reload wieder da
```javascript
// Manuell löschen:
localStorage.removeItem('kanban-<board-id>');
const ids = JSON.parse(localStorage.getItem('kanban-boards-list'));
localStorage.setItem('kanban-boards-list', JSON.stringify(ids.filter(id => id !== '<board-id>')));
```

---

## ✅ Success Criteria

**ALLE 3 Schritte MÜSSEN erfolgreich sein:**

1. ✅ Event-ID wird captured (Console zeigt Hex-String)
2. ✅ Relay löscht Event (Docker Logs: "hid 1 deleted events")
3. ✅ Board bleibt weg nach Reload (Sidebar zeigt Board nicht mehr)

**WENN ALLE OK:** 🎉 **BUG #2 GEFIXT!**

**WENN FEHLER:** Siehe EVENTID-IMPLEMENTATION-SUMMARY.md für Details

---

**Nächster Schritt:** Multi-Browser Testing (beide Bugs)
