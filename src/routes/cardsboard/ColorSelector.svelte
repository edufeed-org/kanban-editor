<script lang="ts">
	interface Props {
		selectedColor: string;
		onColorChange: (colorValue: string) => void;
	}

	let { selectedColor = 'slate', onColorChange }: Props = $props();

	const colorOptions = [
		{ value: 'slate', label: 'Slate', cssVar: '--color-slate' },
		{ value: 'blue', label: 'Blau', cssVar: '--color-blue' },
		{ value: 'green', label: 'Grün', cssVar: '--color-green' },
		{ value: 'orange', label: 'Orange', cssVar: '--color-orange' },
		{ value: 'red', label: 'Rot', cssVar: '--color-red' },
		{ value: 'purple', label: 'Lila', cssVar: '--color-purple' }
	];
</script>

<div class="space-y-2">
	<h4 class="font-medium text-sm">Farbe wählen</h4>
	<div class="flex flex-wrap gap-3">
		{#each colorOptions as option}
			<button
				class="color-circle"
				class:selected={selectedColor === option.value}
				style="background-color: var({option.cssVar})"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onColorChange(option.value);
				}}
				title={option.label}
				aria-label={option.label}
				type="button"
			>
				{#if selectedColor === option.value}
					<svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.color-circle {
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.2s ease-out;
		border: 2px solid transparent;
		position: relative;
	}

	.color-circle:hover {
		transform: scale(1.1);
		box-shadow: 0 0 0 2px var(--background),
		           0 0 8px 0 var(--accent);
		border-color: var(--accent);
	}

	.color-circle.selected {
		box-shadow: 0 0 0 3px var(--background),
		           0 0 0 5px var(--accent);
		border-color: var(--accent);
	}

	.checkmark {
		width: 16px;
		height: 16px;
		animation: scaleIn 0.2s ease-out;
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.5);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
