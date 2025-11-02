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

## 📋 Migration Checklist (Phase 1.6)

### Schritt 1: BaseStore.ts erstellen (~10 Min)

```typescript
- [ ] src/lib/stores/BaseStore.ts erstellen
- [ ] IStore interface definieren
- [ ] IPersistentStore<T> interface definieren
- [ ] BaseComplexStore<T> abstract class implementieren
- [ ] BaseSimpleStore<T> abstract class implementieren
- [ ] Export all interfaces/classes
```

### Schritt 2: ChatStore migrieren (~5 Min)

```typescript
- [ ] Import BaseComplexStore
- [ ] extends BaseComplexStore<ChatSession | null>
- [ ] Implementiere getStorageKey()
- [ ] Implementiere getData()
- [ ] Implementiere loadFromStorage()
- [ ] Entferne triggerUpdate(), saveToStorage(), clear() methods
- [ ] Tests laufen lassen
```

### Schritt 3: BoardStore migrieren (~5 Min)

```typescript
- [ ] Import BaseComplexStore
- [ ] extends BaseComplexStore<Board>
- [ ] Implementiere getStorageKey()
- [ ] Implementiere getData()
- [ ] Implementiere loadFromStorage()
- [ ] Entferne duplicated methods
- [ ] Tests laufen lassen
```

### Schritt 4: AuthStore migrieren (~5 Min)

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
| 1.0 | 02.11.2025 | Initial concept für Phase 1.6+ |

---

**Status:** 🔮 FUTURE CONCEPT  
**Implementation:** Ab Phase 1.6 (wenn 3+ Manual Stores existieren)  
**Zeit bis Implementation:** ~2-3 Wochen (nach Phase 1.5 Export/Import)
