# 06 - KI-Assistent: Ihr intelligenter Helfer

**Ziel:** Nach diesem Kapitel können Sie den KI-Assistenten effektiv für Unterrichtsplanung und Board-Organisation einsetzen.

---

## 🤖 Was kann die KI?

Der KI-Assistent ist Ihr intelligenter Helfer direkt im Kanban-Board:

```
┌─────────────────────────────────────────────────────────────────┐
│                          KI-Panel                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💬 Chat-Verlauf                                                │
│  ───────────────────────────────────────────────────────        │
│  🤖 KI: Hallo! Ich bin Ihr Assistent für das Kanban-Board.      │
│      Wie kann ich Ihnen bei der Unterrichtsplanung helfen?      │
│                                                                 │
│  👤 Sie: Erstelle mir ein Board für eine Projektwoche zum       │
│      Thema Klimaschutz für die 8. Klasse.                       │
│                                                                 │
│  🤖 KI: Gerne! Ich erstelle folgende Struktur:                  │
│      ✅ Spalte "Recherche" mit 3 Karten                         │
│      ✅ Spalte "Gruppenarbeit" mit 4 Karten                     │
│      ✅ Spalte "Präsentation" mit 2 Karten                      │
│      Das Board ist fertig!                                      │
│                                                                 │
│  ───────────────────────────────────────────────────────        │
│  [Ihre Nachricht eingeben...                        ] [Senden]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Verfügbare KI-Tools

Die KI hat **12 spezialisierte Werkzeuge**:

### Board-Verwaltung

| Tool | Was es tut | Beispiel-Prompt |
|------|------------|-----------------|
| **populate_board** | Befüllt komplettes Board | „Erstelle ein Board für Mathematik Klasse 9" |
| **update_board** | Ändert Board-Name/Tags | „Füge dem Board den Tag 'Projektwoche' hinzu" |

### Spalten-Verwaltung

| Tool | Was es tut | Beispiel-Prompt |
|------|------------|-----------------|
| **add_column** | Neue Spalte erstellen | „Füge eine Spalte 'Review' hinzu" |
| **update_column** | Spalte umbenennen | „Benenne 'TODO' in 'Backlog' um" |
| **delete_column** | Spalte löschen | „Lösche die Spalte 'Archiv'" |

### Karten-Verwaltung

| Tool | Was es tut | Beispiel-Prompt |
|------|------------|-----------------|
| **add_card** | Einzelne Karte erstellen | „Erstelle eine Karte zu Gleichungen" |
| **update_card** | Karte bearbeiten | „Füge der Karte 'Einführung' ein Bild hinzu" |
| **move_card** | Karte verschieben | „Verschiebe 'Hausaufgabe' nach 'Fertig'" |
| **delete_card** | Karte löschen | „Lösche die Karte 'Entwurf'" |
| **add_comment** | Kommentar hinzufügen | „Schreibe einen Kommentar: Gutes Material!" |

### Kommunikation

| Tool | Was es tut | Beispiel-Prompt |
|------|------------|-----------------|
| **respond** | Fragen beantworten | „Erkläre mir, wie Kanban funktioniert" |
| **ask_clarification** | Rückfragen stellen | (KI fragt, wenn Infos fehlen) |

---

## 💬 Effektive Prompts schreiben

### Gute Prompts sind konkret

| ❌ Zu vage | ✅ Konkret |
|-----------|-----------|
| „Mach was mit Bio" | „Erstelle 5 Karten zum Thema Zellteilung für Klasse 10" |
| „Hilf mir" | „Verschiebe alle Karten mit Label 'Fertig' in die Done-Spalte" |
| „Board erstellen" | „Erstelle ein Board für Deutsch-Lektüre 'Der Vorleser' mit Spalten für Kapitel 1-3" |

### Prompt-Vorlagen

#### 🏗️ Board komplett erstellen

```
Erstelle ein Board für [THEMA] in [FACH] für Klassenstufe [X].

Struktur:
- Spalte 1: [NAME] mit [ANZAHL] Karten
- Spalte 2: [NAME] mit [ANZAHL] Karten
- ...

Jede Karte soll einen Titel und eine kurze Beschreibung haben.
```

**Beispiel:**
> Erstelle ein Board für die Unterrichtseinheit "Fotosynthese" in Biologie für Klasse 7.
> 
> Struktur:
> - Spalte 1: "Einstieg" mit 2 Karten
> - Spalte 2: "Erarbeitung" mit 4 Karten
> - Spalte 3: "Sicherung" mit 2 Karten
>
> Jede Karte soll einen Titel und eine kurze Beschreibung haben.

---

#### 📝 Einzelne Karte erstellen

```
Erstelle eine Karte "[TITEL]" in der Spalte "[SPALTENNAME]".

