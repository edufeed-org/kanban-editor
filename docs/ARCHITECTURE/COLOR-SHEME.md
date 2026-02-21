# FOERBICO Design System — Color Scheme & Typography

**Stand:** 2026-02-21
**Basis:** FOERBICO-Projekt Designvorgaben
**Status:** Phase 1 ✅ COMPLETE | Phase 2 PENDING

---

## Überblick

Das Kanban-Board verwendet das **FOERBICO Design System** als Grundlage für Farben und Typografie. Die Implementierung setzt auf die bestehende **shadcn-svelte** Architektur mit OKLCH CSS-Variablen — kein daisyUI.

### Architektur

```
FOERBICO Design Tokens
     ↓ (Mapping)
CSS Custom Properties (OKLCH)      src/app.css (:root / :root.dark)
     ↓ (Registration)
tailwind.config.js                 var(--xxx) Referenzen
     ↓ (Consumption via @config)
Tailwind Utilities                 bg-primary, text-foreground, etc.
     ↓ (Usage)
shadcn-svelte Components          Button, Card, Dialog, etc.
```

### Design-Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| CSS-Framework | shadcn-svelte (kein daisyUI) | Bestehende Architektur beibehalten |
| Farbformat | OKLCH | Perceptually uniform, moderne Browser-Unterstützung |
| Themes aktiv | `stil` (Light) + `stil-dark` (Dark) | Multi-Theme später möglich |
| Font | Roboto Condensed Variable | FOERBICO Corporate Font |
| Tailwind-Integration | `var()` direkt (kein `hsl()` Wrapper) | OKLCH ist nicht HSL-kompatibel |

---

## Implementierte Themes

### Theme: "stil" (Light) — `:root`

FOERBICO Hauptthema mit Terracotta-Primary.

| CSS-Variable | OKLCH-Wert | FOERBICO-Quelle | Visuell |
|---|---|---|---|
| `--background` | `oklch(100% 0 0)` | base-100 | Weiß |
| `--foreground` | `oklch(38% .02 250)` | base-content | Dunkles Blaugrau |
| `--card` | `oklch(97% 0 0)` | base-200 | Hellgrau |
| `--card-hover` | `oklch(94% 0 0)` | base-300 | Etwas dunkler |
| `--card-foreground` | `oklch(38% .02 250)` | base-content | Dunkles Blaugrau |
| `--popover` | `oklch(97% 0 0)` | base-200 | Hellgrau |
| `--popover-foreground` | `oklch(38% .02 250)` | base-content | Dunkles Blaugrau |
| `--primary` | `oklch(58% .19 35)` | primary | **Terracotta** |
| `--primary-foreground` | `oklch(100% 0 0)` | primary-content | Weiß |
| `--secondary` | `oklch(94% 0 0)` | base-300 | Hellgrau |
| `--secondary-foreground` | `oklch(38% .02 250)` | base-content | Dunkles Blaugrau |
| `--muted` | `oklch(94% 0 0)` | base-300 | Hellgrau |
| `--muted-foreground` | `oklch(55% .01 250)` | abgeleitet | Mittelgrau |
| `--accent` | `oklch(58% .19 35)` | accent (=primary) | Terracotta |
| `--accent-foreground` | `oklch(100% 0 0)` | accent-content | Weiß |
| `--destructive` | `oklch(65% .2 25)` | error | Rot-Orange |
| `--destructive-foreground` | `oklch(100% 0 0)` |  | Weiß |
| `--border` | `oklch(88% .005 250)` | abgeleitet | Helles Grau |
| `--input` | `oklch(91% 0 0)` | abgeleitet | Input-Hintergrund |
| `--ring` | `oklch(58% .19 35)` | primary | Terracotta |

### Theme: "stil-dark" (Dark) — `:root.dark`

| CSS-Variable | OKLCH-Wert | FOERBICO-Quelle | Visuell |
|---|---|---|---|
| `--background` | `oklch(22% .01 250)` | base-100 | Dunkles Blaugrau |
| `--foreground` | `oklch(90% 0 0)` | base-content | Helles Grau |
| `--card` | `oklch(18% .01 250)` | base-200 | Noch dunkler |
| `--card-hover` | `oklch(22% .01 250)` | base-100 | Leicht heller |
| `--primary` | `oklch(58% .19 35)` | primary | Terracotta (gleich) |
| `--secondary` | `oklch(50% .02 250)` | secondary | Mittelgrau |
| `--muted` | `oklch(30% .01 250)` | neutral | Dunkles Grau |
| `--muted-foreground` | `oklch(65% .01 250)` | abgeleitet | Mittelgrau |
| `--border` | `oklch(35% .01 250)` | abgeleitet | Dunkle Border |
| `--input` | `oklch(26% .01 250)` | abgeleitet | Dunkler Input |

