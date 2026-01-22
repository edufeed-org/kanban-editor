# ⚙️ Settings UI Component

**Status**: ✅ **Implementiert & Integriert** (04.11.2025)  
**Updated**: Dezember 2025 - Learning System entfernt

## 📋 Übersicht

Die zentrale Settings-UI verwaltet **alle** App-Konfigurationen in einem einzigen Dialog:

- **UI/UX Settings** (Theme, Layout, Scrolling)
- **🤖 LLM Configuration** (Model, API Keys, System Prompt)
- **📡 Nostr Relays** (Public & Private)
- **🎯 Board Defaults** (Spalten, Publish States)

## 🎯 Single Source of Truth

```
config.json (static file)
    ↓ loadAndCacheConfig()
localStorage (cached)
    ↓ mergeConfigIntoSettings()
SettingsStore ($state reactive)
    ↓ User edits via UI
Settings UI Component
```

## 🔧 Implementation

### Datei-Struktur

```
src/lib/components/settings/
  └── SettingsPanel.svelte         ← Zentrale UI (Tabs)

src/lib/stores/
  └── settingsStore.svelte.ts      ← State Management + Persistierung

static/
  ├── config.json                  ← Single Source of Truth
  └── config.example.json          ← Template für neue Installationen
```

### Integration in Topbar

```svelte
<!-- src/routes/cardsboard/Topbar.svelte -->
<Dialog.Root>
  <Dialog.Trigger>
    <Button variant="ghost" size="icon">
      <SlidersHorizontalIcon class="h-4 w-4" />
    </Button>
  </Dialog.Trigger>
  <Dialog.Content class="max-w-5xl">
    <SettingsPanel />
  </Dialog.Content>
</Dialog.Root>
```

## 📊 Settings Store API

### Getter/Setter Pattern

```typescript
// In SettingsStore.svelte.ts
public setTheme(value: string): void
public setMaxCardsBeforeScroll(value: number): void
public setDefaultColumnWidth(value: number): void
// ... etc.
```

### Validierung

Alle numerischen Setter haben **automatische Validierung**:

```typescript
setMaxCardsBeforeScroll(value: number): void {
  if (value < 1) {
    console.warn('Invalid value (must be >= 1):', value);
    return;
  }
  // ... speichern
}
```

## 🎨 UI-Features

### Auto-Save

Alle Änderungen werden **sofort gespeichert** (kein "Save"-Button nötig):

```typescript
// Jeder Setter ruft automatisch auf:
this.saveToStorage();
```

### Reset-Funktion

Button "Alle Einstellungen zurücksetzen":

```typescript
function handleReset() {
  if (confirm('Wirklich alle Einstellungen zurücksetzen?')) {
    settingsStore.reset();  // Lädt config.json Defaults
    // Sync local state mit store
  }
}
```

### Responsive Design

- **Desktop**: Tabs horizontal angeordnet
- **Mobile**: Tabs vertical, scrollbar für Overflow
- **Max Width**: 4xl (1280px)

## ✅ Testing Checklist

### Manual Tests

- [ ] **UI/UX Tab**
  - [ ] Theme-Switch funktioniert (default, dark, auto)
  - [ ] Max Cards Slider aktualisiert Wert
  - [ ] Column Width Slider funktioniert
  - [ ] Sidebar-Toggles funktionieren
  
- [ ] **LLM Tab**
  - [ ] Model Name Input funktioniert
  - [ ] Base URL Input funktioniert
  - [ ] API Key Input (Password Field) funktioniert
  - [ ] System Prompt Textarea funktioniert
  
- [ ] **Nostr Tab**
  - [ ] Public Relays Textarea (multi-line)
  - [ ] Private Relays Textarea (multi-line)
  
- [ ] **Defaults Tab**
  - [ ] Default Columns Input (comma-separated)
  - [ ] Board Publish State Radio Buttons
  - [ ] Card Publish State Radio Buttons

### Persistence Tests

- [ ] Ändere Wert → Reload Page → Wert bleibt erhalten
- [ ] Reset-Button → Alle Werte auf Defaults
- [ ] Browser DevTools: localStorage enthält korrekte Werte

## 📝 Changelog

| Date | Changes |
|------|---------|
| 04.11.2025 | ✅ Initial implementation complete |
| | • Created SettingsPanel.svelte with tabs |
| | • Integrated into Topbar as Dialog |
| | • Auto-save functionality |
| | • Reset functionality |
| 12.2025 | 🗑️ Learning System entfernt (Dead Code Cleanup) |

## 📚 Related Documentation

- [`docs/COLLABORATION/ROADMAP.md`](../../../docs/COLLABORATION/ROADMAP.md) - Projekt-Meilensteine
- [`docs/GUIDES/STORE-PATTERNS.md`](../../../docs/GUIDES/STORE-PATTERNS.md) - Store Architecture
- [`docs/DOCUMENTATION-RULES-v3.md`](../../../docs/DOCUMENTATION-RULES-v3.md) - Governance Rules

---

**Status**: ✅ **Vollständig implementiert**
