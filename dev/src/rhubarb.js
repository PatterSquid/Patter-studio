/* Rhubarb: the Rhubarb Lip Sync engine (lip-sync-engine, MIT; PocketSphinx inside) run in a worker, as a second choice of
   lip sync for the Character tab. Its files (about 40 MB, in lipsync/rhubarb/ of the update repo) are downloaded once when
   he first picks it and kept in IndexedDB 'patter-lipsync', so it then works offline. Rhubarb's nine mouth shapes are
   mapped onto Character Animator's twelve. Word timings, tags and the level still come from LipSync. */
const Rhubarb = (() => {
  const VER = 'lse-1.0.3', FILES = ['lip-sync-engine.js', 'lip-sync-engine.wasm', 'lip-sync-engine.data'];
  const base = () => (typeof window !== 'undefined' && window.PATTER_LIPSYNC) || ((typeof window !== 'undefined' && window.PATTER_HOME) || 'https://raw.githubusercontent.com/PatterSquid/patter-studio/main/') + 'lipsync/rhubarb/';
  // Rhubarb's shapes: A closed (M B P), B teeth (K S T EE), C open (EH AE), D wide (AA), E rounded (AO ER), F puckered (UW OW W), G F V, H L, X rest
  const MAP = { A: 'M', B: 'D', C: 'Ee', D: 'Aa', E: 'Oh', F: 'W-Oo', G: 'F', H: 'L', X: 'Neutral' };
  let dbp = null; const db = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('patter-lipsync', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const get = async k => { const d = await db(); return new Promise((res, rej) => { const q = d.transaction('f').objectStore('f').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); };
  const put = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  let state = 'unknown', have = null;
  async function ready() { if (have != null) return have; try { const r = await Promise.all(FILES.map(f => get(VER + '/' + f))); have = r.every(Boolean); } catch (e) { have = false; } state = have ? 'ready' : 'missing'; return have; }
  // Download the engine (once), with progress
  let fetching = null;
  function download(onProgress) {
    if (fetching) return fetching;
    return (fetching = (async () => {
      state = 'downloading'; let done = 0; const sizes = { 'lip-sync-engine.js': 8e4, 'lip-sync-engine.wasm': 1.9e6, 'lip-sync-engine.data': 3.79e7 }, total = Object.values(sizes).reduce((a, b) => a + b, 0);
      for (const f of FILES) {
        if (await get(VER + '/' + f).catch(() => null)) { done += sizes[f]; continue; }
        const r = await fetch(base() + f, { cache: 'no-store' }); if (!r.ok) throw new Error('Could not download Rhubarb (' + r.status + '). Check the internet connection and try again.');
        const rd = r.body.getReader(), parts = []; let got = 0;
        for (;;) { const { done: end, value } = await rd.read(); if (end) break; parts.push(value); got += value.length; onProgress && onProgress(Math.min(0.99, (done + got) / total)); }
        done += sizes[f]; await put(VER + '/' + f, new Blob(parts));
      }
      have = true; state = 'ready'; onProgress && onProgress(1); return true;
    })().catch(e => { state = 'missing'; throw e; }).finally(() => { fetching = null; }));
  }
  // The worker: loads the engine from the stored files and answers analyse requests
  let wk = null, wkReady = null, seq = 0; const jobs = new Map();
  async function worker() {
    if (wkReady) return wkReady;
    return (wkReady = (async () => {
      const [js, wasm, data] = await Promise.all(FILES.map(f => get(VER + '/' + f))); if (!js || !wasm || !data) throw new Error('Rhubarb is not downloaded yet.');
      const u = [js, wasm, data].map(b => URL.createObjectURL(b));
      const code = `let M=null;self.onmessage=async e=>{const m=e.data;try{if(m.type==='init'){importScripts(m.js);M=await self.createLipSyncEngineModule({locateFile:f=>f.endsWith('.wasm')?m.wasm:f.endsWith('.data')?m.data:f});const p='/models',n=M.lengthBytesUTF8(p)+1,pp=M._malloc(n);M.stringToUTF8(p,pp,n);const ok=M._lipsyncengine_init(pp);M._free(pp);if(ok!==0)throw new Error(M.UTF8ToString(M._lipsyncengine_get_last_error()));postMessage({type:'ready'});return;}
        if(m.type==='analyse'){const pcm=m.pcm,a=M._malloc(pcm.length*2);M.HEAP16.set(pcm,a/2);let tp=0;if(m.text){const k=M.lengthBytesUTF8(m.text)+1;tp=M._malloc(k);M.stringToUTF8(m.text,tp,k);}const out=M._lipsyncengine_analyze_pcm16(a,pcm.length,16000,tp);M._free(a);if(tp)M._free(tp);if(!out)throw new Error(M.UTF8ToString(M._lipsyncengine_get_last_error())||'Rhubarb could not read the recording');const j=JSON.parse(M.UTF8ToString(out));M._lipsyncengine_free(out);postMessage({type:'result',id:m.id,cues:j.mouthCues});}}catch(err){postMessage({type:'error',id:m.id,error:String(err&&err.message||err)});}};`;
      wk = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      await new Promise((res, rej) => { wk.onmessage = e => { const m = e.data; if (m.type === 'ready') { wk.onmessage = onMsg; res(); } else if (m.type === 'error') rej(new Error(m.error)); }; wk.onerror = e => rej(new Error(e.message || 'Rhubarb failed to start')); wk.postMessage({ type: 'init', js: u[0], wasm: u[1], data: u[2] }); });
      return wk;
    })().catch(e => { wkReady = null; if (wk) { wk.terminate(); wk = null; } throw e; }));
  }
  function onMsg(e) { const m = e.data, j = jobs.get(m.id); if (!j) return; jobs.delete(m.id); if (m.type === 'result') j.res(m.cues || []); else j.rej(new Error(m.error || 'Rhubarb failed')); }
  // Mouth cues for 16 kHz samples and the words said (tags and the like taken out), as [[t, viseme]]
  async function visemes(x16, words) {
    await worker(); const pcm = new Int16Array(x16.length); for (let i = 0; i < x16.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(x16[i] * 32767)));
    const id = ++seq, cues = await new Promise((res, rej) => { jobs.set(id, { res, rej }); wk.postMessage({ type: 'analyse', id, pcm, text: words || '' }, [pcm.buffer]); });
    const out = []; cues.forEach(c => { const v = MAP[c.value] || 'Neutral'; if (!out.length || out[out.length - 1][1] !== v) out.push([+c.start, v]); });
    return out;
  }
  return { ready, download, visemes, MAP, get state() { return state; }, VER };
})();
