<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { db, type LineProgress } from '#lib/db.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { activeCourse, enterFromTrainer, loadDepth, saveDepth } from '#lib/train/data.ts';
	import { modeData } from '#lib/courses/unlocks.ts';
	import { ackNotice, gateRedirect, NOTICE_DELAY_MS, pendingNotice, trainerTarget, type Notice } from '#lib/courses/scope.ts';
	import { onSheetLock, sheetsLocked } from '#lib/courses/sheet-lock.ts';
	import Sheet from '#lib/components/Sheet.svelte';

	let progress = $state.raw(new Map<LineKey, LineProgress>());
	let ready = $state(false);
	let lockTick = $state(0);
	let shown = $state<Notice | undefined>();
	let focusId = $state<string | undefined>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		const sub = liveQuery(() => db.progress.toArray()).subscribe({
			next(rows) {
				progress = new Map(rows.map((row) => [row.key, row]));
				ready = true;
			}
		});
		const stop = onSheetLock(() => (lockTick += 1));
		return () => {
			sub.unsubscribe();
			stop();
			clearTimeout(timer);
		};
	});

	$effect(() => {
		const path = page.url.pathname;
		const params = new URLSearchParams(page.url.search);
		const rows = progress;
		void lockTick;
		if (!ready) return;
		if (sheetsLocked()) return;
		let cancel = false;
		clearTimeout(timer);
		void (async () => {
			const target = trainerTarget(path, params);
			if (target) await enterFromTrainer(target.courseId, target.lineKey);
			if (cancel) return;
			const onEntry = path === '/' || path === '/drill' || path.startsWith('/course/');
			const courseId = target?.courseId ?? (onEntry ? (path.match(/^\/course\/([^/]+)/)?.[1] ?? (await activeCourse())?.id) : undefined);
			focusId = courseId;
			const course = courseId ? getCourse(courseId) : undefined;
			if (!course) {
				shown = undefined;
				return;
			}
			const learned = course.lines.filter((line) => rows.has(line.key)).length;
			const data = modeData(course.id);
			const redirect = target ? gateRedirect(path, params, learned, course.lines.length, data.puzzle, data.arena) : undefined;
			if (redirect && redirect !== path) {
				shown = undefined;
				await goto(redirect, { replaceState: true });
				return;
			}
			if (cancel || sheetsLocked()) return;
			const choice = await loadDepth(course.id);
			if (cancel || sheetsLocked()) return;
			const next = pendingNotice(course, choice, rows, data.puzzle, data.arena);
			if (!next) {
				shown = undefined;
				return;
			}
			timer = setTimeout(() => {
				if (!cancel && !sheetsLocked()) shown = next;
			}, NOTICE_DELAY_MS);
		})();
		return () => {
			cancel = true;
			clearTimeout(timer);
		};
	});

	async function acknowledge(tier?: number) {
		const current = shown;
		const id = focusId;
		if (!current || !id) return;
		shown = undefined;
		await saveDepth(id, ackNotice(await loadDepth(id), current.id, tier));
	}

	async function stay() {
		await acknowledge();
	}

	async function go() {
		const href = shown?.go?.href;
		const tier = shown?.go?.tier;
		await acknowledge(tier);
		if (href) await goto(href);
	}
</script>

{#if shown}
	<Sheet labelledby="notice-title" ondismiss={stay}>
		<p class="label">{shown.eyebrow}</p>
		<h2 class="h-title" id="notice-title">{shown.title}</h2>
		<p class="muted copy">{shown.body}</p>
		{#if shown.go}
			<button class="btn btn-primary block" data-autofocus="" onclick={go}>{shown.go.label}</button>
		{/if}
		<button class="btn btn-surface block" data-autofocus={shown.go ? undefined : ''} onclick={stay}>{shown.stay}</button>
	</Sheet>
{/if}

<style>
	.label {
		margin-bottom: 4px;
	}
	.copy {
		margin-top: 8px;
	}
	.btn {
		margin-top: 10px;
	}
</style>
