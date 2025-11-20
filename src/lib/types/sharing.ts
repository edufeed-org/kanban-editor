// src/lib/types/sharing.ts
// Board-Sharing Typen für das 2-Layer Permission System

export enum BoardRole {
    OWNER = 'owner',
    EDITOR = 'editor',
    VIEWER = 'viewer'
}

export interface BoardShare {
    pubkey: string;          // Nostr Public Key (hex format)
    role: BoardRole;         // Benutzerrolle
    addedAt: string;         // ISO 8601 Timestamp
    displayName?: string;    // Optional: Lesbarer Name
}

export interface BoardPermissions {
    canEdit: boolean;        // Kann Board/Karten bearbeiten
    canDelete: boolean;      // Kann Board löschen
    canInvite: boolean;      // Kann andere Nutzer einladen
    canView: boolean;        // Kann Board anschauen
}

/**
 * Ermittelt Permissions für eine Rolle
 */
export function getPermissionsForRole(role: BoardRole | null): BoardPermissions {
    switch (role) {
        case BoardRole.OWNER:
            return {
                canEdit: true,
                canDelete: true,
                canInvite: true,
                canView: true
            };
        case BoardRole.EDITOR:
            return {
                canEdit: true,
                canDelete: false,
                canInvite: false,
                canView: true
            };
        case BoardRole.VIEWER:
            return {
                canEdit: false,
                canDelete: false,
                canInvite: false,
                canView: true
            };
        default:
            return {
                canEdit: false,
                canDelete: false,
                canInvite: false,
                canView: false
            };
    }
}