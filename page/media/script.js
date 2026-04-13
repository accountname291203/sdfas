const API_KEY = "0c7387ed17fe3d2959530a2f0ca70022";
const API_URL = "https://api.themoviedb.org/3";
const IMAGE_URL_POSTER = "https://image.tmdb.org/t/p/w500";
const IMAGE_URL_BACKDROP = "https://image.tmdb.org/t/p/w780";
const YOUTUBE_SEARCH_URL = BURLFULL + "/api/youtube/search/";
const YOUTUBE_MAX_RESULTS = 20;
const TWITCH_ACTIVE_STREAMS_URL = BURLFULL + "/worker/watch/ttv/active";
const TWITCH_GET_STREAM_URL = BURLFULL + "/worker/watch/ttv/get/";
const TWITCH_PROXY_URL = BURLFULL + "/worker/watch/ttv/proxy?url=";
const SANDBOX_URL = BURLFULL + "/worker/sandbox/index.html?url=";
const YOUTUBE_SCRAPE_URL = BURLFULL + "/worker/watch/yt/dl/mix/";

const availableSources = [
  {
    id: "vidify",
    name: "Vidify (Player)",
    urls: {
      movie:
        "https://player.vidify.top/embed/movie/{id}?autoplay=false&poster=true&chromecast=true&servericon=false&setting=true&pip=true&download=true&font=Inter&fontcolor=6f63ff&fontsize=20&opacity=0.5&primarycolor=1b2c4e&secondarycolor=4da8ff&iconcolor=a9a9a9",
      tv: "https://player.vidify.top/embed/tv/{id}/{season}/{episode}?autoplay=false&poster=true&chromecast=true&servericon=false&setting=true&pip=true&download=true&logourl=https%3A%2F%2Fi.ibb.co%2F67wTJd9R%2Fpngimg-com-netflix-PNG11.png&font=Roboto&fontcolor=6f63ff&fontsize=20&opacity=0.5&primarycolor=1b2c4e&secondarycolor=4da8ff&iconcolor=a9a9a9",
    },
  },
  {
    id: "vidsrcxyz",
    name: "VidSrcXyz",
    urls: {
      movie: "https://vidsrc.xyz/embed/movie?tmdb={id}",
      tv: "https://vidsrc.xyz/embed/tv?tmdb={id}&season={season}&episode={episode}",
    },
  },
  {
    id: "vidsrcco",
    name: "VidSrcCo (Server 2)",
    urls: {
      movie: "https://player.vidsrc.co/embed/movie/{id}?server=2",
      tv: "https://player.vidsrc.co/embed/tv/{id}/{season}/{episode}?server=2",
    },
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    urls: {
      movie: "https://player.autoembed.cc/embed/movie/{id}?server=1",
      tv: "https://player.autoembed.cc/embed/tv/{id}/{season}/{episode}",
    },
  },
  {
    id: "vidsrcicu",
    name: "VidSrcIcu",
    urls: {
      movie: "https://vidsrc.icu/embed/movie/{id}",
      tv: "https://vidsrc.icu/embed/tv/{id}/{season}/{episode}",
    },
  },
  {
    id: "vidsrccc",
    name: "VidSrcCC (v2)",
    urls: {
      movie: "https://vidsrc.cc/v2/embed/movie/{id}",
      tv: "https://vidsrc.cc/v2/embed/tv/{id}/{season}/{episode}",
    },
  },
  {
    id: "vidlinkpro",
    name: "VidLink Pro",
    urls: {
      movie:
        "https://vidlink.pro/movie/{id}?autoplay=true&poster=true&primaryColor=4da8ff",
      tv: "https://vidlink.pro/tv/{id}/{season}/{episode}?autoplay=false&poster=true&primaryColor=4da8ff",
    },
  },
  {
    id: "embedsu",
    name: "EmbedSU",
    urls: {
      movie: "https://embed.su/embed/movie/{id}",
      tv: "https://embed.su/embed/tv/{id}/{season}/{episode}",
    },
  },
  {
    id: "vidora",
    name: "Vidora",
    urls: {
      movie: "https://vidora.su/movie/{id}?colour=4da8ff&autoplay=true",
      tv: "https://vidora.su/tv/{id}/{season}/{episode}?colour=4da8ff&autoplay=true",
    },
  },
];

const browserView = document.getElementById("browser-view");
const playbackOverlay = document.getElementById("playback-overlay");
const playerContainer = document.getElementById("player-container");
const buttonPanel = document.getElementById("button-panel");
const rippleLoader = document.getElementById("ripple-loader");
const serverBtn = document.getElementById("server-btn");
const sandboxBtn = document.getElementById("sandbox-btn");
const sourceOptionsWrapper = document.getElementById("source-options-wrapper");
const iframeBlocker = document.getElementById("iframe-blocker");

const sandboxModalContainer = document.getElementById(
  "sandbox-modal-container"
);
const sandboxToggle = document.getElementById("sandbox-toggle");

