# 02 - Die Oberfläche: Alle Bereiche kennenlernen

**Ziel:** Nach diesem Kapitel kennen Sie alle Bereiche der Anwendung und wissen, wo Sie welche Funktionen finden.

---

## 🖥️ Übersicht der Benutzeroberfläche

Die Anwendung ist in vier Hauptbereiche unterteilt:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           1️⃣ TOPBAR                                     │
│  [☰] Kanban Board    Board-Name ▼    [Teilen] [Export] [⚙️] [👤]       │
├───────────────┬─────────────────────────────────────┬───────────────────┤
│               │                                     │                   │
│  2️⃣ LINKE     │        3️⃣ HAUPTBEREICH              │   4️⃣ RECHTE       │
│   SIDEBAR     │           (BOARD)                   │    SIDEBAR        │
│               │                                     │                   │
│  Meine Boards │  ┌────────┐ ┌────────┐ ┌────────┐  │   🤖 KI-Chat     │
│  ───────────  │  │ Ideen  │ │In Arbeit│ │ Fertig │  │                   │
│  📋 Board 1   │  │        │ │        │ │        │  │   Wie kann ich    │
│  📋 Board 2   │  │ [Karte]│ │ [Karte]│ │ [Karte]│  │   helfen?         │
│  + Neu        │  │ [Karte]│ │        │ │        │  │                   │
│               │  │ + Add  │ │ + Add  │ │ + Add  │  │   [___________]   │
│               │  └────────┘ └────────┘ └────────┘  │   [Senden]        │
│               │                                     │                   │
└───────────────┴─────────────────────────────────────┴───────────────────┘
```

---

## 1️⃣ Topbar (Kopfzeile)

Die Topbar enthält Navigation und wichtige Aktionen:

| Element | Funktion |
|---------|----------|
| **☰ Menü** | Linke Sidebar ein-/ausblenden |
| **Board-Name** | Aktuelles Board, Klick zum Umbenennen |
| **Teilen** | Share-Link erstellen, Board freigeben |
| **Export** | Board als JSON exportieren |
| **⚙️ Einstellungen** | Theme, Relays, KI-Konfiguration |
| **👤 Profil** | Anmeldung, Logout, Profilinfos |

### Schnellaktionen in der Topbar

```
[📤 Teilen]     → Erstellt einen Share-Link zum Versenden
[💾 Export]     → Lädt das Board als JSON-Datei herunter
[🌓 Theme]      → Wechselt zwischen Hell/Dunkel-Modus
```

---

## 2️⃣ Linke Sidebar: Board-Verwaltung

Hier verwalten Sie Ihre Boards:

```
┌─────────────────────┐
│  📂 Meine Boards    │
│  ─────────────────  │
│                     │
│  📋 Unterricht Bio  │  ← Eigenes Board
│  📋 Projekt Klasse9 │  ← Eigenes Board
│  👥 Team-Planung    │  ← Geteiltes Board
│                     │
│  ─────────────────  │
│  [+ Neues Board]    │
│                     │
│  🎓 Demo Board      │  ← Zum Ausprobieren
│                     │
└─────────────────────┘
```

### Board-Typen

| Symbol | Bedeutung |
|--------|-----------|
| 📋 | Eigenes Board (Sie sind Owner) |
| 👥 | Geteiltes Board (Kollaboration) |
| 🎓 | Demo-Board (zum Testen) |

### Aktionen

- **Klick auf Board:** Board öffnen
- **Rechtsklick/Kontextmenü:** Umbenennen, Löschen, Exportieren
- **Drag & Drop:** Reihenfolge ändern (kommt bald)

**💡 Tipp:** Die Sidebar kann mit **☰** eingeklappt werden für mehr Platz.

---

## 3️⃣ Hauptbereich: Das Board

Hier findet die eigentliche Arbeit statt:

### Spalten

```
┌──────────────────┐
│  📥 Ideen        │  ← Spaltenname (klicken zum Bearbeiten)
│  ────────────────│
│                  │
│  ┌────────────┐  │
│  │  Karte 1   │  │  ← Karten in der Spalte
│  └────────────┘  │
│  ┌────────────┐  │
│  │  Karte 2   │  │
│  └────────────┘  │
│                  │
│  [+ Karte]       │  ← Neue Karte hinzufügen
│                  │
└──────────────────┘
```

### Karten

Jede Karte zeigt auf einen Blick:

```
┌────────────────────────────┐
│  Einführung Photosynthese  │  ← Titel
│  ──────────────────────────│
│  🏷️ Bio  🏷️ Kl.7           │  ← Labels
│  ──────────────────────────│
│  💬 3  🔗 2  📎 1           │  ← Kommentare, Links, Anhänge
└────────────────────────────┘
```

| Symbol | Bedeutung |
|--------|-----------|
| 🏷️ | Labels zur Kategorisierung |
| 💬 | Anzahl Kommentare |
| 🔗 | Anzahl Links |
| 📎 | Anzahl Anhänge |
| 🖼️ | Hat ein Vorschaubild |

### Interaktionen im Board

| Aktion | So geht's |
|--------|-----------|
| **Karte öffnen** | Klick auf Karte |
| **Karte verschieben** | Drag & Drop |
| **Neue Karte** | „+ Karte" Button |
| **Neue Spalte** | „+ Spalte" (rechts) |
| **Spalte umbenennen** | Klick auf Spaltenname |
| **Spalte verschieben** | Drag & Drop am Header |

---

## 4️⃣ Rechte Sidebar: KI-Assistent

Der intelligente Helfer für Ihre Unterrichtsplanung:

```
┌─────────────────────────┐
│  🤖 KI-Assistent        │
│  ───────────────────────│
│                         │
│  Hallo! Wie kann ich    │
│  Ihnen helfen?          │
│                         │
│  ───────────────────────│
│  Beispiele:             │
│  • "Erstelle Karten..." │
│  • "Finde OER zu..."    │
│  • "Teile Karte auf..." │
│  ───────────────────────│
│                         │
│  [Ihre Nachricht...]    │
│            [📤 Senden]  │
│                         │
└─────────────────────────┘
```

### Verfügbare KI-Werkzeuge

| Werkzeug | Beispiel-Prompt |
|----------|-----------------|
| **Karten erstellen** | „Erstelle 5 Karten zum Thema Mittelalter" |
| **Karten aufteilen** | „Teile diese Karte in Unterthemen auf" |
| **OER suchen** | „Finde Arbeitsblätter zur Photosynthese" |
| **Zusammenfassen** | „Fasse die Karten in dieser Spalte zusammen" |

**💡 Mehr dazu:** [Kapitel 06 - KI-Assistent](./06-KI-ASSISTENT.md)

---

## 🎨 Anpassungen

### Theme wechseln (Hell/Dunkel)

1. Klicken Sie auf **⚙️ Einstellungen** in der Topbar
2. Wählen Sie unter **Darstellung** → **Theme**:
   - ☀️ Hell
   - 🌙 Dunkel
   - 🖥️ System (automatisch)

### Sidebars ein-/ausblenden

| Tastenkürzel | Aktion |
|--------------|--------|
| `Strg + B` | Linke Sidebar toggle |
| `Strg + J` | Rechte Sidebar (KI) toggle |

Oder klicken Sie auf die entsprechenden Icons in der Topbar.

---

## 📱 Responsive Design

Die Anwendung passt sich an Ihre Bildschirmgröße an:

| Gerät | Verhalten |
|-------|-----------|
| **Desktop** | Alle Sidebars sichtbar |
| **Tablet** | Sidebars als Overlay |
| **Smartphone** | Vollbild-Board, Sidebars über Menü |

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Die vier Hauptbereiche der Anwendung
- [x] Topbar mit Aktionen
- [x] Board-Verwaltung in der linken Sidebar
- [x] Spalten und Karten im Hauptbereich
- [x] KI-Assistent in der rechten Sidebar
- [x] Theme und Sidebars anpassen

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Boards erstellen | [03 - Boards verwalten](./03-BOARDS.md) |
| Mit Karten arbeiten | [04 - Spalten & Karten](./04-SPALTEN-KARTEN.md) |

---

**Zeit:** ⏱️ ~10 Minuten  
**Nächstes Kapitel:** [03 - Boards verwalten](./03-BOARDS.md)
