<svelte:head>
	<title>KI-Kanban-Board für Unterrichtsplanung</title>
</svelte:head>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import * as Card from "$lib/components/ui/card/index.js";

	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import BookOpenIcon from "@lucide/svelte/icons/book-open";
	import CheckIcon from "@lucide/svelte/icons/check";
	import GithubIcon from "@lucide/svelte/icons/github";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import LayersIcon from "@lucide/svelte/icons/layers";
	import RocketIcon from "@lucide/svelte/icons/rocket";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import SparklesIcon from "@lucide/svelte/icons/sparkles";
	import UsersIcon from "@lucide/svelte/icons/users";

	const quickLinks = [
		{
			label: "Open-Source",
			href: "https://github.com/edufeed-org/kanban-editor",
			icon: GithubIcon
		},
		{
			label: "Dokumentation",
			href: "https://github.com/edufeed-org/kanban-editor/tree/cardsboard/docs/MANUAL#readme",
			icon: BookOpenIcon
		},
		{ label: "Edufeed", href: "https://edufeed.org/", icon: GlobeIcon }
	];

	const highlights = [
		{
			title: "Tool-basierte KI-Aktionen",
			description:
				"Karten, Spalten und Boards werden über klare Aktionen gesteuert – nachvollziehbar und stabil.",
			icon: SparklesIcon,
			items: ["OpenAI Function Calling", "Kontext-sensitiver Prompt", "JSON-Repair für robuste Antworten"]
		},
		{
			title: "Nostr-native & offlinefähig",
			description:
				"Dezentrale Events, lokale Speicherung und Synchronisation sorgen für Kontrolle und Freiheit.",
			icon: ShieldCheckIcon,
			items: ["Nostr Events (Kind 30301/30302)", "Offline-First Speicherung", "Last-Write-Wins Sync"]
		},
		{
			title: "Didaktischer Workflow",
			description:
				"Spalten wie im Klassenraum: Ideen sammeln, strukturieren und gemeinsam verfeinern.",
			icon: LayersIcon,
			items: ["Drag & Drop Workflow", "Kommentare pro Karte", "Export/Import für Teams"]
		}
	];

	const teacherBenefits = [
		"Weniger Suchaufwand dank KI-gestützter Vorschläge",
		"Materialien gemeinsam strukturieren und teilen",
		"Transparente Planung auf einen Blick",
		"Selbst entscheiden, wann Inhalte veröffentlicht werden"
	];

	const quickSteps = [
		{
			title: "Thema beschreiben",
			description: "Gib dein Unterrichtsthema und Zielgruppe ein.",
			icon: UsersIcon
		},
		{
			title: "KI sammelt Material",
			description: "Automatische Vorschläge direkt als Karten.",
			icon: SparklesIcon
		},
		{
			title: "Per Drag & Drop planen",
			description: "Spalten ordnen, Karten anpassen, fertig.",
			icon: RocketIcon
		}
	];
</script>

