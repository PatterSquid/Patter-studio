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

* `dev/VERSION` is `YYYY.MM.DD.N`: **the date it is published (his date, UK time) and the revision that day, starting at 1**.
  So the first publish on 30 October 2026 is `2026.10.30.1`, then `.2`, `.3`; the first on the next day is `2026.10.31.1`.
  Check today's date before bumping (do not carry on an earlier day's date). Bump it for every app change you publish, or
  the launcher will not pick it up.
* Story (the chalk animator, also used by B roll) lives in `dev/story/*.js` chunks, joined in the order in `story/ORDER`.
  Edit the chunks, never `src/story.js` (it is generated).
* Tests use Playwright with the preinstalled Chromium. `dev/tests/` has the main ones (random clicking on every tab,
  render sweeps, undo round trips, launcher update and rollback, packs UI). They were written with absolute paths from
  the original session; adjust paths before running.
* Headless Chromium cannot encode H.264, so check exports with PNG sequences or by drawing frames directly.
* `dev/src/repair.js` (`Repair.clip`) mends every clip as it loads (saved state, opened files, templates, From Claude
  projects, the clips inside a Video and the tab clips in Studio frames) against its tab's `defaults()`. It only mends
  structure (a list where a value belongs, a value where a list belongs, numbers that are not numbers, empty top level
  values, broken corners, Story actions without a start or length); plain values may legitimately swap type (a Story spot
  is "left" or 660, a beard is true or "stubble"), so it leaves those alone. `tests/repair_check.py` proves it changes
  nothing in good settings (examples, his projects, pack set pieces, random clicking); `tests/damaged.js` (run with
  `tests/runjs.py tests/damaged.js '{"n":40,"repair":true,"mods":["story"]}'`) feeds every tab damaged settings.
* `defaults()` must hand out fresh objects (`tests/shared_defaults.js`), and opening a tab's panel must not change its
  clip (`tests/panel_tidy.js`); either breaks redo. Undo also ignores changes nobody made (between an undo or redo and his
  next click, key or typing), so a panel tidying up or a picture finishing loading never wipes the redo list.
* Other checks: `tests/leak.py` (memory over a long session), `tests/prof.py <tab>` (frame times and hot spots at
  1080p). The map tabs draw the globe with WebGL, which headless Chromium emulates in software (about 250 ms a frame
  here, a few ms on his PC), so do not chase map frame times in tests. Run browsers one or two at a time: there are two
  cores and five browsers at once get killed for memory. Never `pkill -f` a pattern that also appears in your own
  command line (it kills your shell).
* `tests/launch.py` makes its pretend releases from the current build, dated 2099, in `dev/fakehome/` (served by the
  test server, gitignored). `tests/video2.py` needs `dev/tmp_dogclip.webm` (any short WebM: `ffmpeg -f lavfi -i
  testsrc=size=640x360:rate=30 -t 4 -c:v libvpx dev/tmp_dogclip.webm`).
* Smooth motion matters to him. Story eases every change of pose (actions starting and ending, turning round) in
  `poseOf` (`dev/story/d.js`). `dev/tests/joints.js` tracks every joint of every action frame by frame and lists jumps; run it
  after touching poses (it uses the `Story._pose`, `_figure` and `_plan` test hooks).

## Layout: one frame for every tab

He asked for fewer, bigger tabs and then for the whole app to be tidy, professional and easy (November 2026). Every tab uses
the same frame; keep it that way:
* **Header** (54 px, never wraps): logo, the four tabs (`#tabs`: **Video** `data-mod=video`, **Graphics** `data-group=gfx`,
  **Audio** `data-mod=audio`, **Animator** `data-group=anim`), then on the right Saved, Undo and Redo (`#hdrUndo`,
  `#hdrRedo`), the project button (`#libBtn`, the project's name; it opens the Projects window, which also has New,
  Version history, Open a project file, Save to a file, Packs; `#histBtn`, `#openProj`, `#saveProj` stay in the DOM
  hidden), shortcuts, and the one **Export** (`#hdrExport`, class `cut-x`): `exportNow` in app.js (Video and the intro
  open the export window, a talking character too, Audio saves a WAV, Graphics and Animator open their export panel,
  `body.exp-open` showing `.card.export` as a floating panel; Ctrl+E exports straight away).
