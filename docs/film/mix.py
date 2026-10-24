# Narration on the timeline, a soft music bed ducked under the voice, a chime on each notification.
import json, subprocess
m = json.load(open('timeline.json')); T = m['total']
A = [130.81, 164.81, 196.0, 246.94]; B = [110.0, 130.81, 164.81, 196.0]
tone = lambda fs: '+'.join(f'sin(2*PI*{f}*t)+0.35*sin(2*PI*{f*2}*t)' for f in fs)
expr = f"0.06*((0.5+0.5*cos(2*PI*t/16))*({tone(A)})+(0.5-0.5*cos(2*PI*t/16))*({tone(B)}))*(0.8+0.2*sin(2*PI*t/4))"
run = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
run('-f', 'lavfi', '-i', f"aevalsrc='{expr}':s=44100:d={T+1}", '-af', f"lowpass=f=1400,aecho=0.8:0.7:120|260:0.3|0.2,afade=t=in:d=2.5,afade=t=out:st={T-3}:d=3,volume=0.55", '-ac', '2', 'music.wav')
run('-f', 'lavfi', '-i', "aevalsrc='0.45*(sin(2*PI*880*t)+0.6*sin(2*PI*1318.5*t)+0.3*sin(2*PI*1760*t))*exp(-7*t)':s=44100:d=0.9", '-ac', '2', 'ding.wav')
ins, fl = [], []
for i, a in enumerate(m['audio']):
    ins += ['-i', f"audio/{a['id']}.mp3"]; d = int(a['at'] * 1000)
    fl.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={d}|{d}[v{i}]")
nv = len(m['audio'])
for j, t in enumerate(m['dings']):
    ins += ['-i', 'ding.wav']; d = int(t * 1000); fl.append(f"[{nv+j}:a]adelay={d}|{d},volume=0.5[d{j}]")
ins += ['-i', 'music.wav']; mi = nv + len(m['dings'])
fl.append(''.join(f'[v{i}]' for i in range(nv)) + f"amix=inputs={nv}:normalize=0,volume=1.6,asplit=2[voice][key]")
fl.append(f"[{mi}:a][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[bed]")
fl.append('[voice][bed]' + ''.join(f'[d{j}]' for j in range(len(m['dings']))) + f"amix=inputs={2+len(m['dings'])}:normalize=0,alimiter=limit=0.95,apad[mix]")
run(*ins, '-filter_complex', ';'.join(fl), '-map', '[mix]', '-t', str(T), '-c:a', 'pcm_s16le', 'mix.wav')
