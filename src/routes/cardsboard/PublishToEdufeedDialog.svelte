<script lang="ts">
/**
 * PublishToEdufeedDialog - AMB Learning Resource Publishing UI
 * 
 * Ermöglicht dem User, die AMB-Metadaten zu prüfen und zu bearbeiten,
 * bevor das Board als Learning Resource auf Edufeed publiziert wird.
 * 
 * Features:
 * - Vorausgefüllte Felder aus Board-Metadaten
 * - Editierbare Titel, Beschreibung, Tags, Lizenz
 * - AMB-Eigenschaften: Zielgruppe, Bildungsstufe, Ressourcentyp, Kompetenzen
 * - Dry-Run Modus für Tests
 * - Erfolgsanzeige mit naddr/njump-Links
 */
import * as Dialog from '$lib/components/ui/dialog/index.js';
import { Field, FieldLabel, FieldContent, FieldError } from '$lib/components/ui/field/index.js';
import { Button } from '$lib/components/ui/button/index.js';
import { Input } from '$lib/components/ui/input/index.js';
import { Textarea } from '$lib/components/ui/textarea/index.js';
import { Badge } from '$lib/components/ui/badge/index.js';
import { Label } from '$lib/components/ui/label/index.js';
import { Switch } from '$lib/components/ui/switch/index.js';
import { Checkbox } from '$lib/components/ui/checkbox/index.js';
import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
import { authStore } from '$lib/stores/authStore.svelte.js';
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
import { publishBoardToEdufeed, suggestAmbMetadata, type AmbPublishResult, type AmbMetadataSuggestion, AUDIENCE_ROLES, EDUCATIONAL_LEVELS, LEARNING_RESOURCE_TYPES } from '$lib/utils/ambPublisher.js';
import { toast } from 'svelte-sonner';

// Icons
import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import XCircleIcon from "@lucide/svelte/icons/x-circle";
import CopyIcon from "@lucide/svelte/icons/copy";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import TagIcon from "@lucide/svelte/icons/tag";
import InfoIcon from "@lucide/svelte/icons/info";
import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
import LoaderIcon from "@lucide/svelte/icons/loader";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import UsersIcon from "@lucide/svelte/icons/users";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BrainIcon from "@lucide/svelte/icons/brain";

// Bindable open prop für Dialog-Steuerung
let { open = $bindable(false) }: { open: boolean } = $props();

// Formular-Daten
let formData = $state<{
    title: string;
    description: string;
    tags: string[];
    license: string;
    learningResourceType: string[];
    audience: string[];
    educationalLevel: string[];
    teaches: string[];
    dryRun: boolean;
}>({
    title: '',
    description: '',
    tags: [],
    license: 'cc-by-4.0',
    learningResourceType: [],
    audience: [],
    educationalLevel: [],
    teaches: [],
    dryRun: false
});

// UI State
let isPublishing = $state(false);
let isAnalyzing = $state(false);
let publishResult = $state<AmbPublishResult | null>(null);
let llmSuggestion = $state<AmbMetadataSuggestion | null>(null);
let newTag = $state('');
let newTeaches = $state('');
let showAdvanced = $state(false);
let showAmbFields = $state(true);

// LLM-Konfiguration prüfen
let isLlmConfigured = $derived(settingsStore.isLlmConfigured);

// Board-Daten reaktiv laden
let board = $derived(boardStore.data);
let boardMeta = $derived(boardStore.boardMeta);
let isPublished = $derived(board?.publishState === 'published');

