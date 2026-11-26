<script lang="ts">
	let {
		checked,
		label,
		onchange
	}: {
		checked: boolean;
		label: string;
		onchange: (checked: boolean) => void;
	} = $props();
</script>

<button class="switch" type="button" role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
	<i></i>
</button>

<style>
	.switch {
		width: 50px;
		height: 30px;
		border-radius: 999px;
		background: var(--surface-4);
		position: relative;
		transition: background var(--dur-press) var(--ease-out);
		flex: 0 0 auto;
	}
	.switch i {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		transition: transform var(--dur-press) var(--ease-out);
	}
	.switch[aria-checked='true'] {
		background: var(--accent);
	}
	.switch[aria-checked='true'] i {
		transform: translateX(20px);
	}
	@media (prefers-reduced-motion: reduce) {
		.switch,
		.switch i {
			transition: none;
		}
	}
</style>
