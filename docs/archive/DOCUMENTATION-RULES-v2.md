# 📚 Dokumentations-Regeln (GOVERNANCE)

**Letztes Update:** 25. Oktober 2025  
**Status:** AKTIVE REGELN - KEINE Ausnahmen!

---

## Die 5 Goldenen Regeln

### 🔴 RULE #1: `/docs/` ist die SOURCE OF TRUTH

**ALLE Dokumentation gehört in `/docs/` — KEINE Ausnahmen!**

```
❌ Falsch:
   archive/my-doc.md
   root/my-feature-guide.md
   src/docs/something.md
   
✅ Richtig:
   docs/ARCHITECTURE/my-doc.md
   docs/GUIDES/my-feature-guide.md
   docs/FEATURE/something.md
```

**Warum?**
- Zentrale Verwaltung
- Einfache Navigation via `/docs/_INDEX.md`
- Tools können mit einheitlicher Struktur rechnen

---

### 🔴 RULE #2: EIN THEMA = EIN DOKUMENT

**Keine Fragmentierung!**

```
❌ FALSCH (Chaos):
   docs/STORES-BASICS.md
   docs/STORES-QUICKSTART.md
   docs/STORES-IMPLEMENTATION.md
   docs/STORES-API-REFERENCE.md
   docs/STORES-FAQ.md
   docs/STORES-TROUBLESHOOTING.md
   (Entwickler muss 6 Dateien lesen!)

✅ RICHTIG (Fokussiert):
   docs/ARCHITECTURE/STORES.md
   (Enthält: Basics + Quickstart + Implementation + API + FAQ + Troubleshooting)
```

**Vorteile:**
- 📖 Alles zum Thema an EINEM Ort
- 🔗 Einfach zu verlinken (`docs/ARCHITECTURE/STORES.md`)
- 🧠 Schneller zu verstehen (keine Fragmentierung)
- 🎯 Zielgerichtet (nicht 6 dispersive Dateien)

---

### 🟡 RULE #3: STRUKTUR jedes Dokuments

**Jedes Dokument sollte diese 5 Abschnitte haben:**

```markdown
# THEMA

## I. Übersicht (30 Sekunden)
- Was ist das?
- Wer braucht das?
- Warum?

## II. Quick Start (5 Minuten)
- Hello World
- Häufigster Use Case
- Copy-Paste Beispiel

## III. Detaillierte Dokumentation
- Vollständige API
- Alle Optionen
- Edge Cases

## IV. Häufige Fehler (FAQ & Debugging)
- Die top 3 Fehler
- Wie man sie erkennt
- Wie man sie fixt

## V. Referenzen & Cross-Links
- Verwandte Dokumentation
- External Resources
- Best Practices Links
```

**Warum diese Struktur?**
- ✅ Neue Devs können in 5 min anfangen
- ✅ Details sind verfügbar, wenn nötig
- ✅ Häufige Fehler sind schnell greifbar
- ✅ Verlinkte Docs helfen kontextuell

---

### 🟢 RULE #4: Neue Docs in `/docs/_INDEX.md` verlinken

**Wenn du ein neues Dokument erstellst:**

1. **Erstelle die Datei** in passender Kategorie:
   - Technische Konzepte? → `docs/ARCHITECTURE/`
   - Schritt-für-Schritt? → `docs/GUIDES/`
   - Feature-Dokumentation? → `docs/FEATURE/`
   - Organisatorisch? → `docs/COLLABORATION/`

2. **Öffne `/docs/_INDEX.md`**

3. **Füge einen Link hinzu:**
   ```markdown
   | [`MY-TOPIC.md`](./ARCHITECTURE/MY-TOPIC.md) | Beschreibung | ✅ Neu (25.10.) |
   ```

4. **Update auch die Navigation:**
   - Bei "Nach Rolle" → relevante Rollen hinzufügen
   - Bei "Nach Thema" → passende Kategorie aktualisieren

**Beispiel:**

