import { expect, test, type Page, type Response } from "@playwright/test";

function isApplicationRouteResponse(response: Response) {
  const url = new URL(response.url());
  return url.pathname === "/richiami/programmati" || url.pathname === "/it/richiami/programmati";
}

async function expectNoErrorDialog(page: Page) {
  await expect(page.getByText("Si è verificato un errore. Riprova.")).toHaveCount(0);
  await expect(page.getByText("GET 404")).toHaveCount(0);
  await expect(page.getByText("Transaction API error")).toHaveCount(0);
}

test("loads scheduled recalls in a real browser without route errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const failedApplicationResponses: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (isApplicationRouteResponse(response) && response.status() >= 400) {
      failedApplicationResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/richiami/programmati", { waitUntil: "networkidle" });

  await expect(page).toHaveTitle(/Richiami programmati/);
  await expect(page.getByRole("heading", { name: "Richiami in scadenza" })).toBeVisible();
  await expect(page.getByText(/richiami trovati/)).toBeVisible();
  await expectNoErrorDialog(page);
  expect(pageErrors).toEqual([]);
  expect(failedApplicationResponses).toEqual([]);
});
