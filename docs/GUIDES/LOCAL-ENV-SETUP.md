# Lokale Secrets & Env Setup (Windows / PowerShell)

**Ziel:** Lokale Secrets (z.B. `GITHUB_TOKEN`) repo-lokal verwalten, ohne globale System-Umgebungsvariablen zu setzen, und ohne Secrets zu committen.

---

## I. Übersicht

In diesem Repo wird `.env.local` genutzt, um Secrets nur lokal zu halten.

- `.env.local` ist per `.gitignore` ausgeschlossen (soll nicht committed werden)
- Die Scripts unter `scripts/` laden `.env.local` in die aktuelle PowerShell-Session

---

## II. Quick Start

1) Lege/editiere `.env.local` im Repo-Root:

```dotenv
GITHUB_TOKEN=... # kein Whitespace um '='
```

2) Variante A (empfohlen): Kommando direkt mit Env ausführen

```powershell
.\scripts\run-with-env.ps1 pnpm install
.\scripts\run-with-env.ps1 pnpm dev
```

3) Variante B: Env in aktuelles Terminal laden (dot-sourcing)

```powershell
. .\scripts\load-env.ps1
pnpm dev
```

---

## III. Details

### Welche Scripts gibt es?

- `scripts/load-env.ps1`
  - Liest `.env.local` (Default) und setzt `Env:KEY` in der aktuellen Session.
  - Unterstützt Kommentare/Leerzeilen sowie optionale Anführungszeichen.

- `scripts/run-with-env.ps1`
  - Ruft `load-env.ps1` auf und führt anschließend dein Kommando aus.
  - Beispiel: `./scripts/run-with-env.ps1 pnpm check`

### Warum ist das GH-Pages/CI-freundlich?

Diese Lösung ist **nur** für lokale Development-Workflows gedacht:
- Secrets bleiben lokal (`.env.local` wird nicht committed)
- GH Pages Builds sollten **keine** privaten Tokens benötigen (sonst ist der Deploy nicht reproduzierbar)

---

## IV. Fehlerbehebung

- **"Usage: ./scripts/run-with-env.ps1 <command> [args...]"**
  - Du hast kein Kommando übergeben.

- **Variable scheint nicht gesetzt**
  - Nutze bei Variante B unbedingt dot-sourcing: `. .\scripts\load-env.ps1`
  - Prüfen: `Get-ChildItem Env:GITHUB_TOKEN`

- **Token aus Versehen geteilt/geleakt**
  - Token in GitHub rotieren/revoken und einen neuen Token erstellen.

---

## V. Referenzen

- Dokumentations-Governance: [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md)