// Lizenz-Optionen
const licenseOptions = [
    { value: 'cc0-1.0', label: 'CC0 (Public Domain)', description: 'Keine Einschränkungen' },
    { value: 'cc-by-4.0', label: 'CC BY 4.0', description: 'Namensnennung erforderlich' },
    { value: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0', description: 'Namensnennung + ShareAlike' },
    { value: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0', description: 'Nicht-kommerziell' },
    { value: 'cc-by-nc-sa-4.0', label: 'CC BY-NC-SA 4.0', description: 'NC + ShareAlike' },
];

// Formular mit Board-Daten initialisieren wenn Dialog öffnet
$effect(() => {
    if (open && board) {
        formData = {
            title: boardMeta.name || board.name || 'Unbenanntes Board',
            description: boardMeta.description || board.description || '',
            tags: [...(board.tags || [])],
            license: board.ccLicense || 'cc-by-4.0',
            learningResourceType: [],
            audience: [],
            educationalLevel: [],
            teaches: [],
            dryRun: false
        };
        publishResult = null;
        newTag = '';
        newTeaches = '';
    }
});

// Tag hinzufügen
function addTag() {
    const tag = newTag.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
        formData.tags = [...formData.tags, tag];
    }
    newTag = '';
}

// Tag entfernen
function removeTag(tagToRemove: string) {
    formData.tags = formData.tags.filter(t => t !== tagToRemove);
}

// Kompetenz hinzufügen
function addTeaches() {
    const teaches = newTeaches.trim();
    if (teaches && !formData.teaches.includes(teaches)) {
        formData.teaches = [...formData.teaches, teaches];
    }
    newTeaches = '';
}

// Kompetenz entfernen
function removeTeaches(toRemove: string) {
    formData.teaches = formData.teaches.filter(t => t !== toRemove);
}

// Toggle-Funktionen für Multi-Select
function toggleAudience(id: string) {
    if (formData.audience.includes(id)) {
        formData.audience = formData.audience.filter(a => a !== id);
    } else {
        formData.audience = [...formData.audience, id];
    }
}

function toggleEducationalLevel(id: string) {
    if (formData.educationalLevel.includes(id)) {
        formData.educationalLevel = formData.educationalLevel.filter(l => l !== id);
    } else {
        formData.educationalLevel = [...formData.educationalLevel, id];
    }
}

function toggleLearningResourceType(id: string) {
    if (formData.learningResourceType.includes(id)) {
        formData.learningResourceType = formData.learningResourceType.filter(t => t !== id);
    } else {
        formData.learningResourceType = [...formData.learningResourceType, id];
    }
}

// Tag-Eingabe Handler (Enter-Taste)
function handleTagKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTag();
    }
}

// Kompetenz-Eingabe Handler (Enter-Taste)
function handleTeachesKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTeaches();
    }
}

