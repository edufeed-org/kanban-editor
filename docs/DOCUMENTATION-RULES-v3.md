# 📚 Dokumentations-Governance v3.0 (BIDIREKTIONAL)

**Version:** 3.0  
**Datum:** 29. Oktober 2025  
**Status:** 🔴 **MANDATORY** - Code ↔ Docs Sync ERFORDERLICH!

---

## 🎯 Kernprinzip: Code ↔ Docs Bidirektionale Synchronisation

**NEUE REGEL (v3.0):** Dokumentation ist nicht optional, sondern **Akzeptanzkriterium**!

```
CODE-ÄNDERUNG → Dokumentation MUSS aktualisiert werden
                 ↓
          DoD Checklist MUSS erfüllt sein
                 ↓
          Ohne Docs-Update → KEIN Merge!

DOKUMENTATIONS-UPDATE → Code MUSS aktualisiert werden
                         ↓
                   Veraltete Patterns identifizieren
                         ↓
                   Refactoring oder Archivierung
```

**Impact:**
- ✅ Dokumentation ist immer aktuell (keine veralteten Docs mehr)
- ✅ Code-Änderungen sind nachvollziehbar (ROADMAP, CHANGELOG, TESTSUITE/STATUS)
- ✅ Archiv-Prozess ist automatisch (alte Docs werden nicht vergessen)
- ✅ Neue Features haben Specs BEVOR Code geschrieben wird

---

## Die 7 Goldenen Regeln (erweitert von 5 → 7)

### 🔴 RULE #1: `/docs/` ist die SOURCE OF TRUTH

**Unverändert von v2.0** - Siehe DOCUMENTATION-RULES-v2.md

---

### 🔴 RULE #2: EIN THEMA = EIN DOKUMENT

**Unverändert von v2.0** - Siehe DOCUMENTATION-RULES-v2.md

---

### 🟡 RULE #3: STRUKTUR jedes Dokuments

**Unverändert von v2.0** - Siehe DOCUMENTATION-RULES-v2.md

---

### 🟢 RULE #4: Neue Docs in `/docs/_INDEX.md` verlinken

**Unverändert von v2.0** - Siehe DOCUMENTATION-RULES-v2.md

---

### 🟢 RULE #5: Ordner-Struktur

**Unverändert von v2.0** - Siehe DOCUMENTATION-RULES-v2.md

---

### 🔴 RULE #6: Code → Docs Synchronisation (NEU v3.0)

**Bei JEDER Code-Änderung MUSS die Dokumentation aktualisiert werden!**

#### 6.1 Definition of Done (DoD) für Code-Änderungen

**KEINE Code-Änderung ist "Done" ohne Dokumentations-Update:**

```markdown
## DoD Checklist für Code-Änderungen

### 📝 Dokumentations-Updates (MANDATORY)

- [ ] 1. **ROADMAP.md** aktualisiert?
      - [ ] Meilenstein-Status geändert? (🔄 → ✅ oder 🟡 → 🔄)
      - [ ] Acceptance Criteria abgehakt?
      - [ ] Versionshistorie-Eintrag hinzugefügt?
      - [ ] Timeline angepasst (wenn Verzögerung)?
      
- [ ] 2. **TESTSUITE/STATUS.md** aktualisiert?
      - [ ] Neue Tests hinzugefügt? → Test-Kategorien-Tabelle updaten
      - [ ] Tests entfernt? → Kategorien-Count anpassen
      - [ ] Metriken aktualisiert? (Coverage, Performance, etc.)
      - [ ] Datum & Version aktualisiert
      
- [ ] 3. **CHANGELOG.md** Eintrag erstellt?
      - [ ] Feature-Beschreibung hinzugefügt
      - [ ] Breaking Changes dokumentiert?
      - [ ] Migration-Guide verlinkt (falls nötig)
      - [ ] **2-Layer-Regel eingehalten?** (siehe unten)

#### 6.1.1 CHANGELOG 2-Layer-Architektur (MANDATORY)

**Das CHANGELOG folgt einer strikten 2-Layer-Trennung:**

| Layer | Datei | Inhalt | Zielgruppe |
|-------|-------|--------|------------|
| **1 — Kompakt** | `CHANGELOG.md` (Root) | `## Unreleased` (temporaer), `## Direkt Pushes` (Datum + Einzeiler + Link), `## Releases` (Tabelle) | Stakeholder, Schnellueberblick |
| **2 — Detail** | `docs/CHANGELOG/YYYY-QN.md` | Volle Beschreibungen, PR-Details, betroffene Bereiche, Commit-Listen, Audit-Daten | Entwickler, Audit, Nachvollziehbarkeit |

