// src/lib/stores/boardstore/migration.ts
/**
 * ✅ REFACTORING (10. Nov 2025): Metadata Migration
 * 
 * Migriert alte Metadata-Struktur zu Board-Feldern
 * Wird EINMALIG beim ersten Load ausgeführt
 */

export class MetadataMigration {
    private static MIGRATION_FLAG = 'kanban-metadata-migrated';
    
    /**
     * Prüft ob Migration nötig ist
     */
    public static needsMigration(): boolean {
        if (typeof window === 'undefined') return false;
        
        return localStorage.getItem(this.MIGRATION_FLAG) !== 'true' &&
               localStorage.getItem('kanban-boards-metadata') !== null;
    }
    
    /**
     * Führt Migration durch
     */
    public static migrate(): void {
        if (typeof window === 'undefined') return;
        
        console.log('🔄 Starting metadata migration...');
        
        try {
            // 1. Load old metadata
            const metadataKey = 'kanban-boards-metadata';
            const stored = localStorage.getItem(metadataKey);
            
            if (!stored) {
                console.log('✅ No metadata to migrate');
                this.markMigrated();
                return;
            }
            
            const metadata = JSON.parse(stored);
            console.log(`📋 Found ${metadata.length} boards in metadata`);
            
            // 2. Update each board
            let migrated = 0;
            let failed = 0;
            
            metadata.forEach((meta: any) => {
                try {
                    const boardKey = `kanban-${meta.id}`;
                    const boardStored = localStorage.getItem(boardKey);
                    
                    if (!boardStored) {
                        console.warn(`⚠️ Board ${meta.id} not found in storage`);
                        failed++;
                        return;
                    }
                    
                    const boardData = JSON.parse(boardStored);
                    
                    // 3. Add new fields from metadata
                    boardData.lastAccessedAt = meta.lastAccessed || boardData.updatedAt || boardData.createdAt;
                    boardData.hasUnseenChanges = meta.hasUnseenChanges ?? false;
                    
                    // 4. Save updated board
                    localStorage.setItem(boardKey, JSON.stringify(boardData));
                    migrated++;
                    
                } catch (error) {
                    console.error(`❌ Migration failed for board ${meta.id}:`, error);
                    failed++;
                }
            });
            
            console.log(`✅ Migration complete: ${migrated} boards migrated, ${failed} failed`);
            
            // 5. Backup old metadata (safety!)
            localStorage.setItem('kanban-boards-metadata-backup', stored);
            
            // 6. Remove old metadata
            localStorage.removeItem(metadataKey);
            console.log('🗑️ Old metadata removed (backup created)');
            
            // 7. Mark as migrated
            this.markMigrated();
            
        } catch (error) {
            console.error('❌ CRITICAL: Migration failed:', error);
            throw error;
        }
    }
    
    /**
     * Markiert Migration als abgeschlossen
     */
    private static markMigrated(): void {
        localStorage.setItem(this.MIGRATION_FLAG, 'true');
    }
    
    /**
     * Löscht Backup (nach Bestätigung dass Migration funktioniert)
     */
    public static cleanupBackup(): void {
        if (typeof window === 'undefined') return;
        
        localStorage.removeItem('kanban-boards-metadata-backup');
        console.log('🧹 Backup removed');
    }
}
