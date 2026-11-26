import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'app.chessmode',
	appName: 'Chessmode',
	webDir: 'build',
	backgroundColor: '#0d0d0e',
	plugins: {
		SplashScreen: { launchAutoHide: false, backgroundColor: '#0d0d0e', showSpinner: false },
		Keyboard: { resize: 'native' },
		// Android 15+ ignores status-bar color and forces edge-to-edge. Overlay the
		// bars so the page background shows through, and let SystemBars supply insets.
		StatusBar: { style: 'DARK', backgroundColor: '#0d0d0e', overlaysWebView: true },
		SystemBars: { insetsHandling: 'css', style: 'DARK', initialViewportFitValueHint: 'cover' }
	}
};

export default config;
