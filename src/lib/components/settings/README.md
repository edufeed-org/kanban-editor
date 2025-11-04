# ⚙️ Settings UI Component

**Status**: ✅ **Implementiert & Integriert** (04.11.2025)

## 📋 Übersicht

Die zentrale Settings-UI verwaltet **alle** App-Konfigurationen in einem einzigen Dialog:

- **UI/UX Settings** (Theme, Layout, Scrolling)
- **🧠 Learning System** (Confidence Thresholds, Auto-Execute)
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
    ↓ setLearning*() methods
userPreferencesStore (Learning patterns)
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

## 🧠 Learning System Tab

### UI-Elemente

1. **Enable Toggle** - Aktiviert/Deaktiviert das gesamte Learning System
2. **Confidence Threshold** (Slider 0.0-1.0, Default: 0.7)
   - Ab diesem Wert werden KI-Aktionen automatisch ausgeführt
3. **Initial Confidence** (Slider 0.0-1.0, Default: 0.3)
   - Startwert für neu gelernte Patterns
4. **Confidence Increment** (Slider 0.05-0.3, Default: 0.15)
   - Wachstum pro erfolgreicher Nutzung
5. **Min Usage Count** (Slider 1-10, Default: 3)
   - Mindest-Nutzungen bevor Pattern als "gelernt" gilt
6. **Progress Visualization** - Live-Vorschau des Learning-Flows

### Beispiel: Learning Progress

```
Use 1: Confidence 0.30 (Confirmation nötig)
Use 2: Confidence 0.45 (Confirmation nötig)
Use 3: Confidence 0.60 (Confirmation nötig)
Use 4: Confidence 0.75 ✓ Auto-Execute!
```

## 📊 Settings Store API

### Learning System Setter

```typescript
// In SettingsStore.svelte.ts
public setUseLearningManager(value: boolean): void
public setLearningConfidenceThreshold(value: number): void  // validates 0.0-1.0
public setLearningInitialConfidence(value: number): void    // validates 0.0-1.0
public setLearningConfidenceIncrement(value: number): void  // validates 0.0-1.0
public setLearningMinUsageCount(value: number): void        // validates >= 1
public get isLearningEnabled(): boolean                     // convenience getter
```

### Validierung

Alle numerischen Setter haben **automatische Validierung**:

```typescript
setLearningConfidenceThreshold(value: number): void {
  if (value < 0 || value > 1) {
    console.warn('Invalid confidence threshold (must be 0.0-1.0):', value);
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

- **Desktop**: 5 Tabs horizontal angeordnet
- **Mobile**: Tabs vertical, scrollbar für Overflow
- **Max Width**: 4xl (1280px)

## 🔗 Integration mit Learning System

### Verwendung in ChatStore

```typescript
// In chatStore.svelte.ts
async processAIAction(action: AIAction): Promise<void> {
  const hash = this.generatePatternHash(action);
  const learned = userPreferencesStore.getLearnedPattern(hash);
  
  // ← Liest aus SettingsPanel UI!
  const threshold = settingsStore.settings.learningConfidenceThreshold;
  
  if (learned && learned.confidence >= threshold) {
    // Auto-execute
    await this.executeAction(action);
  } else {
    // Show confirmation dialog
  }
}
```

### Verwendung in userPreferencesStore

```typescript
// In userPreferencesStore.svelte.ts
recordPatternSuccess(patternHash: string): void {
  const existing = this.learnedPatterns.get(patternHash);
  
  // ← Liest Increment aus SettingsPanel UI!
  const increment = settingsStore.settings.learningConfidenceIncrement;
  
  if (existing) {
    existing.confidence = Math.min(existing.confidence + increment, 1.0);
  } else {
    // ← Liest Initial-Wert aus SettingsPanel UI!
    const initial = settingsStore.settings.learningInitialConfidence;
    
    this.learnedPatterns.set(patternHash, {
      confidence: initial,
      usageCount: 1,
      lastUsed: new Date().toISOString()
    });
  }
}
```

## ✅ Testing Checklist

### Manual Tests

- [ ] **UI/UX Tab**
  - [ ] Theme-Switch funktioniert (default, dark, auto)
  - [ ] Max Cards Slider aktualisiert Wert
  - [ ] Column Width Slider funktioniert
  - [ ] Sidebar-Toggles funktionieren
  
- [ ] **Learning Tab**
  - [ ] Enable-Toggle aktiviert/deaktiviert
  - [ ] Confidence Threshold Slider (0.0-1.0)
  - [ ] Initial Confidence Slider (0.0-1.0)
  - [ ] Confidence Increment Slider (0.05-0.3)
  - [ ] Min Usage Count Slider (1-10)
  - [ ] Progress Visualization zeigt korrekte Werte
  - [ ] Auto-Execute Schwelle wird korrekt angezeigt
  
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

### Learning System Integration Tests

- [ ] settingsStore.settings.learningConfidenceThreshold wird gelesen
- [ ] Änderung in UI wird sofort in chatStore übernommen
- [ ] Pattern-Confidence nutzt aktuellen Increment-Wert

## 📝 Changelog

| Date | Changes |
|------|---------|
| 04.11.2025 | ✅ Initial implementation complete |
| | • Created SettingsPanel.svelte with 5 tabs |
| | • Integrated into Topbar as Dialog |
| | • All learning settings wired to settingsStore |
| | • Auto-save functionality |
| | • Reset functionality |
| | • Progress visualization for Learning System |

## 🚀 Next Steps

1. **ActionConfirmationDialog Component** - Show when confidence < threshold
2. **Pattern Hashing in ChatStore** - Generate hash from AI actions
3. **Confidence Management in userPreferencesStore** - Record pattern success
4. **Toast Notifications** - Feedback for auto-executed actions
5. **E2E Tests** - Test full Learning System flow

## 📚 Related Documentation

- [`docs/COLLABORATION/ROADMAP.md`](../../../docs/COLLABORATION/ROADMAP.md) - Learning System Meilensteine
- [`docs/GUIDES/STORE-PATTERNS.md`](../../../docs/GUIDES/STORE-PATTERNS.md) - Store Architecture
- [`docs/DOCUMENTATION-RULES-v3.md`](../../../docs/DOCUMENTATION-RULES-v3.md) - Governance Rules

---

**Status**: ✅ **PHASE 1 COMPLETE** (Config & Store & UI)  
**Next**: **PHASE 2** (ActionConfirmationDialog + ChatStore Integration)
