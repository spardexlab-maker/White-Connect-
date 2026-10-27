#!/usr/bin/env python3
"""Builds one explainer film: Iraqi narration (Habibi-TTS, IRQ model), scene timing,
frame-by-frame render of film.html over the recorded app clips, then the sound mix.

  python3 docs/film-screens/build.py patient|doctor|lab|pharmacy --clips <dir> [--out file.mp4]
  options: --tts habibi|edge   --target <seconds>   --preview (first 12 s only)
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TARGET = {'patient': 60, 'doctor': 90, 'lab': 90, 'pharmacy': 90}
CHIPS = {
    'patient': ['حجز موعد', 'نتائج التحاليل', 'وصفاتك', 'تذكير الأدوية', 'المساعد الذكي', 'بطاقة QR'],
    'doctor': ['ملف المريض', 'وصفة إلكترونية', 'طلب تحاليل', 'الاستقبال', 'تواصل مع الصيدلية', 'جدول الدوام'],
    'lab': ['طلبات الأطباء', 'باركود العينة', 'نشر النتائج', 'طلب برمز QR', 'سحب منزلي', 'تقرير PDF'],
    'pharmacy': ['وصفات معتمدة', 'تنبيه الحساسية', 'صرف ودفع', 'تذكير الأدوية', 'المخزون', 'التقارير'],
}
# Habibi-TTS needs a short reference voice plus its exact text. It is generated, not a real
# person's recording, so no one's voice is cloned.
REF_TEXT = 'هلا بيكم، هذا تطبيق أبيض، يساعدكم تحجزون عند الطبيب وتتابعون صحتكم بسهولة.'
FONTS = {
    'Alexandria': [('alexandria', 'alexandria-arabic-700-normal.woff2', 700)],
    'Alexandria Latin': [('alexandria', 'alexandria-latin-700-normal.woff2', 700)],
    'IBM Plex Sans Arabic': [('ibm-plex-sans-arabic', f'ibm-plex-sans-arabic-arabic-{w}-normal.woff2', w) for w in (400, 500, 600, 700)],
    'Plex Latin': [('ibm-plex-sans-arabic', f'ibm-plex-sans-arabic-latin-{w}-normal.woff2', w) for w in (400, 500, 600, 700)],
}


def run(*a, **kw):
    return subprocess.run(a, check=True, **kw)


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())


def edge(text, out, rate='+8%'):
    ca = '/root/.ccr/ca-bundle.crt'
    code = (f"import asyncio,certifi,os\nif os.path.exists('{ca}'): certifi.where=lambda:'{ca}'\nimport edge_tts\n"
            f"asyncio.run(edge_tts.Communicate({text!r},'ar-IQ-BasselNeural',rate={rate!r}).save({str(out)!r}))")
    run(sys.executable, '-c', code)


def habibi(text, out, ref_wav, cache):
    key = hashlib.sha1(text.encode()).hexdigest()[:16]
    hit = cache / f'{key}.wav'
    if not hit.exists():
        tmp = cache / f'run-{key}'
        tmp.mkdir(parents=True, exist_ok=True)
        cli = os.environ.get('HABIBI_CLI', '/home/user/tts/venv/bin/habibi-tts_infer-cli')
        run(cli, '--model', 'Specialized', '--dialect', 'IRQ', '--ref_audio', str(ref_wav), '--ref_text', REF_TEXT,
            '--gen_text', text, '--output_dir', str(tmp), '--output_file', 'out.wav', '--remove_silence', '--device', 'cpu')
        # trim leading/trailing silence and normalise level
        run('ffmpeg', '-v', 'error', '-y', '-i', str(tmp / 'out.wav'), '-af',
            'silenceremove=start_periods=1:start_threshold=-45dB:detection=peak,areverse,silenceremove=start_periods=1:start_threshold=-45dB:detection=peak,areverse,loudnorm=I=-17:TP=-2',
            '-ar', '44100', '-ac', '1', str(hit))
    shutil.copy(hit, out)


def lines_of(text, max_words=7):
    # short subtitle lines, split at punctuation first, then by length
    parts, out = re.split(r'(?<=[،.؟!:])\s+', text), []
    for p in parts:
        w = p.split()
        while len(w) > max_words:
            cut = max_words if len(w) - max_words >= 3 else len(w) // 2
            out.append(' '.join(w[:cut])); w = w[cut:]
        if w: out.append(' '.join(w))
    total = sum(len(l.split()) for l in out)
    return [{'text': l, 'share': len(l.split()) / total} for l in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('name'); ap.add_argument('--clips', required=True); ap.add_argument('--out')
    ap.add_argument('--tts', default='habibi'); ap.add_argument('--target', type=float); ap.add_argument('--preview', action='store_true'); ap.add_argument('--tempo', type=float, default=1.0)
    ap.add_argument('--silent', action='store_true', help='no narration, no music, no subtitles (for a recorded voice-over)')
    a = ap.parse_args()
    spec = json.load(open(HERE / 'scripts' / f'{a.name}.json'))
    work = Path(os.environ.get('FILM_WORK', f'/tmp/film-{a.name}'))
    if work.exists(): shutil.rmtree(work)
    (work / 'audio').mkdir(parents=True); (work / 'fonts').mkdir(); (work / 'assets').mkdir()
    shutil.copy(HERE / 'film.html', work)
    for f in ('symbol.png', 'logo-full-light.png'):
        shutil.copy(ROOT / 'docs/film-abyad/assets' / f, work / 'assets')
    os.symlink(Path(a.clips).resolve(), work / 'clips')
    css = []
    for fam, files in FONTS.items():
        for pkg, fn, w in files:
            shutil.copy(ROOT / 'apps/web/node_modules/@fontsource' / pkg / 'files' / fn, work / 'fonts' / fn)
            css.append(f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('{fn}') format('woff2');}}")
    (work / 'fonts/fonts.css').write_text('\n'.join(css))

    # narration
    cache = Path(os.environ.get('TTS_CACHE', '/home/user/tts/cache'))
    cache.mkdir(parents=True, exist_ok=True)
    ref = cache / 'ref.wav'
    if a.tts == 'habibi' and not ref.exists():
        edge(REF_TEXT, cache / 'ref.mp3', rate='+0%')
        run('ffmpeg', '-v', 'error', '-y', '-i', str(cache / 'ref.mp3'), '-ar', '24000', '-ac', '1', str(ref))
    for s in spec['scenes']:
        out = work / 'audio' / f"{s['id']}.wav"
        if a.tts == 'habibi': habibi(s['text'], out, ref, cache)
        else:
            edge(s['text'], work / 'audio' / f"{s['id']}.mp3")
            run('ffmpeg', '-v', 'error', '-y', '-i', str(work / 'audio' / f"{s['id']}.mp3"), '-ar', '44100', '-ac', '1', str(out))
        if a.tempo != 1.0:
            run('ffmpeg', '-v', 'error', '-y', '-i', str(out), '-af', f'atempo={a.tempo}', str(out) + '.t.wav'); os.replace(str(out) + '.t.wav', out)
        s['audio'] = round(dur(out), 2)
        print(f"  voice {s['id']}: {s['audio']} s", flush=True)

    # timing: each scene holds its narration; the rest of the target length goes to the screen scenes
    target = a.target or TARGET[a.name]
    for s in spec['scenes']:
        if s['layout'] == 'title': s['dur'] = max(s['audio'] + 1.5, 4.5)
        elif s['layout'] == 'outro': s['dur'] = max(s['audio'] + 2.2, 6.0)
        else:
            meta = json.load(open(Path(a.clips) / s['clip'] / 'meta.json'))
            s['frames'] = meta['frames']; s['clipSec'] = meta['seconds']
            s['dur'] = s['audio'] + 1.1
    screens = [s for s in spec['scenes'] if 'clip' in s]
    extra = target - sum(s['dur'] for s in spec['scenes'])
    if extra > 0:
        for s in screens: s['dur'] += extra / len(screens)
    t = 0.0
    for s in spec['scenes']:
        s['dur'] = round(s['dur'], 2); s['start'] = round(t, 2); t += s['dur']
        s['audioOffset'] = 0.9 if s['layout'] == 'title' else 0.6
        s['lines'] = lines_of(s['text'].replace('بالـ كيو آر', 'بالـ QR'))
        if 'clip' in s:  # play the clip across the visible part, between 0.7× and 1.7× speed
            show = s['dur'] - 0.8
            s['rate'] = round(max(0.7, min(1.7, s['clipSec'] / show)), 3)
    total = round(t, 2)
    film = {'noSubs': a.silent, 'name': a.name, 'cta': spec['cta'], 'chips': CHIPS[a.name], 'total': total, 'scenes': spec['scenes']}
    (work / 'data.js').write_text('window.FILM=' + json.dumps(film, ensure_ascii=False) + ';')
    print(f'timeline: {total} s, {len(spec["scenes"])} scenes', flush=True)

    out = Path(a.out or ROOT / 'marketing' / f'abyad-explainer-{a.name}.mp4')
    out.parent.mkdir(parents=True, exist_ok=True)
    rng = ['0', '12'] if a.preview else []
    run('node', str(HERE / 'render.mjs'), str(work), str(work / 'silent.mp4'), *rng)
    if a.silent:
        run('ffmpeg', '-v', 'error', '-y', '-i', str(work / 'silent.mp4'), '-c:v', 'copy', '-an', '-movflags', '+faststart', str(out))
    else:
        run(sys.executable, str(HERE / 'mix.py'), str(work), str(12 if a.preview else total))
        run('ffmpeg', '-v', 'error', '-y', '-i', str(work / 'silent.mp4'), '-i', str(work / 'mix.wav'), '-c:v', 'copy',
            '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', '-movflags', '+faststart', str(out))
    print('done:', out)


if __name__ == '__main__':
    main()