<header class="border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 landing-header-bg">
	<div class="container mx-auto flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
		<a
			href="https://edufeed.org/"
			class="landing-surface flex items-center gap-4 rounded-2xl border px-3 py-2 shadow-sm"
			target="_blank"
			rel="noreferrer"
		>
			<div class="landing-muted flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border">
				<img
					src="https://blossom.edufeed.org/924b425d644d5543fdf613122de39f680bf4704348caaa4b5f46d10fa7d493f6.webp"
					alt="Edufeed Logo"
					class="h-10 w-10 object-cover"
					loading="lazy"
				/>
			</div>
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edufeed</p>
				<p class="text-xl font-semibold text-foreground">KI-Kanban-Board</p>
				<p class="text-xs text-muted-foreground">Unterrichtsplanung mit KI &amp; OER</p>
			</div>
		</a>

		<nav class="flex flex-wrap items-center gap-2">
			{#each quickLinks as link}
				<Button
					variant="ghost"
					size="sm"
					href={link.href}
					target="_blank"
					rel="noreferrer"
					class="landing-nav-link"
				>
					<svelte:component this={link.icon} class="size-4" />
					{link.label}
				</Button>
			{/each}
		</nav>
	</div>
</header>

<main class="bg-background text-foreground">
	<section class="relative overflow-hidden">
		<div class="landing-hero-bg absolute inset-0" aria-hidden="true"></div>

		<div class="container relative mx-auto px-4 pb-12 pt-12">
			<div class="grid gap-10 md:grid-cols-2 md:items-start">
				<div class="space-y-6">
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant="outline" class="landing-pill flex items-center gap-1">
							<SparklesIcon class="size-3" />
							KI-Tools integriert
						</Badge>
						<Badge variant="outline" class="landing-pill flex items-center gap-1">
							<ShieldCheckIcon class="size-3" />
							Nostr-native
						</Badge>
						<Badge variant="outline" class="landing-pill flex items-center gap-1">
							<UsersIcon class="size-3" />
							Für Lehrkräfte
						</Badge>
						<Badge variant="outline" class="landing-pill flex items-center gap-1">
							<GithubIcon class="size-3" />
							Open Source
						</Badge>
					</div>

					<div class="space-y-4">
						<h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
							Unterrichtsplanung, die kollaborativ, schnell und inspirierend ist.
						</h1>
						<p class="text-base text-muted-foreground md:text-lg">
							Organisiere Unterrichtsideen visuell, erhalte KI-gestützte Vorschläge und
							strukturiere deine Materialien in einem offenen, dezentralen Kanban-Board.
						</p>
					</div>

					<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
						<Button
							size="lg"
							href="/cardsboard"
							class="landing-cta h-12 w-full gap-2 px-6 text-base sm:w-auto"
						>
							Starte jetzt dein erstes Board
							<ArrowRightIcon class="size-4" />
						</Button>
						<Button
							variant="outline"
							size="lg"
							href="https://github.com/edufeed-org/kanban-editor/tree/cardsboard/docs/MANUAL#readme"
							target="_blank"
							rel="noreferrer"
							class="landing-outline h-12 w-full gap-2 px-6 text-base sm:w-auto"
						>
							Zur Dokumentation
							<BookOpenIcon class="size-4" />
						</Button>
					</div>
				</div>

				<Card.Root class="landing-surface border shadow-lg">
					<Card.Header class="space-y-2">
						<Card.Title class="flex items-center gap-2 text-lg">
							<RocketIcon class="size-5 landing-primary" />
							So startest du in 3 Schritten
						</Card.Title>
						<Card.Description>
							Ein klarer Ablauf, der Lehrkräfte entlastet und Zusammenarbeit unterstützt.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#each quickSteps as step}
							<div class="landing-surface flex items-start gap-3 rounded-xl border p-3">
								<div class="landing-primary-tint flex size-10 items-center justify-center rounded-lg">
									<svelte:component this={step.icon} class="size-5" />
								</div>
								<div>
									<p class="text-sm font-semibold">{step.title}</p>
									<p class="text-xs text-muted-foreground">{step.description}</p>
								</div>
							</div>
						{/each}
						<div class="landing-muted rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
							Demo-Boards, Inline-Editing und KI-Chat warten direkt nach dem Start.
						</div>
					</Card.Content>
				</Card.Root>
			</div>

			<div class="mt-8 grid gap-4 sm:grid-cols-3">
				<div class="landing-surface rounded-xl border p-4 shadow-sm">
					<div class="flex items-center gap-2">
						<SparklesIcon class="size-4 landing-primary" />
						<p class="text-sm font-semibold">KI-Optionen</p>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">Cards &amp; Boards automatisieren</p>
				</div>
				<div class="landing-surface rounded-xl border p-4 shadow-sm">
					<div class="flex items-center gap-2">
						<ShieldCheckIcon class="size-4 landing-primary" />
						<p class="text-sm font-semibold">Offline-First</p>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">Arbeiten ohne Netz möglich</p>
				</div>
				<div class="landing-surface rounded-xl border p-4 shadow-sm">
					<div class="flex items-center gap-2">
						<BookOpenIcon class="size-4 landing-primary" />
						<p class="text-sm font-semibold">OER-Fokus</p>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">Materialien schnell finden</p>
				</div>
			</div>

			<p class="mt-6 text-sm text-muted-foreground">
				Gefördert durch die OER-Strategie des BMBG.
				<a
					href="https://www.oer-strategie.de/foerdern/foerderrichtlinien/oe_sprints/"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1 underline underline-offset-4"
				>
					OER Sprints
					<ArrowRightIcon class="size-3" />
				</a>
			</p>
		</div>
	</section>

	<section class="container mx-auto grid gap-6 px-4 pb-12 md:grid-cols-3">
		{#each highlights as card}
			<Card.Root class="landing-surface h-full border">
				<Card.Header class="space-y-2">
					<div class="landing-primary-tint flex size-10 items-center justify-center rounded-lg">
						<svelte:component this={card.icon} class="size-5" />
					</div>
					<Card.Title>{card.title}</Card.Title>
					<Card.Description>{card.description}</Card.Description>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-2 text-sm text-muted-foreground">
						{#each card.items as item}
							<li class="flex items-start gap-2">
								<CheckIcon class="mt-0.5 size-4 landing-primary" />
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>
		{/each}
	</section>

	<section class="landing-muted">
		<div class="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-[1.1fr_0.9fr]">
			<div class="space-y-4">
				<h2 class="text-2xl font-semibold">Entwickelt für Lehrkräfte</h2>
				<p class="text-muted-foreground">
					Das Board richtet sich an Lehrkräfte, die Unterricht gemeinsam planen, strukturieren
					und teilen möchten. Fokus: weniger Recherche, mehr Zeit für didaktische Qualität.
				</p>
				<ul class="space-y-2 text-sm text-muted-foreground">
					{#each teacherBenefits as benefit}
						<li class="flex items-start gap-2">
							<CheckIcon class="mt-0.5 size-4 landing-primary" />
							<span>{benefit}</span>
						</li>
					{/each}
				</ul>
			</div>

			<Card.Root class="landing-surface border">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<SparklesIcon class="size-5 landing-primary" />
						KI-Optionen entdecken
					</Card.Title>
					<Card.Description>
						Das Agent-Modul bietet eine breite Palette an Aktionen für Karten, Spalten und Boards.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-wrap gap-2">
						<Badge variant="outline" class="landing-pill">add_card</Badge>
						<Badge variant="outline" class="landing-pill">update_card</Badge>
						<Badge variant="outline" class="landing-pill">move_card</Badge>
						<Badge variant="outline" class="landing-pill">delete_card</Badge>
						<Badge variant="outline" class="landing-pill">add_column</Badge>
						<Badge variant="outline" class="landing-pill">update_board</Badge>
						<Badge variant="outline" class="landing-pill">populate_board</Badge>
					</div>
					<p class="mt-4 text-sm text-muted-foreground">
						Details findest du in der Agent-Dokumentation – inklusive Tool-Definitionen und Workflows.
					</p>
					<Button
						class="mt-3 landing-outline"
						variant="outline"
						size="sm"
						href="https://github.com/edufeed-org/kanban-editor/blob/cardsboard/docs/ARCHITECTURE/AGENT/README.md"
						target="_blank"
						rel="noreferrer"
					>
						Agent-Architektur lesen
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
	</section>

	<section class="container mx-auto px-4 pb-16 pt-12">
		<div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
			<div>
				<h2 class="text-2xl font-semibold">Bereit für dein erstes Board?</h2>
				<p class="text-muted-foreground">
					Starte mit einer leeren Tafel oder nutze Demo-Inhalte – und entwickle deinen Unterricht mit
					KI-Unterstützung weiter.
				</p>
			</div>
			<Button size="lg" href="/cardsboard" class="landing-cta h-11 gap-2 px-6">
				Board starten
				<ArrowRightIcon class="size-4" />
			</Button>
		</div>
	</section>
</main>

<style>
	:global(.landing-header-bg) {
		background: color-mix(in oklab, var(--background) 92%, transparent);
	}

	:global(.landing-hero-bg) {
		background:
			radial-gradient(
				800px circle at 10% 10%,
				color-mix(in oklab, var(--primary) 26%, transparent),
				transparent 55%
			),
			radial-gradient(
				700px circle at 80% 0%,
				color-mix(in oklab, var(--accent) 18%, transparent),
				transparent 60%
			);
		opacity: 0.9;
	}

	:global(.landing-surface) {
		background: color-mix(in oklab, var(--card) 92%, transparent);
	}

	:global(.landing-muted) {
		background: color-mix(in oklab, var(--muted) 50%, transparent);
	}

	:global(.landing-primary) {
		color: var(--primary);
	}

	:global(.landing-primary-tint) {
		background: color-mix(in oklab, var(--primary) 18%, transparent);
		color: var(--primary);
	}

	:global(.landing-pill) {
		background: color-mix(in oklab, var(--muted) 55%, transparent);
		border-color: color-mix(in oklab, var(--border) 75%, transparent);
	}

	:global(.landing-nav-link) {
		color: var(--foreground);
	}

	:global(.landing-nav-link:hover) {
		background: color-mix(in oklab, var(--accent) 18%, transparent);
	}

	:global(.landing-outline) {
		background: transparent;
		border-color: color-mix(in oklab, var(--border) 85%, transparent);
		color: var(--foreground);
	}

	:global(.landing-outline:hover) {
		background: color-mix(in oklab, var(--accent) 18%, transparent);
		border-color: color-mix(in oklab, var(--accent) 55%, transparent);
	}

	:global(.landing-cta) {
		position: relative;
		isolation: isolate;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 92%, transparent),
			color-mix(in oklab, var(--accent) 72%, var(--primary) 28%)
		);
		color: var(--primary-foreground);
		border: 1px solid color-mix(in oklab, var(--primary) 45%, transparent);
		box-shadow:
			0 18px 48px -24px color-mix(in oklab, var(--primary) 65%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 25%, transparent);
		transform: translateY(0);
		transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
	}

	:global(.landing-cta)::before {
		content: "";
		position: absolute;
		inset: -10px;
		border-radius: inherit;
		background: radial-gradient(
			60% 65% at 50% 45%,
			color-mix(in oklab, var(--primary) 55%, transparent),
			transparent 70%
		);
		filter: blur(16px);
		opacity: 0.9;
		z-index: -1;
		transition: opacity 150ms ease;
	}

	:global(.landing-cta:hover) {
		transform: translateY(-1px);
		border-color: color-mix(in oklab, var(--primary) 65%, transparent);
		box-shadow:
			0 22px 60px -26px color-mix(in oklab, var(--primary) 75%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 35%, transparent);
	}

	:global(.landing-cta:hover)::before {
		opacity: 1;
	}
</style>
