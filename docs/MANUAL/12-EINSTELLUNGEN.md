# 12 - Einstellungen: Das Kanban-Board personalisieren

**Ziel:** Nach diesem Kapitel können Sie alle Einstellungen optimal für Ihre Bedürfnisse konfigurieren.

---

## ⚙️ Einstellungen-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Einstellungen                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎨 Erscheinungsbild                                            │
│     Theme, Farben, Schriftgröße                                 │
│                                                                 │
│  🔌 Nostr & Relays                                              │
│     Verbindungen, Synchronisation                               │
│                                                                 │
│  🤖 KI-Assistent                                                │
│     API-Konfiguration, Prompts                                  │
│                                                                 │
│  👤 Profil & Konto                                              │
│     Login, Anzeigename, Avatar                                  │
│                                                                 │
│  🔔 Benachrichtigungen                                          │
│     Sounds, Push, E-Mail                                        │
│                                                                 │
│  📦 Daten & Speicher                                            │
│     Backup, Cache, Export                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Einstellungen öffnen

**Methode 1:** Klicken Sie auf **⚙️** in der Topbar  
**Methode 2:** Tastenkürzel **Strg + ,** (Komma)

---

## 🎨 Erscheinungsbild

### Theme wählen

```
┌─────────────────────────────────────────────────────────────────┐
│  🎨 Theme                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ○ ☀️ Hell (Light)                                              │
│    Klassisches helles Design                                    │
│                                                                 │
│  ● 🌙 Dunkel (Dark)                                             │
│    Augenschonend bei wenig Licht                                │
│                                                                 │
│  ○ 💻 System                                                    │
│    Folgt den Betriebssystem-Einstellungen                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| Theme | Empfohlen für |
|-------|---------------|
| **Hell** | Tagsüber, gut beleuchtete Räume |
| **Dunkel** | Abends, dunkle Räume, weniger Augenbelastung |
| **System** | Automatischer Wechsel je nach Tageszeit |

### Akzentfarbe

Wählen Sie die Hauptfarbe für Buttons und Hervorhebungen:

```
Verfügbare Farben:
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ 🔵 │ │ 🟢 │ │ 🟡 │ │ 🟠 │ │ 🔴 │ │ 🟣 │
│Blau│ │Grün│ │Gelb│ │Orang│ │Rot │ │Lila│
└────┘ └────┘ └────┘ └────┘ └────┘ └────┘
```

### Schriftgröße

```
Schriftgröße: [████████░░] 100%

Klein (80%) ──────────────── Groß (140%)

💡 Tipp: Für Beamer-Präsentationen auf 120-140% erhöhen
```

### Kompakte Ansicht

```
☐ Kompakte Kartenansicht aktivieren
  Weniger Abstand, mehr Karten sichtbar
  
☑️ Spaltenbreite automatisch anpassen
  Spalten füllen den verfügbaren Platz
```

---

## 🔌 Nostr & Relays

### Was sind Relays?

Relays sind Server, über die Ihre Daten synchronisiert werden. Denken Sie an sie wie E-Mail-Server – Sie können mehrere nutzen für Redundanz.

### Relay-Verwaltung

```
┌─────────────────────────────────────────────────────────────────┐
│  🔌 Nostr Relays                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Aktive Relays:                                                 │
│                                                                 │
│  🟢 wss://relay.damus.io                                        │
│     Latenz: 45ms • Verbunden                                    │
│     [Entfernen]                                                 │
│                                                                 │
│  🟢 wss://relay.primal.net                                      │
│     Latenz: 62ms • Verbunden                                    │
│     [Entfernen]                                                 │
│                                                                 │
│  🟡 wss://nos.lol                                               │
│     Latenz: 180ms • Verbinden...                                │
│     [Entfernen]                                                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Relay hinzufügen:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ wss://                                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [➕ Hinzufügen]                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Empfohlene Relays

| Relay | Region | Beschreibung |
|-------|--------|--------------|
| `wss://relay.damus.io` | Global | Beliebt, zuverlässig |
| `wss://relay.primal.net` | Global | Schnell, stabil |
| `wss://nos.lol` | Europa | Gute EU-Latenz |
| `wss://nostr.wine` | Global | Premium-Relay |

### Verbindungsstatus

| Symbol | Bedeutung |
|--------|-----------|
| 🟢 | Verbunden, funktioniert |
| 🟡 | Verbindet... oder langsam |
| 🔴 | Nicht erreichbar |

**💡 Tipp:** Nutzen Sie 2-3 Relays für beste Redundanz. Zu viele Relays verlangsamen die Synchronisation.

---

## 🤖 KI-Assistent

### API-Konfiguration

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 KI-Assistent Konfiguration                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KI-Anbieter:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ OpenAI (GPT-4) ▼                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  API-Schlüssel:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ sk-...••••••••••••••••••                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Testen] [Speichern]                                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Modell:                                                        │
│  ○ GPT-3.5 Turbo (schnell, günstig)                            │
│  ● GPT-4 (beste Qualität)                                       │
│  ○ GPT-4 Turbo (schnell + gut)                                  │
│                                                                 │
│  Max. Tokens pro Anfrage: [2000]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Unterstützte Anbieter

