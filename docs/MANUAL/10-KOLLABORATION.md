# 10 - Kollaboration: Gemeinsam in Echtzeit arbeiten

**Ziel:** Nach diesem Kapitel können Sie effektiv mit Kollegen gleichzeitig am selben Board arbeiten.

---

## 🌐 Echtzeit-Kollaboration verstehen

### Was ist das?

Mehrere Personen arbeiten **gleichzeitig** am selben Board. Änderungen werden in Echtzeit synchronisiert – wie bei Google Docs, aber dezentral über Nostr.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    👩‍🏫 Sie                  🧑‍🏫 Herr Müller                   │
│       │                        │                               │
│       │ Fügt Karte hinzu      │ Verschiebt Karte              │
│       ▼                        ▼                               │
│    ┌─────┐                  ┌─────┐                            │
│    │Board│◄────────────────►│Board│                            │
│    │lokal│  ⟳ Nostr Sync    │lokal│                            │
│    └─────┘                  └─────┘                            │
│       │                        │                               │
│       ▼                        ▼                               │
│    Sieht sofort            Sieht sofort                        │
│    Müllers Änderung        Ihre neue Karte                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technische Basis

- **Protokoll:** Nostr (dezentral, verschlüsselt)
- **Sync:** Ereignisbasiert über Relays
- **Konfliktlösung:** Last-Write-Wins + 3-Way-Merge

---

## 👥 Aktive Nutzer erkennen

### Presence-Anzeige

Wenn andere am Board arbeiten, sehen Sie:

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Projektwoche 2026                                           │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Gerade aktiv: 👩‍🏫 Sie  🧑‍🏫 Hr. Müller  👩‍💼 Fr. Schmidt          │
│                  │                                              │
│                  └── 3 Personen bearbeiten dieses Board         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Wer bearbeitet was?

Bei Karten sehen Sie, wenn jemand gerade editiert:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ 📝 Material sammeln │  │ 🔒 Zeitplan         │ ← Bearbeitung│
│  │                     │  │                     │   durch       │
│  │                     │  │ 🧑‍🏫 Hr. Müller      │   Hr. Müller  │
│  │                     │  │    bearbeitet...    │              │
│  │                     │  │                     │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Soft-Locks: Bearbeitungssperren

### Was ist ein Soft-Lock?

Wenn Sie eine Karte öffnen, wird sie für andere als "in Bearbeitung" markiert. Das verhindert, dass zwei Personen gleichzeitig dasselbe bearbeiten.

```
Ablauf:
1. Sie öffnen Karte "Zeitplan"
2. → Soft-Lock wird gesetzt (5 Min. TTL)
3. Hr. Müller sieht: "🔒 Wird bearbeitet von Sie"
4. Sie schließen die Karte
5. → Soft-Lock wird aufgehoben
6. Hr. Müller kann jetzt bearbeiten
```

### Soft-Lock Warnung

Wenn Sie eine gesperrte Karte öffnen:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Bearbeitungswarnung                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Diese Karte wird gerade bearbeitet von:                        │
│                                                                 │
│  🧑‍🏫 Herr Müller (seit 2 Minuten)                               │
│                                                                 │
│  Wenn Sie jetzt Änderungen machen, könnten Konflikte entstehen.│
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Trotzdem öffnen  │  │ Abbrechen        │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Soft-Lock Zeitüberschreitung

- **Standard:** 5 Minuten
- **Nach Ablauf:** Lock wird automatisch aufgehoben
- **Grund:** Verhindert "verwaiste" Locks bei Browser-Crash

---

## ⚡ Konflikte erkennen und lösen

### Wann entstehen Konflikte?

Konflikte passieren, wenn zwei Personen **gleichzeitig** dieselbe Karte bearbeiten:

```
Timeline:
──────────────────────────────────────────────────────────────────
     0s          5s          10s         15s         20s
     │           │            │           │           │
     │ Sie       │            │           │           │
     │ öffnen    │            │           │ speichern │
     │ Karte     │            │           │           │
     │           │            │           │           │
     │           │ Hr. Müller │           │           │
     │           │ öffnet     │           │ speichert │
     │           │ gleiche    │           │ auch!     │
     │           │ Karte      │           │           │
     ▼           ▼            ▼           ▼           ▼
                              ↑
                              Beide haben Basis-Version
                              
                                          ↑
                                          KONFLIKT!
                                          Zwei unterschiedliche Änderungen
──────────────────────────────────────────────────────────────────
```

