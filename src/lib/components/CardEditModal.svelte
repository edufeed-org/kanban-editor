<script lang="ts">
  import { resolve } from '$app/paths';
    import type { CardProps } from '../classes/BoardModel.js';

    interface Props {
        card: CardProps | null;
        isOpen: boolean;
        onClose: () => void;
        onSave: (cardId: string, updates: Partial<CardProps>) => void;
    }

    let { card, isOpen, onClose, onSave }: Props = $props();

    // Lokale Kopie der Kartendaten für das Formular
    let formData = $state<CardProps>({
        heading: '',
        content: '',
        color: '',
        labels: [],
        links: [],
        publishState: 'draft'
    });

    // Neues Label für die Labels-Liste
    let newLabel = $state('');

    // Neue Link-Felder
    let newLinkUrl = $state('');
    let newLinkTitle = $state('');

    // Tab state
    let activeTab = $state('content');

    // Synchronisiere formData mit der Karte, wenn sich die Karte ändert
    $effect(() => {
        if (card) {
            formData = {
                heading: card.heading || '',
                content: card.content || '',
                color: card.color || '',
                labels: [...(card.labels || [])],
                links: [...(card.links || [])],
                publishState: card.publishState || 'draft'
            };
        }
    });

    function handleSave() {
        if (card && card.id && formData.heading.trim()) {
            onSave(card.id, {
                heading: formData.heading,
                content: formData.content,
                color: formData.color,
                labels: formData.labels || [],
                links: formData.links || [],
                publishState: formData.publishState
            });
            onClose();
        }
    }

    function handleClose() {
        onClose();
    }

    function addLabel() {
        if (newLabel.trim() && !(formData.labels || []).includes(newLabel.trim())) {
            formData.labels = [...(formData.labels || []), newLabel.trim()];
            newLabel = '';
        }
    }

    function removeLabel(labelToRemove: string) {
        formData.labels = (formData.labels || []).filter(label => label !== labelToRemove);
    }

    function addLink() {
        if (newLinkUrl.trim() && newLinkTitle.trim()) {
            const newLink = { id: crypto.randomUUID(), url: newLinkUrl.trim(), title: newLinkTitle.trim() };
            formData.links = [...(formData.links || []), newLink];
            newLinkUrl = '';
            newLinkTitle = '';
        }
    }

    function removeLink(linkId: string) {
        formData.links = (formData.links || []).filter(link => link.id !== linkId);
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            handleClose();
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            handleSave();
        }
    }

    // Color options für das Dropdown
    const colorOptions = [
        { value: '', label: 'Keine Farbe' },
        { value: 'color-gradient-1', label: 'Blau' },
        { value: 'color-gradient-2', label: 'Grün' },
        { value: 'color-gradient-3', label: 'Orange' },
        { value: 'color-gradient-4', label: 'Rot' },
        { value: 'color-gradient-5', label: 'Lila' }
    ];

    // Publish state options
    const publishOptions = [
        { value: 'draft', label: 'Entwurf' },
        { value: 'published', label: 'Veröffentlicht' },
        { value: 'archived', label: 'Archiviert' }
    ];
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen && card}
    <div 
        class="modal-overlay" 
        onclick={handleClose} 
        onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && handleClose()} 
        role="button" 
        tabindex="0" 
        aria-label="Modal schließen"
    >
        <div 
            class="modal" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="edit-modal-title"
            tabindex="-1"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="modal-header">
                <h3 id="edit-modal-title">Karte bearbeiten</h3>
                <button class="close-button" onclick={handleClose} aria-label="Modal schließen">×</button>
            </div>

            <div class="modal-content">
                <div class="tabs-container">
                    <div class="tabs-header">
                        <button
                            class="tab-button"
                            class:active={activeTab === 'content'}
                            onclick={() => activeTab = 'content'}
                        >
                            Inhalt
                        </button>
                        <button
                            class="tab-button"
                            class:active={activeTab === 'settings'}
                            onclick={() => activeTab = 'settings'}
                        >
                            Einstellungen
                        </button>
                    </div>

                    <div class="tabs-content">
                        {#if activeTab === 'content'}
                            <div class="tab-pane">
                                <!-- Titel -->
                                <div class="form-group">
                                    <label for="card-heading" class="form-label">
                                        Titel <span class="required">*</span>
                                    </label>
                                    <input
                                        id="card-heading"
                                        type="text"
                                        class="form-input"
                                        bind:value={formData.heading}
                                        placeholder="Kartentitel eingeben..."
                                        required
                                        maxlength="100"
                                    />
                                </div>

                                <!-- Inhalt -->
                                <div class="form-group">
                                    <label for="card-content" class="form-label">
                                        Beschreibung
                                    </label>
                                    <textarea
                                        id="card-content"
                                        class="form-textarea"
                                        bind:value={formData.content}
                                        placeholder="Detaillierte Beschreibung der Aufgabe..."
                                        rows="4"
                                        maxlength="1000"
                                    ></textarea>
                                </div>

                                <!-- Links -->
                                <div class="form-group">
                                    <label class="form-label" for="links-section">
                                        Links
                                    </label>
                                    <div class="links-container" id="links-section">
                                        <div class="links-input-group">
                                            <input
                                                type="url"
                                                class="form-input"
                                                bind:value={newLinkUrl}
                                                placeholder="URL eingeben..."
                                            />
                                            <input
                                                type="text"
                                                class="form-input"
                                                bind:value={newLinkTitle}
                                                placeholder="Titel eingeben..."
                                                onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                                            />
                                            <button type="button" class="btn-secondary" onclick={addLink}>Hinzufügen</button>
                                        </div>

                                        {#if (formData.links || []).length > 0}
                                            <div class="links-list">
                                                {#each formData.links as link (link.id)}
                                                    <div class="link-item">
                                                        <a href={resolve(link.url, {})} target="_blank" rel="noopener noreferrer" class="link-title">{link.title}</a>
                                                        <span class="link-url">({link.url})</span>
                                                        <button
                                                            type="button"
                                                            class="link-remove"
                                                            onclick={() => removeLink(link.id)}
                                                            aria-label="Link entfernen"
                                                        >×</button>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {:else if activeTab === 'settings'}
                            <div class="tab-pane">
                                <!-- Farbe -->
                                <div class="form-group">
                                    <label for="card-color" class="form-label">
                                        Farbe
                                    </label>
                                    <select id="card-color" class="form-select" bind:value={formData.color}>
                                        {#each colorOptions as option}
                                            <option value={option.value}>{option.label}</option>
                                        {/each}
                                    </select>
                                </div>

                                <!-- Labels -->
                                <div class="form-group">
                                    <label for="card-labels" class="form-label">
                                        Labels
                                    </label>
                                    <div class="labels-container">
                                        <div class="labels-input-group">
                                            <input
                                                id="card-labels"
                                                type="text"
                                                class="form-input"
                                                bind:value={newLabel}
                                                placeholder="Neues Label hinzufügen..."
                                                onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                                            />
                                            <button type="button" class="btn-secondary" onclick={addLabel}>Hinzufügen</button>
                                        </div>

                                        {#if (formData.labels || []).length > 0}
                                            <div class="labels-list">
                                                {#each formData.labels as label}
                                                    <span class="label-badge">
                                                        {label}
                                                        <button
                                                            type="button"
                                                            class="label-remove"
                                                            onclick={() => removeLabel(label)}
                                                            aria-label="Label entfernen"
                                                        >×</button>
                                                    </span>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Publish State -->
                                <div class="form-group">
                                    <label for="card-publish-state" class="form-label">
                                        Status
                                    </label>
                                    <select id="card-publish-state" class="form-select" bind:value={formData.publishState}>
                                        {#each publishOptions as option}
                                            <option value={option.value}>{option.label}</option>
                                        {/each}
                                    </select>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick={handleClose}>
                        Abbrechen
                    </button>
                    <button type="button" class="btn-primary" onclick={handleSave}>
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal {
        background: var(--card);
        color: var(--card-foreground);
        border-radius: 8px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid var(--border);
    }

    .modal-header h3 {
        margin: 0;
        color: var(--card-foreground);
        font-size: 1.25rem;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--muted-foreground);
        padding: 0.25rem;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s ease;
    }

    .close-button:hover {
        background-color: var(--accent);
    }

    .modal-content {
        padding: 1.5rem;
    }

    .tabs-container {
        margin-bottom: 2rem;
    }

    .tabs-header {
        display: flex;
        border-bottom: 2px solid var(--border);
        margin-bottom: 1.5rem;
    }

    .tab-button {
        background: none;
        border: none;
        padding: 0.75rem 1.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--muted-foreground);
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
    }

    .tab-button:hover {
        color: var(--primary);
    }

    .tab-button.active {
        color: var(--primary);
        border-bottom-color: var(--primary);
    }

    .tabs-content {
        min-height: 300px;
    }

    .tab-pane {
        animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .form-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: var(--card-foreground);
        font-size: 0.9rem;
    }

    .required {
        color: var(--destructive);
    }

    .form-input,
    .form-textarea,
    .form-select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 0.9rem;
        background-color: var(--background);
        color: var(--foreground);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 2px var(--ring);
    }

    .form-textarea {
        resize: vertical;
        min-height: 100px;
    }

    .labels-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .labels-input-group {
        display: flex;
        gap: 0.5rem;
    }

    .labels-input-group .form-input {
        flex: 1;
    }

    .btn-secondary {
        background-color: var(--muted);
        color: var(--muted-foreground);
        border: none;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s ease;
    }

    .btn-secondary:hover {
        background-color: var(--accent);
    }

    .labels-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .label-badge {
        display: inline-flex;
        align-items: center;
        background-color: var(--accent);
        color: var(--accent-foreground);
        padding: 0.375rem 0.75rem;
        border-radius: 12px;
        font-size: 0.8rem;
        gap: 0.25rem;
    }

    .label-remove {
        background: none;
        border: none;
        color: var(--accent-foreground);
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
    }

    .label-remove:hover {
        background-color: var(--border);
    }

    .links-container {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .links-input-group {
        display: flex;
        gap: 0.5rem;
    }

    .links-input-group .form-input {
        flex: 1;
    }

    .links-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .link-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background-color: var(--background);
        border-radius: 4px;
        border: 1px solid var(--border);
    }

    .link-title {
        color: var(--primary);
        text-decoration: none;
        font-weight: 500;
    }

    .link-title:hover {
        text-decoration: underline;
    }

    .link-url {
        color: var(--muted-foreground);
        font-size: 0.8rem;
        flex: 1;
    }

    .link-remove {
        background: none;
        border: none;
        color: var(--destructive);
        cursor: pointer;
        font-size: 1rem;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s ease;
    }

    .link-remove:hover {
        background-color: var(--destructive);
        opacity: 0.2;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
    }

    .btn-primary {
        background-color: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: background-color 0.2s ease;
    }

    .btn-primary:hover {
        background-color: var(--primary);
        opacity: 0.9;
    }

    .btn-primary:disabled {
        background-color: var(--muted);
        color: var(--muted-foreground);
        cursor: not-allowed;
    }

    /* Responsive Design */
    @media (max-width: 640px) {
        .modal {
            margin: 0.5rem;
            max-height: 95vh;
        }

        .modal-header,
        .modal-content {
            padding: 1rem;
        }

        .form-actions {
            flex-direction: column-reverse;
        }

        .labels-input-group {
            flex-direction: column;
        }

        .links-input-group {
            flex-direction: column;
        }

        .tabs-header {
            flex-direction: column;
        }

        .tab-button {
            border-bottom: none;
            border-right: 2px solid transparent;
        }

        .tab-button.active {
            border-bottom: none;
            border-right-color: #007bff;
        }
    }
</style>