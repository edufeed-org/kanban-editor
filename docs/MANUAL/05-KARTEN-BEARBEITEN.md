# 05 - Karten bearbeiten: Alle Details im Griff

**Ziel:** Nach diesem Kapitel können Sie Karten mit Beschreibungen, Labels, Links, Bildern und Kommentaren versehen.

---

## 🔍 Karte öffnen

Klicken Sie auf eine Karte, um die **Detailansicht** zu öffnen:

```
┌─────────────────────────────────────────────────────────────────┐
│  ✖️  Karte bearbeiten                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 Titel                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Einführung Photosynthese                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📄 Beschreibung                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Die Schüler lernen die Grundlagen der Photosynthese    │   │
│  │ kennen und können den Prozess in eigenen Worten        │   │
│  │ erklären.                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🏷️ Labels        🖼️ Bild          🔗 Links                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [Biologie] [Klasse 7] [+]     [Bild hinzufügen]   [+Link] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  💬 Kommentare (3)                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👤 Fr. Müller: Hat jemand gute Arbeitsblätter?         │   │
│  │ 👤 Hr. Schmidt: Hier ein Link: ...                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────┐  ┌───────────┐  ┌─────────────────┐            │
│  │ 💾 Speichern│  │ ❌ Abbrechen│  │ 🗑️ Karte löschen │            │
│  └────────────┘  └───────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Titel bearbeiten

Der Titel ist das wichtigste Erkennungsmerkmal:

### Gute Titel sind...

| ✅ Gut | ❌ Vermeiden |
|--------|--------------|
| „Einführung Photosynthese Kl.7" | „Biologie" |
| „Arbeitsblatt Wasserkreislauf" | „Material 1" |
| „Video: Zellteilung (5 min)" | „Link" |

### Titel bearbeiten

1. Klicken Sie ins Titelfeld
2. Ändern Sie den Text
3. Änderungen werden automatisch gespeichert

---

## 📄 Beschreibung

Die Beschreibung bietet Platz für Details:

### Was gehört in die Beschreibung?

- **Lernziele:** Was sollen Schüler lernen?
- **Zeitbedarf:** Ca. 45 Minuten
- **Methode:** Gruppenarbeit, Einzelarbeit, etc.
- **Voraussetzungen:** Was müssen Schüler bereits können?
- **Hinweise:** Tipps für die Durchführung

### Beispiel

```markdown
## Lernziele
- Die Schüler können den Prozess der Photosynthese erklären
- Die Schüler benennen die beteiligten Stoffe (CO2, H2O, O2, Glucose)

## Zeitbedarf
45 Minuten (1 Unterrichtsstunde)

## Ablauf
1. Einstieg: Brainstorming (5 min)
2. Erarbeitung: Video + Arbeitsblatt (25 min)
3. Sicherung: Quiz (10 min)
4. Puffer (5 min)

## Materialien
- Video "Photosynthese einfach erklärt"
- Arbeitsblatt mit Lückentext
```

### Markdown-Formatierung

Die Beschreibung unterstützt **Markdown**:

| Formatierung | Eingabe | Ergebnis |
|--------------|---------|----------|
| Fett | `**fett**` | **fett** |
| Kursiv | `*kursiv*` | *kursiv* |
| Überschrift | `## Titel` | Größerer Text |
| Liste | `- Punkt 1` | • Punkt 1 |
| Link | `[Text](URL)` | Klickbarer Link |
| Code | `` `Code` `` | Monospace |

---

## 🏷️ Labels (Tags)

Labels helfen beim Filtern und Kategorisieren:

### Labels hinzufügen

1. Klicken Sie auf **[+ Label]**
2. Tippen Sie einen Begriff: `Mathematik`
3. Drücken Sie **Enter**
4. Das Label erscheint als farbiger Chip

### Typische Label-Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| **Fach** | Mathematik, Deutsch, Biologie |
| **Klassenstufe** | Kl.5, Kl.7, Oberstufe |
| **Materialtyp** | Video, Arbeitsblatt, Quiz |
| **Status** | Entwurf, Fertig, Überarbeiten |
| **Schwierigkeit** | Einfach, Mittel, Schwer |
| **Quelle** | OER, Eigenes, Schulbuch |

### Labels entfernen

Klicken Sie auf das **×** am Label:

```
[Biologie ×] [Klasse 7 ×] [Video ×]
     ↑
  Klick → Label wird entfernt
```

### Label-Farben

Labels bekommen automatisch Farben basierend auf dem Text. Gleiche Labels haben immer die gleiche Farbe für Konsistenz.

---

## 🖼️ Bilder hinzufügen

Bilder machen Karten visuell ansprechend:

### Bild per URL

1. Klicken Sie auf **[🖼️ Bild hinzufügen]**
2. Fügen Sie eine Bild-URL ein:
   ```
   https://upload.wikimedia.org/wikipedia/commons/thumb/.../Photosynthesis.png
   ```
3. Klicken Sie **Hinzufügen**

### Bildvorschau

Das Bild erscheint:
- Als **Vorschau** auf der Karte im Board
- In **voller Größe** in der Detailansicht

```
┌────────────────────────────────┐
│  Einführung Photosynthese      │
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │      🖼️ Vorschau         │  │  ← Bild wird angezeigt
│  │     (beschnitten)        │  │
│  └──────────────────────────┘  │
│  Die Schüler lernen die...     │
└────────────────────────────────┘
```

### Unterstützte Formate

- PNG, JPG, GIF, WebP
- URLs von: Wikimedia Commons, Pixabay, Unsplash, etc.

