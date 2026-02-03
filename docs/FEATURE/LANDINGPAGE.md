# Landingpage (Kanban Board)

## I. Übersicht

Die Landingpage unter `src/routes/+page.svelte` präsentiert das KI-gestützte Kanban-Board für Lehrkräfte. Die Seite nutzt shadcn-svelte Komponenten, Lucide Icons und ist vollständig theme-aware (Light/Dark) über die globalen CSS-Variablen in `src/app.css`.

Ziele:
- Klarer Einstieg mit CTA (erstes Board starten)
- Sichtbarkeit für Open-Source, Dokumentation und Edufeed
- Fokus auf Lehrkräfte und kollaborative Unterrichtsplanung (siehe `KONZEPT.md`)
- Interesse an KI-Optionen und dem Agent-Tooling wecken (siehe `docs/ARCHITECTURE/AGENT/README.md`)

## II. Quick Start

1. Landingpage bearbeiten: `src/routes/+page.svelte`
2. Theme-Logik prüfen: `src/routes/+layout.svelte` (Theme Sync über `settingsStore.applyTheme()`)
3. Lokale Vorschau starten:
   - `pnpm run dev`
4. Inhalte prüfen:
   - Header-Links (GitHub, Dokumentation, Edufeed)
   - CTA-Buttons (Board starten, Dokumentation)
   - Light/Dark Modus (System/Settings)

## III. Details

### Layout-Struktur
- **Header**: Edufeed-Logo, Produktname, Links zu GitHub/Docs/Edufeed (mit Lucide Icons)
- **Hero**: Value Proposition, **glowy CTA**, Status-Badges, Steps-Panel, Förderhinweis
- **Steps Panel**: 3-Schritte-Start mit Icon-Karten
- **Feature Cards**: KI-Tooling, Nostr/Offline, didaktischer Workflow
- **Lehrkräfte-Fokus**: Nutzen-Argumente aus `KONZEPT.md`
- **KI-Optionen**: Tool-Actions (add/update/move/delete/etc.) + Link zur Agent-Dokumentation
- **Finaler CTA**: „Board starten“

### Design & Theme
- Komponenten: `Button`, `Badge`, `Card` (shadcn-svelte)
- Icons: Lucide (`@lucide/svelte`)
- Farben/Theme: Klassen wie `bg-background`, `text-foreground`, `text-muted-foreground` (aus `src/app.css`)
- Keine hardcodierten Farben, damit Dark/Light Modus automatisch greift

### CTA / Glow
- Der primäre CTA nutzt die Klasse `landing-cta` (Glow/“glue effect” via `box-shadow` + `::before`-Glow).
- Wichtig: Die Styles sind als `:global(.landing-...)` definiert, weil Klassen an shadcn-Komponenten weitergereicht werden und sonst als „unused“ erkannt werden.

### Inhalte (Kernbotschaften)
- Open-Source & dezentral (Nostr Events)
- KI-gestützte Board-Aktionen via Tool-System
- Speziell für Lehrkräfte und Unterrichtsplanung konzipiert
- Förderhinweis: OER Strategie des BMBG

## IV. Fehler / Edge Cases

- Externe Links/Assets sind nicht erreichbar → Seite bleibt funktionsfähig, nur Logo/Links fehlen.
- Falls die Dokumentation verschoben wird, muss der Link in der Landingpage aktualisiert werden.
- Bei fehlender Dark/Light Umschaltung: Prüfen, ob `settingsStore.applyTheme()` in `+layout.svelte` läuft.

## V. Referenzen

- `KONZEPT.md` (Zielgruppe Lehrkräfte, Use Cases)
- `docs/ARCHITECTURE/AGENT/README.md` (KI-Tooling & Aktionen)
- `docs/ARCHITECTURE/UX-RULES.md` (UI-Komponenten & Konventionen)
- `docs/COLLABORATION/ROADMAP.md` (Projekt-Kontext)
- `src/app.css` (Theme-Variablen)
- `src/routes/+layout.svelte` (Theme-Sync)