### Konflikt-Dialog

Wenn ein Konflikt erkannt wird:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Konflikt erkannt                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Die Karte wurde von einer anderen Person geändert, während     │
│  Sie sie bearbeitet haben.                                      │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Original (Basis)│ │ Ihre Version    │ │ Andere Version  │   │
│  ├─────────────────┤ ├─────────────────┤ ├─────────────────┤   │
│  │ Titel:          │ │ Titel:          │ │ Titel:          │   │
│  │ "Zeitplan"      │ │ "Zeitplan v2"   │ │ "Projekt-Plan"  │   │
│  │                 │ │                 │ │                 │   │
│  │ Beschreibung:   │ │ Beschreibung:   │ │ Beschreibung:   │   │
│  │ "ToDo Liste"    │ │ "Detaillierte   │ │ "Meilensteine"  │   │
│  │                 │ │  Planung"       │ │                 │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  Wie möchten Sie vorgehen?                                      │
│                                                                 │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐  │
│  │ Meine Version  │ │ Andere Version │ │ Manuell mergen     │  │
│  │ behalten       │ │ übernehmen     │ │ (empfohlen)        │  │
│  └────────────────┘ └────────────────┘ └────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Konflikt-Auflösungsoptionen

| Option | Beschreibung | Wann verwenden |
|--------|--------------|----------------|
| **Meine Version** | Ihre Änderungen überschreiben die anderen | Wenn Ihre Version aktueller ist |
| **Andere Version** | Die andere Version überschreibt Ihre | Wenn die andere Version besser ist |
| **Manuell mergen** | Beide Versionen kombinieren | Bei komplexen Änderungen |

### Auto-Merge

Manche Änderungen werden **automatisch** zusammengeführt:

| Änderung | Auto-Merge möglich? |
|----------|---------------------|
| Person A ändert Titel, B ändert Beschreibung | ✅ Ja |
| Person A fügt Label hinzu, B fügt Link hinzu | ✅ Ja |
| Beide ändern den Titel | ❌ Nein → Dialog |
| Beide ändern dieselbe Stelle der Beschreibung | ❌ Nein → Dialog |

---

## 📊 Synchronisations-Status

### Status-Anzeige

In der Topbar sehen Sie den aktuellen Sync-Status:

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Projektwoche              🟢 Synchronisiert     👥 3 aktiv  │
└─────────────────────────────────────────────────────────────────┘