**Workflow:**
```
1. Neue Aenderung → CHANGELOG.md ## Unreleased (Kurzbeschreibung)
2. Zeitnah konsolidieren → Volle Beschreibung in docs/CHANGELOG/YYYY-QN.md
3. Root-CHANGELOG.md bereinigen:
   - Unreleased leeren
   - Eintrag in "Direkt Pushes" Tabelle: | Datum | Einzeiler | Link auf QN.md |
4. Einzeldateien (z.B. 2026-02-post-4.7.96.md) → in Quartals-Datei zusammenfuehren
   + Deprecation-Notice in der alten Datei setzen
```

**Regeln:**
- ✅ Root-CHANGELOG.md NIEMALS laenger als ~80 Zeilen (Stakeholder-Ansicht)
- ✅ Volle Beschreibung nur an EINER Stelle (Quartals-Datei)
- ✅ Keine Duplikation zwischen Root und Detail
- ✅ Quartals-Dateien benennen: `YYYY-QN.md` (z.B. `2026-Q1.md`)
- ✅ Konsolidierte Einzeldateien bekommen Deprecation-Hinweis am Anfang
      
- [ ] 4. **Feature-spezifische Docs** aktualisiert?
      - [ ] `docs/FEATURE/[FEATURE].md` existiert?
      - [ ] Code-Beispiele sind aktuell?
      - [ ] API-Änderungen dokumentiert?
      
