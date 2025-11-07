# Base Store Architecture (Future - Phase 1.6+)

**Version:** 1.0  
**Datum:** 02. November 2025  
**Status:** 🔮 FUTURE - Konzept für Phase 1.6+  
**Zweck:** DRY-Abstraktion wenn 3+ Manual localStorage Stores existieren

---

## 🎯 Problem

Aktuell haben wir 3 Stores mit Manual localStorage Pattern:
- **BoardStore** (~200 Zeilen)
- **ChatStore** (~300 Zeilen)
- **SyncManager** (geplant, ~250 Zeilen)

**Code-Duplikation:**
```typescript
// Diese ~30 Zeilen sind in JEDEM Store identisch:
private updateTrigger = $state(0);

private saveToStorage(): void {
    const key = this.getStorageKey();
    localStorage.setItem(key, JSON.stringify(this.getData()));
}

private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveToStorage();
}

public clear(): void {
    const key = this.getStorageKey();
    localStorage.removeItem(key);
    this.updateTrigger++;
}
```

**→ Solution: Base Class mit shared logic** 🚀

---

## 🏗️ Interface Hierarchy

```typescript
// src/lib/stores/BaseStore.ts (Future)

/**
 * Universal Base Interface für ALLE Stores
 */
export interface IStore {
	clear?(): void;
	reset?(): void;
}

/**
 * Interface für Stores mit localStorage
 */
export interface IPersistentStore<T> extends IStore {
	loadFromStorage(): T;
	saveToStorage(): void;
	getStorageKey(): string;
}
```

---

## 🎯 BaseComplexStore<T> - Für Manual localStorage Stores

```typescript
/**
 * Abstract Base Class für Manual localStorage Pattern
 * 
 * Features:
 * - Shared triggerUpdate() logic
 * - Shared saveToStorage() logic
 * - Shared clear() implementation
 * 
 * Nutzen: BoardStore, ChatStore, SyncManager
 */
export abstract class BaseComplexStore<T> implements IPersistentStore<T> {
	// ============================================================================
	// Shared State
	// ============================================================================

	protected updateTrigger = $state(0);

	// ============================================================================
	// Abstract Methods (Subclass MUSS implementieren)
	// ============================================================================

	/**
	 * Gibt den localStorage-Key zurück
	 * Kann statisch oder dynamisch sein
	 */
	protected abstract getStorageKey(): string;

	/**
	 * Gibt die zu speichernden Daten zurück
	 */
	protected abstract getData(): T;

	/**
	 * Lädt Daten aus localStorage
	 */
	protected abstract loadFromStorage(): T;

	// ============================================================================
	// Shared Implementation (DRY!)
	// ============================================================================

	/**
	 * Speichert Daten zu localStorage
	 * ✅ Shared - keine Duplikation!
	 */
	protected saveToStorage(): void {
		try {
			const key = this.getStorageKey();
			const data = this.getData();
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			console.error('Failed to save to localStorage:', error);
		}
	}

	/**
	 * Triggert UI-Update UND persistiert
	 * ✅ Shared - keine Duplikation!
	 */
	protected triggerUpdate(): void {
		this.updateTrigger++;
		this.saveToStorage();
	}

	/**
	 * Löscht localStorage-Eintrag
	 * ✅ Shared - keine Duplikation!
	 */
	public clear(): void {
		try {
			const key = this.getStorageKey();
			localStorage.removeItem(key);
			this.updateTrigger++;
		} catch (error) {
			console.error('Failed to clear localStorage:', error);
		}
	}
}
```

---

## 🎯 BaseSimpleStore<T> - Für Hybrid Pattern Stores

```typescript
/**
 * Abstract Base Class für persisted() + $state Pattern
 * 
 * Features:
 * - Wraps persisted() automatisch
 * - Shared update() logic
 * - Shared clear() implementation
 * 
 * Nutzen: AuthStore, SettingsStore, ThemeStore
 */
export abstract class BaseSimpleStore<T> implements IStore {
	// ============================================================================
	// Abstract Methods (Subclass MUSS implementieren)
	// ============================================================================

	protected abstract getDefaultValue(): T;
	protected abstract getStorageKey(): string;

	// ============================================================================
	// Shared Implementation
	// ============================================================================

	private _store = persisted<T>(this.getStorageKey(), this.getDefaultValue());
	protected data = $state<T>(get(this._store));

	/**
	 * Aktualisiert Store-Daten
	 */
	protected update(newData: T): void {
		this.data = newData;
		this._store.set(newData);
	}

	/**
	 * Löscht Store-Daten
	 */
	public clear(): void {
		const defaultValue = this.getDefaultValue();
		this.data = defaultValue;
		this._store.set(defaultValue);
	}

	/**
	 * Lädt Daten aus persisted Store
	 */
	protected load(): void {
		this.data = get(this._store);
	}
}
```

---

## 📊 Migration Examples

### ChatStore extends BaseComplexStore

