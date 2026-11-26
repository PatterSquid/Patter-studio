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
* Keeping his computer free (he found it slow, November 2026): the preview player (`E.Player`) rests while paused with
  nothing changing and nobody touching anything (checks five times a second instead of every refresh; any pointer, key,
  typing or player call wakes it), and only writes the time and Play label when they change. Whether anything changed
  needs the clip's settings written out and compared, so that is done only when something may have changed them (a press,
  a key, typing, a drag with the button held, `save()` in app.js calling `player.wake()`) and otherwise four times a
  second: moving the mouse across the window costs nothing however long the video is.
* **An even beat for the preview** (polish pass, November 2026): when a tab cannot be drawn inside one screen refresh the
  player shows a new picture every second (or third, fourth) refresh, each held the same length, instead of as many as it
  can at uneven gaps (`div`, `vs` in `E.Player`). Up: pictures late one time in four for two checks running (a stumble as
  playing starts does not count); past two refreshes only when half are late and the drawing is why. Down: when the
  drawing would fit the quicker beat with room to spare, never straight after a failed try (the wait doubles each time, up
  to half a minute). Remembered per tab in `beatOf`. A tab that keeps up is never slowed: do not add a rule that slows on
  drawing cost alone (it dropped tabs that held 60 to 30). `tests/pacing.py out.json 2 <slowdown> vsync <tabs>` measures
  it with frames started only on a 60 a second screen's refreshes (headless Chromium otherwise starts the next frame at
  any gap, which hides the judder). On the stand in for a slow laptop (screen at scale 2, processor slowed 2 and 3
  times) pictures held the same length went from between 52 and 94 in a hundred to between 86 and 100; at full speed
  nothing changes (60 a second before and after). The numbers move a few points from run to run here. The editor's
  overlay on the preview (`drawOverlay`) does nothing while playing with nothing selected and the pointer elsewhere (it
  was cleared and handed to the screen every frame), and clocks rewritten every frame are `contain`ed so the page is not
  measured again for them. The Speed check reports pictures really shown and the beat (`player.pictures`, `player.beat`).
* Checks added in the polish pass: `tests/popdet.js` (runjs: every tab's example frame by frame at 60 a second, lists single
  frames that change far more than their neighbours; `{"mods":["story"]}` picks tabs. The Story example lists six and B roll two on
  every build: they are the cuts between scenes, not faults), `tests/ui_metrics.py` (where the browser's
  time goes: start up, each tab idle and playing, a heavy Video timeline scrubbed, dragged, zoomed), `tests/pacing.py`.
* **Paint cost** (second pass, November 2026): script time is tiny everywhere; a frame's time is painting, and a canvas only
  paints when it is read, so profiles put it all on `getImageData`. `tests/opcost.py <tab> [moment 0..1]` paints every call
  of one frame on its own and lists the lines of code that cost most; `tests/slowframes.py <tab> [n]` lists a tab's slowest
  moments; `tests/samepix.py <tabs> <n> [portA portB]` compares frames from two builds (serve the old one on 8766 from a
  worktree). What costs: anything drawn resampled over much of the frame (under the camera's zoom or at a fraction of a
  pixel: about 6 ms at 1080p here for a full frame, 0.6 ms for a plain copy). Fixed: the chart panel grain is sampled
  unsmoothed (it was 12 ms of a 21 ms frame; faint noise looks the same, at most 6 levels in 255 different); Story's baked
  scenery is cropped to where it has drawing (`trimBake`, pixel identical; worst frames 27 to 14 ms); Newspaper cards
  draw from halved copies near their size on screen (`cardMip`; exports too since the motion pass). Left as they are on
  purpose: the zooming background (unsmoothed it shimmers), Story's chalk speckle (bold, would shimmer), the Studio's
  plant strips and rain beads (the life of the room).
