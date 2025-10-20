# Demo-Board-Loader für Browser-Console

Einfaches Test-Script zur Befüllung des Kanban-Boards mit Demo-Daten.

## Installation

Das Script wird automatisch beim App-Start geladen. Globale Funktionen sind dann direkt in der Browser-Console verfügbar.

## Verfügbare Funktionen

Öffne die Browser-Konsole mit `F12` oder `Ctrl+Shift+I` und führe folgende Befehle aus:

### 🚀 Demo-Daten laden
```javascript
window.add_democontent()
```

Lädt folgende Demo-Inhalte ins Board:
- **3 Spalten**: TODO, IN PROGRESS, DONE
- **8 Karten** verteilt über die Spalten
- **6 Kommentare** auf verschiedenen Karten

Jede Karte wird mit Labels, Farbe und Kommentaren (mit Autoren) erstellt.

**Beispiel-Output:**
```
✨ Demo-Content erfolgreich geladen!
Spalten erstellt: 3
Karten hinzugefügt: 8
Kommentare hinzugefügt: 6
```

### 🗑️ Board zurücksetzen
```javascript
window.reset_board()
```

Löscht alle Spalten und Karten aus dem Board. Nützlich zum Neustarten.

### 📊 Board-Overview
```javascript
window.show_board()
```

Zeigt eine Tabelle mit allen Spalten und deren Kartenanzahl.

**Beispiel-Output:**
```
| Spalte              | Karten | Karten-IDs                    |
|---------------------|--------|-------------------------------|
| TODO — Aufgaben     | 3      | id1, id2, id3                |
| IN PROGRESS         | 2      | id4, id5                     |
| DONE                | 1      | id6                          |
```

### 🎴 Alle Karten anzeigen
```javascript
window.show_cards()
```

Zeigt eine detaillierte Übersicht aller Karten mit Kommentaren.

**Beispiel-Output:**
```
🏷️ Definiere Klassenstruktur für Kanban-System
ID: abc123
Inhalt: Erstelle TypeScript-Klassen...
💬 2 Kommentare:
  • Max Mustermann: "Das ist ein Kommentar zu dieser Aufgabe"
  • Anna Schmidt: "Priorität: Hoch"
```

### 📈 Elemente zählen
```javascript
window.count_board()
```

Zählt Spalten, Karten und Kommentare.

**Beispiel-Output:**
```
| Spalten | Karten | Kommentare |
|---------|--------|-----------|
| 3       | 8      | 6        |
```

## Beispiel-Workflow

```javascript
// 1. Board leeren
window.reset_board()

// 2. Demo-Daten laden
window.add_democontent()

// 3. Übersicht prüfen
window.count_board()

// 4. Detailansicht
window.show_cards()

// 5. Änderungen machen... z.B. Karten verschieben

// 6. Aktuellen State sehen
window.show_board()
```

## Technische Implementierung

Die Funktionen nutzen die `BoardStore` API:

- `boardStore.addColumn()` — Neue Spalte erstellen
- `column.addCard()` — Neue Karte zur Spalte hinzufügen
- `card.addComment()` — Kommentar zur Karte hinzufügen

Das ist die **gleiche API**, die auch in den UI-Komponenten verwendet wird. Perfekt zum Testen der Core-Logik.

## Dateistruktur

```
src/lib/utils/
├── demoBoardLoader.ts    ← Hauptdatei mit Funktionen
└── ...

src/routes/
└── +layout.svelte        ← Import triggert Registrierung
```

## Browser-Kompatibilität

✅ Funktioniert in allen modernen Browsern (Chrome, Firefox, Safari, Edge).

Die Funktionen sind nur verfügbar wenn:
- Das Board-Page geladen ist (`src/routes/cardsboard/+page.svelte`)
- Die Demo-Loader Datei importiert wurde

## Tipps & Tricks

### Board-State in Variable speichern
```javascript
const state = window.show_board()
```

### Eigene Karte hinzufügen
```javascript
const boardStore = window.boardStore // Nicht direkt verfügbar, muss über globales Store-Object gehen
// Alternativ: Verwende die UI-Buttons im Board
```

### Console-Output filtern
```javascript
// Nur Fehler anzeigen
window.add_democontent() // Filter in console auf "Error"
```

---

**Erstellt:** 20. Oktober 2025  
**Dokumentation für:** nostr-cli Kanban-Board
