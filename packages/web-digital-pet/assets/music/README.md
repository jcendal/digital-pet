# Web soundtrack

The web shell plays these FamiTracker 2A03 arrangements by **BgmManJX**:

| Asset | Song | Arrangement | Download published by the arranger |
| --- | --- | --- | --- |
| `butter-fly.mp3` | Butter-Fly — Hidenori Chiwata | [Video](https://www.youtube.com/watch?v=9JqWx3915KA) | [MP3](https://drive.google.com/file/d/1feExFrhqPn8S6cPyuSuAa3N5L9svJRv9/view) |
| `brave-heart.mp3` | Brave Heart — Michihiko Ota | [Video](https://www.youtube.com/watch?v=7AD6tzBvBzU) | [MP3](https://drive.google.com/file/d/1bp8apbhBWj_fzyn3ofE-H1Gi0RL9Rt6h/view) |

Downloaded on 2026-10-11 from the links in the arranger's video descriptions.
The supplied 192 kbps MP3s were re-encoded with LAME VBR quality 5, retaining
44.1 kHz stereo, to keep each below the existing 4 MiB offline cache limit.
These third-party music assets retain their respective owners' rights; the
repository's Apache-2.0 license applies to its code, not these recordings.

Music starts after a user gesture, loops using a single HTML audio element,
changes with battle presentation, and pauses when the app leaves the foreground.
Both tracks are precached with the web app. The shell, not the shared pet renderer
or the game domain, owns playback and the browser's sound preference.
