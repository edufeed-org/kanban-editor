# 11 - Export/Import: Backup, Archivierung und Datenaustausch

**Ziel:** Nach diesem Kapitel können Sie Boards exportieren, importieren, Backups erstellen und Versionen verwalten.

---

## 📤 Export-Optionen

### Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    Export-Optionen                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📄 Einzelnes Board          📦 Alle Boards (Backup)            │
│     als JSON exportieren        vollständiges Backup            │
│                                                                 │
│  🔗 Share-Link               📸 Snapshot                        │
│     URL zum Teilen              Versionspunkt speichern         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 Einzelnes Board exportieren

### So funktioniert's

1. Öffnen Sie das Board
2. Klicken Sie auf **⚙️ Einstellungen** in der Topbar
3. Wählen Sie **📤 Board exportieren**
4. Datei wird heruntergeladen

```
┌─────────────────────────────────────────────────────────────────┐
│  📤 Board exportieren                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Mathe Klasse 7                                              │
│                                                                 │
│  Inhalt:                                                        │
│  ├── 4 Spalten                                                  │
│  ├── 23 Karten                                                  │
│  ├── 8 Kommentare                                               │
│  └── 15 Links                                                   │
│                                                                 │
│  Exportformat: JSON (strukturiert)                              │
│  Geschätzte Größe: ~45 KB                                       │
│                                                                 │
│  ☑️ Metadaten einschließen (Erstelldatum, Autor, Version)       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │               📥 Herunterladen                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Dateiname: Mathe-Klasse-7_2026-01-30.json                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Export-Datei Struktur

Die JSON-Datei enthält:

```json
{
  "version": "1.0",
  "exportedAt": "2026-01-30T14:30:00Z",
  "exportedBy": "npub1...",
  "board": {
    "id": "abc123",
    "name": "Mathe Klasse 7",
    "description": "Unterrichtsmaterialien Algebra",
    "columns": [
      {
        "id": "col1",
        "name": "Ideen",
        "cards": [
          {
            "id": "card1",
            "heading": "Gleichungen einführen",
            "content": "Grundlagen mit Waage-Modell...",
            "labels": ["Woche 1", "Einführung"],
            "links": [{"url": "https://...", "title": "Video"}],
            "comments": [...]
          }
        ]
      }
    ]
  }
}
```

---

## 📦 Vollständiges Backup

### Alle Boards sichern

1. Gehen Sie zu **⚙️ Einstellungen** (globale Einstellungen)
2. Wählen Sie **📦 Vollständiges Backup**
3. Alle Ihre Boards werden in einer Datei exportiert

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Vollständiges Backup                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ihre Boards:                                                   │
│  ├── 📋 Mathe Klasse 7 (23 Karten)                             │
│  ├── 📋 Projektwoche 2026 (45 Karten)                          │
│  ├── 📋 Fachschaft Bio (12 Karten)                             │
│  └── 📋 Ideen-Sammlung (8 Karten)                              │
│                                                                 │
│  Gesamt: 4 Boards, 88 Karten                                    │
│  Geschätzte Größe: ~180 KB                                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │             📥 Backup herunterladen                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  💡 Empfehlung: Wöchentliches Backup anlegen                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Backup-Strategie

| Häufigkeit | Empfehlung |
|------------|------------|
| **Täglich** | Bei intensiver Nutzung |
| **Wöchentlich** | Standard-Empfehlung |
| **Monatlich** | Minimum |

**💡 Tipp:** Speichern Sie Backups an verschiedenen Orten:
- Lokaler Ordner
- Cloud-Speicher (Google Drive, OneDrive)
- USB-Stick

---

## 📥 Import-Optionen

### Board importieren

1. Klicken Sie auf **➕ Neues Board** in der Sidebar
2. Wählen Sie **📥 Importieren**
3. Wählen Sie die JSON-Datei aus
4. Wählen Sie den Import-Modus

```
┌─────────────────────────────────────────────────────────────────┐
│  📥 Board importieren                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Datei: Mathe-Klasse-7_2026-01-30.json                          │
│                                                                 │
│  Erkannt:                                                       │
│  ├── Board: "Mathe Klasse 7"                                   │
│  ├── 4 Spalten, 23 Karten                                       │
│  └── Exportiert am: 30.01.2026                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Import-Modus:                                                  │
│                                                                 │
│  ○ Als neues Board                                              │
│    Erstellt "Mathe Klasse 7 (Importiert)"                       │
│    Keine Konflikte möglich                                      │
│                                                                 │
│  ○ Mit bestehendem Board zusammenführen (Merge)                 │
│    Neue Karten hinzufügen, bestehende behalten                  │
│    Bei Duplikaten: Neuere Version übernehmen                    │
│                                                                 │
│  ○ Bestehendes Board überschreiben                              │
│    ⚠️ WARNUNG: Alle aktuellen Daten werden ersetzt!             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  📥 Importieren                         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Import-Modi erklärt

