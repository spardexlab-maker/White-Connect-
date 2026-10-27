#!/usr/bin/env python3
"""Sound for a film: the narration at each scene's start, a soft synthesized music bed
ducked under the voice, and a light whoosh on every scene change.
Usage: mix.py <work-dir> <seconds>"""
import json, re, subprocess, sys
from pathlib import Path

work, T = Path(sys.argv[1]), float(sys.argv[2])
film = json.loads(re.sub(r'^window\.FILM=|;$', '', (work / 'data.js').read_text().strip()))
run = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True, cwd=work)

A = [130.81, 164.81, 196.0, 246.94]; B = [110.0, 138.59, 164.81, 220.0]
tone = lambda fs: '+'.join(f'sin(2*PI*{f}*t)+0.3*sin(2*PI*{f*2}*t)' for f in fs)
expr = f"0.055*((0.5+0.5*cos(2*PI*t/16))*({tone(A)})+(0.5-0.5*cos(2*PI*t/16))*({tone(B)}))*(0.82+0.18*sin(2*PI*t/2))"
run('-f', 'lavfi', '-i', f"aevalsrc='{expr}':s=44100:d={T + 1}", '-af',
    f"lowpass=f=1500,aecho=0.8:0.7:140|300:0.3|0.2,afade=t=in:d=2,afade=t=out:st={max(0, T - 3)}:d=3,volume=0.6", '-ac', '2', 'music.wav')
run('-f', 'lavfi', '-i', 'anoisesrc=d=0.7:c=pink:a=0.35', '-af',
    'bandpass=f=1800:w=1600,afade=t=in:d=0.25,afade=t=out:st=0.3:d=0.4,volume=0.55', '-ac', '2', 'whoosh.wav')

ins, fl, n = [], [], 0
voices = [s for s in film['scenes'] if s['start'] + s['audioOffset'] < T]
for s in voices:
    ins += ['-i', f"audio/{s['id']}.wav"]; d = int((s['start'] + s['audioOffset']) * 1000)
    fl.append(f"[{n}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={d}|{d}[v{n}]"); n += 1
nv = n
cuts = [s['start'] for s in film['scenes'][1:] if s['start'] < T]
for j, c in enumerate(cuts):
    ins += ['-i', 'whoosh.wav']; d = max(0, int((c - 0.25) * 1000))
    fl.append(f"[{n}:a]adelay={d}|{d}[w{j}]"); n += 1
ins += ['-i', 'music.wav']; mi = n
fl.append(''.join(f'[v{i}]' for i in range(nv)) + f"amix=inputs={nv}:normalize=0,volume=1.5,asplit=2[voice][key]")
fl.append(f"[{mi}:a][key]sidechaincompress=threshold=0.03:ratio=7:attack=30:release=450[bed]")
fl.append('[voice][bed]' + ''.join(f'[w{j}]' for j in range(len(cuts))) + f"amix=inputs={2 + len(cuts)}:normalize=0,alimiter=limit=0.93,apad[mix]")
run(*ins, '-filter_complex', ';'.join(fl), '-map', '[mix]', '-t', str(T), '-c:a', 'pcm_s16le', 'mix.wav')
