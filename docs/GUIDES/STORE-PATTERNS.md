# Store Patterns Guide: Wie du Stores RICHTIG anlegst

**Version:** 2.0 (Refactored - Fokus auf Zukunftsentwicklung)  
**Datum:** 02. November 2025  
**Zielgruppe:** Frontend-Entwickler (Svelte 5) die NEUE Stores bauen  
**Zweck:** Praktische Anleitung - nicht historische Analyse

---

## 🎯 In 30 Sekunden: Welches Pattern?

```typescript
// ❓ Hast du EINEN statischen localStorage-Key?
// ❓ Ist deine Datenstruktur einfach (Plain Objects)?
// ❓ Brauchst du keine asynchrone Initialisierung?
// → JA auf alle? → persisted()

// ❓ Brauchst du MEHRERE verschiedene Keys?
// ❓ Hast du Klassen-Hierarchien (Board → Column → Card)?
// ❓ Brauchst du async Initialisierung oder Smart-Merge?
// → JA zu mindestens 1? → Manual localStorage
```

---

## 📊 Decision Table (Die einzige Tabelle die du brauchst)

| Kriterium | persisted() | Manual localStorage |
|-----------|:----------:|:---:|
| **Datenstruktur** | Plain Objects | Klassen-Hierarchien |
| **Storage-Keys** | 1 statischer Key | Mehrere/dynamische Keys |
| **Async Init** | ❌ Nicht möglich | ✅ Möglich |
| **Setup-Zeit** | 1 Min | 10-15 Min |
| **Autom. Sync** | ✅ Ja | ❌ Nein |
| **Komplexität** | Niedrig | Mittel-Hoch |
| **Beispiel** | AuthStore | BoardStore, SettingsStore |

---

## 🚀 Pattern 1: persisted() - Für einfache Stores

### Verwendungsfall

```typescript
// ✅ Perfekt für:
- Benutzer-Sessions
- UI-Preferences (Theme, Language)
- Feature-Flags
- Einfache Konfiguration
```

### Implementierung (5 Minuten)

```typescript
// src/lib/stores/authStore.svelte.ts
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';

interface UserSession {
    npub: string;
    loginMethod: 'nip07' | 'nsec';
    expiresAt: number;
}

export class AuthStore {
    // ✅ Fertig! Das ist alles:
    private sessionStore = persisted<UserSession | null>(
        'nostr-user-session',  // ← Statischer Key
        null                    // ← Default
    );
    
    public currentUser = $state<NDKUser | null>(null);
    public isAuthenticated = $derived(!!this.currentUser);
    
    // Update?
    public saveSession(user: NDKUser, method: string): void {
        this.sessionStore.set({
            npub: user.npub,
            loginMethod: method as any,
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
        });
        this.currentUser = user;
    }
    
    // Logout?
    public logout(): void {
        this.sessionStore.set(null);
        this.currentUser = null;
    }
    
    // Laden?
    public async loadSession(): Promise<void> {
        const session = get(this.sessionStore);
        if (session && session.expiresAt > Date.now()) {
            this.currentUser = await this.restoreUserFromSession(session);
        }
    }
}
```

**Das war's!** Keine `saveToStorage()`, keine `triggerUpdate()` - alles automatic.

### Vorteile

✅ Minimal Code (10-15 Zeilen)  
✅ Automatisches Speichern  
✅ SSR-sicher  
✅ Typsicher  

### ⚠️ Einschränkungen

❌ Nur 1 Key (nicht `kanban-${id}`)  
❌ Nur Plain Objects (nicht `new Board(...)`)  
❌ Keine async Initialization  

---

## 🏗️ Pattern 2: Manual localStorage - Für komplexe Stores

### Verwendungsfall

```typescript
// ✅ Perfekt für:
- Multi-Board-Verwaltung (Keys: kanban-${id})
- Klassen-Hierarchien (Board → Column → Card)
- Externe Config-Integration (fetch + Merge)
- Batch-Updates (mehrere Änderungen = 1 Save)
```