Alle nicht aufgeführten Variablen: siehe `src/app.css` `:root.dark` Block.

### Semantische Status-Tokens

Zusätzlich zu den shadcn-Standard-Variablen werden drei Status-Token bereitgestellt:

| Token | Light-Wert | Dark-Wert | Verwendung |
|---|---|---|---|
| `--info` | `oklch(72% .11 230)` | `oklch(72% .11 230)` | Informationshinweise |
| `--info-foreground` | `oklch(100% 0 0)` | `oklch(15% 0 0)` | Text auf Info |
| `--success` | `oklch(72% .15 150)` | `oklch(72% .15 150)` | Erfolg-Anzeigen |
| `--success-foreground` | `oklch(100% 0 0)` | `oklch(15% 0 0)` | Text auf Success |
| `--warning` | `oklch(82% .17 85)` | `oklch(82% .17 85)` | Warnungen |
| `--warning-foreground` | `oklch(20% 0 0)` | `oklch(15% 0 0)` | Text auf Warning |

Diese sind in `tailwind.config.js` als echte Tailwind-Utilities registriert:

```css
/* Verfügbare Klassen: */
bg-info  text-info  border-info
bg-success  text-success  border-success
bg-warning  text-warning  border-warning
bg-info-foreground  text-info-foreground  /* etc. */
```

---

## Typografie

### Roboto Condensed Variable

| Eigenschaft | Wert |
|---|---|
| Font-Familie | `Roboto Condensed Variable` |
| Paket | `@fontsource-variable/roboto-condensed` |
| Gewichtsbereich | 100900 (Variable Font) |
| Import | `@import "@fontsource-variable/roboto-condensed"` in `app.css` |
| CSS | `font-family: 'Roboto Condensed Variable', ui-sans-serif, system-ui, sans-serif` |
| Tailwind | `fontFamily.sans` in `tailwind.config.js` |

### Nicht verwendet

- **Yanone Kaffeesatz** — bewusst ausgeschlossen (nur Roboto gewünscht)

---

## Vorgemerkte Themes (nicht implementiert)

Die folgenden Theme-Varianten aus dem FOERBICO-Projekt sind dokumentiert für zukünftige Multi-Theme-Unterstützung:

### Theme: "rpi" (Light)

| Rolle | OKLCH-Wert | Beschreibung |
|---|---|---|
| primary | `oklch(35% .16 264)` | Dunkles Blau |
| secondary | `oklch(79% .17 70)` | Warmes Gold |
| accent | `oklch(79% .17 70)` | = secondary |
| neutral | `oklch(30% .02 264)` | Dunkles Neutral |
| base-100 | `oklch(100% 0 0)` | Weiß |
| base-200 | `oklch(97% .005 264)` | Hellgrau |
| base-300 | `oklch(94% .01 264)` | Mittelgrau |
| base-content | `oklch(25% .02 264)` | Sehr dunkles Blau |

### Theme: "rpi-dark" (Dark)

| Rolle | OKLCH-Wert | Beschreibung |
|---|---|---|
| primary | `oklch(55% .16 264)` | Mittleres Blau |
| secondary | `oklch(79% .17 70)` | Warmes Gold |
| accent | `oklch(79% .17 70)` | = secondary |
| neutral | `oklch(30% .01 264)` | Dunkles Neutral |
| base-100 | `oklch(22% .02 264)` | Dunkler Hintergrund |
| base-200 | `oklch(18% .02 264)` | Noch dunkler |
| base-300 | `oklch(14% .02 264)` | Dunkelster Hintergrund |
| base-content | `oklch(90% 0 0)` | Helles Grau |

### Implementierung Multi-Theme (Zukunft)

Für Multi-Theme-Support wäre nötig:
1. Weitere `:root.rpi` / `:root.rpi-dark` Blöcke in `app.css`
2. Theme-Switcher in `settingsStore.svelte.ts` erweitern (aktuell: `'dark' | 'light' | 'system'`)
3. HTML-Klasse von `.dark`/`.light` auf `.stil`/`.stil-dark`/`.rpi`/`.rpi-dark` erweitern

---

## Technische Fixes

### Fix 1: HSL→var() Migration

