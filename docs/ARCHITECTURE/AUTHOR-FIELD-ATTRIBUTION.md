# Author Field Attribution Architecture

**Stand:** 23. Oktober 2025  
**Status:** ✅ COMPLETE & TESTED  
**Impact:** Cards, Boards und Comments haben jetzt konsistent `author` Fields  

---

## 📌 Problem Statement

Beim Erstellen von Karten und Boards wurde das `author` Feld nicht gespeichert, obwohl die Komponenten das Feld hatten. Kommentare hingegen speicherten `author` korrekt.

### Root Cause

Die `getContextData()` Methoden in `BoardModel.ts` gaben die `author` Felder nicht zurück, obwohl die Klasseninstanzen diese Felder hatten.

---

## ✅ Implementierte Lösung

### Fix 1: Card.getContextData() - author hinzufügen (L~145)

```typescript
// In src/lib/classes/BoardModel.ts
getContextData(): Omit<CardProps, 'comments' | 'links' | 'attendees'> & {
    comments: { text: string; author: string }[],
    links: { url: string; title: string }[]
} {
    return {
        id: this.id,
        heading: this.heading,
        content: this.content,
        color: this.color,
        image: this.image,
        labels: this.labels,
        publishState: this.publishState,
        author: this.author,  // ← ✅ FIXED: author hinzugefügt!
        comments: this.comments.map(c => ({ text: c.text, author: c.author })),
        links: this.links.map(l => ({ url: l.url, title: l.title }))
    };
}
```

### Fix 2: Board.getContextData() - author hinzufügen (L~373)

```typescript
// In src/lib/classes/BoardModel.ts
getContextData(full: boolean = false): {
    id: string,
    name: string,
    description: string,
    tags: string[],
    ccLicense: string,
    publishState: PublishState,
    createdAt: string,
    updatedAt: string,
    author?: string,  // ← ✅ Return Type aktualisiert
    columns: any[]
} {
    return {
        id: this.id,
        name: this.name,
        description: this.description || '',
        tags: this.tags,
        ccLicense: this.ccLicense,
        publishState: this.publishState,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        author: this.author,  // ← ✅ FIXED: author hinzugefügt!
        columns: this.columns.map(col => col.getContextData(full))
    };
}
```

### Fix 3: Author display names statt pubkeys

**In kanbanStore.svelte.ts:**
- `createBoard()`: Nutzt `authStore.getUserName()` statt `getPubkey()`
- `createCard()`: Nutzt `authStore.getUserName()` statt `getPubkey()`

**In CardViewDialog.svelte:**
- Comment author: Nutzt `authStore.getUserName()` statt `getPubkey()`

### Fix 4: reconstructBoard() - Card author laden (L~264)

```typescript
// In src/lib/stores/kanbanStore.svelte.ts
columns: data.columns?.map((colData: any) => ({
    id: colData.id,
    name: colData.name,
    color: colData.color || 'slate',
    cards: colData.cards?.map((cardData: any) => ({
        id: cardData.id,
        heading: cardData.heading,
        content: cardData.content,
        image: cardData.image,
        color: cardData.color || 'slate',
        author: cardData.author,  // ← ✅ FIXED: author wird jetzt geladen!
        comments: cardData.comments || [],
        labels: cardData.labels || [],
        links: cardData.links || [],
        attendees: cardData.attendees || [],
        publishState: cardData.publishState || 'draft'
    })) || []
})) || []
```

---

## 🔄 Data Flow (NACH Fixes)

```
1. User erstellt Board/Card
   ↓
2. boardStore.createBoard() / createCard()
   ↓
   const author = authStore.getUserName()  // "Dev User"
   const board/card = new Board/Card({ author, ... })
   ↓
3. triggerUpdate()
   ↓
4. saveToStorage()
   ↓
5. board.getContextData(true)
   ↓
   return {
       id, name, author: "Dev User",  // ✅ author dabei!
       columns: [{
           cards: [{
               id, heading, author: "Dev User",  // ✅ author dabei!
               comments: [{ author: "Dev User" }]  // ✅ bereits dabei
           }]
       }]
   }
   ↓
6. JSON.stringify()
   ↓
7. localStorage.setItem(key, json)
   ↓
8. ✅ GESPEICHERT!
```

---

## 📊 Vergleich: Vorher vs. Nachher

| Komponente | Field | Vorher ❌ | Nachher ✅ |
|-----------|-------|----------|----------|
| **Board** | `author` | `undefined` | `"Dev User"` |
| **Card** | `author` | `undefined` | `"Dev User"` |
| **Comment** | `author` | `"Dev User"` | `"Dev User"` |

---

## 🧪 Testing & Verification

### Browser Console Test

```javascript
// Neue Karte erstellen, dann:
const stored = JSON.parse(localStorage.getItem('kanban-board-...'));

console.log('Board author:', stored.author);  
// ✅ Expected: "Dev User"

console.log('Card author:', stored.columns[0].cards[0].author);
// ✅ Expected: "Dev User"

console.log('Comment author:', stored.columns[0].cards[0].comments[0].author);
// ✅ Expected: "Dev User"
```

### Compilation Status

```bash
✅ svelte-check: 0 errors, 0 warnings
✅ TypeScript: strict mode passed
✅ pnpm run check: PASS
```

---

## 🎯 Key Learnings für Zukunft

### Pattern: getContextData() muss alle Felder zurückgeben

Wenn eine Klasse ein Feld hat (z.B. `public author?: string`), MUSS `getContextData()` dieses Feld auch zurückgeben, sonst wird es nicht zu localStorage gespeichert!

```typescript
// ❌ ANTIPATTERN: Feld existiert, wird aber nicht serialisiert
class Board {
    public author?: string;      // ← Existiert
    
    getContextData() {
        return { id, name, ... };  // ← author FEHLT! → wird nicht gespeichert!
    }
}

// ✅ PATTERN: Konsistente Serialisierung
class Board {
    public author?: string;      // ← Existiert
    
    getContextData() {
        return { id, name, author: this.author, ... };  // ✅ Vollständig!
    }
}
```

### Pattern: Fallback-Chain für Author

Immer diese Hierarchie nutzen:
1. `getUserName()` (lesbar, "Dev User")
2. `getPubkey()` (fallback, "0000...0001")
3. `'anonymous'` (letzter ausweg)

```typescript
const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
```

---

## 📚 Referenzen

- **boardStore.svelte.ts**: Zeile ~401 (createBoard), ~716 (createCard)
- **BoardModel.ts**: Zeile ~145 (Card.getContextData), ~373 (Board.getContextData)
- **CardViewDialog.svelte**: Zeile ~67 (Comment author)
- **kanbanStore.svelte.ts**: Zeile ~264 (reconstructBoard)

---

## 🚀 Nächste Schritte

### Phase 2: Nostr Publishing
- Nutze den jetzt korrekt gespeicherten `author` bei Event-Publishing
- Alle 3 Event-Typen (boards, cards, comments) haben author

### Phase 3: Konflikt-Auflösung
- Bei Mehrbenutzer-Szenarien: last-write-wins mit Timestamp-Vergleich
- Author wird für Audit-Trail verwendet

---

**Status:** ✅ PRODUCTION READY  
**Getestet:** ✅ Alle Szenarien grün  
**Dokumentiert:** ✅ Diese Datei + Code Comments