| Anbieter | Modelle | Anmerkung |
|----------|---------|-----------|
| **OpenAI** | GPT-3.5, GPT-4 | Standard, beste Kompatibilität |
| **Anthropic** | Claude 3 | Alternative |
| **Lokal** | Ollama, LM Studio | Kostenlos, braucht Hardware |
| **Edufeed** | Gehostet | Für Schulen (API-Key über Schule) |

### Eigene System-Prompts

Passen Sie an, wie der KI-Assistent antwortet:

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 System-Prompt (für alle Anfragen)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Du bist ein Assistent für Lehrkräfte. Antworte auf      │   │
│  │ Deutsch. Berücksichtige pädagogische Aspekte.           │   │
│  │ Nutze die Bildungsstandards des jeweiligen Fachs.       │   │
│  │ Formuliere altersgerecht für die Zielgruppe.            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Zurücksetzen auf Standard] [Speichern]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👤 Profil & Konto

### Profil bearbeiten

```
┌─────────────────────────────────────────────────────────────────┐
│  👤 Ihr Profil                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│       ┌──────┐                                                  │
│       │  👤  │  [Bild ändern]                                   │
│       └──────┘                                                  │
│                                                                 │
│  Anzeigename:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Frau Müller                                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Über mich:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Mathematiklehrerin an der Beispielschule                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Ihre Nostr-Adresse (npub):                                     │
│  npub1xxxxxx...                      [📋 Kopieren]              │
│                                                                 │
│  [Profil speichern]                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Login-Optionen

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 Anmeldung                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Aktuell angemeldet als: Frau Müller (npub1xxx...)              │
│                                                                 │
│  Anmeldemethode: 🦊 Browser-Extension (NIP-07)                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Verfügbare Methoden:                                           │
│                                                                 │
│  🦊 Browser-Extension (empfohlen)                               │
│     Sicherste Option. Nos2x, Alby, etc.                         │
│                                                                 │
│  🔑 Private Key (nsec)                                          │
│     ⚠️ Nur für Entwicklung! Nicht für echte Konten.             │
│                                                                 │
│  🎓 Schul-Login (OIDC)                                          │
│     Anmeldung über Schulaccount                                 │
│                                                                 │
│  [Abmelden]                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Session-Einstellungen

| Einstellung | Standard | Beschreibung |
|-------------|----------|--------------|
| **Angemeldet bleiben** | 7 Tage | Automatische Abmeldung nach X Tagen |
| **Auf allen Geräten abmelden** | - | Beendet alle aktiven Sessions |

---

## 🔔 Benachrichtigungen

### Push-Benachrichtigungen

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 Benachrichtigungen                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Push-Benachrichtigungen:                                       │
│  ☑️ Im Browser aktiviert                                        │
│                                                                 │
│  Benachrichtigen bei:                                           │
│  ☑️ Neue Kommentare auf meinen Karten                           │
│  ☑️ @Erwähnungen                                                │
│  ☐ Neue Karten in meinen Boards                                 │
│  ☐ Karten verschoben                                            │
│  ☑️ Konflikt erkannt                                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────      │
│                                                                 │
│  Sounds:                                                        │
│  ☐ Benachrichtigungs-Sound abspielen                            │
│                                                                 │
│  Ruhezeiten:                                                    │
│  ☑️ Keine Benachrichtigungen von 22:00 bis 07:00                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### E-Mail-Zusammenfassung

```
E-Mail-Digest:
○ Aus
○ Täglich (um 18:00)
● Wöchentlich (Freitag, 16:00)
○ Monatlich
```

---

## 📦 Daten & Speicher

### Speichernutzung

```
┌─────────────────────────────────────────────────────────────────┐
│  📦 Speichernutzung                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Lokaler Speicher (localStorage):                               │
│  ████████████░░░░░░░░ 62% (3.1 MB von 5 MB)                     │
│                                                                 │
│  Aufschlüsselung:                                               │
│  ├── Boards & Karten: 2.4 MB                                    │
│  ├── Einstellungen: 0.1 MB                                      │
│  ├── Cache: 0.5 MB                                              │
│  └── Sonstiges: 0.1 MB                                          │
│                                                                 │
│  [🗑️ Cache leeren] [📥 Backup erstellen]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cache-Verwaltung

| Option | Beschreibung | Auswirkung |
|--------|--------------|------------|
| **Cache leeren** | Temporäre Daten löschen | Schnellere Ladezeiten nach Neuladen |
| **Alle lokalen Daten löschen** | Alles zurücksetzen | ⚠️ Alle nicht synchronisierten Daten gehen verloren! |

### Automatisches Backup

