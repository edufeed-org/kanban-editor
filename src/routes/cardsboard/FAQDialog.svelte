<script lang="ts">
/**
 * FAQ Dialog
 * Zeigt häufig gestellte Fragen zur Anwendung
 */

	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import HelpCircleIcon from "@lucide/svelte/icons/help-circle";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const faqs = [
		{
			question: "Was ist dieses Kanban-Board?",
			answer: "Das Kanban-Board ist ein Tool zur visuellen Unterrichtsplanung für Lehrkräfte. Es kombiniert klassisches Kanban mit KI-Unterstützung und dezentraler Nostr-Technologie. Du kannst Ideen sammeln, strukturieren und mit anderen teilen – alles offline-fähig und datenschutzfreundlich."
		},
		{
			question: "Wie funktioniert die KI-Integration?",
			answer: "Die KI kann deine Boards verstehen und bearbeiten. Du kannst per Chat Spalten erstellen, Karten hinzufügen und verschieben usw. Erst konfiguriere die KI auf Dein Username > Applikation > KI-Anbindung."
		},
		{
			question: "Wie teile ich ein Board mit anderen?",
			answer: "Klicke auf 'Teilen' und dann 'Link für Beobachter'. Andere können diesen Link nutzen, um das Board zu öffnen, vorausgesetzt, du hast es als 'veröffentlicht' markiert (siehe Einstellungen)."
		},
        {
			question: "Wie können andere an einem Board von mir mitarbeiten?",
			answer: "Klicke auf 'Teilen' und dann 'Schreiberechte zuweisen'. Kopiere dann den npub-Schlüssel der/des Mitarbeitenden hinein und klicke auf 'Hinzufügen'. Das Board soll dann automatisch auf der Boardliste des/der Mitarbeitenden erscheinen"
		},
		{
			question: "Funktioniert das Board auch offline?",
			answer: "Ja! Das Board ist offline-first. Alle Änderungen werden lokal gespeichert. Sobald du wieder online bist, werden deine Daten automatisch mit den Servers synchronisiert."
		},
		{
			question: "Was ist der Unterschied zwischen 'veröffentlicht' und 'privat'?",
			answer: "'Published' Boards werden auf Nostr-Relays veröffentlicht und sind für andere sichtbar (wenn sie den Link haben). 'Private' Boards bleiben ausschließlich lokal auf deinem Gerät gespeichert."
		},
		{
			question: "Kann ich Boards exportieren/importieren?",
			answer: "Ja! Nutze das Import/Export-Feature im Board-Menü. Du kannst Boards als JSON-Datei herunterladen und auf anderen Geräten oder mit anderen Personen teilen. Beim Import kannst du wählen, ob du bestehende Boards ersetzen oder zusammenführen möchtest."
		},
        {
            question: "Oh Gott ich habe das Board gelöscht, wie bekomme ich es wieder?",
            answer: "Hoffentlich hast du es als json-Datei vorher exportiert, ansonsten ist es jetzt weg. Wenn du es exportiert hast und jetzt importierst, bekommst du eine Kopie des Boards, d.h. Kollaboratoren müssen wieder eingeladen werden"
        },
		{
			question: "Was sind Snapshots und wofür sind sie gut?",
			answer: "Snapshots sind automatische Sicherungspunkte deines Boards. Das System erstellt regelmäßig Momentaufnahmen, sodass du bei Bedarf zu früheren Versionen zurückkehren kannst - perfekt bei versehentlichen Löschungen von Karten oder zum Vergleich verschiedener Planungsstände."
		}
	];

	const quickLinks = [
		{
			label: "Dokumentation",
			url: "https://github.com/edufeed-org/kanban-editor/tree/cardsboard/docs/MANUAL#readme"
		},
		{
			label: "Agent-Architektur",
			url: "https://github.com/edufeed-org/kanban-editor/blob/cardsboard/docs/ARCHITECTURE/AGENT/README.md"
		},
		{
			label: "Onboarding-Tool",
			url: "https://edufeed-org.github.io/onboarding-tool/"
		}
	];
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
		<Dialog.Header>
			<div class="flex items-center gap-2">
				<HelpCircleIcon class="h-5 w-5 text-primary" />
				<Dialog.Title>Häufig gestellte Fragen (FAQ)</Dialog.Title>
			</div>
			<Dialog.Description>
				Hier findest du Antworten auf die wichtigsten Fragen zur Nutzung des Kanban-Boards.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<div class="space-y-4">
				{#each faqs as faq, index}
					<div class="space-y-2">
						<h4 class="text-sm font-semibold flex items-start gap-2">
							<span class="text-primary">{index + 1}.</span>
							{faq.question}
						</h4>
						<p class="text-sm text-muted-foreground pl-6">
							{faq.answer}
						</p>
						{#if index < faqs.length - 1}
							<Separator class="mt-3" />
						{/if}
					</div>
				{/each}
			</div>

			<Separator class="my-6" />

			<div>
				<h4 class="mb-3 text-sm font-semibold">Weitere Ressourcen</h4>
				<div class="flex flex-wrap gap-2">
					{#each quickLinks as link}
						<Button
							variant="outline"
							size="sm"
							onclick={() => window.open(link.url, "_blank")}
							class="gap-2"
						>
							{link.label}
							<ExternalLinkIcon class="h-3 w-3" />
						</Button>
					{/each}
				</div>
			</div>

			<div class="mt-4 rounded-lg bg-muted/50 p-4 text-sm">
				<p class="mb-2 font-medium">Noch Fragen?</p>
				<p class="text-muted-foreground">
					Besuche unsere <a
						href="https://github.com/edufeed-org/kanban-editor/tree/cardsboard/docs/MANUAL#readme"
						target="_blank"
						rel="noreferrer"
						class="underline underline-offset-4 hover:text-foreground"
					>
						vollständige Dokumentation
					</a> oder öffne ein Issue auf GitHub.
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Schließen</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
