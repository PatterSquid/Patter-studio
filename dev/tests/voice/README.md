# Measuring the voice chain

Work in a scratch folder linked into `dev/` as `dev/tmp_au` (the test server on 8765 serves it), with the WAVs in it
(48 kHz). `dev/tmp_dnhome/` must link to `denoise/` and `cutout/` (the AI cleaner).

* `run.py in.wav '{"room":0.8,"ai":{"on":true,"atten":40}}' out.wav`: `AudioFX.chain` in the test page (the real thing,
  cleaner included). `PORT=8766` runs the same on another build.
* `node aud.js in.wav out.wav '{...}' [cleaned.wav]`: the chain in Node, quick for trying a stage; the AI step hands
  back `cleaned.wav` (made once with run.py).
* `degrade.py clean.wav tag`: bad microphone versions of a clean voice (`tag_d1.wav` laptop across a desk, `d2` an
  echoey room, `d3` a hissy clipped headset, `d4` a desk microphone at arm's length) and `tag_ref.wav` lined up with
  them. Needs pyroomacoustics and a noise recording at `ext/noise_freesound_2530.wav` (from the DeepFilterNet repo's
  assets).
* `score.py [-r ref.wav] a.wav b.wav`: DNSMOS (signal, background, overall; every file first set to the same speaking
  level), and with a reference PESQ, ESTOI and an SDR that allows a short filter. Needs pesq, pystoi, onnxruntime and
  `dnsmos/sig_bak_ovr.onnx` beside it (raw.githubusercontent.com/microsoft/DNS-Challenge/master/DNSMOS/DNSMOS/).
* `spec.py out.png start seconds a.wav b.wav`: spectrograms one over the other. The scale is 85 dB deep: a gap that
  looks hazy can be 60 dB under the voice. Trust the level figures, not the colour.
* `ab.py out.mp4` with `PARTS='[[heading, [[label, file, start], ...]], ...]'`: the before and after clip (fonts as TTF
  through `FONT_A`, `FONT_B`: fontTools turns the woff2 copies in `dev/tmp_fonts` into TTF once brotli is installed).

His own recording (`dev/tmp_me.wav`) and anything made from it stay out of the repo.
