# 📊 Store Pattern Analyse: Konsistenz-Check

**Datum:** 2. November 2025  
**Status:** ✅ ALLE 3 STORES SIND REAKTIV  
**Ziel:** Bewertung gegen einheitliches Store-Pattern

---

## 🎯 Ideales Store-Pattern (Vorgeschlagen)

```typescript
export class IdealStore {
    // 1. Persistierter Store (für localStorage)
    private persistedData = persisted<MyData>(
        'key-for-localstorage',
        defaultValue
    );
    
    // 2. Reaktive State
    private data = $state(this.loadFromPersisted());
    
    // 3. Derived Values
    private derived = $derived(computeValue(this.data));
    
    // 4. Methods für Änderungen
    public updateData(newData: Partial<MyData>) {
        this.data = { ...this.data, ...newData };
        this.persistData(); // Sync zu localStorage
    }
    
    private persistData() {
        this.persistedData.set(this.data);
    }
}
```

---

## ✅ AuthStore Analyse

### Aktuelles Pattern

```typescript
export class AuthStore {
  // 1. ✅ Persistierter Store
  private sessionStore = persisted<UserSession | null>(
    "nostr-user-session",
    null
  );

  // 2. ✅ Reaktive State
  public currentUser = $state<NDKUser | null>(null);
  
  // 3. ✅ Derived Values
  public isAuthenticated = $derived(!!this.currentUser);
  public isLoading = $state(false);
  public errorMessage = $state<string | null>(null);
  
  // 4. ✅ Update Methods
  public async loginWithNip07(): Promise<NDKUser> {
    this.currentUser = user;  // ← Reaktive Zuweisung
    await this.saveSession(user, "nip07");  // ← Persistierung
  }
  
  private async saveSession(user: NDKUser, type): Promise<void> {
    const session: UserSession = { /* ... */ };
    this.sessionStore.set(session);  // ← persisted() wrapper
  }
}
```

### ✅ Entspricht dem Pattern: JA

| Aspekt | Status | Bewertung |
|--------|--------|-----------|
| **1. Persisted Store** | ✅ | `sessionStore = persisted()` korrekt verwendet |
| **2. Reaktive State** | ✅ | `currentUser = $state()` + weitere $state properties |
| **3. Derived Values** | ✅ | `isAuthenticated = $derived()` automatisch berechnet |
| **4. Update Methods** | ✅ | `loginWithNip07()` → state update → persist |
| **SSR-Safe** | ✅ | Constructor prüft `typeof window` |
| **Reassignment** | ✅ | `this.currentUser = user` (nicht mutation) |

### 🎯 Unterschiede zum Ideal-Pattern

1. **Zwei separate State-Ebenen:**
   ```typescript
   // persisted() für Session-Daten
   private sessionStore = persisted<UserSession | null>(...)
   
   // $state für Runtime-Daten (NDKUser mit Methoden)
   public currentUser = $state<NDKUser | null>(null)
   ```
   **Grund:** `NDKUser` ist eine komplexe Klasse, `sessionStore` ist nur JSON  
   **Bewertung:** ✅ Sinnvoll, da NDK-Objekte nicht direkt serialisierbar sind

2. **loadFromPersisted() nicht explizit:**
   - Statt: `private data = $state(this.loadFromPersisted())`
   - Nutzt: `restoreSessionOrCreateDemo()` im Constructor
   
   **Bewertung:** ✅ OK, da asynchron (NDK fetch)

### 🔥 Empfehlung

**KEINE Änderung nötig!** AuthStore folgt dem Pattern korrekt:

```
✅ persisted() für Session (JSON)
✅ $state für Runtime (NDKUser)
✅ $derived für Computed
✅ Methods persistieren via sessionStore.set()
```

---

## ✅ BoardStore Analyse

### Aktuelles Pattern

```typescript
export class BoardStore {
    // 1. ❌ KEIN persisted() wrapper!
    //    → Nutzt direkt localStorage.getItem/setItem
    
    // 2. ✅ Reaktive State
    private board = $state(this.loadFromStorage());
    private _columnOrder = $state<string[]>(...);
    public updateTrigger = $state(0);
    
    // 3. ✅ Derived Values
    public uiData = $derived.by(() => {
        const trigger = this.updateTrigger;
        // Transform zu UI-Format
    });
    
    // 4. ✅ Update Methods
    public createCard(columnId: string, name: string): string {
        const card = this.addCard(columnId, cardProps);
        this.triggerUpdate();  // ← Persistierung
    }
    
    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage();  // ← localStorage.setItem()
    }
}
```

