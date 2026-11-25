<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { lockSheets } from '#lib/courses/sheet-lock.ts';

	let { labelledby, ondismiss, children }: { labelledby: string; ondismiss: () => void; children: Snippet } = $props();
	let root = $state<HTMLElement | undefined>();

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function focusables(host: HTMLElement) {
		return [...host.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
			(el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
		);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			ondismiss();
			return;
		}
		if (event.key !== 'Tab' || !root) return;
		const items = focusables(root);
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && (active === first || !root.contains(active))) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (active === last || !root.contains(active))) {
			event.preventDefault();
			first.focus();
		}
	}

	onMount(() => {
		const release = lockSheets();
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		const blocked = [...document.body.children].filter((el) => el !== root);
		for (const el of blocked) el.setAttribute('inert', '');
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onkeydown);
		queueMicrotask(() => (root ? (root.querySelector<HTMLElement>('[data-autofocus], [aria-pressed="true"]') ?? focusables(root)[0])?.focus() : undefined));
		return () => {
			window.removeEventListener('keydown', onkeydown);
			for (const el of blocked) el.removeAttribute('inert');
			document.body.style.overflow = previousOverflow;
			release();
			previous?.focus();
		};
	});
</script>

<div class="host" bind:this={root} use:portal>
	<div class="scrim" role="presentation" onclick={ondismiss}></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledby} tabindex="-1">
		{@render children()}
	</div>
</div>

<style>
	.host {
		position: fixed;
		inset: 0;
		z-index: 80;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: rgba(8, 8, 9, 0.72);
		animation: fade var(--dur-present) var(--ease-drawer);
	}
	.sheet {
		position: absolute;
		z-index: 1;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0 auto;
		width: min(100%, 520px);
		max-height: min(92dvh, 100%);
		overflow: auto;
		padding: 22px 18px calc(22px + var(--safe-bottom));
		border-radius: 28px 28px 0 0;
		background: var(--surface-2);
		border: 1px solid var(--stroke-2);
		border-bottom: 0;
		box-shadow: 0 -30px 60px -20px rgba(0, 0, 0, 0.9);
		animation: up var(--dur-present) var(--ease-drawer);
	}
	@keyframes up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: none;
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (min-width: 700px) {
		.sheet {
			left: 50%;
			right: auto;
			bottom: auto;
			top: 50%;
			width: min(480px, calc(100% - 36px));
			max-height: min(90dvh, 720px);
			border-radius: 28px;
			border-bottom: 1px solid var(--stroke-2);
			padding-bottom: 22px;
			transform: translate(-50%, -50%);
			animation-name: pop;
			animation-duration: 260ms;
			animation-timing-function: var(--ease-out);
		}
		.scrim {
			animation-duration: 260ms;
			animation-timing-function: var(--ease-out);
		}
		@keyframes pop {
			from {
				opacity: 0;
				transform: translate(-50%, -50%) scale(0.96);
			}
			to {
				opacity: 1;
				transform: translate(-50%, -50%);
			}
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.scrim {
			animation: none;
		}
	}
</style>
