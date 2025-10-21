# Store-Konversions-Anleitung: Svelte 4 → Svelte 5 Runes

**Datum:** 19. Oktober 2025  
**Status:** Phase 1.5 (Konversionsplanung)

---

## 🎯 Übersicht

Die Migration von Svelte 4 Stores zu Svelte 5 Runes ist **notwendig**, damit alle Stores **consistent** mit der neuen Runes-Architektur arbeiten.

### Was ändert sich?

| Aspekt | Svelte 4 | Svelte 5 Runes |
|--------|---------|-----------------|
| **Dateiendung** | `.ts` | `.svelte.ts` (KRITISCH!) |
| **Imports** | `import { writable, derived }` | Keine Imports nötig (Runes sind builtin) |
| **State** | `writable<T>(initialValue)` | `$state(initialValue)` |
| **Computed** | `derived(store, ...)` | `$derived.by(() => ...)` |
| **Sideeffects** | `$: doSomething()` (reactive) | `$effect(() => ...)` (Svelte 5) |
| **Subscribers** | `.subscribe(cb)` | Keine Subscribers - nur Props |
| **Global Instance** | `export const store = writable(...)` | `export const store = new Store()` |

---

## 📋 Konversions-Checkliste

### ✅ ABGESCHLOSSEN: BoardStore (kanbanStore.svelte.ts)

**Datei:** `src/lib/stores/kanbanStore.svelte.ts`

```typescript
// ✅ AKTUELL (Svelte 5)
export class BoardStore {
    private board = $state(new Board()); // ← $state Rune
    public uiData = $derived.by(() => { ... }); // ← $derived.by Rune
    
    private triggerUpdate() {
        this.updateTrigger++;
        this.saveToStorage(); // Synchron
    }
}

export const boardStore = new BoardStore(); // Globale Instanz
```

---

### 🟡 TODO: SettingsStore

**Aktuell:** `src/lib/stores/settingsStore.ts` (Svelte 4 writable)  
**Konvertieren zu:** `src/lib/stores/settingsStore.svelte.ts` (Svelte 5 Runes)

#### **Konversions-Schritte:**

1. **Datei umbenennen** (wenn nicht automatisch):
   ```bash
   mv settingsStore.ts settingsStore.svelte.ts
   ```

2. **Code ersetzen:**

```typescript
// ❌ VORHER (Svelte 4):
import { writable } from 'svelte/store';

export interface SettingsState {
    maxCardsBeforeScroll: number;
    alignColumnsToMaxHeight: boolean;
}

const defaultSettings: SettingsState = {
    maxCardsBeforeScroll: 20,
    alignColumnsToMaxHeight: true
};

function createSettingsStore() {
    let initialSettings = { ...defaultSettings };
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('kanban-settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                initialSettings = { ...initialSettings, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    const { subscribe, set, update } = writable<SettingsState>(initialSettings);

    return {
        subscribe,
        setMaxCardsBeforeScroll(value: number) {
            update((s) => {
                s.maxCardsBeforeScroll = value;
                saveToLocalStorage(s);
                return s;
            });
        },
        setAlignColumnsToMaxHeight(value: boolean) {
            update((s) => {
                s.alignColumnsToMaxHeight = value;
                saveToLocalStorage(s);
                return s;
            });
        }
    };
}

export const settingsStore = createSettingsStore();

function saveToLocalStorage(settings: SettingsState) {
    localStorage.setItem('kanban-settings', JSON.stringify(settings));
}
```

```typescript
// ✅ NACHHER (Svelte 5):
// src/lib/stores/settingsStore.svelte.ts

export interface SettingsState {
    maxCardsBeforeScroll: number;
    alignColumnsToMaxHeight: boolean;
}

const defaultSettings: SettingsState = {
    maxCardsBeforeScroll: 20,
    alignColumnsToMaxHeight: true
};

export class SettingsStore {
    private settings = $state<SettingsState>(this.loadFromStorage());

    private loadFromStorage(): SettingsState {
        if (typeof window === 'undefined') return defaultSettings;
        
        try {
            const stored = localStorage.getItem('kanban-settings');
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<SettingsState>;
                return { ...defaultSettings, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
        
        return defaultSettings;
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem('kanban-settings', JSON.stringify(this.settings));
    }

    // ← Getter statt subscribe
    public get data(): SettingsState {
        return this.settings;
    }

    public setMaxCardsBeforeScroll(value: number): void {
        if (value < 1) return;
        this.settings.maxCardsBeforeScroll = value;
        this.saveToStorage();
    }

    public setAlignColumnsToMaxHeight(value: boolean): void {
        this.settings.alignColumnsToMaxHeight = value;
        this.saveToStorage();
    }

    public updateSettings(partial: Partial<SettingsState>): void {
        this.settings = { ...this.settings, ...partial };
        this.saveToStorage();
    }

    public reset(): void {
        this.settings = defaultSettings;
        this.saveToStorage();
    }
}

// ← Globale Instanz (nicht writable!)
export const settingsStore = new SettingsStore();
```

3. **Update komponenten-Verwendung:**