### ⚠️ Entspricht dem Pattern: TEILWEISE

| Aspekt | Status | Bewertung |
|--------|--------|-----------|
| **1. Persisted Store** | ❌ | **Nutzt NICHT `persisted()`, sondern direktes `localStorage`** |
| **2. Reaktive State** | ✅ | `board = $state()` + `updateTrigger` |
| **3. Derived Values** | ✅ | `uiData = $derived.by()` automatisch berechnet |
| **4. Update Methods** | ✅ | `createCard()` → triggerUpdate() → saveToStorage() |
| **SSR-Safe** | ✅ | Constructor prüft `typeof window` |
| **Reassignment** | ✅ | Array-Reassignments: `this.cards = [...]` |

### 🔥 Problem: Kein `persisted()` Wrapper

```typescript
// ❌ AKTUELL: Manuelles localStorage
private saveToStorage(): void {
    const data = this.board.getContextData(true);
    localStorage.setItem(`kanban-${this.board.id}`, JSON.stringify(data));
}

// ✅ EMPFOHLEN: persisted() wie AuthStore
private persistedData = persisted<BoardData>(
    `kanban-${this.board.id}`,
    defaultBoardData
);

private saveToStorage(): void {
    this.persistedData.set(this.board.getContextData(true));
}
```

**Warum ist das ein Problem?**

1. **Multi-Board-Verwaltung:**
   - Jedes Board hat eigenen `kanban-${boardId}` Key
   - `persisted()` funktioniert nur für **einen fixen Key**
   - Dynamic Keys passen nicht zum `persisted()` Pattern!

2. **Komplexe Datenstruktur:**
   - `Board` ist Klassen-Instanz mit Methoden
   - `persisted()` braucht Plain Objects
   - Aktuell: `board.getContextData(true)` serialisiert zu Plain Object

### 🎯 Unterschiede zum Ideal-Pattern

**1. Dynamic Storage Keys:**
```typescript
// BoardStore nutzt:
localStorage.setItem(`kanban-${boardId}`, ...)  // Dynamischer Key!

// Ideal-Pattern nutzt:
persisted('static-key', ...)  // Statischer Key!
```

**Bewertung:** ❌ `persisted()` nicht anwendbar für Multi-Board!

**2. Komplexe Klassen-Hierarchie:**
```typescript
// BoardStore hat:
Board → Column → Card (verschachtelte Klassen)

// persisted() erwartet:
Plain Objects (keine Methoden, nur Daten)
```

**Bewertung:** ✅ `getContextData()` serialisiert korrekt zu Plain Object

**3. updateTrigger als Workaround:**
```typescript
// BoardStore nutzt:
public updateTrigger = $state(0);  // Manueller Trigger für $derived

// Ideal-Pattern nutzt:
// Keine expliziten Trigger nötig (automatisches Tracking)
```

**Bewertung:** ✅ Notwendig wegen `$derived.by()` Limitation bei Arrays

### 🔥 Empfehlung für BoardStore

**Option A: BEHALTEN wie es ist** (EMPFOHLEN ✅)

**Gründe:**
- ✅ Multi-Board-System braucht dynamic keys
- ✅ Komplexe Klassen-Hierarchie passt nicht zu `persisted()`
- ✅ `updateTrigger` löst $derived korrekt aus
- ✅ `saveToStorage()` ist explizit & kontrollierbar

**Code bleibt unverändert:**
```typescript
private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveToStorage();  // ← Manuelles Speichern ist OK!
}
```

**Option B: Hybrid-Ansatz** (NICHT EMPFOHLEN ❌)

Nur für `boardIds` Liste:
```typescript
private boardIdsStore = persisted<string[]>(
    'kanban-boards-list',
    []
);

// Boards selbst bleiben bei localStorage.setItem()
```

**Warum nicht?** Inkonsistent & bringt keinen Vorteil!

---

## ✅ SettingsStore Analyse

### Aktuelles Pattern

