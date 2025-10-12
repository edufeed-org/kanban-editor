<script lang="ts">
    import Card from "$lib/components/ui/card/card.svelte";
    import CardContent from "$lib/components/ui/card/card-content.svelte";
    import CardDescription from "$lib/components/ui/card/card-description.svelte";
    import CardHeader from "$lib/components/ui/card/card-header.svelte";
    import CardTitle from "$lib/components/ui/card/card-title.svelte";
    import Input from "$lib/components/ui/input/input.svelte";
    import Label from "$lib/components/ui/label/label.svelte";
    import Textarea from "$lib/components/ui/textarea/textarea.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { z } from "zod";

    // Props interface for Svelte 5
    interface Props {
        onPostSubmit?: (data: { title: string; content: string }) => void;
        disabled?: boolean;
        class?: string;
    }

    let {
        onPostSubmit = () => {},
        disabled = false,
        class: className = ""
    }: Props = $props();

    // Form schema for validation
    const postSchema = z.object({
        title: z.string().min(1, "Title is required").max(100, "Title too long"),
        content: z.string().min(1, "Content is required").max(500, "Content too long"),
    });

    // Form state using Svelte 5 runes
    let formData = $state({
        title: "",
        content: "",
    });

    let errors = $state<Record<string, string>>({});
    let isSubmitting = $state(false);

    async function handleSubmit(event: Event) {
        event.preventDefault();

        // Validate form data
        const result = postSchema.safeParse(formData);

        if (!result.success) {
            errors = {};
            result.error.issues.forEach((issue) => {
                if (issue.path[0]) {
                    errors[issue.path[0] as string] = issue.message;
                }
            });
            return;
        }

        // Clear errors
        errors = {};
        isSubmitting = true;

        try {
            // Call the parent component's handler
            await onPostSubmit(formData);

            // Reset form after successful submission
            formData.title = "";
            formData.content = "";

            alert("Post would be published to Nostr!");
        } catch (error) {
            console.error("Error publishing post:", error);
            alert("Error publishing post. Check console for details.");
        } finally {
            isSubmitting = false;
        }
    }

    // Reset form function for parent components
    export function resetForm() {
        formData.title = "";
        formData.content = "";
        errors = {};
    }
</script>

<Card class={className}>
    <CardHeader>
        <CardTitle>Create Nostr Post (Kind 1)</CardTitle>
        <CardDescription>Share something on Nostr</CardDescription>
    </CardHeader>
    <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
                <Label for="title">Title</Label>
                <Input
                    id="title"
                    bind:value={formData.title}
                    placeholder="Enter post title..."
                    class={errors.title ? "border-red-500" : ""}
                    {disabled}
                />
                {#if errors.title}
                    <p class="text-sm text-red-500">{errors.title}</p>
                {/if}
            </div>

            <div class="space-y-2">
                <Label for="content">Content</Label>
                <Textarea
                    id="content"
                    bind:value={formData.content}
                    placeholder="What's on your mind?"
                    rows={4}
                    class={errors.content ? "border-red-500" : ""}
                    {disabled}
                />
                {#if errors.content}
                    <p class="text-sm text-red-500">{errors.content}</p>
                {/if}
            </div>

            <Button type="submit" class="w-full" {disabled}>
                {#if isSubmitting}
                    Publishing...
                {:else}
                    Publish to Nostr
                {/if}
            </Button>
        </form>
    </CardContent>
</Card>