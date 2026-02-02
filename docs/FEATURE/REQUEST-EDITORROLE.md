# Request Editor Role (Maintainer-Request)

**Status:** Vorschlag (nicht implementiert)  
**Datum:** 02.02.2026  
**Zweck:** Viewer können eine Editor-/Maintainer-Rolle für ein Board anfragen.

---

## I. Übersicht

Viewer (Role = `viewer`) sollen optional eine **Editor-Rolle** anfordern können. Der Request ist ein **explizites Event**, das der Owner im ShareDialog sieht und bestätigen/ablehnen kann. Ohne bestätigende Aktion durch den Owner entstehen **keine** Berechtigungen.

**Kernprinzip:**
- Request = Vorschlag durch den Viewer
- Freischaltung = aktive Aktion des Owners (z. B. `addEditor()`)

---

## II. Quick Start

**Minimaler Ablauf:**

1. Viewer klickt „Editorrechte anfragen“.
2. Client publiziert ein Request‑Event (z. B. Kind `30000` mit `d=kanban-editor-request:<boardRef>`).
3. Owner lädt Requests und bestätigt sie im ShareDialog.
4. Owner setzt die Rolle via BoardStore (`addEditor()`), Request wird optional gelöscht.

---

## III. Details

### Event‑Vorschlag (Parametrized Replaceable, Kind 30000)

**Board‑Referenz:** `30301:<owner-pubkey>:<board-id>`

```json
{
  "kind": 30000,
  "tags": [
    ["d", "kanban-editor-request:30301:<owner-pubkey>:<board-id>"],
    ["a", "30301:<owner-pubkey>:<board-id>"],
    ["p", "<owner-pubkey>"],
    ["role", "editor"],
    ["reason", "Ich möchte am Board mitarbeiten."]
  ],
  "content": "Request editor role",
  "created_at": 1700000000,
  "pubkey": "<requester-pubkey>"
}
```

**Semantik:**
- `a` referenziert das Board (kanonische Replaceable‑Adresse)
- `p` adressiert den Owner
- `role=editor` (oder in Zukunft `viewer|editor|owner`)
- `reason` optional, UI‑Text für den Owner

### UI‑Integration (ShareDialog)

- **Viewer‑Ansicht:** Button „Editorrechte anfragen“ (nur wenn `userRole === viewer`).
- **Owner‑Ansicht:** Liste „Requests“ mit Accept/Reject.
- **Accept:** ruft `boardStore.addEditor(requesterPubkey)`.
- **Reject:** optional Kind‑5 Deletion oder einfach ignorieren.

### Owner‑Hinweis (Topbar + Dialog):
- **Topbar‑Glocke** zeigt Anzahl offener Editor‑Requests
- Klick öffnet Dialog (ShareDialog, Tab „Editoren“)
- Dialog nutzt vorab geladene Requests für sofortige Anzeige
- Viewer mit aktiver Anfrage werden als „Editor angefragt“ markiert
- Optionaler „Als Editor hinzufügen“-Button (ein Klick)
- Grund (`reason`) wird als kurze Vorschau angezeigt

### UX‑Hinweis bei fehlenden Rechten (Permission‑Toast)

- **Modifizierter Toast** für Viewer bei fehlender Berechtigung.
- **Aktionen:** „Rechte beantragen“ (öffnet Request‑Dialog) und „Nicht mehr anzeigen“ (Opt‑out).

### UI‑Integration (Topbar‑Glocke)

- **Signal:** Bei offenen Requests blinkt eine Glocke in der Topbar.
- **Aktion:** Klick öffnet einen Dialog mit der Request‑Liste.
- **Dialog‑Actions:** „Annehmen“ (→ `addEditor()`), „Ablehnen“ (optional Delete/Ignore).
- **Badge/Zähler:** Optional eine Zahl für offene Requests.

---

## IV. Fehler & Edge‑Cases

- **Doppelte Requests:** Durch `d`‑Tag ist der Request pro Board ersetzbar (Update statt Duplikat).
- **Kein Owner erreichbar:** Request bleibt im Relay, bis Owner online ist.
- **Missbrauch/Spam:** Optional Filter (Rate‑Limit, bekannte Relays, Request‑Cooldown).
- **Pubkey‑Mismatch:** Owner ignoriert Requests, deren `a`‑Tag nicht zum Board passt.

---

## V. Referenzen

- [`FEATURE/PERMISSION-SYSTEM.md`](./PERMISSION-SYSTEM.md)
- [`FEATURE/SHARELINK.md`](./SHARELINK.md)
- [`GUIDES/COMMUNIKEY.md`](../GUIDES/COMMUNIKEY.md)
- [`GUIDES/Kanban-NIP.md`](../GUIDES/Kanban-NIP.md)
