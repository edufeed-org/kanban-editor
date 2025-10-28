NIP for Kanban Boards
Nostr Implementation Proposal 
Copyright (c) 2025 Vivek Ganesan: https://raw.githubusercontent.com/vivganes/kanbanstr/refs/heads/main/NIP-100.md
======

Kanban Boards
------------

`private` `optional`

This NIP defines a protocol for creating and managing Kanban boards on Nostr.

## Abstract

This NIP introduces event kinds and conventions for implementing Kanban boards, allowing users to create boards with multiple columns and cards that can be organized and tracked in a visual workflow.

## Motivation

Kanban boards are a popular project management tool that enables visual organization of tasks and workflows. Adding native Kanban support to Nostr allows for decentralized project management while maintaining the platform's permissionless and censorship-resistant nature.

## Specification

### Board Event 

```javascript
{
    "created_at": 34324234234, //<Unix timestamp in seconds>
    "kind": 30301,
    "tags": [
        ["d", "<board-d-identifier>"],
        ["title", "Board Name"],
        ["description","Board Description"], //can contain markdown too
        ["pub","private"], //publication state: 'private' or 'published'
        ["alt","A board to track my work"], //Human-readable plaintext summary to be shown in non-supporting clients - as per NIP-31

        // List of all columns in the board below in format ["col","col-id","name","order"]
        ["col", "col1-id", "To Do", "0"],
        ["col", "col2-id", "In Progress", "1"], 
        ["col", "col3-id", "Done", "2"],

        // Clients may designate a 'maintainers' list who can add/edit cards in this board
        [ "p", "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2" ],  
        [ "p", "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52" ],  
        [ "p", "460c25e682fda7832b52d1f22d3d22b3176d972f60dcdc3212ed8c92ef85065c" ],   
    // other fields...
    ]
}
```

**⚠️ CRITICAL:** Board `p` tags grant **edit permission** (maintainers), NOT just notification/assignment.
Only the Board creator and designated maintainers can publish new Card events under this Board's d-tag.

In case there are no `p` tags to designate maintainers, the owner of the board is the only person who can publish cards on the boards.

Editing the board event is possible only by the creator of the board. 

### Card Event

```javascript
{
    "created_at": 34324234234, //<Unix timestamp in seconds>
    "kind": 30302,
    "tags": [
        ["d", "<card-d-identifier>"],
        ["title", "Card Title"],
        ["description","Card Description"], //can contain markdown too
        ["pub","private"], //publication state: 'private' or 'published'
        ["alt","A card representing a task"], //Human-readable plaintext summary to be shown in non-supporting clients - as per NIP-31
        ["s", "col2-id"],              // PRIMARY: Unique column reference
        ["col_label", "In Progress"],  // SECONDARY: Human-readable for display
        ["rank","10"], // order of the card in the column - cards may be displayed in the ascending order of rank by default

        // card url attachments with 'u' tags similar to NIP-98
        ["u","https://attachment1"],
        ["u","https://attachment2"],

        // add assignees using 'p' tag (METADATA ONLY - NOT EDIT PERMISSION)
        [ "p", "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2"],
        [ "p", "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52"],  
        [ "p", "460c25e682fda7832b52d1f22d3d22b3176d972f60dcdc3212ed8c92ef85065c"], 

        // The board this card will be a part of. 
        ["a", "30301:<board-creator-pubkey>:<board-d-identifier>", "<optional-relay-url>"],  
       
    ],
    // other fields...
}
```