const tvModalContainer = document.getElementById("tv-modal-container");
const tvModalContentWrapper = document.getElementById(
  "tv-modal-content-wrapper"
);
const seasonsList = document.getElementById("seasons-list");
const episodesList = document.getElementById("episodes-list");

const searchBar = document.querySelector(".search-bar");
const input = searchBar.querySelector("input");
const grid = document.getElementById("grid");
const noResultsMessage = document.querySelector(".no-results-message");
const loadingSpinner = document.getElementById("loading-spinner");
const twitchEnterPrompt = document.getElementById("twitch-enter-prompt");

const dropdowns = document.querySelectorAll(".dropdown-wrapper");
const imageModeSelector = document.getElementById("image-mode-selector");
const imageModeText = imageModeSelector.querySelector(".dropdown-text");
const sourceDropdownWrapper = document.getElementById(
  "source-dropdown-wrapper"
);
const sourceSelectorText = sourceDropdownWrapper.querySelector(
  ".dropdown-menu .dropdown-text"
);
const filterDropdownIcon = document.querySelector(".filter-icon");
const filterDropdownWrapper = document.getElementById(
  "filter-dropdown-wrapper"
);
const filterOptionsContainer = document.getElementById("filter-options");
const backdrop = document.getElementById("backdrop");

let imageObserver;
let imageMode = "banner";
let currentSource = "youtube";
let currentFilter = "popularity.desc";
let currentYoutubeMode = "embed";

const startingSource = localStorage.getItem("WATCH_STARTING_SOURCE");

if (startingSource === "movies") {
  currentSource = "movie";
} else if (
  startingSource === "movie" ||
  startingSource === "youtube" ||
  startingSource === "twitch" ||
  startingSource === "tv"
) {
  currentSource = startingSource;
} else {
  currentSource = "youtube";
}
let currentQuery = "";

let isLoading = false;

let lastTwitchResults = [];
let plyrInstance = null;
let hlsInstance = null;
let currentFetchId = 0;
let currentTmdbId = null;
let currentTvShow = null;
let isSandboxMode = false;

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function isTMDB() {
  return (
    currentSource === "movie" ||
    currentSource === "all" ||
    currentSource === "tv"
  );
}

function getSourceDisplayName(sourceId) {
  switch (sourceId) {
    case "youtube":
      return "YouTube";
    case "twitch":
      return "Twitch";
    case "movie":
      return "Movies";
    case "tv":
      return "TV Shows";
    case "all":
      return "All";
    default:
      return sourceId.charAt(0).toUpperCase() + sourceId.slice(1);
  }
}

function handleScrollMasks() {
  grid.classList.toggle("show-top-mask", grid.scrollTop > 10);

  const isAtBottom =
    grid.scrollHeight - grid.scrollTop <= grid.clientHeight + 10;

  grid.classList.toggle(
    "show-bottom-mask",
    !isAtBottom && grid.scrollHeight > grid.clientHeight
  );
}

function toggleLoading(state) {
  isLoading = state;
  loadingSpinner.classList.toggle("active", state);
}

function toggleImageModeDropdown() {
  const isEnabled = isTMDB();
  imageModeSelector.classList.toggle("disabled", !isEnabled);
  if (!isEnabled) {
    imageModeText.textContent = "Disabled";
    grid.classList.remove("static-mode", "cover-mode");
  } else {
    imageModeText.textContent =
      imageMode.charAt(0).toUpperCase() + imageMode.slice(1);
    setImageMode(imageMode);
  }
}

function updateFilterDropdownOptions() {
  filterOptionsContainer.innerHTML = "";
  if (isTMDB()) {
    filterDropdownWrapper.style.display = "flex";
    filterOptionsContainer.innerHTML = `<div class="option" data-value="popularity.desc">Relevance</div><div class="option" data-value="original_title.asc">Alphabetical</div><div class="option" data-value="release_date.desc">Newest</div><div class="option" data-value="release_date.asc">Oldest</div><div class="option" data-value="vote_average.desc">Highest Rated</div><div class="option" data-value="vote_average.asc">Lowest Rated</div>`;
  } else if (currentSource === "youtube") {
    filterDropdownWrapper.style.display = "flex";
    filterOptionsContainer.innerHTML = `<div class="option" data-value="scrape">Scrape</div><div class="option" data-value="embed">Embed</div>`;
  } else if (currentSource === "twitch") {
    filterDropdownWrapper.style.display = "none";
  }
}

function updateSearchBarPlaceholder() {
  let text = "";
  switch (currentSource) {
    case "youtube":
      text = "Search YouTube...";
      break;
    case "twitch":
      text = "Enter Twitch Username...";
      break;
    case "movie":
      text = "Search Movies...";
      break;
    case "tv":
      text = "Search TV Shows...";
      break;
  }
  input.placeholder = text;
}

