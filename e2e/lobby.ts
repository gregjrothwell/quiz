import type { Locator, Page } from '@playwright/test';

/**
 * The lobby as a quizmaster works it. One place, because the pickers sit behind
 * Change (docs/decisions/house-round.md) and every spec that starts a round
 * through the lobby has to open it first.
 */

export function packCard(page: Page, title: string): Locator {
  return page.locator('button.pack', { has: page.locator('.pack__title', { hasText: title }) });
}

/** The one line that says how the round will be run. */
export function houseLine(host: Page): Locator {
  return host.locator('.house__line');
}

export function changeButton(host: Page): Locator {
  return host.getByRole('button', { name: 'Change', exact: true });
}

/** Opens the pickers if they are shut. The lobby always opens with them shut. */
export async function openPickers(host: Page): Promise<void> {
  const change = changeButton(host);
  if ((await change.getAttribute('aria-expanded')) === 'false') await change.click();
}

/** Presses each picker by the words on it, through Change, as a quizmaster has to. */
export async function setRound(host: Page, options: { questions?: number; picks: readonly string[] }): Promise<void> {
  await openPickers(host);
  if (options.questions !== undefined) {
    await host.getByRole('button', { name: String(options.questions), exact: true }).click();
  }
  for (const pick of options.picks) await host.locator('button.pick', { hasText: pick }).click();
}
