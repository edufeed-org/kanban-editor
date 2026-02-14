Notwendige Fixes und ToDos für den Kanban Editor
===============================================

## Neuer Task: Sicherheits-Guard fuer Column-Patch-Events (Kind 8571)

- Problem: Column-Patch-Events (Spaltenname/-farbe/-reihenfolge) werden aktuell ohne harten Rollencheck angewendet.
- Risiko: Fremde Publisher koennen potenziell Spalten-Metadaten beeinflussen, wenn Event-Filter greifen.
- Ziel: Inbound-Patch nur akzeptieren, wenn `event.pubkey` entweder `board.author` oder in `board.maintainers` enthalten ist.
- Umsetzung:
  - Guard im Patch-Handler/Apply-Pfad einbauen (`publisherPubkey` verbindlich validieren).
  - Ungueltige Events mit Debug/Warn skippen (kein Apply, kein local persist).
  - Vorhandene Owner-only-Regel fuer 30301 unveraendert lassen.
- Tests:
  - `editor`-Patch wird angewendet.
  - `owner`-Patch wird angewendet.
  - Fremder Pubkey wird verworfen.
  - LWW-Verhalten bleibt intakt.

## Neuer Task: Sicherheits-Guard fuer Card-Events (Kind 30302)

- Problem: Card-Events werden aktuell ohne harten Publisher-Rollencheck verarbeitet.
- Risiko: Fremde Publisher koennen Card-Inhalte, Positionen (rank/column) oder Loeschungen im Client beeinflussen.
- Ziel: Inbound-Card nur akzeptieren, wenn `event.pubkey` entweder `board.author` oder in `board.maintainers` enthalten ist.
- Optional: `card.author` nicht als harte Sperre fuer Updates erzwingen, damit Maintainer kollaborativ alle Cards bearbeiten koennen.
- Umsetzung:
  - Guard in `handleCardEvent` vor `upsertCardFromNostr()` / `upsertCardToBackgroundBoard()` einbauen.
  - Ungueltige Events mit Debug/Warn skippen (kein Apply, kein local persist).
  - Bestehende LWW-/Tie-Break-Logik unveraendert lassen.
- Tests:
  - Owner-Card-Update wird angewendet.
  - Maintainer-Card-Update wird angewendet.
  - Fremder Pubkey wird verworfen.
  - Background-Board-Sync respektiert den Guard.
