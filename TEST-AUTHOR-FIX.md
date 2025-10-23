# 🧪 Test-Anleitung: Author Field Attribution

Nachdem die Fixes implementiert wurden, können Sie diese schnell in der Browser Console testen:

## Schnellstart (5 Minuten)

### 1. Dev Server starten
```bash
pnpm run dev
# Öffne http://localhost:5174
```

### 2. Mit Dummy User einloggen
- Klicke auf **Login Button** (unten links in Sidebar)
- Wähle **"Dummy User (DEV)"** aus dem Dropdown
- Bestätige mit OK

```
✅ Sidebar sollte jetzt zeigen: Initials "D" + Grüner Avatar
```

### 3. Browser Console öffnen
- Drücke **F12** oder **Rechtsklick → Inspect → Console Tab**

### 4. Test: Board Author
```javascript
// Neues Board erstellen (über Board-List UI)
// Dann in Console:
console.log('Board Author:', boardStore.data.author);
// ✅ Expected: "npub1..." (pubkey, NICHT undefined!)
```

### 5. Test: Card Author
```javascript
// Neue Karte erstellen (über UI: "+" Button in Spalte)
// Dann in Console:
const firstCard = boardStore.data.columns[0].cards[0];
console.log('Card Author:', firstCard.author);
// ✅ Expected: "npub1..." (gleicher pubkey wie Board!)
```

### 6. Test: Comment Author
```javascript
// Karte öffnen → Kommentar hinzufügen → Dialog: Kommentar schreiben + Send
// Dann in Console:
const firstCard = boardStore.data.columns[0].cards[0];
if (firstCard.comments && firstCard.comments.length > 0) {
    console.log('Comment Author:', firstCard.comments[0].author);
    // ✅ Expected: "npub1..." (gleicher pubkey!)
}
```

---

## Expected Results

| Entity | Before Fix | After Fix |
|--------|------------|-----------|
| **Board.author** | `undefined` ❌ | `"npub1..."` ✅ |
| **Card.author** | `"npub1..."` ✅ | `"npub1..."` ✅ |
| **Comment.author** | `"anonymous"` ❌ | `"npub1..."` ✅ |

---

## Konsistenz Verification

Alle drei sollten den **gleichen** Public Key haben:

```javascript
const boardAuthor = boardStore.data.author;
const cardAuthor = boardStore.data.columns[0].cards[0].author;
const commentAuthor = boardStore.data.columns[0].cards[0].comments[0].author;

console.log('🔍 Sind alle gleich?', 
    boardAuthor === cardAuthor && cardAuthor === commentAuthor
);
// ✅ Expected: true
```

---

## Fallback Test (wenn User nicht authentifiziert)

```javascript
// Logout: Klick auf Avatar → Logout
// Dann versuche einen Kommentar hinzufügen

const firstCard = boardStore.data.columns[0].cards[0];
console.log('Comment author when not logged in:', 
    firstCard.comments[firstCard.comments.length - 1].author
);
// ✅ Expected: "anonymous" (fallback aktiv!)
```

---

## Vollständiger Console Snapshot

```javascript
// Alles auf einmal prüfen:
(() => {
    const board = boardStore.data;
    const card = board.columns[0]?.cards[0];
    const comment = card?.comments[0];
    
    console.log('📊 AUTHOR FIELD STATUS:');
    console.log('');
    console.log('Board Author:', board.author || 'MISSING ❌');
    console.log('Card Author:', card?.author || 'MISSING ❌');
    console.log('Comment Author:', comment?.author || 'MISSING ❌');
    console.log('');
    console.log('✅ All set correctly?', 
        board.author && card?.author === board.author && comment?.author === board.author
    );
})();
```

---

## Debugging bei Problemen

### Problem 1: Author ist immer noch 'anonymous'
```javascript
// Überprüfe ob authStore funktioniert
console.log('Current auth:', authStore.currentUser);
console.log('Pubkey:', authStore.getPubkey());
// Should show valid pubkey, not empty!
```

### Problem 2: Author ist undefined
```javascript
// Überprüfe localStorage
console.log('localStorage session:', localStorage.getItem('auth-session'));
// Should have JSON mit user data
```

### Problem 3: Kommentar zeigt alten Author
```javascript
// Aktualisiere Browser Cache
localStorage.removeItem('kanban-board-data');
location.reload();
```

---

## Nächste Schritte nach Test

Wenn alles grün ist ✅:
1. Commit the changes: `git add . && git commit -m "fix: author field attribution for boards and comments"`
2. Deploy to production
3. Celebrate! 🎉

---

**Alte Anleitung nicht mehr nötig - diese drei Fixes lösen das Problem komplett!**