```typescript
export class SettingsStore {
  private static readonly STORAGE_KEY = 'kanban-settings';
  
  // 1. ❌ KEIN persisted() wrapper!
  //    → Nutzt direkt localStorage.getItem/setItem
  
  // 2. ✅ Reaktive State
  public settings = $state<SettingsState>(this.loadSettings());
  
  // 3. ✅ Derived Values
  public isDarkMode = $derived(
    this.settings.theme === 'dark' || ...
  );
  
  // 4. ✅ Update Methods
  public setTheme(theme: Theme): void {
    this.settings = { ...this.settings, theme };  // ← Reassignment!
    this.updateTheme(theme);
    this.saveToStorage();  // ← localStorage.setItem()
  }
  
  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}
```

### ⚠️ Entspricht dem Pattern: TEILWEISE

| Aspekt | Status | Bewertung |
|--------|--------|-----------|
| **1. Persisted Store** | ❌ | **Nutzt NICHT `persisted()`, sondern direktes `localStorage`** |
| **2. Reaktive State** | ✅ | `settings = $state()` |
| **3. Derived Values** | ✅ | `isDarkMode = $derived()`, `isLlmConfigured = $derived()` |
| **4. Update Methods** | ✅ | `setTheme()` → reassignment → saveToStorage() |
| **SSR-Safe** | ✅ | Constructor prüft `typeof window` |
| **Reassignment** | ✅ | `this.settings = { ...this.settings, ... }` |

### 🔥 Problem: Kein `persisted()` Wrapper

**Warum nutzt SettingsStore NICHT `persisted()`?**

**Grund 1: External config.json Merge**
```typescript
// SettingsStore muss:
// 1. localStorage laden
// 2. config.json laden (async!)
// 3. Beide mergen

// persisted() kann nicht:
// - Asynchron initialisieren
// - Externe Dateien mergen
```

**Grund 2: Complex Initialization Logic**
```typescript
public async initializeConfig(forceOverwrite = false): Promise<void> {
    const config = await this.getConfig();
    if (config) {
        this.mergeConfigIntoSettings(config, forceOverwrite);
    }
}
```

`persisted()` hat keine `merge()` API!

### 🎯 Unterschiede zum Ideal-Pattern

**1. Async Initialization:**
```typescript
// SettingsStore:
constructor() {
    this.settings = $state(this.loadSettings());  // Sync
    
    if (typeof window !== 'undefined') {
        this.initializeConfig();  // Async später!
    }
}

// Ideal-Pattern:
private data = $state(this.loadFromPersisted());  // Nur sync
```

**Bewertung:** ❌ `persisted()` unterstützt kein async init

**2. External Config File:**
```typescript
// SettingsStore lädt:
// - localStorage (User-Präferenzen)
// - config.json (Admin-Defaults)
// → Merge bei erstem Start

// persisted() lädt nur:
// - localStorage
```

**Bewertung:** ❌ `persisted()` kann externe Dateien nicht mergen

**3. Smart Merge Logic:**
```typescript
// SettingsStore:
if (hasUserSettings && !forceOverwrite) {
    // User-Präferenzen haben Vorrang!
    return;
}
// Sonst: config.json mergen
```

**Bewertung:** ❌ `persisted()` hat keine Smart-Merge API

### 🔥 Empfehlung für SettingsStore

**Option A: BEHALTEN wie es ist** (EMPFOHLEN ✅)

**Gründe:**
- ✅ Externes config.json merge ist notwendig
- ✅ Async initialization ist erforderlich
- ✅ Smart-Merge ist komplex (User vs Admin Settings)
- ✅ Explizites `saveToStorage()` gibt Kontrolle

**Code bleibt unverändert:**
```typescript
public setTheme(theme: Theme): void {
    this.settings = { ...this.settings, theme };
    this.saveToStorage();  // ← Manuelles Speichern ist OK!
}
```

**Option B: Hybrid mit persisted()** (MÖGLICH, aber KOMPLEX 🟡)

```typescript
export class SettingsStore {
  // Layer 1: persisted() für localStorage (nur User-Änderungen)
  private persistedSettings = persisted<Partial<SettingsState>>(
    'kanban-settings',
    {}
  );
  
  // Layer 2: Reaktive State (merged mit config.json)
  public settings = $state<SettingsState>(
    this.loadAndMerge()
  );
  
  private loadAndMerge(): SettingsState {
    const stored = get(this.persistedSettings);
    const defaults = DEFAULT_SETTINGS;
    // Config-Merge muss async passieren!
    return { ...defaults, ...stored };
  }
  
  private saveToStorage(): void {
    this.persistedSettings.set(this.settings);  // ← persisted() nutzen
  }
}
```

