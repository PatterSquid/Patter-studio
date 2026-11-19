# spec.py out.png start dur a.wav b.wav ...  stacked spectrograms, log frequency 60 Hz to 20 kHz, each panel levelled to its own speech level
import sys, numpy as np, scipy.signal as sg, scipy.io.wavfile as wf, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
out, ss, d = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); fs = sys.argv[4:]
fig, ax = plt.subplots(len(fs), 1, figsize=(15, 3.1 * len(fs)), squeeze=False)
for a, p in zip(ax[:, 0], fs):
    sr, x = wf.read(p); x = x.astype(float) / (32768 if x.dtype == np.int16 else 1)
    if x.ndim > 1: x = x.mean(1)
    full = 10 * np.log10(np.percentile(sg.stft(x, sr, nperseg=2048)[2].__abs__() ** 2, 99.5) + 1e-20)
    x = x[int(ss * sr):int((ss + d) * sr)]; f, t, S = sg.stft(x, sr, nperseg=2048, noverlap=2048 - 256); L = 10 * np.log10(np.abs(S) ** 2 + 1e-20) - full
    a.pcolormesh(t + ss, f[3:], L[3:], vmin=-85, vmax=0, cmap='magma', shading='auto', rasterized=True); a.set_yscale('log'); a.set_ylim(60, 20000); a.set_yticks([100, 300, 1000, 3000, 10000]); a.set_yticklabels(['100', '300', '1k', '3k', '10k']); a.set_title(p.split('/')[-1], loc='left', fontsize=10, pad=2)
plt.tight_layout(pad=0.4); plt.savefig(out, dpi=70)