async function fetchYoutubeData(fetchId) {
  if (isLoading) return;
  toggleLoading(true);
  const query = currentQuery.trim().replace(/\s/g, "+") || "popular videos";
  const url = `${YOUTUBE_SEARCH_URL}${query}?max=${YOUTUBE_MAX_RESULTS}`;

  grid.innerHTML = "";
  grid.appendChild(loadingSpinner);
  grid.appendChild(noResultsMessage);

  try {
    const res = await fetch(url);
    if (fetchId !== currentFetchId) return;

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status} for URL: ${url}`);
    }

    const data = await res.json();

    if (!data || !data.items || data.items.length === 0) {
      throw new Error("API returned an empty or invalid result set.");
    }

    renderItems(data.items || []);
  } catch (err) {
    if (fetchId === currentFetchId) {
      console.error("YouTube data fetching error:", err);
      const errorMessage = `YouTube Fetch Failed: ${
        err.message || err.toString()
      }. Please check console for full error details.`;
      noResultsMessage.textContent = errorMessage;
      noResultsMessage.style.display = "block";
    }
  } finally {
    if (fetchId === currentFetchId) {
      toggleLoading(false);
    }
  }
}

async function fetchTwitchData(fetchId) {
  if (isLoading) return;
  toggleLoading(true);

  grid.innerHTML = "";
  grid.appendChild(loadingSpinner);
  grid.appendChild(noResultsMessage);
  const url = TWITCH_ACTIVE_STREAMS_URL;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (fetchId !== currentFetchId) return;
    const newResults = data.map((item) => ({
      ...item,
      media_type: "twitch",
      channel_name: item.url.split("/").pop().split("?")[0],
    }));
    lastTwitchResults = newResults;
    renderItems(newResults);
  } catch (err) {
    if (fetchId === currentFetchId) {
      console.error("Twitch error:", err);
      noResultsMessage.textContent = "Error loading Twitch streams.";
      noResultsMessage.style.display = "block";
    }
  } finally {
    if (fetchId === currentFetchId) {
      toggleLoading(false);
    }
  }
}

async function fetchTMDBData(fetchId) {
  if (isLoading) return;
  toggleLoading(true);

  grid.innerHTML = "";
  grid.appendChild(loadingSpinner);
  grid.appendChild(noResultsMessage);

  let endpoint = "";
  const params = new URLSearchParams({
    api_key: API_KEY,
    page: 1,
  });

  if (currentQuery) {
    params.append("query", currentQuery);
    endpoint = `/search/${currentSource === "all" ? "multi" : currentSource}`;
  } else {
    endpoint = `/discover/${currentSource}`;
    let filter = currentFilter;
    if (currentSource === "tv") {
      filter = filter.replace("release_date", "first_air_date");
      filter = filter.replace("original_title", "original_name");
    }
    params.append("sort_by", filter);
    params.append("vote_count.gte", 100);
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (fetchId !== currentFetchId) return;
    let allResults = [];
    allResults.push(...(data.results || []));
    let totalPages = data.total_pages;

    for (let page = 2; page <= Math.min(3, totalPages); page++) {
      const pageParams = new URLSearchParams(params);
      pageParams.set("page", page);
      const nextRes = await fetch(
        `${API_URL}${endpoint}?${pageParams.toString()}`
      );
      if (!nextRes.ok) break;
      const nextData = await nextRes.json();
      allResults.push(...(nextData.results || []));
    }

    const validResults = allResults
      .filter(
        (item) =>
          (item.poster_path || item.backdrop_path) &&
          item.media_type !== "person"
      )
      .slice(0, 50);

    renderItems(validResults);

    if (validResults.length === 0) {
      noResultsMessage.textContent = "No results found.";
      noResultsMessage.style.display = "block";
    } else {
      noResultsMessage.textContent = "You've reached the end.";
      noResultsMessage.style.display = "block";
    }
  } catch (err) {
    if (fetchId === currentFetchId) {
      console.error("TMDB error:", err);
      noResultsMessage.textContent = "Error loading content.";
      noResultsMessage.style.display = "block";
    }
  } finally {
    if (fetchId === currentFetchId) {
      toggleLoading(false);
    }
  }
}

function fetchData() {
  currentFetchId++;
  const fetchId = currentFetchId;
  if (currentSource === "youtube") {
    fetchYoutubeData(fetchId);
  } else if (currentSource === "twitch") {
    fetchTwitchData(fetchId);
  } else {
    fetchTMDBData(fetchId);
  }
}

function resetAndFetch() {
  noResultsMessage.style.display = "none";
  updateSearchBarPlaceholder();
  updateFilterDropdownOptions();
  toggleImageModeDropdown();
  grid.classList.remove("twitch-prompt-mode");
  fetchData();
}

function loadImage(card) {
  if (
    imageMode === "static" ||
    card.classList.contains("loaded") ||
    (card.dataset.source !== "movie" && card.dataset.source !== "tv")
  )
    return;
  let imageUrl = "";
  if (imageMode === "banner") {
    imageUrl = card.dataset.srcBanner;
  } else if (imageMode === "cover") {
    imageUrl = card.dataset.srcCover;
  }
  if (!imageUrl) {
    imageUrl = card.dataset.srcCover || card.dataset.srcBanner;
  }
  if (imageUrl) {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      card.style.setProperty("--bg-image", `url('${imageUrl}')`);
      card.classList.add("loaded");
    };
  }
}

function setImageMode(mode) {
  if (imageMode === mode) return;
  imageMode = mode;
  grid.classList.remove("static-mode", "cover-mode");
  if (mode === "static") {
    grid.classList.add("static-mode");
  } else if (mode === "cover") {
    grid.classList.add("cover-mode");
  }
  if (isTMDB()) {
    const allCards = grid.querySelectorAll(".card");
    allCards.forEach((card) => {
      card.classList.remove("loaded");
      card.style.removeProperty("--bg-image");
    });
    if (mode !== "static") {
      allCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom >= 0) {
          loadImage(card);
        }
      });
    }
  }
}

function setupLazyLoader() {
  const observerOptions = {
    root: grid,
    rootMargin: "0px 0px 500px 0px",
    threshold: 0.01,
  };
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadImage(entry.target);
      }
    });
  }, observerOptions);
}

function createCardElement(item) {
  const card = document.createElement("div");
  card.className = "card";
  const mediaType = item.media_type || currentSource;
  card.dataset.source = mediaType;
  let title;
  if (mediaType === "youtube") {
    card.classList.add("youtube-card");
    title = item.title;
    card.dataset.id = item.videoId;
    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "thumbnail-container";
    const thumbnailImg = new Image();
    thumbnailImg.src = item.thumbnail;
    thumbnailImg.alt = title;
    thumbnailContainer.appendChild(thumbnailImg);
    const infoContainer = document.createElement("div");
    infoContainer.className = "video-info";
    const nameElement = document.createElement("div");
    nameElement.className = "card-name";
    nameElement.textContent = title;
    const channelNameElement = document.createElement("div");
    channelNameElement.className = "channel-name";
    channelNameElement.textContent = item.author?.name || "Unknown Channel";
    infoContainer.appendChild(nameElement);
    infoContainer.appendChild(channelNameElement);
    card.appendChild(thumbnailContainer);
    card.appendChild(infoContainer);
  } else if (mediaType === "twitch") {
    card.classList.add("twitch-card");
    title = item.title;
    const channelName = item.channel_name || item.url.split("/").pop();
    card.dataset.id = channelName;
    const nameElement = document.createElement("div");
    nameElement.className = "card-name";
    nameElement.textContent = title;
    const details = document.createElement("div");
    details.className = "card-details";
    details.innerHTML = `<span class="channel-name">${channelName}</span><span class="viewers"><i class="ri-eye-line"></i>${item.viewers.toLocaleString()}</span>`;
    card.appendChild(nameElement);
    card.appendChild(details);
  } else {
    title = item.title || item.name;
    const bannerUrl = item.backdrop_path
      ? `${IMAGE_URL_BACKDROP}${item.backdrop_path}`
      : "";
    const coverUrl = item.poster_path
      ? `${IMAGE_URL_POSTER}${item.poster_path}`
      : "";
    card.dataset.srcBanner = bannerUrl;
    card.dataset.srcCover = coverUrl;
    card.dataset.id = item.id;
    const nameElement = document.createElement("div");
    nameElement.className = "card-name";
    nameElement.textContent = title;
    card.appendChild(nameElement);
  }
  card.addEventListener("click", () => {
    const id = card.dataset.id;
    const playbackTitle = title;
    if (mediaType === "youtube" || mediaType === "twitch") {
      playVideo(mediaType, id, playbackTitle);
    } else if (mediaType === "movie") {
      currentTmdbId = id;
      playVideo("movie", id, playbackTitle);
    } else if (mediaType === "tv") {
      currentTmdbId = id;
      currentTvShow = item;
      openTvModal(id, playbackTitle);
    }
  });
  return card;
}

function renderItems(items) {
  grid.innerHTML = "";
  grid.appendChild(loadingSpinner);
  grid.appendChild(noResultsMessage);
  grid.appendChild(twitchEnterPrompt);

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const card = createCardElement(item);
    fragment.appendChild(card);
    if (card.dataset.source !== "youtube" && card.dataset.source !== "twitch") {
      imageObserver.observe(card);
    }
  });
  grid.insertBefore(fragment, loadingSpinner);
  const hasResults = grid.querySelector(".card");
  if (!hasResults && items.length === 0 && !isLoading) {
    noResultsMessage.style.display = "block";
    noResultsMessage.textContent = "No results found.";
  } else if (isTMDB() && items.length > 0 && !isLoading) {
    noResultsMessage.style.display = "block";
    noResultsMessage.textContent = "You've reached the end.";
  } else {
    noResultsMessage.style.display = "none";
  }

  handleScrollMasks();
}

function destroyPlayer() {
  if (plyrInstance) {
    plyrInstance.destroy();
    plyrInstance = null;
  }
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  playerContainer.innerHTML = "";
  playerContainer.appendChild(rippleLoader);

  const blocker = document.createElement("div");
  blocker.id = "iframe-blocker";
  playerContainer.appendChild(blocker);

  buttonPanel.style.opacity = "0";
  rippleLoader.style.display = "none";
  rippleLoader.style.opacity = "0";
  serverBtn.style.display = "none";
  sandboxBtn.style.display = "none";
  sourceOptionsWrapper.classList.remove("active");
  document.getElementById("iframe-blocker").classList.remove("active");
  closeSandboxModal();
  closeTvModal();
}

function exitPlayback() {
  playbackOverlay.style.opacity = "0";
  setTimeout(() => {
    playbackOverlay.style.display = "none";
    destroyPlayer();
    browserView.style.display = "flex";
    requestAnimationFrame(() => {
      browserView.style.opacity = "1";
      browserView.style.transform = "scale(1)";
    });
  }, 400);
}

async function playVideo(
  source,
  id,
  title,
  seasonNum = null,
  episodeNum = null
) {
  destroyPlayer();
  browserView.style.opacity = "0";
  browserView.style.transform = "scale(0.98)";

  const onOverlayReady = () => {
    playbackOverlay.removeEventListener("transitionend", onOverlayReady);

    if (source === "youtube") {
      if (currentYoutubeMode === "scrape") {
        buttonPanel.style.opacity = "0";
        rippleLoader.style.display = "block";
        requestAnimationFrame(() => {
          rippleLoader.style.opacity = "1";
        });
        setupYoutubeScrapePlayer(id);
      } else {
        buttonPanel.style.opacity = "1";
        setupYoutubeEmbedPlayer(id);
      }
    } else if (source === "twitch") {
      buttonPanel.style.opacity = "0";
      rippleLoader.style.display = "block";
      requestAnimationFrame(() => {
        rippleLoader.style.opacity = "1";
      });
      setupTwitchPlayer(id);
    } else if (source === "movie") {
      buttonPanel.style.opacity = "1";
      serverBtn.style.display = "flex";
      sandboxBtn.style.display = "flex";
      setupTMDBPlayer(id);
    } else if (source === "tv") {
      buttonPanel.style.opacity = "1";
      serverBtn.style.display = "flex";
      sandboxBtn.style.display = "flex";
      setupTMDBPlayer(id);
      currentTvShow.season_number = seasonNum;
      currentTvShow.episode_number = episodeNum;
    }
  };

  setTimeout(() => {
    browserView.style.display = "none";
    playbackOverlay.style.display = "flex";
    playbackOverlay.addEventListener("transitionend", onOverlayReady, {
      once: true,
    });
    setTimeout(
      () =>
        playbackOverlay.removeEventListener("transitionend", onOverlayReady),
      500
    );
    requestAnimationFrame(() => {
      playbackOverlay.style.opacity = "1";
    });
  }, 400);
}

function setupYoutubeEmbedPlayer(id) {
  playerContainer.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=1&modestbranding=1&rel=0`;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute(
    "allow",
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  );
  playerContainer.appendChild(iframe);
  requestAnimationFrame(() => {
    iframe.style.opacity = "1";
  });
}

