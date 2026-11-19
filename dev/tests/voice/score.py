# score.py [-r ref.wav] a.wav b.wav ...   DNSMOS (no reference needed), and with a reference: PESQ, ESTOI, SDR with a short filter allowed
import sys, numpy as np, scipy.signal as sg, scipy.io.wavfile as wf, scipy.linalg as la, os, warnings
warnings.filterwarnings('ignore')
import onnxruntime as ort
HERE = os.path.dirname(os.path.abspath(__file__))
def load(p):
    sr, x = wf.read(p)
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 2147483648.0 if x.dtype == np.int32 else 1.0)
    if x.ndim > 1: x = x.mean(1)
    return sr, x
_s = None
def dnsmos(x, sr):
    global _s
    if _s is None: so = ort.SessionOptions(); so.log_severity_level = 3; _s = ort.InferenceSession(HERE + '/dnsmos/sig_bak_ovr.onnx', so, providers=['CPUExecutionProvider'])
    y = sg.resample_poly(x, 16000, sr) if sr != 16000 else x
    d = 10 * np.log10((y[:len(y) // 320 * 320].reshape(-1, 320) ** 2).mean(1) + 1e-12); act = d > d.max() - 40; y = y * 10 ** ((-26 - 10 * np.log10(np.mean(10 ** (d[act] / 10)))) / 20)   # every file at the same speaking level, so loudness is not what is scored
    L = int(9.01 * 16000); out = []
    while len(y) < L: y = np.concatenate([y, y])
    for o in range(0, len(y) - L + 1, 16000 * 3):
        seg = y[o:o + L].astype(np.float32)[None, :]; out.append(_s.run(None, {_s.get_inputs()[0].name: seg})[0][0])
    s, b, o = np.mean(out, 0)
    ps, pb, po = np.poly1d([-0.08397278, 1.22083953, 0.0052439]), np.poly1d([-0.13166888, 1.60915514, -0.39604546]), np.poly1d([-0.06766283, 1.11546468, 0.04602535])
    return ps(s), pb(b), po(o)
def sdr_f(ref, est, L=256):
    # ref projected on est with a short filter allowed (tone changes do not count; echo and noise do), at 16 kHz
    n = min(len(ref), len(est)); ref, est = ref[:n], est[:n]
    N = 1 << int(np.ceil(np.log2(2 * n))); R = np.fft.rfft(ref, N); E = np.fft.rfft(est, N)
    acf = np.fft.irfft(R * np.conj(R))[:L]; xc = np.fft.irfft(np.conj(R) * E); half = L // 2
    b = np.concatenate([xc[-half:], xc[:L - half]])   # lags -half .. L-half-1
    h = la.solve_toeplitz(acf + np.r_[acf[0] * 1e-6, np.zeros(L - 1)], b)
    proj = sg.fftconvolve(ref, h)[half:half + n]; e = est - proj
    return 10 * np.log10((proj ** 2).sum() / ((e ** 2).sum() + 1e-12))
def frames_db(x, sr, w=0.02):
    n = int(sr * w); k = len(x) // n; return 10 * np.log10((x[:k * n].reshape(k, n) ** 2).mean(1) + 1e-12)
def main():
    a = sys.argv[1:]; ref = None
    if a[0] == '-r': ref = load(a[1]); a = a[2:]
    if ref is not None:
        from pesq import pesq; from pystoi import stoi
        r16 = sg.resample_poly(ref[1], 16000, ref[0]); rd = frames_db(ref[1], ref[0]); act = rd > np.percentile(rd, 95) - 30
    print('%-26s %5s %5s %5s | %6s %6s | %6s %6s %6s' % ('file', 'SIG', 'BAK', 'OVRL', 'speech', 'floor', 'PESQ', 'ESTOI', 'SDRf'))
    for p in a:
        sr, x = load(p); s, b, o = dnsmos(x, sr); d = frames_db(x, sr)
        if ref is not None:
            k = min(len(d), len(act)); sp = 10 * np.log10(np.mean(10 ** (d[:k][act[:k]] / 10))); fl = 10 * np.log10(np.mean(10 ** (d[:k][~act[:k]] / 10)) + 1e-12)
            y16 = sg.resample_poly(x, 16000, sr); n = min(len(y16), len(r16)); T = min(n, 16000 * 30)
            pq = pesq(16000, r16[:T], y16[:T], 'wb'); es = stoi(r16[:n], y16[:n], 16000, extended=True); sd = sdr_f(r16[:n], y16[:n])
            print('%-26s %5.2f %5.2f %5.2f | %6.1f %6.1f | %6.2f %6.3f %6.1f' % (os.path.basename(p), s, b, o, sp, fl, pq, es, sd))
        else:
            print('%-26s %5.2f %5.2f %5.2f | %6.1f %6.1f |' % (os.path.basename(p), s, b, o, np.percentile(d, 95), np.percentile(d, 5)))
main()