* **Red is only for Export and recording.** `button.primary` is solid cream; red stays on export buttons in dialogs.
* **Graphics and Animator** (`body.gfx`, `body.anim`): grid areas "rail prev insp / rail trans insp / rail tl tl". The
  tool strip (`#gfxRail` with the nine makers, `#animRail` with Studio and Character; buttons keep their `data-mod`) on
  the left; the preview in `.pvbox` (a size container: `#prevWrap` fits with `cq` units); the play bar (`.transport`:
  Play, scrubber, time, and the gear `.pvset` holding Preview quality, Autoplay, Smooth); the settings (`aside`) on the
  right with **Settings** and **Look** tabs (`.aside-tabs`, `aside[data-at]`), cards drawn as flat sections, help text
  clamped to two lines (all of it on hover); the timeline (`#timeline`) docked along the bottom. The timeline toolbar has
  one **+ Add** menu (`.tl-add`, `.tl-addmenu`: this tab's own things, then the layers; one with options opens its grid
  `.tl-pop`), Duplicate and Delete only while something is selected, zoom and Snap on the right. Menus open upwards.
* **Video** keeps its CapCut frame (library left, inspector right, timeline below); undo is in the header now.
* Nothing scrolls the page at 1366 by 768; only the panels scroll. Tests click tabs and rail buttons with JS
  (`button[data-mod=...]`) and add things through `.tl-add` then `.tl-addmenu button`.

## The Audio tab (dev/src/audio_fx.js `AudioFX`, dev/src/audio_ui.js `AudioTab`, module `audio`)

