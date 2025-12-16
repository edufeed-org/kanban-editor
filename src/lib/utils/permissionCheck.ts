// src/lib/utils/permissionCheck.ts
// Permission Check Utilities für Board-Handlungen

import { BoardRole, getPermissionsForRole } from '$lib/types/sharing';
import { get } from 'svelte/store';

export interface PermissionResult {
    allowed: boolean;
    message?: string;
    role?: BoardRole | null;
}

/**
 * Prüft Berechtigung für Board-Operationen
 * 
 * @param requiredPermission - Welche Berechtigung ist erforderlich?
 * @param userRole - Aktuelle Rolle des Benutzers
 * @param actionName - Name der Aktion für die Fehlermeldung
 * @param boardId - Optional: Board-ID für Demo-Board-Check
 * @returns PermissionResult mit allowed flag und Nachricht
 */
export function checkPermission(
    requiredPermission: keyof ReturnType<typeof getPermissionsForRole>,
    userRole: BoardRole | null,
    actionName: string,
    boardId?: string
): PermissionResult {
    // 🎯 DEMO-BOARD EXCEPTION: Anonyme Benutzer dürfen alles im Demo-Board
    if (boardId === 'demo-board') {
        return {
            allowed: true,
            role: userRole || null
        };
    }
    
    const permissions = getPermissionsForRole(userRole);
    
    if (permissions[requiredPermission]) {
        return {
            allowed: true,
            role: userRole
        };
    }
    
    // Freundliche Fehlermeldungen basierend auf Rolle
    let message: string;
    
    if (!userRole) {
        message = `Um ${actionName} zu können, müssen Sie sich zuerst anmelden und Bearbeitungsrechte für dieses Board haben.`;
    } else {
        switch (userRole) {
            case BoardRole.VIEWER:
                message = `Als Betrachter können Sie ${actionName} nicht durchführen. Nur Editoren und Board-Besitzer können Änderungen vornehmen.`;
                break;
            case BoardRole.EDITOR:
                message = `Als Editor haben Sie nicht die erforderlichen Rechte für: ${actionName}. Diese Aktion ist nur für Board-Besitzer verfügbar.`;
                break;
            default:
                message = `Sie haben nicht die erforderlichen Berechtigungen für: ${actionName}.`;
        }
    }
    
    return {
        allowed: false,
        message,
        role: userRole
    };
}

/**
 * Zeigt eine freundliche Toast-Nachricht für verweigerte Berechtigungen
 */
export function showPermissionDeniedMessage(message: string): void {
    // Toast-Nachrichten werden jetzt direkt in den Store-Methoden angezeigt
    // Diese Funktion bleibt nur für Console-Logging
    console.warn('🚫 Permission denied:', message);
}

/**
 * Utility für häufige Permission-Checks mit automatischer Fehlermeldung
 */
export function requirePermission(
    requiredPermission: keyof ReturnType<typeof getPermissionsForRole>,
    userRole: BoardRole | null,
    actionName: string,
    boardId?: string
): boolean {
    const result = checkPermission(requiredPermission, userRole, actionName, boardId);
    
    if (!result.allowed && result.message) {
        showPermissionDeniedMessage(result.message);
    }
    
    return result.allowed;
}

/**
 * Spezielle Checks für häufige Aktionen
 */
export const PermissionChecks = {
    canCreateCard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'eine neue Karte erstellen', boardId),
    
    canEditCard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Karten bearbeiten', boardId),
    
    canDeleteCard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Karten löschen', boardId),
    
    canMoveCard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Karten verschieben', boardId),
    
    canCreateColumn: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'eine neue Spalte erstellen', boardId),
    
    canEditColumn: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Spalten bearbeiten', boardId),
    
    canDeleteColumn: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Spalten löschen', boardId),
    
    canAddComment: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Kommentare hinzufügen', boardId),
    
    canDeleteComment: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Kommentare löschen', boardId),
    
    canCreateBoard: (userRole: BoardRole | null, boardId?: string) => {
        // WICHTIG: Jeder Benutzer kann eigene Boards erstellen!
        // Die Rolle auf einem anderen Board ist irrelevant für die Erstellung neuer Boards.
        // Nur die Bearbeitung BESTEHENDER Boards erfordert Berechtigungen.
        return true;
    },
    
    canDeleteBoard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canDelete', userRole, 'das Board löschen', boardId),
    
    canEditBoard: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canEdit', userRole, 'Board-Einstellungen ändern', boardId),

    // 🔒 Board-Metadaten (Name/Beschreibung/Tags/Lizenz/PublishState) sind Nostr Kind 30301
    // und damit parametrized replaceable unter der Pubkey des Signers.
    // Wenn ein Editor hier publisht, entsteht ein Fork-Board (30301:<editorPubkey>:<d>).
    // Daher: Nur OWNER (oder Demo-Board) darf Board-Metadaten ändern/publizieren.
    canEditBoardMeta: (userRole: BoardRole | null, boardId?: string) => {
        if (boardId === 'demo-board') return true;
        if (userRole === BoardRole.OWNER) return true;
        showPermissionDeniedMessage('Board-Metadaten dürfen nur vom Board-Besitzer geändert werden.');
        return false;
    },

    // 🔒 Board-Event Publishing (Kind 30301) ist owner-only, um Forks zu verhindern.
    canPublishBoard: (userRole: BoardRole | null, boardId?: string) => {
        if (boardId === 'demo-board') return true;
        if (userRole === BoardRole.OWNER) return true;
        return false;
    },
    
    canInviteUsers: (userRole: BoardRole | null, boardId?: string) => 
        requirePermission('canInvite', userRole, 'andere Benutzer einladen', boardId)
};