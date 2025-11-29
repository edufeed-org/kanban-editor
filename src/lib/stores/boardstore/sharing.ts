// src/lib/stores/boardstore/sharing.ts
// Board-Sharing & Maintainer-System API

import { Board } from '../../classes/BoardModel.js';
import { BoardRole, type BoardShare } from '../../types/sharing.js';
import { authStore } from '../authStore.svelte.js';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, nip19 } from '@nostr-dev-kit/ndk';

export class BoardSharingOperations {
    
    /**
     * Fügt einen Editor (Maintainer) zum Board hinzu
     * 
     * @param board - Das aktuelle Board
     * @param pubkey - Nostr Public Key (Hex) des neuen Editors
     * @param authStore - AuthStore für Permission-Check
     * @param ndk - NDK instance für Event-Publishing
     * @throws Error wenn kein Board aktiv oder Nutzer keine Berechtigung
     */
    public static async addEditor(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für addEditor (kein Publish ohne NDK)');
        }
        // Normalisiere npub → hex falls nötig
        let normalizedPubkey = pubkey;
        if (pubkey.startsWith('npub')) {
            try {
                const decoded = nip19.decode(pubkey);
                if (typeof decoded.data === 'string') {
                    normalizedPubkey = decoded.data;
                }
            } catch (e) {
                console.warn('⚠️ Konnte npub nicht decodieren, verwende Originalwert:', pubkey, e);
            }
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können neue Editoren einladen');
        }
        
        if (board.isEditor(normalizedPubkey)) {
            throw new Error('Nutzer ist bereits Editor');
        }
        
        // 2. Lokale State aktualisieren
        if (!board.maintainers) {
            board.maintainers = [];
        }
        board.maintainers = [...board.maintainers, normalizedPubkey];
        