```markdown
# docs/_INDEX.md

## Nach Rolle

### 👨‍💻 Frontend Developer

1. **Core Spec:** [`AGENTS.md`](../AGENTS.md)
2. **State Management:** [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md)
3. **🆕 Neue Feature:** [`GUIDES/MY-TOPIC.md`](./GUIDES/MY-TOPIC.md)  ← ADD THIS

## Nach Thema

### 🏗️ Architektur & Design

| [`MY-TOPIC.md`](./GUIDES/MY-TOPIC.md) | Beschreibung | 30 min |  ← ADD THIS

## Schnelle Links

- Feature-Guide: [`GUIDES/MY-TOPIC.md`](./GUIDES/MY-TOPIC.md) ← ADD THIS
```

---

### 🟢 RULE #5: Ordner-Struktur

**Verwende diese Struktur IMMER:**

```
docs/
├── _INDEX.md                    ← Zentrale Navigation (MUSS aktualisiert werden!)
│
├── ARCHITECTURE/                ← Technische Konzepte & Patterns
│   ├── STORES.md               
│   ├── REACTIVITY.md           
│   ├── NDK.md                  
│   └── ... (weitere technische Topics)
│
├── GUIDES/                      ← How-to & Schritt-für-Schritt
│   ├── QUICK-START.md          
│   ├── Kanban-NIP.md          
│   └── ... (weitere Guides)
│
├── FEATURE/                     ← Feature-spezifische Dokumentation
│   ├── COMMENTS.md            
│   └── ... (weitere Features)
│
├── COLLABORATION/              ← Organisatorisches & Roadmap
│   ├── ROADMAP.md             
│   ├── CONTRIBUTING.md        
│   └── ... (weitere Collaboration Topics)
│
├── TESTSUITE/                  ← Test-Dokumentation
│   ├── INDEX.md               
│   ├── GUIDE.md              
│   └── ... (weitere Test Docs)
│
└── DOCUMENTATION-RULES.md       ← DIESE DATEI
```

**KEINE neuen Top-Level Ordner ohne gute Begründung!**

---

## 📋 CHECKLIST: Neue Dokumentation

```markdown
Neue Dokumentation hinzufügen?

- [ ] 1. Thema definieren: "Worum geht es?"
- [ ] 2. Ordner wählen: ARCHITECTURE? GUIDES? FEATURE? COLLABORATION?
- [ ] 3. Dateiname: NUR EINES pro Datei! (nicht 5 Splits)
- [ ] 4. 5-Abschnitt-Struktur: I. Übersicht, II. Quick Start, III. Details, IV. Fehler, V. Referenzen
- [ ] 5. In docs/_INDEX.md verlinken
      - [ ] In "Nach Rolle" Abschnitte eintragen (welche Rollen brauchen das?)
      - [ ] In "Nach Thema" Tabelle eintragen (Datei, Zweck, Umfang)
      - [ ] In "Schnelle Links" Abschnitt eintragen
- [ ] 6. Timestamp hinzufügen: "✅ Neu (25.10.)"
- [ ] 7. Cross-References überprüfen
      - [ ] Müssen andere Docs darauf verlinken?
      - [ ] Sind alle Links richtig? (nicht zu nicht-existierende Dateien)
- [ ] 8. Quality Check
      - [ ] Kann ein neuer Entwickler diese Datei verstehen?
      - [ ] Ist der Quick Start verständlich?
      - [ ] Sind Code-Beispiele Copy-Paste-ready?
- [ ] 9. Verlinkungs-Check
      - [ ] Keine defekten Links in _INDEX.md
      - [ ] Alle Verlinkungen funktionieren (lokal testen)
- [ ] 10. Commit
      ```bash
      git add docs/
      git commit -m "docs: Add THEMA documentation"
      ```
```

---

## 🚫 HÄUFIGE FEHLER & FIXES

