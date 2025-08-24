/* MusePlayer - Web Music Player
 * Features: playlist (100+ ready), play/pause/next/prev, shuffle, repeat, volume, seek,
 * synced lyrics (LRC/JSON), WebAudio visualizer, responsive UI, theme toggle, search.
 */

// ---------- Data & Configuration ----------
const SONGS_DATA_URL = "/data/songs100.json"; // 100-song playlist
const LYRICS_DIR = "/lyrics"; // songId.lrc or songId.json
const MUSIC_DIR = "/music"; // songId.mp3
const IMAGES_DIR = "/images"; // songId.jpg/png

// Repeat mode: off | all | one
let repeatMode = "off";
let isShuffle = false;
let isUserSeeking = false;

// State
let playlist = [];
let filteredPlaylist = [];
let currentIndex = 0;
let lyrics = []; // [{timeMs, text}]
let activeLyricIndex = -1;

// DOM
const audio = document.getElementById("audio");
const playlistEl = document.getElementById("playlist");
const coverImage = document.getElementById("coverImage");
const trackTitleEl = document.getElementById("trackTitle");
const trackArtistEl = document.getElementById("trackArtist");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const muteBtn = document.getElementById("muteBtn");
const volumeRange = document.getElementById("volumeRange");
const progressRange = document.getElementById("progressRange");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const lyricsList = document.getElementById("lyricsList");
const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("searchInput");
const albumArt = document.getElementById("albumArt");

// Visualizer
const visualizerCanvas = document.getElementById("visualizer");
const vizCtx = visualizerCanvas.getContext("2d");
let audioContext, sourceNode, analyserNode, dataArray;

// ---------- Initialization ----------
init();

async function init() {
  restoreTheme();
  bindUIEvents();
  await loadSongs();
  renderPlaylist();
  loadSongByIndex(0);
}

function bindUIEvents() {
  playPauseBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", playPrev);
  nextBtn.addEventListener("click", playNext);
  shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleBtn.setAttribute("aria-pressed", String(isShuffle));
  });
  repeatBtn.addEventListener("click", () => {
    repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    repeatBtn.dataset.mode = repeatMode;
  });
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    muteBtn.textContent = audio.muted ? "🔇" : "🔈";
  });
  volumeRange.addEventListener("input", () => {
    audio.volume = Number(volumeRange.value) / 100;
  });
  progressRange.addEventListener("input", () => {
    isUserSeeking = true;
  });
  progressRange.addEventListener("change", () => {
    const seekRatio = Number(progressRange.value) / Number(progressRange.max);
    audio.currentTime = seekRatio * (audio.duration || 0);
    isUserSeeking = false;
  });
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  audio.addEventListener("ended", onTrackEnded);
  themeToggle.addEventListener("click", toggleTheme);
  searchInput.addEventListener("input", onSearch);
  window.addEventListener("resize", resizeCanvas);
}

// ---------- Playlist & Data ----------
async function loadSongs() {
  try {
    const res = await fetch(SONGS_DATA_URL);
    const data = await res.json();
    playlist = data.songs;
    filteredPlaylist = playlist;
  } catch (e) {
    console.error("Failed to load songs.json", e);
    playlist = getFallbackSongs();
    filteredPlaylist = playlist;
  }
}

function getFallbackSongs() {
  return [
    {
      id: "song1",
      title: "Sample Song 1",
      artist: "Sample Artist",
      cover: `${IMAGES_DIR}/song1.jpg`,
      src: `${MUSIC_DIR}/song1.mp3`,
      lyrics: `${LYRICS_DIR}/song1.lrc`
    },
    {
      id: "song2",
      title: "Sample Song 2",
      artist: "Another Artist",
      cover: `${IMAGES_DIR}/song2.jpg`,
      src: `${MUSIC_DIR}/song2.mp3`,
      lyrics: `${LYRICS_DIR}/song2.lrc`
    }
  ];
}

function renderPlaylist() {
  playlistEl.innerHTML = "";
  filteredPlaylist.forEach((song, index) => {
    const li = document.createElement("li");
    li.dataset.index = String(index);
    li.addEventListener("click", () => {
      loadSongByIndex(index);
      play();
    });
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = song.cover;
    img.alt = `${song.title} cover`;
    const meta = document.createElement("div");
    meta.className = "meta";
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = song.title;
    const a = document.createElement("div");
    a.className = "artist";
    a.textContent = song.artist;
    const dur = document.createElement("div");
    dur.className = "duration";
    dur.textContent = ""; // optional: precomputed duration
    meta.appendChild(t); meta.appendChild(a);
    li.appendChild(img); li.appendChild(meta); li.appendChild(dur);
    playlistEl.appendChild(li);
  });
  highlightActivePlaylistItem();
}

