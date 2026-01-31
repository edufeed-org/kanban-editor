# 03 - Boards verwalten: Erstellen, Organisieren, Löschen

**Ziel:** Nach diesem Kapitel können Sie eigene Boards erstellen, organisieren und verwalten.

---

## 📋 Was ist ein Board?

Ein Board ist Ihre Arbeitsfläche für ein Thema oder Projekt:

- **Unterrichtsplanung:** Ein Board pro Fach oder Klasse
- **Projektarbeit:** Ein Board für ein Schulprojekt
- **Materialsammlung:** Ein Board für gesammelte Ressourcen

**💡 Tipp:** Erstellen Sie lieber mehrere fokussierte Boards als ein überfülltes!

---

## 🆕 Neues Board erstellen

### Methode 1: Über die Sidebar

1. Klicken Sie in der linken Sidebar auf **[+ Neues Board]**
2. Geben Sie einen Namen ein: `Biologie Klasse 7`
3. Optional: Fügen Sie eine Beschreibung hinzu
4. Klicken Sie auf **Erstellen**

### Methode 2: Über die KI

Sagen Sie der KI:
> „Erstelle ein neues Board für Mathematik Klasse 9 mit den Spalten 'Themen', 'In Bearbeitung', 'Fertig'"

Die KI erstellt das Board inklusive Spalten!

---

## ✏️ Board umbenennen

### Über die Topbar

1. Klicken Sie auf den **Board-Namen** in der Topbar
2. Bearbeiten Sie den Namen
3. Drücken Sie **Enter** oder klicken Sie außerhalb

### Über das Kontextmenü

1. **Rechtsklick** auf das Board in der Sidebar
2. Wählen Sie **Umbenennen**
3. Neuen Namen eingeben

---

## 📝 Board-Beschreibung bearbeiten

Jedes Board kann eine Beschreibung haben:

1. Klicken Sie auf **⚙️** neben dem Board-Namen
2. Wählen Sie **Board-Einstellungen**
3. Bearbeiten Sie die **Beschreibung**
4. Klicken Sie auf **Speichern**