// In Zwischenablage kopieren
async function copyToClipboard(text: string, label: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} kopiert!`);
    } catch (err) {
        toast.error('Kopieren fehlgeschlagen');
    }
}

// LLM-basierte Metadaten-Analyse
async function analyzeBoardWithLLM() {
    if (!board) {
        toast.error('Kein Board geladen');
        return;
    }
    
    if (!isLlmConfigured) {
        toast.error('LLM nicht konfiguriert. Bitte in den Einstellungen konfigurieren.');
        return;
    }
    
    isAnalyzing = true;
    llmSuggestion = null;
    
    try {
        toast.info('Analysiere Board mit KI...', { duration: 2000 });
        const suggestion = await suggestAmbMetadata(board);
        llmSuggestion = suggestion;
        
        // Übernehme die Vorschläge in das Formular
        if (suggestion.audience.length > 0) {
            formData.audience = [...suggestion.audience];
        }
        if (suggestion.educationalLevel.length > 0) {
            formData.educationalLevel = [...suggestion.educationalLevel];
        }
        if (suggestion.learningResourceType.length > 0) {
            formData.learningResourceType = [...suggestion.learningResourceType];
        }
        if (suggestion.teaches.length > 0) {
            formData.teaches = [...suggestion.teaches];
        }
        // Tags zu bestehenden hinzufügen (ohne Duplikate)
        if (suggestion.tags.length > 0) {
            const newTags = suggestion.tags.filter(t => !formData.tags.includes(t.toLowerCase()));
            formData.tags = [...formData.tags, ...newTags.map(t => t.toLowerCase())];
        }
        
        // Beschreibung vorschlagen wenn vorhanden und anzeigen (nicht automatisch übernehmen)
        if (suggestion.suggestedDescription) {
            console.log('🤖 Beschreibungsvorschlag:', suggestion.suggestedDescription);
        }
        
        toast.success('KI-Vorschläge übernommen!');
        
        if (suggestion.reasoning) {
            console.log('🤖 LLM Reasoning:', suggestion.reasoning);
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
        toast.error(`Analyse fehlgeschlagen: ${errorMsg}`);
    } finally {
        isAnalyzing = false;
    }
}

// Publishing ausführen
async function handlePublish() {
    if (!board) {
        toast.error('Kein Board geladen');
        return;
    }

    const pubkey = authStore.getPubkey();
    if (!pubkey) {
        toast.error('Du musst angemeldet sein, um zu publizieren');
        return;
    }

    // Check: Board muss "published" sein
    if (!isPublished) {
        toast.error('Das Board muss erst auf "Veröffentlicht" gesetzt werden');
        return;
    }

    isPublishing = true;
    publishResult = null;

    try {
        const result = await publishBoardToEdufeed(board, {
            pubkey,
            title: formData.title,
            description: formData.description,
            tags: formData.tags,
            license: formData.license,
            learningResourceType: formData.learningResourceType.length > 0 ? formData.learningResourceType : undefined,
            audience: formData.audience.length > 0 ? formData.audience : undefined,
            educationalLevel: formData.educationalLevel.length > 0 ? formData.educationalLevel : undefined,
            teaches: formData.teaches.length > 0 ? formData.teaches : undefined,
            dryRun: formData.dryRun
        });

        publishResult = result;

        if (result.success) {
            if (formData.dryRun) {
                toast.info('Dry-Run erfolgreich - Event wurde NICHT gesendet (siehe Console)');
            } else {
                toast.success('Board erfolgreich auf Edufeed veröffentlicht!');
            }
        } else {
            toast.error(result.error || 'Veröffentlichung fehlgeschlagen');
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
        publishResult = { success: false, error: errorMsg };
        toast.error(errorMsg);
    } finally {
        isPublishing = false;
    }
}

// Dialog schließen und zurücksetzen
function handleClose() {
    publishResult = null;
    open = false;
}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
    <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <UploadCloudIcon class="h-5 w-5 text-primary" />
                Auf Edufeed teilen
            </Dialog.Title>
            <Dialog.Description>
                Veröffentliche dein Board als OER Learning Resource auf Edufeed.
            </Dialog.Description>
        </Dialog.Header>

        {#if publishResult?.success}
            <!-- Erfolgsanzeige -->
            <div class="space-y-4 py-4">
                <div class="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircleIcon class="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                        <p class="font-semibold text-green-700 dark:text-green-300">
                            {formData.dryRun ? 'Dry-Run erfolgreich!' : 'Erfolgreich veröffentlicht!'}
                        </p>
                        <p class="text-sm text-green-600 dark:text-green-400">
                            {formData.dryRun 
                                ? 'Das Event wurde in der Console geloggt, aber nicht gesendet.'
                                : 'Dein Board ist jetzt auf Edufeed verfügbar.'}
                        </p>
                    </div>
                </div>

                {#if !formData.dryRun && publishResult.naddrUrl}
                    <!-- Share Links -->
                    <div class="space-y-3">
                        <h4 class="font-semibold flex items-center gap-2">
                            <ExternalLinkIcon class="h-4 w-4" />
                            Links zum Teilen
                        </h4>
                        
                        <!-- njump Web-Link -->
                        <div class="space-y-1">
                            <Label class="text-xs text-muted-foreground">Web-Link (für alle)</Label>
                            <div class="flex gap-2">
                                <Input 
                                    value={publishResult.naddrUrl} 
                                    readonly 
                                    class="font-mono text-xs"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onclick={() => copyToClipboard(publishResult!.naddrUrl!, 'Web-Link')}
                                >
                                    <CopyIcon class="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onclick={() => window.open(publishResult!.naddrUrl!, '_blank')}
                                >
                                    <ExternalLinkIcon class="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {#if publishResult.neventUrl}
                            <!-- nevent Link -->
                            <div class="space-y-1">
                                <Label class="text-xs text-muted-foreground">Event-Link (für Nostr-Apps)</Label>
                                <div class="flex gap-2">
                                    <Input 
                                        value={publishResult.neventUrl} 
                                        readonly 
                                        class="font-mono text-xs"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onclick={() => copyToClipboard(publishResult!.neventUrl!, 'Event-Link')}
                                    >
                                        <CopyIcon class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        {/if}

                        {#if publishResult.eventId}
                            <p class="text-xs text-muted-foreground">
                                Event-ID: <code class="font-mono">{publishResult.eventId.substring(0, 16)}...</code>
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

        {:else if publishResult?.error}
            <!-- Fehleranzeige -->
            <div class="py-4">
                <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <XCircleIcon class="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p class="font-semibold text-red-700 dark:text-red-300">
                            Veröffentlichung fehlgeschlagen
                        </p>
                        <p class="text-sm text-red-600 dark:text-red-400 mt-1">
                            {publishResult.error}
                        </p>
                    </div>
                </div>
            </div>

        {:else}
            <!-- Formular -->
            <div class="space-y-4 py-4">
                <!-- Publish-Status Warnung -->
                {#if !isPublished}
                    <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <AlertTriangleIcon class="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div class="text-sm">
                            <p class="font-semibold text-amber-700 dark:text-amber-300">
                                Board ist nicht veröffentlicht
                            </p>
                            <p class="text-amber-600 dark:text-amber-400 mt-1">
                                Setze den Veröffentlichungsstatus in den Board-Einstellungen auf "Veröffentlicht", um auf Edufeed zu teilen.
                            </p>
                        </div>
                    </div>
                {/if}

                <!-- Titel -->
                <Field>
                    <FieldLabel>Titel *</FieldLabel>
                    <FieldContent>
                        <Input 
                            bind:value={formData.title}
                            placeholder="Titel der Learning Resource"
                            disabled={isPublishing}
                        />
                    </FieldContent>
                </Field>

                <!-- Beschreibung -->
                <Field>
                    <FieldLabel>Beschreibung</FieldLabel>
                    <FieldContent>
                        <div class="space-y-2">
                            <Textarea 
                                bind:value={formData.description}
                                placeholder="Kurze Beschreibung des Boards..."
                                rows={3}
                                disabled={isPublishing}
                            />
                            {#if llmSuggestion?.suggestedDescription}
                                <div class="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="flex-1">
                                            <p class="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                                🤖 KI-Vorschlag für Beschreibung:
                                            </p>
                                            <p class="text-sm text-blue-900 dark:text-blue-100">
                                                {llmSuggestion.suggestedDescription}
                                            </p>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onclick={() => {
                                                formData.description = llmSuggestion?.suggestedDescription || '';
                                                toast.success('Beschreibung übernommen');
                                            }}
                                        >
                                            Übernehmen
                                        </Button>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </FieldContent>
                </Field>

                <!-- Tags -->
                <Field>
                    <FieldLabel class="flex items-center gap-2">
                        <TagIcon class="h-4 w-4" />
                        Schlagwörter
                    </FieldLabel>
                    <FieldContent>
                        <div class="space-y-2">
                            <div class="flex gap-2">
                                <Input 
                                    bind:value={newTag}
                                    placeholder="Neues Schlagwort..."
                                    onkeydown={handleTagKeyDown}
                                    disabled={isPublishing}
                                />
                                <Button 
                                    variant="outline" 
                                    onclick={addTag}
                                    disabled={!newTag.trim() || isPublishing}
                                >
                                    Hinzufügen
                                </Button>
                            </div>
                            {#if formData.tags.length > 0}
                                <div class="flex flex-wrap gap-1">
                                    {#each formData.tags as tag}
                                        <Badge variant="secondary" class="gap-1">
                                            {tag}
                                            <button 
                                                type="button"
                                                class="ml-1 hover:text-destructive"
                                                onclick={() => removeTag(tag)}
                                                disabled={isPublishing}
                                            >
                                                ×
                                            </button>
                                        </Badge>
                                    {/each}
                                </div>
                            {:else}
                                <p class="text-xs text-muted-foreground">
                                    Keine Schlagwörter. Füge Schlagwörter hinzu, damit andere dein Board finden können.
                                </p>
                            {/if}
                        </div>
                    </FieldContent>
                </Field>

                <!-- AMB-Felder Toggle -->
                <div class="border-t pt-4">
                    <div class="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            class="text-sm font-medium text-foreground hover:text-primary flex items-center gap-2"
                            onclick={() => showAmbFields = !showAmbFields}
                        >
                            <BookOpenIcon class="h-4 w-4" />
                            {showAmbFields ? 'AMB-Metadaten ausblenden' : 'AMB-Metadaten anzeigen'}
                        </button>
                        
                        {#if showAmbFields}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onclick={analyzeBoardWithLLM}
                                disabled={!isLlmConfigured || isAnalyzing || isPublishing}
                                title={!isLlmConfigured ? 'LLM nicht konfiguriert - bitte in Einstellungen konfigurieren' : 'Board mit KI analysieren'}
                            >
                                {#if isAnalyzing}
                                    <LoaderIcon class="h-4 w-4 mr-2 animate-spin" />
                                    Analysiere...
                                {:else}
                                    <SparklesIcon class="h-4 w-4 mr-2" />
                                    KI-Vorschläge
                                {/if}
                            </Button>
                        {/if}
                    </div>
                    
                    {#if showAmbFields}
                        <div class="mt-4 space-y-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p class="text-xs text-muted-foreground">
                                Diese Felder folgen dem <a href="https://dini-ag-kim.github.io/amb/latest/" target="_blank" class="underline hover:text-primary">AMB-Standard</a> für Bildungsressourcen.
                            </p>
                            
                            <!-- Zielgruppe (audience) -->
                            <Field>
                                <FieldLabel class="flex items-center gap-2">
                                    <UsersIcon class="h-4 w-4" />
                                    Zielgruppe
                                </FieldLabel>
                                <FieldContent>
                                    <div class="grid grid-cols-2 gap-2">
                                        {#each AUDIENCE_ROLES as role}
                                            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                                                <Checkbox 
                                                    checked={formData.audience.includes(role.id)}
                                                    onCheckedChange={() => toggleAudience(role.id)}
                                                    disabled={isPublishing}
                                                />
                                                <span>{typeof role.prefLabel === 'object' ? role.prefLabel.de : role.prefLabel}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </FieldContent>
                            </Field>

                            <!-- Bildungsstufe (educationalLevel) -->
                            <Field>
                                <FieldLabel class="flex items-center gap-2">
                                    <GraduationCapIcon class="h-4 w-4" />
                                    Bildungsstufe
                                </FieldLabel>
                                <FieldContent>
                                    <div class="grid grid-cols-2 gap-2">
                                        {#each EDUCATIONAL_LEVELS as level}
                                            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                                                <Checkbox 
                                                    checked={formData.educationalLevel.includes(level.id)}
                                                    onCheckedChange={() => toggleEducationalLevel(level.id)}
                                                    disabled={isPublishing}
                                                />
                                                <span>{typeof level.prefLabel === 'object' ? level.prefLabel.de : level.prefLabel}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </FieldContent>
                            </Field>

                            <!-- Ressourcentyp (learningResourceType) -->
                            <Field>
                                <FieldLabel class="flex items-center gap-2">
                                    <BookOpenIcon class="h-4 w-4" />
                                    Ressourcentyp
                                </FieldLabel>
                                <FieldContent>
                                    <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                                        {#each LEARNING_RESOURCE_TYPES as resourceType}
                                            <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                                                <Checkbox 
                                                    checked={formData.learningResourceType.includes(resourceType.id)}
                                                    onCheckedChange={() => toggleLearningResourceType(resourceType.id)}
                                                    disabled={isPublishing}
                                                />
                                                <span>{typeof resourceType.prefLabel === 'object' ? resourceType.prefLabel.de : resourceType.prefLabel}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </FieldContent>
                            </Field>

                            <!-- Kompetenzen (teaches) -->
                            <Field>
                                <FieldLabel class="flex items-center gap-2">
                                    <BrainIcon class="h-4 w-4" />
                                    Vermittelte Kompetenzen
                                </FieldLabel>
                                <FieldContent>
                                    <div class="space-y-2">
                                        <div class="flex gap-2">
                                            <Input 
                                                bind:value={newTeaches}
                                                placeholder="z.B. Kritisches Denken, Medienkompetenz..."
                                                onkeydown={handleTeachesKeyDown}
                                                disabled={isPublishing}
                                            />
                                            <Button 
                                                variant="outline" 
                                                onclick={addTeaches}
                                                disabled={!newTeaches.trim() || isPublishing}
                                            >
                                                Hinzufügen
                                            </Button>
                                        </div>
                                        {#if formData.teaches.length > 0}
                                            <div class="flex flex-wrap gap-1">
                                                {#each formData.teaches as teaches}
                                                    <Badge variant="secondary" class="gap-1">
                                                        {teaches}
                                                        <button 
                                                            type="button"
                                                            class="ml-1 hover:text-destructive"
                                                            onclick={() => removeTeaches(teaches)}
                                                            disabled={isPublishing}
                                                        >
                                                            ×
                                                        </button>
                                                    </Badge>
                                                {/each}
                                            </div>
                                        {:else}
                                            <p class="text-xs text-muted-foreground">
                                                Welche Fähigkeiten oder Kompetenzen können mit dieser Ressource erworben werden?
                                            </p>
                                        {/if}
                                    </div>
                                </FieldContent>
                            </Field>
                        </div>
                    {/if}
                </div>

                <!-- Lizenz -->
                <Field>
                    <FieldLabel>Lizenz</FieldLabel>
                    <FieldContent>
                        <RadioGroup.Root bind:value={formData.license} class="space-y-2">
                            {#each licenseOptions as option}
                                <div class="flex items-start gap-2">
                                    <RadioGroup.Item 
                                        value={option.value} 
                                        id={option.value}
                                        disabled={isPublishing}
                                    />
                                    <Label for={option.value} class="font-normal cursor-pointer">
                                        <span class="font-medium">{option.label}</span>
                                        <span class="text-xs text-muted-foreground ml-2">{option.description}</span>
                                    </Label>
                                </div>
                            {/each}
                        </RadioGroup.Root>
                    </FieldContent>
                </Field>

                <!-- Advanced Options -->
                <div class="border-t pt-4">
                    <button
                        type="button"
                        class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onclick={() => showAdvanced = !showAdvanced}
                    >
                        <InfoIcon class="h-4 w-4" />
                        {showAdvanced ? 'Erweiterte Optionen ausblenden' : 'Erweiterte Optionen anzeigen'}
                    </button>
                    
                    {#if showAdvanced}
                        <div class="mt-4 space-y-4 p-4 bg-muted/50 rounded-lg">
                            <!-- Dry-Run Mode -->
                            <div class="flex items-center justify-between">
                                <div>
                                    <Label for="dry-run" class="font-medium">Dry-Run Modus</Label>
                                    <p class="text-xs text-muted-foreground">
                                        Events werden nur geloggt, nicht gesendet (für Tests)
                                    </p>
                                </div>
                                <Switch 
                                    id="dry-run"
                                    bind:checked={formData.dryRun}
                                    disabled={isPublishing}
                                />
                            </div>

                            <!-- Info über Publishing -->
                            <div class="text-xs text-muted-foreground space-y-1">
                                <p><strong>Was wird veröffentlicht:</strong></p>
                                <ul class="list-disc list-inside space-y-0.5 ml-2">
                                    <li>AMB Learning Resource (Kind 30142) → amb-relay.edufeed.org</li>
                                    <li>Board Snapshot (Kind 30303) → Normale Relays</li>
                                    <li>Alle Cards (Kind 30302) → Normale Relays</li>
                                </ul>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <Dialog.Footer class="gap-2">
            {#if publishResult?.success}
                <Button variant="default" onclick={handleClose}>
                    Schließen
                </Button>
            {:else}
                <Button variant="outline" onclick={handleClose} disabled={isPublishing}>
                    Abbrechen
                </Button>
                <Button 
                    onclick={handlePublish} 
                    disabled={isPublishing || !isPublished || !formData.title.trim()}
                >
                    {#if isPublishing}
                        <LoaderIcon class="h-4 w-4 mr-2 animate-spin" />
                        Veröffentliche...
                    {:else}
                        <UploadCloudIcon class="h-4 w-4 mr-2" />
                        {formData.dryRun ? 'Dry-Run starten' : 'Veröffentlichen'}
                    {/if}
                </Button>
            {/if}
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
