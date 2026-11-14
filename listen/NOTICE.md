# Listening helper

Speech to text for the Character tab, run on the user's own computer.

* Model: Whisper base (English), by OpenAI (Radford and others 2022, "Robust Speech Recognition via Large-Scale Weak
  Supervision"). MIT licence. https://github.com/openai/whisper
* ONNX export (8 bit, encoder and decoder) and token list: the sherpa-onnx project, Apache 2.0.
  https://github.com/k2-fsa/sherpa-onnx (release asset `sherpa-onnx-whisper-base.en.tar.bz2`)
* `dec.onnx` is split into parts for GitHub's file size limit; the app joins them when it downloads.
* Runtime: ONNX Runtime Web 1.20.1 (MIT), shared with `cutout/`.