```
Automatisches Backup:
☑️ Aktiviert

Häufigkeit: [Wöchentlich ▼]

Speicherort: Downloads-Ordner

Letzte Sicherung: 25.01.2026, 16:00
```

---

## 🎯 Empfohlene Einstellungen

### Für Einsteiger

```
🎨 Theme: System (automatisch)
🔌 Relays: Standard (2 voreingestellt)
🤖 KI: Edufeed-API (falls verfügbar) oder OpenAI
🔔 Benachrichtigungen: Nur @Erwähnungen und Konflikte
📦 Auto-Backup: Wöchentlich
```

### Für Power-User

```
🎨 Theme: Nach Präferenz
🔌 Relays: 3-4 ausgewählte Relays
🤖 KI: GPT-4 oder lokales Modell
🔔 Benachrichtigungen: Alle aktiviert
📦 Auto-Backup: Täglich
```

### Für Schulen/Organisationen

```
🎨 Theme: Hell (für Beamer)
🔌 Relays: Schul-eigener Relay (falls vorhanden)
🤖 KI: Edufeed-API (datenschutzkonform)
🔔 Benachrichtigungen: Minimal
📦 Auto-Backup: Täglich + Cloud-Sync
```

---

## ⚠️ Häufige Probleme

### Problem: Einstellungen werden nicht gespeichert

**Mögliche Ursachen:**
1. Browser blockiert localStorage
2. Privater/Inkognito-Modus aktiv
3. Speicher voll

**Lösung:**
```
1. Prüfen: Normaler Browser-Modus?
2. Prüfen: Cookies/localStorage erlaubt?
3. Cache leeren und neu laden
```

### Problem: KI antwortet nicht

**Mögliche Ursachen:**
1. Ungültiger API-Key
2. API-Limit erreicht
3. Netzwerkproblem

**Lösung:**
```
1. API-Key mit [Testen] überprüfen
2. Bei OpenAI: Guthaben prüfen
3. Anderen Anbieter testen
```

### Problem: Relays verbinden nicht

**Mögliche Ursachen:**
1. Firewall blockiert WebSocket
2. Relay ist offline
3. Falsche URL

**Lösung:**
```
1. Anderen Relay versuchen
2. URL-Format prüfen (muss mit wss:// beginnen)
3. IT-Abteilung fragen (WebSocket freigeben)
```

---

## ✅ Checkliste: Das haben Sie gelernt

- [x] Theme und Farben anpassen
- [x] Relays verstehen und verwalten
- [x] KI-Assistent konfigurieren
- [x] Profil bearbeiten
- [x] Benachrichtigungen einstellen
- [x] Speicher und Cache verwalten
- [x] Automatische Backups einrichten

---

## 💡 Tipps

### Einstellungen sichern

Bevor Sie experimentieren:
1. Backup Ihrer aktuellen Einstellungen notieren
2. Änderungen einzeln testen
3. Bei Problemen: Cache leeren und neu starten

### Für Präsentationen

Schnelleinstellungen für Unterricht:
- **Theme:** Hell
- **Schriftgröße:** 120-140%
- **Kompakte Ansicht:** Aus
- **Benachrichtigungen:** Stumm

### Tastenkürzel

| Kürzel | Aktion |
|--------|--------|
| **Strg + ,** | Einstellungen öffnen |
| **Strg + Shift + D** | Dark/Light Mode wechseln |
| **F5** | Seite neu laden |
| **Strg + Shift + R** | Hard Refresh (Cache ignorieren) |

---

## ➡️ Weiterführende Ressourcen

| Thema | Link |
|-------|------|
| Alle Kapitel | [README](./README.md) |
| Technische Dokumentation | [docs/ARCHITECTURE/](../ARCHITECTURE/) |
| Feature-Details | [docs/FEATURE/](../FEATURE/) |
| Support & FAQ | [GitHub Issues](https://github.com/edufeed-org/kanban-editor/issues) |

---

## 🎉 Herzlichen Glückwunsch!

Sie haben das User Manual durchgearbeitet! Sie kennen jetzt:

- ✅ Die Grundlagen des Kanban-Boards
- ✅ Wie Sie Boards, Spalten und Karten verwalten
- ✅ Den KI-Assistenten effektiv nutzen
- ✅ OER-Materialien finden und einbinden
- ✅ Mit Kollegen zusammenarbeiten
- ✅ Ihre Daten sichern und exportieren
- ✅ Das Board an Ihre Bedürfnisse anpassen

### Nächste Schritte

1. **Erstes echtes Board erstellen** – Starten Sie ein Projekt!
2. **KI ausprobieren** – Lassen Sie sich bei der Planung helfen
3. **Kollegen einladen** – Testen Sie die Zusammenarbeit
4. **Feedback geben** – Helfen Sie uns, die App zu verbessern

---

**Viel Erfolg mit Ihrem KI-Kanban-Board!** 🚀

---

**Zeit:** ⏱️ ~10 Minuten  
**Zurück zur Übersicht:** [README](./README.md)
