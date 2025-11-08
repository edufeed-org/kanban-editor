// src/lib/stores/boardstore/paste.ts
// Paste-Handler für Cards und Columns

import { Board, Card, Column } from '../../classes/BoardModel.js';
import { BoardOperations } from './operations.js';

export class PasteHandler {
    /**
     * Behandelt Paste-Event für Card
     */
    public static handleCardPaste(
        board: Board,
        cardId: string,
        pastedData: any,
        author?: string
    ): boolean {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        // Merge pasted data with existing card
        const updates = PasteHandler.mergeCardUpdates(result.card, pastedData);
        return BoardOperations.updateCard(board, cardId, updates);
    }

    /**
     * Behandelt Paste-Event für Column
     */
    public static handleColumnPaste(
        board: Board,
        columnId: string,
        pastedCards: any[],
        author?: string
    ): string[] {
        const column = board.findColumn(columnId);
        if (!column) {
            console.error(`❌ Spalte ${columnId} nicht gefunden`);
            return [];
        }

        const createdCardIds: string[] = [];
        for (const cardData of pastedCards) {
            const cardId = BoardOperations.createCard(
                board,
                columnId,
                cardData.heading || 'Neue Karte',
                cardData.content,
                author
            );
            
            if (cardId) {
                // Apply additional card properties
                if (cardData.labels || cardData.color || cardData.image) {
                    BoardOperations.updateCard(board, cardId, {
                        labels: cardData.labels,
                        color: cardData.color,
                        image: cardData.image
                    });
                }
                createdCardIds.push(cardId);
            }
        }

        console.log(`✅ ${createdCardIds.length} Karten eingefügt`);
        return createdCardIds;
    }

    /**
     * Merged Paste-Daten mit bestehender Card
     */
    public static mergeCardUpdates(existingCard: Card, pastedData: any): Partial<any> {
        const updates: any = {};

        // Merge content
        if (pastedData.content) {
            updates.content = existingCard.content
                ? `${existingCard.content}\n\n${pastedData.content}`
                : pastedData.content;
        }

        // Merge labels (unique)
        if (pastedData.labels && Array.isArray(pastedData.labels)) {
            const existingLabels = new Set(existingCard.labels || []);
            const newLabels = [...existingLabels];
            
            for (const label of pastedData.labels) {
                if (!existingLabels.has(label)) {
                    newLabels.push(label);
                }
            }
            updates.labels = newLabels;
        }

        // Update image if provided
        if (pastedData.image) {
            updates.image = pastedData.image;
        }

        // Update color if provided
        if (pastedData.color) {
            updates.color = pastedData.color;
        }

        // Merge links (unique by URL)
        if (pastedData.links && Array.isArray(pastedData.links)) {
            const existingUrls = new Set((existingCard.links || []).map(l => l.url));
            const newLinks = [...(existingCard.links || [])];
            
            for (const link of pastedData.links) {
                if (!existingUrls.has(link.url)) {
                    newLinks.push(link);
                }
            }
            updates.links = newLinks;
        }

        return updates;
    }
}
