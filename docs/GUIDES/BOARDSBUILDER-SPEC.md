# BOARDSBUILDER-SPEC

Kurzanleitung fuer Entwickler, die ein Kanban-Board aus Nostr-Events in einer eigenen Web-Anwendung darstellen wollen.

---

## Ziel

Ein Board vollstaendig rekonstruieren inklusive:
- Board-Metadaten und Spalten
- Karten
- Kommentare
- Fremdaenderungen (Column-Patches)
- Loeschungen

---

## Event-Typen (Pflicht)

- `30301` Board-Definition (Owner Source of Truth)
- `30302` Cards (addressable, board-gebunden ueber `#a`)
- `8571` Column-Patches (Reorder, Column-Updates, `del`, `del-card`)
- `5` NIP-09 Deletions (Board/Card)
- `1` Kommentare (pro Card, ueber `#a`)

Ohne `8571` und `5` ist das Ergebnis in kollaborativen Boards unvollstaendig.

---

## Ladefilter

`<boardRef>` = `30301:<ownerPubkey>:<boardId>`

1. Board:
```json
{ "kinds": [30301], "authors": ["<ownerPubkey>"], "#d": ["<boardId>"] }
```

2. Cards:
```json
{ "kinds": [30302], "#a": ["<boardRef>"] }
```

3. Column-Patches (robust):
```json
{ "kinds": [8571], "#a": ["<boardRef>"] }
{ "kinds": [8571], "#d": ["<boardId>"] }
```

4. Deletions:
```json
{ "kinds": [5] }
```

5. Kommentare (pro Karte):
```json
{ "kinds": [1], "#a": ["30302:<cardAuthor>:<cardId>"] }
```

---

## Merge-Reihenfolge (wichtig)

1. `30301` anwenden (Spaltenbasis erzeugen)
2. `30302` Cards einhaengen (`s` = columnId, `rank` merken)
3. `8571` Patches anwenden:
   - `order` fuer Spaltenreihenfolge
   - `col` fuer Name/Farbe
   - `del` fuer Spalten-Loeschung
   - `del-card` fuer Karten-Loeschung
4. `5` Deletions anwenden (autorisierte `a`-Tags)
5. Kommentare (`1`) je Card mergen
6. Final pro Spalte nach `rank` sortieren

Empfehlung fuer LWW:
- primär `updated_at_ms` (Patch) bzw. `ts` (Card-Tag)
- fallback `created_at`
- bei Gleichstand deterministischer Tie-Breaker (`event.id`)

---

## Minimal-Algorithmus (Pseudo)

```ts
board = load30301(ownerPubkey, boardId);
cards = load30302(boardRef);
patches = load8571(boardRef, boardId);
deletions = loadKind5();

applyBoard(board);
applyCards(cards);
applyPatches(sortByLww(patches));
applyDeletions(deletions);

for (const card of allCards(board)) {
  const comments = loadComments(card.author, card.id);
  mergeComments(card, comments);
}

sortCardsPerColumnByRank(board);
render(board);
```

---

## Live-Updates (optional, empfohlen)

Abonniere fuer Echtzeit:
- `30301` (Owner-Board-Updates)
- `30302` (`#a=<boardRef>`)
- `8571` (`#a=<boardRef>` und `#d=<boardId>`)
- `5` (Deletions)
- `1` je geoeffneter Card

---

## Referenz im Repo

- `src/lib/stores/boardstore/nostr.ts`
- `src/lib/stores/boardstore/nostr/subscriptions.ts`
- `src/lib/stores/boardstore/nostr/handlers/columnOrderPatch.ts`
- `src/lib/stores/boardstore/nostr/handlers/card.ts`
- `src/lib/utils/nostrEvents.ts`

---

## NDK Example: Komplettes Board zusammensetzen

