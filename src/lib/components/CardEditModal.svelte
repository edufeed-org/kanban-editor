<script lang="ts">
    import type { CardProps, PublishState } from '../classes/BoardModel.js';

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
    <div class="modal-overlay" on:click={handleClose} role="button" tabindex="0" aria-label="Modal schließen" on:keydown={(e) => e.key === 'Escape' && handleClose()}>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" tabindex="0" on:click|stopPropagation>
            <div class="modal-header">
                <h3 id="edit-modal-title">Karte bearbeiten</h3>
                <button class="close-button" on:click={handleClose} aria-label="Modal schließen">×</button>
            </div>

            <div class="modal-content">
                <form on:submit={handleSave}>
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
                                    on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                                />
                                <button type="button" class="btn-secondary" on:click={addLabel}>Hinzufügen</button>
                            </div>

                            {#if (formData.labels || []).length > 0}
                                <div class="labels-list">
                                    {#each formData.labels as label}
                                        <span class="label-badge">
                                            {label}
                                            <button
                                                type="button"
                                                class="label-remove"
                                                on:click={() => removeLabel(label)}
                                                aria-label="Label entfernen"
                                            >×</button>
                                        </span>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Links -->
                    <div class="form-group">
                        <label class="form-label">
                            Links
                        </label>
                        <div class="links-container">
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
                                    on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                                />
                                <button type="button" class="btn-secondary" on:click={addLink}>Hinzufügen</button>
                            </div>

                            {#if (formData.links || []).length > 0}
                                <div class="links-list">
                                    {#each formData.links as link}
                                        <div class="link-item">
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" class="link-title">{link.title}</a>
                                            <span class="link-url">({link.url})</span>
                                            <button
                                                type="button"
                                                class="link-remove"
                                                on:click={() => removeLink(link.id)}
                                                aria-label="Link entfernen"
                                            >×</button>
                                        </div>
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

                    <!-- Action Buttons -->
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" on:click={handleClose}>
                            Abbrechen
                        </button>
                        <button type="submit" class="btn-primary">
                            Speichern
                        </button>
                    </div>
                </form>
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
        background: white;
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
        border-bottom: 1px solid #e9ecef;
    }

    .modal-header h3 {
        margin: 0;
        color: #212529;
        font-size: 1.25rem;
    }

    .close-button {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6c757d;
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
        background-color: #e9ecef;
    }

    .modal-content {
        padding: 1.5rem;
    }

    .form-group {
        margin-bottom: 1.5rem;
    }

    .form-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #495057;
        font-size: 0.9rem;
    }

    .required {
        color: #dc3545;
    }

    .form-input,
    .form-textarea,
    .form-select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 0.9rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
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
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s ease;
    }

    .btn-secondary:hover {
        background-color: #5a6268;
    }

    .labels-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .label-badge {
        display: inline-flex;
        align-items: center;
        background-color: #e9ecef;
        color: #495057;
        padding: 0.375rem 0.75rem;
        border-radius: 12px;
        font-size: 0.8rem;
        gap: 0.25rem;
    }

    .label-remove {
        background: none;
        border: none;
        color: #6c757d;
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
        background-color: #dee2e6;
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
        background-color: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #e9ecef;
    }

    .link-title {
        color: #007bff;
        text-decoration: none;
        font-weight: 500;
    }

    .link-title:hover {
        text-decoration: underline;
    }

    .link-url {
        color: #6c757d;
        font-size: 0.8rem;
        flex: 1;
    }

    .link-remove {
        background: none;
        border: none;
        color: #dc3545;
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
        background-color: #f5c6cb;
    }

    .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #e9ecef;
    }

    .btn-primary {
        background-color: #007bff;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: background-color 0.2s ease;
    }

    .btn-primary:hover {
        background-color: #0056b3;
    }

    .btn-primary:disabled {
        background-color: #6c757d;
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
    }
</style>