### Implementierung (15 Minuten)

```typescript
// src/lib/stores/kanbanStore.svelte.ts
import { Board, Column, Card } from '$lib/classes/BoardModel';

export class BoardStore {
    // 1️⃣ State mit dynamischer Key-Basis
    private board = $state<Board>(this.loadFromStorage());
    private updateTrigger = $state(0);
    
    // 2️⃣ Derived für UI-Transformation
    public uiData = $derived.by(() => {
        this.updateTrigger;  // ← Trigger MUSS gelesen werden!
        return this.transformToUI();
    });
    
    // 3️⃣ Laden mit dynamischem Key
    private loadFromStorage(): Board {
        const boardId = this.getCurrentBoardId();
        const key = `kanban-${boardId}`;  // ← Dynamisch!
        const stored = localStorage.getItem(key);
        
        if (stored) {
            return this.reconstructBoard(JSON.parse(stored));
        }
        return new Board({ name: 'Neues Board' });
    }
    
    // 4️⃣ Die zentrale Methode
    private triggerUpdate(): void {
        this.updateTrigger++;         // ← Triggert $derived
        this.saveToStorage();         // ← Persistiert sofort
    }
    
    // 5️⃣ Speichern mit dynamischem Key
    private saveToStorage(): void {
        const key = `kanban-${this.board.id}`;
        localStorage.setItem(key, JSON.stringify(
            this.board.getContextData(true)
        ));
    }
    
    // 6️⃣ Public API - ALLE Änderungen gehen durch triggerUpdate()
    public createCard(columnId: string, heading: string): void {
        this.board.findColumn(columnId)?.addCard({ heading });
        this.triggerUpdate();  // ← IMMER aufrufen!
    }
    
    public editCard(cardId: string, updates: Partial<CardProps>): void {
        const result = this.board.findCardAndColumn(cardId);
        result?.card.update(updates);
        this.triggerUpdate();  // ← IMMER aufrufen!
    }
    
    // 7️⃣ Klassen-Rekonstruktion (KRITISCH!)
    private reconstructBoard(data: any): Board {
        const board = new Board({
            id: data.id,
            name: data.name
        });
        
        data.columns?.forEach(colData => {
            const column = new Column({ 
                id: colData.id, 
                name: colData.name 
            });
            colData.cards?.forEach(cardData => {
                column.addCard(new Card(cardData));
            });
            board.addColumn(column);
        });
        
        return board;
    }
}
```

**Die Essenz:**
1. `$state` für reaktiven Zustand
2. `$derived.by()` für Transformationen
3. `triggerUpdate()` für Persistierung
4. Public API steuert alles

### 🔴 Goldene Regel

```
❌ FALSCH: board.findColumn('col-1').addCard({...})
   → Keine Persistierung!

✅ RICHTIG: boardStore.createCard('col-1', '...')
   → triggerUpdate() automatisch aufgerufen
```

### Vorteile

✅ Dynamische Keys (`kanban-${id}`)  
✅ Klassen-Support (Board, Column, Card)  
✅ Async Init möglich  
✅ Volle Kontrolle  

### ⚠️ Anforderungen

❌ Mehr Code-Setup  
❌ Manuelles `triggerUpdate()`  
❌ `getContextData()` auf allen Klassen  

---

## ✅ Checkliste für neue Stores

### Schritt 1: Pattern wählen

- [ ] Nur 1 Key + einfache Daten? → **persisted()**
- [ ] Mehrere Keys ODER Klassen ODER async? → **Manual localStorage**

### Schritt 2: Bei persisted()

```typescript
- [ ] .svelte.ts Datei?
- [ ] persisted<T>(key, default) importiert?
- [ ] Test: localStorage.setItem funktioniert?
```

### Schritt 3: Bei Manual localStorage

