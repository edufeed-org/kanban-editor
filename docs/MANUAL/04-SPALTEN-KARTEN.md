# 04 - Spalten & Karten: Organisation Ihres Workflows

**Ziel:** Nach diesem Kapitel können Sie Spalten anlegen, Karten erstellen und per Drag & Drop organisieren.

---

## 📊 Spalten verstehen

Spalten repräsentieren Phasen oder Kategorien in Ihrem Workflow:

### Typische Spalten-Strukturen

**Für Unterrichtsplanung:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 💡 Ideen     │ │ 📝 Planung   │ │ 🔄 Umsetzung │ │ ✅ Fertig    │
│              │ │              │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Für Projektarbeit:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📋 Backlog   │ │ 🎯 Sprint    │ │ 👀 Review    │ │ 🚀 Done      │
│              │ │              │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Für Materialsammlung:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📚 Bücher    │ │ 🎬 Videos    │ │ 📄 Arbeitsbl.│ │ 🔗 Links     │
│              │ │              │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## ➕ Neue Spalte erstellen

### Methode 1: Button am rechten Rand

1. Scrollen Sie ganz nach rechts im Board
2. Klicken Sie auf **[+ Spalte hinzufügen]**
3. Geben Sie einen Namen ein: `Neue Spalte`
4. Drücken Sie **Enter**

### Methode 2: Per KI

Sagen Sie der KI:
> „Füge eine Spalte 'Review' nach 'In Bearbeitung' hinzu"

---

## ✏️ Spalte bearbeiten

### Spalte umbenennen

1. **Klicken** Sie auf den Spaltennamen
2. Bearbeiten Sie den Text
3. Drücken Sie **Enter** oder klicken Sie außerhalb

```
┌──────────────────┐
│  [In Arbeit___]  │  ← Name wird editierbar
│  ────────────────│
│                  │
└──────────────────┘
```

### Spaltenfarbe ändern

1. Klicken Sie auf das **⚙️** Symbol am Spaltenkopf
2. Wählen Sie eine Farbe aus der Palette
3. Die Farbe wird sofort angewendet

---

## ↔️ Spalten verschieben

### Per Drag & Drop

1. Greifen Sie den **Spaltenkopf** (oben)
2. Ziehen Sie die Spalte nach links oder rechts
3. Lassen Sie los an der gewünschten Position

```
        Vorher:                          Nachher:
┌────────┐ ┌────────┐ ┌────────┐    ┌────────┐ ┌────────┐ ┌────────┐
│ Ideen  │ │In Arbeit│ │ Fertig │ → │In Arbeit│ │ Ideen  │ │ Fertig │
└────────┘ └────────┘ └────────┘    └────────┘ └────────┘ └────────┘
             ← zieht ←
```

---

## 🗑️ Spalte löschen

**⚠️ Achtung:** Alle Karten in der Spalte werden mitgelöscht!

1. Klicken Sie auf **⚙️** am Spaltenkopf
2. Wählen Sie **🗑️ Spalte löschen**
3. Bestätigen Sie die Aktion

**💡 Tipp:** Verschieben Sie wichtige Karten vorher in eine andere Spalte!

---

## 🃏 Karten erstellen

### Schnelle Karte

1. Klicken Sie auf **[+ Karte]** in einer Spalte
2. Geben Sie einen Titel ein
3. Drücken Sie **Enter**

**Fertig!** Die Karte ist erstellt.

### Karte mit Details

1. Klicken Sie auf **[+ Karte]**
2. Geben Sie den Titel ein
3. Klicken Sie auf **[+ Details]** statt Enter
4. Fügen Sie Beschreibung, Labels etc. hinzu
5. Klicken Sie auf **Erstellen**

### Per KI (empfohlen!)

Sagen Sie der KI:
> „Erstelle eine Karte 'Einführung Photosynthese' in der Spalte 'Ideen' mit der Beschreibung 'Grundlagen für Klasse 7'"

Die KI erstellt die Karte direkt mit allen Details!

---

## ↕️ Karten verschieben

### Drag & Drop (Standard)

1. Klicken Sie auf eine Karte und **halten Sie gedrückt**
2. Ziehen Sie die Karte:
   - **Innerhalb der Spalte:** Reihenfolge ändern
   - **In andere Spalte:** Karte verschieben
