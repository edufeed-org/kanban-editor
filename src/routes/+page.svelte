<script lang="ts">
    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import { NDKSvelte } from "@nostr-dev-kit/svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import CardContent from "$lib/components/ui/card/card-content.svelte";
    import CardDescription from "$lib/components/ui/card/card-description.svelte";
    import CardHeader from "$lib/components/ui/card/card-header.svelte";
    import CardTitle from "$lib/components/ui/card/card-title.svelte";
    import Kind1PostCreationForm from "$lib/components/Kind1PostCreationForm.svelte";
    import { authStore } from "$lib/stores/authStore.svelte.js";


    let currentUser = $derived(authStore.currentUser);

    // Handle form submission from child component
    async function handlePostSubmit(data: { title: string; content: string }) {
        console.log("Creating Nostr post:", $state.snapshot(data));

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Here you would create a Nostr event
        // const event = new NDKEvent(ndk);
        // event.kind = 1;
        // event.content = `${data.title}\n\n${data.content}`;
        // await event.publish();

        console.log("Nostr post created successfully!");
    }
</script>

<div class="container mx-auto p-4 max-w-4xl">
    <div class="grid gap-6 md:grid-cols-2">
        <!-- Profile Section -->
        <Card>
            <CardHeader>
                <CardTitle>Nostr Profile</CardTitle>
                <CardDescription>Displaying profile for {currentUser?.profile?.name || 'Jack Dorsey'}</CardDescription>
            </CardHeader>
            <a href="/cardsboard">
                <CardContent>
                    <div class="flex items-center space-x-3">
                        <Avatar.Root class="h-8 w-8 flex-shrink-0">
                            <Avatar.Image src="" alt={currentUser?.profile?.name || 'Jack Dorsey'} />
                            <Avatar.Fallback class={`${Avatar.getAvatarColor(currentUser?.profile?.name)} text-white text-xs font-semibold`}>
                                {Avatar.getInitials(currentUser?.profile?.name || 'Jack Dorsey')}
                            </Avatar.Fallback>
                        </Avatar.Root>
                        <div>
                            <p class="font-semibold">{currentUser?.profile?.name || 'Jack Dorsey'}</p>
                            <p class="text-sm text-gray-500">Nostr User</p>
                        </div>
                    </div>
                    <a href="https://nostr.com/{currentUser?.npub}" target="_blank" rel="noopener noreferrer">
                        <Button variant="link" class="mt-4">View on Nostr.com</Button>
                    </a>
                </CardContent>
            </a>
            </Card>

        <!-- Kind 1 Post Creation Form Component -->
        <Kind1PostCreationForm onPostSubmit={handlePostSubmit} />
    </div>
</div>