Voice clean up and editing, its own top tab. `body.aud` gives `#audioWs` the whole of main; the module's `form()` draws the
workspace (so the app's undo redraws it); keys go to `AudioTab.key` first (Space, Delete, arrows). The recording is never
changed: `cfg.src` (a CutMedia file), `cfg.clean` (settings) and `cfg.edits` (`del`, `sil`, `fin`, `fout`, `gain`, in the
recording's own seconds) are applied on top; the cleaned sound is cached by settings.
* `AudioFX`: our own Audacity style noise reduction (profile learned from a quiet selection, STFT 2048/512 root Hann,
  per bin gate with time and frequency smoothing), RNNoise (built in: `assets/rnnoise`, @jitsi/rnnoise-wasm, embedded by
  build.py as `src/rnnoise_lib.js`; warmed on the first two seconds), rumble high pass, 50 Hz hum notches, de-esser,
  click repair, leveller, LUFS loudness and a peak limiter, spectrogram and peaks. 48 kHz mono throughout.
* "Clean my voice" learns the noise from the quietest half second and turns on the lot. "Send it on" renders a WAV into
  CutMedia and `AudioTab.hooks.send` (app.js) sets the Character's voice or adds it to a Video audio track.
* Tests: `tests/audio_ui.py` (needs `dev/tmp_noisy.wav`: flite speech plus hiss, hum and rumble).

## The Video tab: the editor (dev/src/video.js and dev/src/cut_*.js)

The Video tab is a full video editor laid out like CapCut: library on the left (`.cut-lib`: Media, Audio with made-on-the-spot
sound effects, Text, Stickers, Effects, Transitions, Filters, Patter clips), the player in the middle with Export, the
selected clip's settings on the right in tabs, and a multi-track timeline below (`.cut-tl`). `body.cut` switches the
layout; the other tabs are untouched. He asked for it to give him everything CapCut does for editing, at a professional
standard and as easy to use.

* **Model** (`cfg.video`, version `v: 2`, backward compatible). `items` is the magnetic **main track**: clips butt up in
  order, and a transition on a clip (`tr: { k, d }`) overlaps it with the next. Kinds: `clip` (a tab clip: `mod`, `cfg`,
  `inPt`, `outPt`, `hold`), `media` (his footage or a picture: `asset`, `src0`, `src1` seconds in the file, or `dur` for
  pictures, `file` its name for relinking), `avatar` (gap), `colour` (card: `fill`). `tracks` holds overlay video tracks
  (`kind: 'video'`, items with `start`; also `adjust` clips that grade everything under them) and audio tracks
  (`kind: 'audio'`, `audio` clips; `duck` lowers the track under talking, `talk` marks voiceover). Every visual clip can have
  `x y s rot op flipH flipV fit crop blend bg`, `col` (grade: CutGL.ADJUST plus `look`, `lookAmt`), `fx` (effects), `key`
  (chroma key), `mask`, `anIn anOut anLoop`, `kf` (keyframes `{ prop: [[t, v, ease]] }` for x y s rot op vol), `speed`,
  `pitch`, `rev`, `still` (freeze frame). Sound: `vol` (dB), `mute`, `fadeIn`, `fadeOut`, `enhance`, `denoise`. Also
  `markers`, `bin` (assets in this project), `bg` (black, blur, white), `gap`, `studio`, `duckDb`, `main*` track flags.
* `cut_mp4.js`: our own MP4/MOV/M4A reader (`MP4In`: sample tables, edit lists, rotation, H.264, HEVC, VP9, AV1, AAC, Opus,
  PCM) and streaming writer (`MP4Out`: video plus sound, 64 bit, writes to a file sink or Blob pieces). No outside
  libraries (npm and GitHub downloads are blocked in this environment).
* `cut_media.js` (`CutMedia`): his files kept whole in IndexedDB `patter-cut`; import makes thumbnails and a waveform in the
  background; the preview plays through hidden video elements kept locked to the playhead (`live`); exports read exact
  frames with WebCodecs (`videoReader`, element seeking for non-MP4) and samples with `audioReader`.
* `cut_gl.js` (`CutGL`): one WebGL2 shader pass for colour, looks, effects and chroma key, at the size shown.
* Sound files: MP4/MOV/M4A through `MP4In`, WAV read straight from the file in pieces (`wavReader`), anything else
  (MP3, OGG, FLAC) decoded whole, refused past about 1.6 GB decoded.
* `cut_audio.js` (`CutAudio`): one set of gain rules for the live preview (audio elements through Web Audio) and the
  export mix (OfflineAudioContext in blocks, crossfaded joins), voice enhance, noise reduction, ducking, WSOLA time stretch
  for speed with the pitch kept, AAC (else Opus) encoding, WAV.
* `cut_export.js` (`CutExport.run`): renders with exact frames, mixes sound alongside, streams to disk. Helpers on the other
  cores (`Render.cutPool`, worker messages `cutinit`/`cutframe`) draw every moment without his footage or the intro ahead of
  time and hand back ImageBitmaps; the page draws the footage and intro moments (`Video.pageOnlyAt`) and keeps the order.
  The helpers get the video, the studio, his puppet (`Character.workerData`, `Studio.workerData`), pictures, the file list
  (`CutMedia.forWorkers`/`seed`), packs and B roll. `workers: false` turns them off; `tests/cut_workers.js` (runjs) checks
  the frames match and times both.
  MP4 (H.264 plus AAC on his PC; VP9 and Opus here in headless), PNG sequence, WAV. The Video tab always exports through it.
* **Snap** (switch in the timeline toolbar): on, the main track is magnetic and drags snap to edges, markers and the
  playhead (Alt while dragging skips the edge snap); off (`cfg.free`), main track clips go where they are dropped and the
  blank between them plays as black. Each main clip may carry `gap` (blank seconds before it), honoured only when
  `cfg.free`; `Video.setMainStarts` puts clips at wanted times (sorted, gaps worked out, overlaps pushed along),
  `mainStarts` reads them, turning Snap on calls `closeGaps`. No transition across a gap. Delete leaves the gap with Snap
  off; Shift+Delete still closes it.
* Patter clips in a video are copies of their tab from when they were added; the Clip panel has "Use what's in the ...
  tab now" (keeps place, trims and effects) besides Edit. Studio clips (`runsOn`) stretch instead of holding the last frame.
* **Speed** works on every clip (Patter clips too: the animation itself plays faster or slower). **Speed curves**
  (`it.curve = { k, pts: [[u, m]], a, b }`, presets in `Video.CURVES`: montage, hero, bullet, jump, flashIn, flashOut,
  slowmo; m is a 0.1 to 10 multiplier along the source from a to b, pinned when set so trims and splits keep the shape)
  map timeline time to source time through `curveMap` (adds up the time each bit of source takes). The Speed panel has
  Normal and Curve, with presets and a graph to drag. Footage with a curve plays its picture only (no sound).
* The old cone and seagull intro (`dev/src/cut_intro.js`, main track kind `intro`) is kept only so videos that used it
  still play. He found it too basic and cheesy; the Intro tab replaced it.
* Transitions on the timeline: drag the diamond to another cut to move it (Ctrl or Alt copies), drag the ends of its
  striped bar along the top of the overlap to change its length, click an empty diamond to add a fade.
* Timeline drawing: one canvas per track (`.ct-strips`, first in each lane) paints every clip's body, filmstrip and
  waveform for the part near the screen; the clip boxes are see-through (`.st`) on top. Do not go back to a canvas per clip:
  hundreds of canvases made the browser composite every frame (110 ms a frame with 500 clips, 17 ms now).
* `cut_ui.js` (`CutUI`) is the workspace and timeline; `cut_insp.js` (`CutInspect`) the clip, transition, track and project
  panels and the export window. Selections: `C:id` clip, `T:id` transition after a main clip, `K:id` track, `L:id` layer.
  `window.PatterCut` is the hook the tests use.
* Tests: `tests/cut_ui.py` (22 real mouse and keyboard steps through import, drag, split, trim, move between tracks,
  transitions, grading, keyframes, undo, sound effects, export), `tests/cut_monkey.py` (random clicking, dragging and keys
  with footage loaded; checks the timeline stays sane), `tests/cut_damaged.js` (damaged editor videos), plus `video1.py`
  and `video2.py`. They read fixtures from `dev/tmp_cut/` (gitignored): make them with ffmpeg as VP9 plus Opus MP4 (headless
  Chromium has no H.264 or AAC), e.g. `long.mp4` 6 s 640x360 30 fps with a 500 Hz tone, `vp9opus.mp4`, `red.png`,
  `tone.mp3`. Software WebGL makes grading look slow in headless timings; on his PC it is a millisecond or two.
* When he sends a script, build it as a Video tab project: one clip per beat (Story scenes for sketches, charts, maps,
  newspapers where they fit), a "You in the studio" part (kind `avatar`) for every line marked [ME], new drawings as a pack. Hand it over as a
  .patter.json project file plus an MP4 preview. His own footage isn't in project files: clips keep `file` so he can relink.

## The Studio (the Animator tab, dev/src/studio.js)

His room picture brought to life for the bits where he talks to camera: rain on the window (beads that bend the view,
runners with wet trails, rain beyond the glass), lamps that glow and flicker, lights going on and off in the flats outside,
street lamps, cars on the road, swaying plants, lightning that lights the room, weather presets, and a gentle camera drift.
Everything is a pure function of time and repeats exactly every `loop` seconds, so it loops seamlessly.

* **His studio is built in and is the default.** `dev/assets/studio-room.jpg` and `dev/assets/studio-marks.json` are
  embedded at build time (`src/studio_room.js`, generated) as the asset `studio-builtin`, so the tab opens already
  animated with nothing to set up. Clouds drift across the sky above the skyline (found per column, below the blind). In snow, snow lies on the rooftops (skyline caps), ledges and the marked `ground` polygons, and piles on the ledge along the bottom of the glass. His PatterSquid logo (`dev/assets/pattersquid.jpg`, the white squid on a saltire disc, cut from his channel picture) is a round lit sign set into the top picture frame at the wall's angle (`cfg.neon`, style 'logo', `q` = its four corners as picture fractions, default `STUDIO_MARKS.sign`; he drags the body to move it and the corner dots to tilt it; drawn flat then laid on with one affine slant, no triangle seams; the frame it hangs in is lit evenly by it); very subtle life: the squid blinks every 10 to 15 seconds. He did not like a traced neon outline: use his real logo. He
  can still swap in another room picture, and "Back to my studio" returns to his. His studio always draws with the marks
  in `dev/assets/studio-marks.json` (so fixes reach him) unless he has marked it himself (`cfg.marksOwn`).
* `cfg.room.asset` is the picture; `cfg.marks` holds what is in it, as fractions of the picture: `glass` (four corners),
  `front` (polygons kept in front of the glass), `lamps` `[x, y, r]`, `frames` `{ id, name, p: [4 corners] }`, `plants`
  `[x0, y0, x1, y1, 'top'|'bottom']`, `street`, `road`, `lit` (windows found outside). `Studio.detect` finds the window,
  lamps and lights when a picture is added; he marks the rest with "Mark things on the preview".
* `cfg.avatar` is his avatar video (`Media.importAvatar`: green or blue screen keyed as it is read, a see-through WebM, or a
  PNG sequence; trimmed to the part that has anything in, kept as WebP with transparency). He sits at his own desk in
  Character Animator, so no furniture is added. It is lit to match the room (grade, warm and cool edges, floor shadow).
* `cfg.stings` (thunder, lightning, flicker, lights off, blackout) and `cfg.shows` (a picture, headline or clip from another tab
  in one of the frames) are timeline bars.
* `Studio.soundData` makes a separate WAV: thunder after each flash, cars outside, wind in snow, clunks and buzzes for the
  light stings. **No rain sound**: he tried it and did not want it.
* In the Video tab, every [ME] part ("You in the studio", kind `avatar`) always shows his studio with his avatar video
  carrying on from one part to the next (one take, lines in order). The studio's own clock (weather, outside events like the
  plane) carries on the same way (`studioT`: avatar time less its in point), so the Studio tab's timeline plays through the [ME] parts. There are no black or green gaps any more (`cfg.gap` is
  ignored). A video follows the Studio tab (`Video.hooks.studio()`) unless it keeps its own copy in `cfg.studio`. `projects/my-studio.patter.json` is his room, already marked.