**Warum nicht?**
- ⚠️ Async config.json merge wird kompliziert
- ⚠️ Smart-Merge (User vs Admin) geht verloren
- ⚠️ Mehr Code, gleicher Effekt

---

## 📊 Zusammenfassung: Pattern-Compliance

| Store | Persisted? | Reaktiv? | Derived? | Pattern-Match | Empfehlung |
|-------|------------|----------|----------|---------------|------------|
| **AuthStore** | ✅ Yes (`persisted()`) | ✅ Yes (`$state`) | ✅ Yes (`$derived`) | ✅ **100%** | ✅ Keine Änderung |
| **BoardStore** | ❌ No (manual) | ✅ Yes (`$state`) | ✅ Yes (`$derived.by`) | 🟡 **75%** | ✅ Keine Änderung |
| **SettingsStore** | ❌ No (manual) | ✅ Yes (`$state`) | ✅ Yes (`$derived`) | 🟡 **75%** | ✅ Keine Änderung |

### Legende
- **Persisted:** Nutzt `persisted()` wrapper oder manual localStorage
- **Reaktiv:** Nutzt `$state` Runes
- **Derived:** Nutzt `$derived` oder `$derived.by`
- **Pattern-Match:** Wie gut entspricht es dem Ideal-Pattern?

---

## 🎯 Finale Bewertung

### ✅ AuthStore: Perfektes Pattern-Match (100%)

```typescript
✅ persisted() für Session-Daten (JSON)
✅ $state für Runtime-Daten (NDKUser)
✅ $derived für Computed Values
✅ Saubere Trennung: Persistent vs Transient
```

**Keine Änderungen nötig!**

### 🟡 BoardStore: Gutes Pattern mit gutem Grund für Abweichung (75%)

```typescript
❌ NICHT persisted() → ✅ RICHTIG für Multi-Board!
✅ $state für Board-Daten
✅ $derived.by für UI-Transformation
✅ Manual localStorage.setItem() ist OK!

GRUND: Dynamic Keys (`kanban-${boardId}`)
       persisted() unterstützt nur static keys!
```

**Keine Änderungen nötig!**

### 🟡 SettingsStore: Gutes Pattern mit gutem Grund für Abweichung (75%)

```typescript
❌ NICHT persisted() → ✅ RICHTIG für config.json merge!
✅ $state für Settings-Daten
✅ $derived für Computed Values
✅ Manual localStorage.setItem() ist OK!

GRUND: External config.json + Smart-Merge
       persisted() unterstützt keine async init/merge!
```

**Keine Änderungen nötig!**

---

## 🔥 Design-Entscheidung: Wann `persisted()` nutzen?

### ✅ NUTZE `persisted()` WENN:

1. **Single Static Key:**
   - Nur ein localStorage-Key
   - Key ändert sich nicht zur Runtime

2. **Simple Data Structure:**
   - Plain Objects (keine Klassen)
   - Direkt serialisierbar als JSON

3. **Sync Initialization:**
   - Keine async file-loading
   - Keine externe Merge-Logik

**Beispiel:** AuthStore `sessionStore`

### ❌ NUTZE NICHT `persisted()` WENN:

1. **Dynamic Keys:**
   - Multiple localStorage keys
   - Keys ändern sich zur Runtime (z.B. boardId)

2. **Complex Data:**
   - Klassen-Instanzen mit Methoden
   - Verschachtelte Hierarchie (Board → Column → Card)

3. **Async Init:**
   - External file loading (config.json)
   - Merge-Logik mit Smart-Rules

**Beispiel:** BoardStore, SettingsStore

---

## 💡 Empfohlenes Unified Pattern v2.0

