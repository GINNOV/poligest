import { expect, test, type Locator } from "@playwright/test";

type RgbColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
};

type ContrastSample = {
  readonly color: RgbColor;
  readonly backgroundColor: RgbColor;
  readonly contrastRatio: number;
};

const MINIMUM_NORMAL_TEXT_CONTRAST = 4.5;

function relativeLuminance({ red, green, blue }: RgbColor) {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  const [redLuminance, greenLuminance, blueLuminance] = channels;
  return 0.2126 * redLuminance + 0.7152 * greenLuminance + 0.0722 * blueLuminance;
}

function contrastRatio(foreground: RgbColor, background: RgbColor) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgbColor(value: string): RgbColor {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) {
    throw new Error(`Unsupported color format: ${value}`);
  }

  return {
    red: Number.parseInt(match[1], 10),
    green: Number.parseInt(match[2], 10),
    blue: Number.parseInt(match[3], 10),
  };
}

async function sampleInputContrast(input: Locator): Promise<ContrastSample> {
  const styles = await input.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor,
    };
  });
  const color = parseRgbColor(styles.color);
  const backgroundColor = parseRgbColor(styles.backgroundColor);

  return {
    color,
    backgroundColor,
    contrastRatio: contrastRatio(color, backgroundColor),
  };
}

test("keeps staff credential fields readable on the dark sign-in form", async ({ page }) => {
  await page.route("**/api/stack/**/projects/current", async (route) => {
    await route.fulfill({
      json: {
        id: "11111111-1111-4111-8111-111111111111",
        display_name: "Smoke test",
        config: {
          sign_up_enabled: true,
          credential_enabled: true,
          magic_link_enabled: true,
          passkey_enabled: false,
          client_team_creation_enabled: false,
          client_user_deletion_enabled: false,
          allow_team_api_keys: false,
          allow_user_api_keys: false,
          enabled_oauth_providers: [{ id: "google" }],
        },
      },
    });
  });
  await page.goto("/handler/sign-in?audience=staff&method=password");

  const emailInput = page.getByLabel("Email");
  const passwordInput = page.locator('input[name="password"]');

  await emailInput.fill("staff@example.com");
  await passwordInput.fill("secret");

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect.poll(async () => (await sampleInputContrast(emailInput)).contrastRatio).toBeGreaterThanOrEqual(
    MINIMUM_NORMAL_TEXT_CONTRAST,
  );
  await expect.poll(async () => (await sampleInputContrast(passwordInput)).contrastRatio).toBeGreaterThanOrEqual(
    MINIMUM_NORMAL_TEXT_CONTRAST,
  );
  await expect(page.getByText("Password dimenticata?")).toHaveCSS("color", "rgb(34, 211, 238)");
});
