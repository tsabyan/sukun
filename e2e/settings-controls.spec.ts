import { expect, test, type Page } from '@playwright/test'

/**
 * The settings controls must both change state AND move their indicator.
 *
 * Guards two regressions found together:
 *  - a liveQuery that stopped re-rendering (writes landed, UI froze), because a
 *    non-Dexie await dropped the settings table from the observation set;
 *  - Motion `layout`/`layoutId` snapping instead of sliding under Next 16, now
 *    driven by an explicit transform.
 */

async function skipOnboarding(page: Page) {
  const skip = page.getByRole('button', { name: /^Skip$/ })
  for (let i = 0; i < 3; i++) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click()
      return
    }
    await page.waitForTimeout(200)
  }
}

test('segmented control updates state and slides its thumb', async ({ page }) => {
  await page.goto('/settings')
  await skipOnboarding(page)

  const tabs = page.locator('[role="tablist"][aria-label="Default timer view"]')
  await expect(tabs).toBeVisible()
  const thumb = tabs.locator('span[aria-hidden]')

  await tabs.getByRole('tab', { name: 'Ring' }).click()
  await page.waitForTimeout(400)
  const before = await thumb.boundingBox()

  await tabs.getByRole('tab', { name: 'Flip clock' }).click()
  await expect(tabs.getByRole('tab', { name: 'Flip clock' })).toHaveAttribute('aria-selected', 'true')
  await page.waitForTimeout(400)
  const after = await thumb.boundingBox()

  // Two segments: the thumb must travel right by roughly its own width.
  expect(after!.x - before!.x).toBeGreaterThan(before!.width * 0.6)
})

test('toggle updates state and slides its knob', async ({ page }) => {
  await page.goto('/settings')
  await skipOnboarding(page)

  const swtch = page.getByRole('switch', { name: /Auto-start next session/i })
  await expect(swtch).toBeVisible()
  const knob = swtch.locator('span span').last()

  const wasChecked = (await swtch.getAttribute('aria-checked')) === 'true'
  const before = await knob.boundingBox()
  await swtch.click()
  await expect(swtch).toHaveAttribute('aria-checked', String(!wasChecked))
  await page.waitForTimeout(400)
  const after = await knob.boundingBox()

  expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(10)
})