| Fehler | Problem | Lösung |
|--------|---------|--------|
| **Docs nicht in /docs/** | Verloren, nicht zentralisiert | Nach `/docs/ARCHITECTURE/` etc. verschieben |
| **5+ Dateien für 1 Thema** | Unübersichtlich, Fragmentation | In 1 Datei zusammenfassen |
| **Nicht in `_INDEX.md`** | Unsichtbar, niemand findet es | In `/docs/_INDEX.md` eintragen (alle 3 Abschnitte!) |
| **Keine Struktur** | Schwer zu lesen, chaotisch | I-V Struktur: Übersicht, Quick Start, Details, Fehler, Refs |
| **Zu ausschweifend** | Entwickler liest nur erste 2 Absätze | **Zielgerichtet!** Quick Start FIRST, dann Details |
| **Keine Cross-Links** | Wissen-Fragmente | Immer auf verwandte Docs verlinken! |
| **Alte Docs löschen, neue Sektion?** | Broken Links, Verwirrung | IMMER alte Docs aktualisieren statt neu schreiben |
| **Copy-Paste Beispiele falsch** | Entwickler kann nicht reproduzieren | Code testen vor Dokumentation schreiben! |

---

## ✅ BEISPIEL: Neue Doc erstellen (Schritt für Schritt)

**Scenario:** Du möchtest Dokumentation für eine neue Feature "X-Feature" schreiben.

### Schritt 1: Thema definieren
```
❓ Worum geht es?
   "X-Feature ist eine neue Funktionalität zur Verwaltung von..."
   
❓ Wer braucht das?
   Frontend Devs + Nostr Devs
   
❓ Komplexität?
   Mittel → gehört zu docs/GUIDES/
```

### Schritt 2: Datei erstellen
```bash
# DATEI ERSTELLEN
touch docs/GUIDES/X-FEATURE.md

# Struktur:
# I.   Übersicht (Was ist X-Feature? 30 sec)
# II.  Quick Start (Hello World, 5 min)
# III. Detaillierte Dokumentation (vollständige API)
# IV.  Häufige Fehler (FAQ)
# V.   Referenzen (Cross-Links)
```

### Schritt 3: In _INDEX.md verlinken
```markdown
# docs/_INDEX.md

## Nach Rolle

### 👨‍💻 Frontend Developer
8. **🆕 X-Feature:** [`GUIDES/X-FEATURE.md`](./GUIDES/X-FEATURE.md)

### 🌐 Nostr Developer
7. **🆕 X-Feature:** [`GUIDES/X-FEATURE.md`](./GUIDES/X-FEATURE.md)

## Nach Thema

### 🔧 Integration & Technologie

| [`X-FEATURE.md`](./GUIDES/X-FEATURE.md) | New Feature X | 20 min | ✅ Neu (25.10.) |

## Schnelle Links

- Feature-Guide: [`GUIDES/X-FEATURE.md`](./GUIDES/X-FEATURE.md)
```

### Schritt 4: Commit
```bash
git add docs/
git commit -m "docs: Add X-Feature documentation"
```

---

## 🔗 Zentralisierte Verwaltung

**Alle Dokumentations-Regeln sind hier:**
- `copilot-instructions.md` → Regel #0-5 (für AI Agents)
- `AGENTS.md` → Kurze Zusammenfassung
- `/docs/DOCUMENTATION-RULES.md` → **DIESE DATEI** (vollständig)
- `/docs/_INDEX.md` → Navigation & Links

**Wenn eine Regel ändert:**
- Update ALLE vier Dateien!
- Commit message: "docs: Update documentation governance rules"

---

## 📊 Audit & Compliance

**Um die Dokumentations-Regeln zu prüfen:**

```bash
# Check: Sind alle Docs in /docs/?
ls -la archive/*.md root/*.md  # Sollte LEER sein!

# Check: Nicht zu viele verwandte Docs?
ls docs/ARCHITECTURE/ | grep -i "STORES\|STORES" | wc -l  # Max 1 pro Thema!

# Check: Sind alle Docs in _INDEX.md verlinkt?
grep -c "\.md" docs/_INDEX.md  # Sollte >= 30 sein
```

---

## ✅ Status & Compliance

**Aktuelle Dokumentation (25.10.2025):**

- ✅ 30/30 Dateien in `/docs/` (keine Stragglers)
- ✅ 1 Datei pro Thema (keine Fragmentierung)
- ✅ Alle in `/docs/_INDEX.md` verlinkt
- ✅ 5-Abschnitt-Struktur in 80% der Docs
- 🟡 Fehler-Abschnitte (IV) noch nicht in allen Docs
- 🟡 Cross-Links könnten besser sein

**Nächste Verbesserungen:**
1. Fehler-Abschnitte (IV) ergänzen in den übrigen Docs
2. Cross-Links verbessern (aktuell: ~60%, Ziel: 100%)

---

**Letzte Aktualisierung:** 25. Oktober 2025  
**Nächste Überprüfung:** Mit jedem Release  
**Verantwortlich:** AI Agents + Entwickler
