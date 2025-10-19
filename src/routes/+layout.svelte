<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";

  interface Props {
    children?: any;
  }

  const { children } = $props();

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

<div class="container viewport w-full h-full max-w-full dark:bg-gray-900 dark:text-white mx-auto p-0">
    {@render children?.()}
</div>