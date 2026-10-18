// URL navigation may commit after the native select event. Wait for both the
// requested control and React's matching calendar caption before the next action.
export async function selectCalendarValue(page, index, value) {
  await page.locator('.mcal-controls select').nth(index).selectOption(String(value));
  await page.waitForFunction(({ index, value }) => {
    const controls = [...document.querySelectorAll('.mcal-controls select')];
    if (controls.length !== 3 || controls[index].value !== value) return false;
    return document.querySelector('.mcal-grid caption')?.textContent ===
      `${controls[0].value.toUpperCase()} · ${controls[1].value}-${controls[2].value.padStart(2, '0')}`;
  }, { index, value: String(value) });
}

export async function selectCalendarDay(page, day) {
  await page.locator('.mcal-day').filter({ has: page.locator('strong', { hasText: new RegExp(`^${day}$`) }) }).click();
  await page.waitForFunction(day => document.querySelector('.mcal-day[aria-pressed="true"] strong')?.textContent === String(day), day);
}