Status-Varianten:
🟢 Synchronisiert     - Alles aktuell
🟡 Wird synchronisiert... - Änderungen werden übertragen
🔴 Offline            - Keine Verbindung (Änderungen werden gequeued)
```

### Offline-Modus

Wenn die Verbindung abbricht:
1. Sie können weiter arbeiten
2. Änderungen werden lokal gespeichert
3. Bei Reconnect: Automatische Synchronisation
4. Bei Konflikten: Dialog erscheint

---

## 💬 Kommentare & Kommunikation

### In-Board Kommunikation

Nutzen Sie Kommentare, um mit Kollegen zu kommunizieren:

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 Zeitplan erstellen                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💬 Kommentare (3)                                              │
│                                                                 │
│  🧑‍🏫 Hr. Müller (vor 5 Min):                                    │
│  "Können wir den Termin auf Donnerstag verschieben?"            │
│                                                                 │
│  👩‍🏫 Sie (vor 2 Min):                                           │
│  "@Müller Ja, passt! Ich passe die Karte an."                   │
│                                                                 │
│  👩‍💼 Fr. Schmidt (gerade eben):                                 │
│  "👍 Einverstanden!"                                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Neuer Kommentar...                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### @Erwähnungen

- Tippen Sie **@Name**, um jemanden zu erwähnen
- Die Person erhält eine Benachrichtigung
- Funktioniert wie in Slack/Teams

---

## 📱 Benachrichtigungen

### Was wird benachrichtigt?

| Ereignis | Benachrichtigung |
|----------|------------------|
| Neuer Kommentar | ✅ Ja |
| @Erwähnung | ✅ Ja (hervorgehoben) |
| Karte verschoben | Optional |
| Neue Karte erstellt | Optional |
| Konflikt entstanden | ✅ Ja |

### Benachrichtigungseinstellungen

Unter **⚙️ Einstellungen → Benachrichtigungen**:
- Push-Benachrichtigungen aktivieren/deaktivieren
- E-Mail-Zusammenfassung (täglich/wöchentlich)
- Sounds aktivieren/deaktivieren

---

## 🎯 Best Practices für Teams

### Kommunikation

| Do | Don't |
|-----|-------|
| ✅ Kommentare für Diskussionen | ❌ Änderungen ohne Absprache |
| ✅ @Erwähnungen nutzen | ❌ Wichtiges nur mündlich |
| ✅ Status in Karten dokumentieren | ❌ Annahmen treffen |

### Arbeitsaufteilung

1. **Spalten aufteilen**: Jeder arbeitet in seiner Spalte
2. **Karten zuweisen**: Markieren Sie, wer verantwortlich ist
3. **Zeitlich staffeln**: Wenn möglich, nicht gleichzeitig dieselbe Karte

### Konflikt-Vermeidung

1. **Soft-Lock beachten**: Warten, wenn jemand bearbeitet
2. **Kleine Änderungen**: Lieber öfter speichern
3. **Kommunizieren**: Vor größeren Änderungen absprechen

---

## ⚠️ Häufige Probleme

### Problem: Änderungen erscheinen nicht

**Mögliche Ursachen:**
1. Offline-Modus → Prüfen Sie die Verbindung
2. Sync-Verzögerung → Warten Sie einige Sekunden
3. Cache-Problem → Seite neu laden (F5)

**Lösung:**
```
1. Prüfen: 🟢/🟡/🔴 Status in Topbar
2. Wenn 🔴: Internetverbindung prüfen
3. Wenn 🟡: Warten (max. 30 Sek)
4. Wenn weiterhin Problem: Strg+Shift+R (Hard Refresh)
```

### Problem: Konflikt-Dialog erscheint ständig

**Ursache:** Zwei Personen bearbeiten dieselbe Karte

**Lösung:**
1. Absprechen: Wer bearbeitet was?
2. Soft-Lock beachten
3. Größere Änderungen in Ruhezeiten machen

### Problem: Nutzer sieht meine Einladung nicht

**Mögliche Ursachen:**
1. Falsche Nostr-Adresse
2. Nutzer ist offline
3. Relay-Verbindungsproblem

**Lösung:**
1. Nostr-Adresse prüfen (npub...)
2. Nutzer bitten, Relays zu prüfen
3. Alternative: Share-Link senden

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Echtzeit-Kollaboration verstehen
- [x] Aktive Nutzer erkennen
- [x] Soft-Locks verstehen und beachten
- [x] Konflikte erkennen und lösen
- [x] Auto-Merge vs. manuelle Auflösung
- [x] Synchronisations-Status prüfen
- [x] Kommentare für Kommunikation nutzen
- [x] Best Practices für Teams anwenden

---

## 💡 Tipps für effektive Teamarbeit

### Kommunikationsregeln

1. **Vor dem Start**: Kurze Absprache, wer woran arbeitet
2. **Während der Arbeit**: Kommentare nutzen
3. **Nach der Session**: Kurze Zusammenfassung in der Karte

### Regelmäßige Syncs

- **Täglich**: Kurzer Blick auf Änderungen (5 Min)
- **Wöchentlich**: Gemeinsame Review-Session (15 Min)

### Rollen definieren

```
Beispiel für Projektwoche:

👑 Owner: Sie (Koordination)
✏️ Editor: Hr. Müller (Inhalt Montag-Mittwoch)
✏️ Editor: Fr. Schmidt (Inhalt Donnerstag-Freitag)
👀 Betrachter: Schulleitung (nur Übersicht)
```

---

## ➡️ Nächste Schritte

| Empfehlung | Kapitel |
|------------|---------|
| Backups und Versionen | [11 - Export/Import](./11-EXPORT-IMPORT.md) |
| Einstellungen anpassen | [12 - Einstellungen](./12-EINSTELLUNGEN.md) |

---

**Zeit:** ⏱️ ~15 Minuten  
**Nächstes Kapitel:** [11 - Export/Import](./11-EXPORT-IMPORT.md)