```typescript
// Core Structure
- [ ] private state = $state(this.loadFromStorage())
- [ ] private updateTrigger = $state(0)
- [ ] public uiData = $derived.by(() => { this.updateTrigger; ... })

// Methods
- [ ] private loadFromStorage()
- [ ] private saveToStorage()
- [ ] private triggerUpdate() ← ALLE Änderungen!
- [ ] private reconstructClasses()

// Public API
- [ ] createX() mit triggerUpdate
- [ ] updateX() mit triggerUpdate
- [ ] deleteX() mit triggerUpdate

// Validierung
- [ ] getContextData() auf ALLEN Klassen vorhanden?
- [ ] localStorage-Keys sind eindeutig?
- [ ] triggerUpdate() wird ÜBERALL aufgerufen?
```

---

## 🆕 Neue Stores in Zukunft

### ChatBotStore (Phase 3)

```typescript
// ✅ Manual localStorage!
// Grund: Dynamische Keys, Klassen-Hierarchien

export class ChatBotStore {
    private chatSession = $state(this.loadFromStorage());
    private updateTrigger = $state(0);
    
    private getStorageKey(): string {
        return `chat-${this.currentBoardId}`;  // ← Dynamisch!
    }
    
    public addMessage(text: string, role: 'user' | 'ai'): void {
        this.chatSession.messages.push({ text, role, timestamp: Date.now() });
        this.triggerUpdate();
    }
}
```

### SyncManager (Phase 1.2)

```typescript
// ✅ Manual localStorage!
// Grund: IndexedDB Queue, Event-Management

export class SyncManager {
    private eventQueue = $state(this.loadFromStorage());
    private updateTrigger = $state(0);
    
    public async publishOrQueue(event: NDKEvent): Promise<void> {
        if (navigator.onLine) {
            await this.publish(event);
        } else {
            this.eventQueue.push({ event, retries: 0 });
            this.triggerUpdate();
        }
    }
}
```

### Andere Stores?

```typescript
// Nutze diese Entscheidungshilfe:
SettingsStore      → Manual (async config.json)
NotificationStore  → persisted() (einfach)
SearchStore        → persisted() (einfach)
ThemeStore         → persisted() (einfach)
```

---

## 🎯 Die BaseComplexStore Abstraktion (Phase 1.6)

**Zukünftig:** Wenn 3+ Manual Stores existieren:

```typescript
export abstract class BaseComplexStore<T> {
    protected updateTrigger = $state(0);
    
    protected abstract getStorageKey(): string;
    protected abstract getData(): T;
    
    // ✅ Zentral - keine Duplikation!
    protected persistData(): void {
        localStorage.setItem(
            this.getStorageKey(),
            JSON.stringify(this.getData())
        );
    }
    
    protected triggerUpdate(): void {
        this.updateTrigger++;
        this.persistData();
    }
}

// Dann alle Manual Stores davon erben
export class BoardStore extends BaseComplexStore<Board> {
    public createCard(...) {
        // ...
        this.triggerUpdate();  // ← Erbt persistData()!
    }
}
```

---

## ❌ Anti-Patterns (NICHT machen!)

### 1. persisted() mit dynamischen Keys

```typescript
❌ const store = persisted(`key-${id}`, data);
   Key wird nur beim Import evaluiert!

✅ Nutze Manual localStorage stattdessen
```

### 2. Klassen in persisted()

```typescript
❌ const store = persisted<Board>('board', new Board(...));
   Board-Instanz wird zu Plain Object!

✅ Nutze Manual localStorage + reconstructBoard()
```

### 3. triggerUpdate() vergessen

```typescript
❌ this.board.findColumn('x').addCard({...});
   localStorage NICHT gespeichert!

✅ boardStore.createCard('x', '...');
```

### 4. getContextData() unvollständig