```typescript
/**
 * Pattern für SIMPLE Stores (wie AuthStore)
 */
export class SimpleStore {
    private persistedData = persisted<MyData>('key', defaults);
    public data = $state(get(persistedData));
    public computed = $derived(transformData(this.data));
    
    public update(newData: Partial<MyData>) {
        this.data = { ...this.data, ...newData };
        this.persistedData.set(this.data);
    }
}

/**
 * Pattern für COMPLEX Stores (wie BoardStore, SettingsStore)
 */
export class ComplexStore {
    // Keine persisted() bei:
    // - Dynamic keys
    // - Complex classes
    // - Async init
    
    public data = $state(this.loadFromStorage());
    public computed = $derived(transformData(this.data));
    
    private loadFromStorage(): MyData {
        // Custom load logic
        // z.B. dynamic keys, external files, merge
    }
    
    private saveToStorage(): void {
        // Custom save logic
        // z.B. dynamic keys, selective persist
        localStorage.setItem(key, JSON.stringify(this.data));
    }
    
    public update(newData: Partial<MyData>) {
        this.data = { ...this.data, ...newData };
        this.saveToStorage();  // Explizit aufrufen!
    }
}
```

---

## 🎯 Action Items

### Für Entwickler

✅ **AuthStore:** Keine Änderung nötig  
✅ **BoardStore:** Keine Änderung nötig  
✅ **SettingsStore:** Keine Änderung nötig

### Für Dokumentation

✅ **STORES.md (README.md):** Pattern-Übersicht hinzugefügt (02.11.2025)
✅ **copilot-instructions.md:** Store-Pattern-Referenz hinzugefügt (02.11.2025)
✅ **_INDEX.md:** Store-Patterns Guide verlinkt (02.11.2025)
✅ **GUIDES/STORE-PATTERNS.md:** Neuer Guide erstellt (02.11.2025) - 1000+ Zeilen
  - Decision Tree
  - Simple Store Pattern (persisted())
  - Complex Store Pattern (manual localStorage)
  - Pattern-Vergleiche
  - Migration-Guide
  - Anti-Patterns
  - FAQ

---

## 🔑 Key Insights

### 1. **Alle 3 Stores SIND reaktiv!**

```
AuthStore:    $state + $derived ✅
BoardStore:   $state + $derived.by ✅
SettingsStore: $state + $derived ✅
```

### 2. **Unterschied ist NUR Persistierungs-Strategie!**

```
AuthStore:      persisted() ← Single Key, Simple Data
BoardStore:     manual ← Dynamic Keys, Complex Classes
SettingsStore:  manual ← Async Init, External Merge
```

### 3. **Pattern v2.0: "Use the right tool"**

```
Simple Store → persisted() ✅
Complex Store → manual localStorage ✅

BEIDE sind korrekt!
```

---

## 📋 Versionshistorie

| Version | Datum | Status | Beschreibung |
|---------|-------|--------|-------------|
| 1.0 | 02.11.2025 | ✅ Complete | Initiale Analyse - Alle Stores validiert |
| 1.1 | 02.11.2025 | ✅ Complete | GUIDES/STORE-PATTERNS.md erstellt (1000+ Zeilen) |
| 1.2 | 02.11.2025 | ✅ Complete | STORES/README.md Pattern-Übersicht hinzugefügt |
| 1.3 | 02.11.2025 | ✅ Complete | _INDEX.md mit 3 Store-Patterns References aktualisiert |
| 1.4 | 02.11.2025 | ✅ Complete | copilot-instructions.md Store-Pattern Tabelle hinzugefügt |
| 1.5 | 02.11.2025 | ✅ Complete | Alle Action Items abgeschlossen - Dokumentation vollständig |

---

**Datum:** 2. November 2025  
**Status:** ✅ **ANALYSE & DOKUMENTATION ABGESCHLOSSEN**  
**Ergebnis:** ALLE Stores sind korrekt implementiert! Keine Änderungen nötig.

**Dokumentations-Integration abgeschlossen:**
- ✅ GUIDES/STORE-PATTERNS.md (1000+ Zeilen mit Decision Tree, Code-Beispiele, Anti-Patterns)
- ✅ STORES/README.md (Pattern-Übersicht mit Quick-Reference Tabelle)
- ✅ _INDEX.md (3 neue Referenzen zu Store-Patterns Guide)
- ✅ copilot-instructions.md (Store-Pattern Decision Table für AI Agents)

**Nächste Schritte (nach dieser Dokumentation):**
1. ChatBotStore implementation (Complex Pattern)
2. SyncManager implementation (Complex Pattern)
3. Neue Stores folgen Pattern v2.0 Design
2. Pattern v2.0 als Best Practice etablieren
3. Future Stores nach diesem Pattern entwickeln