async function setupYoutubeScrapePlayer(id) {
  try {
    const res = await fetch(`${YOUTUBE_SCRAPE_URL}${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch video source. Status: ${res.status}`);
    }
    const videoUrl = await res.text();
    if (!videoUrl || !videoUrl.startsWith("http")) {
      throw new Error("Invalid video URL received.");
    }
    const videoEl = document.createElement("video");
    videoEl.style.opacity = "0";
    playerContainer.appendChild(videoEl);

    plyrInstance = new Plyr(videoEl, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "mute",
        "volume",
        "settings",
        "fullscreen",
      ],
    });

    videoEl.src = videoUrl;
    plyrInstance.on("canplay", () => {
      rippleLoader.style.opacity = "0";
      setTimeout(() => {
        rippleLoader.style.display = "none";
      }, 300);
      buttonPanel.style.opacity = "1";

      const plyrEl = playerContainer.querySelector(".plyr");
      if (plyrEl) plyrEl.style.opacity = "1";

      const rawVideo = playerContainer.querySelector("video");
      if (rawVideo) rawVideo.style.opacity = "1";

      plyrInstance.play();
    });
  } catch (error) {
    console.error("YouTube scrape playback error:", error);
    rippleLoader.style.display = "none";
    buttonPanel.style.opacity = "1";
    playerContainer.innerHTML += `<p class="player-error">Error: ${error.message}</p>`;
  }
}