```typescript
❌ getContextData() {
       return { id: this.id, name: this.name };
       // author FEHLT!
   }

✅ getContextData() {
       return { 
           id: this.id, 
           name: this.name, 
           author: this.author  // ← ALLE Felder!
       };
   }
```

### 5. Mehrere persisted() für verwandte Daten

```typescript
❌ const userStore = persisted('user', null);
   const settingsStore = persisted('settings', {});

✅ const appStore = persisted('app', { 
       user: null, 
       settings: {} 
   });
```

---

## 🆘 FAQ - Die wichtigsten Fragen

### F: Kann ich persisted() und manual mixen?

**A:** Ja, für **verschiedene Domains**:
```typescript
// ✅ OK
export class AppStore {
    private session = persisted('session', null);     // Static
    private boards = $state(this.loadBoards());       // Dynamic
}
```

### F: Wie teste ich Manual localStorage?

**A:** Mock localStorage + Vitest:
```typescript
import { vi } from 'vitest';

global.localStorage = {
    getItem: vi.fn(() => '{"id":"1"}'),
    setItem: vi.fn(),
    clear: vi.fn()
} as any;

const store = new MyStore();
expect(localStorage.setItem).toHaveBeenCalled();
```

### F: Was ist getContextData()?

**A:** Serialisierungsmethode auf Model-Klassen:
```typescript
// In Board, Column, Card, etc.
getContextData(full: boolean = false): PlainObject {
    return {
        id: this.id,
        name: this.name,
        // ... ALLE Felder!
    };
}

// Wird für localStorage genutzt:
const json = this.board.getContextData(true);
localStorage.setItem('key', JSON.stringify(json));
```

### F: Wann migrieren (persisted → manual)?

**A:** Wenn du:
- Mehrere Keys brauchst
- Klassen einführst
- Async Init brauchst

Dann neuer Store.

### F: Warum nicht alles persisted()?

**A:** Weil:
- ❌ `persisted('board-${id}', ...)` funktioniert NICHT
- ❌ Klassen-Instanzen werden zerstört
- ❌ Keine async Initialization

---

## 📌 Zusammenfassung

| Wenn du... | Nutze | Grund |
|-----------|-------|-------|
| Einfache Session-Daten | persisted() | 1 Zeile Code |
| Multi-Board-System | Manual localStorage | Dynamische Keys |
| Externe Config laden | Manual localStorage | Async Init |
| KI-Chat-Verlauf | Manual localStorage | Klassen-Hierarchie |
| Nostr-Event-Queue | Manual localStorage | Komplexe Logik |

---

## 📚 Weiterführende Ressourcen

- **[STORES/README.md](../ARCHITECTURE/STORES/README.md)** — Store-API-Referenz
- **[STORES/AUTHSTORE.md](../ARCHITECTURE/STORES/AUTHSTORE.md)** — AuthStore Beispiel
- **[STORES/BOARDSTORE.md](../ARCHITECTURE/STORES/BOARDSTORE.md)** — BoardStore Beispiel
- **[TO-FIX/STORE-PATTERN-ANALYSIS.md](../TO-FIX/STORE-PATTERN-ANALYSIS.md)** — Historische Analyse (Warum?)

---

## 📝 Versionshistorie

| Version | Fokus | Zeilen |
|---------|-------|--------|
| v1.0 | Vollständige Analyse (mit Historie) | 1072 |
| v2.0 | **Praktische Zukunftsentwicklung** | **~300** |

**v2.0 Changes:**
- ✅ Nur praktische Zukunftsmuster
- ✅ Keine historische Analyse
- ✅ Schnelle Decision-Tables
- ✅ Copy-paste-ready Code-Templates
- ✅ Klare Checklisten
- ✅ 70% kürzer als v1.0

---

**Status:** ✅ PRAKTISCH & FOKUSSIERT  
**Zielgruppe:** Entwickler die JETZT Stores bauen  
**Aktualisierung:** 02.11.2025
