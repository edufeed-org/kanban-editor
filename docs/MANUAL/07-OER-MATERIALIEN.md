# 07 - OER-Materialien: Offene Bildungsressourcen finden

**Ziel:** Nach diesem Kapitel können Sie OER-Materialien über die KI suchen und direkt als Karten ins Board einfügen.

---

## 📚 Was sind OER?

**OER (Open Educational Resources)** sind frei zugängliche Bildungsmaterialien:

- ✅ **Kostenlos** nutzbar
- ✅ **Rechtssicher** (offene Lizenzen wie CC BY)
- ✅ **Anpassbar** (dürfen verändert werden)
- ✅ **Teilbar** (dürfen weitergegeben werden)

---

## 🔍 OER-Quellen im Kanban-Board

Das Board durchsucht automatisch mehrere OER-Repositorien:

### Angeschlossene Quellen

| Quelle | Beschreibung | Stärken |
|--------|--------------|---------|
| **WirLernenOnline (WLO)** | Nationale Bildungsplattform | Breites Angebot, geprüfte Qualität |
| **Serlo** | Freie Lernplattform | Mathe, Bio, Chemie, Informatik |
| **OER-Hörnchen** | OER-Suchmaschine | Viele Quellen, Filter |
| **Mundo** | Schulischer Content | Nach Bundesländern |
| **Tutory** | Arbeitsblätter | Editierbar, Vorlagen |

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔍 OER-Suche                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  📖 WirLernenOnline    📐 Serlo    🦔 OER-Hörnchen       │ │
│  │         ↓                 ↓              ↓                │ │
│  │                    [Aggregiert]                           │ │
│  │                         ↓                                 │ │
│  │              Relevante Ergebnisse                         │ │
│  │                         ↓                                 │ │
│  │              📋 Als Karten ins Board                      │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 OER-Suche per KI

### Einfache Suche

**Prompt:**
> Suche OER-Materialien zum Thema "Bruchrechnung"

**KI-Antwort:**
```
🔍 Suche läuft bei WLO, Serlo, OER-Hörnchen...

📚 5 Materialien gefunden:

1. 📹 "Brüche verstehen" (Video, 8 min)
   Quelle: Serlo | Lizenz: CC BY-SA 4.0
   ⭐⭐⭐⭐☆ (4.2)

2. 📄 "Arbeitsblatt Bruchrechnung Basics"
   Quelle: WLO | Lizenz: CC BY 4.0
   ⭐⭐⭐⭐⭐ (4.8)

3. 🎮 "Interaktives Bruch-Quiz"
   Quelle: Serlo | Lizenz: CC BY-SA 4.0
   ⭐⭐⭐⭐☆ (4.0)

4. 📖 "Bruchrechnung kompakt" (PDF)
   Quelle: OER-Hörnchen | Lizenz: CC BY 4.0
   ⭐⭐⭐☆☆ (3.5)

5. 📝 "Übungsblatt: Brüche addieren"
   Quelle: Tutory | Lizenz: CC BY 4.0
   ⭐⭐⭐⭐☆ (4.1)

Soll ich alle als Karten hinzufügen? [Ja/Auswahl/Nein]
```

---

### Gefilterte Suche

**Prompt mit Filtern:**
> Suche OER-Videos zum Thema "Klimawandel" für Klasse 8, auf Deutsch, mit CC-Lizenz

**Filter-Optionen:**

| Filter | Beispiel |
|--------|----------|
| **Medientyp** | Video, PDF, interaktiv, Arbeitsblatt |
| **Klassenstufe** | Klasse 5-6, Klasse 7-8, Oberstufe |
| **Sprache** | Deutsch, Englisch |
| **Lizenz** | CC BY, CC BY-SA, CC0 |
| **Fach** | Mathematik, Deutsch, Biologie, etc. |

---

### OER als Karten hinzufügen

**Prompt:**
> Füge die ersten 3 Ergebnisse als Karten in "Materialien" hinzu

**KI-Antwort:**
```
✅ 3 Karten erstellt in Spalte "Materialien":

📋 Karte 1: "Brüche verstehen (Video)"
   - Beschreibung: Serlo-Video zur Einführung
   - Link: https://serlo.org/...
   - Bild: [Vorschau]
   - Labels: Video, Mathe, OER, CC-BY-SA

📋 Karte 2: "Arbeitsblatt Bruchrechnung Basics"
   - Beschreibung: Übungsblatt für Einstieg
   - Link: https://wlo.de/...
   - Labels: Arbeitsblatt, Mathe, OER, CC-BY

📋 Karte 3: "Interaktives Bruch-Quiz"
   - Beschreibung: H5P-Quiz zur Selbstkontrolle
   - Link: https://serlo.org/...
   - Labels: Quiz, Mathe, OER, interaktiv
```

---

## 📖 Praktische Szenarien

### Szenario 1: Unterrichtsstunde vorbereiten

**Schritt 1: Thema definieren**
> Ich bereite eine Stunde zu "Wasserkreislauf" für Klasse 6 Erdkunde vor.

