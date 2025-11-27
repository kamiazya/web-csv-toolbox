import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for testing CSV parsing engines.
 *
 * Projects:
 * - chromium: Standard Chromium (JS, WASM, Worker tests)
 * - chromium-gpu: Chromium with WebGPU flags (GPU tests)
 * - firefox: Firefox (JS, WASM, Worker tests)
 * - webkit: WebKit (JS, WASM, Worker tests)
 *
 * WebGPU Headless Testing:
 * The chromium-gpu project includes flags required for WebGPU in headless mode.
 *
 * @see https://developer.chrome.com/blog/supercharge-web-ai-testing
 * @see https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  projects: [
    // Standard Chromium for JS, WASM, Worker tests
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Chromium with WebGPU support for GPU tests
    {
      name: "chromium-gpu",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // Required for headless WebGPU
            "--headless=new",
            // Use Vulkan backend for ANGLE (required for WebGPU)
            "--use-angle=vulkan",
            // Enable Vulkan features
            "--enable-features=Vulkan",
            // Disable Vulkan surface (required for headless)
            "--disable-vulkan-surface",
            // Enable WebGPU (unsafe flag for experimental support)
            "--enable-unsafe-webgpu",
            // Additional stability flags
            "--disable-gpu-sandbox",
            "--no-sandbox",
            // Disable software rasterizer fallback (force GPU usage)
            "--disable-software-rasterizer",
          ],
        },
      },
    },

    // Firefox for cross-browser testing
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    // WebKit for cross-browser testing
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