* **Decorations** (`dev/src/studio_decor.js`, `StudioDecor`, `cfg.decor`: none, auto (by the date), halloween,
  bonfire, standrew, christmas, hogmanay, burns, valentine, easter, match). Placed on the marked window (string of bulbs or
  bunting across the top, things standing on the sill), the picture frames (tinsel, scarf) and, in his own studio, the
  shelves. Still parts are drawn once into a sprite and darkened to sit in the room before the lamp light; bulbs, candles,
  pumpkin faces and glints go on after; fireworks (Bonfire Night, Hogmanay) and bats burst outside, cut to the sky so
  they stay behind the flats, light the room through the window and have bangs on the studio sound. Glasgow touches: a
  traffic cone on top of the Christmas tree, an "Auld Patter" bottle and coal for first footing, a bitten Easter bunny.
  Loops exactly like the rest.
* **Outside events** (`dev/src/studio_events.js`, `StudioEvents`): a running gag in the flats across the road. `cfg.events`
  is a list of `{ id, k, start, dur, text }` bars on an Outside track (+ Outside on the timeline, or the Outside the window
  card): plane, demolish, squid, telly, bonfire, polis, carfire, ufo, gull, summer, spell (`text`, 3x5 font on the block's
  window grid, scrolls when longer than 3 letters), strike (power cut outside and in the room). A longer bar plays slower.
  `cfg.tower` is the state of the big block at the start (standing, rubble, leaning, scaffold, patched) so damage carries on
  between videos; the plane leaves it rubble (a broken stump and a pile, never still standing), the demolition leaves it
  leaning. The block is cut out of the room (`towerKit`: `marks.tower` outline plus aerials found against the plate) and
  `dev/assets/studio-plate.jpg` (the view with the block removed, embedded as `STUDIO_PLATE`) fills in behind it.
  `marks.tower2` is the block to its right (used once the big one is gone), `marks.spots.green` the grass for the bonfire
  and UFO. Events light the room through the window (`Ev.light`), and have their own sounds (no rain).