```svelte
<!-- ❌ VORHER (Svelte 4) -->
<script>
    import { settingsStore } from '$lib/stores/settingsStore';
    
    let maxCards: number;
    let settings: SettingsState;
    
    // Subscribers verwenden
    const unsubscribe = settingsStore.subscribe(s => {
        settings = s;
        maxCards = s.maxCardsBeforeScroll;
    });
    
    onDestroy(() => unsubscribe());
</script>

<!-- ✅ NACHHER (Svelte 5) -->
<script>
    import { settingsStore } from '$lib/stores/settingsStore.svelte';
    
    // $derived statt Subscribe!
    let settings = $derived(settingsStore.data);
    let maxCards = $derived(settings.maxCardsBeforeScroll);
    
    // Keine onDestroy nötig - Runes kümmern sich selbst darum!
</script>
```

---

### ⏳ TODO: AuthStore (noch zu erstellen)

**Datei:** `src/lib/stores/authStore.svelte.ts` (NEU!)

```typescript
// src/lib/stores/authStore.svelte.ts

import type NDK from '@nostr-dev-kit/ndk';
import type { NDKUser } from '@nostr-dev-kit/ndk';

export interface AuthState {
    user: NDKUser | null;
    pubkey: string | null;
    isAuthenticated: boolean;
}

export class AuthStore {
    private auth = $state<AuthState>({
        user: null,
        pubkey: null,
        isAuthenticated: false
    });

    private ndk: NDK;

    constructor(ndk: NDK) {
        this.ndk = ndk;
        this.loadFromStorage();
    }

    public get data(): AuthState {
        return this.auth;
    }

    public async loginWithNIP07(): Promise<void> {
        try {
            // Nutze NIP-07 für Signer
            const user = await this.ndk.signer?.user();
            if (user && user.pubkey) {
                this.auth.user = user;
                this.auth.pubkey = user.pubkey;
                this.auth.isAuthenticated = true;
                this.saveToStorage();
            }
        } catch (error) {
            console.error('NIP-07 login failed:', error);
        }
    }

    public logout(): void {
        this.auth.user = null;
        this.auth.pubkey = null;
        this.auth.isAuthenticated = false;
        localStorage.removeItem('kanban-auth');
    }

    private loadFromStorage(): void {
        if (typeof window === 'undefined') return;
        try {
            const stored = localStorage.getItem('kanban-auth');
            if (stored) {
                const data = JSON.parse(stored);
                this.auth.pubkey = data.pubkey;
                // User wird später via NDK geladen
            }
        } catch (e) {
            console.warn('Failed to load auth:', e);
        }
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem('kanban-auth', JSON.stringify({
            pubkey: this.auth.pubkey
        }));
    }
}

export const authStore = new AuthStore(ndk); // ← Benötigt NDK Kontext
```

---

### ⏳ TODO: SyncManager (noch zu erstellen)

**Datei:** `src/lib/stores/syncManager.svelte.ts` (NEU!)

Siehe: [MULTI-LAYER STORAGE.md - Event Queue](./MULTI-LAYER%20STORAGE.md#-event-queue-offline-first---future)

---

## 🔄 Migration Priorität

1. **Phase 1.5** (NÄCHST):
   - [ ] settingsStore konvertieren
   - [ ] Board.svelte/Column.svelte auf neue settingsStore API updaten

2. **Phase 2** (DANACH):
   - [ ] AuthStore erstellen
   - [ ] NDK Context in Layout setzen
   - [ ] Login-Flow implementieren

3. **Phase 3** (SPÄTER):
   - [ ] SyncManager erstellen
   - [ ] Offline-First Logik implementieren
   - [ ] Event Queue Persistierung (IndexedDB)

---

## 📝 Wichtige Regeln für Svelte 5 Runes Stores

### ✅ DO's:

1. **Dateiendung `.svelte.ts`** - Runes funktionieren NUR dort
2. **`$state` für Mutables** - State der sich ändern kann
3. **`$derived` für Computeds** - Automatisch neu berechnet
4. **`$effect` für Sideeffects** - Wenn State sich ändert
5. **Reassignments für Arrays** - `arr = [...arr, item]` statt `.push()`
6. **Globale Instanzen** - `export const store = new Store()` statt `writable()`
7. **Getter-Methoden** - `get data()` statt `.subscribe()`

### ❌ DON'Ts:

1. ❌ **`writable`, `derived` imports** - Diese sind Svelte 4!
2. ❌ **`.subscribe()` aufrufen** - In Komponenten `$derived` nutzen
3. ❌ **Dateiendung `.ts`** - Runes funktionieren NICHT dort
4. ❌ **Array `.push()`** - Nutze Reassignment `arr = [...arr, item]`
5. ❌ **`$: reactive()` statements** - Nutze `$effect()` statt
6. ❌ **Private Methods mit `$state`** - Runes sind public Konzept

---

## 🧪 Testing der Migration

Nach jeder Konversion testen:

```bash
# Build testen
npm run build

# Dev Server starten
npm run dev

# Console auf Fehler überprüfen
# Settings sollten sofort reagieren:
# 1. maxCardsBeforeScroll ändern → Column-Scroll anpassen
# 2. alignColumnsToMaxHeight toggle → Spalten-Höhe anpassen
```

---

## 📞 Hilfreiche Links

- **[Svelte 5 Runes Docs](https://svelte.dev/docs/svelte/$state)**
- **[MULTI-LAYER STORAGE.md](./MULTI-LAYER%20STORAGE.md)** - Runes Paradigma
- **[STORES.md](./STORES.md)** - Store-Architektur
- **[AGENTS.md](./AGENTS.md)** - Spezifikation
