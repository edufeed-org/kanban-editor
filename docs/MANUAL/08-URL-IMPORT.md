# 08 - URL-Import: Webinhalte als Karten

**Ziel:** Nach diesem Kapitel können Sie URLs, Nostr-Events und Webinhalte als Karten in Ihr Board importieren.

---

## 🔗 URL als Karte importieren

### Methode 1: Einfügen (Strg+V)

1. Kopieren Sie eine URL (z.B. YouTube-Link)
2. Klicken Sie ins Board (Hauptbereich)
3. Drücken Sie **Strg+V**
4. Eine Karte wird automatisch erstellt!

```
   Kopierte URL:
   https://www.youtube.com/watch?v=abc123

   Ergebnis:
   ┌────────────────────────────────────┐
   │  📺 Titel des Videos               │  ← Automatisch extrahiert!
   ├────────────────────────────────────┤
   │  ┌──────────────────────────────┐  │
   │  │ 🖼️ YouTube Thumbnail         │  │  ← Vorschaubild!
   │  └──────────────────────────────┘  │
   ├────────────────────────────────────┤
   │  Beschreibung vom Video...         │  ← Beschreibung extrahiert
   ├────────────────────────────────────┤
   │  🔗 youtube.com                    │  ← Link gespeichert
   └────────────────────────────────────┘
```

### Methode 2: Per KI

**Prompt:**
> Importiere diese URL als Karte: https://serlo.org/mathe/brueche

**KI-Antwort:**
```
✅ Karte erstellt aus URL:

📋 "Bruchrechnung - Serlo"
   - Beschreibung: Lerneinheit zur Bruchrechnung...
   - Bild: [Vorschau von Serlo]
   - Link: https://serlo.org/mathe/brueche
   - Labels: Mathe, OER, Serlo
```

---

## 📋 Unterstützte URL-Typen

### Automatisch erkannte URLs

| URL-Typ | Was passiert | Beispiel |
|---------|--------------|----------|
| **YouTube** | Video-Titel, Thumbnail, Beschreibung | youtube.com/watch?v=... |
| **Wikipedia** | Artikel-Titel, Zusammenfassung | de.wikipedia.org/wiki/... |
| **Serlo** | OER-Metadaten, Lizenz | serlo.org/... |
| **WLO** | Bildungsmetadaten | wirlernenonline.de/... |
| **PDF-Links** | Dateiname, PDF-Icon | domain.de/dokument.pdf |
| **Bilder** | Bild als Vorschau | domain.de/bild.jpg |
| **Standard-URLs** | Seitentitel, Beschreibung | beliebige Website |

---

## 🟣 Nostr-Events importieren

### Was sind Nostr-Events?

Nostr ist ein dezentrales Protokoll. Bildungsinhalte können als Nostr-Events geteilt werden:

- **naddr1...** - Adressierbare Events (z.B. Lerneinheiten)
- **nevent1...** - Standard-Events
- **note1...** - Notizen

### Nostr-URL importieren

**Methode 1: Einfügen**

```
1. Kopieren Sie die Nostr-Adresse:
   naddr1qqxnzdenxgcrxveexgcrqsf3xq6rjd...

2. Strg+V im Board

3. Karte wird erstellt mit allen Metadaten!
```

**Methode 2: Per KI**

> Importiere diesen Nostr-Link: naddr1qqxnzden...

**Ergebnis:**
```
┌────────────────────────────────────┐
│  📜 Lerneinheit: Demokratie        │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐  │
│  │ 🖼️ Bild aus dem Event        │  │
│  └──────────────────────────────┘  │
├────────────────────────────────────┤
│  AMB-Learning-Resource mit...      │
├────────────────────────────────────┤
│  🔗 njump.me/naddr1...             │ ← Viewer-Link
│  🔗 Original-URL (falls vorhanden) │
│  🔗 Nostr-Adresse                  │
└────────────────────────────────────┘
```

---

## 📥 Mehrere URLs importieren

### Bulk-Import per KI

**Prompt:**
> Importiere diese URLs als Karten in die Spalte "Materialien":
> 1. https://youtube.com/watch?v=abc
> 2. https://serlo.org/mathe/gleichungen
> 3. https://de.wikipedia.org/wiki/Bruchrechnung

**KI-Antwort:**
```
✅ 3 Karten importiert in "Materialien":

📋 Karte 1: "Mathe-Video" (YouTube)
📋 Karte 2: "Gleichungen - Serlo" (OER)
📋 Karte 3: "Bruchrechnung" (Wikipedia)

Alle Karten haben Titel, Beschreibung und Vorschaubild.
```

---

## 🎨 Import-Optionen

### Ziel-Spalte wählen

```
URL importiert → In welche Spalte?

Standard: Erste Spalte oder "Inbox"

Per KI: "Importiere URL X in Spalte 'Recherche'"
```

### Labels automatisch hinzufügen

Je nach URL-Typ werden Labels automatisch gesetzt:

| URL-Quelle | Automatische Labels |
|------------|---------------------|
| YouTube | Video, YouTube |
| Serlo | OER, Serlo |
| Wikipedia | Wiki, Referenz |
| PDF | PDF, Dokument |
| Nostr | Nostr, dezentral |

