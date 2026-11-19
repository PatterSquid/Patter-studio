# Makes bad microphone versions of a clean voice, with the clean voice lined up as the reference.
import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf, pyroomacoustics as pra, sys
rng = np.random.default_rng(7)
def load(p):
    sr, x = wf.read(p); x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    return sr, (x.mean(1) if x.ndim > 1 else x)
def save(p, x, sr=48000): wf.write(p, sr, (np.clip(x, -1, 1) * 32767).astype(np.int16))
def rir(rt60, dist, dims=(3.6, 3.0, 2.4), sr=48000):
    e, mo = pra.inverse_sabine(rt60, dims); room = pra.ShoeBox(dims, fs=sr, materials=pra.Material(e), max_order=min(mo, 40), ray_tracing=False, air_absorption=True)
    src = np.array([1.5, 1.2, 1.25]); mic = src + np.array([dist, 0.15, -0.2]); room.add_source(src); room.add_microphone(mic); room.compute_rir(); h = room.rir[0][0]
    d = int(np.argmax(np.abs(h))); return h / np.abs(h[d]), d
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-20)
def act_rms(x, sr):
    n = int(sr * 0.02); k = len(x) // n; e = (x[:k * n].reshape(k, n) ** 2).mean(1); return np.sqrt(e[e > e.max() * 1e-3].mean())
def colour(x, sr, hp=150, pk=(3000, 1.5, 6), lp=8000):
    y = sg.sosfilt(sg.butter(2, hp, 'hp', fs=sr, output='sos'), x)
    if pk:
        f, q, g = pk; A = 10 ** (g / 40); w = 2 * np.pi * f / sr; al = np.sin(w) / (2 * q); b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]; y = sg.lfilter(np.array(b) / a[0], np.array(a) / a[0], y)
    if lp: y = sg.sosfilt(sg.butter(4, lp, 'lp', fs=sr, output='sos'), y)
    return y
def hum(n, sr, f0=50, lv=0.5): 
    t = np.arange(n) / sr; return sum(lv * a * np.sin(2 * np.pi * f0 * h * t + rng.uniform(0, 6.28)) for h, a in [(1, 0.5), (2, 0.3), (3, 1), (5, 0.9), (7, 0.3), (30, 0.12)])
sr, clean = load(sys.argv[1]); tag = sys.argv[2]; clean = clean / act_rms(clean, sr) * 0.05; pad = np.zeros(int(sr * 1.5)); clean = np.concatenate([pad, clean, pad]); n = len(clean)
_, nz = load('ext/noise_freesound_2530.wav'); nz = np.tile(nz, 1 + n // len(nz))[:n]
def mix(v, noise, snr): return v + noise / rms(noise) * act_rms(v, sr) * 10 ** (-snr / 20)
# D1: laptop microphone across the desk in an ordinary room, a fan and mains buzz
h, d = rir(0.5, 0.6); v = sg.fftconvolve(clean, h)[d:d + n]; y = mix(v, nz, 15); y = y + hum(n, sr) * act_rms(v, sr) * 0.06; y = colour(y, sr); save('%s_d1.wav' % tag, y / np.abs(y).max() * 0.5)
# D2: an echoey room, a metre away
h, d = rir(0.9, 1.0, (4.5, 3.8, 2.6)); v = sg.fftconvolve(clean, h)[d:d + n]; y = mix(v, nz, 25); y = colour(y, sr, 120, (2500, 1.2, 4), 10000); save('%s_d2.wav' % tag, y / np.abs(y).max() * 0.5)
# D3: a cheap headset: close, hissy, thin, the loud words clipped
y = mix(clean, rng.standard_normal(n), 20); y = colour(y, sr, 250, (3500, 2, 8), 6500); c = np.percentile(np.abs(y), 99.7); y = np.clip(y, -c, c); save('%s_d3.wav' % tag, y / c * 0.7)
# D4: a desk microphone at arm's length in an ordinary room, computer fan
h, d = rir(0.45, 0.3); v = sg.fftconvolve(clean, h)[d:d + n]; y = mix(v, nz, 22); y = y + hum(n, sr) * act_rms(v, sr) * 0.03; y = colour(y, sr, 100, (4000, 1.5, 4), 12000); save('%s_d4.wav' % tag, y / np.abs(y).max() * 0.5)
save('%s_ref.wav' % tag, clean / np.abs(clean).max() * 0.5); print('made', tag)