**⚠️ CRITICAL:** Card `p` tags are for **assignees only** (metadata), NOT edit permission!
- Only Board p-tags (from the 30301 event) grant write permission
- To publish a Card, signer MUST be: Card author OR Board creator OR Board maintainer
- Card assignees have NO special permissions (it's just metadata for UI)

When editing a card, the maintainers can copy the card event with the `d` tag intact and publish a new event. 

When a client gets multiple card events with the same `d` tag, it takes the latest one by any maintainer or the creator of the board event as the source of truth.

### Tracker Card Event

In case one wants to just track another nostr event (like a tracker card, without modifying the original event), one can designate a tracker card using a `k` tag to denote kind and `e` tag to denote the nostr event to be tracked.  

```javascript
{
    "created_at": 34324234234, //<Unix timestamp in seconds>
    "kind": 30302,
    "tags": [
        ["d", "<new-tracker-card-d-identifier>"],
        ["k", "1"], //this one tracks a text note
        ["e", "<event-id>", "<relay-url>"] // as per NIP-10 
        // other fields as per card event above...
    ],
}
```
In case of tracking a replaceable event, one can use `a` tag instead of the `e` tag above.

In case of tracking another Kanban card (30302) event, one cannot use 'a' tag as that is already used for board association.  Hence, we use tags similar to git issues (NIP-34)
```javascript
{
    "created_at": 34324234234, //<Unix timestamp in seconds>
    "kind": 30302,
    "tags": [
        ["d", "<new-tracker-card-d-identifier>"],
        ["k", "30302"], //this one tracks a text note
        ["refs/board", "30301:<target-board-creator-pubkey>:<target-board-d-identifier>"], // very much like git issues
        ["refs/card", "<tracked-card-d-identifier>"
    ],
}
```

The clients MAY display this tracker card like they display the tracked event, or using the 'alt' tag of the original event if not supported.

Any `30302` event with a `k` tag will be treated as a tracker card.

#### Automatic movement of tracker cards

In case of tracked card, its status is deemed to be the `s` tag value of the event it tracks. 

This allows the automatic movement of a card (like a Git issue) across different columns as the card's status changes in the source system, without any manual updates in the board.  

If the tracked event does not have an `s` tag, then tracker card event's `s` tag is shown as the status of the card.

### Linking a card to another card

To establish relationships like parent-child, blocked by, etc, we need the possibility link a card to another card using a relationship.

In order to link any card to an existing card, we add a `refs/link` tag to it with the following format

```javascript
['i','kanban:<target-board-creator-pubkey>:<target-board-d-identifier>:<linked-card-d-identifier>','link label','link label for the reverse direction']
```

For example, to designate a card as a child of another card, you could add the tag

```javascript
['i','kanban:<board-of-parent-card-creator-pubkey>:<board-of-parent-card-d-identifier>:<parent-card-d-identifier>','is a child of','is a parent of']
```

In order to say that the current card is blocked by another card, you could add the tag

```javascript
['i','kanban:<board-of-blocker-card-creator-pubkey>:<board-of-blocker-card-d-identifier>:<blocker-card-d-identifier>','is blocked by','blocks']
```

Clients MAY show easy drop-downs to designate the link labels so that the users don't have to type it.



### Event Kinds

- 30301: Kanban Board Definition
- 30302: Kanban Card

### Required Tags

#### Board Events (kind: 30301)
- `d`: Unique identifier for the board
- `title`: Board name

#### Card Events (kind: 30302)
- `d`: Unique identifier for the card
- `title`: Card title
- `a`: This points to the board that this card belongs to

### Access Control

1. Only the board creator can:
   - Modify board

2. Only the board maintainers can:
   - Add a card to the board
   - Publish edits to the existing cards (including the status)

2. Any user can:
   - View the board and cards
   - React, comment, zap on board and cards

### Client Behavior

Clients MAY:
- Display boards in a visual column layout
- Allow drag-and-drop card movement for authorized users
- Implement proper authorization checks before allowing modifications
- Implement additional features like card labels, due dates, or assignments
- Support board templates
- Provide filtering and search capabilities
- Prioritize to show the maintainer comments on cards

## Security Considerations

1. Clients MUST verify event signatures and delegation tokens before allowing modifications
2. Relays MAY implement additional spam prevention measures
3. Relays MAY choose to retain only a few recent versions of board and card events.

## Implementation Notes

To maintain a consistent board state:

1. Clients should handle concurrent updates by:
   - Using the event timestamp to resolve conflicts
   - Maintaining card order within columns

2. For performance, clients can:
   - Cache board and card data locally
   - Use efficient subscription filters when requesting updates

## Client-Relay Communication Example

```javascript
// Subscribe to the cards of a board
{
"kinds": [30302],
"#a": ["30301:<board-creator-pubkey>:<board-d-identifier>"]
}
```

### Private & Collaborative Boards

To support private boards accessible only to a specific group of users, this NIP proposes the use of **NIP-59 Gift Wrap**. All events associated with a private board MUST be wrapped within a `kind: 1059` (GiftWrap) event. This allows for efficient filtering using a context tag on the outer wrapper.

**Principle:** A unique, non-human-readable context tag is created by hashing the board's unique address (`<kind>:<pubkey>:<d-tag>`). This hash is added as a `t`-tag to the outer `kind: 1059` wrapper, allowing clients to fetch only events related to a specific board.

---

#### Example 1: Creating a Private Board

Let's assume a board with two members: `<creator-pubkey>` and `<member1-pubkey>`.

**1. Define Board Address and Context Hash:**
-   Board Address: `30301:<creator-pubkey>:my-private-project`
-   Context Hash (`t`-tag): `sha256("30301:<creator-pubkey>:my-private-project")` -> `8c8a...`

**2. Create the Inner Board Event (`kind: 30301`):**
This is a standard board event, but it **must** include `p`-tags for all members.

```javascript
// Inner Event (The "Gift")
{
    "kind": 30301,
    "pubkey": "<creator-pubkey>",
    "created_at": ...,
    "tags": [
        ["d", "my-private-project"],
        ["title", "My Secret Project"],
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"]
        // ... other board tags like "col"
    ],
    "content": "A private board for planning world domination."
}
```

**3. Wrap it in a `kind: 1059` Event:**
This is the event that gets published to relays.

```javascript
// Outer Wrapper (Published Event)
{
    "kind": 1059,
    "pubkey": "<creator-pubkey>",
    "created_at": ...,
    "tags": [
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"],
        ["t", "8c8a..."] // The context hash for efficient filtering
    ],
    "content": "    "content": "<encrypted JSON of the inner kind: 1 event>"
}
```

---

## 3. Snapshot Event (Kind 30303)

**Status:** Non-Replaceable  
**Purpose:** Manual snapshots of complete board state for version control & rollback

```javascript
{
    "kind": 30303,           // Non-replaceable
    "created_at": 1730000000,
    "tags": [
        ["a", "30301:<board-creator-pubkey>:<board-d-identifier>"],
        
        // Snapshot Metadata
        ["v", "Sprint-3 Planning"],  // User label (not version number!)
        ["r", "manual"],              // Reason: 'manual' (user-clicked button)
        ["t", "1730000000"]           // Timestamp
    ],
    "content": "{...complete board JSON with all cards...}"
}
```

**Content Format:**
```json
{
    "id": "project-alpha",
    "name": "Project Alpha",
    "description": "Board Description",
    "columns": [
        {
            "id": "col1",
            "name": "Backlog",
            "cards": [
                { "id": "card1", "heading": "Task 1", "content": "...", ... }
            ]
        }
    ],
    "publishState": "private",
    "author": "<board-creator-pubkey>"
}
```

**Key Points:**
- ✅ **Non-replaceable:** Every snapshot creates a new event (no overwrites)
- ✅ **Complete state:** Full board JSON in content (no need to fetch old 30302s)
- ✅ **User-labeled:** `v` tag contains user description (e.g. "Before Refactor")
- ✅ **Rollback:** Restore to any snapshot by loading JSON + reconstructing board

**Relay Query (load all snapshots for a board):**
```javascript
{
    "kinds": [30303],
    "#a": ["30301:<board-creator-pubkey>:<board-d-identifier>"]
}
```

---

## 4. Ephemeral "Now Editing" Event (Kind 20001)

**Status:** Ephemeral (not persisted)  
**Purpose:** Soft lock - indicate that a user is currently editing a card

```javascript
{
    "kind": 20001,           // Ephemeral (TTL ~5 min)
    "created_at": 1730000000,
    "tags": [
        ["a", "30302:<card-creator-pubkey>:<card-d-identifier>"],
        ["d", "editing-<card-id>"],
        ["expires", "1730000300"]  // 5 min TTL
    ],
    "content": "{ \"user\": \"Alice\", \"clientId\": \"xyz...\", \"startedAt\": \"2025-10-26T10:00:00Z\" }"
}
```

**Key Points:**
- ✅ **Ephemeral:** Not persisted by relays (expires after TTL)
- ✅ **Warning signal:** Other clients see this event and show warning (Anna is editing)
- ✅ **Soft lock:** Not a hard lock - Paul can still edit, but sees warning
- ✅ **Auto-refresh:** Client republishes every 4 min (before expiration)

**Use Case (Conflict Prevention):**
```
09:00 Anna opens card → publishes Kind 20001 event
09:02 Paul opens same card → sees ephemeral event, shows warning
09:05 Anna saves → Conflict detection runs (3-way merge)
09:10 Both changes merged & published
```

---

## Reference: Tag Summary

| Tag | Kind | Purpose | Example |
|-----|------|---------|---------|
| `d` | 30301, 30302, 30303 | Event ID | `"project-alpha"` |
| `a` | 30303, 20001 | Reference to other event | `"30301:pubkey:board-id"` |
| `v` | 30303 | Version/Snapshot label | `"Sprint-3 Planning"` |
| `r` | 30303 | Reason (manual/auto) | `"manual"` |
| `t` | 30303 | Timestamp | `"1730000000"` |
| `title` | 30301 | Board name | `"Project Alpha"` |
| `description` | 30301 | Board description | `"..."` |
| `pub` | 30301, 30302 | Publish state | `"private"` or `"published"` |
| `col` | 30301 | Column definition | `["col", "id", "name", "order"]` |
| `s` | 30302 | Column reference | `"col-id"` |
| `p` | 30301, 30302, 30303 | Pubkey (maintainer/author) | `"82341f..."` |
| `u` | 30302 | URL attachment | `"https://..."` |
| `expires` | 20001 | Expiration timestamp | `"1730000300"` |

---
````"
}
```

---

#### Example 2: Adding a Card to the Private Board

**1. Create the Inner Card Event (`kind: 30302`):**
The card references the board via the `a`-tag and also includes `p`-tags for the group.

```javascript
// Inner Event (The "Gift")
{
    "kind": 30302,
    "pubkey": "<creator-pubkey>",
    "created_at": ...,
    "tags": [
        ["d", "new-card-123"],
        ["title", "Design the Lair"],
        ["a", "30301:<creator-pubkey>:my-private-project"],
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"]
    ],
    "content": "The lair needs a volcano."
}
```

**2. Wrap it in a `kind: 1059` Event:**
The wrapper uses the **same context hash (`t`-tag)** as the board.

```javascript
// Outer Wrapper (Published Event)
{
    "kind": 1059,
    "pubkey": "<creator-pubkey>",
    "created_at": ...,
    "tags": [
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"],
        ["t", "8c8a..."] // The SAME context hash
    ],
    "content": "<encrypted JSON of the inner kind: 30302 event>"
}
```

---

#### Example 3: Commenting on a Private Card

**1. Create the Inner Comment Event (`kind: 1`):**
The comment references the card via the `a`-tag.

```javascript
// Inner Event (The "Gift")
{
    "kind": 1,
    "pubkey": "<member1-pubkey>",
    "created_at": ...,
    "tags": [
        ["a", "30302:<creator-pubkey>:new-card-123"],
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"]
    ],
    "content": "A shark tank would also be a great addition."
}
```

**2. Wrap it in a `kind: 1059` Event:**
Again, the wrapper uses the same board context hash.

```javascript
// Outer Wrapper (Published Event)
{
    "kind": 1059,
    "pubkey": "<member1-pubkey>",
    "created_at": ...,
    "tags": [
        ["p", "<creator-pubkey>"],
        ["p", "<member1-pubkey>"],
        ["t", "8c8a..."] // The SAME context hash
    ],
    "content": "<encrypted JSON of the inner kind: 1 event>"
}
```