```ts
import type NDK from '@nostr-dev-kit/ndk';

type UiCard = {
  id: string;
  heading: string;
  content?: string;
  author?: string;
  rank?: number;
  eventId?: string;
  comments: Array<{ id: string; text: string; author: string; createdAt?: number }>;
};

type UiColumn = {
  id: string;
  name: string;
  color?: string;
  cards: UiCard[];
};

type UiBoard = {
  id: string;
  owner: string;
  name: string;
  description?: string;
  columns: UiColumn[];
};

const KINDS = {
  BOARD: 30301,
  CARD: 30302,
  PATCH: 8571,
  COMMENT: 1,
  DELETE: 5,
} as const;

const asMs = (value?: number): number => (typeof value === 'number' ? value * 1000 : 0);

export async function buildBoardFromNostr(
  ndk: NDK,
  ownerPubkey: string,
  boardId: string
): Promise<UiBoard | null> {
  const boardRef = `30301:${ownerPubkey}:${boardId}`;

  // 1) Basis-Events laden
  const [boardEvent, cardEvents, patchByA, patchByD, deleteEvents] = await Promise.all([
    ndk.fetchEvent({
      kinds: [KINDS.BOARD],
      authors: [ownerPubkey],
      '#d': [boardId],
    } as any),
    ndk.fetchEvents({
      kinds: [KINDS.CARD],
      '#a': [boardRef],
    } as any),
    ndk.fetchEvents({
      kinds: [KINDS.PATCH],
      '#a': [boardRef],
    } as any),
    ndk.fetchEvents({
      kinds: [KINDS.PATCH],
      '#d': [boardId],
    } as any),
    ndk.fetchEvents({
      kinds: [KINDS.DELETE],
    } as any),
  ]);

  if (!boardEvent) return null;

  // 2) Board aus 30301 aufbauen
  const title = boardEvent.tags.find((t: string[]) => t[0] === 'title')?.[1] || 'Unnamed board';
  const description = boardEvent.tags.find((t: string[]) => t[0] === 'description')?.[1] || '';

  const columns: UiColumn[] = boardEvent.tags
    .filter((t: string[]) => t[0] === 'col')
    .map((t: string[]) => ({
      id: t[1],
      name: t[2] || 'Column',
      color: t[4] || undefined,
      cards: [],
    }))
    .sort((a, b) => {
      const ta = boardEvent.tags.find((t: string[]) => t[0] === 'col' && t[1] === a.id);
      const tb = boardEvent.tags.find((t: string[]) => t[0] === 'col' && t[1] === b.id);
      return Number(ta?.[3] ?? 0) - Number(tb?.[3] ?? 0);
    });

  const board: UiBoard = {
    id: boardId,
    owner: ownerPubkey,
    name: title,
    description,
    columns,
  };

  const columnById = new Map(board.columns.map((c) => [c.id, c]));

  // 3) Cards (30302) einhaengen
  for (const event of cardEvents) {
    const d = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
    const s = event.tags.find((t: string[]) => t[0] === 's')?.[1]; // columnId
    const heading = event.tags.find((t: string[]) => t[0] === 'title')?.[1] || 'Untitled';
    const content = event.tags.find((t: string[]) => t[0] === 'description')?.[1] || event.content || '';
    const rankRaw = event.tags.find((t: string[]) => t[0] === 'rank')?.[1];
    const rank = rankRaw !== undefined ? Number(rankRaw) : undefined;

    if (!d || !s) continue;
    const col = columnById.get(s);
    if (!col) continue;

    col.cards.push({
      id: d,
      heading,
      content,
      author: event.pubkey,
      rank: Number.isFinite(rank) ? rank : undefined,
      eventId: event.id,
      comments: [],
    });
  }

  // 4) Patches (8571) zusammenfuehren (OR aus #a + #d, dann dedupe per event.id)
  const patchMap = new Map<string, any>();
  for (const e of [...patchByA, ...patchByD]) {
    if (e?.id) patchMap.set(e.id, e);
  }

  const patches = [...patchMap.values()].sort((a, b) => {
    const aMs = Number(a.tags.find((t: string[]) => t[0] === 'updated_at_ms')?.[1] || 0) || asMs(a.created_at);
    const bMs = Number(b.tags.find((t: string[]) => t[0] === 'updated_at_ms')?.[1] || 0) || asMs(b.created_at);
    return aMs - bMs;
  });

  for (const patch of patches) {
    const tags: string[][] = patch.tags || [];

    // 4.1 Column metadata updates
    for (const t of tags.filter((x) => x[0] === 'col')) {
      const [_, colId, name, color] = t;
      const col = columnById.get(colId);
      if (!col) continue;
      if (name) col.name = name;
      if (color) col.color = color;
    }

    // 4.2 Deleted columns
    const deletedCols = new Set(tags.filter((x) => x[0] === 'del').map((x) => x[1]));
    if (deletedCols.size > 0) {
      board.columns = board.columns.filter((c) => !deletedCols.has(c.id));
      for (const id of deletedCols) columnById.delete(id);
    }

    // 4.3 Deleted cards
    const deletedCards = new Set(tags.filter((x) => x[0] === 'del-card').map((x) => x[1]));
    if (deletedCards.size > 0) {
      for (const col of board.columns) {
        col.cards = col.cards.filter((card) => !deletedCards.has(card.id));
      }
    }

    // 4.4 Column order
    const orderTag = tags.find((x) => x[0] === 'order');
    if (orderTag && orderTag.length > 1) {
      const wanted = orderTag.slice(1);
      const byId = new Map(board.columns.map((c) => [c.id, c]));
      const ordered = wanted.map((id) => byId.get(id)).filter(Boolean) as UiColumn[];
      const rest = board.columns.filter((c) => !wanted.includes(c.id));
      board.columns = [...ordered, ...rest];
    }
  }

  // 5) Deletions (Kind 5) anwenden (Board/Card)
  for (const event of deleteEvents) {
    const aTags = (event.tags || []).filter((t: string[]) => t[0] === 'a').map((t: string[]) => t[1]);
    for (const ref of aTags) {
      if (!ref) continue;
      if (ref.startsWith(`30301:${ownerPubkey}:${boardId}`)) {
        return null; // Board geloescht
      }
      if (ref.startsWith('30302:')) {
        const cardId = ref.split(':').slice(2).join(':');
        for (const col of board.columns) {
          col.cards = col.cards.filter((c) => c.id !== cardId);
        }
      }
    }
  }

  // 6) Kommentare pro Card laden
  for (const col of board.columns) {
    for (const card of col.cards) {
      const cardRef = `30302:${card.author || ownerPubkey}:${card.id}`;
      const comments = await ndk.fetchEvents({
        kinds: [KINDS.COMMENT],
        '#a': [cardRef],
      } as any);

      card.comments = [...comments]
        .map((e) => ({
          id: e.id || `${card.id}-${e.created_at || 0}`,
          text: e.content || '',
          author: e.pubkey,
          createdAt: e.created_at,
        }))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }
  }

  // 7) Final: Rank-Sort innerhalb jeder Spalte
  for (const col of board.columns) {
    col.cards.sort((a, b) => {
      const ar = a.rank ?? Number.MAX_SAFE_INTEGER;
      const br = b.rank ?? Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      // deterministic fallback
      return (a.eventId || '').localeCompare(b.eventId || '');
    });
  }

  return board;
}
```
