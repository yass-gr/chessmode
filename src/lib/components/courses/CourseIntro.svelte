<script lang="ts">
	import Mascot from '#lib/components/Mascot.svelte';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { introLine, introOrientation, type CourseIntroContent } from '#lib/courses/intro.ts';
	import type { Course } from '#lib/courses/types.ts';

	let {
		course,
		intro,
		lines,
		onstart,
		ondismiss
	}: {
		course: Course;
		intro: CourseIntroContent;
		lines: number;
		onstart: () => void;
		ondismiss: () => void;
	} = $props();

	const position = $derived(introLine(intro.moves));
	const orientation = $derived(introOrientation(course.side));
	const side = $derived(course.side === 'w' ? 'White' : 'Black');
</script>

<Sheet labelledby="course-intro-title" {ondismiss}>
	<div class="head">
		<Mascot expression="happy" size={56} />
		<div class="titles">
			<h2 class="h-title" id="course-intro-title">{course.name}</h2>
			<span class="chip"><span class="side" class:black={course.side === 'b'}></span>{side}</span>
		</div>
	</div>
	<p class="desc">{course.description}</p>
	<p class="label lessons">What you will learn</p>
	<ul>
		{#each intro.learn as item}
			<li>{item}</li>
		{/each}
	</ul>
	<div class="position">
		<MiniBoard fen={position.fen} {orientation} size={132} />
		<div>
			<p class="count">{lines} {lines === 1 ? 'line' : 'lines'}</p>
			<p class="muted depth">In this depth</p>
			<p class="mono moves">After {intro.moves}</p>
		</div>
	</div>
	<button class="btn btn-primary block" type="button" data-autofocus onclick={onstart}>Start learning</button>
</Sheet>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.titles {
		display: grid;
		gap: 8px;
		min-width: 0;
		justify-items: start;
	}
	.side {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #f4f4f2;
	}
	.side.black {
		background: #111;
		box-shadow: 0 0 0 1.5px #666;
	}
	.desc {
		margin-top: 16px;
		color: var(--text-2);
		font-size: 15px;
		line-height: 1.55;
	}
	.lessons {
		margin-top: 18px;
	}
	ul {
		display: grid;
		gap: 8px;
		margin: 10px 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		padding-left: 16px;
	}
	li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.55em;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent);
	}
	.position {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 18px;
		padding: 12px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
	}
	.count {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.depth {
		margin-top: 2px;
		font-size: 13px;
	}
	.moves {
		margin-top: 6px;
		color: var(--text-3);
		font-size: 12px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.btn {
		margin-top: 18px;
	}
</style>
