# Web soundtrack

The web shell plays these FamiTracker 2A03 arrangements by **BgmManJX**:

| Asset | Song | Arrangement | Download published by the arranger |
| --- | --- | --- | --- |
| `butter-fly.mp3` | Butter-Fly — Hidenori Chiwata | [Video](https://www.youtube.com/watch?v=9JqWx3915KA) | [MP3](https://drive.google.com/file/d/1feExFrhqPn8S6cPyuSuAa3N5L9svJRv9/view) |
| `brave-heart.mp3` | Brave Heart — Michihiko Ota | [Video](https://www.youtube.com/watch?v=7AD6tzBvBzU) | [MP3](https://drive.google.com/file/d/1bp8apbhBWj_fzyn3ofE-H1Gi0RL9Rt6h/view) |

Downloaded on 2026-10-11 from the links in the arranger's video descriptions.
The supplied 192 kbps MP3s are full songs. The game uses edited musical loops:

| Asset | Original interval | Duration | Size | Source start sample | Loop samples | Gain |
| --- | --- | --- | --- | --- | --- | --- |
| `butter-fly.mp3` | 0:18–1:21 | 63 s | 712,560 bytes | 793,800 | 2,778,300 | 0.3007277846 |
| `brave-heart.mp3` | 0:30–1:27 | 57 s | 631,091 bytes | 1,323,000 | 2,513,700 | 0.3003601134 |

Offsets refer to the decoded original MP3 at 44.1 kHz, not the previous edited
assets. These are the requested song intervals. A 60 ms half-sine crossfade
blends the outgoing tail into the audio immediately **before** the selected
start, preserving the interval's duration. The first and last 3 ms taper to zero
to suppress boundary clicks after MP3 encoding. Those tapers do not add a pause
or a long fade between repetitions. Encoded padding can add less than 1 ms to
the decoded duration depending on the decoder.

Both channels of each original are identical. Mono retains the original sound
without redundant channels. A 20 Hz high-pass removes DC, and a constant gain
leaves headroom without compressing dynamics. The output uses LAME VBR quality 4
at 44.1 kHz, with the Xing/LAME header retaining encoder delay and end padding
information. Chrome decodes the intended loop length. The native WebKit media
player tested with an iPhone profile ignores that trimming information and
introduces roughly 180–300 ms of silence when the HTML audio element restarts. The
musical edit preserves continuity, but seamless playback in that engine still
requires a playback change; the MP3 metadata alone does not solve it.
Together the assets are 1,343,651 bytes, 74% smaller than the previous full-song
assets (5,239,653 bytes), and stay below the existing offline cache limit.

To recreate the assets from the original downloads, run this function with
FFmpeg (including `libmp3lame`) available on the command line:

```sh
make_music_loop() {
  local music_source="$1" music_target="$2" music_start="$3" music_length="$4" music_gain="$5"
  local music_end=$((music_start + music_length)) music_fade=2646
  local music_taper_start="$6"
  ffmpeg -v error -y -i "${music_source}" -filter_complex \
    "[0:a]highpass=f=20,aformat=sample_fmts=flt:channel_layouts=mono,asplit=3[body][tail][head]; \
     [body]atrim=start_sample=${music_start}:end_sample=$((music_end - music_fade)),asetpts=PTS-STARTPTS[b]; \
     [tail]atrim=start_sample=$((music_end - music_fade)):end_sample=${music_end},asetpts=PTS-STARTPTS[t]; \
     [head]atrim=start_sample=$((music_start - music_fade)):end_sample=${music_start},asetpts=PTS-STARTPTS[h]; \
     [t][h]acrossfade=ns=${music_fade}:c1=hsin:c2=hsin[join]; \
     [b][join]concat=n=2:v=0:a=1,volume=${music_gain},apad=whole_len=${music_length},\
atrim=end_sample=${music_length},asetpts=N/SR/TB,afade=t=in:st=0:d=0.003:curve=hsin,\
afade=t=out:st=${music_taper_start}:d=0.003:curve=hsin[out]" \
    -map '[out]' -c:a libmp3lame -q:a 4 -ar 44100 -ac 1 -write_xing 1 -map_metadata -1 "${music_target}"
}
make_music_loop butter-fly-original.mp3 butter-fly.mp3 793800 2778300 0.3007277846 62.997
make_music_loop brave-heart-original.mp3 brave-heart.mp3 1323000 2513700 0.3003601134 56.997
```

These third-party music assets retain their respective owners' rights; the
repository's Apache-2.0 license applies to its code, not these recordings.

Music starts after a user gesture, loops using a single HTML audio element,
changes with battle presentation, and pauses when the app leaves the foreground.
Both tracks are precached with the web app. The shell, not the shared pet renderer
or the game domain, owns playback and the browser's sound preference.
