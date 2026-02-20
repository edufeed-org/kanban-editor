<!--
  Beispiel-Komponente: Paste Handler Integration
  
  Zeigt wie Paste-Events in Cards und Columns verarbeitet werden.
  
  Usage in bestehenden Komponenten (Card.svelte, Column.svelte):
  - Füge onpaste Event-Handler hinzu
  - Rufe boardStore.handleCardPaste() oder boardStore.handleColumnPaste() auf
-->

<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';
    
    let { 
        cardId, 
        columnId, 
        mode = 'card',
        children
    }: { 
        cardId?: string
        columnId?: string
        mode?: 'card' | 'column'
        children?: import('svelte').Snippet
    } = $props();
    
    /**
     * Prüft ob ein Element ein editierbares Feld ist (Input, Textarea, TipTap)
     */
    function isEditableElement(el: Element | null): boolean {
        if (!el) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return true;
        if (el instanceof HTMLElement && el.isContentEditable) return true;
        if (el.closest('[contenteditable="true"], .ProseMirror, .tiptap')) return true;
        return false;
    }

    /**
     * Prüft ob das Paste-Event auf ein editierbares Feld zielt
     * (event.target, document.activeElement, event.defaultPrevented)
     */
    function isEditableTarget(event: ClipboardEvent): boolean {
        if (event.defaultPrevented) return true;
        if (event.target instanceof Element && isEditableElement(event.target)) return true;
        if (isEditableElement(document.activeElement)) return true;
        return false;
    }

    /**
     * Handler für Paste-Event auf Card
     */
    async function handleCardPaste(event: ClipboardEvent) {
        if (!cardId) return;
        if (isEditableTarget(event)) return;
        
        // Verhindere Default (Browser würde Text einfügen)
        event.preventDefault();
        
        console.log('📋 Paste in Card:', cardId);
        
        const result = await boardStore.handleCardPaste(cardId, event.clipboardData);
        
        if (result.success) {
            toast.success(`${result.type} erfolgreich eingefügt`, {
                description: result.debug
            });
        } else {
            toast.error('Paste fehlgeschlagen', {
                description: result.error
            });
        }
    }
    
    /**
     * Handler für Paste-Event auf Column
     */
    async function handleColumnPaste(event: ClipboardEvent) {
        if (!columnId) return;
        if (isEditableTarget(event)) return;
        
        // Verhindere Default
        event.preventDefault();
        
        console.log('📋 Paste in Column:', columnId);
        
        const result = await boardStore.handleColumnPaste(columnId, event.clipboardData as any);
        
        if (result.success) {
            toast.success(`Neue Karte erstellt (${result.type})`, {
                description: result.debug
            });
            
            // Optional: Scroll zur neuen Karte
            if ('cardId' in result && result.cardId) {
                console.log('✅ Neue Card ID:', result.cardId);
            }
        } else {
            toast.error('Paste fehlgeschlagen', {
                description: result.error
            });
        }
    }
</script>

<!-- Beispiel-Container mit Paste-Handler -->
{#if mode === 'card'}
    <div 
        onpaste={handleCardPaste}
        class="paste-enabled-card"
    >
        {@render children?.()}
        <div class="paste-hint">
            Strg+V zum Einfügen in diese Karte
        </div>
    </div>
{:else}
    <div 
        onpaste={handleColumnPaste}
        class="paste-enabled-column"
    >
        {@render children?.()}
        <div class="paste-hint">
            Strg+V zum Erstellen einer neuen Karte
        </div>
    </div>
{/if}

<style>
    .paste-enabled-card,
    .paste-enabled-column {
        position: relative;
        outline: 2px dashed transparent;
        transition: outline-color 0.2s;
    }
    
    .paste-enabled-card:focus-within,
    .paste-enabled-column:focus-within {
        outline-color: hsl(var(--primary) / 0.5);
    }
    
    .paste-hint {
        position: absolute;
        bottom: 4px;
        right: 4px;
        font-size: 0.7rem;
        color: hsl(var(--muted-foreground));
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
    }
    
    .paste-enabled-card:focus-within .paste-hint,
    .paste-enabled-column:focus-within .paste-hint {
        opacity: 1;
    }
</style>
