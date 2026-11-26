import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'app.chessmode',
	appName: 'Chessmode',
	webDir: 'build',
	plugins: {
		SplashScreen: { launchAutoHide: false, backgroundColor: '#0d0d0e', showSpinner: false },
		Keyboard: { resize: 'native' },
		StatusBar: { style: 'DARK', backgroundColor: '#0d0d0e', overlaysWebView: false }
	}
};

export default config;
