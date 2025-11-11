// src/lib/stores/boardstore/types.ts
// UI-Typen für Kompatibilität mit bestehenden Komponenten

import type { PublishState } from '../../classes/BoardModel.js';

export type CardItem = {
    id: number | string;
    name: string;
    description?: string;
    comments?: any[];
    attendees?: string[];
    labels?: string[];
    links?: { id: string; url: string; title: string }[]; // ← ✅ FIXED: links Array hinzufügen!
    color?: string;
    publishState?: PublishState;
    author?: string;
    authorName?: string; // Display name (readable), author = pubkey (Nostr)
    image?: string;
    link?: string;
    columnId?: string;
    boardId?: string;
};

export type UIColumn = {
    id: string;
    name: string;
    description?: string;
    color?: string;
    items: CardItem[];
};
