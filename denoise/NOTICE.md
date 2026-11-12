# AI voice cleaner (Audio tab)

DeepFilterNet 3 by Hendrik Schröter and others, github.com/Rikorose/DeepFilterNet, dual licensed MIT or Apache 2.0
(the MIT licence is in LICENSE-MIT-DeepFilterNet). These are the official ONNX exports from models/DeepFilterNet3_onnx.tar.gz
(enc.onnx, erb_dec.onnx, df_dec.onnx; dfn3-config.ini is their config). Run with ONNX Runtime Web 1.20.1 (MIT), shared with
the background remover in ../cutout/. The signal processing around the models is our own port, in dev/src/deepfilter.js.

Paper: Schröter, Escalante, Rosenkranz, Maier: DeepFilterNet: Perceptually Motivated Real-Time Speech Enhancement, Interspeech 2023.
