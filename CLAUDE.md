# Patter Studio

Patter Studio is a single file HTML app (opened in Microsoft Edge) that makes animated clips for a Glaswegian adult
comedy and news YouTube channel: charts, timelines, world maps, flights, flyovers, pictograms, newspapers, a chalkboard
Story animator and a B roll tab (chalk drawn over or around real video). Clips are exported as MP4 or PNG sequences and
finished in After Effects.

This repo is both the source and the live update channel. **Anything pushed to `main` reaches the user's computer the
next time he opens the app**, so test before pushing.

## How updates reach him

* The installed file is a launcher (`dev/src/launcher.html`, built into `dev/dist/Patter-Studio-Launcher.html`). On
  opening it reads `version.json` from this repo; if the version is newer than what it has, it downloads `app/patter-studio.html`,
  keeps it in IndexedDB and opens it. A version that throws before it finishes starting is marked bad and it falls back
  to the previous one. Offline it opens the saved copy.
* Packs: the app reads `packs/index.json` on opening and downloads any pack whose `version` is higher than the one it has.
* Projects: the app reads `projects/index.json` and downloads any project whose `rev` (a fingerprint publish.py makes)
  has changed. They wait under From Claude in the Project window (a dot shows on the Project button) until he opens them.
  To send him a finished video, put its `.patter.json` (the same format as Save file, with `name` and an optional `note`)
  in `projects/`, publish and push.
* So: **new feature or fix** = bump `dev/VERSION`, build, test, publish, push. **New animation content** = add or update a
  pack JSON in `packs/` (bump its version), publish, push. A reinstall is never needed.

## Working on it

```
cd dev
python3 build.py                 # joins story/ chunks into src/story.js, builds dist/
python3 -m http.server 8765      # in dev/, then open http://127.0.0.1:8765/dist/test.html (local d3 and a small test map)
python3 publish.py "notes"       # copies the build to app/, writes version.json and packs/index.json, makes the installer zip
git add -A && git commit && git push origin main
```

* `dev/VERSION` is `YYYY.MM.DD.N`. Bump it for every app change you publish, or the launcher will not pick it up.
* Story (the chalk animator, also used by B roll) lives in `dev/story/*.js` chunks, joined in the order in `story/ORDER`.
  Edit the chunks, never `src/story.js` (it is generated).
* Tests use Playwright with the preinstalled Chromium. `dev/tests/` has the main ones (random clicking on every tab,
  render sweeps, undo round trips, launcher update and rollback, packs UI). They were written with absolute paths from
  the original session; adjust paths before running.
* Headless Chromium cannot encode H.264, so check exports with PNG sequences or by drawing frames directly.
* Smooth motion matters to him. Story eases every change of pose (actions starting and ending, turning round) in
  `poseOf` (`dev/story/d.js`). `dev/tests/joints.js` tracks every joint of every action frame by frame and lists jumps; run it
  after touching poses (it uses the `Story._pose`, `_figure` and `_plan` test hooks).

## The Video tab (dev/src/video.js)

The Video tab strings clips from the other tabs into one running order with avatar gaps (where the video cuts to the
user's avatar talking to camera; he uses full cuts). `cfg.items` is a list of `{ kind: 'clip', mod, cfg, name, inPt, hold }`
and `{ kind: 'avatar', text, dur }`. Each clip keeps a full config for its tab. Pressing Edit opens the clip in its own tab
(the tab's own clip is put aside in `state.stash`) and Back to the video writes it back (`state.edit`). Gaps export black,
green or see through, and show a labelled card only in the preview.

When he sends a script, build it as a Video tab project: one clip per beat (Story scenes for sketches, charts, maps,
newspapers where they fit), an avatar gap for every line marked [ME], new drawings as a pack. Hand it over as a
.patter.json project file plus an MP4 preview.

## Packs (data only, no code)

A pack is a JSON file in `packs/`: `{ format: 1, id, name, version, description, places, props, hats, actions, setpieces }`.
The engine (`dev/story/p.js`) validates every field; a pack can only add drawings and moves, never replace built-ins.

* `places`: chalk scenery. `back`/`front` lists of `{ p: [[x,y],...], col, w, fill }` in a 1920x1080 world, floor at y 905;
  `texts`, `marks` (named standing spots, `behind: true` to stand behind a counter), `blink` lights that can switch on
  when an action with a matching `trigger` happens.
* `props`: drawings around the holding hand, plus `grip`. `flip: false` stops writing being mirrored.
* `hats`: drawings in head sizes around the middle of the head; `slit: true` for a balaclava eye slit.
* `actions`: pose keyframes `{ p, hf, hb, hop, lean, tilt, lower, kneel, kick, mood, eyes, emote }` (hand positions in
  body sizes, `hf` the front hand), `fx` words or shouts, `hold`, `takes`, `gives`, `target: 'person'`, `react` (one of the
  built-in reactions: punched, slapped, butted, decked, lifted, baws, smashed, chucked, spat, shot, winged, missed,
  slashed, cut, dodged), `trigger`.
* `setpieces`: ready-made scenes with a `cast` (roles), `scenes` and `layers` (`scene` index, times from that scene's start).

Pack sources are kept as small Python generators in `dev/packsrc/`. Draw new content the same way: generate the
JSON, install it in the test page with `Story.packs.install(json)`, drop the set piece in with
`Story.packs.addSetPiece(cfg, id)`, and look at rendered frames before publishing.

## Working with the user

* Never use hyphens or dashes (em or en dash) in written prose for him; rephrase with commas or colons.
* Wait for his go ahead before building big features; suggest first.
* Always send him a preview (MP4 or image) of new visual work so he can look before using it.
* He is in Glasgow; the humour is Glaswegian and adult. Keep real broadcaster or brand look alikes out of drawings.
