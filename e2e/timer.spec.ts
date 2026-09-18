import { expect, test, type Page } from '@playwright/test'

/**
 * The Phase 9 done-criteria: a full session lifecycle in a real browser,
 * including a backgrounded stretch.
 *
 * Everything else about the timer is covered by unit tests over a fake clock.
 * What only a browser can prove is that the Web Worker ticks, the state
 * survives a reload, and a phase that ends while the tab is hidden is still
 * recorded with its true duration.
 */

/**
 * Onboarding covers the whole screen on a fresh profile. Scoped to the overlay
 * dialog: the focus screen has a Skip button of its own, and an unscoped match
 * skips the *phase* instead.
 */
async function skipOnboarding(page: Page) {
  const skip = page
    .getByRole('dialog', { name: 'Welcome to Sukun' })
    .getByRole('button', { name: /^Skip$/ })
  for (let i = 0; i < 3; i++) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click()
      return
    }
    await page.waitForTimeout(200)
  }
}

/** Sets the duration and lands on the focus screen, wherever we were before. */
async function setFocusMinutes(page: Page, minutes: number) {
  await page.waitForFunction(() => '__repo' in window, null, { timeout: 15_000 })
  await page.evaluate(
    async (m) =>
      (window as unknown as { __repo: { updateSettings: (p: unknown) => Promise<void> } }).__repo.updateSettings(
        { focusMinutes: m },
      ),
    minutes,
  )
  await page.goto('/focus')
  await skipOnboarding(page)
}

const countdown = (page: Page) => page.locator('.numerals').first()

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await skipOnboarding(page)
})

test('runs a full session and records it', async ({ page }) => {
  // The session itself takes a minute of wall clock; the default 60s budget
  // would expire mid-wait.
  test.setTimeout(150_000)

  // A one-minute focus keeps the test honest without a five-minute runtime.
  await setFocusMinutes(page, 1)
  await expect(countdown(page)).toHaveText('01:00', { timeout: 10_000 })

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  // The worker is what drives this; if it never posts, the text never changes.
  await expect(countdown(page)).not.toHaveText('01:00', { timeout: 5_000 })

  await page.waitForTimeout(62_000)

  const sessions = await page.evaluate(async () =>
    (window as unknown as { __db: { sessions: { toArray: () => Promise<unknown[]> } } }).__db.sessions.toArray(),
  )
  expect(sessions).toHaveLength(1)

  const [session] = sessions as Array<{ mode: string; completed: boolean; actualDurationSec: number }>
  expect(session.mode).toBe('focus')
  expect(session.completed).toBe(true)
  expect(session.actualDurationSec).toBe(60)

  // Focus hands over to the break, and auto-start breaks is on by default, so
  // the screen inverts to the break phase rather than sitting idle.
  await expect(page.getByText('SHORT BREAK', { exact: true })).toBeVisible()
})

test('survives a reload mid-session', async ({ page }) => {
  await setFocusMinutes(page, 25)
  await page.getByRole('button', { name: 'Start', exact: true }).click()

  await page.waitForTimeout(3000)
  const before = await countdown(page).textContent()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
    timeout: 10_000,
  })

  const after = await countdown(page).textContent()
  expect(after).not.toBe('25:00')
  // Still counting down from where it was, not restarted.
  expect(Number(after!.split(':')[1])).toBeLessThanOrEqual(Number(before!.split(':')[1]))
})

test('keeps time while the tab is hidden', async ({ page, context }) => {
  await setFocusMinutes(page, 25)
  await page.getByRole('button', { name: 'Start', exact: true }).click()

  // A second tab pushes the first into the background for real.
  const other = await context.newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await page.waitForTimeout(6000)
  await page.bringToFront()
  await other.close()

  await expect(countdown(page)).not.toHaveText('25:00')
  const remaining = await countdown(page).textContent()
  const [minutes, seconds] = remaining!.split(':').map(Number)
  const elapsed = 25 * 60 - (minutes * 60 + seconds)

  // Six seconds passed; anything wildly different means the clock drifted.
  expect(elapsed).toBeGreaterThanOrEqual(5)
  expect(elapsed).toBeLessThanOrEqual(12)
})

test('attaches a task and counts a pomodoro against it', async ({ page }) => {
  test.setTimeout(150_000)

  await page.goto('/tasks')
  await page.getByLabel('New task').click()

  await page.getByLabel('Title').fill('E2E task')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('E2E task')).toBeVisible()

  await setFocusMinutes(page, 1)
  await page.getByRole('button', { name: 'Attach a task' }).click()
  // Scoped to the picker: the hidden onboarding overlay is a dialog too.
  await page
    .getByRole('dialog', { name: /Attach a task/i })
    .getByRole('button', { name: /E2E task/ })
    .click()

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.waitForTimeout(62_000)

  const pomodoros = await page.evaluate(async () => {
    const repo = (window as unknown as {
      __repo: { listTasks: () => Promise<Array<{ title: string; completedPomodoros: number }>> }
    }).__repo
    const tasks = await repo.listTasks()
    return tasks.find((t) => t.title === 'E2E task')?.completedPomodoros
  })

  expect(pomodoros).toBe(1)
})
