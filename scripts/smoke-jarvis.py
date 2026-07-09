"""
JARVIS /jarvis smoke test.

Verifies the console page renders end-to-end after refactor:
  - License gate bypassed (seeded valid demo key in localStorage).
  - Route loads without page errors.
  - Idle caption "TAP TO START" (from src/features/voice/phase-machine.ts
    PHASE_CAPTION.idle) is visible — proves the extracted constant is
    still wired into the orb.
  - At least one button (the orb + side buttons + header controls) is
    rendered.

Run locally against the dev server:
    python3 scripts/smoke-jarvis.py

Exits 0 on success, non-zero on failure. Not a full voice cycle — mocking
mic input + /api/{stt,chat,tts} is deferred; see .lovable/plan.md.
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent.parent / ".lovable" / "smoke-shots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--use-fake-ui-for-media-stream",
                "--use-fake-device-for-media-stream",
                "--autoplay-policy=no-user-gesture-required",
            ],
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            permissions=["microphone"],
        )
        page = await ctx.new_page()

        page_errors: list[str] = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        # Seed license + suppress first-run coachmark toast so the smoke
        # sees a stable UI.
        await page.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await page.evaluate(
            "localStorage.setItem('jarvis.license', 'JARVIS-DEMO-0001');"
            "localStorage.setItem('jarvis:coachmark:v1', '1');"
        )

        await page.goto("http://localhost:8080/jarvis", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(SHOTS / "jarvis-idle.png"))

        caption = await page.get_by_text("TAP TO START", exact=True).count()
        buttons = await page.get_by_role("button").count()

        failures = []
        if caption != 1:
            failures.append(f"expected 1 'TAP TO START' caption, got {caption}")
        if buttons < 3:
            failures.append(f"expected at least 3 buttons, got {buttons}")
        if page_errors:
            failures.append(f"pageerror(s): {page_errors[:3]}")

        await browser.close()

        if failures:
            print("SMOKE FAILED:")
            for f in failures:
                print(" -", f)
            return 1
        print(f"SMOKE OK — caption=1, buttons={buttons}, no pageerror")
        return 0


sys.exit(asyncio.run(main()))
