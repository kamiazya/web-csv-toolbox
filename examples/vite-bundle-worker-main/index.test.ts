import { test, expect } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

test.describe('Vite Bundle Worker Main Example', () => {
  test.beforeAll(async () => {
    // Server should be started before running tests
  });

  test('should load the page', async ({ page }) => {
    await page.goto(BASE_URL);

    await expect(page.locator('h1')).toContainText('Browser Worker (Main Version) Example');
    await expect(page.locator('#test0')).toBeVisible();
    await expect(page.locator('#test1')).toBeVisible();
    await expect(page.locator('#test2')).toBeVisible();
    await expect(page.locator('#test3')).toBeVisible();
  });

  test('Test 0: Basic Parsing (No Worker)', async ({ page }) => {
    await page.goto(BASE_URL);

    const button = page.locator('#test0');
    await button.click();

    // Wait for result to appear
    const result = page.locator('#result0');
    await expect(result).toContainText('✅', { timeout: 10000 });
    await expect(result).toContainText('Alice');
    await expect(result).toContainText('Bob');
    await expect(result).toContainText('Charlie');
  });

  test('Test 1: Worker (JavaScript Engine)', async ({ page }) => {
    await page.goto(BASE_URL);

    const button = page.locator('#test1');
    await button.click();

    // Wait for result to appear
    const result = page.locator('#result1');
    await expect(result).toContainText('✅', { timeout: 10000 });
    await expect(result).toContainText('Alice');
    await expect(result).toContainText('Bob');
    await expect(result).toContainText('Charlie');
  });

  test('Test 2: Worker + WASM', async ({ page }) => {
    await page.goto(BASE_URL);

    const button = page.locator('#test2');
    await button.click();

    // Wait for result to appear
    const result = page.locator('#result2');
    await expect(result).toContainText('✅', { timeout: 10000 });
    await expect(result).toContainText('Alice');
    await expect(result).toContainText('Bob');
    await expect(result).toContainText('Charlie');
  });

  test('Test 3: Parallel Processing', async ({ page }) => {
    await page.goto(BASE_URL);

    const button = page.locator('#test3');
    await button.click();

    // Wait for result to appear
    const result = page.locator('#result3');
    await expect(result).toContainText('✅', { timeout: 10000 });
    await expect(result).toContainText('CSV 1');
    await expect(result).toContainText('CSV 2');
    await expect(result).toContainText('CSV 3');
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);

    // Run all tests
    await page.locator('#test0').click();
    await expect(page.locator('#result0')).toContainText('✅', { timeout: 10000 });

    await page.locator('#test1').click();
    await expect(page.locator('#result1')).toContainText('✅', { timeout: 10000 });

    await page.locator('#test2').click();
    await expect(page.locator('#result2')).toContainText('✅', { timeout: 10000 });

    await page.locator('#test3').click();
    await expect(page.locator('#result3')).toContainText('✅', { timeout: 10000 });

    // Check for console errors
    expect(consoleErrors).toHaveLength(0);
  });
});
