/**
 * Card-Operations für BoardStore
 * 
 * Enthält alle CRUD-Operationen für Cards:
 * - createCard, updateCard, deleteCard
 * - moveCard, upsertCard
 * - setCardPublishState
 * - addComment, deleteComment
 */

import type { Board, Card, CardProps } from '$lib/classes/BoardModel.js';
import { authStore } from '../authStore.svelte.js';

/**
 * Erstellt eine neue Card in einer Column
 */
export function createCard(
    board: Board,
    columnId: string,
    name: string = 'Neue Karte',
    description?: string
): Card {
    const author = authStore.getPubkey() || 'anonymous';
    const authorName = authStore.getUserName() || author;
    
    const cardProps: CardProps = {
        heading: name,
        content: description || 'Bitte bearbeiten...',
        publishState: 'draft',
        author: author,
        authorName: authorName
    };
    
    const column = board.findColumn(columnId);
    if (!column) {
        throw new Error(`Column ${columnId} not found`);
    }
    
    const card = column.addCard(cardProps);
    console.log('✅ Card erstellt:', card.id);
    
    return card;
}

/**
 * Updated eine bestehende Card
 */
export function updateCard(
    board: Board,
    cardId: string,
    updates: {
        name?: string;
        description?: string;
        image?: string;
        color?: string;
        labels?: string[];
    }
): void {
    const result = board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card ${cardId} not found`);
    }
    
    const cardProps: Partial<CardProps> = {};
    if (updates.name !== undefined) cardProps.heading = updates.name;
    if (updates.description !== undefined) cardProps.content = updates.description;
    if (updates.image !== undefined) cardProps.image = updates.image;
    if (updates.color !== undefined) cardProps.color = updates.color;
    if (updates.labels !== undefined) cardProps.labels = updates.labels;
    
    result.card.update(cardProps);
}

/**
 * Löscht eine Card
 */
export function deleteCard(board: Board, cardId: string): void {
    const result = board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card ${cardId} not found`);
    }
    
    result.column.deleteCard(cardId);
    console.log('🗑️ Card gelöscht:', cardId);
}

/**
 * Verschiebt eine Card zwischen Columns
 */
export function moveCard(
    board: Board,
    cardId: string,
    fromColumnId: string,
    toColumnId: string
): void {
    if (fromColumnId !== toColumnId) {
        board.moveCard(cardId, fromColumnId, toColumnId);
        console.log('🔄 Card verschoben:', cardId, 'von', fromColumnId, 'nach', toColumnId);
    }
}

/**
 * Upsert-Operation: Fügt Card hinzu ODER aktualisiert sie
 */
export function upsertCard(
    board: Board,
    targetColumnId: string,
    props: CardProps
): Card {
    if (!props.id) {
        throw new Error('upsertCard requires props.id');
    }
    
    return board.upsertCard(targetColumnId, props);
}

/**
 * Setzt publishState einer Card
 */
export function setCardPublishState(
    board: Board,
    cardId: string,
    state: 'draft' | 'published' | 'archived'
): void {
    const result = board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card ${cardId} not found`);
    }
    
    result.card.setPublishState(state);
}

/**
 * Fügt einen Kommentar zu einer Card hinzu
 */
export function addComment(
    board: Board,
    cardId: string,
    text: string,
    author: string
): void {
    const result = board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card ${cardId} not found`);
    }
    
    result.card.addComment(text, author);
}

/**
 * Löscht einen Kommentar von einer Card
 */
export function deleteComment(
    board: Board,
    cardId: string,
    commentId: string
): void {
    const result = board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card ${cardId} not found`);
    }
    
    result.card.deleteComment(commentId);
}