        // 3. Nostr Event publizieren (Board Update)
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event mit neuem Editor publiziert (p-tags=${board.maintainers?.length || 0} maintainers, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board-Events:', error);
            // Rollback
            board.maintainers = board.maintainers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Editor hinzugefügt: ${normalizedPubkey}`);
    }

    /**
     * Entfernt einen Editor vom Board
     */
    public static async removeEditor(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für removeEditor');
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canDeleteBoard(currentUser)) {
            throw new Error('Nur der Owner kann Editoren entfernen');
        }
        
        if (pubkey === board.author) {
            throw new Error('Board-Owner kann nicht entfernt werden');
        }
        
        if (!board.isEditor(pubkey)) {
            throw new Error('Nutzer ist kein Editor');
        }
        
        // 2. Lokale State aktualisieren
        board.maintainers = board.maintainers?.filter(p => p !== pubkey) || [];
        
        // 3. Nostr Event publizieren (Board Update)
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event ohne Editor publiziert (maintainers=${board.maintainers.length}, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board-Events:', error);
            // Rollback
            board.maintainers = [...board.maintainers, pubkey];
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Editor entfernt: ${pubkey}`);
    }

    /**
     * Fügt einen Viewer (Follower) zum Board hinzu
     * Nutzt NIP-51 Follow Sets (Kind 30000)
     */
    public static async addViewer(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für addViewer');
        }
        // Normalisiere npub → hex falls nötig
        let normalizedPubkey = pubkey;
        if (pubkey.startsWith('npub')) {
            try {
                const decoded = nip19.decode(pubkey);
                if (typeof decoded.data === 'string') {
                    normalizedPubkey = decoded.data;
                }
            } catch (e) {
                console.warn('⚠️ Konnte npub nicht decodieren, verwende Originalwert:', pubkey, e);
            }
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können Viewer einladen');
        }
        
        if (board.isViewer(normalizedPubkey)) {
            throw new Error('Nutzer ist bereits Viewer');
        }
        
        // 2. Lokale State aktualisieren
        if (!board.followers) {
            board.followers = [];
        }
        board.followers = [...board.followers, normalizedPubkey];
        
        // 3. NIP-51 Follow Set Event erstellen/aktualisieren
        try {
            await this.updateBoardFollowers(board, ndk);
            console.log(`🛰️ NIP-51 Follow Set Event aktualisiert`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Follow Set Events:', error);
            // Rollback
            board.followers = board.followers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Follow Set Updates');
        }

        // 4. Board Event publizieren damit Viewer das Board via #p Subscription sieht
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event mit neuem Viewer publiziert (maintainers=${board.maintainers?.length || 0}, followers=${board.followers.length})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events für Viewer:', error);
            // Rollback follower entfernen
            board.followers = board.followers.filter(p => p !== normalizedPubkey);
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Viewer hinzugefügt: ${normalizedPubkey}`);
    }

    /**
     * Entfernt einen Viewer vom Board
     */
    public static async removeViewer(
        board: Board,
        pubkey: string,
        ndk: NDK
    ): Promise<void> {
        if (!ndk) {
            throw new Error('NDK Instanz erforderlich für removeViewer');
        }
        // 1. Validierung
        if (!board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || !board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können Viewer entfernen');
        }
        
        if (!board.isViewer(pubkey)) {
            throw new Error('Nutzer ist kein Viewer');
        }
        
        // 2. Lokale State aktualisieren
        // Editoren können nicht als Viewer entfernt werden
        if (!board.isEditor(pubkey)) {
            board.followers = board.followers?.filter(p => p !== pubkey) || [];
        }
        
        // 3. NIP-51 Event aktualisieren
        try {
            await this.updateBoardFollowers(board, ndk);
            console.log(`🛰️ NIP-51 Follow Set Event aktualisiert`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Follow Set Events:', error);
            // Rollback
            if (!board.isEditor(pubkey)) {
                board.followers = [...board.followers, pubkey];
            }
            throw new Error('Fehler beim Publizieren des Follow Set Updates');
        }

        // 4. Board Event publizieren damit Viewer das Board nicht mehr via #p sieht
        try {
            await this.publishBoardUpdate(board, ndk);
            console.log(`🛰️ Board Event nach Viewer-Entfernung publiziert (maintainers=${board.maintainers?.length || 0}, followers=${board.followers?.length || 0})`);
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events nach Viewer-Entfernung:', error);
            // Rollback follower wieder hinzufügen
            if (!board.isEditor(pubkey)) {
                board.followers = [...board.followers, pubkey];
            }
            throw new Error('Fehler beim Publizieren des Board-Updates');
        }
        
        console.log(`✅ Viewer entfernt: ${pubkey}`);
    }

    /**
     * Erstellt/Aktualisiert NIP-51 Follow Set Event für Viewer
     */
    private static async updateBoardFollowers(board: Board, ndk: NDK): Promise<void> {
        if (!board) return;
        
        const followEvent = new NDKEvent(ndk);
        followEvent.kind = 30000; // Follow Sets
        followEvent.tags = [
            ['d', `board-followers-${board.id}`],
            ['title', `Board Followers: ${board.name}`],
            ['description', 'Users following this Kanban board']
        ];
        
        // Alle Viewer hinzufügen (inklusive Editoren)
        const allViewers = new Set([
            ...(board.maintainers || []),
            ...(board.followers || [])
        ]);
        
        // Owner ist automatisch Viewer
        if (board.author) {
            allViewers.add(board.author);
        }
        
        allViewers.forEach(pubkey => {
            followEvent.tags.push(['p', pubkey]);
        });
        
        followEvent.content = '';
        await followEvent.publish();
        console.log('📤 NIP-51 Follow Set Event aktualisiert');
    }

    /**
     * Lädt alle Board-Teilnehmer (Editoren + Viewer)
     */
    public static async getBoardParticipants(
        board: Board
    ): Promise<BoardShare[]> {
        const participants: BoardShare[] = [];
        
        // Owner hinzufügen
        if (board?.author) {
            participants.push({
                pubkey: board.author,
                role: BoardRole.OWNER,
                addedAt: new Date().toISOString(),
                displayName: authStore.getDisplayNameForPubkey(board.author)
            });
        }
        
        // Editoren hinzufügen
        board?.maintainers?.forEach(pubkey => {
            participants.push({
                pubkey,
                role: BoardRole.EDITOR,
                addedAt: new Date().toISOString(),
                displayName: authStore.getDisplayNameForPubkey(pubkey)
            });
        });
        
        // Viewer hinzufügen
        board?.followers?.forEach(pubkey => {
            // Nur hinzufügen wenn nicht bereits Editor
            if (!board?.maintainers?.includes(pubkey) && pubkey !== board.author) {
                participants.push({
                    pubkey,
                    role: BoardRole.VIEWER,
                    addedAt: new Date().toISOString(),
                    displayName: authStore.getDisplayNameForPubkey(pubkey)
                });
            }
        });
        return participants;
    }

    /**
     * Lädt Board Follower aus NIP-51 Follow Set Events
     */
    public static async loadBoardFollowers(
        board: Board,
        ndk: NDK
    ): Promise<string[]> {
        try {
            const followSetFilter = {
                kinds: [30000],
                authors: [board.author!],
                '#d': [`board-followers-${board.id}`]
            };
            
            const followEvent = await ndk.fetchEvent(followSetFilter);
            
            if (followEvent) {
                const followers = followEvent.tags
                    .filter(tag => tag[0] === 'p')
                    .map(tag => tag[1])
                    .filter(pubkey => pubkey !== board.author && !board.maintainers?.includes(pubkey));
                
                console.log(`📥 Board Followers geladen: ${followers.length}`);
                return followers;
            }
            
            return [];
        } catch (error) {
            console.error('❌ Fehler beim Laden der Board Followers:', error);
            return [];
        }
    }

    /**
     * Publiziert Board-Update mit maintainers als p-tags
     */
    private static async publishBoardUpdate(board: Board, ndk: NDK): Promise<void> {
        const event = new NDKEvent(ndk);
        event.kind = 30301; // Board Event (Kind)
        event.tags = [
            ['d', board.id],
            ['title', board.name],
            ['description', board.description || '']
        ];
        
        // Author als p-tag (NIP-51 compliant: publisher)
        if (board.author) {
            event.tags.push(['p', board.author]);
        }
        
        // Maintainers (Editors) als p-tags hinzufügen (NIP-51 compliant)
        if (board.maintainers) {
            for (const maintainer of board.maintainers) {
                event.tags.push(['p', maintainer]);
            }
        }

        // NOTE: Followers (Viewers) werden NICHT als p-tags hinzugefügt!
        // Stattdessen werden sie via NIP-51 Follow Sets (Kind 30000) verwaltet
        // Das ist NIP-51 compliant und verhindert Verwirrung zwischen Editoren und Viewern
        
        // Spalten als col-tags
        if (board.columns) {
            for (let i = 0; i < board.columns.length; i++) {
                const col = board.columns[i];
                event.tags.push(['col', col.id, col.name, String(i), col.color || '']);
            }
        }
        
        event.content = '';
        
        try {
            const tagSummary = event.tags.filter(t => t[0] === 'p').map(t => t[1].substring(0, 12));
            console.log(`🔑 Publish Board Update: id=${board.id} p-tags(count=${tagSummary.length})=${JSON.stringify(tagSummary)}`);
            await event.publish();
            console.log('✅ Board Event publiziert (including maintainers + followers)');
        } catch (error) {
            console.error('❌ Fehler beim Publizieren des Board Events:', error);
            throw error;
        }
    }

    /**
     * Lädt alle Boards aus Nostr Events, bei denen der aktuelle Nutzer als Maintainer gelistet ist
     * 
     * @param currentUserPubkey - Aktueller Nutzer Pubkey
     * @param ndk - NDK instance für Event-Loading
     * @returns Array von geteilten Board-Metadaten
     */
    public static async loadSharedBoardsFromNostr(
        currentUserPubkey: string,
        ndk: NDK
    ): Promise<Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}>> {
        if (!ndk || !currentUserPubkey) {
            return [];
        }
        
        try {
            console.log('🔍 Lade geteilte Boards für Nutzer:', currentUserPubkey);
            
            // Suche nach Board Events (Kind 30301) wo currentUserPubkey als p-tag gelistet ist (Viewer/Editor)
            const boardEvents = await ndk.fetchEvents({
                kinds: [30301 as any], // Board Events
                '#p': [currentUserPubkey], // Nutzer muss als p-tag gelistet sein
                limit: 50 // Limit für Performance
            });
            
            const sharedBoards: Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}> = [];
            
            for (const event of boardEvents) {
                try {
                    // Extrahiere alle p-tags (NIP-51 compliant)
                    const pTagsAll = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
                    const canonicalOwner = event.pubkey; // Der Event-Publisher ist der Owner
                    
                    // Skip eigene Boards
                    if (canonicalOwner === currentUserPubkey) {
                        continue;
                    }
                    
                    // Board Metadaten aus Event extrahieren
                    const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
                    const title = event.tags.find(tag => tag[0] === 'title')?.[1];
                    const description = event.tags.find(tag => tag[0] === 'description')?.[1];
                    
                    if (!dTag || !title) {
                        console.warn('⚠️ Board Event ohne d-tag oder title:', event.id);
                        continue;
                    }
                    
                    // Bestimme Rolle des Nutzers (NIP-51 compliant)
                    // - Owner: Event-Publisher (=canonicalOwner)
                    // - Editor: In p-tags gelistet
                    // - Viewer: Via Kind 30000 Follow Set (separate, nicht hier)
                    let userRole = 'none';
                    if (canonicalOwner === currentUserPubkey) {
                        userRole = 'owner';
                    } else if (pTagsAll.includes(currentUserPubkey)) {
                        // Nutzer ist in p-tags = Editor (oder co-owner)
                        userRole = 'editor';
                    }
                    // NOTE: Viewer-Rolle wird via separate NIP-51 Follow Set Abfrage bestimmt
                    
                    // Ignoriere Boards die nicht mit diesem Nutzer geteilt sind
                    if (userRole === 'none') {
                        continue;
                    }
                    
                    // Board-Metadaten zusammenstellen
                    const boardMetadata = {
                        id: dTag,
                        name: title,
                        description: description || undefined,
                        createdAt: event.created_at ? event.created_at * 1000 : Date.now(),
                        updatedAt: event.created_at ? event.created_at * 1000 : undefined,
                        lastAccessed: undefined, // Nicht verfügbar für remote boards
                        hasUnseenChanges: false, // TODO: Implementiere Unseen Changes Detection
                        isShared: true,
                        userRole: userRole,
                        author: canonicalOwner
                    };
                    
                    sharedBoards.push(boardMetadata);
                    
                } catch (error) {
                    console.error('❌ Fehler beim Parsen des Board Events:', event.id, error);
                    continue;
                }
            }
            
            // 🔴 KRITISCH: Lade Followers für alle geteilten Boards aus NIP-51 Kind 30000
            // Dies ist nötig damit Viewer-Rollen korrekt angezeigt werden in der Board-Liste
            for (const sharedBoard of sharedBoards) {
                try {
                    const followSetFilter = {
                        kinds: [30000],
                        authors: [sharedBoard.author!],
                        '#d': [`board-followers-${sharedBoard.id}`]
                    };
                    
                    const followEvent = await ndk.fetchEvent(followSetFilter);
                    if (followEvent) {
                        const followers = followEvent.tags
                            .filter(tag => tag[0] === 'p')
                            .map(tag => tag[1])
                            .filter(pubkey => pubkey !== sharedBoard.author && pubkey !== currentUserPubkey);
                        
                        // Prüfe ob aktueller User ein Viewer ist
                        if (followers.includes(currentUserPubkey)) {
                            sharedBoard.userRole = 'viewer';
                            console.log(`🔍 Board ${sharedBoard.id}: User ist Viewer (via Kind 30000)`);
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load followers for board ${sharedBoard.id}:`, error);
                    // Non-blocking - continue with other boards
                }
            }
            
            console.log(`📥 ${sharedBoards.length} geteilte Boards geladen aus ${boardEvents.size} Events`);
            return sharedBoards;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden der geteilten Boards:', error);
            return [];
        }
    }

    /**
     * Verlässt ein geteiltes Board (entfernt den aktuellen Nutzer aus den Maintainern/Followern)
     * 
     * @param boardId - Board ID
     * @param currentUserPubkey - Aktueller Nutzer Pubkey
     * @param ndk - NDK instance für Event-Publishing
     */
    public static async leaveBoard(
        boardId: string,
        currentUserPubkey: string,
        ndk?: NDK
    ): Promise<void> {
        if (!ndk || !currentUserPubkey) {
            throw new Error('NDK oder Nutzer-Pubkey nicht verfügbar');
        }
        
        try {
            console.log('🚪 Verlasse Board:', boardId);
            
            // TODO: Implementiere das Entfernen des Nutzers aus dem Board
            // Das erfordert:
            // 1. Board Event laden
            // 2. Nutzer aus p-tags entfernen
            // 3. Neues Board Event publizieren (falls Owner)
            // 4. ODER NIP-51 Follow Set aktualisieren (falls nur Follower)
            
            // Vorerst als Placeholder - das wird vom BoardStore.deleteBoard() behandelt
            console.log(`✅ Board ${boardId} verlassen (Placeholder-Implementation)`);
            
        } catch (error) {
            console.error('❌ Fehler beim Verlassen des Boards:', error);
            throw error;
        }
    }
}