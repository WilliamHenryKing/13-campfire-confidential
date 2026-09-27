import { defineConfig } from "@playwright/test";

// Headless end-to-end check against the production build. SwiftShader WebGL is enough.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4623",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://127.0.0.1:4623",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
