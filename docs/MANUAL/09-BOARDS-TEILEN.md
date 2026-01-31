# 09 - Boards teilen: Zusammenarbeit starten

**Ziel:** Nach diesem Kapitel können Sie Boards mit Kollegen teilen und Zugriffsrechte verwalten.

---

## 🔗 Sharing-Optionen im Überblick

```
┌─────────────────────────────────────────────────────────────────┐
│                    Wie möchten Sie teilen?                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔗 Share-Link (schnell)                                        │
│     Board als URL teilen - Empfänger importiert als Kopie       │
│                                                                 │
│  👥 Kollaborativ (Echtzeit)                                     │
│     Board mit Nutzern teilen - Gemeinsam bearbeiten             │
│                                                                 │
│  📥 Export (Datei)                                              │
│     Board als JSON-Datei speichern und versenden                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Share-Link erstellen

### So funktioniert's

1. Öffnen Sie Ihr Board
2. Klicken Sie auf **🔗 Teilen** in der Topbar
3. Ein Share-Link wird generiert
4. Kopieren Sie den Link und versenden Sie ihn

```
┌─────────────────────────────────────────────────────────────────┐
│  🔗 Board teilen                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Share-Link:                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ https://kanban.edufeed.org/?import=eJzLz0nNyUks...      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────┐  ┌─────────────────┐                       │
│  │ 📋 Kopieren    │  │ 📧 Per E-Mail   │                       │
│  └────────────────┘  └─────────────────┘                       │
│                                                                 │
│  📊 Token-Größe: ████░░░░░░ 42% (2.1 KB)                       │
│                                                                 │
│  ℹ️ Der Link enthält das gesamte Board (komprimiert).          │
│     Empfänger erhält eine Kopie des aktuellen Stands.          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Was passiert beim Empfänger?

1. Empfänger öffnet den Link
2. Import-Dialog erscheint
3. Optionen:
   - **Als neues Board** - Eigene Kopie erstellen
   - **Merge** - Mit bestehendem Board zusammenführen
   - **Überschreiben** - Bestehendes Board ersetzen

### Limitierungen

| Aspekt | Limit |
|--------|-------|
| **URL-Länge** | Max. ~8.000 Zeichen |
| **Board-Größe** | Kleine bis mittlere Boards |
| **Komprimierung** | ~76% Reduktion |

**💡 Tipp:** Für große Boards nutzen Sie Export/Import (JSON-Datei).

---

## 👥 Kollaboratives Teilen

### Nutzer einladen

1. Öffnen Sie **🔗 Teilen**
2. Wechseln Sie zu **👥 Kollaboration**
3. Geben Sie die Nostr-Adresse (npub) ein
4. Wählen Sie die Berechtigung
5. Klicken Sie **Einladen**

```
┌─────────────────────────────────────────────────────────────────┐
│  👥 Kollaborativ teilen                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nutzer einladen:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ npub1xyz... oder Name                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Berechtigung: [Editor ▼]                                       │
│                 ├── 👀 Betrachter (nur lesen)                   │
│                 ├── ✏️ Editor (bearbeiten)                      │
│                 └── 👑 Co-Owner (alles)                         │
│                                                                 │
│  ┌────────────────┐                                             │
│  │ ➕ Einladen    │                                             │
│  └────────────────┘                                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│  Aktuelle Teilnehmer:                                           │
│                                                                 │
│  👑 Sie (Owner)                    [Kann nicht entfernt werden] │
│  ✏️ Fr. Müller (Editor)           [Entfernen] [Rolle ändern]    │
│  👀 Hr. Schmidt (Betrachter)      [Entfernen] [Rolle ändern]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Berechtigungsstufen

| Rolle | Symbole | Kann |
|-------|---------|------|
| **Betrachter** | 👀 | Board ansehen, Kommentare lesen |
| **Editor** | ✏️ | + Karten erstellen/bearbeiten, Kommentieren |
| **Co-Owner** | 👑 | + Spalten ändern, Nutzer einladen |
| **Owner** | 🔒 | + Board löschen, Owner übertragen |

### Einladung per Nostr

Die Einladung wird als **Nostr-Event** versendet:
- Empfänger sieht das Board automatisch in seiner Liste
- Keine E-Mail oder separater Link nötig
- Verschlüsselt mit dem Public Key des Empfängers

---

## 📊 Geteilte Boards verwalten

### Ihre geteilten Boards

In der linken Sidebar sehen Sie:

```
📁 Meine Boards
├── 📋 Mathe Klasse 7 (👑 Owner)
├── 📋 Projektwoche (✏️ Editor)       ← Geteilt mit Ihnen
└── 📋 Fachschaft Bio (👀 Betrachter) ← Nur Lesen