```typescript
// VORHER: ~300 Zeilen mit Duplikation
export class ChatStore {
	private updateTrigger = $state(0);
	
	private saveToStorage(): void {
		const key = `chat-session-${this.currentBoardId}`;
		localStorage.setItem(key, JSON.stringify(this.session.getContextData()));
	}
	
	private triggerUpdate(): void {
		this.updateTrigger++;
		this.saveToStorage();
	}
	
	public clear(): void {
		localStorage.removeItem(this.getStorageKey());
		this.updateTrigger++;
	}
	
	// ... 270 weitere Zeilen
}

// NACHHER: ~270 Zeilen, -30 Zeilen Boilerplate!
export class ChatStore extends BaseComplexStore<ChatSession | null> {
	private currentBoardId = $state<string | null>(null);
	private session = $state<ChatSession | null>(null);
	
	// Abstract Methods implementieren
	protected getStorageKey(): string {
		return `chat-session-${this.currentBoardId}`;
	}
	
	protected getData(): ChatSession | null {
		return this.session?.getContextData() || null;
	}
	
	protected loadFromStorage(): ChatSession | null {
		// ... implementation
	}
	
	// ✅ triggerUpdate(), saveToStorage(), clear() inherited!
	public addMessage(content: string, role: 'user' | 'assistant'): void {
		this.session?.addMessage({ content, role });
		this.triggerUpdate(); // ← From BaseComplexStore!
	}
}
```

---

### AuthStore extends BaseSimpleStore

```typescript
// VORHER: ~80 Zeilen mit persisted() Boilerplate
export class AuthStore {
	private sessionStore = persisted<UserSession | null>('nostr-user-session', null);
	public currentUser = $state<NDKUser | null>(null);
	
	public saveSession(user: NDKUser): void {
		const session = { npub: user.npub, ... };
		this.sessionStore.set(session);
		this.currentUser = user;
	}
	
	public logout(): void {
		this.sessionStore.set(null);
		this.currentUser = null;
	}
}

// NACHHER: ~60 Zeilen, -20 Zeilen Boilerplate!
export class AuthStore extends BaseSimpleStore<UserSession | null> {
	public currentUser = $state<NDKUser | null>(null);
	
	protected getStorageKey(): string {
		return 'nostr-user-session';
	}
	
	protected getDefaultValue(): UserSession | null {
		return null;
	}
	
	// ✅ clear(), update() inherited!
	public saveSession(user: NDKUser): void {
		const session = { npub: user.npub, ... };
		this.update(session); // ← From BaseSimpleStore!
		this.currentUser = user;
	}
	
	public logout(): void {
		this.clear(); // ← From BaseSimpleStore!
		this.currentUser = null;
	}
}
```

---

## � Wann BaseStore nutzen? (Decision Tree für NEUE Stores)

```
Neue Store nötig?
    ↓
Braucht localStorage?
    ├─ NEIN → Nutze plain $state (kein BaseStore)
    └─ JA → Weiter
         ↓
Hat komplexe Logik? (NDK, Async, Klassen?)
    ├─ JA → Custom Implementation (wie ChatStore, BoardStore)
    └─ NEIN → Weiter
         ↓
Ist es ein einfacher Key-Value Store?
    ├─ JA → Nutze persisted() (schnellste Lösung)
    └─ NEIN → Weiter
         ↓
Dynamische Storage Keys? (z.B. chat-${id})
    ├─ JA → Nutze BaseComplexStore ✅
    └─ NEIN → Nutze BaseSimpleStore ✅
```

**Beispiele für ZUKÜNFTIGE BaseStore-Nutzung:**

### Beispiel 1: NotificationStore (BaseSimpleStore)

```typescript
export class NotificationStore extends BaseSimpleStore<Notification[]> {
    protected getStorageKey(): string {
        return 'notifications';
    }
    
    protected getDefaultValue(): Notification[] {
        return [];
    }
    
    // Custom methods
    public addNotification(text: string): void {
        const notifications = [...this.data, { id: Date.now(), text }];
        this.update(notifications);
    }
}
```

### Beispiel 2: RecentBoardsStore (BaseComplexStore)

```typescript
export class RecentBoardsStore extends BaseComplexStore<BoardMetadata[]> {
    private recentBoards = $state<BoardMetadata[]>(this.loadFromStorage());
    
    protected getStorageKey(): string {
        return 'recent-boards';
    }
    
    protected getData(): BoardMetadata[] {
        return this.recentBoards;
    }
    
    protected loadFromStorage(): BoardMetadata[] {
        // Custom loading logic
        return [];
    }
    
    public addBoard(id: string, name: string): void {
        this.recentBoards = [{ id, name, lastAccessed: Date.now() }, ...this.recentBoards];
        this.triggerUpdate();
    }
}
```

---

## ❌ KEINE Migration bestehender Stores (Stand 02.11.2025)

```typescript
- [ ] Import BaseSimpleStore
- [ ] extends BaseSimpleStore<UserSession | null>
- [ ] Implementiere getStorageKey()
- [ ] Implementiere getDefaultValue()
- [ ] Ersetze sessionStore.set() mit this.update()
- [ ] Ersetze manuelles clear() mit this.clear()
- [ ] Tests laufen lassen
```

### Schritt 5: SettingsStore migrieren (~5 Min)

