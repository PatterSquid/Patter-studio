# Rhubarb lip sync in the browser

These files are `lip-sync-engine` 1.0.3 (npm, MIT licence, see LICENSE): a WebAssembly build of
[Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) by Daniel S. Wolf (MIT licence), which uses
[PocketSphinx](https://github.com/cmusphinx/pocketsphinx) and its US English models and dictionary from Carnegie Mellon
University (BSD style licence). Unchanged copies of `dist/wasm/lip-sync-engine.js`, `.wasm` and `.data`.

Patter Studio downloads them once, the first time Rhubarb is chosen for lip sync in the Character tab, keeps them in the
browser (IndexedDB `patter-lipsync`) and runs them in a worker. See `dev/src/rhubarb.js`.
