# Background remover files

Used by the Thumbnail tab's "Remove background". Downloaded once by the app and kept in the browser (IndexedDB
`patter-cutout`).

* `birefnet-lite-1024-fp16.onnx.part0/1`: BiRefNet lite (Peng Zheng et al., "Bilateral Reference for High-Resolution
  Dichotomous Image Segmentation", CAAI AIR 2024), weights under the MIT licence. ONNX export with standard operators,
  float16, 1024 by 1024, from github.com/emoro24/birefnet-lite-onnx release v2 (MIT), SHA-256
  945ef7bcca23823f823ca00a22c1c08fedd9391bff8620658dfe292dfcea0a22, split in two for GitHub's file size limit.
* `ort.webgpu.min.js`, `ort-wasm-simd-threaded.jsep.mjs`, `ort-wasm-simd-threaded.jsep.wasm`: ONNX Runtime Web 1.20.1,
  Copyright (c) Microsoft Corporation, MIT licence.

MIT licence text: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