Die `tailwind.config.js` verwendete `hsl(var(--xxx) / <alpha-value>)` Wrapper um die CSS-Variablen. Da die Variablen aber OKLCH-Werte enthalten, war das technisch falsch. Es funktionierte nur, weil `@layer utilities` Overrides in `app.css` die Tailwind-generierten Styles überschrieben.

```javascript
// Vorher (FALSCH):
primary: 'hsl(var(--primary) / <alpha-value>)',
// Nachher (KORREKT):
primary: 'var(--primary)',
```

### Fix 2: `@config` Direktive (KRITISCH!)

**Problem:** Tailwind CSS v4 mit `@tailwindcss/vite` lädt `tailwind.config.js` **NICHT automatisch**. Ohne explizite `@config`-Direktive werden keine Farb-Utilities aus der Config generiert.

**Symptom:** Dialoge, Popovers und Menüs hatten transparente Hintergründe. Im Build-CSS waren `.bg-popover`, `.bg-background` etc. nicht vorhanden (nur 1 `background-color` Regel in 91KB CSS).

**Fix in `src/app.css`:**

```css
@import "tailwindcss";
@config "../tailwind.config.js";  /* ← DIESE ZEILE IST PFLICHT! */
@import "tw-animate-css";
```

**Ergebnis:** CSS-Output wuchs von 91KB → 129KB. 196 `background-color` Regeln statt 1.

### Fix 3: `@custom-variant dark`

**Problem:** Die Zeile `@custom-variant dark (&:is(.dark *));` war auskommentiert. 60 Komponenten verwenden den `dark:` Tailwind-Prefix.

**Fix in `src/app.css`:**

```css
@custom-variant dark (&:is(.dark *));
```

**Ergebnis:** 79 `dark:` Klassen werden jetzt korrekt im CSS generiert.

### Zusammenfassung: app.css Header-Struktur

```css
@import "tailwindcss";
@config "../tailwind.config.js";
@import "tw-animate-css";
@import "@fontsource-variable/roboto-condensed";
@custom-variant dark (&:is(.dark *));
```

Diese Reihenfolge ist **kritisch** — `@config` muss direkt nach `@import "tailwindcss"` stehen.

---

## Kritische Hardcoded-Farben (Phase 1 gefixt)

| Datei | Problem | Fix |
|---|---|---|
| `CardSidebar.svelte` | 7 Hex-Farben im Style-Block, Dark Mode komplett broken | → CSS-Variablen |
| `Board.svelte` | Scrollbar mit Hex-Farben | → `var(--muted)`, `var(--foreground)` |
| `MarkdownEditor.svelte` | Placeholder `#adb5bd` | → `var(--muted-foreground)` |

---

## Card-Color-Picker

Die 6 Farben für den Card-Color-Picker sind **bewusst nicht an das FOERBICO-Schema gebunden** und bleiben eigenständig:

```css
--color-slate:  oklch(88.734% 0.02327 285.861 / 0.945);
--color-blue:   oklch(36.012% 0.24863 264.466);
--color-green:  #5bd337;
--color-orange: oklch(76.57% 0.15684 77.795);
--color-red:    oklch(0.704 0.191 22.216);
--color-purple: oklch(0.541 0.281 293.009);
```

---

## Phase 2: Ausstehende Arbeiten

### Komponenten-Farb-Migration (~70+ Literal-Farben)

Tailwind-Literal-Farben in ~15 Komponenten sollen auf die neuen semantischen Tokens migriert werden:

| Aktuell | Ziel |
|---|---|
| `bg-green-50/text-green-700` | `bg-success/10`, `text-success` |
| `bg-red-50/text-red-700` | `bg-destructive/10`, `text-destructive` |
| `bg-amber-50/text-amber-700` | `bg-warning/10`, `text-warning` |
| `bg-blue-50/text-blue-700` | `bg-info/10`, `text-info` |

### Avatar-Farbpalette konsolidieren

3x duplizierte Palette → Single Source of Truth in `avatar/index.ts`.

### bg-white → bg-background

Betrifft: `ProfileEditor.svelte`, `ShareDialog.svelte`.

---

## Dateien-Referenz

| Datei | Rolle |
|---|---|
| `src/app.css` | CSS-Variablen, Font-Import, Base-Styles |
| `tailwind.config.js` | Farb-/Font-Registration für Tailwind-Utilities |
| `src/lib/stores/settingsStore.svelte.ts` | Theme-Switching |
| `package.json` | `@fontsource-variable/roboto-condensed` Dependency |