3. Lassen Sie los

```
┌────────────────┐          ┌────────────────┐
│ Ideen          │          │ In Arbeit      │
│ ──────────────│          │ ──────────────│
│ ┌────────────┐│          │                │
│ │ Karte A    ││ ────────→│ ┌────────────┐│
│ └────────────┘│   Drag    │ │ Karte A    ││
│ ┌────────────┐│   Drop    │ └────────────┘│
│ │ Karte B    ││          │                │
│ └────────────┘│          │                │
└────────────────┘          └────────────────┘
```

### Per KI

> „Verschiebe 'Einführung Photosynthese' in die Spalte 'In Bearbeitung'"

---

## 📋 Karten-Vorschau

Auf jeder Karte sehen Sie wichtige Infos:

```
┌────────────────────────────────────┐
│  Einführung Photosynthese          │  ← Titel
├────────────────────────────────────┤
│  🖼️ [Vorschaubild]                 │  ← Bild (falls vorhanden)
├────────────────────────────────────┤
│  Die Schüler lernen die Grund...   │  ← Beschreibung (gekürzt)
├────────────────────────────────────┤
│  🏷️ Bio  🏷️ Kl.7  🏷️ Einführung   │  ← Labels
├────────────────────────────────────┤
│  💬 3    🔗 2    👤 Fr. Müller     │  ← Meta-Infos
└────────────────────────────────────┘
```

### Meta-Info erklärt

| Symbol | Bedeutung |
|--------|-----------|
| 💬 3 | 3 Kommentare |
| 🔗 2 | 2 Links |
| 📎 1 | 1 Anhang |
| 👤 | Autor der Karte |
| 🖼️ | Hat Vorschaubild |

---

## 🔢 Mehrere Karten gleichzeitig

### Per KI erstellen

> „Erstelle 5 Karten für das Thema 'Wasserkreislauf':
> 1. Einführung
> 2. Verdunstung
> 3. Kondensation
> 4. Niederschlag
> 5. Abfluss"

Die KI erstellt alle Karten auf einmal!

### Karten duplizieren

1. Klicken Sie auf eine Karte
2. Wählen Sie **⋮ → Duplizieren**
3. Die Kopie erscheint in derselben Spalte

---

## 🗑️ Karten löschen

### Einzelne Karte löschen

1. Öffnen Sie die Karte (Klick)
2. Klicken Sie auf **🗑️ Löschen**
3. Bestätigen Sie

### Mehrere Karten löschen

1. Halten Sie **Strg** gedrückt
2. Klicken Sie auf mehrere Karten (Auswahl)
3. Drücken Sie **Entf** oder wählen Sie **Löschen**

---

## 🔄 Reihenfolge merken

Das Board merkt sich automatisch:
- Die Reihenfolge der Spalten
- Die Position jeder Karte
- Änderungen werden sofort gespeichert

**Keine Speichern-Button nötig!**

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Spalten erstellen und benennen
- [x] Spalten verschieben und löschen
- [x] Karten schnell erstellen
- [x] Karten per Drag & Drop verschieben
- [x] Karten-Vorschau verstehen
- [x] Mehrere Karten per KI erstellen

---

## 💡 Tipps für Fortgeschrittene

### Tastenkürzel

| Taste | Aktion |
|-------|--------|
| `N` | Neue Karte in fokussierter Spalte |
| `Entf` | Ausgewählte Karte löschen |
| `Enter` | Ausgewählte Karte öffnen |
| `Esc` | Dialog/Bearbeitung schließen |

### Workflow-Tipp: WIP-Limits

Begrenzen Sie die Anzahl der Karten in „In Arbeit":
- Maximal 3-5 Karten gleichzeitig
- Fokus auf Fertigstellen statt Anfangen
- Besserer Überblick

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Karten detailliert bearbeiten | [05 - Karten bearbeiten](./05-KARTEN-BEARBEITEN.md) |
| KI für Struktur nutzen | [06 - KI-Assistent](./06-KI-ASSISTENT.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [05 - Karten bearbeiten](./05-KARTEN-BEARBEITEN.md)
