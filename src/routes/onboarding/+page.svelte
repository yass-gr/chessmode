<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { courses, getCourse } from '#lib/courses/index.ts';
	import { courseBand, isReady, recommendCourse, resumeStep } from '#lib/onboarding/onboarding.ts';
	import { completeOnboarding, dismissOnboarding, readOnboarding, writeOnboarding } from '#lib/onboarding/store.ts';
	import {
		GOALS,
		MOTIVATIONS,
		RATING_BRACKETS,
		SETUP_STEPS,
		type GoalId,
		type MotivationId,
		type OnboardingProfile,
		type RatingBracketId,
		type StudySide
	} from '#lib/onboarding/types.ts';

	let profile = $state<OnboardingProfile>({
		status: 'pending',
		bracket: null,
		goals: [],
		motivation: null,
		side: null,
		updatedAt: 0
	});
	let step = $state(0);
	let ready = $state(false);
	let saving = $state(false);

	const stepId = $derived(SETUP_STEPS[step] ?? 'rating');
	const suggestionId = $derived.by(() => {
		if (!isReady(profile)) return null;
		return recommendCourse(
			profile,
			courses.map((course) => ({ id: course.id, side: course.side, band: courseBand(course.level) }))
		);
	});
	const suggestion = $derived(suggestionId ? getCourse(suggestionId) : undefined);
	const canContinue = $derived(
		(stepId === 'rating' && profile.bracket !== null) ||
			(stepId === 'goal' && profile.goals.length > 0) ||
			(stepId === 'motivation' && profile.motivation !== null) ||
			(stepId === 'side' && profile.side !== null)
	);

	onMount(async () => {
		profile = await readOnboarding();
		step = Math.max(0, SETUP_STEPS.indexOf(resumeStep(profile)));
		ready = true;
	});

	async function save(next: OnboardingProfile) {
		profile = next;
		await writeOnboarding(next);
	}

	async function skip() {
		if (profile.status !== 'completed') await dismissOnboarding();
		await goto('/');
	}

	async function finish(href: string) {
		if (!isReady(profile) || saving) return;
		saving = true;
		try {
			await completeOnboarding(profile);
			await goto(href);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head><title>Setup · Chessmode</title></svelte:head>

<main class="page setup" aria-labelledby="setup-title">
	<div class="progress" aria-hidden="true"><i style:width="{(100 * (step + 1)) / SETUP_STEPS.length}%"></i></div>
	{#if ready}
		{#key stepId}
			<div class="panel">
				<img class="setup-art" src="/img/onboarding/suggest.webp" alt="" />
				{#if stepId === 'rating'}
					<h1 id="setup-title" class="h-title">What's your rating?</h1>
					<p class="muted">A guess is enough. It only sets a starting rating where you don't have one yet.</p>
					<div class="choices">
						{#each RATING_BRACKETS as bracket (bracket.id)}
							<button type="button" class="option" class:selected={profile.bracket === bracket.id} aria-pressed={profile.bracket === bracket.id} onclick={() => save({ ...profile, bracket: bracket.id as RatingBracketId })}>
								{bracket.label}
							</button>
						{/each}
					</div>
				{:else if stepId === 'goal'}
					<h1 id="setup-title" class="h-title">What do you want to work on?</h1>
					<div class="choices">
						{#each GOALS as goal (goal.id)}
							<button type="button" class="option" class:selected={profile.goals[0] === goal.id} aria-pressed={profile.goals[0] === goal.id} onclick={() => save({ ...profile, goals: [goal.id as GoalId] })}>
								<span><b>{goal.label}</b><small>{goal.detail}</small></span>
							</button>
						{/each}
					</div>
				{:else if stepId === 'motivation'}
					<h1 id="setup-title" class="h-title">What are you here for?</h1>
					<div class="choices">
						{#each MOTIVATIONS as item (item.id)}
							<button type="button" class="option" class:selected={profile.motivation === item.id} aria-pressed={profile.motivation === item.id} onclick={() => save({ ...profile, motivation: item.id as MotivationId })}>
								{item.label}
							</button>
						{/each}
					</div>
				{:else if stepId === 'side'}
					<h1 id="setup-title" class="h-title">Which side do you want to study?</h1>
					<div class="choices">
						{#each [{ id: 'w', label: 'White' }, { id: 'b', label: 'Black' }, { id: 'either', label: 'Either' }] as side (side.id)}
							<button type="button" class="option" class:selected={profile.side === side.id} aria-pressed={profile.side === side.id} onclick={() => save({ ...profile, side: side.id as StudySide })}>
								{side.label}
							</button>
						{/each}
					</div>
				{:else}
					<h1 id="setup-title" class="h-title">{suggestion ? suggestion.name : 'Choose a course'}</h1>
					{#if suggestion}
						<p class="muted">{suggestion.side === 'w' ? 'White' : 'Black'} · {suggestion.tagline}</p>
						<button class="btn btn-primary block" type="button" disabled={saving} onclick={() => finish(`/course/${suggestion.id}`)}>
							{saving ? 'Saving…' : `Start ${suggestion.name}`}
						</button>
					{:else}
						<p class="muted">Nothing matched. Browse the catalogue and pick one yourself.</p>
					{/if}
					<button class="btn btn-surface block" type="button" disabled={saving || !isReady(profile)} onclick={() => finish('/courses')}>Browse courses</button>
				{/if}
			</div>
		{/key}
		<div class="nav">
			{#if step > 0}<button class="btn btn-surface" type="button" onclick={() => (step -= 1)}>Back</button>{/if}
			{#if stepId !== 'course'}
				<button class="btn btn-primary" type="button" disabled={!canContinue} onclick={() => (step += 1)}>Continue</button>
			{/if}
			<button class="btn btn-ghost" type="button" onclick={skip}>{profile.status === 'completed' ? 'Close' : 'Not now'}</button>
		</div>
	{/if}
</main>

<style>
	.setup-art { width: 96px; height: 96px; object-fit: contain; float: right; }
	.setup {
		display: grid;
		align-content: start;
		gap: 18px;
		padding-top: 22px;
	}
	.panel {
		display: grid;
		gap: 14px;
		animation: setup-in var(--dur-push) var(--ease-out);
	}
	.choices {
		display: grid;
		gap: 8px;
	}
	.option {
		align-items: center;
	}
	.option span {
		display: grid;
		gap: 2px;
	}
	.option small {
		color: var(--text-3);
		font-size: 13px;
		font-weight: 400;
	}
	.option.selected small {
		color: var(--accent-hi);
	}
	.nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.block {
		margin-top: 4px;
	}
	@keyframes setup-in {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}
</style>
