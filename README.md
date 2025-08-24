MusePlayer — Web Music Player
=============================

Project structure
-----------------

Place your assets as follows:

- /music: MP3/OGG files, e.g. /music/song1.mp3
- /images: Album art images, e.g. /images/song1.jpg
- /lyrics: LRC or JSON lyrics files, e.g. /lyrics/song1.lrc
- /data/songs.json: Playlist metadata for all songs

Run locally
----------

Use any static server. Examples:

1) Python 3: `python3 -m http.server 5173 --bind 0.0.0.0`
2) Node: `npx http-server -p 5173 .`

Then open: http://localhost:5173/

Adding 100+ songs
-----------------

1) Name files consistently using a stable `id`:
   - Music: /music/<id>.mp3
   - Cover: /images/<id>.jpg
   - Lyrics: /lyrics/<id>.lrc (or .json)

2) For each song, add an entry in `/data/songs.json`:

```
{
  "id": "song003",
  "title": "Your Title",
  "artist": "Singer Name",
  "cover": "/images/song003.jpg",
  "src": "/music/song003.mp3",
  "lyrics": "/lyrics/song003.lrc"
}
```

3) Lyrics format options:
   - LRC: each line prefixed with `[mm:ss.ms]` timestamps
   - JSON: `{ "lines": [{ "timeMs": 12345, "text": "lyric" }, ...] }`

4) Visual animations: already enabled via Web Audio API visualizer. Album art has a subtle pulse animation while playing.

5) Optional enhancements suggestions:
   - Favorites: track song ids in `localStorage` and add a ⭐ button per track
   - Search: already included; filters by title or artist
   - Volume visualizer: current bars visualizer can be swapped for waveform
   - Keyboard shortcuts: space/play-pause, arrows for seek/volume, n/p next/prev

Responsive & Themes
-------------------

- Fully responsive layout for desktop/tablet/mobile
- Toggle dark/light via the moon/sun button (persisted in localStorage)

Notes
-----

- The app loads `/data/songs.json`. If that file is missing, two sample fallback songs are used.
- For cross-origin audio, ensure all files are served from the same origin.