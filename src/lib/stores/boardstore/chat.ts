// src/lib/stores/boardstore/chat.ts
// Chat-Integration

import { Board, Chat } from '../../classes/BoardModel.js';

export class ChatIntegration {
    private static chatInstance: Chat | null = null;

    /**
     * Initialisiert Chat-Instanz
     */
    public static initializeChat(board: Board): Chat {
        ChatIntegration.chatInstance = new Chat(board);
        console.log('✅ Chat initialisiert');
        return ChatIntegration.chatInstance;
    }

    /**
     * Gibt Chat-Instanz zurück
     */
    public static getChatInstance(): Chat | null {
        return ChatIntegration.chatInstance;
    }

    /**
     * Sendet Prompt an KI
     */
    public static sendPrompt(prompt: string, context?: any): void {
        if (!ChatIntegration.chatInstance) {
            console.error('❌ Chat nicht initialisiert');
            return;
        }
        ChatIntegration.chatInstance.sendPromptToAI(prompt, context);
    }

    /**
     * Verarbeitet KI-Aktion
     */
    public static processAction(action: any): void {
        if (!ChatIntegration.chatInstance) {
            console.error('❌ Chat nicht initialisiert');
            return;
        }
        ChatIntegration.chatInstance.processAIAction(action);
    }

    /**
     * Reset Chat
     */
    public static reset(): void {
        ChatIntegration.chatInstance = null;
    }
}