* Tests: `dev/tests/studio_*.py` (frames, video, worker parity, seamless loop, Video gaps, random clicking,
  `studio_events_ui.py`, `studio_events_par.py`, `studio_events_loop.py`, and `studio_sweep.py`: every weather, state of the
  flats, shape, avatar and own room with all twelve events, for errors, blank frames and frame times). Several tests read
  fixtures from `dev/tmp_room.png`, `dev/tmp_marks.json`, `dev/tmp_avpng/` and `dev/tmp_avgreen.webm` (gitignored; make them
  again from his room picture and a short avatar clip if missing).
* Event layers are drawn a little smaller than full size and enlarged on the way in (that is their softness; no blur
  filter), all the light thrown into the room is one pass, and `cfg.vfocus` (auto, you, window, middle) sets where a 9:16
  frame looks (auto: you, else the window when events are on, else the middle).

## The Character (the Animator tab: dev/src/puppet.js, lipsync.js, character.js)

His Character Animator puppet animated without Adobe. **His artwork never goes in the repo unlocked** (see His artwork, sent privately): he loads his .puppet (a zip
with the PSD inside) or the .psd in the panel and it is kept in IndexedDB `patter-puppet`. Test fixture: `dev/tmp_puppet.puppet`
(gitignored; his Massive_v2.puppet), voices `dev/tmp_voice.wav`, `dev/tmp_voice2.wav` made with ffmpeg's flite.
* `Puppet`: our own zip and PSD reader (RLE, zip, PSB, masks), layers kept as WebP at up to 2200 wide, the rig worked out
  from Character Animator names: Head with views (frontal, left/right profile, upward, downward), Mouth with the twelve
  visemes, eyes with blink, lid, pupil, eyebrows, Body, arms (`+Rarm` with a hand swap set and a sleeve), and swap sets
  (one visible child) as triggers: hands (point, wave, fist, thumbs up), poses (P1 shout, P2 point at you), costumes (lab
  coat). Arms: the sleeve swings from the shoulder and stretches to the wrist, the hand turns at the cuff (`pose.arms`).
