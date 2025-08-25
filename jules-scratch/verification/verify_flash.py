import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # Get the absolute path to the HTML file
        file_path = os.path.abspath('index.html')
        url = f'file://{file_path}'

        # --- Test Case 1: No PIN set ---
        # The user should see the journal view after a brief moment
        page = await browser.new_page()
        await page.goto(url)

        # The journal tab should become active
        journal_tab = page.locator('#journalTab')
        await expect(journal_tab).to_be_visible(timeout=5000)

        # Take a screenshot to show the app in its default unlocked state
        await page.screenshot(path="jules-scratch/verification/unlocked_view.png")
        await page.close()

        # --- Test Case 2: PIN is set ---
        # The user should see the lock screen immediately
        context = await browser.new_context()
        await context.add_init_script("localStorage.setItem('dreamJournalPinHash', '\"somehash\"');")
        page = await context.new_page()
        await page.goto(url)

        # The lock tab should be visible
        lock_tab = page.locator('#lockTab')
        await expect(lock_tab).to_be_visible(timeout=5000)

        # The journal tab should NOT be visible
        journal_tab = page.locator('#journalTab')
        await expect(journal_tab).not_to_be_visible()

        # Take a screenshot to show the locked state
        await page.screenshot(path="jules-scratch/verification/locked_view.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
