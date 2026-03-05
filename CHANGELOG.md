# Changelog

Diese Datei ist die kompakte Stakeholder-Ansicht.

- Fokus: Nutzen, Wirkung, Risiko, noetige Aktionen
- Umfang: Unreleased + aktuelle Releases
- Vollstaendige Historie: docs/CHANGELOG/archive-legacy-2026-02-20.md

## Unreleased

- UI & Layout: Neues Farbschema `Shine` hinzugefuegt (RPI-Overlay). In den Einstellungen ist `Shine` jetzt unter `Farbschema` waehlbar; Theme-Klassen setzen `rpi + shine` (inkl. Dark-Variante `:root.rpi.dark.shine`).
- OER-ImagePicker: Plugin-Import bleibt verpflichtend; TypeScript-Kompatibilitaet fuer Web-Component `bind:this` wurde durch angepasste lokale Typen und Modul-Deklaration stabilisiert.
- Boards-Liste (Light): Board-Kacheln nutzen jetzt denselben sehr hellen Hintergrund wie die Board-Flaeche (`--board-bg`), Dark Mode bleibt bei `--card`.
- Test-Runner (Windows): `test:e2e` ruft das Shell-Skript jetzt explizit ueber `bash` auf; zusaetzlich wurden Zeilenenden des Skripts auf LF normalisiert.
- DX/Editor: VS-Code CSS-`unknownAtRules` Warnungen fuer Tailwind-v4 Direktiven (`@config`, `@custom-variant`) im Workspace unterdrueckt.
- Boards-Liste (A11y): Status-/Aktions-Icons sind jetzt immer sichtbar und als kleine, rechts angepinnte Kreis-Badges umgesetzt; der Inhaltsbereich der Board-Kachel wurde rechts reduziert.
- UI Light Mode: Cards nutzen jetzt einen weissen Hintergrund, der Board-Hintergrund ist auf ein sehr helles Grau angepasst.
- UI Karten: Karten-Schatten wurde verstaerkt und auf feste RGBA-Werte umgestellt; Schattenfall ist jetzt konsistent nach rechts/unten (Light und Dark).
- Navigation: Klick auf das Sidebar-Logo `Kanban-Editor` leitet jetzt auf die Basis-URL der App (`base`) weiter.
 - UI Tiefenwirkung: Rechte Sidebar (Desktop) erhielt einen rechten Kanten-Schatten, Topbar einen unteren Schatten fuer klarere Layer-Trennung im Board-Layout.
- AMB Publishing: `a`-Tag im Kind-30142 Event nutzt jetzt das kanonische Address-Format `30301:<pubkey>:<d-tag>` (optional mit Relay-Hint) statt `naddr`, damit Referenzen NIP-konform und robuster aufloesbar sind.
- AMB Publishing: Optionaler `r`-Tag mit oeffentlicher Board-Web-URL (naddr-Pfad) wird zu Snapshot- und AMB-Events hinzugefuegt; lokale/private Origins (`localhost`, private IP-Ranges) werden dabei automatisch ausgeschlossen.
- Sidebar-Branding: App-Name `Kanban-Editor` mit periodischem Accent-Shine (links→rechts) und statischem Gradient-Finish (light: foreground→accent, dark: foreground→accent) in `cardsboard` Layout.
- AI Panel: Bei LLM-Kontaktfehlern wird in der Chat-Nachricht ein CTA `Einstellungen pruefen` angezeigt, der direkt den Dialog `LLM Einstellungen` (Tab `llm`) oeffnet.
- AI Panel: CTA `Einstellungen pruefen` greift jetzt auch bei weiteren LLM-Fehlertypen (`LLM API Error`, Netzwerk-/Fetch-Fehler, `LLM nicht konfiguriert`) und wird zusaetzlich im Summary-Fehlerblock angezeigt.
- Nostr Publishing: Toast-Warnung `Keine privaten Relays konfiguriert` enthaelt jetzt den CTA `Einstellungen pruefen`, der direkt den Dialog `Nostr Relay Einstellungen` oeffnet.

## Releases 2026 — PRs (kompakt)