Beschreibung: [BESCHREIBUNG]
Labels: [LABEL1], [LABEL2]
```

**Beispiel:**
> Erstelle eine Karte "Video: Zellteilung" in der Spalte "Materialien".
>
> Beschreibung: YouTube-Video (10 min) zur Einführung in die Mitose, geeignet als Einstieg.
> Labels: Video, Einstieg, OER

---

#### 🔄 Mehrere Karten auf einmal

```
Erstelle [ANZAHL] Karten in der Spalte "[SPALTE]" zum Thema [THEMA]:
1. [TITEL 1]
2. [TITEL 2]
...
```

**Beispiel:**
> Erstelle 5 Karten in der Spalte "Hausaufgaben" für die Woche:
> 1. Montag: Vokabeln lernen
> 2. Dienstag: Arbeitsblatt S. 42
> 3. Mittwoch: Text lesen
> 4. Donnerstag: Zusammenfassung schreiben
> 5. Freitag: Quiz vorbereiten

---

#### 📋 Struktur reorganisieren

```
Reorganisiere das Board:
- Verschiebe alle Karten mit Label "[LABEL]" in Spalte "[SPALTE]"
- Benenne Spalte "[ALT]" in "[NEU]" um
- Lösche leere Spalten
```

---

## 🎯 Praktische Szenarien

### Szenario 1: Neue Unterrichtsreihe planen

**Prompt:**
> Ich plane eine Unterrichtsreihe zum Thema "Industrielle Revolution" für Geschichte Klasse 8 (ca. 6 Doppelstunden).
>
> Erstelle ein Board mit:
> - Spalte "Vorbereitung" für Materialsammlung
> - Spalte "Stunde 1-6" für jede Doppelstunde
> - Spalte "Leistungsüberprüfung" für Test/Klausur

**KI-Antwort:**
> ✅ Board erstellt mit 8 Spalten:
> - Vorbereitung (3 Karten: Materialsuche, Lernziele, Zeitplan)
> - Stunde 1: Einführung (2 Karten)
> - Stunde 2: Technische Neuerungen (2 Karten)
> - ... usw.

---

### Szenario 2: OER-Materialien integrieren

**Prompt:**
> Suche passende OER-Materialien zum Thema "Bruchrechnung" und erstelle Karten dafür.

**KI-Antwort:**
> 🔍 Ich suche nach OER-Materialien bei:
> - Serlo
> - WirLernenOnline
> - OER-Hörnchen
>
> ✅ 4 Materialien gefunden und als Karten erstellt:
> - "Video: Brüche verstehen" (Serlo)
> - "Interaktives Quiz: Bruchrechnung" (WLO)
> - "Arbeitsblatt: Brüche addieren" (OER-Hörnchen)

*Mehr dazu in [Kapitel 07 - OER-Materialien](./07-OER-MATERIALIEN.md)*

---

### Szenario 3: Differenzierung planen

**Prompt:**
> Ich habe eine heterogene Klasse. Erstelle für das Thema "Lineare Funktionen" Karten mit drei Differenzierungsstufen: Basis, Standard, Erweiterung.

**KI-Antwort:**
> ✅ 9 Karten erstellt (je 3 pro Stufe):
>
> 📗 Basis:
> - Funktionswerte ablesen
> - Einfache Geraden zeichnen
> - Steigung erkennen
>
> 📘 Standard:
> - Geradengleichung aufstellen
> - Schnittpunkt berechnen
> - Anwendungsaufgaben
>
> 📕 Erweiterung:
> - Parametervariation
> - Funktionenscharen
> - Komplexe Modellierung

---

## ⚠️ Tipps & Best Practices

### ✅ Do's

| Tipp | Warum? |
|------|--------|
| **Konkret sein** | KI arbeitet besser mit klaren Anweisungen |
| **Kontext geben** | Fach, Klassenstufe, Thema nennen |
| **Schritt für Schritt** | Komplexe Aufgaben aufteilen |
| **Feedback geben** | „Das war gut" oder „Ändere X" hilft der KI |

### ❌ Don'ts

| Vermeiden | Besser |
|-----------|--------|
| Zu viele Aufgaben auf einmal | Aufteilen in kleinere Prompts |
| Unklare Referenzen ("diese Karte") | Kartentitel explizit nennen |
| Erwarten, dass KI alles weiß | Spezifische Infos mitgeben |

---

## 🔧 KI-Einstellungen anpassen

### Modell wählen

In den Einstellungen können Sie das KI-Modell ändern:

| Modell | Beschreibung |
|--------|--------------|
| **GPT-4** | Höchste Qualität, langsamer |
| **GPT-3.5-Turbo** | Schneller, günstiger |
| **Ollama (lokal)** | Datenschutz, keine Cloud |

### Eigenen API-Key verwenden

1. Öffnen Sie **⚙️ Einstellungen**
2. Gehen Sie zu **KI-Konfiguration**
3. Geben Sie Ihren API-Key ein
4. Wählen Sie den Endpoint

---

## 📊 Chat-Verlauf

### Verlauf nutzen

- Die KI **erinnert sich** an vorherige Nachrichten
- Sie können auf frühere Antworten Bezug nehmen
- Der Verlauf bleibt bis Sie ihn löschen

### Verlauf löschen

Klicken Sie auf **🗑️ Chat leeren** um neu zu starten.

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] KI-Panel öffnen und nutzen
- [x] Die 12 KI-Tools kennen
- [x] Effektive Prompts schreiben
- [x] Board mit KI erstellen
- [x] Karten mit KI verwalten
- [x] Praktische Szenarien anwenden
- [x] KI-Einstellungen anpassen

---

## 💡 Fortgeschrittene Tipps

### Multi-Step Workflows

Komplexe Aufgaben in Schritten:

1. „Erstelle Grundstruktur für..."
2. „Füge zu Spalte X folgende Karten hinzu..."
3. „Suche OER-Materialien für Karte Y..."
4. „Verschiebe fertige Karten nach..."

### KI als Brainstorming-Partner

> „Welche Themen sollte ich in einer Unterrichtsreihe zu 'Demokratie' für Klasse 9 behandeln?"

Die KI gibt Vorschläge, die Sie dann in Karten umwandeln können.

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| OER-Suche vertiefen | [07 - OER-Materialien](./07-OER-MATERIALIEN.md) |
| URLs importieren | [08 - URL-Import](./08-URL-IMPORT.md) |

---

**Zeit:** ⏱️ ~20 Minuten  
**Nächstes Kapitel:** [07 - OER-Materialien](./07-OER-MATERIALIEN.md)
