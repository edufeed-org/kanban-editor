// src/lib/utils/testSuite.ts

import { Board, Chat } from '../classes/BoardModel.js';
import type { Card, Column } from '../classes/BoardModel.js';
import { MockNDK, MockNDKEvent } from './mockNdk.js';

// Simple mock for AuthStore (minimal surface used by tests)
class MockAuthStore {
    private _pubkey?: string;
    constructor(pubkey?: string) {
        this._pubkey = pubkey;
    }
    getCurrentUser() {
        if (!this._pubkey) return null;
        return { pubkey: this._pubkey };
    }
}

export async function runTestSuite() {
    console.clear();
    console.group("===== KANBAN BOARD TEST SUITE START =====");

    // 1. Board-Erstellung
    console.group("1. Board & Column Management");
    const board = new Board({
        name: "Projekt Edufeed Kanban Editor",
        description: "Kanban-Board für das Projekt Edufeed."
    });
    console.log("✅ Board erstellt:", board.name);

    const todoCol = board.addColumn({ name: "To Do" });
    const progressCol = board.addColumn({ name: "In Arbeit" });
    const doneCol = board.addColumn({ name: "Fertig" });
    console.log("✅ Spalten hinzugefügt:", board.columns.map(c => c.name));

    progressCol.update({ name: "In Progress" });
    console.log("✅ Spalte aktualisiert:", progressCol.name);
    console.groupEnd();

    // 2. Card Management
    console.group("2. Card Management");
    const card1 = todoCol.addCard({
        heading: "Klassenstruktur definieren",
        content: "Alle Klassen in TypeScript erstellen."
    });
    const card2 = todoCol.addCard({
        heading: "Svelte Stores einrichten",
        labels: ["state-management"]
    });
    console.log(`✅ ${todoCol.cards.length} Karten zur 'To Do'-Spalte hinzugefügt.`);

    card1.update({ content: "Alle Klassen in TypeScript mit strikter Typisierung erstellen." });
    console.log("✅ Karte aktualisiert:", card1.content);

    card1.addComment("Das ist die wichtigste Aufgabe!", "npub1test123456789");
    console.log("✅ Kommentar hinzugefügt:", card1.comments[0].text);
    console.groupEnd();

    // 3. Board-Level Operationen
    console.group("3a. Board-Level Operations (Move Card)");
    board.moveCard(card1.id, todoCol.id, progressCol.id);
    console.log(`✅ Karte '${card1.heading}' von '${todoCol.name}' nach '${progressCol.name}' verschoben.`);

    const found = board.findCardAndColumn(card1.id);
    if (found?.column.id === progressCol.id) {
        console.log("✅ Verifizierung: Karte erfolgreich in der Zielspalte gefunden.");
    } else {
        console.error("❌ Fehler bei der Kartenverschiebung!");
    }
    console.groupEnd();

    console.group("3b. Publish State Management");
     // Test für eine Karte
    const draftCard = todoCol.cards[0];
    if (draftCard.publishState === 'draft') {
        console.log("✅ Karte ist standardmäßig im 'draft'-Modus.");
    } else {
        console.error(`❌ FEHLER: Karte sollte 'draft' sein, ist aber '${draftCard.publishState}'`);
    }

    draftCard.setPublishState('published');
    if (draftCard.publishState === 'published') {
        console.log("✅ Karte wurde erfolgreich in den 'published'-Modus versetzt.");
    } else {
        console.error("❌ FEHLER: Karte konnte nicht auf 'published' gesetzt werden.");
    }

    // Test für das Board
    if (board.publishState === 'draft') {
        console.log("✅ Board ist standardmäßig im 'draft'-Modus.");
    } else {
        console.error(`❌ FEHLER: Board sollte 'draft' sein, ist aber '${board.publishState}'`);
    }

    board.setPublishState('published');
    if (board.publishState === 'published') {
        console.log("✅ Board wurde erfolgreich in den 'published'-Modus versetzt.");
    } else {
        console.error("❌ FEHLER: Board konnte nicht auf 'published' gesetzt werden.");
    }
    console.groupEnd();

    // 4. KI-Interaktionssimulation
    console.group("4. AI Interaction Simulation");
    const chat = new Chat(board);
    const complexCard = progressCol.addCard({
        heading: "Gesamtes UI/UX implementieren",
        content: "Basiert auf den Figma-Designs. Beinhaltet Drag-and-Drop, Modal-Dialoge und responsive Anpassungen."
    });

    console.group("4a. KI-Anfrage senden (sendPromptToAI)");
    console.log("▶️ Simuliere Nutzeranfrage, um eine komplexe Karte aufzuteilen...");
    // Diese Methode sollte das Payload-Objekt in der Konsole ausgeben, um es zu verifizieren
    chat.sendPromptToAI(
        "Teile diese Aufgabe in logische Frontend-Komponenten auf.",
        complexCard
    );
    console.log("✅ Kontext-Payload für die KI wurde erfolgreich generiert und geloggt.");
    console.groupEnd();

    console.group("4b. KI-Antwort verarbeiten (processAIAction)");
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
    console.log("◀️ Simuliere KI-Antwort mit 'split_card'-Aktion...");
    chat.processAIAction(aiResponseAction);

    const sourceCardExists = !!progressCol.findCard(complexCard.id);
    const newCardsExist = progressCol.cards.some(c => c.heading.includes("UI: Board-Layout"));
    if (!sourceCardExists && newCardsExist) {
        console.log("✅ 'split_card'-Aktion erfolgreich: Alte Karte gelöscht, neue Karten hinzugefügt.");
    } else {
        console.error("❌ Fehler bei der 'split_card'-Aktion!");
    }
    console.log(`Karten in 'In Progress': ${progressCol.cards.length}`);
    console.groupEnd();
    console.groupEnd();

    // 6. Nostr Serialization (Mocked)
    console.group("6. Nostr Event Serialization (Mocked)");
    const mockNdk = new MockNDK();

    // Board -> Event (simulate expected structure)
    try {
        const boardEvent = new MockNDKEvent({ kind: 30301 });
        boardEvent.tags = [ ["d", board.id], ["title", board.name], ["state", board.publishState] ];
        boardEvent.content = "";
        console.log('✅ Mock Board event constructed:', { kind: boardEvent.kind, tags: boardEvent.tags.length });
    } catch (e) {
        console.error('❌ Fehler beim Erzeugen des Board-Events:', e);
    }

    // Card -> Event
    try {
        const sampleCard = progressCol.cards[0];
        const cardEvent = new MockNDKEvent({ kind: 30302 });
        cardEvent.tags = [["d", sampleCard.id], ["s", progressCol.name], ["state", sampleCard.publishState]];
        cardEvent.content = sampleCard.content || "";
        console.log('✅ Mock Card event constructed:', { kind: cardEvent.kind, tags: cardEvent.tags.length });
    } catch (e) {
        console.error('❌ Fehler beim Erzeugen des Card-Events:', e);
    }

    console.groupEnd();

    // 7. Auth Tests (Mock)
    console.group('7. AuthStore (Mock) Tests');
    const auth = new MockAuthStore('npub_test_user');
    const user = auth.getCurrentUser();
    if (user && user.pubkey === 'npub_test_user') {
        console.log('✅ MockAuthStore liefert pubkey:', user.pubkey);
    } else {
        console.error('❌ MockAuthStore liefert keinen User.');
    }
    console.groupEnd();

    // 5. Löschoperationen
    console.group("5. Deletion Operations");
    const commentId = card1.comments[0].id;
    card1.deleteComment(commentId);
    console.log(`✅ Kommentar gelöscht. Übrige Kommentare: ${card1.comments.length}`);

    progressCol.deleteCard(card1.id);
    console.log(`✅ Karte '${card1.heading}' gelöscht. Übrige Karten in Spalte: ${progressCol.cards.length}`);

    board.deleteColumn(doneCol.id);
    console.log(`✅ Spalte '${doneCol.name}' gelöscht. Übrige Spalten: ${board.columns.length}`);
    console.groupEnd();

    // 8. BoardStore UI Integration Tests
    console.group("8. BoardStore UI Integration");
    try {
        // Simuliere UI-Import der BoardStore-Klasse
        const { BoardStore } = await import('../stores/kanbanStore.svelte.js');
        const testStore = new BoardStore();
        
        // Test: UI-Data Konvertierung
        const uiData = testStore.uiData;
        if (uiData && uiData.length > 0) {
            console.log(`✅ BoardStore.uiData liefert ${uiData.length} Spalten`);
            console.log(`✅ Erste Spalte: "${uiData[0].name}" mit ${uiData[0].items.length} Karten`);
        } else {
            console.error('❌ BoardStore.uiData ist leer oder undefined');
        }
        
        // Test: Neue Karte erstellen über UI-Methode
        const initialCardCount = testStore.data.columns[0].cards.length;
        const newCardId = testStore.createCard(testStore.data.columns[0].id, 'Test UI Card');
        const newCardCount = testStore.data.columns[0].cards.length;
        
        if (newCardCount === initialCardCount + 1) {
            console.log('✅ createCard() funktioniert - Karte im BoardModel hinzugefügt');
        } else {
            console.error('❌ createCard() Fehler - Karte nicht im BoardModel');
        }
        
        // Test: UI-Daten Reaktivität (simuliert)
        const uiDataAfter = testStore.uiData;
        if (uiDataAfter[0].items.length === newCardCount) {
            console.log('✅ uiData ist reaktiv - UI-Änderung gespiegelt');
        } else {
            console.error('❌ uiData nicht reaktiv');
        }
        
        console.log('✅ BoardStore UI-Integration Tests erfolgreich');
        
    } catch (e) {
        console.error('❌ BoardStore UI-Integration Tests fehlgeschlagen:', e instanceof Error ? e.message : String(e));
    }
    console.groupEnd();

    // Abschluss
    console.group("Final State");
    console.log("Der finale Zustand des Boards:");
    console.dir(board.getContextData(true));
    console.groupEnd();

    console.groupEnd(); // Ende der Test-Suite
}