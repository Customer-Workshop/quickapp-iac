import { expect, test } from '@playwright/test';
import { loadCharts } from '../lib/charts';

const charts = loadCharts();

test.describe.configure({ mode: 'parallel' });

for (const chart of charts) {
  test.describe(chart.name, () => {
    test('health endpoint responds 200', async ({ request }) => {
      const response = await request.get(chart.baseUrl + chart.healthPath);
      expect(response.status()).toBe(200);
    });

    test('http redirects to https', async ({ request }) => {
      if (!chart.baseUrl.startsWith('https://')) {
        test.skip(true, 'base URL is plain http (local/stub run)');
      }
      const response = await request.get(
        chart.baseUrl.replace('https://', 'http://') + '/',
        { maxRedirects: 0 },
      );
      expect([301, 302, 307, 308]).toContain(response.status());
      expect(response.headers()['location'] ?? '').toMatch(/^https:\/\//);
    });

    if (chart.isMfe) {
      test('root page renders without console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            errors.push(msg.text());
          }
        });
        page.on('pageerror', (err) => errors.push(String(err)));

        const response = await page.goto(chart.baseUrl + '/');
        expect(response?.ok()).toBeTruthy();
        await expect(page.locator('body')).toBeVisible();
        expect(errors).toEqual([]);
      });

      if (chart.name === 'shell-mfe') {
        test('index HTML is served', async ({ request }) => {
          const response = await request.get(chart.baseUrl + '/');
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type'] ?? '').toMatch(/text\/html/);
        });
      } else {
        test('remoteEntry.js is served as JavaScript', async ({ request }) => {
          const response = await request.get(chart.baseUrl + '/remoteEntry.js');
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type'] ?? '').toMatch(/javascript/);
        });
      }
    }

    if (chart.isGateway) {
      for (const apiPath of ['/api/products', '/api/customers']) {
        test(`gateway route ${apiPath} responds`, async ({ request }) => {
          const response = await request.get(chart.baseUrl + apiPath);
          expect([200, 401]).toContain(response.status());
        });
      }
    }
  });
}