---

## 🔍 Metadaten-Extraktion

### Was wird extrahiert?

| Metadaten | Quelle | Beispiel |
|-----------|--------|----------|
| **Titel** | `<title>` oder og:title | "Bruchrechnung lernen" |
| **Beschreibung** | meta description / og:description | "In diesem Video..." |
| **Bild** | og:image / Thumbnail | Vorschaubild |
| **Autor** | og:author (wenn verfügbar) | "Max Mustermann" |
| **Datum** | published_time (wenn verfügbar) | 2024-01-15 |
| **Lizenz** | Schema.org license | CC BY 4.0 |

### Open Graph erklärt

Viele Websites nutzen "Open Graph" Tags:
```html
<meta property="og:title" content="Bruchrechnung"/>
<meta property="og:description" content="Lerne..."/>
<meta property="og:image" content="https://.../bild.jpg"/>
```

Diese werden automatisch zu Karten-Inhalten!

---

## ⚡ Schnell-Import per Tastatur

### Workflow

```
1. URL im Browser kopieren (Strg+C)
2. Zum Kanban-Board wechseln (Alt+Tab)
3. Einfügen (Strg+V)
4. Fertig! ✓
```

### Tastenkürzel

| Taste | Aktion |
|-------|--------|
| `Strg+V` | URL als neue Karte einfügen |
| `Strg+Shift+V` | URL zur ausgewählten Karte hinzufügen |

---

## 📋 Import-Vorschau

Bevor die Karte erstellt wird, sehen Sie eine Vorschau:

```
┌─────────────────────────────────────────────────────────────────┐
│  📥 Import-Vorschau                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔗 URL: https://youtube.com/watch?v=abc123                     │
│                                                                 │
│  📝 Erkannter Titel: "Bruchrechnung einfach erklärt"           │
│     [ Titel bearbeiten... ]                                     │
│                                                                 │
│  📄 Beschreibung:                                               │
│     In diesem Video lernt ihr die Grundlagen...                 │
│     [ Bearbeiten... ]                                           │
│                                                                 │
│  🖼️ Vorschaubild: ☑️ Verwenden                                  │
│     [ Vorschau ]                                                │
│                                                                 │
│  🏷️ Labels: [Video] [YouTube] [+]                               │
│                                                                 │
│  📂 Zielspalte: [Materialien ▼]                                 │
│                                                                 │
│  ┌─────────────┐  ┌───────────────┐                             │
│  │ ✅ Importieren│  │ ❌ Abbrechen   │                             │
│  └─────────────┘  └───────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Problembehebung

### URL wird nicht erkannt

**Problem:** Einfügen erstellt keine Karte

**Lösungen:**
1. Stellen Sie sicher, dass Sie im **Board-Bereich** sind (nicht in einem Textfeld)
2. Prüfen Sie, ob die URL gültig ist
3. Manche Websites blockieren Metadaten-Extraktion

**Alternativen:**
- Per KI: „Erstelle eine Karte mit Link zu [URL]"
- Manuell: Karte erstellen → Link hinzufügen

### Metadaten fehlen

**Problem:** Titel/Beschreibung/Bild fehlt

**Ursachen:**
- Website hat keine Open Graph Tags
- Website blockiert Zugriff

**Lösung:**
- Titel/Beschreibung manuell ergänzen
- Bild-URL separat hinzufügen

### Nostr-Event lädt nicht

**Problem:** Nostr-Adresse wird nicht aufgelöst

**Lösungen:**
1. Prüfen Sie die Relay-Verbindung (⚙️ Einstellungen)
2. Warten Sie einige Sekunden (Relays antworten verzögert)
3. Versuchen Sie einen anderen Relay

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] URLs per Strg+V als Karten importieren
- [x] Metadaten-Extraktion verstehen
- [x] Nostr-Events importieren
- [x] Mehrere URLs gleichzeitig importieren
- [x] Import-Optionen nutzen
- [x] Probleme beheben

---

## 💡 Fortgeschrittene Tipps

### Bookmarklet erstellen

Erstellen Sie ein Browser-Lesezeichen:
```javascript
javascript:(()=>{navigator.clipboard.writeText(location.href)})()
```
Ein Klick kopiert die aktuelle URL!

### Schnelle Recherche

1. Google-Suche durchführen
2. Relevante Links öffnen
3. Jede Seite: Strg+L → Strg+C → Alt+Tab → Strg+V
4. Alle Links als Karten im Board!

### Mit KI kombinieren

> „Ich habe 5 URLs importiert. Analysiere die Karten und schlage eine Sortierung nach Schwierigkeit vor."

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Boards mit Kollegen teilen | [09 - Boards teilen](./09-BOARDS-TEILEN.md) |
| Gemeinsam arbeiten | [10 - Kollaboration](./10-KOLLABORATION.md) |

---

**Zeit:** ⏱️ ~10 Minuten  
**Nächstes Kapitel:** [09 - Boards teilen](./09-BOARDS-TEILEN.md)