function highlightActivePlaylistItem() {
  [...playlistEl.children].forEach(li => li.classList.remove("active"));
  const active = playlistEl.children[currentIndex];
  if (active) active.classList.add("active");
}

function onSearch() {
  const q = searchInput.value.trim().toLowerCase();
  filteredPlaylist = playlist.filter(s =>
    s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );
  renderPlaylist();
}

// ---------- Loading Tracks ----------
async function loadSongByIndex(index) {
  if (index < 0 || index >= filteredPlaylist.length) return;
  currentIndex = index;
  const song = filteredPlaylist[currentIndex];
  audio.src = song.src;
  trackTitleEl.textContent = song.title;
  trackArtistEl.textContent = song.artist;
  coverImage.src = song.cover;
  coverImage.onload = () => { coverImage.style.display = "block"; };
  coverImage.onerror = () => { coverImage.style.display = "none"; };
  albumArt.classList.add("pulse-bg");

  await setupVisualizer();

  await loadLyrics(song.lyrics);
  renderLyrics();
  activeLyricIndex = -1;
  highlightActivePlaylistItem();
}

function play() {
  audio.play();
  playPauseBtn.textContent = "⏸️";
  playPauseBtn.setAttribute("aria-pressed", "true");
}
function pause() {
  audio.pause();
  playPauseBtn.textContent = "▶️";
  playPauseBtn.setAttribute("aria-pressed", "false");
}
function togglePlay() {
  if (audio.paused) play(); else pause();
}

function playPrev() {
  if (isShuffle) {
    playRandom();
    return;
  }
  const nextIndex = currentIndex - 1;
  if (nextIndex < 0) {
    if (repeatMode === "all") {
      loadSongByIndex(filteredPlaylist.length - 1);
      play();
    }
  } else {
    loadSongByIndex(nextIndex);
    play();
  }
}

function playNext() {
  if (isShuffle) {
    playRandom();
    return;
  }
  const nextIndex = currentIndex + 1;
  if (nextIndex >= filteredPlaylist.length) {
    if (repeatMode === "all") {
      loadSongByIndex(0);
      play();
    } else {
      pause();
    }
  } else {
    loadSongByIndex(nextIndex);
    play();
  }
}

function playRandom() {
  if (filteredPlaylist.length <= 1) return;
  let r;
  do { r = Math.floor(Math.random() * filteredPlaylist.length); } while (r === currentIndex);
  loadSongByIndex(r);
  play();
}

function onTrackEnded() {
  if (repeatMode === "one") {
    audio.currentTime = 0; play(); return;
  }
  playNext();
}

function onLoadedMetadata() {
  durationEl.textContent = formatTime(audio.duration || 0);
}

function onTimeUpdate() {
  currentTimeEl.textContent = formatTime(audio.currentTime || 0);
  if (!isUserSeeking && audio.duration) {
    const ratio = (audio.currentTime / audio.duration);
    progressRange.value = String(Math.floor(ratio * Number(progressRange.max)));
  }
  syncLyrics();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Lyrics (LRC or JSON) ----------
async function loadLyrics(url) {
  lyrics = [];
  if (!url) return;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (url.endsWith('.json')) {
      const json = JSON.parse(text);
      lyrics = (json.lines || []).map(l => ({ timeMs: Number(l.timeMs) || 0, text: String(l.text || '') }));
    } else {
      lyrics = parseLRC(text);
    }
    lyrics.sort((a,b)=>a.timeMs-b.timeMs);
  } catch (e) {
    console.warn("No lyrics or failed to load lyrics", e);
  }
}

function parseLRC(lrc) {
  const lines = lrc.split(/\r?\n/);
  const out = [];
  const timeRe = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
  for (const line of lines) {
    let text = line.replace(timeRe, "").trim();
    let m;
    while ((m = timeRe.exec(line)) !== null) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const ms = Number((m[3]||"0").padEnd(3, '0'));
      const timeMs = (min*60 + sec)*1000 + ms;
      out.push({ timeMs, text });
    }
  }
  return out;
}

