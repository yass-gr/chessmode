<script lang="ts">
	import { page } from '$app/state';
	import { findCourse } from '#lib/courses/index.ts';
	import Runner from '#lib/components/train/Runner.svelte';
	let course = $derived(findCourse(page.params.course));
	let line = $derived(course?.lines.find(l => l.id === page.params.line));
</script>
{#if course && line}<Runner {course} {line} mode="learn" />{:else}<main class="page"><h1>Line not found</h1><a href="/">Home</a></main>{/if}
