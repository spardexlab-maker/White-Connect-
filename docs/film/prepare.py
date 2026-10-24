# Fonts to local files, Iraqi narration per scene (edge-tts), data.js with timings and the brand name.
import asyncio, json, os, re, subprocess, sys
brand = sys.argv[1]
css = open('fonts/g.css').read(); out = []
for sub, body in re.findall(r'/\* ([^*]+) \*/\s*@font-face\s*{([^}]*)}', css):
    if sub.strip() not in ('arabic', 'latin'): continue
    fam = re.search(r"font-family: '([^']+)'", body).group(1); w = re.search(r'font-weight: (\d+)', body).group(1)
    url = re.search(r'url\((https[^)]+)\)', body).group(1); fn = f"{fam.replace(' ', '')}-{w}-{sub.strip()}.woff2"
    subprocess.run(['curl', '-s', url, '-o', f'fonts/{fn}'], check=True)
    out.append(f"@font-face{{font-family:'{fam}';font-weight:{w};src:url('{fn}') format('woff2');unicode-range:{re.search(r'unicode-range: ([^;]+);', body).group(1)};}}")
open('fonts/fonts.css', 'w').write('\n'.join(out))
ca = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
if ca:
    import certifi; certifi.where = lambda: ca
import edge_tts
s = json.load(open('script.json'))
async def go():
    for x in s: await edge_tts.Communicate(x['text'], 'ar-IQ-BasselNeural', rate='+4%').save(f"audio/{x['id']}.mp3")
asyncio.run(go())
for x in s:
    x['dur'] = round(float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"audio/{x['id']}.mp3"]).decode()), 2)
open('data.js', 'w').write('window.SCRIPT=' + json.dumps(s, ensure_ascii=False) + ';window.BRAND=' + json.dumps(brand, ensure_ascii=False) + ';')