* **How it answers the hand** (third pass, November 2026: "runs like a proper software"). `tests/tour.py out.json [tabs]`
  goes round every tab with real clicks, typing, a slider drag, a scrub and a short play and records long tasks (over
  50 ms), the slowest input event, frame gaps and where the browser's time went; `tests/prof_step.py
  <boot|open:TAB|play:TAB|slider:TAB|type:TAB|idle:TAB>` is a processor profile of one such step, with the browser's own
  calls charged to the function that made them; `tests/idle.py` shows what each tab does untouched (all under 2 in a
  hundred busy, five checks a second). What was found and fixed:
  * Story and B roll: every step of a zoom or Whole board slider baked the scenery at that size (and `prebake` did the same
    in idle time): a fifth of a second a step. Now, paused in the editor, a size is baked only once it has stayed asked for (`bakedSoon`, 140 ms;
    `prebake` 300 ms; the scenery is drawn live meanwhile; playing and exports always bake). Baked sizes were never let go:
    `keepBake` keeps the most recently used up to `BAKE_BUDGET` pixels. The chalk speckle tile is made once a colour
    (`patTile`; every new drawing surface made its own). Panel pictures are reused (`picPool`).
  * The Smooth preview started its helpers at 12 ms a frame, for clips the player now shows live at an even 30 or 60: two
    helpers each loading the whole app after every change, for a smaller, softer picture. It starts at 24 ms, or when the
    player has had to drop below 30 (`player.beat >= 3`). That was also the 340 ms stall on pressing Play in a video of
    Patter clips.
  * Chart labels: `numFmt` keeps its number formats (toLocaleString built one a label a frame). Studio `cloudTex` sums its
    noise a row at a time (70 ms to 17 the first time his studio is drawn; same numbers). Thumbnail text is measured once a
    wording, font and size (`laid`).
  * Before and after here: start up long tasks 614 to about 300 ms, opening Story 330 to about 90, Story slider drag 622 ms
    of stalls to none, B roll 302 to none, Play in the Video tab 340 to none. Frames without the preview flag are pixel
    for pixel what was published (`PREVIEW=0 tests/samepix.py`). Memory steady over `tests/leak.py`.
  * Left alone: the map tabs' first draw (the graphics card reading the globe back, slow only in this software browser),
    the first frame of each tab (one time drawing of its background and textures).
* The cloud workspace can be wiped between sessions (it was, mid polish pass): everything in `dev/tmp_*` and the scratch
  folder goes, the repo comes back as a fresh clone of `main`. So push work in progress to a branch as you go, and expect
  to remake fixtures: `tmp_cut/`, `tmp_dogclip.webm`, `tmp_noisy.wav`, voices (ffmpeg, flite), `tmp_room.png` and
  `tmp_marks.json` (from `dev/assets/studio-room.jpg` and `studio-marks.json`), `tmp_dnhome/` (links to `denoise/` and
  `cutout/`). His puppet, hand sheet and recordings cannot be remade: the Character tests need him to attach
  `Massive_v2.puppet` and his hand sheet again (or the art password to unlock `private/art.locked`). The Smooth preview
  (`SP` in app.js) only draws ahead when the tab's live drawing is slow (`player.drawMs` over 12 ms), with at most two
  helpers, and for clips with his puppet (`mainThread`, a big copy per helper) only once he presses Play. The background
  remover lets go of its model two minutes after he leaves the Thumbnail tab (`Cutout.rest`). **His laptop** (speed check,
  November 2026): Intel Iris Plus, 8 cores, 16 GB, screen at scale 2. Painting through its graphics card was 2 to 6 times
  slower than on the processor, so the player draws previews on a processor canvas (`willReadFrequently`) and copies the
  finished frame to `#prev` (gear: Draw on, `patter-draw`, `E.previewOnCpu`), and normal previews are at most 1.5 pixels
  per screen pixel. With that on, the top of engine.js makes every 2D canvas the page creates a processor canvas (scratch
  buffers made on the graphics card had to be copied back every frame: a fixed 40 ms in his Studio); helpers untouched.
  Studio clouds, the intro's squid (with its 12 outline copies) and its ink are drawn at the size they appear on screen
  (exports unchanged). Scratch buffers sized from the frame (1920) rather than the screen are the usual fixed cost to look for. The Speed check (? then Speed check, `speedCheck` in app.js) reports script, graphics card and
  processor time per tab and plays the current tab for real; ask him for it when he says something is slow. Measure idle use with the
  whole browser's CPU (renderer, GPU process), not just the page's scripts.
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
  `.tl-pop`), Duplicate and Delete only while something is selected, the Snap pill (`.tl-snap`; the Video timeline's is `.ct-snap`), and on the right
  Fit (`.tl-fit`: all of the clip; opening a clip never goes below 30 px a second) and the zoom slider (`.tl-zoom`). Menus
  open upwards.
* **One look for both timelines and one play bar** (polish pass, November 2026: he asked for CapCut's standard, improving
  what is there, no new features). Both timelines have the orange clock in the corner (`.ct-corner`, `.tl-tc`, `E.tc`:
  minutes, seconds, frames), the same ruler (`E.rulerLabel`, a label every 70 px or so), the orange playhead moved by
  transform (never `left`: that made the page lay out every frame), a yellow snap line, zoom that keeps the moment under
  the pointer (Ctrl + wheel; steps in one refresh are applied once: `setZoom` in cut_ui.js, `setPps` in editor.js), and
  scrolling along when a bar, a trim or the playhead is dragged to the edge (`edgeScroll`). The play bar (`.transport`) is
  a round play button (`#playBtn`, an icon; `data-s` is Play or Pause), the clock (`#time`: `<b>` now, `<i>` the length),
  the scrubber and the gear. The Audio tab has the same play button and an orange playhead that is a moved line, not a
  canvas. Quiet motion only (short colour transitions, menus ease in, `prefers-reduced-motion` respected), slim dark
  scroll bars, drawn icons on the Video library's tabs. Keep to this vocabulary when adding anything.
* **Video** keeps its CapCut frame (library left, inspector right, timeline below); undo is in the header now.
* Nothing scrolls the page at 1366 by 768; only the panels scroll. Tests click tabs and rail buttons with JS
  (`button[data-mod=...]`) and add things through `.tl-add` then `.tl-addmenu button`.

## The motion pass on the Graphics tabs (November 2026, published as 2026.11.19.2)

After the Charts he asked for the quality of the animation in the other Graphics tabs to be raised ("the newspaper etc",
"not the actual animator", "remembering to make it efficient for export"). Scope: Newspaper, Timeline, Pictogram, World
map, Flights, Flyover. Story, B roll, Studio and Character are left alone unless he says otherwise. He saw the Newspaper
first as a before and after and said "Go" for the other five; each was sent as its own before and after, and he
said "Publish" the same evening. He has not yet said what he thinks of them in use: if he comes back on one, change that
tab only and keep the rules below.
* **The rules of the pass.** Every clip keeps its exact length and the moment each thing lands (`duration()` and the
  plan's times do not change: his videos are cut to them). No frame gets slower to export (measure with `tests/prof.py`
  and, for one stretch at 1080p, a frame timer; software drawing here, so compare builds, not absolute numbers). Change
  how things move, not what the clip says. He turned the two handed hands down as "a bit too much": weight, order and
  polish, no gimmicks.
* **The motion kit** (engine.js): `E.smear(ctx, fn, box, vx, vy, key)` draws a thing with a true smear along its travel
  for the frames it moves fast (how it works and why is in the comment there; about 5 ms a frame for a clipping, only
  while it flies; along the surface's sides only, so keep the camera level while things fly in). `E.wob(d, amp, decay,
  freq)` is a wobble that dies away after a landing.
* **Newspaper** (done): a clipping is over its place in half its landing time (about when it used to get there, so what he
  cut to still fits), held off the board (bigger, shadow thrown further), turns level and is let down and pressed
  flat exactly at its landing time, where the shake and a small squash now happen (it used to spring to its place, bounce,
  and shake after it had stopped). The fast part is smeared. Tape goes on after it lands, one strip then the other.
  Clippings already down are knocked by each one that lands (`where`). The highlighter is a chisel stroke a line (its
  share of the time by its length, quick then slowing, streaks, heavier where the pen went down and behind the nib); the
  underline is a pen line that swells and thins. Close shots roll a little towards the clipping's tilt (the fifth number
  of a camera key; wide shots are level, the board itself never turns so it always covers). Export frames: the card is
  drawn from its halved copies in exports too and the board is not painted under a clipping that is down: over a whole
  clip at 1080p here the frames average 18 ms before and 14 after (three clippings: 37 and 30), the smear included.
* **Timeline** (done): the head gathers and sheds speed smoothly between stops (`glide`; it used to hit four times its
  average speed mid hop) and trails a short streak; the camera follows a moment behind and comes to rest after it (`camS`)
  instead of being bolted to it. At a stop: stem, the card opens out from the stem's end (a little past full and back), the
  year is stamped on, the words come up a line at a time (all inside about 0.6 s, so a fast timeline still reads). Stops are
  reached at the same moments.
* **Pictogram** (done): figures rise into place and settle once (they popped on a spring and wobbled); a figure's colour
  runs in over a few frames as it hops and lands with a small squash (it switched in one frame under a bulge); a narrow
  gleam crosses each finished group once; the key's chips rise in.
* **The title banner** (`E.title`: map, flights, flyover, timeline, pictogram; the charts do not use it) drops in from
  just above and settles with one small rock.
* **World map, Flights, Flyover** (done, a lighter touch: they were already the most worked): name labels and flags arrive
  once (`Globe.pop`, a touch over size and back; they rocked on a spring), a pin falls faster as it comes, digs in and
  rocks upright (it slowed into the map as if on a string), a country comes up a little past its height and settles
  (map, flights, flyover), a plane leaves small and grows and comes in shrinking onto the place (it appeared and vanished
  at full size). The flying camera was left as it is (`Globe.flight` and `Globe.smooth` were already tuned).
* Tools: `tests/tab_sheet.py OUT [port] [tabs]` (any tab's example as a contact sheet: `N`, `COLS`, `W`, `AT`, `FROM`/`TO`
  for a close look at one move, `CFG` for other settings), `tests/before_after.py OUT.mp4 TAB [settings.json ...]` (old
  build on 8766 beside the new on 8765, then the new at full size; says if the lengths differ; link `dev/tmp_fonts`, now
  with Lora 400 and 500 italic, into the old build's `dev/` or its side is drawn in the wrong lettering), `tests/popdet.js` takes
  `over` (more settings per tab), `PORT=8766 tests/runjs.py ...` runs a check on the old build.
* **Comparing the map tabs between two builds: two traps.** (1) The test page asks port 8765 for its ten country test map;
  a page served from another port (the old build on 8766) is refused it and quietly gets the real world map from the CDN
  instead, so the two sides draw different maps and their lengths differ by a few hundredths of a second (a map clip's
  length depends on the countries' shapes). `REALMAP=1` on `tests/runjs.py` and `tests/tab_sheet.py` gives a page the real
  map; `tests/before_after.py` does it for both sides by default. With the same map, every tab's length is identical to
  the published build in both shapes (checked). (2) Land drawn on the graphics card is a tenth of a second a frame in this
  software browser and far worse with two pages at once (three seconds a frame): `before_after.py` draws the map tabs'
  land the plain way (`look.gpu = false`, same picture, about twenty frames a second) unless `GPU=1`.
* **A map fault found on the way and mended** (`fixWinding` in geodata.js). In the detailed world map Antarctica's first
  ring is a speck round the pole and its coast comes second, so it read as everything but Antarctica. Two things followed
  in the published app: with the graphics chip switched off (Look), a map at full detail had its whole sea painted the
  colour of the land; and Antarctica picked as a stop turned the whole globe its colour and sent the camera astray. The
  outline is now the ring that encloses the most, whichever comes first. A clip that stops on Antarctica changes length
  (it was unusable before); nothing else does. This is also why `before_after.py` draws the map tabs as the app's
  preview does (`look.preview`, `look.gpu = false`): the old build's side still has the fault at full detail.
* Run one background job at a time, and let each clear its own files (`before_after.py` removes its own frames): two
  preview jobs sharing a folder that one of them emptied cost a run here.
* Never kill processes by a pattern picked out of `ps` when the same text is in the command doing the killing (a heredoc
  that names the file, say): it kills its own shell. Stop a background job with its task id, then look for strays.

## Charts (dev/src/charts2.js `ChartKit`, dev/src/charts.js `Charts`, module `charts`)

He called the Charts tab amateur (November 2026) and asked for more kinds of chart, professional and smooth animation, and
a panel that is easy and says plainly what can be typed in. The chart kit is the answer; the old two charts are kept only
so charts he already made stay exactly as they were.
* **One table for every kind.** `rows` is `[[label, v1, v2, ...]]`, `series` is `[{ name, colour }]` (a column each),
  `rowHl` (1 for a highlighted row) and `rowCol` (a row's own colour, '' for none) run alongside the rows; keep those two
  dense lists of plain values (Repair drops empty slots). `type`: bar, hbar, grouped, stacked, line, area, pie, donut, race
  (columns are moments in time), number (big counting numbers, a second column is the change), percent (`outOf`).
  `ChartKit.TYPES` says what each kind takes (`many` columns, `time`, `what`: the words shown over the table) and
  `EXAMPLES` has a ready table for each ("Fill with an example"; an untouched example follows the kind he picks).
* **Three looks** (`style`): `sleek` (dark card, the default), `light`, `comic` (thick outlines, slams in, banner title).
  `theme(cfg, C)` holds every colour and radius; draw through `block`, `label`, `strong`, `drawCard`, `drawHeader`,
  `drawGrid`, `drawRefs`, `drawCallout` so a new kind gets all three looks.
* Everything is a pure function of time from `plan(cfg, look, W, H)` (kept by the settings, size and `E.fontVersion`).
  `timing.intro` and `timing.draw` are the Title and build bars on the timeline (`tracks`); `speed`, `order` (rows, big,
  small, together), `hold`, `ending` ('out'), `camera` (a slow push, a lean onto each callout, pulls back; the card is never
  cut by the frame; the background is not scaled, only the card), `milestones` (up to three callouts `{ on, idx, caption }`),
  `avg`, `ref` with `refValue` and `refLabel`, `counter`, `labels`, `legend`, `sort`, `top` (race), `centre` (donut).
* **Old charts are untouched**: a chart with no `style` and no `series` is classic and is drawn by the old code in
  charts.js. `Charts.legacy(cfg, depth)` (called by `Repair.clip` before it fills defaults) returns the new keys to leave
  out, so charts inside his videos and projects keep their settings, pixels and lengths (`tests/chart_old_same.py`
  against the published build on 8766: must say "all the same"). The Charts tab's own chart, when it is still the old
  untouched example, becomes the new example. The classic panel has "Bring it up to date" (`upgrade`, look comic).
* The panel (`form`): kind tiles (`.ck-types`), look (`.ck-seg`), title lines, the table (`.ck-table`: cells with `data-r`
  and `data-c`, a colour dot and remove under each column name, a colour dot, star and remove on each row; paste from Excel
  or Sheets straight into a cell or into the paste box: `readGrid`, `cleanNum`, `putGrid`), Numbers, Extras, Callouts,
  Animation. The form is in the page twice (the aside and a hidden scene panel): tests use `:visible`.
* A paused chart rests on its finished picture (`park`, `E.Player.toEnd()`, `begin()` in app.js), so he sees the chart he
  is typing, not an empty card; Play starts from the beginning.
* **Words tick, shapes glide.** The browser sets canvas text on whole pixels up and down (whatever the transform), so under a
  slow camera a big title drawn as words steps a pixel at a time. The title is made once as a picture (`titlePic`, a
  little bigger than it is shown) and laid on. Do the same for any other big words that ride a slow move.
* No `shadowBlur` (soft shadows are stacked see-through rounded boxes). Tests load Anton and Archivo Narrow from
  `dev/tmp_fonts/` (the fontsource copies; the command is in `tests/chart_sheet.py`) because headless cannot reach Google
  Fonts. Checks: `tests/chart_sheet.py OUT [port] [names]` (contact sheets: `STYLE`, `AT`, `N`, `COLS`, `W`, `FMT`,
  `CASES`), `tests/chart_ui.py` (27 real steps in the panel), `tests/chart_damaged.js` (runjs: every kind and the classic
  ones with damaged settings, mended or not), `tests/chart_old_same.py`, `tests/popdet.js '{"mods":["charts"],"all":true}'`
  (every kind frame by frame: none may list a pop).

## The Audio tab (dev/src/audio_fx.js `AudioFX`, dev/src/audio_ui.js `AudioTab`, module `audio`)

Voice clean up and editing, its own top tab. `body.aud` gives `#audioWs` the whole of main; the module's `form()` draws the
workspace (so the app's undo redraws it); keys go to `AudioTab.key` first (Space, Delete, arrows). The recording is never
changed: `cfg.src` (a CutMedia file), `cfg.clean` (settings) and `cfg.edits` (`del`, `sil`, `fin`, `fout`, `gain`, in the
recording's own seconds) are applied on top; the cleaned sound is cached by settings.
* `AudioFX`: our own Audacity style noise reduction (profile learned from a quiet selection, STFT 2048/512 root Hann,
  per bin gate with time and frequency smoothing), RNNoise (built in: `assets/rnnoise`, @jitsi/rnnoise-wasm, embedded by
  build.py as `src/rnnoise_lib.js`; warmed on the first two seconds), rumble high pass, 50 Hz hum notches, de-esser,
  click repair, leveller, LUFS loudness and a peak limiter, spectrogram and peaks. 48 kHz mono throughout.
* **AI voice cleaner** (November 2026: he found RNNoise horrendous): DeepFilterNet 3 (`dev/src/deepfilter.js` `DeepFilter`, MIT or
  Apache), the three official ONNX models in `denoise/` (8.6 MB, NOTICE.md) run with the ONNX Runtime from `cutout/` in a
  helper; the STFT, ERB and complex features, look ahead, deep filter and overlap add are our own port of libDF and
  df/enhance.py, checked against a Python port with onnxruntime to 1e-5 (scratch work, not kept). Downloaded once into
  IndexedDB `patter-denoise` ("Get the AI voice cleaner"). `clean.ai` is `{ on, atten }` (dB it may take away: 12 gentle,
  20 natural (default), 30 strong, 40 thorough (what Studio voice uses), 100 everything). On a test (flite speech plus pink noise and hum, SI-SDR against the
  clean voice): noisy 9.0, old Clean my voice 10.1, Audacity style 12 dB 12.3, RNNoise 12.7, DeepFilterNet natural 14.3.
  RNNoise code stays in AudioFX but is no longer offered. Tests serve `dev/tmp_dnhome/{denoise,cutout}` (symlinks to the repo
  folders) through `window.PATTER_DENOISE`: `tests/audio_ui.py`, `tests/audio_edit2.py`.
* The chain uses ONE noise remover (the AI when on, else the Audacity style one), then voice EQ (`clean.eq`: boom, boxiness,
  presence, air), de-esser, a real compressor (`clean.comp`, threshold under the voice's loudness, make up gain), the slow
  leveller, loudness and limiter. Listening: Before, After, and Removed (only what the noise removal took away, the
  difference of its input and output; words in it mean it is too strong); B swaps before and after. Editing adds Cut, Copy,
  Paste (`edits` kind `ins`: a stretch of the recording put in again at a point, in `segmentsOf`), Amplify by dB and
  Normalise (peak to -1 dB), with Ctrl+C, X, V (routed to `AudioTab.key` by app.js).
* **No "Clean my voice" button.** He had it taken out (November 2026): even kept simple it sounded "a bit weird". He uses
  the AI voice cleaner and the other settings by hand. Do not bring a one press clean up back unless he asks (the Studio voice switch below is one, built for his studio sound request: he was told so and published it). He also tried a "Grit" voice changer (PSOLA pitch and formant lowering with rasp, November 2026): subtle settings were inaudible and stronger ones risked sounding edited, so he chose his natural voice. Do not offer voice changing again unless he asks. "Send it on" renders a WAV into
  CutMedia and `AudioTab.hooks.send` (app.js) sets the Character's voice or adds it to a Video audio track.
* Tests: `tests/audio_ui.py` (needs `dev/tmp_noisy.wav`: flite speech plus hiss, hum and rumble).

### The studio voice pass (dev/src/voice_fx.js `VoiceFX`; November 2026, published as 2026.11.19.3)

He asked: "Audio tab needs a serious upgrade. I want to be able to record with a shitty mic and still get studio quality
audio (not literally obviously, but a serious improvement). We don't want any background noise, and we want it to sound
like the avatar is talking, coming directly from his mouth. Upgrade this comprehensively". He was sent one before and
after clip (his own recording of 12 November three ways, then the same voice through a simulated room and cheap mic) and
said "Publish" the same evening. He has not yet said what he thinks of it in use: if he comes back on the sound, change
the stage he names and keep the rest.
* **What was wrong, measured on `dev/tmp_me.wav`** (his recording; private, never commit): hiss only 32 dB under his
  voice; a mains buzz at 250 Hz and 1.5 kHz the whole way through; recorded quiet (voice at -34 dB); harsh round 3 and
  6 kHz. The tab as it was (AI on Natural, EQ, compressor, loudness) left the gaps 38 dB under the voice: **the compressor
  lifted back most of what the cleaner took out**, and the buzz stayed. With the new chain the gaps are 70 dB under.
* **The chain** (`AudioFX.chain` = `front` then `back`; every new stage is off by default, so old settings sound the same):
  `declip` (flat peaks redrawn, modest: 2 dB better on hard clipping), declick, rumble, old hum, **`buzz`** (`VoiceFX.tones`:
  steady tones found in a 3 Hz a bin spectrum of the quieter frames, then `detone` notches just those), **`room`**
  (`VoiceFX.dry`, see below), the AI cleaner (or the Audacity one), `pops` (the band under 120 Hz ducked while it towers
  over the band above), the gate worked out here, **`tone`** (`VoiceFX.match`), EQ by hand, S softener, **`ride`** (phrase
  loudness evened by a slow gain held through pauses), compressor, old leveller, **the gate laid on** (`VoiceFX.gate`,
  `gateApply`: after the compressor, so nothing can lift the gaps again), loudness.
* **The room is taken out by prediction before the cleaner** (WPE, Nakatani 2010: per frequency up to 8 kHz, a 16 tap
  filter predicts now from 32 to 190 ms ago and the predicted part is subtracted; 5 rounds; learned from 3000 frames
  spread over the recording so the cost does not grow with length, about 4 s). Things found on the way, do not redo them:
  it must come BEFORE DeepFilterNet (after it, half the gain); a delay of 3 frames, not 2 (2 predicts the voice itself
  from overlapping frames: it harmed a dry recording and could not tell dry from roomy); more rounds help more than more
  taps; a spectral tail suppressor after the cleaner (Lebart style, with a decay measured from word endings) gave nothing
  measurable and was thrown out. `info.room.echo` (dB of the voiced sound that could be predicted) is the measure of the
  room: about -25 dry, -13 across a desk; the mix follows it (`(echo + 23) / 6`), so a dry recording is left alone. On a
  simulated desk mic in a room (his voice, RT60 0.45 s, 30 cm, fan): cleaner alone PESQ 1.61 ESTOI 0.746, with the room
  stage first 1.95 and 0.814. A very echoey recording (a metre away) is only helped a little: nothing here cures that.
* **AI cleaner at 40 dB ("Thorough"), not Everything**: the same on ordinary recordings, and on a hard one Everything chewed
  words (ESTOI 0.50 against 0.59). The gate does the rest in the gaps.
* **Tone**: his long term spectrum (third octaves, voiced frames) against Byrne et al. 1994 Table II (male, 20 cm from the
  mouth: the figures are in the code) plus a modest lift from 3 kHz (`LT_UP`: produced voices are brighter than Byrne;
  a clean modern recording measures 5 to 9 dB over it at 5 to 10 kHz, the lift is about half that). The difference is
  smoothed to an octave, limited, and half of it applied (`tone.amt` 0.5). It is a taste setting that cannot be judged
  without ears: if he says dull or harsh, move `LT_UP` or the amount, not the method.
* **Gaps and breaths** (`gate`): talking is where the voice above 250 Hz is within `under` (30) dB of his speaking level,
  kept from 60 ms before to 120 ms after (word edges are kept by time, not level); a blip of a few ms does not count;
  elsewhere down by `range` (24). A breath is sound with nothing at 80 to 450 Hz that lasts longer than a consonant
  (alone for 120 ms, or a quarter second before or after the voice): down by `breath` dB (9 = soften).
* **Studio voice** (`STUDIO()` in audio_ui.js, `clean.studio`): one switch that writes every stage's setting (declip, buzz,
  room 0.8, AI 40 when downloaded, pops 0.6, tone 0.5, S 0.3, ride 0.6, comp 0.3, gate 24/30/9, loudness -16); Off puts
  everything back to nothing. **This is a one press set up again** (he had "Clean my voice" taken out for how it
  sounded): he was told so plainly and published it. If he later does not want it, take the switch out and leave the stages.
* The panel is in chain order: Studio voice (with "What came in": level, noise, buzz, room, breaths, from
  `VoiceFX.inspect` and the chain's `info`), Noise, Room, Repairs, Tone, Level and gaps, Noise by hand, Send it on,
  Recording. `processed()` keeps the slow half by `AudioFX.frontKey` so tone, level and gap changes are ready in a second.
* **Recording** takes the samples themselves (an audio worklet from a data: address, the script node as fall back) into a
  32 bit float WAV (`AudioFX.wavF`); it used to go through MediaRecorder's Opus. A meter by the Record button (`.au-meter`)
  and a line of advice (too quiet, clipping); the microphone can be chosen when there is more than one (`patter-mic`).
* **Loudness now lands on the figure picked** (`AudioFX.loudness` measures again after the limiter and tops up): old
  settings with a loudness come out about 1 dB louder than before. Everything else in old settings is sample for sample
  the same (checked against the published build).
* Tests and tools: `tests/audio_studio.py` (19 real steps: report, Studio on without and with the cleaner, the quick half
  only on a level change, gaps, breaths, undo, Removed, off, recording from Chromium's pretend microphone). The measuring
  kit is in `dev/tests/voice/` (see its README): the chain on a WAV in the browser or in Node, bad microphone versions
  of a clean voice, scores, spectrograms, the before and after clip. The scores use DNSMOS, PESQ, ESTOI, pyroomacoustics
  and nara_wpe from pip and Microsoft's DNSMOS model: **measuring sticks only, never in the app**.
* Not done, needs his say so: a generative voice restorer (the Adobe Enhance kind; the open ones, Resemble Enhance for
  one, are large downloads and can change a voice, which he has turned down before: check sizes and licences before
  proposing one); making up a top end a microphone never recorded. Do not add either without asking.

## The Thumbnail tab (dev/src/thumb.js `Thumb`, dev/src/cutout.js `Cutout`, module `thumb`)

His YouTube thumbnails, in place of Canva and remove.bg (November 2026). Its own top tab like Audio: `body.thb` gives
`#thumbWs` the whole of main and the module's `form()` draws it (so undo redraws it). Layout: rail of drawers on the left
(Layouts, Pictures, Text, Shapes, Stickers, Fonts), the picture in the middle (`.th-cv` drawn at the size shown, `.th-ov`
on top for the selection, handles, snapping guides and the hand fixing brush), settings on the right (`.th-insp`), the
layers along the bottom (`.th-layers`, drag to reorder). The header Export opens its save window (JPG kept under YouTube's
2 MB, or PNG, at 1x to 2x; copy to the clipboard).
* cfg: `fmt` ('16:9' 1280x720, '9:16' 1080x1920, '1:1'), `bg` (colour, grad, radial, image), `layers` drawn in order, each
  `{ id, k: image|text|shape, x, y (middle), w, h, rot, op, flipH, flipV, hide, lock, shadow, glow }`. Pictures are CutMedia
  files (imported with `builtin`, so they stay out of the Video library); `slot: true` is an empty picture place in a
  layout (double click or drop to fill), `autoCut` cuts it out on arrival. Text: `cols` a colour per line, `fit` stretches
  every line to the box width (the Basic Logic look he likes: black, cut out head left, white line then red punchline),
  `stroke`, `stroke2`, `box`. Each layer is drawn flat then laid on (glow and shadow are blurred silhouettes), so soft edges
  and see through never double up.
* Layouts in `TEMPLATES` (split, shock, word, versus, news); his own saved layouts and font files live in IndexedDB
  `patter-thumb`. A cut out is cropped to the person (`trimToSubject`) and sits on the bottom of its layout place
  (`L.box`, `L.sit`); moving it by hand drops the box.
* **Fonts** (`dev/src/fontlib.js` `FontLib`, list `src/gfonts.js` made by `dev/fontlist.py` from google-font-metadata):
  every Google Font (about 1,900, free for any use) in a Canva style chooser (`FontLib.picker`: search, Great for
  thumbnails, favourites, recent, kinds, each name drawn in its font as it scrolls into view). A font's latin woff2 comes
  from cdn.jsdelivr.net/fontsource the first time it is used and is kept in IndexedDB `patter-fonts`. Video text can use
  them too (`font: 'g:Family|700'` in layers.js, "More fonts…"). The export helpers get every loaded font (and his own
  font files, `FontLib.addFace`) from `forWorkers()` through `fontList` in render.js: a web font the helpers cannot get
  turns parallel export off, so route any new font loading through FontLib. Test: `tests/fonts_ui.py`.
* **Background removal** (`Cutout`): BiRefNet lite (MIT, github.com/emoro24/birefnet-lite-onnx v2, float16 1024) run with
  ONNX Runtime Web 1.20.1 in a worker, WebGPU first, else the processor. Files in `cutout/` (model split in two for
  GitHub), downloaded once into IndexedDB `patter-cutout`. After the model: a guided filter on the picture's brightness
  so the mask follows real edges at full size (only where the model was unsure), a trim of faint haze, and blur fusion
  foreground colours (Forte and Pitie) so no halo of the old background is left. A layer's `cut` is `{ mask, fg, on }`
  (two CutMedia PNGs); `edge` softens or pulls the edge in, `outline` is a sticker edge from an exact distance transform.
  Fix by hand paints Keep or Remove on the mask (red shows removed), then `Cutout.refine` redoes the colours. Tidy stray
  bits keeps the main body. On the processor the model is very slow (minutes) and memory hungry: his PC uses the
  graphics card. **His app runs from a file** (the launcher writes it into a file:// page), so helpers cannot open blob:
  links the page makes: the runtime goes to the helper as text, its glue as a data: module (with `import.meta.url` swapped
  for a fixed address) and the wasm as `wasmBinary`. `tests/thumb_cut_file.py` checks that. Tests: `tests/thumb_cut.py` (serves `dev/tmp_cutout/`, a copy with a full precision model because
  SwiftShader WebGPU here has no 16 bit floats), `tests/thumb_ui.py`.
* **Shapes** (`dev/src/thumb_shapes.js` `ThumbShapes`): he found plain straight shapes "spectacularly basic". Curved, swoosh,
  loop and hand drawn arrows, scribbled circle, ring, underline, cross, tick, brush stroke, speech, shout and thought
  bubbles, boom, burst, star, heart and the basics, each a ready look in `PRESETS` (the Shapes drawer). A shape is a list
  of outlines (ribbons along smooth curves for strokes), each filled in turn so parts never cut holes in each other; the
  outline is drawn fat behind the fill; `fill2` gradient, `depth`/`depthC` 3D extrusion, `shine`, `bend`, `thick`,
  `rough` (low frequency wobble, `seed`), `tail`. Words have 3D depth too (`depth: { d, c }`), `slant` (degrees, each line leans
  from its baseline) and any layer `grit` (brush edges: `gritty` moves the edge by a noise field stretched along the stroke).
  He wanted the heavy slanted, rough edged red words with a brush swipe under them: Text has Brush slam (with a swipe),
  Shapes has Brush swipe (`swipe`). The remover warms up
  (`Cutout.warm`) 1.5 s after the tab opens, so the first cut out is quick.
* He asked for the Basic Logic channel's thumbnail style. Do not make layouts or test pictures that mock people for race
  or religion.

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
* He tried a sound library linked to a folder on his computer and had it taken out: Edge asks permission every session
  and he did not want that. He keeps his sounds on his computer and imports them (Audio, + Import sound). Do not bring
  back folder access.
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
  cores (`Render.cutPool`, worker messages `cutinit`/`cutframe`) draw every moment without his footage ahead of time (the
  intro too since November 2026: `cutinit` readies `Intro` and his bottle label) and hand back ImageBitmaps; the page draws
  the footage moments and the old cone intro (`Video.pageOnlyAt`) and keeps the order. The export canvas is a graphics card
  canvas (`willReadFrequently: false`) because it feeds the encoder. After an export, "Copy the export report"
  (`CutExport.report`) gives where the time went: ask him for it when exports feel slow. The encoder is fed on its
  `dequeue` signal (Windows timers fire late), and `pickVideo` tries the codec with the graphics chip and on the processor,
  best quality and fast modes, once per computer and size (`patter-enc:` in localStorage), keeping the quickest. AAC is
  asked for at 256 then 192, 160, 128 kbps (Windows offers at most 192).
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
* **Editing on the timeline** (November 2026, he wanted CapCut's ease): every clip with sound has a volume line (`envelope`
  in cut_ui.js, an SVG per sound clip; `dbY`/`yDb` map dB to height, 0 dB a third down): drag it (moves every volume point
  together when there are some), double click it to add a point (`kf.vol`), drag points, double click to remove. Round
  handles in the top corners: sound clips set `fadeIn`/`fadeOut`, picture clips set the picture fade `vfIn`/`vfOut`
  (`vfCol` 'white' or black; on the main track it dips to that colour, on overlays to see through; `vfSound !== false`
  fades the sound too: `Video.picFade`, `cut_audio.js` `clipGain`). The Transitions drawer has Fade from/to black and
  white tiles (drop on a clip's start or end half). Keyframes show as one diamond per moment (`keyDiamonds`): click goes
  there, drag moves every setting keyed there, right click sets the ease (io, lin, in, out, hold), Delete removes. The
  playhead snaps to keyframes. Trimming picks the end by pointer position (up to 10 px), ignores the edges of clips that
  move with it as snap points, and the zoom fits once then stays put (re-fitting mid-drag was what cut clips short); moves
  run once per frame. The playhead line can be dragged over a clip's middle (a plain click there still selects the clip).
  Everything in the library drags (sound effects, text and stickers, other projects' files), onto the timeline or the
  picture (`dropThing`). Test: `tests/cut_timeline_edit.py` (24 real mouse steps).
* **Professional transitions** (November 2026, he found the first ones novice and approved these from a preview): `Video.PRO`
  is what the library and the transition panel offer first (whoosh left, right, up, down `swL..swD`, `whip2`, `punch`,
  `spinB`, `smash`, `glitch2`, `stretch`, `cover`, `leak`, `burn`, `ink`, then fade and dips); the older ones sit under
  "Simple ones" and stay so old videos play (`punchOut` is hidden). `TRLEN` is each one's starting length. `mblur` draws
  motion blur from sub frame samples spaced a few pixels apart (14 at most live, 48 in exports, `trHQ`) with a light blur
  to melt the steps; `transition(g, A, B, kind, p, W, H, { dur, hq })`. Tiles play on hover (`animIcon`). No sounds on
  transitions: he did not want them.
* **Transitions and effects, quality pass** (November 2026: "the quality of CapCut"). `tests/fx_sheet.py OUT [port] [kinds]`
  makes contact sheets of every transition (six moments) and effect between two real pictures (`FX_A=studio` for the dark
  room; judge on light pictures, gaps hide on dark ones); `tests/fx_clip.py PORT OUT [fx]` makes frames at speed for a
  before and after clip (serve the old build on 8766). What was wrong and what it is now:
  * Motion blur was up to 14 copies of the picture laid along the move: echoes of the lettering. `strip` (two pictures side
    by side seen through a sliding window, halved along the slide until the blur is a pixel and a half, stretched back) is
    a true smear for anything that slides (whooshes, whip, stretch, pushes); `mblur` (zooms, turns) spaces its copies evenly
    across the shutter in a picture that shrinks as the move grows. Keep both: do not go back to stacked copies.
  * Whooshes shrank each picture about its own middle, leaving dark seams: the pair is one strip pushed in a touch. Spin
    blur showed bare corners: it is scaled to cover at every angle (`cov`). Smash lands big with zoom blur and rattles
    down. Glitch: colour split, slices knocked sideways (from the other clip only round the cut), tearing lines, scan
    lines, a slip that wraps. Film burn is a noise map eaten from the edges (`burnNoise`) with scorch, a hot ragged rim and
    the new picture through the holes (it was a white out). Ink runs off in smooth drips (it was a zigzag). The simple
    ones: eased (`e2`), wipes and circle soft edged (`masked`), pushes and slides blurred, spin covers its corners.
  * Shader effects (`cut_gl.js`): glitch in bands of changing height with their colours pulled apart; VHS with a tracking
    band, head switching tear, colour bleed; old film with scratches that last and drift, dust and gate weave (not a new
    full height line each frame); glow from two rings sized to the picture; light leak with two drifting lights and a
    streak. Camera shake has quick jolts on a slow sway and is pushed in so the edge never shows.
* Transitions on the timeline: drag the diamond to another cut to move it (Ctrl or Alt copies), drag the ends of its
  striped bar along the top of the overlap to change its length, click an empty diamond to add a fade.
* Timeline drawing: one canvas per track (`.ct-strips`, first in each lane) paints every clip's body, filmstrip and
  waveform for the part near the screen; the clip boxes are see-through (`.st`) on top. Do not go back to a canvas per clip:
  hundreds of canvases made the browser composite every frame (110 ms a frame with 500 clips, 17 ms now).
* **Filmstrips on Patter clips** (`TH` in cut_ui.js, `Video.thumb`, `thumbTime`): Story, charts, news, [ME] parts and the
  rest show small pictures of themselves along the bar, like footage does. Each is the clip's own content at its own time
  (keyed by the clip's settings stamp, worked out once per `build`, and a time bucket that follows the zoom), drawn a few
  at a time in idle moments (`requestIdleCallback`, 8 ms slices, never while playing or dragging), kept (about 25 MB at
  most, least recently used go first) and redrawn when pictures they needed arrive (`tickSig`). A kind that is slow to draw
  (`TH.cost` over 45 ms: the maps in headless) gets one picture per clip; [ME] parts share one per 8 seconds of the take.
  The paint signature uses `lightSig` (a clip without its `cfg`) plus the stamp: never stringify a whole clip per paint.
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
  a level curve. `fromText` times a script with no recording. See "Every word pinned" below for how it is kept in step.
* **Every word pinned to where it is heard** (November 2026; he asked for the mouth and the movements "lined up perfectly"
  to imported audio). Measured on his own minute of talking (`dev/tmp_me.wav`, gitignored, his recording of 12 November)
  against a PocketSphinx forced alignment (pip `pocketsphinx`, a measuring stick only, never in the app): the old search put
  two words in five more than 100 ms out and whole words in the wrong phrase (median 165 ms, worst 4 s), because loud,
  hissy and voiced cannot tell one word from another in fast natural speech. Now:
  * `Listen` reads when each word was said from the decoder's own cross attention (`withAttention` adds three inner
    results of the same `dec.onnx` to its outputs as it loads, by appending to the protobuf: no new download; `HEADS` are
    Whisper's timing heads for base.en; `wordTimes` is OpenAI's timing.py: normalise, median 7, mean, DTW). The table
    `{ words: [[text, t0, t1]], text }` is kept per recording (`Listen.heard(id)`, IndexedDB key `heard:` + id,
    `keepHeard`, which calls `LipSync.forget`). Spans are loose: a pause is heard as part of the word after it (or the word
    before, when that ends a clause), and it moves on early from long words.
  * `LipSync.pinWords` matches the script's words to the heard words in order (so words he corrects, adds or cuts still
    find their place), gives each word its span with room either side (`PIN_*`; a word may run into the next word's span),
    moves a span past a pause inside it or back from a pause it ends in (`quiet`: 0.2 s or more under `PIN_QUIET`), and
    `align(ft, words, win)` searches only inside. Under 30 in a hundred words matched means the script is not this
    recording: no pinning, and the panel says so.
  * `learn`: two more passes with the voice's own sounds (a Gaussian per kind of sound on twelve cepstra, from the frames
    the pass before gave it). Helps without the listener too (flite test 133 to 30 ms).
  * Times are the middle of each frame's window (`MID`), the mouth leads by `LEAD` (40 ms), `tidy` thins shapes by what
    the eye needs (`RANK`: lips shut and teeth on lip always kept and given two frames, vowels next, tongue sounds first to
    go), `toSound` shuts the mouth where a placed word cannot be heard and reads shapes from the sound where there is
    speech with no word.
  * `Character.ensureHeard` listens to a recording by itself, in the background, the first time it is used once the helper
    is downloaded (the script is never changed by it), `prepare` waits for it so exports use it, and the Voice card says
    which it is ("Every word is lined up…", "Roughly lined up", "does not match") with a "Get exact lip sync" button when
    the helper is not there. The helper lets go of its models 90 s after the last listen.
  * Results: his recording, word starts against the reference: median 165 to about 20 ms, mean 547 to about 60, worst
    4 s to 0.5 s. Speech with known word times (`dev/tmp_gt1.wav`, `tmp_gt2.wav`: flite word by word, joined with known
    gaps): mean 133 and 40 ms to 20 and 18. Without the listener real speech still slips by seconds in places.
  * Nods and hand beats reach their low point about 10 ms before the loudest moment of the stressed word (they were 30 ms
    after); the bake already takes the springs' lag off. The preview's voice follows the picture's clock by playing a
    shade faster or slower (`tickSound`, the freshest of the last 15 clock readings; it used to allow 120 ms either way).
  * Tests: `tests/char_sync.py` (the whole flow in the panel with his recording, then the voice against the picture),
    `tests/char_timing.js` (runjs: nods and beats against the stresses), `tests/lipsync_heard.py` (listen then line up,
    saves both), `tests/lipsync_pin.py` (line up inside saved heard words, `PIN=before,after,quiet,next,own` to try
    settings), `tests/lipsync_dump.py` (no listener), `tests/listen_run.py`, `tests/char_clip.py` (frames for a preview
    clip from any build). Fixtures: `tmp_me.wav`, `tmp_heard_me.json`, `tmp_gt*.wav`, `tmp_lshome/` (links to `listen/`
    and `cutout/`), `tmp_hands/sheet.png`.
  * Not done, needs his go ahead: a phone level aligner (SoundSwallower, MIT, about 10 MB, PocketSphinx for the browser)
    would tighten the timing inside quick phrases further. Do not run or add it without asking.
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
* **Voice driven performance** (November 2026, Phase 1 of his review: "the most important thing"): `dev/src/prosody.js`
  (`Prosody`: pitch track, autocorrelation plus Viterbi, his median about 97 Hz; word prominence from pitch, loudness and
  length; accents; intonation phrases and arousal), `dev/src/semantics.js` (`Semantics.read`: word classes, Glasgow forms
  too, per sentence question, negation, valence, swearing). `LipSync.analyse` annotates `A.pros`. `perfOf` in character.js
  plans hands, nods (on pitch accents), head shakes (negation), brows, gaze, blinks, posture shifts (`pose.sit`, painted in
  puppet.js) and mood per sentence when there are no mood tags (`cfg.autoEmo`), then `bake` springs every channel at 60 fps
  (`SPR`). Science is cited in the code comments.
* **Hands** (he judged three versions): raised all the time with the open hand and made up gestures was "so unnatural";
  only desk beats was "barely moves". What he approved: a thought (phrase unit) brings the left hand up loosely curled
  (`talk`, his relaxed drawing, the 'collection' rest) beating on the stresses, a palm up (`offer`) on laying a point out,
  shrug, point on a stressed you, counting, desk bang when raging, at least `BIG_GAP` seconds apart; down on the desk at the
  end of the thought; leftover phrases get small desk beats (`desk`). One talking hand per unit (`unit.art`), a hand's turn
  follows its drawing and drawings shorter than 0.2 s are skipped (`p.bk.art`): his relaxed and open hands swapping in
  mid air read as a glitch. The open (back of hand) drawing is not used automatically. Thumbs down was dropped (a mirrored
  hand). Missing shapes he could draw: side on (chop) and pinch.
* **A fourth version he turned down** (19 November 2026). He said the right hand lying still was "very robotic", so both
  hands were made to share the work (left, right, both, the second hand joining in or leaving early, more beats, a resting
  hand that shifts). He watched the before and after and said "I actually prefer the hands before". The hands above stay
  as they are. That work is kept on the branch `hands-pass` (with its checks `tests/char_hands_use.js` and
  `tests/char_hands_trace.py`): do not publish or merge it, and do not rebuild it unless he asks. If the hands come up
  again, ask what he wants changed before building, and change little. What put him off, in his words: "the unnatural
  movement and yeah a bit too much".
* **Listen** (`dev/src/listen.js`, `listen/`, about 180 MB, IndexedDB `patter-listen`): Whisper base English int8 ONNX in a
  helper writes the words from his recording, so a voiceover alone drives the character ("Write the words from the
  recording"). Tests serve `dev/tmp_lshome/{listen,cutout}` through `window.PATTER_LISTEN`. A PatterScript file can be
  loaded as the script (`fromPatterScript`).
* Its voice is `soundId` (a CutMedia id), so the clip plays and exports with sound in the Video tab (`cut_audio.js`
  `clipSound`, `CutExport` waits on `Character.prepare`). Tests: `tests/puppet_read.py`, `char_ui.py`, `char_hands.py`,
  `tests/char_motion.js` (runjs: every continuous part of the pose frame by frame).

### The animator programme (November 2026, on the branch `animator-pass`: NOT published until he says "publish")

He asked (26 November): "I want to be able to drop in an audio clip into it, and have it fully animate the avatar to the
Standard of a professional animation, so that no adjustments are needed whatsoever when I export the clip... The number
one thing is for it to be natural, so you have creative permission to do whatever you need to... If you need to make new
drawings for any part, you have control". He was sent a before and after of his own recording at the end. If he comes
back on one part, change that part and keep the rest. Measuring tools: `dev/tests/charkit/` (see its README).
* **What was wrong on the published build** (looked at frame by frame and traced 60 times a second): the face was rigid
  between swapped drawings (a flat head, lids that only blink, a mouth that only swaps); a blink was one frame of shut
  eye; the body stood still under a moving head; a mood sat on a whole long sentence; inside a word the mouth lost its
  vowels and W glides ("way" was 300 ms of pucker, "one" had no vowel) and chattered wide teeth on every N and K; a new
  recording needed three steps when a script was already there; and the same recording was performed differently each
  time it was brought in.
* **A face rig in `Puppet.draw`** (no new drawings were needed: his own are moved). `pose.turn` [x, y] px: the features
  slide over the head as it turns and nods, the nose furthest, then mouth, eyes, brows (`FZ`), so the flat head reads as
  round (front, up and down views; not the profiles). `pose.lid` -1..1: the upper lids taller or shorter from their top
  edge (`LID_DOWN`, `LID_UP`): wide eyed, narrowed, and the in betweens of a blink (down over 45 ms before, easing open
  until a quarter second after; the blink drawing is still the shut eye, 95 ms). `pose.jaw` 0..1: everything under the
  top of the mouth is let down a little (`JAW`, 8.5 in a hundred at most) so the chin drops with an open vowel.
  **The jaw is two clipped passes straight from his pictures** (above the seam untouched, below it stretched from the
  seam; `band` leaves out pictures wholly across the seam). Do not draw the head on its own surface first: that changed
  4 in a hundred of its pixels the moment the jaw moved, a pop in sharpness at every phrase (the surface is kept only
  for the red face). His nose is its own layer (`role` nose).
* **In `character.js`**: `lidT`, `jawT` and `gz` are sprung like the rest (`SPR` ld, jw, gz). Lids follow the brows, the
  mood and where he looks; the jaw follows the mouth shape's opening (`OPEN`) and the loudness; on a big glance the eyes
  lead and the head follows a little (`gz`). The trunk carries some of the head (`pose.sit` from head x and tilt). He
  breathes in where the recording does (`A.breaths` from LipSync: chest and a small lift of the head). Brows do not
  rise as a matched pair (`q.as`). A mood found by `planMoods` starts at the phrase holding its cause (the swear, the
  good news, the doubt) when the sentence is longer than 2.6 s, not at the sentence's first word. The chance in a
  performance is seeded from the recording's loudness (`A._sig`), so the same recording is always performed the same way
  ("Different wee movements" still changes it).
* **Lip sync, driven by what the eye can see.** (1) `dev/src/lexicon.js` (`LEXICON`, about 6,400 words, 104 KB, made by
  `dev/lexgen.js` from the CMU Pronouncing Dictionary, licence in `dev/assets/cmudict-LICENSE`): how common words are
  really said, kept only for the words whose visible sounds the spelling rules get wrong; looked up after his hand list
  `EX` and before `spell()`. (2) `retime` and `share`: inside a word the sounds between sure edges (a hiss, a lip
  closure, the word's ends) share the time by what each needs (`WANT`) and the loudness, vowels on the loud frames.
  (3) Sounds nobody sees (K, G, hard C, N, NG, H: `inv`) get no drawing: the vowel after starts early or the shape before
  is held. (4) `tidy`: every shape is held two frames (`MIN2`, `MIN1`), lips shut and W puckers are always kept, a vowel
  takes time from a tongue sound and never from closed lips. (5) A short quiet gap inside a phrase and a quiet vowel show
  his small opening R, not D: **his D and S drawings are the same wide clenched grin** (R is the smallest opening,
  Neutral and M the same closed line). (6) An L (tongue up) or an R (lips drawn in) just short of its two frames takes
  them from a vowel beside it that can spare them; quicker than that it goes (asking `share` for five frames for them
  cost a closed M and some vowels on his recording, so it does not). On his recording against the PocketSphinx reference: vowels shown as a vowel 87
  to 98 in a hundred, the right vowel shape 55 to 83, lips shut on M B P 87 to 93; word timing unchanged (median about
  25 ms).
* **One step** (`takeVoice`, `writeWords`, `settle`, `wireDrop`): a recording added, picked or dropped anywhere on the
  tab is listened to, its words become the script, every word is lined up and the performance planned, with a status
  pill on the preview meanwhile; an export waits (`prepare`, `exportWithSound`). A script that is already this
  recording's (`sameWords`: six in ten of the heard words in order) is kept with his tags and fixes; anything else is
  replaced (Undo brings it back). **The listening helper must be on the computer** (one download, his click: "Get exact
  lip sync"). Without it the sample script is cleared and he moves to the sound alone: mouth from the sound, nods,
  blinks, and (new) his talking hand, planned from stand in words made of the beats of the voice (`SW` in `perfOf`).
* **Exports draw him the same in every frame** (`Puppet.exporting`, `Puppet.steady`, `steadyWait` in render.js and the
  same in cut_export.js): he is drawn from copies of his pictures made to size in the background, and a frame made
  before they arrived was drawn from the full pictures, so his outlines changed by a hair a few frames into every
  export (2 in a hundred pixels at 1080p, on each helper at its own moment). An export frame that had to start without
  them now waits and is drawn again. `tests/char_steady.js` holds it to not one pixel.
* **Hands were left exactly as he approved them** (one talking hand a thought; see above). No resting hand shifts, no new
  gestures, no new drawings. SoundSwallower was not used (it still needs his say so).
* Checks: `tests/char_auto.py` (the drop, 10 steps; needs the listening helper served from `dev/tmp_lshome`),
  `tests/char_nowords.js`, `tests/char_steady.js`, `tests/char_motion.js` (now follows lids, jaw, the slide and the trunk
  too), `tests/char_sync.py` (the sample script is now replaced by itself), and the older ones (`char_timing.js`: nods
  reach their low point about 30 ms before the accent now, which reads as on the beat; `char_workers.js '{"n":24}'`,
  `char_damaged.js '{"n":40}'`, `char_ui.py`, `char_studio.py`, `char_hands.py`). Frame time is unchanged within the
  noise here (about 16 ms at 1080p in software).

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

## PatterScript (his phone script writer: patterscript/, built into docs/)

An installable offline web app (PWA) for writing scripts on his Android phone, separate from Patter Studio (November 2026).
Source `patterscript/` (index.html, style.css, app.js, sw.js, manifest), `python3 patterscript/build.py` writes `docs/`
(fonts embedded, icons from his squid logo), served by GitHub Pages from main /docs at https://pattersquid.github.io/Patter-studio/.
Scripts live only on his phone (IndexedDB `patterscript`: scripts, versions, meta), with versions (auto on open, every 5
minutes, before deletes and restores), a 30 day bin and backup files. Long and Short section templates (`SEC`, `TEMPLATE`)
and a structure and pacing checker (`check`) from YouTube retention research; it never comments on the jokes (he asked).
Cues are `[TAG]` or `[TAG: detail]`: upper case shots and edits, lower case character moves using Patter Studio's
Character words. **Send** shares "PatterScript - title.txt": the script as written plus a JSON copy; when he sends one,
build it as a Video tab project as above. **He installs it as an APK** (`docs/PatterScript.apk`): `python3 build.py --apk`
wraps the same files in a small WebView app (`android/`: manifest, icons and hand written smali; the page is served from
https://appassets.androidplatform.net/ by `Client`, Send and Back up go through `PatterAndroid.share` and the `Files`
provider to the share menu, the file picker through `Chrome`). Tools: apktool 2.10.0 and uber-apk-signer 1.3.0 from their
GitHub releases (he approved running them), in `$APK_TOOLS` (default /tmp/apktools). The signing key `key/patterscript.jks`
is NOT in the repo (gitignored): he keeps the copy Claude sent him. Ask him to attach it before making an update, sign
with it and bump `APK_VERSION`, or the update will not install over his copy (a reinstall would lose his scripts).
Google's Android SDK downloads are blocked here, so there is no emulator: test in Chromium.

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
