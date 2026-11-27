import { describe, expect, it } from 'vitest';
import { classifyInstallEnvironment, isIosSafari } from './install.ts';

describe('install environment', () => {
 const base = { native: false, standalone: false, userAgent: '', platform: '', maxTouchPoints: 0 };
 it('prioritizes native and installed apps', () => {
  expect(classifyInstallEnvironment({ ...base, native: true, standalone: true, userAgent: 'Android' })).toBe('native');
  expect(classifyInstallEnvironment({ ...base, standalone: true, userAgent: 'iPhone' })).toBe('standalone');
 });
 it('recognizes mobile and desktop platforms', () => {
  expect(classifyInstallEnvironment({ ...base, userAgent: 'Android' })).toBe('android');
  expect(classifyInstallEnvironment({ ...base, userAgent: 'iPhone' })).toBe('ios');
  expect(classifyInstallEnvironment({ ...base, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  expect(classifyInstallEnvironment(base)).toBe('desktop');
 });
 it('distinguishes iOS browsers', () => {
  expect(isIosSafari('iPhone Version/17.0 Mobile Safari/604.1')).toBe(true);
  expect(isIosSafari('iPhone CriOS/120 Mobile Safari/604.1')).toBe(false);
  expect(isIosSafari('iPhone FxiOS/120 Mobile Safari/604.1')).toBe(false);
 });
});
