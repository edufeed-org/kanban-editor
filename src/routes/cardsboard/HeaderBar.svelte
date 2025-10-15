<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';

    export let boardMeta: {
        title: string;
        description: string;
        tags: string[];
    };
</script>

<div class="border-b bg-background p-4">
    <div class="flex items-start justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-bold">{boardMeta.title}</h1>
            <p class="text-sm text-muted-foreground">{boardMeta.description}</p>
            <div class="flex gap-2 mt-2">
                {#each boardMeta.tags as tag}
                    <Badge variant="secondary">{tag}</Badge>
                {/each}
            </div>
        </div>

        <Drawer.Root>
            <Drawer.Trigger>
                <Button variant="outline" size="sm">
                    KI-Zusammenfassung
                </Button>
            </Drawer.Trigger>
            <Drawer.Content>
                <Drawer.Header>
                    <Drawer.Title>Board-Zusammenfassung</Drawer.Title>
                </Drawer.Header>
                <div class="p-4">
                    <p class="text-sm text-muted-foreground">
                        Hier erscheint die KI-gestützte Zusammenfassung des Boards...
                    </p>
                </div>
            </Drawer.Content>
        </Drawer.Root>
    </div>
</div>