* `LipSync`: script to visemes by spelling rules plus a word list (Glaswegian too), audio features with the background
  noise taken off, forced alignment (Viterbi, each sound between a least and most length, banded); word times, tags and
  a level curve. `fromText` times a script with no recording. About 50 ms average word error on flite tests.
* `Character` (module `char`): blinks, breathing, nods on stressed syllables, phrase tilts, glances, eyebrows; emotion,
  look, gesture, pose and costume tags in the script and as timeline moves. **Hands are drawn lying on the desk**, so
  gestures turn them (values in `GEST`, found by drawing each: `tests/char_hands.py`). He checked them: turned, never mirrored
  (mirrored hands read back to front). His fist drawing shows only its front, so `Puppet` makes a 'back fist' from the thumbs
  up (thumb cut off along `FIST_CUT`, edge redrawn) for the desk bang and fist shake. His right hand is behind the mic, so
  one handed gestures use his left. `planHands` plans like gesture research says (McNeill, Kendon): phrases (speech
  between pauses) get hands in order of strength until the activity share of talking time is reached (`cfg.hands`:
  calm 0.3, natural 0.5, animated 0.85; more when angry, less when sad; 'tags' turns it off), neighbouring phrases share
  a gesture unit (the hand held up, beats on nods, down at long pauses), at most one bigger gesture per unit with its
  stroke on the stressed syllable (`pri` makes it take over the talking hand), never the same one (a shrug and an offer
  count as one) within 8 s; fists only when worked up; throwaway lines and laughs stay still. Smooth: `tests/char_hands.py`.