```
┌─────────────────────────────────────────────────────────────┐
│  Board-Einstellungen                                   [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Name:                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Biologie Klasse 7                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Beschreibung:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Unterrichtsplanung für das Schuljahr 2025/26.       │   │
│  │ Schwerpunkte: Ökologie, Zellbiologie.               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tags: [Biologie] [Klasse 7] [2025/26] [+ Tag]             │
│                                                             │
│                                    [Abbrechen] [Speichern]  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏷️ Board-Tags verwenden

Tags helfen bei der Organisation mehrerer Boards:

| Tag-Beispiele | Verwendung |
|---------------|------------|
| `Biologie`, `Mathe`, `Deutsch` | Nach Fach |
| `Klasse 5`, `Klasse 7`, `Oberstufe` | Nach Stufe |
| `2025/26` | Nach Schuljahr |
| `Projekt`, `Vertretung` | Nach Art |

### Tags hinzufügen

1. Öffnen Sie **Board-Einstellungen**
2. Klicken Sie auf **[+ Tag]**
3. Geben Sie den Tag-Namen ein
4. Drücken Sie Enter

---

## 📂 Boards organisieren

### Board-Liste in der Sidebar

Ihre Boards werden in der linken Sidebar angezeigt:

```
┌─────────────────────┐
│  📂 Meine Boards    │
│  ─────────────────  │
│                     │
│  📋 Bio Klasse 7    │  ← Kürzlich verwendet
│  📋 Mathe Klasse 9  │
│  📋 Deutsch LK      │
│                     │
│  ─────────────────  │
│  👥 Geteilte Boards │
│  ─────────────────  │
│  👥 Team-Planung    │
│                     │
└─────────────────────┘
```

### Sortierung

Boards werden automatisch nach **letzter Verwendung** sortiert – das aktuellste oben.

---

## 🗑️ Board löschen

**⚠️ Achtung:** Gelöschte Boards können nicht wiederhergestellt werden!

### So löschen Sie ein Board

1. **Rechtsklick** auf das Board in der Sidebar
2. Wählen Sie **🗑️ Löschen**
3. Bestätigen Sie mit **Ja, löschen**

```
┌─────────────────────────────────────────────────────────────┐
│  Board löschen?                                        [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ Möchten Sie das Board "Biologie Klasse 7" wirklich     │
│     löschen?                                                │
│                                                             │
│  Diese Aktion kann nicht rückgängig gemacht werden!        │
│  Alle Spalten und Karten werden gelöscht.                  │
│                                                             │
│  💡 Tipp: Exportieren Sie das Board vorher als Backup.     │
│                                                             │
│                             [Abbrechen] [🗑️ Ja, löschen]   │
└─────────────────────────────────────────────────────────────┘
```

### Vor dem Löschen: Backup erstellen

1. Öffnen Sie das Board
2. Klicken Sie auf **Export** in der Topbar
3. Speichern Sie die JSON-Datei

**💡 Mehr dazu:** [Kapitel 11 - Export & Import](./11-EXPORT-IMPORT.md)

---

## 📊 Board-Übersicht

### Schnellinfo anzeigen

Fahren Sie mit der Maus über ein Board in der Sidebar:

```
┌─────────────────────────────────────────┐
│  📋 Biologie Klasse 7                   │
│  ───────────────────────────────────────│
│  Spalten: 3                             │
│  Karten: 24                             │
│  Zuletzt bearbeitet: Heute, 14:32      │
│  Tags: Biologie, Klasse 7              │
└─────────────────────────────────────────┘
```

---

## 🎓 Demo-Board verstehen

Das Demo-Board ist besonders für Einsteiger:

| Eigenschaft | Verhalten |
|-------------|-----------|
| **Ohne Anmeldung** | Sofort verfügbar |
| **Speicherung** | Lokal im Browser (30 Tage) |
| **Bei Anmeldung** | Wird zu normalem Board konvertiert |
| **Inhalt** | Beispiel-Karten zum Ausprobieren |

### Demo zu echtem Board

Wenn Sie sich anmelden:
- **Mit eigenen Boards:** Demo wird gelöscht
- **Ohne eigene Boards:** Demo wird Ihr erstes Board

---

## 🔄 Board wechseln

### Zwischen Boards wechseln

1. Klicken Sie auf ein anderes Board in der Sidebar
2. Das neue Board wird geladen
3. Das vorherige Board bleibt gespeichert

### Mehrere Boards gleichzeitig

**💡 Tipp:** Öffnen Sie die App in mehreren Browser-Tabs für verschiedene Boards!

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Neues Board erstellen
- [x] Board umbenennen
- [x] Beschreibung und Tags bearbeiten
- [x] Boards organisieren
- [x] Board sicher löschen (mit Backup)
- [x] Demo-Board verstehen

---

## 📋 Best Practices

### Namenskonvention

Verwenden Sie aussagekräftige Namen:

| ❌ Vermeiden | ✅ Besser |
|-------------|-----------|
| Board 1 | Biologie Klasse 7 |
| Neues Board | Projekt Klimawandel |
| Test | Vertretungsmaterial SJ25 |

### Board-Struktur planen

Überlegen Sie vorher:
- Welche Spalten brauche ich?
- Wer soll Zugriff haben?
- Wie lange wird das Board genutzt?

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Spalten & Karten anlegen | [04 - Spalten & Karten](./04-SPALTEN-KARTEN.md) |
| Board teilen | [09 - Boards teilen](./09-BOARDS-TEILEN.md) |
| Board exportieren | [11 - Export & Import](./11-EXPORT-IMPORT.md) |

---

**Zeit:** ⏱️ ~10 Minuten  
**Nächstes Kapitel:** [04 - Spalten & Karten](./04-SPALTEN-KARTEN.md)