- [ ] 5. **ARCHITECTURE/** Docs angepasst?
      - [ ] Store-Änderungen? → `STORES/*.md` updaten
      - [ ] Neue Komponenten? → `AUTH-UI-COMPONENTS.md` oder neue Datei
      - [ ] Pattern-Änderungen? → `REACTIVITY.md` anpassen
      
- [ ] 6. **_INDEX.md** Navigation aktualisiert?
      - [ ] Neue Docs verlinkt?
      - [ ] Datei-Count angepasst?
      - [ ] Learning Paths aktualisiert?
      
- [ ] 7. **Veraltete Docs archiviert?**
      - [ ] Alte Patterns ersetzt? → Archive mit MIGRATION-NOTICE
      - [ ] Deprecated Features? → Docs archivieren + Notice

### 🧪 Test-Updates (MANDATORY)

- [ ] 8. **Tests geschrieben/aktualisiert?**
      - [ ] Unit Tests für neue Features
      - [ ] Integration Tests für Workflows
      - [ ] E2E Tests für User-Journeys
      - [ ] `testSuite.ts` erweitert?
      
- [ ] 9. **Test-Dokumentation aktualisiert?**
      - [ ] `TESTSUITE/STATUS.md` Test-Count updated
      - [ ] Neue Test-Kategorien dokumentiert
      - [ ] Coverage-Metriken aktualisiert

### 📊 Projektmanagement-Updates (MANDATORY)

- [ ] 10. **ROADMAP.md Status-Update**
       - [ ] Phase-Status aktualisiert (PLANNED → IN PROGRESS → DONE)
       - [ ] Timeline verschoben? → Neue Deadline dokumentieren
       - [ ] Dependencies geändert? → Blocker-Section updaten
       
- [ ] 11. **Git Commit Message korrekt?**
       - [ ] Format: `type(scope): description`
       - [ ] Referenziert ROADMAP Meilenstein
       - [ ] Listet alle Docs-Updates auf
```

#### 6.2 Beispiel: Feature-Implementation mit Docs-Sync

**Scenario:** Neue Feature "Paste-System" wird implementiert

```markdown
## SCHRITT 1: Spec schreiben (BEFORE Coding!)

1. Erstelle `docs/FEATURE/PASTE-SYSTEM.md` mit:
   - I.   Übersicht (Was ist Paste-System? Warum brauchen wir es?)
   - II.  Quick Start (Beispiel-Code)
   - III. API-Spezifikation (Interfaces, Methoden)
   - IV.  Acceptance Criteria (Was muss funktionieren?)
   - V.   Referenzen (ROADMAP, ARCHITECTURE docs)

2. Update `ROADMAP.md`:
   - [ ] Neuen Meilenstein hinzufügen: "1.6: Paste-System Implementation"
   - [ ] Timeline eintragen: Start 01.11., End 05.11. (4 Tage)
   - [ ] Acceptance Criteria aus `FEATURE/PASTE-SYSTEM.md` kopieren
   - [ ] Dependencies dokumentieren (abhängig von Phase 1.5B)

3. Update `_INDEX.md`:
   - Verlinke `FEATURE/PASTE-SYSTEM.md` in Navigation
   - Füge zu "Nach Thema" Tabelle hinzu
   - Update Learning Path für Frontend Devs
   
## SCHRITT 2: Code schreiben

4. Implementiere Paste-System in `src/lib/paste/`
   - `pasteHandler.ts` - Core-Logik
   - `pasteTypes.ts` - TypeScript Interfaces
   - Integration in `BoardStore` und `Card.svelte`

5. Schreibe Tests in `testSuite.ts`:
   - Neue Sektion: "10. Paste System Tests"
   - Mindestens 5 Tests (Plain Text, Markdown, URL, Image, Multiple)

## SCHRITT 3: Dokumentation synchronisieren

6. Update `TESTSUITE/STATUS.md`:
   - Test-Kategorien-Tabelle erweitern (+1 Kategorie)
   - Total Tests: 35 → 40 (+5)
   - Metriken aktualisieren (Coverage erhöht sich)
   - Datum: 29.10.2025 → 05.11.2025
   - Version: 2.0 → 2.1

7. Update `ROADMAP.md`:
   - Meilenstein 1.6 Status: 🟡 PLANNED → 🔄 IN PROGRESS → ✅ DONE
   - Acceptance Criteria abhaken (alle ✅)
   - Versionshistorie-Eintrag:
     ```
     | 2.5 | 05.11.2025 | ✅ Paste-System implementiert! (+5 Tests, +4 docs) |
     ```
   - Timeline anpassen falls nötig

8. Update `CHANGELOG.md`:
   ```markdown
   ## [Unreleased]
   ### Added
   - **Paste-System** (Meilenstein 1.6) - Intelligent paste handling für Cards
     - Plain Text, Markdown, URLs, Images unterstützt
     - Auto-Detection von Paste-Content-Type
     - Siehe [PASTE-SYSTEM.md](./docs/FEATURE/PASTE-SYSTEM.md)
   ```

9. Commit mit vollständiger Docs-Liste:
   ```bash
   git add src/ docs/
   git commit -m "feat(paste): Implement intelligent paste system (Meilenstein 1.6)
   
   Implementation:
   - Add pasteHandler.ts with type detection
   - Add pasteTypes.ts interfaces
   - Integrate into BoardStore and Card.svelte
   - Add 5 comprehensive tests
   
   Documentation:
   - Create FEATURE/PASTE-SYSTEM.md (full spec)
   - Update ROADMAP.md (Meilenstein 1.6 DONE, v2.5)
   - Update TESTSUITE/STATUS.md (+5 tests, v2.1)
   - Update CHANGELOG.md (Paste-System entry)
   - Update _INDEX.md (navigation + file count)
   
   Tests: All 40 tests passing ✅
   Coverage: 85% → 87% (+2%)
   
   Closes: ROADMAP Meilenstein 1.6
   Refs: docs/FEATURE/PASTE-SYSTEM.md"
   ```
```

#### 6.3 Automatisierte Prüfung (CI/CD Integration - TODO Phase 5)

**Pre-Commit Hook Template:**

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 Dokumentations-Governance v3.0 Check..."

# REGEL #6: Code → Docs Synchronisation

# Check 1: Code-Änderungen erkannt?
CHANGED_CODE=$(git diff --cached --name-only | grep -E "src/.*\.(ts|svelte)$")

if [ -n "$CHANGED_CODE" ]; then
    echo "📝 Code-Änderungen erkannt:"
    echo "$CHANGED_CODE"
    
    # Check 1.1: ROADMAP.md aktualisiert?
    ROADMAP_CHANGED=$(git diff --cached --name-only | grep "ROADMAP.md")
    if [ -z "$ROADMAP_CHANGED" ]; then
        echo "❌ FEHLER: Code geändert, aber ROADMAP.md nicht aktualisiert!"
        echo "   → Bitte Meilenstein-Status in docs/COLLABORATION/ROADMAP.md updaten"
        exit 1
    fi
    
    # Check 1.2: TESTSUITE/STATUS.md bei Test-Änderungen?
    TEST_CHANGED=$(git diff --cached --name-only | grep "testSuite.ts")
    STATUS_CHANGED=$(git diff --cached --name-only | grep "TESTSUITE/STATUS.md")
    
    if [ -n "$TEST_CHANGED" ] && [ -z "$STATUS_CHANGED" ]; then
        echo "❌ FEHLER: testSuite.ts geändert, aber STATUS.md nicht aktualisiert!"
        echo "   → Bitte docs/TESTSUITE/STATUS.md updaten (Test-Count, Kategorien)"
        exit 1
    fi
    
    # Check 1.3: CHANGELOG.md bei Features?
    FEATURE_ADDED=$(git diff --cached --name-only | grep -E "src/lib/.*" | head -n 1)
    CHANGELOG_CHANGED=$(git diff --cached --name-only | grep "CHANGELOG.md")
    
    if [ -n "$FEATURE_ADDED" ] && [ -z "$CHANGELOG_CHANGED" ]; then
        echo "⚠️  WARNUNG: Neue Dateien in src/lib/, aber CHANGELOG.md nicht aktualisiert!"
        echo "   → Empfehlung: CHANGELOG.md Entry hinzufügen"
    fi
    
    echo "✅ Dokumentations-Sync-Check bestanden!"
fi

# Check 2: Dokumentations-Änderungen ohne Code?
CHANGED_DOCS=$(git diff --cached --name-only | grep -E "docs/.*\.md$")
if [ -n "$CHANGED_DOCS" ] && [ -z "$CHANGED_CODE" ]; then
    echo "📚 Reine Dokumentations-Änderungen erkannt"
    
    # Check 2.1: Wurden Docs archiviert?
    ARCHIVED=$(git diff --cached --name-only | grep "archive/")
    if [ -n "$ARCHIVED" ]; then
        # Check: Migration-Notice vorhanden?
        MIGRATION_NOTICE=$(git diff --cached --name-only | grep "MIGRATION-NOTICE")
        if [ -z "$MIGRATION_NOTICE" ]; then
            echo "⚠️  WARNUNG: Docs archiviert, aber keine MIGRATION-NOTICE!"
            echo "   → Empfehlung: MIGRATION-NOTICE erstellen"
        fi
    fi
    
    echo "✅ Dokumentations-Änderung OK"
fi

echo "🎉 Alle Checks bestanden!"
exit 0
```

---

### 🔴 RULE #7: Docs → Code Synchronisation (NEU v3.0)

**Bei JEDEM Dokumentations-Update MUSS Code-Konsistenz geprüft werden!**

#### 7.1 Dokumentations-Audit-Prozess

**Wenn Dokumentation aktualisiert wird, prüfe:**

```markdown
## Dokumentations-Audit Checklist

### 📄 Wurde Dokumentation OHNE Code-Änderung aktualisiert?

- [ ] 1. **Veraltet der existierende Code?**
      - [ ] Beschreibt Doku neue Patterns, die noch nicht implementiert sind?
      - [ ] Sind alte Code-Beispiele in der Doku vorhanden?
      - [ ] Werden deprecated Features noch dokumentiert?
      
- [ ] 2. **Muss Code refactored werden?**
      - [ ] Neue Best Practices in Docs → Code anpassen?
      - [ ] Architektur-Änderungen dokumentiert → Code migrieren?
      - [ ] Performance-Optimierungen beschrieben → Code optimieren?
      
- [ ] 3. **Muss ROADMAP.md aktualisiert werden?**
      - [ ] Neue Feature-Specs hinzugefügt → Meilenstein hinzufügen?
      - [ ] Acceptance Criteria geändert → ROADMAP anpassen?
      - [ ] Timeline-Impact? → Deadlines adjustieren?
      
- [ ] 4. **Veraltete Dokumentation archivieren?**
      - [ ] Alte Patterns durch neue ersetzt?
      - [ ] Migration-Notice erstellen
      - [ ] Git mv zu `archive/` mit Timestamp
      
- [ ] 5. **Tests aktualisieren?**
      - [ ] Neue API-Contracts dokumentiert → Tests schreiben
      - [ ] Edge Cases beschrieben → Test-Cases hinzufügen
      - [ ] TESTSUITE/STATUS.md anpassen
```

#### 7.2 Archivierungs-Prozess

**Wenn Dokumentation veraltet ist:**

```bash
# SCHRITT 1: Archive erstellen
git mv docs/ARCHITECTURE/OLD-DOC.md docs/archive/OLD-DOC-$(date +%Y%m%d).md

# SCHRITT 2: Migration-Notice erstellen
cat > docs/archive/MIGRATION-NOTICE-OLD-DOC.md << 'EOF'
# Migration Notice: OLD-DOC.md → NEW-DOC.md

**Archiviert:** 29.10.2025  
**Grund:** Durch [NEW-DOC.md](../ARCHITECTURE/NEW-DOC.md) ersetzt  
**Impact:** Alle Referenzen zu OLD-DOC müssen auf NEW-DOC zeigen

## Mapping

| Alt (OLD-DOC.md) | Neu (NEW-DOC.md) |
|------------------|------------------|
| Section A | → Section 1 |
| Section B | → Section 2.1 |
| API X | → Deprecated (siehe CHANGELOG) |

## Migration-Guide für Entwickler

1. Update alle Imports: `import X from 'old'` → `import X from 'new'`
2. API-Änderungen: `oldMethod()` → `newMethod()`
3. Teste mit: `pnpm run test`

## Veraltet seit

Version: X.Y  
Deprecated seit: 29.10.2025  
Wird entfernt in: Version X+1.Y
EOF

# SCHRITT 3: _INDEX.md aktualisieren
# - Entferne alte Links
# - Füge neue Links hinzu
# - Update File-Count

# SCHRITT 4: Alle Cross-References aktualisieren
grep -r "OLD-DOC.md" docs/ --exclude-dir=archive
# → Ersetze alle Vorkommen mit NEW-DOC.md

# SCHRITT 5: ROADMAP.md updaten
# - Archivierungs-Eintrag in Versionshistorie
# - Falls Meilenstein betroffen: Status anpassen

# SCHRITT 6: Commit
git add docs/ archive/
git commit -m "docs: Archive OLD-DOC.md, replace with NEW-DOC.md

- Archive OLD-DOC.md → archive/OLD-DOC-20251029.md
- Create MIGRATION-NOTICE-OLD-DOC.md
- Update all cross-references to NEW-DOC.md
- Update _INDEX.md (file count, navigation)
- Update ROADMAP.md (documentation milestone)

Reason: Consolidated documentation following DOCUMENTATION-RULES.md Rule #2"
```

#### 7.3 Regelmäßige Dokumentations-Reviews

**Quartalsweise Dokumentations-Audits:**

```markdown
## Dokumentations-Review Q1 2026

**Datum:** 01.01.2026  
**Reviewer:** [Name]  
**Status:** 🔄 IN PROGRESS

### Audit-Checkliste

- [ ] 1. **Alle Docs in `/docs/`?**
      - [ ] Keine Root-Level Docs (außer README, LICENSE)
      - [ ] Keine Archive-Leichen in `/archive/` (> 1 Jahr alt)
      
- [ ] 2. **Fragmentierung geprüft?**
      - [ ] Keine 5+ Dateien zum gleichen Thema
      - [ ] Konsolidierungs-Kandidaten identifiziert
      
- [ ] 3. **Veraltete Docs archiviert?**
      - [ ] Deprecated Features dokumentiert → Archive
      - [ ] Migration-Notices vorhanden
      
- [ ] 4. **Code-Konsistenz geprüft?**
      - [ ] Code-Beispiele in Docs funktionieren
      - [ ] API-Dokumentation entspricht aktuellem Code
      - [ ] Keine toten Links zu nicht-existierenden Dateien
      
- [ ] 5. **ROADMAP.md aktuell?**
      - [ ] Alle Meilensteine haben Status (🟡/🔄/✅)
      - [ ] Timeline ist realistisch
      - [ ] Acceptance Criteria sind messbar
      
- [ ] 6. **TESTSUITE/STATUS.md aktuell?**
      - [ ] Test-Count stimmt mit testSuite.ts überein
      - [ ] Metriken sind aktuell (Coverage, Performance)
      - [ ] Datum ist < 1 Woche alt
      
- [ ] 7. **_INDEX.md Navigation funktioniert?**
      - [ ] Alle Links funktionieren (keine 404s)
      - [ ] File-Count ist korrekt
      - [ ] Learning Paths sind aktuell

### Findings & Actions

| Finding | Severity | Action | Assignee | Due |
|---------|----------|--------|----------|-----|
| 3 Docs zu Store-Architektur | 🟡 Medium | Konsolidieren zu STORES.md | [Name] | 15.01. |
| ROADMAP.md Timeline veraltet | 🔴 High | Timeline adjustieren | [Name] | 05.01. |
| 5 tote Links in _INDEX.md | 🟠 High | Links fixen | [Name] | 03.01. |

### Approval

- [ ] Review completed
- [ ] Actions assigned
- [ ] ROADMAP.md updated with audit results
- [ ] Next review scheduled: 01.04.2026
```

---

## 📋 ERWEITERTE CHECKLIST: Neue Dokumentation (v3.0)

**Erweitert um Code-Sync-Schritte:**

```markdown
Neue Dokumentation hinzufügen?

### Phase 1: Planung (BEFORE Writing)

- [ ] 1. Thema definieren: "Worum geht es?"
- [ ] 2. Ordner wählen: ARCHITECTURE? GUIDES? FEATURE? COLLABORATION?
- [ ] 3. Dateiname: NUR EINES pro Datei! (nicht 5 Splits)
- [ ] 4. Code-Impact prüfen:
      - [ ] Muss existierender Code geändert werden?
      - [ ] Ist das eine neue Feature-Spec? → ROADMAP Meilenstein hinzufügen!
      - [ ] Braucht es neue Tests? → TESTSUITE/STATUS.md vorbereiten

### Phase 2: Schreiben

- [ ] 5. 5-Abschnitt-Struktur verwenden:
      - [ ] I. Übersicht
      - [ ] II. Quick Start
      - [ ] III. Details
      - [ ] IV. Fehler
      - [ ] V. Referenzen
      
- [ ] 6. Code-Beispiele testen:
      - [ ] Alle Code-Snippets funktionieren
      - [ ] Copy-Paste-ready (keine Platzhalter)
      
- [ ] 7. Cross-References setzen:
      - [ ] Links zu verwandten Docs
      - [ ] ROADMAP Meilenstein verlinkt (falls Feature-Spec)

### Phase 3: Integration

- [ ] 8. In docs/_INDEX.md verlinken:
      - [ ] "Nach Rolle" Abschnitte
      - [ ] "Nach Thema" Tabelle
      - [ ] "Schnelle Links"
      - [ ] File-Count aktualisieren
      
- [ ] 9. Timestamp hinzufügen: "✅ Neu (29.10.)"

- [ ] 10. ROADMAP.md aktualisieren (falls Feature-Spec):
       - [ ] Neuen Meilenstein hinzufügen
       - [ ] Timeline eintragen
       - [ ] Acceptance Criteria aus Spec kopieren
       - [ ] Versionshistorie-Eintrag

### Phase 4: Code-Sync (falls nötig)

- [ ] 11. Code implementieren (falls neue Feature-Spec):
       - [ ] Folge Spec aus docs/FEATURE/X.md
       - [ ] Tests schreiben (min 3-5)
       - [ ] TESTSUITE/STATUS.md updaten
       
- [ ] 12. Existierenden Code refactoren (falls Architektur-Änderung):
       - [ ] Alte Patterns durch neue ersetzen
       - [ ] Tests anpassen
       - [ ] Alte Docs archivieren mit Migration-Notice

### Phase 5: Quality Check

- [ ] 13. Quality Check:
       - [ ] Kann ein neuer Entwickler diese Datei verstehen?
       - [ ] Ist der Quick Start verständlich?
       - [ ] Sind Code-Beispiele Copy-Paste-ready?
       - [ ] Alle Links funktionieren?
       
- [ ] 14. Verlinkungs-Check:
       - [ ] Keine defekten Links in _INDEX.md
       - [ ] Cross-References funktionieren
       - [ ] ROADMAP-Links funktionieren

### Phase 6: Commit

- [ ] 15. Commit mit vollständiger Docs-Liste:
       ```bash
       git add docs/ src/
       git commit -m "docs(feat): Add X documentation + implementation
       
       Documentation:
       - Create FEATURE/X.md (full spec)
       - Update _INDEX.md (navigation, file count)
       - Update ROADMAP.md (new milestone X.Y)
       
       Implementation (if applicable):
       - Add X implementation (src/lib/...)
       - Add X tests (+5 tests in testSuite.ts)
       - Update TESTSUITE/STATUS.md (v2.1)
       
       Closes: ROADMAP Meilenstein X.Y"
       ```
```

---

## 🚨 ENFORCEMENT & COMPLIANCE

### Compliance-Levels

**🔴 CRITICAL (MUSS):**
- ROADMAP.md Status-Update bei Code-Änderungen
- TESTSUITE/STATUS.md bei Test-Änderungen
- CHANGELOG.md bei Features/Breaking Changes
- Migration-Notices bei Archivierung

**🟠 HIGH (SOLLTE):**
- Feature-Specs BEVOR Code geschrieben wird
- _INDEX.md Navigation aktuell halten
- Cross-References in verwandten Docs

**🟡 MEDIUM (EMPFOHLEN):**
- Quartalsweise Dokumentations-Reviews
- Code-Beispiele in Docs testen
- Dead-Link Checks

### Violations & Konsequenzen

| Violation | Severity | Konsequenz |
|-----------|----------|------------|
| Code merged ohne ROADMAP.md Update | 🔴 CRITICAL | PR wird zurückgewiesen |
| Tests added ohne STATUS.md Update | 🔴 CRITICAL | PR wird zurückgewiesen |
| Feature ohne Spec dokumentiert | 🟠 HIGH | PR braucht Docs-Review |
| Veraltete Docs nicht archiviert | 🟡 MEDIUM | Technical Debt Issue erstellen |
| Dead Links in _INDEX.md | 🟠 HIGH | Fix innerhalb 48h |

### Pre-Merge Checklist (für Reviewer)

```markdown
## PR Review: Dokumentations-Compliance v3.0

**PR:** #XXX  
**Reviewer:** [Name]  
**Datum:** 29.10.2025

### Code-Änderungen

- [ ] Wurden Code-Dateien geändert? (src/*.ts, src/*.svelte)
      → JA: Weiter zu Docs-Check
      → NEIN: Skip Docs-Check

### Docs-Check (MANDATORY wenn Code geändert)

- [ ] 1. ROADMAP.md aktualisiert?
      - [ ] Meilenstein-Status geändert?
      - [ ] Acceptance Criteria abgehakt?
      - [ ] Versionshistorie-Eintrag?
      
- [ ] 2. TESTSUITE/STATUS.md aktualisiert (falls Tests geändert)?
      - [ ] Test-Count korrekt?
      - [ ] Kategorien-Tabelle aktualisiert?
      - [ ] Datum aktualisiert?
      
- [ ] 3. CHANGELOG.md Eintrag vorhanden (falls Feature)?
      - [ ] Feature beschrieben?
      - [ ] Breaking Changes dokumentiert?
      
- [ ] 4. Feature-Docs vorhanden (falls neue Feature)?
      - [ ] docs/FEATURE/X.md existiert?
      - [ ] Spec vollständig?
      - [ ] Code-Beispiele funktionieren?
      
- [ ] 5. _INDEX.md aktualisiert (falls neue Docs)?
      - [ ] Navigation verlinkt?
      - [ ] File-Count korrekt?

### Approval

- [ ] Alle Checks bestanden
- [ ] Dokumentation ist vollständig
- [ ] Code + Docs sind synchron
- [ ] PR kann gemerged werden

**Reviewer Signature:** [Name] - 29.10.2025
```

---

## 📊 Metriken & KPIs

**Dokumentations-Qualität messen:**

### KPI 1: Dokumentations-Sync-Rate

```
Sync-Rate = (Code-Commits mit Docs-Update) / (Total Code-Commits) * 100%

Ziel: > 95%
Aktuell: TBD (nach v3.0 Einführung)
```

### KPI 2: Veraltete Dokumentation

```
Veraltete Docs = Docs mit Code-Beispielen, die nicht funktionieren

Ziel: 0
Aktuell: TBD
```

### KPI 3: Archivierungs-Lag

```
Archiv-Lag = Tage zwischen "deprecated" und "archiviert"

Ziel: < 7 Tage
Aktuell: TBD
```

### KPI 4: Dead Links

```
Dead Links = Links in _INDEX.md zu nicht-existierenden Dateien

Ziel: 0
Aktuell: 0 (nach 29.10.2025 Update)
```

### KPI 5: Test-Dokumentation-Sync

```
Test-Sync = (testSuite.ts Test-Count) == (STATUS.md Test-Count)

Ziel: 100% Übereinstimmung
Aktuell: 100% (35 Tests beide)
```

---

## 🔄 Migration von v2.0 → v3.0

**Schritte für bestehende Projekte:**

```markdown
## Migration Plan: DOCUMENTATION-RULES v2.0 → v3.0

### 1. Bewusstsein schaffen

- [ ] Team-Meeting: Vorstellen der neuen Regeln
- [ ] DOCUMENTATION-RULES-v3.md lesen
- [ ] DoD Checklist in PR-Template integrieren

### 2. Tooling einrichten

- [ ] Pre-Commit Hook installieren (siehe 6.3)
- [ ] CI/CD Pipeline erweitern (siehe ROADMAP Phase 5)
- [ ] GitHub PR Template mit Docs-Checklist

### 3. Backlog aufräumen

- [ ] Audit: Welche Docs sind veraltet? → Archivieren
- [ ] Audit: Welche Code-Änderungen haben keine Docs? → Nachholen
- [ ] Audit: ROADMAP.md vollständig? → Status-Updates
- [ ] Audit: TESTSUITE/STATUS.md aktuell? → Test-Count prüfen

### 4. Prozess etablieren

- [ ] Erste Woche: Manuelle Reviews mit v3.0 Checklist
- [ ] Zweite Woche: Pre-Commit Hook aktivieren
- [ ] Dritte Woche: Automatisierte PR-Checks (CI/CD)
- [ ] Vierte Woche: Retrospektive & Anpassungen

### 5. Metriken tracken

- [ ] Baseline messen: Wie viele Docs sind aktuell?
- [ ] Wöchentlich: Sync-Rate, Dead Links, Archiv-Lag
- [ ] Monatlich: Review-Meeting mit Team
```

---

## 📞 Support & Fragen

**Bei Fragen zu Dokumentations-Governance:**

1. **Lies zuerst:** `DOCUMENTATION-RULES-v3.md` (diese Datei)
2. **Checkliste nutzen:** DoD Checklist (Section 6.1)
3. **Beispiele anschauen:** Paste-System Example (Section 6.2)
4. **Team fragen:** Slack #docs-governance
5. **Issue erstellen:** GitHub Issues mit Label "documentation"

---

## 📝 Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 3.0 | 29.10.2025 | 🔴 **BREAKING:** Bidirektionale Code ↔ Docs Sync MANDATORY! Neue Regeln #6 & #7, DoD Checklist, Pre-Commit Hooks, Metriken |
| 2.0 | 25.10.2025 | Regeln #1-5 etabliert, ONE Topic = ONE Document |
| 1.0 | 17.10.2025 | Initial Governance-Regeln |

---

**Nächste Überprüfung:** 01.01.2026 (Q1 Review)  
**Verantwortlich:** AI Agents + Team Lead  
**Status:** 🔴 **ACTIVE** - MANDATORY Compliance ab 29.10.2025
