export type InstallEnvironment = 'native' | 'standalone' | 'android' | 'ios' | 'desktop';

export function classifyInstallEnvironment(input: {
 native: boolean; standalone: boolean; userAgent: string; platform: string; maxTouchPoints: number;
}): InstallEnvironment {
 if (input.native) return 'native';
 if (input.standalone) return 'standalone';
 if (/Android/i.test(input.userAgent)) return 'android';
 if (/iPhone|iPad|iPod/i.test(input.userAgent) || (input.platform === 'MacIntel' && input.maxTouchPoints > 1)) return 'ios';
 return 'desktop';
}

export function isIosSafari(userAgent: string): boolean {
 return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}
