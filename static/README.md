# Static Assets

Dieser Ordner enthält **statische Dateien**, die **direkt unter `/`** verfügbar sind.

## 📄 Wichtige Dateien

### `config.json`
**Kanban Board Konfiguration** - wird von `settingsStore` beim App-Start geladen.

- **Speicherort im Browser:** `/config.json`
- **Zweck:** UI-Einstellungen, Nostr Relays, LLM-Config, Defaults
- **Wird gecacht in:** localStorage (`kanban-config`)

**⚠️ WICHTIG:** 
- Diese Datei MUSS in `static/` bleiben (nicht `public/`)!
- SvelteKit kopiert `static/` → `build/` beim Build
- Vite serviert `static/` direkt unter `/` im Dev-Mode

### `config.example.json`
Beispiel-Konfiguration als Vorlage. Kopiere zu `config.json` zum Anpassen.

## 🔧 Weitere statische Assets

- `favicon.svg` - App-Icon

---

**Dokumentation:** Siehe `docs/ARCHITECTURE/SETTINGSSTORE.md` für Details zur Config-Integration.
