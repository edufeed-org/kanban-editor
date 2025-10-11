<script lang="ts">
    import { Avatar } from "@nostr-dev-kit/svelte";
    import { NDKSvelte } from "@nostr-dev-kit/svelte";
    import Button from "$lib/components/ui/button/button.svelte";

    const ndk = new NDKSvelte({
        explicitRelayUrls: [
            "wss://relay.damus.io",
            "wss://relay.primal.net",
            "wss://nos.lol",
        ],
    });

    ndk.connect();
</script>

<div class="flex flex-col items-center justify-center min-h-screen space-y-4">
    <h1 class="text-2xl font-bold">Nostr Client</h1>
    <p>Displaying profile for Jack Dorsey</p>

    <div class="w-full max-w-md p-4 border rounded-lg shadow-md">
        <div class="flex items-center space-x-3">
            <Avatar {ndk} pubkey="npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0kmjv0" size={64} />
            <div>
                <p class="font-semibold">Jack Dorsey</p>
                <p class="text-sm text-gray-500">Nostr User</p>
            </div>
        </div>
    </div>

    <a href="https://nostr.com/npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0kmjv0" target="_blank" rel="noopener noreferrer">
        <Button variant="outline">View on Nostr.com</Button>
    </a>
</div>