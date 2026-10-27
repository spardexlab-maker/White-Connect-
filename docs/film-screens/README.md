# Explainer films (patient, doctor, lab, pharmacy)

Real app screens recorded from the local stack, framed in a phone or a browser window,
with Iraqi narration from [Habibi-TTS](https://github.com/SWivid/Habibi-TTS) (the
Specialized **IRQ** model, Apache-2.0). The reference voice Habibi imitates is itself
synthetic (Edge TTS), so no real person's voice is cloned.

1. Local stack + web build served on :4173 (`vite preview`) and the mobile web export in
   `apps/mobile/dist-local`.
2. `docs/film-screens/prep-db.sh` — fresh seed, a few days of activity, names without «(تجريبي)».
3. `node docs/film-screens/record-pro.mjs <clips>` then `node docs/film-screens/record-mobile.mjs <clips>`.
4. `python3 docs/film-screens/tts_all.py` (slow on CPU: ~2 min per sentence; cached by text).
5. `python3 docs/film-screens/build.py patient --clips <clips>` (and doctor, lab, pharmacy) →
   `marketing/abyad-explainer-<name>.mp4`.

Narration and on-screen text live in `scripts/<name>.json`.