📁 Mit mir geteilt (2)
├── 📋 Projektwoche
└── 📋 Fachschaft Bio
```

### Board verlassen

Wenn Sie kein Owner sind:
1. Rechtsklick auf das Board
2. Wählen Sie **Board verlassen**
3. Bestätigen Sie

---

## 🔐 Sicherheit & Datenschutz

### Was wird geteilt?

| Geteilt | Nicht geteilt |
|---------|---------------|
| Board-Inhalt | Ihre anderen Boards |
| Spalten & Karten | Ihre persönlichen Einstellungen |
| Kommentare | Ihre Login-Daten |
| Labels & Links | Lokale Entwürfe |

### Verschlüsselung

- **Share-Links:** URL enthält Daten (base64 + komprimiert)
- **Kollaboration:** Nostr-Events mit Public Key Verschlüsselung
- **Lokal:** Daten im Browser (localStorage)

### Widerruf

Sie können jederzeit:
- Nutzer entfernen
- Berechtigungen ändern
- Board-Sharing deaktivieren

---

## 📧 Sharing-Szenarien

### Szenario 1: Material mit Kollegen teilen

**Situation:** Sie haben Unterrichtsmaterialien gesammelt und möchten diese mit der Fachschaft teilen.

**Vorgehen:**
1. Share-Link erstellen
2. Link per E-Mail an Fachschaft senden
3. Kollegen importieren als "Neues Board"
4. Jeder hat seine eigene Kopie zum Anpassen

### Szenario 2: Gemeinsam planen

**Situation:** Sie planen eine Projektwoche mit 3 Kollegen.

**Vorgehen:**
1. Board erstellen: "Projektwoche 2026"
2. Kollegen als "Editor" einladen
3. Alle arbeiten am selben Board
4. Änderungen werden synchronisiert

### Szenario 3: Schülern Material bereitstellen

**Situation:** Schüler sollen auf Lernmaterial zugreifen.

**Vorgehen:**
1. Board mit Materialien erstellen
2. Share-Link erstellen
3. Link auf Schulplattform/Moodle teilen
4. Schüler importieren als "Neues Board"

**Oder (nur Lesen):**
1. Board erstellen
2. Öffentlichen Link aktivieren (Betrachter-Modus)
3. Schüler können ansehen, aber nicht ändern

---

## ⚠️ Häufige Fragen

### Kann ich ein Board zurückziehen?

**Ja:**
- **Share-Links:** Der Link bleibt gültig, aber enthält nur den Stand zum Zeitpunkt der Erstellung
- **Kollaboration:** Entfernen Sie den Nutzer → kein Zugriff mehr

### Was passiert bei Änderungen?

| Sharing-Typ | Änderungen |
|-------------|------------|
| Share-Link | Empfänger hat Kopie, sieht keine Updates |
| Kollaboration | Änderungen werden synchronisiert |

### Kann ich sehen, wer mein Board geöffnet hat?

**Kollaboration:** Ja, aktive Nutzer werden angezeigt  
**Share-Link:** Nein, keine Tracking-Funktion

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Share-Link erstellen und teilen
- [x] Nutzer kollaborativ einladen
- [x] Berechtigungen verstehen (Betrachter/Editor/Owner)
- [x] Geteilte Boards verwalten
- [x] Sicherheit und Datenschutz beachten
- [x] Richtige Sharing-Methode wählen

---

## 💡 Tipps

### Richtige Methode wählen

| Situation | Empfohlene Methode |
|-----------|-------------------|
| Einmalig Material teilen | Share-Link |
| Gemeinsam arbeiten | Kollaboration |
| Backup/Archiv | Export (JSON) |
| Große Boards | Export (JSON) |

### Versionskontrolle

Vor großen Änderungen:
1. **Snapshot erstellen** (siehe Kapitel 11)
2. Änderungen durchführen
3. Bei Problemen: Snapshot wiederherstellen

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Echtzeit-Zusammenarbeit nutzen | [10 - Kollaboration](./10-KOLLABORATION.md) |
| Export und Backup | [11 - Export/Import](./11-EXPORT-IMPORT.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [10 - Kollaboration](./10-KOLLABORATION.md)