function setupTMDBPlayer(id) {
  const iframe = document.createElement("iframe");
  if (isSandboxMode) {
    iframe.sandbox = "allow-scripts allow-same-origin";
  }
  iframe.srcdoc = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
                body { 
                    margin: 0; 
                    height: 100vh; 
                    display: flex; 
                    flex-direction: column;
                    align-items: flex-start;
                    justify-content: flex-start;
                    background-color: var(--fourth-bg);
                    color: #fff; 
                    font-family: 'Inter', sans-serif; 
                    box-sizing: border-box;
                    padding: 40px;
                }
                div {
                    font-size: 24px;
                    font-weight: 500;
                    opacity: 0.8;
                }
                p {
                  color: rgba(255,255,255,0.65);
                  margin-top: 15px;
                }
            </style>
            <div>Click the server icon to select a source</div>
            <p><b>Note:</b> VAPOR streams movies from third-party sources, each with their own ads.<br>
            We don’t control or endorse the content or advertisements shown.</p>
                        `;
  playerContainer.appendChild(iframe);
  requestAnimationFrame(() => {
    iframe.style.opacity = "1";
  });
}

function loadMediaSource(urlTemplate) {
  const iframe = playerContainer.querySelector("iframe");
  if (!iframe || !currentTmdbId) return;

  let finalUrl = "";
  if (currentSource === "movie" && urlTemplate.movie) {
    finalUrl = urlTemplate.movie.replace("{id}", currentTmdbId);
  } else if (
    currentSource === "tv" &&
    currentTvShow &&
    currentTvShow.season_number !== undefined &&
    urlTemplate.tv
  ) {
    const tvUrlTemplate = urlTemplate.tv;
    finalUrl = tvUrlTemplate
      .replace(/{id}/g, currentTmdbId)
      .replace(/{season}/g, currentTvShow.season_number)
      .replace(/{episode}/g, currentTvShow.episode_number);
  } else {
    console.error(
      "Cannot load media source: Missing ID or TV episode information, or source does not support current media type."
    );
    return;
  }

  if (iframe.hasAttribute("srcdoc")) {
    iframe.removeAttribute("srcdoc");
  }

  if (isSandboxMode) {
    iframe.src = `${SANDBOX_URL}${encodeURIComponent(finalUrl)}`;
  } else {
    iframe.src = finalUrl;
  }

  toggleSourceDropdown(false);
}

function renderSourceDropdown() {
  sourceOptionsWrapper.innerHTML = "";
  availableSources.forEach((source) => {
    if (source.urls[currentSource]) {
      const option = document.createElement("div");
      option.className = "option";
      option.textContent = source.name;
      option.onclick = () => loadMediaSource(source.urls);
      sourceOptionsWrapper.appendChild(option);
    }
  });
}

async function setupTwitchPlayer(id) {
  try {
    const res = await fetch(`${TWITCH_GET_STREAM_URL}${id}`);
    const data = await res.json();
    if (!data.success || !data.urls || Object.keys(data.urls).length === 0) {
      throw new Error("Stream offline or unavailable.");
    }
    const qualities = Object.keys(data.urls).filter((q) => q !== "audio_only");
    const bestQuality =
      qualities.length > 0 ? qualities[qualities.length - 1] : null;
    if (!bestQuality) throw new Error("No video stream found.");
    const proxiedUrl =
      TWITCH_PROXY_URL + encodeURIComponent(data.urls[bestQuality]);

    const videoEl = document.createElement("video");
    videoEl.style.opacity = "0";
    playerContainer.appendChild(videoEl);

    plyrInstance = new Plyr(videoEl, {
      controls: ["play-large", "play", "mute", "volume", "fullscreen"],
    });

    if (Hls.isSupported()) {
      hlsInstance = new Hls();
      hlsInstance.loadSource(proxiedUrl);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        rippleLoader.style.opacity = "0";
        setTimeout(() => {
          rippleLoader.style.display = "none";
        }, 300);

        buttonPanel.style.opacity = "1";

        const plyrEl = playerContainer.querySelector(".plyr");
        if (plyrEl) plyrEl.style.opacity = "1";

        const rawVideo = playerContainer.querySelector("video");
        if (rawVideo) rawVideo.style.opacity = "1";

        plyrInstance.play();
      });
      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) throw new Error(`HLS Error: ${data.details}`);
      });
    } else {
      throw new Error("HLS not supported.");
    }
  } catch (error) {
    console.error("Twitch playback error:", error);
    rippleLoader.style.display = "none";
    buttonPanel.style.opacity = "1";
    playerContainer.innerHTML += `<p class="player-error">Error: ${error.message}</p>`;
  }
}

function toggleSourceDropdown(show) {
  if (show) {
    renderSourceDropdown();
    sourceOptionsWrapper.classList.add("active");
    iframeBlocker.classList.add("active");
  } else {
    sourceOptionsWrapper.classList.remove("active");
    iframeBlocker.classList.remove("active");
  }
}

function openSandboxModal() {
  sandboxToggle.checked = isSandboxMode;
  sandboxModalContainer.style.display = "flex";
  requestAnimationFrame(() => {
    sandboxModalContainer.classList.add("active");
  });
}

function closeSandboxModal() {
  sandboxModalContainer.classList.remove("active");
  setTimeout(() => {
    if (!sandboxModalContainer.classList.contains("active")) {
      sandboxModalContainer.style.display = "none";
    }
  }, 300);
}

async function fetchTvDetails(tmdbId) {
  const url = `${API_URL}/tv/${tmdbId}?api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch TV details.");
  return res.json();
}

