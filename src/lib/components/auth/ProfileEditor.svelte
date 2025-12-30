<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { authStore } from '$lib/stores/authStore.svelte';
  import { z } from "zod";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import LoaderIcon from "@lucide/svelte/icons/loader";
  
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  
  const { open, onClose }: Props = $props();
  
  const profileSchema = z.object({
    name: z.string().min(1, "Name ist erforderlich").max(50, "Name zu lang"),
    about: z.string().max(500, "Über-mich-Abschnitt zu lang").optional(),
    picture: z.string().url("Ungültige Bild-URL").optional().or(z.literal("")),
    nip05: z.string().email("Ungültiger NIP-05 Identifikator").optional().or(z.literal("")),
    lud16: z.string().email("Ungültige Lightning-Adresse").optional().or(z.literal(""))
  });
  
  // Form State
  let formData = $state({
    name: '',
    about: '',
    picture: '',
    nip05: '',
    lud16: ''
  });
  
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);
  let isVerifyingNip05 = $state(false);
  let nip05Verified = $state<boolean | null>(null);
  
  // Load current profile data when dialog opens
  $effect(() => {
    if (open && authStore.currentUser?.profile) {
      const profile = authStore.currentUser.profile;
      formData = {
        name: profile.name || '',
        about: profile.about || '',
        picture: profile.picture || profile.image || '',
        nip05: profile.nip05 || '',
        lud16: profile.lud16 || ''
      };
    }
  });
  
  // Verify NIP-05 when field changes
  $effect(() => {
    if (formData.nip05 && formData.nip05 !== authStore.currentUser?.profile?.nip05) {
      verifyNip05Delayed();
    } else if (!formData.nip05) {
      nip05Verified = null;
    }
  });
  
  let verifyTimeout: NodeJS.Timeout;
  function verifyNip05Delayed() {
    clearTimeout(verifyTimeout);
    nip05Verified = null;
    
    verifyTimeout = setTimeout(async () => {
      if (!formData.nip05) return;
      
      try {
        isVerifyingNip05 = true;
        nip05Verified = await authStore.verifyNip05(formData.nip05);
      } catch {
        nip05Verified = false;
      } finally {
        isVerifyingNip05 = false;
      }
    }, 1000);
  }
  
  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    // Validate form
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      errors = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      return;
    }
    
    try {
      isSubmitting = true;
      errors = {};
      
      // Update profile
      await authStore.updateProfile({
        name: formData.name,
        about: formData.about || undefined,
        picture: formData.picture || undefined,
        nip05: formData.nip05 || undefined,
        lud16: formData.lud16 || undefined
      });
      
      onClose();
      
    } catch (error: any) {
      errors = { submit: error.message || 'Fehler beim Aktualisieren des Profils' };
    } finally {
      isSubmitting = false;
    }
  }
  
  function handleCancel() {
    // Reset form
    formData = {
      name: '',
      about: '',
      picture: '',
      nip05: '',
      lud16: ''
    };
    errors = {};
    nip05Verified = null;
    
    onClose();
  }
</script>

