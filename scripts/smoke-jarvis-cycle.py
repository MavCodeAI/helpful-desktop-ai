"""
JARVIS full voice-cycle smoke.

Drives one complete idle → listening → thinking → speaking → idle cycle
against the live dev server with the three backend routes mocked at the
Playwright network layer:

  - /api/stt     → JSON { text: "hello jarvis" }
  - /api/chat    → SSE stream with one delta + [DONE]
  - /api/tts     → tiny silent WAV blob

Fake mic (--use-fake-*-media-stream) supplies MediaRecorder with audio so
the recorder produces a real blob without needing microphone permission
UI. We drive the orb by clicking it (start), waiting, then clicking again
(stop) — mirroring the actual user gesture.

Success = caption returns to "TAP TO START" (phase machine landed back at
idle) and no pageerror surfaced along the way.

Run:  python3 scripts/smoke-jarvis-cycle.py
"""
import asyncio
import base64
import struct
import sys
from pathlib import Path
import re
from playwright.async_api import async_playwright, Route

SHOTS = Path(__file__).parent.parent / ".lovable" / "smoke-shots"
SHOTS.mkdir(parents=True, exist_ok=True)


def silent_wav_bytes(ms: int = 200, rate: int = 16000) -> bytes:
    """Minimal PCM16 mono WAV — decodable by <audio> in every browser."""
    n_samples = rate * ms // 1000
    data = b"\x00\x00" * n_samples
    header = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    fmt = b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
    dat = b"data" + struct.pack("<I", len(data))
    return header + fmt + dat + data


SSE_CHAT = (
    'data: {"choices":[{"delta":{"content":"Hello there."}}]}\n\n'
    "data: [DONE]\n\n"
)


async def mock_stt(route: Route) -> None:
    await route.fulfill(
        status=200,
        headers={"content-type": "application/json"},
        body='{"text":"hello jarvis"}',
    )


async def mock_chat(route: Route) -> None:
    await route.fulfill(
        status=200,
        headers={"content-type": "text/event-stream"},
        body=SSE_CHAT,
    )


async def mock_tts(route: Route) -> None:
    await route.fulfill(
        status=200,
        headers={"content-type": "audio/wav"},
        body=silent_wav_bytes(),
    )


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

        await ctx.route("**/api/stt*", mock_stt)
        await ctx.route("**/api/chat", mock_chat)
        await ctx.route("**/api/tts", mock_tts)

        await page.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await page.evaluate(
            "localStorage.setItem('jarvis.license', 'JARVIS-DEMO-0001');"
            "localStorage.setItem('jarvis:coachmark:v1', '1');"
        )
        await page.goto("http://localhost:8080/jarvis", wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(SHOTS / "cycle-1-idle.png"))

        # The orb button carries aria-label "Voice input" — start listening.
        orb = page.get_by_role("button", name="Voice input")
        if await orb.count() == 0:
            print("SMOKE FAILED: could not find orb button (aria-label 'Voice input')")
            await browser.close()
            return 1

        await orb.first.click()
        # Wait until phase machine reports "LISTENING" caption.
        try:
            await page.get_by_text("LISTENING", exact=True).wait_for(timeout=4000)
        except Exception:
            await page.screenshot(path=str(SHOTS / "cycle-fail-listening.png"))
            print("SMOKE FAILED: never reached LISTENING")
            await browser.close()
            return 1
        await page.wait_for_timeout(600)  # let recorder capture a few chunks
        await page.screenshot(path=str(SHOTS / "cycle-2-listening.png"))

        # Stop → triggers STT → chat → TTS.
        await orb.first.click()

        # Speaking should appear once TTS blob loads.
        try:
            await page.get_by_text("SPEAKING", exact=True).wait_for(timeout=8000)
        except Exception:
            await page.screenshot(path=str(SHOTS / "cycle-fail-speaking.png"))
            print("SMOKE FAILED: never reached SPEAKING (STT/chat/TTS mock cycle)")
            if page_errors:
                print("  pageerrors:", page_errors[:3])
            await browser.close()
            return 1
        await page.screenshot(path=str(SHOTS / "cycle-3-speaking.png"))

        # Back to idle after playback ends.
        try:
            await page.get_by_text("TAP TO START", exact=True).wait_for(timeout=6000)
        except Exception:
            await page.screenshot(path=str(SHOTS / "cycle-fail-idle.png"))
            print("SMOKE FAILED: never returned to idle")
            await browser.close()
            return 1
        await page.screenshot(path=str(SHOTS / "cycle-4-back-to-idle.png"))

        failures = []
        if page_errors:
            failures.append(f"pageerror(s): {page_errors[:3]}")

        await browser.close()

        if failures:
            print("SMOKE FAILED:")
            for f in failures:
                print(" -", f)
            return 1
        print("CYCLE SMOKE OK — idle → listening → thinking → speaking → idle")
        return 0


sys.exit(asyncio.run(main()))