async function fetchSeasonDetails(tmdbId, seasonNumber) {
  const url = `${API_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch Season ${seasonNumber} details.`);
  return res.json();
}

async function openTvModal(tmdbId, title) {
  tvModalContainer.classList.remove("episodes-active");
  tvModalContentWrapper.classList.remove("episodes-active");

  seasonsList.innerHTML = `<li><div class="loading-spinner active" style="padding: 0; height: 32px;"><div class="spinner" style="width: 20px; height: 20px; border-width: 3px;"></div></div></li>`;
  episodesList.innerHTML = "";

  tvModalContainer.style.display = "flex";
  requestAnimationFrame(() => {
    tvModalContainer.classList.add("active");
  });

  tvModalContainer.dataset.originalTitle = title;

  try {
    const details = await fetchTvDetails(tmdbId);
    const validSeasons = details.seasons.filter(
      (s) => s.episode_count > 0 && s.season_number >= 1
    );

    seasonsList.innerHTML = "";

    const titleHeader = document.createElement("li");
    titleHeader.textContent = details.name || title;
    titleHeader.classList.add("tv-list-header");
    seasonsList.appendChild(titleHeader);

    validSeasons.forEach((season) => {
      const li = document.createElement("li");
      li.textContent = `${season.name} (${season.episode_count} episodes)`;
      li.dataset.seasonNumber = season.season_number;
      li.dataset.seasonName = season.name;
      li.addEventListener("click", () => {
        renderEpisodes(tmdbId, season.season_number, season.name);
      });
      seasonsList.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching TV show details:", error);
    seasonsList.innerHTML = "<li>Failed to load seasons.</li>";
  }
}

async function renderEpisodes(tmdbId, seasonNumber, seasonName) {
  episodesList.innerHTML = `<li><div class="loading-spinner active" style="padding: 0; height: 32px;"><div class="spinner" style="width: 20px; height: 20px; border-width: 3px;"></div></div></li>`;

  tvModalContainer.classList.add("episodes-active");
  tvModalContentWrapper.classList.add("episodes-active");

  try {
    const seasonDetails = await fetchSeasonDetails(tmdbId, seasonNumber);
    episodesList.innerHTML = "";

    const backLink = document.createElement("li");
    backLink.textContent = `<- Back to Seasons`;
    backLink.classList.add("tv-back-link");
    backLink.addEventListener("click", () => {
      tvModalContainer.classList.remove("episodes-active");
      tvModalContentWrapper.classList.remove("episodes-active");
    });
    episodesList.appendChild(backLink);

    const titleHeader = document.createElement("li");
    titleHeader.textContent = seasonName;
    titleHeader.classList.add("tv-list-header");
    episodesList.appendChild(titleHeader);

    seasonDetails.episodes.forEach((episode) => {
      if (episode.episode_number === 0) return;
      const li = document.createElement("li");

      const numBox = document.createElement("span");
      numBox.className = "episode-number";
      numBox.textContent = episode.episode_number;

      const nameText = document.createElement("span");
      nameText.className = "episode-name";
      nameText.textContent =
        episode.name || `Episode ${episode.episode_number}`;

      li.appendChild(numBox);
      li.appendChild(nameText);

      li.addEventListener("click", () => {
        playVideo(
          "tv",
          tmdbId,
          `${tvModalContainer.dataset.originalTitle} - ${seasonName} - E${episode.episode_number}`,
          episode.season_number,
          episode.episode_number
        );
        closeTvModal();
      });
      episodesList.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching season episodes:", error);
    episodesList.innerHTML = "<li>Failed to load episodes.</li>";
  }
}

function closeTvModal() {
  tvModalContainer.classList.remove("episodes-active");
  tvModalContentWrapper.classList.remove("episodes-active");
  tvModalContainer.classList.remove("active");

  setTimeout(() => {
    if (!tvModalContainer.classList.contains("active")) {
      tvModalContainer.style.display = "none";
    }
  }, 300);
}

function bindTvModalControls() {
  tvModalContainer.addEventListener("click", (e) => {
    if (e.target === tvModalContainer) {
      closeTvModal();
    }
  });
}

function bindPlaybackControls() {
  document.getElementById("back-btn").addEventListener("click", exitPlayback);
  document.getElementById("fullscreen-btn").addEventListener("click", () => {
    const movieIframe = playerContainer.querySelector("iframe");
    if (plyrInstance) plyrInstance.fullscreen.enter();
    else if (movieIframe) movieIframe.requestFullscreen();
    else if (document.fullscreenElement) document.exitFullscreen();
    else playerContainer.requestFullscreen();
  });

  serverBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isActive = sourceOptionsWrapper.classList.contains("active");
    toggleSourceDropdown(!isActive);
  });

  sandboxBtn.addEventListener("click", openSandboxModal);

  sandboxModalContainer.addEventListener("click", (e) => {
    if (e.target === sandboxModalContainer) {
      closeSandboxModal();
    }
  });

  sandboxToggle.addEventListener("change", (e) => {
    isSandboxMode = e.target.checked;
    const iframe = playerContainer.querySelector("iframe");
    if (iframe) {
      if (isSandboxMode) {
        iframe.sandbox = "allow-scripts allow-same-origin";
      } else {
        iframe.removeAttribute("sandbox");
      }
      if (iframe.src) iframe.src = iframe.src;
    }
  });

  iframeBlocker.addEventListener("click", () => {
    toggleSourceDropdown(false);
  });

  document.addEventListener("click", (e) => {
    if (
      !sourceOptionsWrapper.contains(e.target) &&
      e.target !== serverBtn &&
      !serverBtn.contains(e.target)
    ) {
      toggleSourceDropdown(false);
    }
  });
}

const isMobileLayout = () => window.matchMedia("(max-width: 750px)").matches;

input.addEventListener("focus", () => {
  if (!isMobileLayout()) {
    searchBar.style.width = "420px";
  }
});
input.addEventListener("blur", () => {
  if (!isMobileLayout()) {
    searchBar.style.width = "400px";
  }
});

const debouncedSearch = debounce(() => {
  if (
    currentSource === "youtube" ||
    currentSource === "movie" ||
    currentSource === "tv"
  ) {
    currentQuery = input.value.trim();
    resetAndFetch();
  }
}, 500);

input.addEventListener("input", () => {
  if (currentSource === "twitch") {
    if (input.value.trim().length > 0) {
      grid.classList.add("twitch-prompt-mode");
    } else {
      grid.classList.remove("twitch-prompt-mode");
    }
  } else {
    debouncedSearch();
  }
});

input.addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    currentSource === "twitch" &&
    input.value.trim().length > 0
  ) {
    playVideo("twitch", input.value.trim(), input.value.trim());
  }
});

