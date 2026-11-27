import { expect, test } from '@playwright/test';

const agents = {
 android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
 safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
 chrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
 desktop: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

for (const [platform, userAgent] of Object.entries(agents)) {
 test(`${platform} install suggestion`, async ({ browser }) => {
  const context = await browser.newContext({ userAgent, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Install Chessmode' });
  if (platform === 'desktop') await expect(card).toHaveCount(0);
  else {
   await expect(card).toBeVisible();
   if (platform === 'android') {
    await expect(card).toContainText('Get the Chessmode app for Android');
    await expect(card.getByRole('link')).toHaveAttribute('href', 'https://github.com/yass-gr/chessmode/releases/latest/download/chessmode.apk');
   } else {
    await expect(card).toContainText('Add to Home Screen');
    if (platform === 'chrome') await expect(card).toContainText('Open this page in Safari first');
    else await expect(card).not.toContainText('Open this page in Safari first');
   }
   await card.getByRole('button', { name: 'Dismiss install suggestion' }).click();
   await page.reload();
   await expect(card).toHaveCount(0);
  }
  await context.close();
 });
}
