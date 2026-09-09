import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`landing at ${width}px has loaded artwork and no overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Keep your UI in sync");
    await expect(page.locator(".ecosystem img")).toHaveCount(4);
    for (const img of await page.locator(".ecosystem img").all()) {
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`) });
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/docs\//);
  });
}

test("scroll narrative reaches all states and reverses", async ({ page }) => {
  await page.goto("/");
  await page.locator(".contract-story").scrollIntoViewIfNeeded();
  await expect(page.locator(".contract-story")).toHaveClass(/is-enhanced/);
  for (const stage of [0, 1, 2, 3, 1, 0]) {
    await page.locator(".contract-story").evaluate((el, value) => {
      document.documentElement.style.scrollBehavior = "auto";
      const start = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, start + (el.clientHeight - window.innerHeight) * ((value + 0.4) / 4));
    }, stage);
    await expect(page.locator(".animated-story .story-scene")).toHaveAttribute(
      "data-stage",
      String(stage),
    );
  }
});

test("docs tabs support keyboard and command copying", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/");
  await expect(page.locator("astro-island")).not.toHaveAttribute("ssr", "");
  await page.getByRole("tab", { name: "1. Build locally" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "2. Run check" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("button", { name: "Copy command" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("--strict");
  const response = await page.request.get("/examples/provider.json");
  expect((await response.json()).tools[0].name).toBe("getOrder");
});

test("reduced motion uses the static narrative", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".contract-story").scrollIntoViewIfNeeded();
  await expect(page.locator(".static-story")).toBeVisible();
  await expect(page.locator(".animated-story")).toBeHidden();
});

test("without JavaScript the narrative and quickstart are readable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4322/");
  await expect(page.locator(".static-story")).toBeVisible();
  await expect(page.locator(".static-story .story-scene")).toHaveCount(4);
  await page.goto("http://127.0.0.1:4322/docs/");
  await expect(page.locator(".code-block").first()).toContainText("pnpm build:core");
  await expect(page.locator(".code-block").first()).toBeVisible();
  await context.close();
});

for (const path of ["/", "/docs/"]) {
  test(`accessibility: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