grid.addEventListener("scroll", handleScrollMasks);

filterDropdownIcon.addEventListener("click", (e) => {
  e.stopPropagation();
  if (filterDropdownWrapper.style.display === "none") return;
  const isOpening = !filterDropdownWrapper.classList.contains("open");
  closeAllDropdowns();
  if (isOpening) {
    filterDropdownWrapper.classList.add("open");
    backdrop.classList.add("active");
  }
});

function closeAllDropdowns() {
  dropdowns.forEach((wrapper) => wrapper.classList.remove("open"));
  backdrop.classList.remove("active");
}

dropdowns.forEach((wrapper) => {
  const menu = wrapper.querySelector(".dropdown-menu");
  const options = wrapper.querySelector(".dropdown-options");
  if (menu) {
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.classList.contains("disabled")) return;
      const isOpening = !wrapper.classList.contains("open");
      closeAllDropdowns();
      if (isOpening) {
        wrapper.classList.add("open");
        backdrop.classList.add("active");
      }
    });
  }
  options.addEventListener("click", (e) => {
    const optionElement = e.target.closest(".option");
    if (optionElement && !optionElement.classList.contains("disabled")) {
      e.stopPropagation();
      const value = optionElement.dataset.value;
      const text = optionElement.textContent.trim();
      let needsReset = false;
      if (wrapper.contains(imageModeSelector)) {
        imageModeText.textContent = text;
        setImageMode(value);
      } else if (wrapper === sourceDropdownWrapper) {
        if (currentSource !== value) {
          currentSource = value;
          sourceSelectorText.textContent = getSourceDisplayName(value);
          input.value = "";
          currentQuery = "";
          needsReset = true;
        }
      } else if (wrapper === filterDropdownWrapper) {
        if (currentSource === "youtube") {
          currentYoutubeMode = value;
        } else if (currentFilter !== value) {
          currentFilter = value;
          needsReset = true;
        }
        filterDropdownIcon.title = text;
      }
      if (needsReset) resetAndFetch();
      closeAllDropdowns();
    }
  });
});

document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".dropdown-wrapper") &&
    !e.target.closest(".search-bar")
  ) {
    closeAllDropdowns();
  }
});

backdrop.addEventListener("click", closeAllDropdowns);

sourceSelectorText.textContent = getSourceDisplayName(currentSource);

updateSearchBarPlaceholder();
updateFilterDropdownOptions();
toggleImageModeDropdown();
setupLazyLoader();
bindPlaybackControls();
bindTvModalControls();
renderSourceDropdown();
fetchData();

handleScrollMasks();
new ResizeObserver(handleScrollMasks).observe(grid);