<Dialog.Root {open} onOpenChange={(newOpen) => !newOpen && handleCancel()}>
  <Dialog.Content class="sm:max-w-md max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Profil bearbeiten</Dialog.Title>
      <Dialog.Description>
        Aktualisieren Sie Ihre Nostr-Profilinformationen. Änderungen werden im Netzwerk veröffentlicht.
      </Dialog.Description>
    </Dialog.Header>
    
    <form onsubmit={handleSubmit} class="space-y-4">
      <!-- Nostr Public Key (Read-only) -->
      <div class="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-300 dark:border-slate-600 shadow-sm">
        <label class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block uppercase tracking-wide">Ihre Nostr Public Key (npub)</label>
        <div class="font-mono text-sm text-slate-700 dark:text-slate-200 break-all select-all p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
          {authStore.getNpub() || authStore.currentUser?.pubkey || 'Nicht verfügbar'}
        </div>
      </div>
      <!-- Display Name -->
      <Field.Field>
        <Field.Label for="name">Anzeigename *</Field.Label>
        <Field.Content>
          <Input
            id="name"
            bind:value={formData.name}
            disabled={isSubmitting}
            placeholder="Ihr Name"
            aria-invalid={!!errors.name}
          />
        </Field.Content>
        <Field.Error errors={errors.name ? [{ message: errors.name }] : undefined} />
      </Field.Field>
      
      <!-- About -->
      <Field.Field>
        <Field.Label for="about">Über mich</Field.Label>
        <Field.Content>
          <Textarea
            id="about"
            bind:value={formData.about}
            disabled={isSubmitting}
            placeholder="Erzählen Sie anderen über sich..."
            rows={3}
            aria-invalid={!!errors.about}
          />
        </Field.Content>
        <Field.Error errors={errors.about ? [{ message: errors.about }] : undefined} />
      </Field.Field>
      
      <!-- Profile Picture -->
      <Field.Field>
        <Field.Label for="picture">Profilbild-URL</Field.Label>
        <Field.Content>
          <Input
            id="picture"
            type="url"
            bind:value={formData.picture}
            disabled={isSubmitting}
            placeholder="https://beispiel.de/avatar.jpg"
            aria-invalid={!!errors.picture}
          />
        </Field.Content>
        <Field.Error errors={errors.picture ? [{ message: errors.picture }] : undefined} />
      </Field.Field>
      
      <!-- NIP-05 Identifier -->
      <Field.Field>
        <Field.Label for="nip05" class="flex items-center gap-2">
          NIP-05 Identifikator
          {#if isVerifyingNip05}
            <LoaderIcon class="h-3 w-3 animate-spin text-blue-600" />
          {:else if nip05Verified === true}
            <Badge variant="secondary" class="text-xs">
              <CheckCircleIcon class="mr-1 h-3 w-3" />
              Verifiziert
            </Badge>
          {:else if nip05Verified === false}
            <Badge variant="destructive" class="text-xs">
              <XCircleIcon class="mr-1 h-3 w-3" />
              Ungültig
            </Badge>
          {/if}
        </Field.Label>
        <Field.Content>
          <Input
            id="nip05"
            type="email"
            bind:value={formData.nip05}
            disabled={isSubmitting}
            placeholder="sie@beispiel.de"
            aria-invalid={!!errors.nip05}
          />
        </Field.Content>
        <Field.Error errors={errors.nip05 ? [{ message: errors.nip05 }] : undefined} />
        <Field.Description>
          Zur Identitätsverifizierung. Muss vom Domain-Inhaber konfiguriert werden.
        </Field.Description>
      </Field.Field>
      
      <!-- Lightning Address -->
      <Field.Field>
        <Field.Label for="lud16">Lightning-Adresse (LUD-16)</Field.Label>
        <Field.Content>
          <Input
            id="lud16"
            type="email"
            bind:value={formData.lud16}
            disabled={isSubmitting}
            placeholder="sie@wallet.beispiel.de"
            aria-invalid={!!errors.lud16}
          />
        </Field.Content>
        <Field.Error errors={errors.lud16 ? [{ message: errors.lud16 }] : undefined} />
        <Field.Description>
          Zum Empfangen von Lightning-Zahlungen (Zaps).
        </Field.Description>
      </Field.Field>
      
      <!-- Submit Error -->
      {#if errors.submit}
        <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
        </div>
      {/if}
      
      <!-- Buttons -->
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={handleCancel} disabled={isSubmitting} class="bg-secondary border">
          Abbrechen
        </Button>
        <Button type="submit" disabled={isSubmitting || Object.keys(errors).length > 0} class="bg-primary border">
          {#if isSubmitting}
            <LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
          {/if}
          Änderungen speichern
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