* **His talking hands** (`dev/src/hand_sheet.js` `HandSheet`): he draws hands on green (relaxed half curl, open
  explaining hand, palms up, pointing at you) and loads the sheet in the "Your talking hands" card; it is kept with the
  puppet in IndexedDB (`Puppet.setHands`), never in the repo (test copy `dev/tmp_hands/sheet.png`). Each drawing is cut
  off the green, any sleeve drawn with it taken off (hands only), and the whole sheet gets one scale (his open hands
  against his puppet's resting and waving hands) and one colour match (his middle skin tone). They become swap kids
  'relaxed', 'open', 'palm up', 'point you' (mirrored for the other side when he drew only one) with the wrist in the
  middle of the sleeve's opening, drawn on top of the sleeve. GEST talk, explain, offer, shrug, point, beat use them,
  with `old` falling back to his puppet's hands when no sheet is loaded. When a palm turns over the forearm shows the
  plain inside of the sleeve (`HandSheet.plain`, stripes kept on the upper arm; `pose.arms[side].plain`). He rejected
  hands we drew ourselves ("horrifying") and the steeple (pointless): do not bring either back.
* **His artwork, sent privately** (`dev/src/private_art.js` `PrivateArt`, `dev/lock_art.py`): the update repo is public, so
  his puppet and hand sheet go in it only locked: `private/art.locked` (AES-256-GCM, key from his password with PBKDF2
  SHA-256 600000 rounds) and `private/art.json` (`rev`). The app asks for the password once (`openUnlock` in app.js, or
  "Unlock the one Claude sent" in the Character panel), keeps it in IndexedDB `patter-private`, loads the puppet and hands
  and sets the Character's puppet; a new `rev` is loaded by itself. To send him a new version:
  `PATTER_ART_PASSWORD=... python3 lock_art.py his.puppet hand-sheet.png`, publish, push. **Never commit the password**
  or his unlocked files; only he and the user's own records hold the password. Test: `tests/private_art.py` (serves
  `private/` through `dev/tmp_home/private`, password from `PATTER_ART_PASSWORD`).
* **Rhubarb** (`dev/src/rhubarb.js`, `cfg.sync` 'rhubarb'): Rhubarb Lip Sync as WebAssembly (`lip-sync-engine` 1.0.3, MIT,
  PocketSphinx inside), files in `lipsync/rhubarb/` (about 40 MB, credits in NOTICE.md). Downloaded once from the update
  repo when he presses the panel's download button, kept in IndexedDB `patter-lipsync`, run in a worker. Only the mouth
  shapes come from it (A..H, X mapped to the twelve); words, tags and level still from LipSync. Tests serve a copy from
  `dev/tmp_rh/` (`window.PATTER_LIPSYNC`): `tests/char_rhubarb.py`. Downloads in this workspace work from cdn.jsdelivr.net.
* **In the Studio**: the avatar can be his character (`cfg.avatar.kind` 'char', "Use my character"): `Studio.hooks.char()`
  gives the Character tab's cfg and `Character.drawRig` draws the puppet into the avatar buffer. He is lit by direction
  (window and lamp positions from the marks): thin rims on the facing sides, lightning and outside events wash him from the
  window side (screen blend), his shadow falls on the wall away from the window, and the room's flash and darkness are
  drawn behind him (he darkens himself). Studio and Character have `mainThread` (no render workers: the puppet's pictures
  live on the page) and `prepare`. In the Video tab his voice plays under every [ME] part from that part's place in the
  one take (`cut_audio.js` `voiceItem`, src0 = `Video.avStart`). Test: `tests/char_studio.py`.
* **Exports use every core** (he found 30 s with the plane and his character took 139 s): Studio with his character and the
  Character tab draw in the render helpers too: `mainThread` still says the puppet lives on the page, and `workerData`
  hands each helper a copy (the rig without mips, about 50 MB, the voice timing, `durHint`), taken in by `adoptWorker`.
  Fonts built into the bundle (`PATTER_FONTS`) no longer stop the helpers (`fontList`). `tests/char_workers.js` (runjs).
* **Speed** (he found the preview slow with his character and the plane): `Puppet.draw` picks one size per drawing
  (`mipLevel`, sixteenths of full size, two sizes kept) and draws every layer from a copy resized once with high quality,
  so nothing big is shrunk every frame (preview and exports). In the Studio, while the preview plays (`look.preview` and
  not `paused`, `v.moving`), his lighting buffer is 0.6 of its size; paused and exports are full. Canvases made for
  reading pixels (`willReadFrequently`) are CPU canvases: never draw one every frame, copy it to a plain canvas first.
  PNG sequence exports pack frames in the background (createImageBitmap then convertToBlob, up to 3 at once, in order).
  `tests/studio_prev_prof.py` (MODE=export for full size) and `tests/png_pipe.js` measure them.
