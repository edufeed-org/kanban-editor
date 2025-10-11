<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";

  const ndk = new NDKSvelte({
    explicitRelayUrls: [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://nos.lol",
    ],
  });

  // Create reactive pool store for Svelte 5
  const pool = createReactivePool(ndk);

  ndk.connect();
</script>

<div class="container mx-auto p-4">
    <slot />
</div>