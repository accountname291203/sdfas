document.addEventListener("DOMContentLoaded", async function () {
  const audio = new Audio();
  const DEFAULT_MUSIC_PROVIDER_KEY = "default_music_provider";
  const RESULTS_PER_PAGE = 15;

  let currentService =
    localStorage.getItem(DEFAULT_MUSIC_PROVIDER_KEY) || "tidal";
  let playlistSearchService = currentService;

  let currentQuery = "";
  let currentOffset = 0;
  let isLoading = false;
  let hasMore = true;
  let trackQueue = [];
  let currentTrackIndex = -1;
  let isSeeking = false;
  let isRepeatActive = false;
  let animationFrameId = null;
  let hls = new Hls();
  let searchTimeout;

  let currentLyrics = [];
  let activeLyricIndex = -1;
  let lyricsAvailable = false;
  let isManualScroll = false;
  let manualScrollTimeout = null;
  let activeScrollAnimation = null;

  let isPlaylistLocked = true;
  let isQueueLocked = true;

  const wrapper = document.getElementById("wrapper");
  const rightBox = document.getElementById("rightBox");

  const lyricsButton = document.getElementById("lyricsButton");
  const lyricsContainer = document.getElementById("lyricsContainer");
  const lyricsContent = document.getElementById("lyricsContent");

  lyricsButton.addEventListener("click", () => {
    wrapper.classList.toggle("lyrics-mode");
    if (wrapper.classList.contains("lyrics-mode") && activeLyricIndex !== -1) {
      setTimeout(() => scrollToActiveLyric(true), 450);
    }
  });

  function handleManualScroll() {
    if (!lyricsAvailable) return;

    if (activeScrollAnimation) {
      cancelAnimationFrame(activeScrollAnimation);
      activeScrollAnimation = null;
    }

    isManualScroll = true;
    lyricsContainer.classList.add("manual-mode");

    clearTimeout(manualScrollTimeout);
    manualScrollTimeout = setTimeout(() => {
      isManualScroll = false;
      lyricsContainer.classList.remove("manual-mode");
      scrollToActiveLyric(true);
    }, 2000);
  }

  lyricsContainer.addEventListener("wheel", handleManualScroll, {
    passive: true,
  });
  lyricsContainer.addEventListener("touchmove", handleManualScroll, {
    passive: true,
  });

  const coverArt = document.getElementById("coverArt");
  const musicIcon = document.getElementById("musicIcon");
  const songTitle = document.getElementById("songTitle");
  const songArtist = document.getElementById("songArtist");
  const nowPlayingHeart = document.getElementById("nowPlayingHeart");

  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const loadingMore = document.getElementById("loadingMore");
  const serviceButtonIcon = document.getElementById("serviceButtonIcon");

  const playPauseButton = document.getElementById("playPauseButton");
  const playIcon = playPauseButton.querySelector("i");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  const repeatButton = document.getElementById("repeatButton");
  const muteButton = document.getElementById("muteButton");

  const progressBar = document.getElementById("progressBar");
  const currentTime = document.getElementById("currentTime");
  const duration = document.getElementById("duration");
  const eqVisualizer = document.getElementById("eqVisualizer");
  const eqBars = document.querySelectorAll(".eq-bar");

  const modalOverlay = document.getElementById("modalOverlay");
  const modalButton = document.getElementById("modalButton");
  const dropdownOverlay = document.getElementById("dropdownOverlay");
  const serviceDropdown = document.getElementById("serviceDropdown");

  const openPlaylistsBtn = document.getElementById("openPlaylistsBtn");
  const openQueueBtn = document.getElementById("openQueueBtn");
  const backToSearchBtn = document.getElementById("backToSearchBtn");
  const backToSearchFromQueueBtn = document.getElementById(
    "backToSearchFromQueueBtn"
  );

  const createPlaylistBtn = document.getElementById("createPlaylistBtn");
  const backToPlaylistsBtn = document.getElementById("backToPlaylistsBtn");
  const toggleEditModeBtn = document.getElementById("toggleEditModeBtn");
  const addSongToPlaylistBtn = document.getElementById("addSongToPlaylistBtn");
  const backToEditorBtn = document.getElementById("backToEditorBtn");
  const finishAddingSongsBtn = document.getElementById("finishAddingSongsBtn");
  const playlistSearchInput = document.getElementById("playlistSearchInput");
  const playlistSearchResults = document.getElementById(
    "playlistSearchResults"
  );
  const playlistServiceBtn = document.getElementById("playlistServiceBtn");

  const playlistLoadingMore = document.getElementById("playlistLoadingMore");
  const loopButton = document.getElementById("loopButton");
  const lockPlaylistBtn = document.getElementById("lockPlaylistBtn");
  const shufflePlaylistBtn = document.getElementById("shufflePlaylistBtn");
  const lockQueueBtn = document.getElementById("lockQueueBtn");

  let currentPlaylistContext = null;
  let playlistSearchQuery = "";
  let playlistSearchOffset = 0;
  let playlistSearchLoading = false;
  let playlistSearchHasMore = true;

  let selectedTracks = new Map();

  const Playlists = {
    data: JSON.parse(localStorage.getItem("arcora_playlists")) || [],

    save() {
      localStorage.setItem("arcora_playlists", JSON.stringify(this.data));
    },

    initFavorites() {
      if (!this.get("favorites")) {
        this.data.unshift({
          id: "favorites",
          title: "Favorites",
          description:
            "Add songs to your favorites by clicking the heart icon.",
          color: "#D4AF37",
          tracks: [],
        });
        this.save();
      }
    },

    create() {
      const newId = Date.now().toString();
      const newPlaylist = {
        id: newId,
        title: "New Playlist",
        description: "",
        color: "#6AA5C9",
        tracks: [],
      };
      this.data.push(newPlaylist);
      this.save();
      return newPlaylist;
    },

    get(id) {
      return this.data.find((p) => p.id === id);
    },

    delete(id) {
      if (id === "favorites") return;
      this.data = this.data.filter((p) => p.id !== id);
      this.save();
    },

    update(id, updates) {
      if (id === "favorites") return;
      const p = this.get(id);
      if (p) {
        Object.assign(p, updates);
        this.save();
      }
    },

    addTrack(id, track) {
      const p = this.get(id);
      if (p) {
        if (!p.tracks.some((t) => t.id === track.id)) {
          p.tracks.push(track);
          this.save();
        }
      }
    },

    removeTrack(id, index) {
      const p = this.get(id);
      if (p) {
        p.tracks.splice(index, 1);
        this.save();
      }
    },

    removeTrackById(id, trackId) {
      const p = this.get(id);
      if (p) {
        p.tracks = p.tracks.filter((t) => t.id !== trackId);
        this.save();
      }
    },

    reorderTracks(id, oldIndex, newIndex) {
      const p = this.get(id);
      if (p) {
        const item = p.tracks.splice(oldIndex, 1)[0];
        p.tracks.splice(newIndex, 0, item);
        this.save();
      }
    },

    isFavorite(trackId) {
      const p = this.get("favorites");
      return p ? p.tracks.some((t) => t.id === trackId) : false;
    },
  };

  Playlists.initFavorites();

  function switchView(hideId, showId) {
    document.getElementById(hideId).classList.remove("view-active");
    document.getElementById(hideId).classList.add("view-hidden");
    setTimeout(() => {
      document.getElementById(showId).classList.remove("view-hidden");
      document.getElementById(showId).classList.add("view-active");
    }, 100);
  }

  openPlaylistsBtn.addEventListener("click", () => {
    renderPlaylistList();
    switchView("searchView", "playlistListView");
  });
  backToSearchBtn.addEventListener("click", () => {
    switchView("playlistListView", "searchView");
  });

  openQueueBtn.addEventListener("click", () => {
    renderQueue();
    switchView("searchView", "queueView");
  });
  backToSearchFromQueueBtn.addEventListener("click", () => {
    switchView("queueView", "searchView");
  });

  createPlaylistBtn.addEventListener("click", () => {
    const newPlaylist = Playlists.create();

    renderPlaylistDetailView(newPlaylist.id, true);
    switchView("playlistListView", "playlistDetailView");
  });

  function renderPlaylistList() {
    const container = document.getElementById("playlistListContainer");
    Array.from(container.children).forEach((child) => {
      if (child.id !== "createPlaylistBtn") child.remove();
    });

    Playlists.data.forEach((playlist) => {
      const el = document.createElement("div");
      el.className = "result-item";

      const isFav = playlist.id === "favorites";
      const icon = isFav ? "ri-heart-fill" : "ri-play-list-2-fill";

      el.innerHTML = `
        <div class="result-art" style="background-color: ${playlist.color}">
            <i class="${icon}"></i>
        </div>
        <div class="result-text">
            <div class="result-title">${playlist.title}</div>
            <div class="result-artist">${playlist.tracks.length} Songs</div>
        </div>
        ${
          !isFav
            ? `<i class="ri-close-line remove-track-btn" title="Delete Playlist"></i>`
            : ""
        }
      `;

      el.addEventListener("click", (e) => {
        if (!e.target.classList.contains("remove-track-btn")) {
          renderPlaylistDetailView(playlist.id, false);
          switchView("playlistListView", "playlistDetailView");
        }
      });

      if (!isFav) {
        el.querySelector(".remove-track-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Delete this playlist?")) {
            Playlists.delete(playlist.id);
            el.remove();
          }
        });
      }

      container.appendChild(el);
    });
  }

  function renderPlaylistDetailView(id, isEditMode) {
    currentPlaylistContext = id;
    const playlist = Playlists.get(id);
    if (!playlist) return;

    const isFav = id === "favorites";

    const viewModeDiv = document.getElementById("playlistViewMode");
    const editModeDiv = document.getElementById("playlistEditMode");

    if (isFav) {
      toggleEditModeBtn.style.display = "none";
      addSongToPlaylistBtn.style.display = "none";
      isEditMode = false;
    } else {
      toggleEditModeBtn.style.display = "block";
      addSongToPlaylistBtn.style.display = "flex";
    }

    if (playlist.tracks.length <= 1) {
      shufflePlaylistBtn.classList.add("disabled");
    } else {
      shufflePlaylistBtn.classList.remove("disabled");
    }

    if (isEditMode && !isFav) {
      viewModeDiv.style.display = "none";
      editModeDiv.style.display = "flex";
      toggleEditModeBtn.className = "ri-check-line playlist-edit-toggle";
      toggleEditModeBtn.title = "Save";
      toggleEditModeBtn.style.color = "var(--accent)";

      const titleInput = document.getElementById("playlistTitleInput");
      const descInput = document.getElementById("playlistDescInput");
      titleInput.value = playlist.title;
      descInput.value = playlist.description || "";

      titleInput.oninput = () =>
        Playlists.update(id, { title: titleInput.value });
      descInput.oninput = () =>
        Playlists.update(id, { description: descInput.value });

      renderColorPicker(id, playlist.color);
    } else {
      viewModeDiv.style.display = "flex";
      editModeDiv.style.display = "none";
      toggleEditModeBtn.className = "ri-pencil-line playlist-edit-toggle";
      toggleEditModeBtn.title = "Edit Playlist";
      toggleEditModeBtn.style.color = "";

      document.getElementById("playlistTitleDisplay").textContent =
        playlist.title;
      document.getElementById("playlistTitleDisplay").style.color =
        playlist.color;
      document.getElementById("playlistColorDot").style.backgroundColor =
        playlist.color;
      document.getElementById("playlistDescDisplay").textContent =
        playlist.description || "";
    }

    toggleEditModeBtn.onclick = () => {
      renderPlaylistDetailView(id, !isEditMode);
    };

    renderPlaylistTracks(id);
  }

  function renderColorPicker(id, currentColor) {
    const colors = [
      "#FFB3BA",
      "#FFDFBA",
      "#FFFFBA",
      "#BAFFC9",
      "#BAE1FF",
      "#E05D5D",
      "#F5A623",
      "#F1C40F",
      "#2ECC71",
      "#1ABC9C",
      "#3498DB",
      "#9B59B6",
      "#E91E63",
      "#7B241C",
      "#7D6608",
      "#145A32",
      "#154360",
      "#4A235A",
      "#34495E",
      "#7F8C8D",
      "#D35400",
      "#C0392B",
      "#8E44AD",
    ];
    const container = document.getElementById("colorPickerContainer");
    container.innerHTML = "";

    colors.forEach((c) => {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = c;
      if (currentColor === c) swatch.classList.add("selected");

      swatch.addEventListener("click", () => {
        document
          .querySelectorAll(".color-swatch")
          .forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
        Playlists.update(id, { color: c });
      });
      container.appendChild(swatch);
    });
  }

  backToPlaylistsBtn.addEventListener("click", () => {
    renderPlaylistList();
    switchView("playlistDetailView", "playlistListView");
  });

  function renderPlaylistTracks(id) {
    const list = document.getElementById("playlistTracksList");
    list.innerHTML = "";
    const playlist = Playlists.get(id);

    if (playlist.tracks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-msg";
      empty.textContent = "No songs yet.";
      list.appendChild(empty);
    }

    playlist.tracks.forEach((track, index) => {
      const el = document.createElement("div");
      el.className = "result-item";
      el.dataset.index = index;

      const artworkHtml = track.artwork
        ? `<img src="${track.artwork}" onerror="this.parentElement.innerHTML = '<i class=\\'ri-music-2-fill\\' style=\\'color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;\\'></i>';">`
        : '<i class="ri-music-2-fill" style="color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;"></i>';

      el.innerHTML = `
        <div class="result-art">${artworkHtml}</div>
        <div class="result-text">
          <div class="result-title">${track.title}</div>
          <div class="result-artist">${track.artist}</div>
        </div>
        <i class="ri-close-line remove-track-btn" title="Remove Song"></i>
      `;

      el.addEventListener("click", (e) => {
        if (!e.target.classList.contains("remove-track-btn")) {
          trackQueue = [...playlist.tracks];
          loadAndPlayTrack(index);
        }
      });

      el.querySelector(".remove-track-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        Playlists.removeTrack(id, index);
        renderPlaylistTracks(id);
      });
      list.appendChild(el);
    });

    if (list._sortable) list._sortable.destroy();
    list._sortable = Sortable.create(list, {
      animation: 150,
      disabled: isPlaylistLocked,
      onEnd: function (evt) {
        if (playlist.tracks.length > 0) {
          Playlists.reorderTracks(id, evt.oldIndex, evt.newIndex);
        }
      },
    });

    if (isPlaylistLocked) {
      list.classList.remove("reorder-enabled");
    } else {
      list.classList.add("reorder-enabled");
    }
  }

  function renderQueue() {
    const list = document.getElementById("queueListContainer");
    list.innerHTML = "";

    if (trackQueue.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-msg";
      empty.textContent = "No songs are playing.";
      list.appendChild(empty);
      return;
    }

    const currentlyPlaying = trackQueue[currentTrackIndex];

    if (currentlyPlaying) {
      const el = createQueueItem(currentlyPlaying, currentTrackIndex, true);
      list.appendChild(el);
    }

    const upcomingTracks = trackQueue.slice(currentTrackIndex + 1);

    if (upcomingTracks.length > 0 || currentlyPlaying) {
      const divider = document.createElement("div");
      divider.className = "queue-divider";
      list.appendChild(divider);
    }

    if (upcomingTracks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-msg";
      empty.textContent = "No more songs in queue.";
      list.appendChild(empty);
    } else {
      upcomingTracks.forEach((track, i) => {
        const actualIndex = currentTrackIndex + 1 + i;
        const el = createQueueItem(track, actualIndex, false);
        list.appendChild(el);
      });
    }

    if (list._sortable) list._sortable.destroy();
    list._sortable = Sortable.create(list, {
      animation: 150,
      disabled: isQueueLocked,
      filter: ".playing-now, .queue-divider, .empty-state-msg",
      onEnd: function (evt) {
        const offset = currentTrackIndex + 1;
        const itemsList = Array.from(list.children).filter(
          (el) =>
            el.classList.contains("result-item") &&
            !el.classList.contains("playing-now")
        );
        const newUpcomingQueue = itemsList.map(
          (el) => trackQueue[parseInt(el.dataset.index)]
        );

        const newQueue = [
          ...trackQueue.slice(0, currentTrackIndex + 1),
          ...newUpcomingQueue,
        ];

        trackQueue = newQueue;
        renderQueue();
      },
    });

    if (isQueueLocked) {
      list.classList.remove("reorder-enabled");
    } else {
      list.classList.add("reorder-enabled");
    }
  }

  function createQueueItem(track, index, isPlayingNow) {
    const el = document.createElement("div");
    el.className = "result-item";
    if (isPlayingNow) el.classList.add("playing-now");
    el.dataset.index = index;

    const artworkHtml = track.artwork
      ? `<img src="${track.artwork}" onerror="this.parentElement.innerHTML = '<i class=\\'ri-music-2-fill\\' style=\\'color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;\\'></i>';">`
      : '<i class="ri-music-2-fill" style="color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;"></i>';

    el.innerHTML = `
      <div class="result-art">${artworkHtml}</div>
      <div class="result-text">
        <div class="result-title">${track.title}</div>
        <div class="result-artist">${track.artist}</div>
      </div>
      ${
        !isPlayingNow
          ? `<i class="ri-close-line remove-track-btn" title="Remove Song"></i>`
          : `<i class="ri-volume-up-fill" style="color: var(--accent); margin-right: 10px; font-size: 1.2rem;"></i>`
      }
    `;

    el.addEventListener("click", (e) => {
      if (!e.target.classList.contains("remove-track-btn")) {
        loadAndPlayTrack(index);
        renderQueue();
      }
    });

    if (!isPlayingNow) {
      el.querySelector(".remove-track-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        trackQueue.splice(index, 1);
        if (currentTrackIndex > index) currentTrackIndex--;
        renderQueue();
      });
    }
    return el;
  }

  shufflePlaylistBtn.addEventListener("click", () => {
    if (!currentPlaylistContext) return;
    const playlist = Playlists.get(currentPlaylistContext);
    if (!playlist || playlist.tracks.length <= 1) return;

    let tracks = [...playlist.tracks];

    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    if (
      tracks.length > 1 &&
      trackQueue[currentTrackIndex] &&
      tracks[0].id === trackQueue[currentTrackIndex].id
    ) {
      [tracks[0], tracks[1]] = [tracks[1], tracks[0]];
    }

    trackQueue = tracks;
    loadAndPlayTrack(0);
  });

  lockQueueBtn.addEventListener("click", () => {
    isQueueLocked = !isQueueLocked;
    if (isQueueLocked) {
      lockQueueBtn.className = "ri-lock-line playlist-edit-toggle";
      lockQueueBtn.style.color = "";
      lockQueueBtn.title = "Rearrange Locked";
    } else {
      lockQueueBtn.className = "ri-lock-unlock-line playlist-edit-toggle";
      lockQueueBtn.style.color = "var(--accent)";
      lockQueueBtn.title = "Rearrange Enabled";
    }
    renderQueue();
  });

  addSongToPlaylistBtn.addEventListener("click", () => {
    playlistSearchInput.value = "";
    document.getElementById("playlistSearchResults").innerHTML = "";
    playlistServiceBtn.className = "ri-soundcloud-line action-icon";
    selectedTracks.clear();
    updateFinishBtnVisibility();

    playlistSearchService = currentService;
    updatePlaylistServiceIcon(playlistSearchService);

    switchView("playlistDetailView", "playlistAddSongView");
  });

  backToEditorBtn.addEventListener("click", () => {
    renderPlaylistDetailView(currentPlaylistContext, false);
    switchView("playlistAddSongView", "playlistDetailView");
  });

  finishAddingSongsBtn.addEventListener("click", () => {
    selectedTracks.forEach((track) => {
      Playlists.addTrack(currentPlaylistContext, track);
    });
    selectedTracks.clear();
    renderPlaylistDetailView(currentPlaylistContext, false);
    switchView("playlistAddSongView", "playlistDetailView");
  });

  function updateFinishBtnVisibility() {
    if (selectedTracks.size > 0) {
      finishAddingSongsBtn.style.display = "block";
    } else {
      finishAddingSongsBtn.style.display = "none";
    }
  }

  let playlistSearchTimeout;
  playlistSearchInput.addEventListener("input", () => {
    clearTimeout(playlistSearchTimeout);
    playlistSearchTimeout = setTimeout(() => {
      playlistSearchQuery = playlistSearchInput.value.trim();
      if (playlistSearchQuery) {
        performSearch(playlistSearchQuery, 0, true, true);
      }
    }, 300);
  });

  playlistServiceBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const rect = playlistServiceBtn.getBoundingClientRect();
    serviceDropdown.style.top = `${rect.bottom + 8}px`;
    serviceDropdown.style.right = `${window.innerWidth - rect.right}px`;
    serviceDropdown.classList.add("visible");
    dropdownOverlay.classList.add("visible");
  });

  function updatePlaylistServiceIcon(service) {
    playlistServiceBtn.className = "";
    playlistServiceBtn.classList.add("action-icon");
    playlistServiceBtn.classList.add(getServiceIconClass(service));
  }

  const originalDropdownHandlers =
    serviceDropdown.querySelectorAll(".dropdown-option");
  originalDropdownHandlers.forEach((opt) => {
    opt.addEventListener("click", () => {
      const newService = opt.dataset.service;

      if (
        document
          .getElementById("playlistAddSongView")
          .classList.contains("view-active")
      ) {
        playlistSearchService = newService;
        updatePlaylistServiceIcon(newService);
        if (playlistSearchQuery)
          performSearch(playlistSearchQuery, 0, true, true);
      } else {
        currentService = newService;
        localStorage.setItem(DEFAULT_MUSIC_PROVIDER_KEY, newService);
        updateServiceIcon(newService);
        if (currentQuery) {
          performSearch(currentQuery, 0, true);
        }
      }
    });
  });

  let audioContext = null;
  let analyser = null;
  let source = null;
  let gainNode = null;
  let lastVolume = 1;
  let dataArray = null;
  let isInitialized = false;

  function getServiceIconClass(service) {
    switch (service) {
      case "soundcloud":
        return "ri-soundcloud-line";
      case "tidal":
        return "ri-hd-line";
      default:
        return "ri-music-line";
    }
  }

  function updateServiceIcon(service) {
    serviceButtonIcon.className = "";
    serviceButtonIcon.classList.add("action-icon");
    serviceButtonIcon.classList.add(getServiceIconClass(service));
  }

  function hideDropdowns() {
    dropdownOverlay.classList.remove("visible");
    serviceDropdown.classList.remove("visible");
  }

  function updateEqState(isPlaying) {
    if (isPlaying) {
      eqVisualizer.classList.add("playing");
    } else {
      eqVisualizer.classList.remove("playing");
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  }

  function initializeAudioContext() {
    if (isInitialized) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      gainNode = audioContext.createGain();
      analyser.fftSize = 128;

      analyser.smoothingTimeConstant = 0.65;

      analyser.minDecibels = -90;
      analyser.maxDecibels = -30;

      dataArray = new Uint8Array(analyser.frequencyBinCount);

      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);
      isInitialized = true;
    } catch (e) {
      const style = document.createElement("style");
      style.textContent = `
            @keyframes eq-wave-sym {
                0% { transform: scaleY(0.1); } 
                50% { transform: scaleY(1.0); } 
                100% { transform: scaleY(0.3); }
            }
            .eq-visualizer.playing .eq-bar:nth-child(1) { animation: eq-wave-sym 0.8s 0.0s infinite alternate; }
            .eq-visualizer.playing .eq-bar:nth-child(2) { animation: eq-wave-sym 0.8s 0.2s infinite alternate; }
            .eq-visualizer.playing .eq-bar:nth-child(3) { animation: eq-wave-sym 0.8s 0.4s infinite alternate; }
            .eq-visualizer.playing .eq-bar:nth-child(4) { animation: eq-wave-sym 0.8s 0.1s infinite alternate; }
            .eq-visualizer.playing .eq-bar:nth-child(5) { animation: eq-wave-sym 0.8s 0.3s infinite alternate; }
          `;
      document.head.appendChild(style);
      audio.addEventListener("play", () =>
        eqVisualizer.classList.add("playing")
      );
      audio.addEventListener("pause", () =>
        eqVisualizer.classList.remove("playing")
      );
    }
  }

  function drawVisualizer() {
    if (!audio.paused && audioContext && analyser) {
      analyser.getByteFrequencyData(dataArray);
      const bands = [2, 8, 18, 32, 50];
      const powers = [3, 2.5, 1.5, 1.5, 1.5];
      const mults = [0.8, 1, 1.3, 1.4, 1.5];

      eqBars.forEach((bar, i) => {
        const rawValue = dataArray[bands[i]];
        let normalized = rawValue / 255;

        let scale = Math.pow(normalized, powers[i]) * mults[i];

        const MIN_SCALE = 0.15;
        const MAX_SCALE = 1.0;

        let finalScale = scale * (MAX_SCALE - MIN_SCALE) + MIN_SCALE;
        finalScale = Math.min(finalScale, MAX_SCALE);

        bar.style.transform = `scaleY(${finalScale})`;
      });
    }

    if (!audio.paused) {
      animationFrameId = requestAnimationFrame(drawVisualizer);
    }
  }

  function showModal(content) {
    document.getElementById("modalContent").innerHTML = content;
    modalOverlay.style.display = "flex";
    setTimeout(() => modalOverlay.classList.add("visible"), 10);
  }

  function hideModal() {
    modalOverlay.classList.remove("visible");
    setTimeout(() => (modalOverlay.style.display = "none"), 200);
  }

  modalButton.addEventListener("click", hideModal);

  function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  function createSkeletonLoader() {
    const skeletonDiv = document.createElement("div");
    skeletonDiv.classList.add("skeleton-loader");
    skeletonDiv.id = "dynamicSkeleton";
    for (let i = 0; i < RESULTS_PER_PAGE; i++) {
      const item = document.createElement("div");
      item.classList.add("skeleton-item");
      skeletonDiv.appendChild(item);
    }
    return skeletonDiv;
  }

  function showSkeleton(containerId = "searchResults") {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    container.appendChild(createSkeletonLoader());
    if (containerId === "searchResults") rightBox.classList.add("no-scroll");
    container.scrollTop = 0;
  }

  function hideSkeleton() {
    const skeleton = document.getElementById("dynamicSkeleton");
    if (skeleton) skeleton.remove();
  }

  function resetSearchState() {
    isLoading = false;
    hideSkeleton();
    updateScrollGradients();
  }

  function updateScrollGradients() {
    const isSkeletonVisible = !!document.getElementById("dynamicSkeleton");
    if (isSkeletonVisible || isLoading) {
      rightBox.classList.remove("no-scroll");
      return;
    }

    let activeContainer = searchResults;
    if (
      document
        .getElementById("playlistAddSongView")
        .classList.contains("view-active")
    ) {
      activeContainer = document.getElementById("playlistSearchResults");
    } else if (
      document.getElementById("queueView").classList.contains("view-active")
    ) {
      activeContainer = document.getElementById("queueListContainer");
    }

    const { scrollTop, scrollHeight, clientHeight } = activeContainer;
    const scrollRange = scrollHeight - clientHeight;
    if (scrollRange <= 5) {
      rightBox.classList.add("no-scroll");
      return;
    }
    rightBox.classList.remove("no-scroll");
    if (scrollTop >= scrollRange - 5) {
      rightBox.classList.add("bottom-reached");
    } else {
      rightBox.classList.remove("bottom-reached");
    }
  }

  searchResults.addEventListener("scroll", updateScrollGradients);
  document
    .getElementById("playlistSearchResults")
    .addEventListener("scroll", updateScrollGradients);
  document
    .getElementById("queueListContainer")
    .addEventListener("scroll", updateScrollGradients);

  let thumbTimeout;
  function showThumb() {
    clearTimeout(thumbTimeout);
    if (audio.src) {
      progressBar.classList.add("visible");
    }
  }

  function hideThumbDelayed() {
    clearTimeout(thumbTimeout);
    thumbTimeout = setTimeout(
      () => progressBar.classList.remove("visible"),
      1000
    );
  }

  progressBar.addEventListener("mouseenter", showThumb);
  progressBar.addEventListener("mouseleave", hideThumbDelayed);
  progressBar.addEventListener("mousedown", showThumb);
  progressBar.addEventListener("mouseup", hideThumbDelayed);

  function updateProgressBar(value) {
    const accentColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#6AA5C9";

    const percentage = (value / progressBar.max) * 100;

    progressBar.style.background = `linear-gradient(to right, ${accentColor} ${percentage}%, rgba(255, 255, 255, 0.2) ${percentage}%)`;
    if (!audio.src) {
      progressBar.style.background = "rgba(255, 255, 255, 0.2)";
      progressBar.classList.remove("visible");
    }
  }

  function animateMusicProgressBar() {
    if (audio.paused || isSeeking) {
      return;
    }
    const currentTimeValue = audio.currentTime;
    progressBar.value = currentTimeValue;
    currentTime.textContent = formatTime(currentTimeValue);
    updateProgressBar(currentTimeValue);
    syncLyrics(currentTimeValue);
    requestAnimationFrame(animateMusicProgressBar);
  }

  function togglePlayback() {
    if (!audio.src && trackQueue.length > 0) loadAndPlayTrack(0);
    else if (audio.src) audio.paused ? audio.play() : audio.pause();
  }

  playPauseButton.addEventListener("click", togglePlayback);

  audio.addEventListener("loadedmetadata", () => {
    progressBar.max = audio.duration;
    duration.textContent = formatTime(audio.duration);
    currentTime.textContent = "0:00";
    updateProgressBar(0);
    showThumb();
  });

  audio.addEventListener("play", () => {
    playIcon.className = "ri-pause-circle-fill";
    coverArt.classList.remove("paused");
    const activeLine = document.querySelector(".lyric-line.active");
    if (activeLine) activeLine.classList.remove("paused");
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
    updateEqState(true);
    if (isInitialized && !animationFrameId) drawVisualizer();
    requestAnimationFrame(animateMusicProgressBar);
  });

  audio.addEventListener("pause", () => {
    playIcon.className = "ri-play-circle-fill";
    coverArt.classList.add("paused");
    const activeLine = document.querySelector(".lyric-line.active");
    if (activeLine) activeLine.classList.add("paused");
    updateEqState(false);
  });

  audio.addEventListener("ended", () => {
    if (isRepeatActive) {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    playIcon.className = "ri-play-circle-fill";
    progressBar.value = 0;
    currentTime.textContent = "0:00";
    updateProgressBar(0);
    updateEqState(false);
    skipNextTrack();
  });

  progressBar.addEventListener("mousedown", () => {
    isSeeking = true;
    showThumb();
  });

  progressBar.addEventListener("mouseup", () => {
    isSeeking = false;
    hideThumbDelayed();
    requestAnimationFrame(animateMusicProgressBar);
  });

  progressBar.addEventListener("change", () => {
    audio.currentTime = progressBar.value;
    isSeeking = false;
    syncLyrics(audio.currentTime);
  });

  progressBar.addEventListener("input", () => {
    currentTime.textContent = formatTime(progressBar.value);
    updateProgressBar(progressBar.value);
  });

  function updateNowPlayingHeart(track) {
    if (!track) {
      nowPlayingHeart.className = "ri-heart-line";
      nowPlayingHeart.style.color = "rgba(var(--cb), 0.1)";
      nowPlayingHeart.style.pointerEvents = "none";
      return;
    }

    nowPlayingHeart.style.pointerEvents = "auto";
    const isFav = Playlists.isFavorite(track.id);
    if (isFav) {
      nowPlayingHeart.className = "ri-heart-fill";
      nowPlayingHeart.style.color = "var(--accent)";
      nowPlayingHeart.style.opacity = "1";
    } else {
      nowPlayingHeart.className = "ri-heart-line";
      nowPlayingHeart.style.color = "rgba(var(--cb), 0.6)";
      nowPlayingHeart.style.opacity = "1";
    }
    nowPlayingHeart.onclick = () => {
      if (Playlists.isFavorite(track.id)) {
        Playlists.removeTrackById("favorites", track.id);
      } else {
        Playlists.addTrack("favorites", track);
      }
      updateNowPlayingHeart(track);
      if (
        document
          .getElementById("playlistDetailView")
          .classList.contains("view-active") &&
        currentPlaylistContext === "favorites"
      ) {
        renderPlaylistTracks("favorites");
      }
    };
  }

  function loadAndPlayTrack(index) {
    if (index < 0 || index >= trackQueue.length) return;
    audio.pause();
    audio.src = "";
    updateEqState(false);
    const track = trackQueue[index];
    currentTrackIndex = index;
    const activeItem = document.querySelector(".result-item.active");
    if (activeItem) activeItem.classList.remove("active");

    let newItem = document.getElementById(`track-${track.id}`);
    if (newItem) newItem.classList.add("active");

    if (track.service === "tidal") {
      songTitle.textContent = "Loading track..";
      songArtist.textContent = "Tidal may take ~10s";
    } else {
      songTitle.textContent = track.title;
      songArtist.textContent = track.artist;
    }

    updateNowPlayingHeart(track);

    currentTime.textContent = "0:00";
    duration.textContent = "";
    progressBar.value = 0;
    updateProgressBar(0);
    fetchLyrics(track);

    const existingImg = coverArt.querySelector("img");
    if (existingImg) existingImg.remove();
    musicIcon.style.opacity = "0";

    if (track.artwork) {
      coverArt.classList.add("blur-active");
      const tempImg = document.createElement("img");
      tempImg.src = track.artwork;
      tempImg.onerror = () => {
        musicIcon.className = "ri-music-2-fill";
        musicIcon.style.opacity = "1";
        coverArt.classList.remove("blur-active");
        tempImg.remove();
      };
      const handleLoad = () => {
        setTimeout(() => coverArt.classList.remove("blur-active"), 300);
      };
      tempImg.onload = handleLoad;
      if (tempImg.complete) handleLoad();
      coverArt.insertBefore(tempImg, coverArt.firstChild);
    } else {
      musicIcon.className = "ri-music-2-fill";
      musicIcon.style.opacity = "1";
      setTimeout(() => coverArt.classList.remove("blur-active"), 300);
    }
    playIcon.className = "ri-play-circle-fill";
    if (track.service === "soundcloud") {
      const dlPath = track.url.split("/").slice(-2).join("/");
      fetchSoundCloudStreamUrl(dlPath);
    } else if (track.service === "tidal") {
      fetchTidalStreamUrl(track);
    }
  }

  async function fetchTidalStreamUrl(track) {
    initializeAudioContext();
    let quality = "low";
    if (track.qualities && track.qualities.includes("LOSSLESS"))
      quality = "lossless";
    else if (track.qualities && track.qualities.includes("HIGH"))
      quality = "high";
    try {
      const res = await fetch(
        `${BURLFULL}/worker/music/tidal/download/${quality}/${track.id}`
      );
      const data = await res.json();
      songTitle.textContent = track.title;
      songArtist.textContent = track.artist;
      if (data && data.streamUrl) {
        audio.src = `${BURLFULL}/api/audiox?url=${encodeURIComponent(
          data.streamUrl
        )}`;
        audio.crossOrigin = "anonymous";
        audio.load();
        audio.play().catch(() => (playIcon.className = "ri-play-circle-fill"));
      } else throw new Error("No stream URL");
    } catch (error) {
      showModal("Sorry - playback is not supported for this track.");
      playIcon.className = "ri-play-circle-fill";
    }
  }

  async function fetchSoundCloudStreamUrl(downloadPath) {
    initializeAudioContext();
    try {
      const res = await fetch(
        `${BURLFULL}/worker/music/soundcloud/download/${downloadPath}`
      );
      const data = await res.json();
      if (data && data.streamUrl) {
        audio.src = `${BURLFULL}/api/audiox?url=${encodeURIComponent(
          data.streamUrl
        )}`;
        audio.crossOrigin = "anonymous";
        audio.load();
        audio
          .play()
          .then(() => {
            if (data.warning?.includes("preview"))
              showModal(
                "Only a 30-second preview is available. Switch to Tidal."
              );
          })
          .catch(() => (playIcon.className = "ri-play-circle-fill"));
      }
    } catch (error) {
      showModal("Track not available.");
    }
  }

  function skipNextTrack() {
    if (currentTrackIndex < trackQueue.length - 1)
      loadAndPlayTrack(currentTrackIndex + 1);
  }

  function skipPrevTrack() {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else if (currentTrackIndex > 0) loadAndPlayTrack(currentTrackIndex - 1);
  }

  nextButton.addEventListener("click", skipNextTrack);
  prevButton.addEventListener("click", skipPrevTrack);

  async function fetchLyrics(track) {
    lyricsContent.innerHTML =
      '<div class="lyrics-status-container"><div class="loading-wave"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
    currentLyrics = [];
    activeLyricIndex = -1;
    lyricsAvailable = false;

    try {
      const query = encodeURIComponent(`${track.artist} ${track.title}`);
      const res = await fetch(`${BURLFULL}/api/lyric/search?q=${query}`);
      const data = await res.json();
      let bestMatch = null;
      if (Array.isArray(data) && data.length > 0) {
        bestMatch = data.find(
          (item) =>
            item.syncedLyrics &&
            item.trackName.toLowerCase() === track.title.toLowerCase()
        );
        if (!bestMatch) bestMatch = data[0];
      }

      if (bestMatch && bestMatch.instrumental) {
        lyricsContent.innerHTML = `
                        <div class="lyrics-status-container">
                             <i class="ri-music-2-line"></i>
                             <span>Instrumental</span>
                        </div>
                     `;
      } else if (bestMatch && bestMatch.syncedLyrics) {
        parseLyrics(bestMatch.syncedLyrics);
        renderLyrics();
      } else if (bestMatch && bestMatch.plainLyrics) {
        lyricsContent.innerHTML = `<div class="lyric-line active" style="font-size:1rem; opacity:0.8; white-space: pre-wrap; line-height: 1.6; cursor: default;">${bestMatch.plainLyrics}</div>`;
      } else {
        throw new Error("No lyrics");
      }
    } catch (e) {
      lyricsContent.innerHTML = `
                    <div class="lyrics-status-container">
                         <i class="ri-close-circle-line"></i>
                         <span>No lyrics found</span>
                     </div>
                 `;
    }
  }

  function parseLyrics(lrcText) {
    const lines = lrcText.split("\n");
    const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    currentLyrics = [];
    lines.forEach((line) => {
      const match = line.match(regex);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3].length === 3 ? match[3] : match[3] * 10);
        const time = min * 60 + sec + ms / 1000;
        const text = match[4].trim();

        if (text) currentLyrics.push({ time, text });
      }
    });
  }

  function renderLyrics() {
    lyricsContent.innerHTML = "";
    currentLyrics.forEach((line, index) => {
      const div = document.createElement("div");
      div.className = "lyric-line future";
      div.id = `lyric-${index}`;
      div.textContent = line.text;
      div.addEventListener("click", () => {
        audio.currentTime = line.time;
        isManualScroll = false;
        lyricsContainer.classList.remove("manual-mode");
        clearTimeout(manualScrollTimeout);
        if (audio.paused) audio.play();
      });

      lyricsContent.appendChild(div);
    });
    lyricsAvailable = true;
  }

  function syncLyrics(time) {
    if (!lyricsAvailable || currentLyrics.length === 0) return;
    let newIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
      if (currentLyrics[i].time <= time) newIndex = i;
      else break;
    }
    if (newIndex !== activeLyricIndex) {
      activeLyricIndex = newIndex;
      updateLyricsUI();
      if (!isManualScroll) scrollToActiveLyric();
    }
  }

  function updateLyricsUI() {
    const lines = document.querySelectorAll(".lyric-line");
    lines.forEach((line, index) => {
      line.className = "lyric-line";
      if (index < activeLyricIndex) line.classList.add("past");
      else if (index === activeLyricIndex) {
        line.classList.add("active");
        if (audio.paused) line.classList.add("paused");
      } else {
        line.classList.add("future");
        let dist = index - activeLyricIndex;
        if (dist <= 5) line.classList.add(`future-${dist}`);
      }
    });
  }

  function scrollAnim(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;

    const p1x = 0.25;
    const p1y = 0.1;
    const p2x = 0.25;
    const p2y = 1.0;

    const Ax = 1.0 - 3.0 * p2x + 3.0 * p1x;
    const Bx = 3.0 * p2x - 6.0 * p1x;
    const Cx = 3.0 * p1x;
    const Ay = 1.0 - 3.0 * p2y + 3.0 * p1y;
    const By = 3.0 * p2y - 6.0 * p1y;
    const Cy = 3.0 * p1y;
    function sampleCurve(t_val, A, B, C) {
      return ((A * t_val + B) * t_val + C) * t_val;
    }

    function sampleCurveDerivative(t_val, A, B, C) {
      return (3.0 * A * t_val + 2.0 * B) * t_val + C;
    }

    function getTForX(aX) {
      let guessT = aX;
      for (let i = 0; i < 4; ++i) {
        const currentX = sampleCurve(guessT, Ax, Bx, Cx) - aX;
        if (Math.abs(currentX) < 0.001) {
          return guessT;
        }
        const currentDerivativeX = sampleCurveDerivative(guessT, Ax, Bx, Cx);
        if (Math.abs(currentDerivativeX) < 0.001) {
          break;
        }
        guessT -= currentX / currentDerivativeX;
      }

      let intervalStart = 0.0;
      let intervalEnd = 1.0;
      guessT = aX;
      while (intervalStart < intervalEnd) {
        const currentX = sampleCurve(guessT, Ax, Bx, Cx);
        if (Math.abs(currentX - aX) < 0.001) {
          return guessT;
        }
        if (aX > currentX) {
          intervalStart = guessT;
        } else {
          intervalEnd = guessT;
        }
        guessT = (intervalStart + intervalEnd) / 2.0;
      }
      return guessT;
    }

    const t_bezier = getTForX(t);
    return sampleCurve(t_bezier, Ay, By, Cy);
  }

  function scrollToActiveLyric(force = false) {
    if (activeLyricIndex === -1) return;
    const activeLine = document.getElementById(`lyric-${activeLyricIndex}`);
    if (!activeLine) return;
    const containerHeight = lyricsContainer.clientHeight;
    const lineTop = activeLine.offsetTop;
    const lineHeight = activeLine.clientHeight;
    const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
    const startScrollTop = lyricsContainer.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    if (Math.abs(distance) < 2) return;
    const startTime = performance.now();
    const duration = 400;
    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = scrollAnim(progress);
      lyricsContainer.scrollTop = startScrollTop + distance * ease;
      if (progress < 1) activeScrollAnimation = requestAnimationFrame(step);
      else activeScrollAnimation = null;
    }
    if (activeScrollAnimation) cancelAnimationFrame(activeScrollAnimation);
    activeScrollAnimation = requestAnimationFrame(step);
  }

  function hideAllDropdowns() {
    serviceDropdown.classList.remove("visible");
    dropdownOverlay.classList.remove("visible");
  }

  serviceButtonIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    hideAllDropdowns();
    const rect = serviceButtonIcon.getBoundingClientRect();
    serviceDropdown.style.top = `${rect.bottom + 8}px`;
    serviceDropdown.style.right = `${window.innerWidth - rect.right}px`;
    serviceDropdown.classList.add("visible");
    dropdownOverlay.classList.add("visible");
  });
  dropdownOverlay.addEventListener("click", hideAllDropdowns);

  updateServiceIcon(currentService);

  serviceDropdown.querySelectorAll(".dropdown-option").forEach((option) => {
    option.addEventListener("click", function () {
      const newService = this.dataset.service;
      currentService = newService;
      localStorage.setItem(DEFAULT_MUSIC_PROVIDER_KEY, newService);
      updateServiceIcon(newService);
      hideDropdowns();
      if (currentQuery) {
        showSkeleton();
        isLoading = true;
        currentOffset = 0;
        hasMore = true;

        observer.unobserve(loadingMore);
        loadingMore.style.display = "block";
        performSearch(currentQuery, 0, true);
      }
    });
  });

  function scaleWrapper() {
    const baseHeight = 600,
      baseWidth = 750;
    const scale = Math.min(
      (window.innerWidth * 0.95) / baseWidth,
      (window.innerHeight * 0.95) / baseHeight
    );
    wrapper.style.transform = `scale(${scale})`;
    updateScrollGradients();
  }

  window.addEventListener("resize", () => {
    hideAllDropdowns();
    scaleWrapper();
  });
  scaleWrapper();

  loopButton.addEventListener("click", () => {
    isRepeatActive = !isRepeatActive;

    loopButton.classList.toggle("active", isRepeatActive);
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentQuery = searchInput.value.trim();
      if (currentQuery) {
        showSkeleton();
        isLoading = true;
        currentOffset = 0;
        hasMore = true;
        loadingMore.style.display = "block";
        performSearch(currentQuery, 0, true);
      } else {
        searchResults.innerHTML = "";
        trackQueue = [];
        currentOffset = 0;
        hasMore = true;
        loadingMore.style.display = "none";
        resetSearchState();
      }
    }, 300);
  });

  async function performSearch(
    query,
    offset,
    isNewSearch = false,
    isPlaylistSearch = false
  ) {
    let targetContainer = searchResults;
    let serviceToUse = currentService;

    if (isPlaylistSearch) {
      targetContainer = document.getElementById("playlistSearchResults");
      serviceToUse = playlistSearchService;
    }

    if (isPlaylistSearch) {
      if (!query) return;
      playlistLoadingMore.style.display = "block";
    } else {
      if (!query || (!isNewSearch && isLoading) || (!isNewSearch && !hasMore))
        return;
      if (!isNewSearch) {
        isLoading = true;
        loadingMore.style.display = "block";
      }
    }

    const encodedQuery = encodeURIComponent(query).replace(/%20/g, "+");
    let url =
      serviceToUse === "tidal"
        ? `${BURLFULL}/worker/music/tidal/search/tracks?q=${encodedQuery}&max=${RESULTS_PER_PAGE}&page=${
            offset / RESULTS_PER_PAGE + 1
          }`
        : `${BURLFULL}/worker/music/soundcloud/search/${encodedQuery}?max=${RESULTS_PER_PAGE}&offset=${offset}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (isNewSearch) {
        targetContainer.innerHTML = "";
        if (!isPlaylistSearch) trackQueue = [];
      }

      let results = [];
      if (serviceToUse === "tidal") {
        results = data.items.map((item) => {
          const rawArtwork = item.album
            ? `https://resources.tidal.com/images/${item.album.cover.replace(
                /-/g,
                "/"
              )}/320x320.jpg`
            : null;

          return {
            id: item.id,
            title: item.title,
            artist: item.artists.map((a) => a.name).join(", "),
            artwork: rawArtwork
              ? `${BURLFULL}/api/imagex?url=${encodeURIComponent(rawArtwork)}`
              : null,
            service: "tidal",
            qualities: item.mediaMetadata ? item.mediaMetadata.tags : [],
          };
        });
        if (!isPlaylistSearch)
          hasMore = offset + results.length < data.totalNumberOfItems;
      } else {
        results = data.results.map((r) => ({
          ...r,
          id: r.url.split("/").pop(),
          artwork: r.artwork
            ? `${BURLFULL}/api/imagex?url=${encodeURIComponent(r.artwork)}`
            : null,
          service: "soundcloud",
        }));
        if (!isPlaylistSearch) hasMore = results.length === RESULTS_PER_PAGE;
      }

      displayResults(results, isPlaylistSearch);
      if (!isPlaylistSearch) currentOffset += results.length;
    } catch (err) {
      if (isNewSearch)
        targetContainer.innerHTML = `<div style="color: #aaa; text-align: center; padding: 20px;">Search failed.</div>`;
    } finally {
      if (!isPlaylistSearch) resetSearchState();
      else playlistLoadingMore.style.display = "none";
    }
  }

  function displayResults(results, isPlaylistSearch = false) {
    if (!isPlaylistSearch) hideSkeleton();
    const targetContainer = isPlaylistSearch
      ? document.getElementById("playlistSearchResults")
      : searchResults;
    const initialQueueLength = trackQueue.length;

    results.forEach((result, index) => {
      if (!isPlaylistSearch) trackQueue.push(result);

      const trackIndex = initialQueueLength + index;
      const item = document.createElement("div");
      item.className = "result-item";

      if (isPlaylistSearch && selectedTracks.has(result.id)) {
        item.classList.add("selected-item");
      }

      const artworkHtml = result.artwork
        ? `<img src="${result.artwork}" onerror="this.parentElement.innerHTML = '<i class=\\'ri-music-2-fill\\' style=\\'color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;\\'></i>';">`
        : '<i class="ri-music-2-fill" style="color:rgba(0,0,0,0.25);font-size:2rem; margin:auto;"></i>';

      const isFav = Playlists.isFavorite(result.id);

      item.innerHTML = `
        <div class="result-art">${artworkHtml}</div>
        <div class="result-text">
          <div class="result-title">${result.title}</div>
          <div class="result-artist">${result.artist}</div>
        </div>
        ${
          !isPlaylistSearch
            ? `<i class="${
                isFav
                  ? "ri-heart-fill favorite-btn"
                  : "ri-heart-line favorite-btn"
              }" title="${
                isFav ? "Remove from Favorites" : "Add to Favorites"
              }"></i>`
            : `<i class="ri-checkbox-circle-fill selection-check"></i>`
        }
      `;

      item.addEventListener("click", (e) => {
        if (!isPlaylistSearch && e.target.classList.contains("favorite-btn")) {
          e.stopPropagation();
          const favBtn = e.target;
          if (Playlists.isFavorite(result.id)) {
            Playlists.removeTrackById("favorites", result.id);
            favBtn.className = "ri-heart-line favorite-btn";
            favBtn.title = "Add to Favorites";
          } else {
            Playlists.addTrack("favorites", result);
            favBtn.className = "ri-heart-fill favorite-btn";
            favBtn.title = "Remove from Favorites";
          }
          if (
            trackQueue[currentTrackIndex] &&
            trackQueue[currentTrackIndex].id === result.id
          ) {
            updateNowPlayingHeart(result);
          }
          return;
        }

        if (isPlaylistSearch) {
          if (selectedTracks.has(result.id)) {
            selectedTracks.delete(result.id);
            item.classList.remove("selected-item");
          } else {
            selectedTracks.set(result.id, result);
            item.classList.add("selected-item");
          }
          updateFinishBtnVisibility();
        } else {
          loadAndPlayTrack(trackIndex);
        }
      });
      targetContainer.appendChild(item);
    });

    if (!isPlaylistSearch) {
      if (hasMore) {
        targetContainer.appendChild(loadingMore);
        observer.observe(loadingMore);
      } else {
        loadingMore.style.display = "none";
      }
    } else {
      targetContainer.appendChild(playlistLoadingMore);
    }

    updateScrollGradients();
  }

  lockPlaylistBtn.addEventListener("click", () => {
    isPlaylistLocked = !isPlaylistLocked;

    if (isPlaylistLocked) {
      lockPlaylistBtn.className = "ri-lock-line playlist-edit-toggle";
      lockPlaylistBtn.style.color = "";
      lockPlaylistBtn.title = "Rearrange Locked";
    } else {
      lockPlaylistBtn.className = "ri-lock-unlock-line playlist-edit-toggle";
      lockPlaylistBtn.style.color = "var(--accent)";
      lockPlaylistBtn.title = "Rearrange Enabled";
    }

    if (currentPlaylistContext) {
      renderPlaylistTracks(currentPlaylistContext);
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoading && hasMore && currentQuery) {
          observer.unobserve(loadingMore);
          performSearch(currentQuery, currentOffset, false);
        }
      });
    },
    { root: searchResults, threshold: 0.1 }
  );
  loadingMore.style.display = "none";
  updateProgressBar(0);
  progressBar.max = 100;
  updateEqState(false);
});