**💡 Tipp:** Nutzen Sie OER-Bildquellen wie Wikimedia Commons für lizenzfreie Bilder!

---

## 🔗 Links hinzufügen

Links verbinden Ihre Karte mit externen Ressourcen:

### Link hinzufügen

1. Klicken Sie auf **[+ Link hinzufügen]**
2. Geben Sie ein:
   - **Titel:** „Video zur Photosynthese"
   - **URL:** `https://www.youtube.com/watch?v=...`
3. Klicken Sie **Hinzufügen**

### Link-Darstellung

```
🔗 Links (2)
├── 📺 Video zur Photosynthese
│   └── youtube.com/watch?v=...
└── 📄 Arbeitsblatt PDF
    └── schulserver.de/docs/ab-photo.pdf
```

### Automatische Link-Erkennung

URLs werden automatisch erkannt:
- YouTube-Links zeigen 📺 Symbol
- PDF-Links zeigen 📄 Symbol
- Bilder zeigen 🖼️ Symbol

---

## 💬 Kommentare

Kommentare ermöglichen Diskussion und Notizen:

### Kommentar hinzufügen

1. Scrollen Sie zum Kommentarbereich
2. Tippen Sie Ihren Kommentar
3. Klicken Sie **[💬 Senden]**

### Kommentar-Beispiele

```
💬 Kommentare (3)
─────────────────────────────────────────
👤 Fr. Müller (vor 2 Stunden):
Hat jemand Erfahrungen mit diesem Material in der 7b?

👤 Hr. Schmidt (vor 1 Stunde):
Ich habe es letzte Woche eingesetzt. Funktioniert gut,
aber braucht eher 60 statt 45 Minuten.

👤 Fr. Müller (vor 30 Min):
Danke für den Hinweis! Plane ich als Doppelstunde.
─────────────────────────────────────────
[Kommentar eingeben...           ] [Senden]
```

### Kommentar löschen

Sie können nur **eigene** Kommentare löschen:
1. Hover über Ihren Kommentar
2. Klicken Sie auf **🗑️**

---

## 📊 Karten-Status

### PublishState (Veröffentlichungsstatus)

Jede Karte hat einen Status:

| Status | Symbol | Bedeutung |
|--------|--------|-----------|
| Entwurf | 📝 | Nur für Sie sichtbar |
| Veröffentlicht | ✅ | Für alle sichtbar |
| Archiviert | 📦 | Versteckt, aber nicht gelöscht |

### Status ändern

1. Öffnen Sie die Karte
2. Klicken Sie auf den Status-Chip
3. Wählen Sie den neuen Status

```
Status: [📝 Entwurf ▼]
         ├── 📝 Entwurf
         ├── ✅ Veröffentlicht  ← Auswählen
         └── 📦 Archiviert
```

---

## 🎨 Karten-Farben

Farben helfen bei der visuellen Organisation:

### Farbe ändern

1. Klicken Sie auf **⚙️** an der Karte
2. Wählen Sie **Farbe ändern**
3. Wählen Sie aus der Palette

### Farbcodierung (Beispiel)

| Farbe | Bedeutung |
|-------|-----------|
| 🟢 Grün | Fertig / Geprüft |
| 🟡 Gelb | In Bearbeitung |
| 🔴 Rot | Dringend / Priorität |
| 🔵 Blau | Information |
| ⬜ Weiß | Standard |

---

## ⚡ Schnellbearbeitung

### Inline-Bearbeitung

Einige Felder können Sie **direkt auf der Karte** bearbeiten:

1. Doppelklick auf den Titel → Titel bearbeiten
2. Labels erscheinen beim Hover → Klick zum Hinzufügen

### Tastenkürzel im Dialog

| Taste | Aktion |
|-------|--------|
| `Strg + S` | Speichern |
| `Esc` | Dialog schließen |
| `Tab` | Zum nächsten Feld |
| `Strg + Enter` | Kommentar absenden |

---

## 📋 Karten duplizieren

### Karte kopieren

1. Öffnen Sie die Karte
2. Klicken Sie auf **⋮ → Duplizieren**
3. Eine Kopie erscheint mit „(Kopie)" im Titel

### Was wird kopiert?

| ✅ Kopiert | ❌ Nicht kopiert |
|------------|------------------|
| Titel | Kommentare |
| Beschreibung | Erstellungsdatum |
| Labels | Autor |
| Links | |
| Bild | |

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Kartentitel bearbeiten
- [x] Beschreibungen mit Markdown formatieren
- [x] Labels zur Kategorisierung nutzen
- [x] Bilder und Links hinzufügen
- [x] Kommentare schreiben und verwalten
- [x] Karten-Status verstehen
- [x] Karten duplizieren

---

## 💡 Tipps für Fortgeschrittene

### Vorlagen erstellen

Erstellen Sie eine „Vorlagen"-Spalte mit Standard-Karten:
1. Erstellen Sie eine Karte mit typischer Struktur
2. Füllen Sie Beschreibung als Vorlage aus
3. Duplizieren Sie diese Karte bei Bedarf

### Konsistente Labels

Einigen Sie sich im Team auf Labels:
- Feste Fachbezeichnungen
- Einheitliche Klassenstufen-Notation
- Standardisierte Material-Typen

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| KI für Inhalte nutzen | [06 - KI-Assistent](./06-KI-ASSISTENT.md) |
| OER-Materialien finden | [07 - OER-Materialien](./07-OER-MATERIALIEN.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [06 - KI-Assistent](./06-KI-ASSISTENT.md)
