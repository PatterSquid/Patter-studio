# Runs AudioFX.chain from the build on 8765 (or PORT) on a WAV in this folder: run.py in.wav '{"ai":{"on":true,"atten":20}}' out.wav [keep]
import asyncio, sys, json, os, base64, time
from playwright.async_api import async_playwright
src, cfg, out = sys.argv[1], json.loads(sys.argv[2]), sys.argv[3]; port = os.environ.get('PORT', '8765')
JS = r'''async ([url, c, extra]) => {
  const ab = await (await fetch(url)).arrayBuffer(), dv = new DataView(ab); let p = 12, fmt = 1, ch = 1, sr = 48000, bits = 16, d0 = 0, dn = 0;
  while (p + 8 <= dv.byteLength) { const id = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)), n = dv.getUint32(p + 4, true);
    if (id === 'fmt ') { fmt = dv.getUint16(p + 8, true); ch = dv.getUint16(p + 10, true); sr = dv.getUint32(p + 12, true); bits = dv.getUint16(p + 22, true); } if (id === 'data') { d0 = p + 8; dn = Math.min(n, dv.byteLength - d0); } p += 8 + n + (n & 1); }
  const bs = bits / 8, n = Math.floor(dn / bs / ch), x = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < ch; k++) { const q = d0 + (i * ch + k) * bs; s += fmt === 3 ? dv.getFloat32(q, true) : bits === 16 ? dv.getInt16(q, true) / 32768 : dv.getInt32(q, true) / 2147483648; } x[i] = s / ch; }
  if (sr !== 48000) throw new Error('needs 48 kHz, got ' + sr);
  if (c.ai && c.ai.on && (await DeepFilter.check()) !== 'ready') await DeepFilter.download();
  const t0 = performance.now(); let y = extra ? await (new Function('x', 'c', 'return (' + extra + ')(x, c)'))(x, c) : await AudioFX.chain(x, 48000, c); const ms = performance.now() - t0;
  const blob = AudioFX.wav([y], 48000), b = new Uint8Array(await new Blob([blob]).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return { ms, wav: btoa(s) }; }'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-proxy-server']); pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); await pg.route('**/raw.githubusercontent.com/**', lambda r: r.abort())
        await pg.add_init_script("window.PATTER_DENOISE='http://127.0.0.1:%s/tmp_dnhome/denoise/'" % port)
        await pg.goto('http://127.0.0.1:%s/dist/test.html' % port); await pg.wait_for_timeout(1500)
        extra = open(sys.argv[4]).read() if len(sys.argv) > 4 else None
        r = await pg.evaluate(JS, ['http://127.0.0.1:%s/tmp_au/%s' % (port, src), cfg, extra]); open(out, 'wb').write(base64.b64decode(r['wav'])); print(out, 'took %.1f s' % (r['ms'] / 1000), errs[:3]); await b.close()
asyncio.run(main())