| Modus | Verwendung | Ergebnis |
|-------|------------|----------|
| **Als neues Board** | Kopie erstellen | Neues unabhängiges Board |
| **Merge** | Änderungen zusammenführen | Kombiniertes Board |
| **Überschreiben** | Zurücksetzen auf Export-Stand | Board wird ersetzt |

### Backup wiederherstellen

1. Gehen Sie zu **⚙️ Einstellungen**
2. Wählen Sie **🔄 Backup wiederherstellen**
3. Wählen Sie die Backup-Datei
4. Bestätigen Sie die Wiederherstellung

**⚠️ Warnung:** Bei vollständiger Wiederherstellung werden alle aktuellen Boards ersetzt!

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Backup wiederherstellen                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Sie sind dabei, alle Ihre Boards durch das Backup zu ersetzen. │
│                                                                 │
│  Aktuell: 4 Boards, 88 Karten                                   │
│  Backup:  3 Boards, 72 Karten                                   │
│                                                                 │
│  Folgende Boards werden GELÖSCHT:                               │
│  • Ideen-Sammlung (nicht im Backup)                             │
│                                                                 │
│  ☑️ Ich habe verstanden, dass aktuelle Daten verloren gehen     │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ 🔄 Wiederherstellen│  │ ❌ Abbrechen       │                  │
│  └───────────────────┘  └───────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📸 Snapshots (Versionspunkte)

### Was ist ein Snapshot?

Ein Snapshot ist ein **Momentaufnahme** des Boards zu einem bestimmten Zeitpunkt. Wie ein Speicherpunkt in einem Videospiel.

### Snapshot erstellen

1. Öffnen Sie das Board
2. Klicken Sie auf **📸 Snapshot erstellen**
3. Geben Sie einen Namen ein (z.B. "Vor Umstrukturierung")
4. Der Snapshot wird gespeichert

```
┌─────────────────────────────────────────────────────────────────┐
│  📸 Snapshot erstellen                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Board: Mathe Klasse 7                                          │
│                                                                 │
│  Name des Snapshots:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Vor Umstrukturierung                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Kommentar (optional):                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Bevor ich die Spalten neu organisiere                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                📸 Snapshot speichern                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Snapshot-Verlauf

Alle Snapshots eines Boards anzeigen:

```
┌─────────────────────────────────────────────────────────────────┐
│  📸 Snapshot-Verlauf: Mathe Klasse 7                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📸 Vor Umstrukturierung                                        │
│     30.01.2026, 14:30 • 4 Spalten, 23 Karten                    │
│     [Wiederherstellen] [Löschen] [Exportieren]                  │
│                                                                 │
│  📸 Nach Halbjahres-Review                                      │
│     15.01.2026, 16:00 • 4 Spalten, 20 Karten                    │
│     [Wiederherstellen] [Löschen] [Exportieren]                  │
│                                                                 │
│  📸 Schuljahresbeginn                                           │
│     01.09.2025, 10:00 • 3 Spalten, 12 Karten                    │
│     [Wiederherstellen] [Löschen] [Exportieren]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Snapshot wiederherstellen

**⚠️ Achtung:** Das aktuelle Board wird auf den Snapshot-Stand zurückgesetzt!

1. Wählen Sie **[Wiederherstellen]** beim gewünschten Snapshot
2. Bestätigen Sie die Warnung
3. Das Board wird zurückgesetzt

**💡 Tipp:** Erstellen Sie vor der Wiederherstellung einen Snapshot des aktuellen Stands!

---

## 🔄 Anwendungsszenarien

### Szenario 1: Regelmäßiges Backup

**Situation:** Sie möchten Ihre Arbeit regelmäßig sichern.

**Vorgehen:**
```
Jeden Freitag:
1. Öffnen Sie Einstellungen
2. Klicken Sie "Vollständiges Backup"
3. Speichern Sie die Datei mit Datum: backup_2026-01-30.json
4. Optional: In Cloud hochladen
```

### Szenario 2: Board vor großen Änderungen sichern

**Situation:** Sie wollen die Spaltenstruktur komplett ändern.