function renderLyrics() {
  lyricsList.innerHTML = "";
  for (const line of lyrics) {
    const li = document.createElement('li');
    li.textContent = line.text || "";
    lyricsList.appendChild(li);
  }
}

function syncLyrics() {
  if (!lyrics.length) return;
  const nowMs = (audio.currentTime || 0) * 1000;
  let i = activeLyricIndex;
  if (i < 0 || i >= lyrics.length - 1 || nowMs < lyrics[i].timeMs || nowMs >= lyrics[i+1].timeMs) {
    i = findLyricIndex(nowMs);
    if (i !== activeLyricIndex) {
      setActiveLyric(i);
    }
  }
}

function findLyricIndex(timeMs) {
  let low = 0, high = lyrics.length - 1, ans = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics[mid].timeMs <= timeMs) { ans = mid; low = mid + 1; } else { high = mid - 1; }
  }
  return ans;
}

function setActiveLyric(index) {
  if (index < 0) return;
  if (activeLyricIndex >= 0) {
    const prev = lyricsList.children[activeLyricIndex];
    if (prev) prev.classList.remove('active');
  }
  activeLyricIndex = index;
  const el = lyricsList.children[index];
  if (el) {
    el.classList.add('active');
    const container = lyricsList.parentElement;
    const top = el.offsetTop - container.clientHeight/2 + el.clientHeight/2;
    container.scrollTo({ top, behavior: 'smooth' });
  }
}

// ---------- Visualizer ----------
async function setupVisualizer() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sourceNode) sourceNode.disconnect();
    if (!analyserNode) {
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
    }
    await audioContext.resume();
    const track = audioContext.createMediaElementSource(audio);
    sourceNode = track;
    sourceNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    resizeCanvas();
    requestAnimationFrame(drawVisualizer);
  } catch (e) {
    console.warn('Visualizer setup failed', e);
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  visualizerCanvas.width = visualizerCanvas.clientWidth * ratio;
  visualizerCanvas.height = visualizerCanvas.clientHeight * ratio;
  vizCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawVisualizer() {
  if (!analyserNode) return;
  analyserNode.getByteFrequencyData(dataArray);
  const w = visualizerCanvas.clientWidth;
  const h = visualizerCanvas.clientHeight;
  vizCtx.clearRect(0, 0, w, h);
  const barWidth = Math.max(2, Math.floor(w / 64));
  const step = Math.floor(dataArray.length / Math.floor(w / barWidth));
  for (let i = 0, x = 0; i < dataArray.length; i += step) {
    const v = dataArray[i] / 255; // 0..1
    const barHeight = v * h;
    const grad = vizCtx.createLinearGradient(0, h - barHeight, 0, h);
    grad.addColorStop(0, 'rgba(90,169,255,0.9)');
    grad.addColorStop(1, 'rgba(138,90,255,0.7)');
    vizCtx.fillStyle = grad;
    vizCtx.fillRect(x, h - barHeight, barWidth - 1, barHeight);
    x += barWidth;
  }
  requestAnimationFrame(drawVisualizer);
}

// ---------- Theme ----------
function toggleTheme() {
  const root = document.body;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('muse.theme', next);
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
}
function restoreTheme() {
  const saved = localStorage.getItem('muse.theme');
  if (saved) {
    document.body.setAttribute('data-theme', saved);
    themeToggle.textContent = saved === 'dark' ? '🌙' : '☀️';
  }
}

// ---------- Keyboard Shortcuts ----------
document.addEventListener('keydown', (e) => {
  if (e.target === searchInput) return;
  switch (e.key) {
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': audio.currentTime = Math.min(audio.duration||0, audio.currentTime + 5); break;
    case 'ArrowLeft': audio.currentTime = Math.max(0, audio.currentTime - 5); break;
    case 'ArrowUp': volumeRange.value = String(Math.min(100, Number(volumeRange.value) + 5)); audio.volume = Number(volumeRange.value)/100; break;
    case 'ArrowDown': volumeRange.value = String(Math.max(0, Number(volumeRange.value) - 5)); audio.volume = Number(volumeRange.value)/100; break;
    case 'n': playNext(); break;
    case 'p': playPrev(); break;
    case 's': isShuffle = !isShuffle; shuffleBtn.setAttribute('aria-pressed', String(isShuffle)); break;
    case 'r': repeatBtn.click(); break;
  }
});

