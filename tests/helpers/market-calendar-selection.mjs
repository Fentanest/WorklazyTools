// Wait for URL navigation and the rendered calendar before the next arrow click.
export async function selectCalendarValue(page, index, value) {
  const caption = () => page.locator('.mcal-grid caption').innerText();
  if (index === 0) {
    await page.locator('.mcal-controls select').selectOption(String(value));
    await page.waitForFunction(value => {
      const params = new URLSearchParams(location.search);
      return params.get('venue') === value && document.querySelector('.mcal-grid caption')?.textContent ===
        `${value.toUpperCase()} · ${params.get('year')}-${params.get('month').padStart(2, '0')}`;
    }, String(value));
    return;
  }
  const match = (await caption()).match(/(\d{4})-(\d{2})$/);
  let current = Number(match[index]);
  const target = Number(value);
  while (current !== target) {
    const direction = target > current ? 1 : -1;
    const before = await caption();
    await page.locator('.mcal-nav button').nth(index === 1 ? (direction > 0 ? 3 : 0) : (direction > 0 ? 2 : 1)).click();
    current += direction;
    await page.waitForFunction(({ index, current, before }) => {
      const params = new URLSearchParams(location.search);
      const caption = document.querySelector('.mcal-grid caption')?.textContent;
      return Number(params.get(index === 1 ? 'year' : 'month')) === current && caption !== before && caption ===
        `${params.get('venue').toUpperCase()} · ${params.get('year')}-${params.get('month').padStart(2, '0')}`;
    }, { index, current, before });
  }
}

export async function selectCalendarDay(page, day) {
  await page.locator('.mcal-day').filter({ has: page.locator('strong', { hasText: new RegExp(`^${day}$`) }) }).click();
  await page.waitForFunction(day => document.querySelector('.mcal-day[aria-pressed="true"] strong')?.textContent === String(day), day);
}