**Vorgehen:**
```
Vor der Änderung:
1. Snapshot erstellen: "Alte Struktur"
2. Änderungen durchführen
3. Falls nicht zufrieden: Snapshot wiederherstellen
```

### Szenario 3: Board auf neues Gerät übertragen

**Situation:** Sie haben einen neuen Laptop und möchten Ihre Boards mitnehmen.

**Vorgehen:**
```
Altes Gerät:
1. Vollständiges Backup erstellen
2. Datei auf USB-Stick oder Cloud speichern

Neues Gerät:
1. Kanban-Editor öffnen
2. "Backup wiederherstellen" wählen
3. Backup-Datei auswählen
4. Alle Boards sind wieder da!
```

### Szenario 4: Board mit Kollegen teilen (ohne Echtzeit-Sync)

**Situation:** Sie möchten eine Kopie Ihres Boards an jemanden senden, der offline arbeitet.

**Vorgehen:**
```
Sie:
1. Board exportieren (JSON)
2. Datei per E-Mail senden

Kollege:
1. Datei speichern
2. "Als neues Board importieren"
3. Hat eigene Kopie zum Bearbeiten
```

---

## 📊 Export-Formate

### JSON (Standard)

| Eigenschaft | Wert |
|-------------|------|
| **Format** | Strukturiertes JSON |
| **Verwendung** | Import/Export zwischen Geräten |
| **Kompatibilität** | Nur Kanban-Editor |
| **Enthält** | Alle Daten, Struktur, Metadaten |

### Zukünftige Formate (geplant)

| Format | Status | Verwendung |
|--------|--------|------------|
| **CSV** | Geplant | Export nach Excel |
| **PDF** | Geplant | Druckbare Übersicht |
| **Markdown** | Geplant | Dokumentation |

---

## ⚠️ Häufige Probleme

### Problem: Import schlägt fehl

**Mögliche Ursachen:**
1. Ungültige JSON-Datei (beschädigt)
2. Falsche Version (zu alt)
3. Unvollständige Datei

**Lösung:**
```
1. Datei in Texteditor öffnen
2. Prüfen: Beginnt mit { und endet mit }?
3. Prüfen: "version" vorhanden?
4. Falls beschädigt: Anderes Backup verwenden
```

### Problem: Backup ist zu groß

**Ursachen:**
- Viele große Bilder (als Base64)
- Sehr viele Boards

**Lösung:**
1. Bilder als Links speichern (nicht eingebettet)
2. Alte/ungenutzte Boards archivieren
3. Einzelne Boards statt vollständiges Backup exportieren

### Problem: Nach Import fehlen Daten

**Mögliche Ursachen:**
1. Export war unvollständig
2. Falscher Import-Modus gewählt

**Prävention:**
1. Nach Export: Datei kurz prüfen (Größe plausibel?)
2. Vor wichtigen Änderungen: Snapshot erstellen
3. Mehrere Backup-Generationen aufbewahren

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Einzelnes Board als JSON exportieren
- [x] Vollständiges Backup aller Boards erstellen
- [x] Board importieren (3 Modi: Neu, Merge, Überschreiben)
- [x] Backup wiederherstellen
- [x] Snapshots erstellen und verwalten
- [x] Snapshot wiederherstellen
- [x] Backup-Strategie entwickeln

---

## 💡 Best Practices

### Backup-Routine

```
📅 Wöchentlich (Freitag):
   └── Vollständiges Backup erstellen
       └── Dateiname: backup_JJJJ-MM-TT.json

📸 Vor großen Änderungen:
   └── Snapshot des betroffenen Boards

🗄️ Aufbewahrung:
   ├── Letzte 4 Wochen: Alle Backups
   └── Danach: Monatlich ein Backup
```

### Datei-Benennung

```
Backups:
├── backup_2026-01-30.json
├── backup_2026-01-23.json
└── backup_2026-01-16.json

Einzelexporte:
├── Mathe-Klasse-7_2026-01-30.json
└── Projektwoche_2026-01-15.json
```

### Speicherorte diversifizieren

```
Backup speichern:
├── 💻 Lokal: Dokumente/Kanban-Backups/
├── ☁️ Cloud: Google Drive oder OneDrive
└── 💾 Extern: USB-Stick (monatlich)
```

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Einstellungen anpassen | [12 - Einstellungen](./12-EINSTELLUNGEN.md) |
| Zurück zur Übersicht | [README](./README.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [12 - Einstellungen](./12-EINSTELLUNGEN.md)
