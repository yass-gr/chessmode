<script module lang="ts">
 let shownInMemory = false;
</script>

<script lang="ts">
 import { onMount } from 'svelte';
 import { Share, X } from '@lucide/svelte';
 import { Capacitor } from '@capacitor/core';
 import { classifyInstallEnvironment, isIosSafari, type InstallEnvironment } from '#lib/install.ts';

 let environment = $state<InstallEnvironment>('desktop');
 let safari = $state(false);
 let visible = $state(false);
 const dismissedKey = 'chessmode/install-dismissed';
 const shownKey = 'chessmode/install-shown';

 onMount(() => {
  environment = classifyInstallEnvironment({
   native: Capacitor.isNativePlatform(),
   standalone: window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true),
   userAgent: navigator.userAgent,
   platform: navigator.platform,
   maxTouchPoints: navigator.maxTouchPoints
  });
  safari = isIosSafari(navigator.userAgent);
  if (environment !== 'android' && environment !== 'ios') return;
  if (shownInMemory) return;
  try { if (localStorage.getItem(dismissedKey)) return; } catch {}
  try {
   if (sessionStorage.getItem(shownKey)) return;
   sessionStorage.setItem(shownKey, '1');
  } catch {}
  shownInMemory = true;
  visible = true;
 });

 function dismiss() {
  visible = false;
  try { localStorage.setItem(dismissedKey, '1'); } catch {}
 }
</script>

{#if visible}
 <section class="card install" aria-label="Install Chessmode">
  <button class="close" aria-label="Dismiss install suggestion" onclick={dismiss}><X size={18} /></button>
  {#if environment === 'android'}
   <p class="h-head">Get the Chessmode app for Android</p>
   <p class="muted">Android will ask you to allow installs from your browser.</p>
   <a class="btn sm btn-primary" href="https://github.com/yass-gr/chessmode/releases/latest/download/chessmode.apk">Download for Android</a>
  {:else if safari}
   <p class="h-head">Add Chessmode to your Home Screen</p>
   <p class="muted">Tap the Share button <Share size={17} aria-label="Share" /> then “Add to Home Screen”.</p>
  {:else}
   <p class="h-head">Add Chessmode to your Home Screen</p>
   <p class="muted">Open this page in Safari first, then tap the Share button <Share size={17} aria-label="Share" /> and “Add to Home Screen”.</p>
  {/if}
 </section>
{/if}

<style>
 .install { position: relative; display: grid; justify-items: start; gap: 8px; padding: 16px; margin: 4px 0 12px; }
 .install .h-head { padding-right: 32px; }
 .install :global(svg) { vertical-align: middle; }
 .close { position: absolute; right: 12px; top: 12px; display: grid; place-items: center; width: 36px; height: 36px; color: var(--text-2); }
</style>
