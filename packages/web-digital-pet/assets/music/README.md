# Web soundtrack

The web shell plays these FamiTracker 2A03 arrangements by **BgmManJX**:

| Asset | Song | Arrangement | Download published by the arranger |
| --- | --- | --- | --- |
| `butter-fly.mp3` | Butter-Fly — Hidenori Chiwata | [Video](https://www.youtube.com/watch?v=9JqWx3915KA) | [MP3](https://drive.google.com/file/d/1feExFrhqPn8S6cPyuSuAa3N5L9svJRv9/view) |
| `brave-heart.mp3` | Brave Heart — Michihiko Ota | [Video](https://www.youtube.com/watch?v=7AD6tzBvBzU) | [MP3](https://drive.google.com/file/d/1bp8apbhBWj_fzyn3ofE-H1Gi0RL9Rt6h/view) |

Downloaded on 2026-10-11 from the links in the arranger's video descriptions.
The supplied 192 kbps MP3s are full songs. The game uses edited musical loops:

| Asset | Decoded duration | Size | Source start sample | Loop samples | Gain |
| --- | --- | --- | --- | --- | --- |
| `butter-fly.mp3` | 23.4667 s | 271,030 bytes | 8,546,095 | 1,034,880 | 0.3117420971 |
| `brave-heart.mp3` | 46.6667 s | 515,814 bytes | 6,607,238 | 2,058,000 | 0.3146103323 |

Offsets refer to the decoded original MP3 at 44.1 kHz. The cuts use recurring
musical phrases (16 bars for Butter-Fly and 28 bars for Brave Heart). Spectral
comparison with their next occurrence establishes the return point, rather than
truncating at an arbitrary elapsed time. A 20 ms half-sine crossfade blends the
outgoing tail into the audio immediately **before** the opening downbeat. It
preserves the phrase's duration and avoids a fade to silence on each repetition.

Both channels of each original are identical. Mono retains the original sound
without redundant channels. A 20 Hz high-pass removes DC, and a constant gain
leaves headroom without compressing dynamics. The output uses LAME VBR quality 4
at 44.1 kHz, with the Xing/LAME header retaining encoder delay and end padding
information. Chrome decodes the intended loop length. The native WebKit media
player tested with an iPhone profile ignores that trimming information and
introduces about 180 ms of silence when the HTML audio element restarts. The
musical edit preserves continuity, but seamless playback in that engine still
requires a playback change; the MP3 metadata alone does not solve it.
Together the assets are 786,844 bytes, 85% smaller than the previous full-song
assets (5,239,653 bytes), and stay below the existing offline cache limit.

To recreate the assets from the original downloads, run this function with
FFmpeg (including `libmp3lame`) available on the command line:

```sh
make_music_loop() {
  local music_source="$1" music_target="$2" music_start="$3" music_length="$4" music_gain="$5"
  local music_end=$((music_start + music_length)) music_fade=882
  ffmpeg -v error -y -i "${music_source}" -filter_complex \
    "[0:a]highpass=f=20,aformat=sample_fmts=flt:channel_layouts=mono,asplit=3[body][tail][head]; \
     [body]atrim=start_sample=${music_start}:end_sample=$((music_end - music_fade)),asetpts=PTS-STARTPTS[b]; \
     [tail]atrim=start_sample=$((music_end - music_fade)):end_sample=${music_end},asetpts=PTS-STARTPTS[t]; \
     [head]atrim=start_sample=$((music_start - music_fade)):end_sample=${music_start},asetpts=PTS-STARTPTS[h]; \
     [t][h]acrossfade=ns=${music_fade}:c1=hsin:c2=hsin[join]; \
     [b][join]concat=n=2:v=0:a=1,volume=${music_gain}[out]" \
    -map '[out]' -c:a libmp3lame -q:a 4 -ar 44100 -ac 1 -write_xing 1 -map_metadata -1 "${music_target}"
}
make_music_loop butter-fly-original.mp3 butter-fly.mp3 8546095 1034880 0.3117420971
make_music_loop brave-heart-original.mp3 brave-heart.mp3 6607238 2058000 0.3146103323
```

These third-party music assets retain their respective owners' rights; the
repository's Apache-2.0 license applies to its code, not these recordings.

Music starts after a user gesture, loops using a single HTML audio element,
changes with battle presentation, and pauses when the app leaves the foreground.
Both tracks are precached with the web app. The shell, not the shared pet renderer
or the game domain, owns playback and the browser's sound preference.
