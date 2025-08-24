import os
from playwright.sync_api import sync_playwright, Page, expect

def verify_spacing(page: Page):
    """
    This script verifies the spacing of the inline dream editor.
    It uses dispatch_event as an alternative click method for robustness.
    """
    # Listen for any console messages from the browser and print them
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    file_path = os.path.abspath('index.html')
    page.goto(f'file://{file_path}')

    # 1. Arrange: Fill out the main dream form.
    dream_title = "A Test Dream About Spacing"
    dream_content = "This is the content of the test dream."

    page.locator("#dreamTitle").fill(dream_title)
    page.locator("#dreamContent").fill(dream_content)

    # 2. Act: Click the "Save Dream" button.
    page.get_by_role("button", name="Save Dream").click()

    # 3. Assert: Wait for the new dream entry to appear.
    entry_element = page.locator(".entry", has_text=dream_title)
    expect(entry_element).to_be_visible()

    # 4. Act: Click the "Edit" button using dispatch_event.
    edit_button = entry_element.get_by_role("button", name="Edit")
    edit_button.dispatch_event('click')

    # 5. Assert & Screenshot: The entry is now in edit mode.
    # Wait for the textarea to be visible to confirm edit mode is active.
    expect(entry_element.locator("textarea")).to_be_visible(timeout=10000)

    # Take the final screenshot of the entry in edit mode.
    entry_element.screenshot(path="jules-scratch/verification/verification.png")

# Standard Playwright boilerplate to run the script
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        verify_spacing(page)
        print("Verification script ran successfully.")
    except Exception as e:
        print(f"Verification script failed: {e}")
    finally:
        browser.close()
