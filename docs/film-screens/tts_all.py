#!/usr/bin/env python3
"""Pre-generates the Habibi-TTS narration of every scene of every film into the cache."""
import json, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import build
cache = Path('/home/user/tts/cache'); ref = cache / 'ref.wav'
for name in sys.argv[1:] or ['patient', 'doctor', 'lab', 'pharmacy']:
    for s in json.load(open(Path(__file__).parent / 'scripts' / f'{name}.json'))['scenes']:
        t = time.time(); out = cache / f"last-{name}.wav"
        build.habibi(s['text'], out, ref, cache)
        print(f"{name}/{s['id']}: {build.dur(out):.1f}s audio in {time.time() - t:.0f}s", flush=True)