* Its voice is `soundId` (a CutMedia id), so the clip plays and exports with sound in the Video tab (`cut_audio.js`
  `clipSound`, `CutExport` waits on `Character.prepare`). Tests: `tests/puppet_read.py`, `char_ui.py`, `char_hands.py`,
  `tests/char_motion.js` (runjs: every continuous part of the pose frame by frame).

## The intro (dev/src/intro.js `Intro`, dev/src/intro_scenes.js `IntroScenes`, dev/src/squid.js `Squid`)

The PatterSquid opener lives in the **Video tab** now: "+ Add intro" (Patter in the library) puts it at the start of the
video with its sound, and selecting the intro clip shows its settings on the right (an Intro panel, `title` in
`cut_insp.js`, which is `Intro.form` on the clip's own `cfg`; double click opens it too). The Intro tab button is hidden
(`index.html`) and a saved `state.module` of 'intro' opens the Video tab. Changing the words makes its sound again a
moment later (`Intro.ensureSound`, keyed on the settings).
* **The one style, `swally` ("Chucked oot")**, a cut scene on his own Coatbridge street picture (`assets/coatbridge-street.jpg`,
  embedded in `src/fonts.js` as `COAT_STREET`): the pub door opens, he is shoved out backwards resisting, one straight leg
  in a black shoe swings out of the doorway and boots him, he flies (real gravity, his body turning to dive), his face hits
  the road and he scrapes along it (squash and stretch from `where(t).ss`, the body toppling onto the road, legs swinging
  over), his gold check cap flies off and he picks it up and puts it back on, pulls his tonic wine out from behind him,
  gives the pub the finger, a ned on a BMX comes down the road at the camera and soaks him through a puddle, he necks the
  bottle, goes green, heaves and spews ink at the lens. The ink covers the screen and the logo, PatterSquid and the
  episode splat in together (overshoot and spring back); the episode drops in as one line and one word (about two thirds
  along) lands squint; a cone drops onto the squid's heid in the logo.
* Settings he edits: `name`, `pub` (the pub sign, default "The Hole in the Wa'"), `episode`, `kicker`, `lines.swally`,
  `label` (his own picture for the bottle label, a downscaled JPEG data URL; empty is our made up Auld Patter label),
  `hold`, `sound`. Everything in the scene is a pure function of time; beats are `IntroScenes.B` (all derived from a few
  numbers, so moving one moves the rest). `BASE.swally` is `B.end`; the episode needs no extra time in this style.
* Brands: no real labels or patterns are drawn. He asked for the Buckfast label and a Burberry cap: the bottle is our own
  dark tonic wine bottle (or his own picture via `label`), the cap is our own gold check.
* Look: flat adult cartoon (thick outlines, cel shading via `vol` and `tube`), his icon kept as the real picture
  (`Squid`: WebGL mesh warp with lids that can slant angrily, `lidTilt`, and two vector arms, the left one for the finger;
  `postArm`/`postArmL` hooks draw in the picture's coordinates). `squidComic` adds the outline; its layer keeps his feet in
  the middle so nothing is cropped when he is upside down.
* `swally(g, t, W, H, o)` takes the transform it is given as the screen (`M0`, `ST`), so exports at 720p or 4K frame it
  exactly like 1080p. Fonts in `src/fonts.js` (`PATTER_FONTS`, `PatterFonts.ready()`; licences in `assets/fonts`).
* The old styles (ink, battered, neon, epic, 3D in `g3.js`) are still in `intro.js` so old projects open, but are not
  offered. He rejected them, the vector squid, the 3D street and several gags along the way.
* Sound (`Intro.sound`, branch `swally`): music through the pub wall, the door, the boot, the face plant and scrape, the
  door slam, the bike, the splash, drips, glugs, heaves, the spew, the splat, the episode thump and the loose word's bonk,
  the cone. No rain. In the Video tab the clip plays it through a built in media file `Intro.soundId(cfg)`.
* Tests: `tests/intro_video.py` (no Intro tab, Add intro, the panel edits pub and episode, sound remade, undo, double
  click, export with picture and sound).

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
