<script lang="ts">
	import { resetCourseProgress, resetPractice } from '#lib/train/reset.ts';

	let {
		courseId,
		courseName,
		ondone
	}: {
		courseId: string;
		courseName: string;
		ondone?: () => void;
	} = $props();

	let pending = $state<'practice' | 'course' | undefined>();
	let busy = $state(false);

	async function confirm() {
		if (!pending || busy) return;
		busy = true;
		const kind = pending;
		if (kind === 'practice') await resetPractice(courseId);
		else await resetCourseProgress(courseId);
		pending = undefined;
		busy = false;
		ondone?.();
	}
</script>

<div class="resets">
	<button type="button" class="btn btn-surface block" onclick={() => (pending = 'practice')}>Reset Practice</button>
	<button type="button" class="btn btn-surface block" onclick={() => (pending = 'course')}>Reset course progress</button>
</div>

{#if pending}
	<div class="confirm" role="dialog" aria-modal="true" aria-labelledby="reset-title">
		<h2 id="reset-title" class="h-title">{pending === 'practice' ? `Reset Practice for ${courseName}?` : `Reset ${courseName}?`}</h2>
		{#if pending === 'practice'}
			<p>This clears perfection on this course. The lines stay learned and come back to the front of Practice. Session history and ratings stay as they are.</p>
		{:else}
			<p>This removes the learned lines and their progress for this course only. Other courses, including a repertoire you created, stay. Session history and ratings stay as they are.</p>
		{/if}
		<button type="button" class="btn btn-surface block" disabled={busy} onclick={() => (pending = undefined)}>Cancel</button>
		<button type="button" class="btn btn-primary block" disabled={busy} onclick={confirm}>{pending === 'practice' ? 'Clear perfection' : 'Clear this course'}</button>
	</div>
{/if}

<style>
	.resets {
		display: grid;
		gap: 8px;
	}
	.confirm {
		display: grid;
		gap: 12px;
		margin-top: 12px;
		padding: 14px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
	}
	.confirm p {
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.45;
	}
</style>
