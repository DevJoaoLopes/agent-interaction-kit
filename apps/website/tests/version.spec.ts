import { expect, test } from "@playwright/test";

test("returns release metadata at /version.json", async ({ request }) => {
  const response = await request.get("/version.json");
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toEqual({
    version: expect.any(String),
    channel: expect.any(String),
    releaseTag: expect.any(String),
    siteSha: expect.any(String),
    experimental: expect.any(Boolean),
  });
});

test("renders release version indicator on landing page", async ({ page, request }) => {
  const response = await request.get("/version.json");
  const data = await response.json();

  await page.goto("/");
  const indicator = page.locator('[data-testid="release-version"]');
  await expect(indicator).toBeVisible();
  await expect(indicator).toContainText(data.version);
  if (data.experimental) {
    await expect(indicator).toContainText("Experimental beta");
  } else {
    await expect(indicator).toContainText("Version");
  }
});
