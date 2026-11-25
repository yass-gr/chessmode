<script lang="ts">
 export interface Intro { title: string; video: string; captions?: string; transcript?: string; poster?: string }
 let { intro, onclose }: { intro: Intro; onclose: () => void } = $props();
</script>
<section class="card intro" aria-label={intro.title}>
 <header><h2>{intro.title}</h2><button class="btn btn-surface" onclick={onclose}>Close</button></header>
 <video controls preload="metadata" poster={intro.poster}>
  <source src={intro.video} />
  {#if intro.captions}<track kind="captions" src={intro.captions} srclang="en" label="English" default />{/if}
 </video>
 {#if intro.transcript}<details><summary>Transcript</summary><p>{intro.transcript}</p></details>{/if}
</section>
<style>.intro { padding:16px; } header { display:flex; justify-content:space-between; align-items:center; gap:12px; } h2 { margin:0; } video { width:100%; margin-top:12px; } p { white-space:pre-wrap; }</style>