**Schritt 2: Materialien suchen**
> Suche OER-Materialien: Videos für Einstieg, Arbeitsblätter für Erarbeitung

**Schritt 3: Auswählen und einfügen**
> Füge das erste Video und das zweite Arbeitsblatt als Karten hinzu.

---

### Szenario 2: Materialsammlung aufbauen

**Prompt:**
> Erstelle eine Materialsammlung zum Thema "Fake News und Medienkompetenz" für die 9. Klasse.
> Suche verschiedene OER-Typen: Videos, Arbeitsblätter, interaktive Übungen.
> Ordne sie nach Schwierigkeit.

**Ergebnis:**
```
📦 Materialsammlung "Fake News & Medienkompetenz" erstellt

📗 Einstieg (leicht):
├── 📹 "Was sind Fake News?" (5 min Video)
├── 📄 "Checkliste: Fake News erkennen"
└── 🎮 "Quiz: Echt oder Fake?"

📘 Vertiefung (mittel):
├── 📹 "Filterblasen verstehen" (12 min)
├── 📄 "Arbeitsblatt: Quellen prüfen"
└── 🔗 "Mimikama Faktencheck-Tool"

📕 Projekt (anspruchsvoll):
├── 📄 "Projektanleitung: Fake News Workshop"
└── 🎮 "Simulation: Social Media Algorithmus"
```

---

### Szenario 3: Lücken füllen

**Prompt:**
> In meiner Spalte "Mathematik Klasse 7" fehlen noch Materialien zu Prozentrechnung. 
> Suche passende OER und füge sie hinzu.

---

## 🏷️ OER-Metadaten verstehen

Jede OER-Karte enthält wichtige Infos:

### Lizenz-Information

| Lizenz | Bedeutung | Was darf ich? |
|--------|-----------|---------------|
| **CC0** | Gemeinfrei | Alles |
| **CC BY** | Namensnennung | Nutzen, ändern, teilen |
| **CC BY-SA** | Namensnennung + Gleiche Bedingungen | Nutzen, ändern, teilen (gleiche Lizenz) |
| **CC BY-NC** | Nicht-kommerziell | Nur für Unterricht (nicht verkaufen) |

### Qualitätsbewertung

- ⭐⭐⭐⭐⭐ (5.0): Hervorragend, geprüft
- ⭐⭐⭐⭐☆ (4.0): Sehr gut, empfohlen
- ⭐⭐⭐☆☆ (3.0): Gut, nutzbar
- ⭐⭐☆☆☆ (2.0): Überarbeitungsbedarf
- ⭐☆☆☆☆ (1.0): Qualitätsmängel

---

## 🔧 OER-Einstellungen

### Bevorzugte Quellen festlegen

In **⚙️ Einstellungen → OER-Quellen**:

```
☑️ WirLernenOnline (WLO)
☑️ Serlo
☑️ OER-Hörnchen  
☐ Mundo (deaktiviert)
☑️ Tutory
```

### Standard-Filter setzen

- Standard-Sprache: Deutsch
- Standard-Lizenz: Alle CC-Lizenzen
- Nur mit Vorschaubild: ☑️

---

## 📋 OER-Karten erkennen

OER-Karten haben besondere Merkmale:

```
┌────────────────────────────────────┐
│  📚 Bruchrechnung (Video)          │ ← OER-Icon
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ 🖼️ Vorschaubild vom Video    │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  Serlo-Video zur Einführung in...  │
├────────────────────────────────────┤
│  🏷️ OER  🏷️ CC-BY  🏷️ Video       │ ← OER-Label!
├────────────────────────────────────┤
│  🔗 serlo.org    ⭐ 4.2            │ ← Quelle + Bewertung
└────────────────────────────────────┘
```

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Was OER sind und warum sie nützlich sind
- [x] Welche OER-Quellen angeschlossen sind
- [x] OER per KI suchen
- [x] Filter für präzise Suche nutzen
- [x] OER als Karten ins Board einfügen
- [x] Lizenzen verstehen
- [x] Qualitätsbewertungen interpretieren

---

## 💡 Tipps für OER

### Eigene Favoriten speichern

Erstellen Sie eine "Favoriten"-Spalte für besonders gute OER:
1. Gute OER finden → Karte erstellen
2. Label „Favorit" hinzufügen
3. In „Favoriten"-Spalte verschieben

### Lizenzen beachten

Bei CC BY(-SA) immer angeben:
- Titel des Materials
- Autor/Quelle
- Lizenz (z.B. „CC BY 4.0")
- Link zum Original

### Materialien kombinieren

OER dürfen oft kombiniert werden:
> „Erstelle eine Karte, die Video X und Arbeitsblatt Y als Unterrichtspaket zusammenfasst"

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| URLs und Links importieren | [08 - URL-Import](./08-URL-IMPORT.md) |
| Boards mit Kollegen teilen | [09 - Boards teilen](./09-BOARDS-TEILEN.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [08 - URL-Import](./08-URL-IMPORT.md)