```typescript
- [ ] Import BaseSimpleStore
- [ ] extends BaseSimpleStore<Settings>
- [ ] Implementiere getStorageKey()
- [ ] Implementiere getDefaultValue()
- [ ] Ersetze manuelle updates mit this.update()
- [ ] Tests laufen lassen
```

---

## ✅ Benefits

| Benefit | Impact |
|---------|--------|
| **DRY** | -30 Zeilen pro Store (~90 Zeilen total) |
| **Type Safety** | Interface enforces consistent API |
| **Testability** | Mock IPersistentStore<T> für alle Stores |
| **Consistency** | Alle Stores haben clear(), reset() |
| **Maintainability** | Bug-Fixes in BaseClass → alle Stores profitieren |
| **Documentation** | Interface ist self-documenting |

---

## 🚫 Wann NICHT verwenden

BaseComplexStore ist **NICHT geeignet** für:

1. **Stores mit 100% unique Logik**
   - Keine shared methods
   - Beispiel: TemporaryUIStore

2. **Stores die KEIN localStorage brauchen**
   - Nur in-memory State
   - Beispiel: ToastStore, ModalStore

3. **Stores mit sehr einfacher Struktur**
   - < 50 Zeilen Code
   - Overhead würde Nutzen übersteigen

4. **⚠️ BESTEHENDE STORES (WICHTIG!)** ← **NEU 02.11.2025**
   - **BoardStore** → ❌ NICHT migrieren
     - Zu komplex: Multi-Board Management, Dynamic Keys (`kanban-${id}`)
     - Spezielle Logik: Klassen-Rekonstruktion, Export/Import
     - ~200 Zeilen unique Code würden nicht reduziert
   - **ChatStore** → ❌ NICHT migrieren  
     - Perfekt wie es ist: Klarer Manual Pattern
     - Spezielle Logik: Memory Ranking, AI Context Preparation
     - Migration würde Code SCHWERER lesbar machen
   - **AuthStore** → ❌ NICHT migrieren
     - Zu komplex: NDK Integration, Signer Management
     - Async Operations: Profile fetching, Session restore
     - Nutzt bereits `persisted()` für Session
   - **SettingsStore** → ❌ NICHT migrieren
     - Async config.json loading + localStorage merge
     - Theme Detection (system preferences)
     - Migration würde mehr Probleme schaffen als lösen

**Fazit:** BaseStore ist für **ZUKÜNFTIGE einfache Stores** gedacht, NICHT für Refactoring bestehender Stores!

---

## 🎯 Wann BaseStores wirklich Sinn machen

**Nutze BaseComplexStore NUR für:**

1. **Neue einfache Stores** (Phase 2+)
   - NotificationStore
   - ThemeStore (wenn von SettingsStore getrennt)
   - KeyboardShortcutStore
   - RecentBoardsStore

2. **Wenn 5+ neue Stores** hinzukommen
   - Dann lohnt sich die Abstraktion
   - Jetzt: Nur 4 Stores, alle sehr unterschiedlich

**Aktueller Stand (02.11.2025):**
- ✅ ChatStore: Fertig, bleibt wie es ist
- ✅ BoardStore: Fertig, bleibt wie es ist  
- ✅ AuthStore: Fertig, bleibt wie es ist
- ✅ SettingsStore: Fertig, bleibt wie es ist

**→ BaseStore Pattern = Referenz für ZUKÜNFTIGE Stores, nicht für Refactoring!** 🎯

---

## 📚 Related Documentation

- **[STORE-PATTERNS.md](../../GUIDES/STORE-PATTERNS.md)** — Wann Hybrid vs Manual Pattern?
- **[CHATSTORE.md](./CHATSTORE.md)** — ChatStore Implementation
- **[BOARDSTORE.md](./BOARDSTORE.md)** — BoardStore Implementation
- **[AUTHSTORE.md](./AUTHSTORE.md)** — AuthStore Implementation

---

## 📝 Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.1 | 02.11.2025 | ⚠️ **KLARSTELLUNG:** Keine Migration bestehender Stores! BaseStore nur für NEUE einfache Stores in Zukunft |
| 1.0 | 02.11.2025 | Initial concept für Phase 1.6+ |

---

## 📋 Zusammenfassung

**Was ist BaseStore?**
- Abstract Base Classes für DRY localStorage-Logik
- Reduziert ~30 Zeilen Boilerplate pro Store

**Wann nutzen?**
- ✅ Für NEUE einfache Stores (Phase 2+)
- ✅ Wenn 5+ neue Stores mit ähnlicher Logik
- ❌ NICHT für bestehende komplexe Stores

**Bestehende Stores:**
- BoardStore → Bleibt Custom (zu komplex)
- ChatStore → Bleibt Custom (perfekt wie es ist)
- AuthStore → Bleibt Custom (NDK Integration)
- SettingsStore → Bleibt Custom (async config)

**Status:** 🔮 FUTURE CONCEPT  
**Implementation:** Ab Phase 1.6+ (nur für NEUE Stores)  
**Zeit bis Implementation:** ~2-3 Wochen (nach Phase 1.5 Export/Import)
