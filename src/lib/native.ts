import { Capacitor, CapacitorHttp, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { readPreferences } from '#lib/settings/preferences.ts';

export const isNative = () => Capacitor.isNativePlatform();

export async function setupNative() {
	if (!isNative()) return;
	document.documentElement.classList.add('native');
	// Android 15+ draws under a transparent status bar and ignores setBackgroundColor.
	// Dark style is light icons. The page paints #0d0d0e into that band; safe-area
	// padding (injected by SystemBars, or env() on iOS) keeps content below it.
	void SystemBars.setStyle({ style: SystemBarsStyle.Dark });
	void StatusBar.setStyle({ style: Style.Dark });
	void StatusBar.setOverlaysWebView({ overlay: true });
	void App.addListener('backButton', ({ canGoBack }) => {
		if (location.pathname === '/') void App.exitApp();
		else if (canGoBack) history.back();
		else location.assign('/');
	});
	document.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('button, [role=button], a.btn')) {
			void readPreferences().then((preferences) => { if (preferences.haptics) vibrate(20); });
		}
		const link = target.closest('a[href]');
		if (!(link instanceof HTMLAnchorElement) || !/^https?:$/.test(link.protocol) || link.origin === location.origin) return;
		event.preventDefault();
		void Browser.open({ url: link.href });
	}, true);
	await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	await SplashScreen.hide();
}

export function vibrate(ms: number) {
	if (isNative()) void Haptics.impact({ style: ImpactStyle.Light });
	else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export async function onlineFetch(url: string, init: RequestInit): Promise<Response> {
	if (!isNative()) return fetch(url, init);
	init.signal?.throwIfAborted();
	const result = await CapacitorHttp.get({ url, headers: { Accept: new Headers(init.headers).get('Accept') ?? 'application/json', 'User-Agent': 'Chessmode/0.0.1 (https://github.com/yass-gr/chessmode)' }, responseType: 'text' });
	init.signal?.throwIfAborted();
	const body = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
	return new Response(body, { status: result.status, headers: result.headers });
}
