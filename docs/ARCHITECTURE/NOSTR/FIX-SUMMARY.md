# 🔧 Kurzübersicht: Karten-Deletion Bug Fix

## Das Problem
```
Neue Karte erstellen → wird publiziert → sofort gelöscht ❌
```

## Ursache
Die Nostr-Subscription empfängt das Board-Event (Kind 30301) zurück, aber:
- ❌ Das Board-Event enthält KEINE Karten-Daten
- ❌ `nostrEventToBoard()` erzeugt `columns: [{ cards: [] }]`
- ❌ Lokale Karten werden überschrieben → WEG!

## Lösung
**Merge-Strategie implementiert:** 
Wenn Subscription ein Board-Event erhält:
- ✅ Aktualisiere Spalten-Metadaten (name, color, order) 
- ✅ Behalte lokale Karten (sie sind separate Kind 30302 Events)

```typescript
// Merge: Remote-Metadaten + Lokale Karten
const mergedColumns = boardProps.columns.map((remoteCol, idx) => ({
    ...remoteCol,                        // Neue Metadaten
    cards: existingData.columns?.[idx]?.cards || [],  // ← Lokale Karten!
}));
```

## Status
- ✅ Code implementiert in `kanbanStore.svelte.ts`
- ✅ TypeScript-Check: 0 errors
- 🔄 Runtime-Test erforderlich

## Dokumentation
- 📚 `docs/ARCHITECTURE/NOSTR/LOADING-SUBSCRIPTION.md` - Merge-Strategie dokumentiert
- 📚 `docs/ARCHITECTURE/NOSTR/BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md` - Detaillierte Analyse

## Next
1. Browser testen: Neue Karte erstellen → bleibt?
2. Spalte umbenennen auf anderem Gerät → wird synchronisiert?
3. MRU-Board-Auswahl → noch ok?

**Nächste Phase:** Phase 1.2 wird Kind 30302 (Card-Events) implementieren und das System wird dann vollständig dezentralisiert sein.