| Datum | PR | Was | Details |
|---|---|---|---|
| 2026-02-21 | [#123](https://github.com/edufeed-org/kanban-editor/pull/123) | FOERBICO Design System: 4 OKLCH-Themes, Farbschema-Wechsel, A11y Dark-Mode, Lucide Icons | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |

## Direkt Pushes 2026 (kompakt)

| Datum | Was | Details |
|---|---|---|
| 2026-02-23 | Bugfix: Karten-Reihenfolge inkonsistent zwischen Browsern (rank-Sortierung), Board-Import Fix, Kurzlink-Resolver Cache, ShareDialog Publish-Guard | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |
| 2026-02-21 | FOERBICO Design System: Farbschema (OKLCH), Roboto Condensed Font, Tailwind v4 `@config` Fix, Dark-Mode Fix | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |
| 2026-02-21 | Kurzlink-Feature (PR #122): Dezentraler URL-Shortener via Nostr Kind 30491 (ShareDialog, /b/[slug] Route) | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |
| 2026-02-21 | Automatische Gespraechs-Zusammenfassung (LLM + lokaler Fallback) | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |
| 2026-02-21 | LLM Proxy 400-Fehler behoben (tool_choice, Umlaute, Retry) | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |
| 2026-02-20 | Paste-System: Editable-Target Guard | [2026-Q1.md](docs/CHANGELOG/2026-Q1.md) |

## Releases 2026 (kompakt)

| Version | Datum | Was ist neu? | Business Impact | Action Required |
|---|---|---|---|---|
| Post-4.7.96 (PR #123) | 2026-02-21 | FOERBICO Design System: 4 OKLCH-Themes, Farbschema-Wechsel, A11y Dark-Mode Kontrast, Lucide Icons | Konsistenteres visuelles Erscheinungsbild, bessere Zugaenglichkeit im Dark Mode | Nein |
| Post-4.7.96 (PR #121) | 2026-02-20 | Security-Guards fuer Column-Patch- und Card-Events (nur Owner/Maintainer autorisiert) | Hoehere Integritaet bei kollaborativen Events | Nein |
| Post-4.7.96 (PR #120) | 2026-02-20 | OER-Finder auf Local Search umgestellt | Schnellere und robustere OER-Bildsuche | Nein |
| Post-4.7.96 (PR #119) | 2026-02-19 | Shared-Board-Sync Fixes (owner-signierte Events, updatedAt, Maintainer-Resubscribe) | Deutlich stabilerer Shared-Board-Betrieb | Nein |
| Post-4.7.96 (PR #118) | 2026-02-19 | Permalink/Follow fuer Fremd-Boards, neuer `cardsboard`-Layout-Flow, bessere Lade-Guards | Bessere Discovery und weniger Reload-/Auto-Switch-Probleme | Nein |
| Post-4.7.96 (Direct) | 2026-02-19 bis 2026-02-20 | Rollenlogik (Owner/Editor/Viewer), Save-CTA, Request-Write-Flow, invalid pubkey fix, Theme-Race-Condition Fix | Klarere Rechtefluesse und weniger UX-Irritationen | Nein |
| Post-4.7.96 (PR #112) | 2026-02-11 | Docker Image Publishing Workflow ergaenzt | Bessere CI/CD und Deploy-Pipeline | Optional fuer Self-Hosting |
| Post-4.7.96 (PR #108) | 2026-02-06 | OIDC Session-/Logout- und Token-Endpoint Fixes | Stabilere Auth-Session und weniger Token-Last | Nein |
| 4.7.96 | 2026-02-05 | Footer-Menue neu sortiert | Klarere Navigation | Nein |
| 4.7.95-4.7.71 | 2026-02-04 | Sync/AI Stabilisierung (Delete/Tombstones, Publish-Guards, Column/Card-Patches) | Hohe Stabilitaetsverbesserung in kurzer Sprint-Phase | Nein |
| 4.7.70-4.7.62 | 2026-02-03 | Mobile/UI Polishing und Svelte-5 Fixes | Sichtbar bessere Usability auf Mobile | Nein |
| 4.7.61-4.7.30 | 2026-02-02 | Communikey- und Sharing-Verbesserungen, Editor-Request-Flows | Zuverlaessigere Kollaboration und Rollenlogik | Nein |
| 4.7.29-4.7.26 | 2026-02-01 | Shared-Board Sichtbarkeit und ShareDialog-Performance | Stabilerer Einstieg in Shared-Workflows | Nein |
| 4.7.25 | 2026-01-31 | Inline-Editing und Mobile UX | Schnellere Bearbeitung im Board | Nein |
| 4.7.24 | 2026-01-30 | OER-Suche (Multi-Source + Bildungsstufe) | Bessere Trefferqualitaet bei Materialsuche | Nein |
| 4.7.23 | 2026-01-29 | Edufeed Publishing auf oeffentlichen Relays | Reichweite fuer veroeffentlichte Inhalte erhoeht | Nein |
| 4.7.22-4.7.19 | 2026-01-26 | Paste-/Import-Flow fuer Nostr-Links + SSR-Link-Fix | Weniger Reibung beim Erfassen externer Inhalte | Nein |

## Releases 2025 (kompakt)

| Version | Datum | Was ist neu? | Business Impact | Action Required |
|---|---|---|---|---|
| 4.7.18 | 2025-12-16 | Reload-Fix fuer Shared Boards (Editor) | Stabilere Kollaboration im Alltag | Nein |
| 4.7.0 | 2025-12-03 | Board Snapshots / Versionshistorie | Nachvollziehbarkeit und Restore verbessert | Nein |
| 4.6.1 | 2025-11-20 | Demo-Board Migration Fix | Zuverlaessiger Start fuer neue Nutzer | Nein |
| 4.5.0 | 2025-11-13 | Kaskadierende Loeschung | Konsistentere Daten bei Delete-Prozessen | Nein |
| 4.4.0 | 2025-11-10 | Nostr Sync Sprint abgeschlossen | Deutlich stabilere Sync-Basis | Nein |
| 4.3.0 | 2025-11-09 | Metadata-System Elimination (Breaking) | Vereinfachte Architektur, weniger Fehlerquellen | Ja (Migration) |
| 4.2.0 | 2025-11-09 | Echo-Loop Prevention & Cross-Browser Sync Fix | Weniger Duplikate, stabilerer Multi-Client-Betrieb | Nein |
| 4.1.0 | 2025-11-09 | localStorage Consolidation | Robustere Persistenz und Recovery | Nein |
| 4.0.0 | 2025-11-06 | AI Agent & ChatBot Infrastruktur | Grundlage fuer KI-gestuetzte Workflows | Nein |
| 3.6.0 | 2025-10-31 | Import/Export Feature abgeschlossen | Bessere Portabilitaet der Boards | Nein |
| 3.5.0 | 2025-10-31 | Share-Link Feature | Einfacheres Teilen von Boards | Nein |
| 3.4.0 | 2025-10-30 | UI/Theme Standardisierung | Konsistentere Bedienung und Designbasis | Nein |
| 3.3.0 | 2025-10-29 | Card UI Redesign (Phase 1) | Verbesserte Nutzerfuehrung im Board | Nein |
| 3.2.0 | 2025-10-29 | Documentation Governance v3.0 | Verlaesslichere Code- und Doku-Qualitaet | Nein |
| 3.1.0 | 2025-10-23 | Author Field Attribution | Klarere Ownership- und Sync-Logik | Nein |
| 3.0.0 | 2025-10-23 | Kommentare-Branch konsolidiert | Basis fuer kollaborative Kommunikation | Nein |
| 2.0.0 | 2025-10-17 | AGENTS.md Erweiterungen | Technische Leitplanken fuer Umsetzung | Nein |

## Fruehere Meilensteine

| Version | Kernfortschritt |
|---|---|
| 4.7.0 | Board Snapshots / Versionshistorie |
| 4.6.0 | Demo-Board System fuer anonyme Nutzer |
| 4.5.0 | Kaskadierende Loeschung |
| 4.4.0 | Nostr Sync Sprint abgeschlossen |
| 4.0.0 | AI Agent und ChatBot Infrastruktur (Foundation) |
| 3.6.0 | Import/Export Feature abgeschlossen |

## Detail-Historie

- Vollstaendige Legacy-Historie: docs/CHANGELOG/archive-legacy-2026-02-20.md
- Quartalsuebersicht 2026 Q1: docs/CHANGELOG/2026-Q1.md
- Quartalsuebersicht 2025 Q4: docs/CHANGELOG/2025-Q4.md
- Quartalsuebersicht 2024 Q4: docs/CHANGELOG/2024-Q4.md
- Changelog-Navigation: docs/CHANGELOG/README.md
- Technische Deep-Dives bleiben in den jeweiligen Architektur- und Feature-Dokumenten unter docs/.
