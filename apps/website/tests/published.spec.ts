import { expect, test } from "@playwright/test";

test("serves documented release metadata and usable pages", async ({ page, request }) => {
  const response = await request.get("/version.json");
  expect(response.status()).toBe(200);
  const info = await response.json();
  expect(typeof info.version).toBe("string");
  expect(typeof info.siteSha).toBe("string");
  expect(info.siteSha.trim()).not.toBe("");
  if (process.env.PUBLIC_AIK_VERSION || !process.env.SITE_TEST_URL) {
    expect(info.version).toBe(process.env.PUBLIC_AIK_VERSION || "unreleased");
  }
  if (process.env.PUBLIC_SITE_SHA || !process.env.SITE_TEST_URL) {
    expect(info.siteSha).toBe(process.env.PUBLIC_SITE_SHA || "local");
  }
  if (info.version !== "unreleased") {
    expect(info.version).toMatch(
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-beta\.(0|[1-9]\d*))?$/,
    );
    expect(info.releaseTag).toBe(`v${info.version}`);
  }
  const beta = info.version.includes("-beta.");
  expect(info.channel).toBe(beta ? "next" : "latest");
  expect(info.experimental).toBe(beta);
  for (const route of ["/", "/docs/"]) {
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.getByTestId("release-version")).toHaveText(
      `${beta ? "Experimental beta" : "Version"}: ${info.version}`,
    );
  }
  for (const id of ["quickstart-check", "docs-check", "docs-dlx"]) {
    await expect(page.locator(`code[data-doc-command="${id}"]`)).toContainText(
      /check\s+(?:\\\s+)?--provider aik\.provider\.json\s+(?:\\\s+)?--consumer aik\.consumer\.json --strict$/,
    );
  }
});
