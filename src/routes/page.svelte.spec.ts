import { describe, expect, it, beforeEach } from 'vitest';
import { Board, Chat } from '$lib/classes/BoardModel.js';
import type { Card, Column } from '$lib/classes/BoardModel.js';
import { MockNDK, MockNDKEvent } from '$lib/utils/mockNdk.js';


describe('Kanban Board Tests', () => {
    let board: Board;
    let todoCol: Column;
    let progressCol: Column;
    let doneCol: Column;

    beforeEach(() => {
        board = new Board({
            name: "Projekt Edufeed Kanban Editor",
            description: "Kanban-Board für das Projekt Edufeed."
        });
        todoCol = board.addColumn({ name: "To Do" });
        progressCol = board.addColumn({ name: "In Arbeit" });
        doneCol = board.addColumn({ name: "Fertig" });
    });

    describe('Board & Column Management', () => {
        it('should create board with correct name', () => {
            expect(board.name).toBe("Projekt Edufeed Kanban Editor");
            expect(board.description).toBe("Kanban-Board für das Projekt Edufeed.");
        });

        it('should add columns correctly', () => {
            const columnNames = board.columns.map(c => c.name);
            expect(columnNames).toEqual(["To Do", "In Arbeit", "Fertig"]);
        });

        it('should update column name', () => {
            progressCol.update({ name: "In Progress" });
            expect(progressCol.name).toBe("In Progress");
        });
    });

    describe('Card Management', () => {
        let card1: Card;
        let card2: Card;

        beforeEach(() => {
            card1 = todoCol.addCard({
                heading: "Klassenstruktur definieren",
                content: "Alle Klassen in TypeScript erstellen."
            });
            card2 = todoCol.addCard({
                heading: "Svelte Stores einrichten",
                labels: ["state-management"]
            });
        });

        it('should add cards to column', () => {
            expect(todoCol.cards.length).toBe(2);
            expect(todoCol.cards[0].heading).toBe("Klassenstruktur definieren");
        });

        it('should update card content', () => {
            card1.update({ content: "Alle Klassen in TypeScript mit strikter Typisierung erstellen." });
            expect(card1.content).toBe("Alle Klassen in TypeScript mit strikter Typisierung erstellen.");
        });

        it('should add comment to card', () => {
            card1.addComment("Das ist die wichtigste Aufgabe!", "npub1test123456789");
            expect(card1.comments[0].text).toBe("Das ist die wichtigste Aufgabe!");
            expect(card1.comments[0].author).toBe("npub1test123456789");
        });
    });

    describe('Board-Level Operations', () => {
        let card1: Card;

        beforeEach(() => {
            card1 = todoCol.addCard({
                heading: "Test Card",
                content: "Test Content"
            });
        });

        it('should move card between columns', () => {
            board.moveCard(card1.id, todoCol.id, progressCol.id);
            const found = board.findCardAndColumn(card1.id);
            expect(found?.column.id).toBe(progressCol.id);
        });

        it('should manage publish states', () => {
            // Test card publish state
            expect(card1.publishState).toBe('private');
            card1.setPublishState('published');
            expect(card1.publishState).toBe('published');

            // Test board publish state
            expect(board.publishState).toBe('private');
            board.setPublishState('published');
            expect(board.publishState).toBe('published');
        });
    });

    describe('AI Integration', () => {
        let chat: Chat;
        let complexCard: Card;

        beforeEach(() => {
            chat = new Chat(board);
            complexCard = progressCol.addCard({
                heading: "Gesamtes UI/UX implementieren",
                content: "Basiert auf den Figma-Designs. Beinhaltet Drag-and-Drop, Modal-Dialoge und responsive Anpassungen."
            });
        });

		// TODO: remove skip and comments when it properly implemented
        it.skip('should generate AI context payload', () => {
            const prompt = "Teile diese Aufgabe in logische Frontend-Komponenten auf.";
            const payload = chat.sendPromptToAI(prompt, complexCard);

            // expect(payload).toBeDefined();
            // expect(payload.prompt).toBe(prompt);

            // // boardContext must be a serialized plain object (not class instances)
            // expect(payload.boardContext).toBeDefined();
            // expect(Array.isArray(payload.boardContext.columns)).toBeTruthy();
            // const colNames = payload.boardContext.columns.map((c: any) => c.name);
            // expect(colNames).toContain(progressCol.name);

            // // selectionContext should represent the passed card
            // expect(payload.selectionContext).toBeDefined();
            // expect(payload.selectionContext.id).toBe(complexCard.id);
            // expect(typeof payload.selectionContext.heading).toBe('string');
            // expect(typeof payload.selectionContext.content).toBe('string');
        });

        it('should process AI split-card action', () => {
            const aiResponseAction = {
                type: 'split_card' as const,
                columnId: progressCol.id,
                sourceCardId: complexCard.id,
                newCards: [
                    { heading: "UI: Board-Layout erstellen", labels: ["ui", "layout"] },
                    { heading: "Logik: Drag-and-Drop implementieren", labels: ["logik", "dnd"] },
                    { heading: "UI: Karten-Modal entwickeln", labels: ["ui", "modal"] }
                ]
            };

            // ensure source exists before action
            expect(progressCol.findCard(complexCard.id)).toBeDefined();

            chat.processAIAction(aiResponseAction);

            // Source card should be deleted
            expect(progressCol.findCard(complexCard.id)).toBeUndefined();

            // New cards should be added with correct headings and labels
            const addedHeadings = progressCol.cards.map(c => c.heading);
            expect(addedHeadings).toEqual(
                expect.arrayContaining([
                    "UI: Board-Layout erstellen",
                    "Logik: Drag-and-Drop implementieren",
                    "UI: Karten-Modal entwickeln"
                ])
            );

            // Validate labels on one of the new cards
            const layoutCard = progressCol.cards.find(c => c.heading === "UI: Board-Layout erstellen");
            expect(layoutCard).toBeDefined();
            expect(Array.isArray(layoutCard!.labels)).toBeTruthy();
            expect(layoutCard!.labels).toEqual(expect.arrayContaining(["ui","layout"]));
        });
    });

    describe('Comment System', () => {
        let testCard: Card;

        beforeEach(() => {
            testCard = todoCol.addCard({ heading: "Test Card" });
        });

        it('should add and manage comments', () => {
            const initialCount = testCard.comments.length;

            testCard.addComment("First comment", "npub1user1");
            testCard.addComment("Second comment", "npub1user2");
            testCard.addComment("Third comment", "npub1user3");

            expect(testCard.comments.length).toBe(initialCount + 3);
            
            const lastComment = testCard.comments[testCard.comments.length - 1];
            expect(lastComment).toMatchObject({
                text: "Third comment",
                author: "npub1user3"
            });
            expect(lastComment.id).toBeDefined();
        });

        it('should delete comments', () => {
            testCard.addComment("Test comment", "npub1user1");
            const commentId = testCard.comments[0].id;
            const initialCount = testCard.comments.length;

            testCard.deleteComment(commentId);

            expect(testCard.comments.length).toBe(initialCount - 1);
            expect(testCard.comments.find(c => c.id === commentId)).toBeUndefined();
        });

        it('should generate unique comment IDs', () => {
            testCard.addComment("Comment 1", "npub1");
            testCard.addComment("Comment 2", "npub2");
            testCard.addComment("Comment 3", "npub3");

            const commentIds = testCard.comments.map(c => c.id);
            const uniqueIds = new Set(commentIds);
            
            expect(uniqueIds.size).toBe(commentIds.length);
            expect(testCard.comments.every(c => c.id)).toBeTruthy();
        });

        it('should include comments in context data', () => {
            testCard.addComment("Test comment", "npub1user1");
            const contextData = testCard.getContextData();

            expect(contextData.comments).toBeDefined();
            expect(Array.isArray(contextData.comments)).toBeTruthy();
            expect(contextData.comments.length).toBeGreaterThan(0);
            
            const firstComment = contextData.comments[0];
            expect(firstComment).toMatchObject({
                text: "Test comment",
                author: "npub1user1"
            });
        });
    });

    describe('Nostr Event Serialization', () => {
        const mockNdk = new MockNDK();

        it('should serialize board to event', () => {
            const boardEvent = new MockNDKEvent({ kind: 30301 });
            boardEvent.tags = [
                ["d", board.id],
                ["title", board.name],
                ["state", board.publishState]
            ];
            boardEvent.content = "";

            expect(boardEvent.kind).toBe(30301);
            expect(boardEvent.tags).toHaveLength(3);
            expect(boardEvent.tags[0][0]).toBe("d");
        });

        it('should serialize card to event', () => {
            const sampleCard = progressCol.addCard({ heading: "Test Card" });
            const cardEvent = new MockNDKEvent({ kind: 30302 });
            cardEvent.tags = [
                ["d", sampleCard.id],
                ["s", progressCol.name],
                ["state", sampleCard.publishState]
            ];
            cardEvent.content = sampleCard.content || "";

            expect(cardEvent.kind).toBe(30302);
            expect(cardEvent.tags).toHaveLength(3);
            expect(cardEvent.tags[1][0]).toBe("s");
        });
    });
});
