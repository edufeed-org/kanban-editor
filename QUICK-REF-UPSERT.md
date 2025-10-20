# Quick Reference: Upsert-Funktionen

## Browser Console - Copy & Paste Befehle

### Setup Demo-Board

```javascript
// 1. Board zurücksetzen
window.reset_board()

// 2. Demo-Daten laden
window.add_democontent()

// 3. Board-Status anschauen
window.count_board()
```

**Output:**
```
Spalten: 3
Karten: 8
Kommentare: 6
```

---

## ✅ Test 1: Upsert-Verhalten

```javascript
window.test_upsert()
```

**Was passiert:**
- Erstellt Karte mit ID `test-card-001`
- Ruft `upsertCard()` ERNEUT mit gleicher ID auf
- Zeigt dass Daten aktualisiert wurden (heading, content, author, publishState)
- Verifiziert dass **NUR 1 KARTE existiert** (kein Duplikat!)

**Erwartetes Ergebnis:**
```
✅ Karte gefunden: test-card-001
  Content: Updated content - sollte nicht dupliziert werden!
  Author: npub1test0000000000000000000000000002
  publishState: published

✅ Total Karten im Board: 11  ← Sollte 11 sein (nicht 12!)
✅ Test erfolgreich - keine Duplikate erstellt!
```

---

## ✅ Test 2: Duplikat-Verhinderung

```javascript
window.test_no_duplicate()
```

**Was passiert:**
- Erstellt Karte mit ID `no-dup-test-001`
- Ruft `upsertCard()` 3x mit gleicher ID auf
- Verifiziert dass nur **1 Karte** existiert

**Erwartetes Ergebnis:**
```
✅ Result:
  Karte ist NICHT dupliziert
  Aktueller heading: Karte 3  ← Letzte Version!
  Aktueller content: Content 3
  Aktueller author: npub1author0000000000000000000000003
```

---

## 🔍 Debug-Funktionen

### Alle Karten anschauen

```javascript
window.show_cards()
```

Zeigt alle Karten mit Kommentaren in tabellierter Form.

### Board-Übersicht

```javascript
window.show_board()
```

Zeigt:
- Spaltenname
- Anzahl Karten pro Spalte
- Alle Karten-IDs

---

## 📝 Manueller Test: Karte mit Author

```javascript
// In der Browser-Console:
const columns = boardStore.uiData;
const firstColumn = columns[0];
const firstCard = firstColumn.items[0];

console.log('Card:', firstCard.name);
console.log('Author:', firstCard.author);  // Sollte npub sein
console.log('ID:', firstCard.id);
```

Oder kürzer:

```javascript
boardStore.uiData[0].items[0]  // Erste Karte der ersten Spalte
```

---

## 🚀 Integration: Nostr Event → Upsert

```typescript
// Beispiel: Kind 30302 Event von Nostr empfangen
import type { NDKEvent } from '@nostr-dev-kit/ndk';

function handleNostrCard(event: NDKEvent) {
    const cardProps = {
        id: event.tags.find(t => t[0] === 'd')?.[1], // d-tag
        heading: 'My Card',
        content: event.content,
        author: event.pubkey,
        publishState: 'published'
    };

    // Upsert: Update falls vorhanden, sonst neu
    boardStore.upsertCard(targetColumnId, cardProps);
}
```

---

## 🎯 Vergleich: addCard vs upsertCard

| Operation | addCard() | upsertCard() |
|-----------|-----------|--------------|
| **ID erforderlich** | Nein (generiert) | Ja! (muss vorhanden sein) |
| **Duplikate** | ✅ Möglich (neue Karte) | ❌ Verhindert (Update) |
| **Use-Case** | UI: "Neue Karte" Button | Nostr: Event-Sync |
| **Spalten** | Spezifische Spalte | Spaltenübergreifend |

**Faustregel:**
- **addCard():** Von Benutzer erstellt (UI)
- **upsertCard():** Von Nostr/API empfangen (Sync)

---

## ⚠️ Häufige Fehler

### Fehler 1: Keine ID bei upsertCard()

```javascript
// ❌ FALSCH
boardStore.upsertCard(columnId, {
    heading: 'Test',
    content: 'No ID!'
    // ← Fehler: id fehlt!
});

// ✅ RICHTIG
boardStore.upsertCard(columnId, {
    id: 'my-card-123',  // ← ERFORDERLICH!
    heading: 'Test',
    content: 'Has ID'
});
```

### Fehler 2: Karte bewegt sich nicht

```javascript
// ❌ Erwartet: Karte wechselt zu neuer Spalte
boardStore.upsertCard(newColumnId, {
    id: 'existing-card-id',
    // ...
});
// ← Das passiert NICHT! Karte bleibt in alter Spalte

// ✅ Wenn verschieben gewünscht:
boardStore.moveCard(cardId, fromColumnId, toColumnId);
```

### Fehler 3: addCard statt upsertCard

```javascript
// ❌ FALSCH bei Nostr Sync (Duplikate!)
for (const event of nostrEvents) {
    boardStore.addCard(columnId, {  // ← addCard!
        id: event.d_tag,
        heading: event.title,
    });
}
// 2x mit gleicher ID = 2 Karten!

// ✅ RICHTIG bei Nostr Sync
for (const event of nostrEvents) {
    boardStore.upsertCard(columnId, {  // ← upsertCard!
        id: event.d_tag,
        heading: event.title,
    });
}
// 2x mit gleicher ID = 1 Karte (aktualisiert)
```

---

## 📊 Zusammenfassung

| Punkt | Details |
|-------|---------|
| **Spaltenübergreifend** | `boardStore.findCardAndColumn()` sucht überall |
| **ID = Eindeutig** | `upsertCard()` braucht props.id |
| **Update vs Insert** | Automatisch gewählt basierend auf ID |
| **Keine Bewegung** | Karte bleibt wo sie ist (Update), verschiebt sich nicht |
| **Author-Info** | `card.author` wird in UI angezeigt (npub-Vorschau) |
| **Duplikate-Sicher** | Mehrfache upsertCard() = nur letzter State zählt |

---

## Nächste Schritte

1. ✅ **Upsert-Logik implementiert**
2. ✅ **Test-Funktionen verfügbar**
3. ⏳ **Nostr Event Parser schreiben** (nostrEvents.ts)
4. ⏳ **SyncManager integrieren** (Offline Queue)
5. ⏳ **Live-Subscriptions einrichten** (NDK)

---

**Zuletzt aktualisiert:** 20. Oktober 2025
