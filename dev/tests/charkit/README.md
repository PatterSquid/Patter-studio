# Measuring his character (the animator programme, November 2026)

Tools for looking at a performance without ears or eyes on a screen. They read the fixtures every Character test
uses (`dev/tmp_puppet.puppet`, `dev/tmp_hands/sheet.png`, a recording such as `dev/tmp_me.wav` with what was heard in
`dev/tmp_heard_me.json`), all private and gitignored. Serve the build being measured on 8765 and, to compare, the
published build on 8766 from a worktree with the same fixtures linked in.

* `trace.py PORT out.json [wav] [heard.json] [cfg json]`: every moving part of the pose 60 times a second for the whole
  recording (head, trunk, brows, lids, jaw, the features' slide, pupils, breathing, both arms, mouth shape, view), with
  the words, the mouth shapes and their times, the moves planned, blinks, nods, phrases and breaths. Give a heard file
  that does not exist (`/nothing.json`) for the path with no words.
* `plot.py out.png t0 t1 trace.json:label ...`: channels of one or more traces over a stretch, one above another.
* `vis.py trace.json t0 t1`: the words in a stretch with the mouth shapes shown during each and when.
* `vscore.py trace.json ...`: the mouth against a sound by sound reference of his recording (`dev/tmp_ref_ps.json`,
  made by `psalign.py` with PocketSphinx from pip: a measuring stick only, never in the app). Reports vowels shown as a
  vowel, the right vowel shape, mouths shut on a vowel, lips shut on M B P, teeth on lip for F V, how well the opening
  follows the loudness, how many shapes there are and how long they last, and (needing no reference) how often the mouth
  is shut while he can clearly be heard.
* `psalign.py wav16k text out.json`: makes that reference (ffmpeg the recording to 16 kHz mono first).
* `clip.py PORT OUTDIR [t0] [t1] [fps]`: frames drawn by the module itself (`W` width, `CROP` a part of the frame as
  fractions, `CFG` settings over the defaults, `WAV`, `HEARD`), for a before and after clip or a close look.
* `sheet.py DIR out.jpg start step count [cols] [crop] [width]`: those frames as a contact sheet with their times.
* `pops.py DIR`: frame to frame change of rendered frames in the head and in the hands' part of the picture; lists
  single frames that change far more than their neighbours (a jump).
* `hplot.py out.png t0 t1 trace.json[:label] ...`: the left hand over a stretch (wrist up and across, turn, its speed,
  changes of drawing) against the loudness, the words and the nods. `hstat.py trace.json ...`: how much of the time a
  raised hand is held dead still, how fast it moves, the turn at a change of drawing.

Published build (2026.11.19.3) against the programme, his own minute of talking: vowels shown as a vowel 87 to 98 in
a hundred, the right shape 55 to 85, lips shut on M B P 87 to 93, shut while clearly heard 9 times to none, shapes 252
(median 101 ms) to 239 (120 ms).
