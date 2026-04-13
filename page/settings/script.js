document.addEventListener("DOMContentLoaded", () => {
  const THEME_KEY = "current_theme";
  const FONT_KEY = "current_font";

  let notifTimeout;

  const showNotif = () => {
    const n = document.getElementById("notif");
    if (!n) return;
    clearTimeout(notifTimeout);
    n.style.animation = "none";
    n.style.display = "block";
    void n.offsetWidth;

    n.style.animation = "notifIn 0.18s cubic-bezier(.2,.8,.2,1) forwards";
    notifTimeout = setTimeout(() => {
      n.style.display = "none";
    }, 2000);
  };
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".menu-item, .content")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      const target = document.querySelector(`.content.${item.dataset.target}`);
      if (target) target.classList.add("active");
    });
  });

  const allThemeOpts = document.querySelectorAll(".theme-opt, .alt-theme-opt");
  const activeTheme = localStorage.getItem(THEME_KEY) || "vapor";
  allThemeOpts.forEach((opt) => {
    if (opt.dataset.theme === activeTheme) opt.classList.add("active-server");
    opt.addEventListener("click", async () => {
      const selected = opt.dataset.theme;
      const isAltSection = opt.classList.contains("alt-theme-opt");
      if (
        opt.classList.contains("active-server") &&
        !opt.classList.contains("loading")
      )
        return;
      allThemeOpts.forEach((o) =>
        o.classList.remove("active-server", "loading")
      );
      opt.classList.add("loading", "active-server");
      localStorage.setItem("is_alt_theme", isAltSection ? "true" : "false");
      localStorage.setItem(THEME_KEY, selected);

      if (window.applyVtheme) {
        await window.applyVtheme();
      }
      if (window.parent && window.parent.applyVtheme) {
        await window.parent.applyVtheme();
      }

      opt.classList.remove("loading");
      showNotif();
    });
  });

  const fontInput = document.getElementById("fontInput");
  if (fontInput) {
    fontInput.value = localStorage.getItem(FONT_KEY) || "";
    let fontDelay;
    fontInput.addEventListener("input", () => {
      clearTimeout(fontDelay);
      fontDelay = setTimeout(() => {
        localStorage.setItem(FONT_KEY, fontInput.value);
        if (window.applyVfont) window.applyVfont();
        showNotif();
      }, 800);
    });
  }

  const setupOptions = (selector, key, data, defaultValue) => {
    const opts = document.querySelectorAll(selector);
    const savedValue = localStorage.getItem(key) || defaultValue;
    opts.forEach((opt) => {
      if (opt.dataset[data] === savedValue) opt.classList.add("active-server");
    });
    opts.forEach((opt) => {
      opt.addEventListener("click", () => {
        localStorage.setItem(key, opt.dataset[data]);
        opts.forEach((o) => o.classList.remove("active-server"));
        opt.classList.add("active-server");
        showNotif();
      });
    });
  };

  setupOptions(".music-opt", "default_music_provider", "music", "tidal");
  setupOptions(".watch-opt", "WATCH_STARTING_SOURCE", "watch", "youtube");
  setupOptions(
    ".wisp-opt",
    "wisp_server_url",
    "wisp",
    "wss://gointospace.app/wisp/"
  );
  setupOptions(".cloak-tab-opt", "tab_cloak_setting", "cloakTab", "vapor");
  setupOptions(
    ".cloak-auto-opt",
    "auto_cloak_setting",
    "cloakAuto",
    "disabled"
  );

  const closePreventToggle = document.getElementById("closePreventToggle");
  const CLOSE_PREVENT_KEY = "close_prevention_enabled";
  if (closePreventToggle) {
    if (localStorage.getItem(CLOSE_PREVENT_KEY) === "true")
      closePreventToggle.classList.add("active");
    closePreventToggle.addEventListener("click", () => {
      const isActive = closePreventToggle.classList.toggle("active");
      localStorage.setItem(CLOSE_PREVENT_KEY, isActive ? "true" : "false");
      showNotif();
    });
  }

  const adsToggle = document.getElementById("adsToggle");
  const ADS_ENABLED_KEY = "ADS_ENABLED";
  if (adsToggle) {
    if (localStorage.getItem(ADS_ENABLED_KEY) !== "false") {
      adsToggle.classList.add("active");
    }
    adsToggle.addEventListener("click", () => {
      const isActive = adsToggle.classList.toggle("active");
      localStorage.setItem(ADS_ENABLED_KEY, isActive ? "true" : "false");
      showNotif();
    });
  }

  const KEYS_TO_SAVE = [
    "arcora_playlists",
    "default_music_provider",
    "current_theme",
    "custom_theme_config",
    "current_font",
    "is_alt_theme",
    "WATCH_STARTING_SOURCE",
    "wispServer",
    "tab_cloak_setting",
    "auto_cloak_setting",
    "close_prevention_enabled",
    "ADS_ENABLED",
    "bookmarks",
    "bookmarksBarVisible",
    "clockFormat",
    "vaiPersonality",
  ];
  const exportBtn = document.getElementById("exportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      let content = "";
      KEYS_TO_SAVE.forEach((key) => {
        const val = localStorage.getItem(key);
        content += `|||${key}|\n${val === null ? "null" : val}\n`;
      });

      const now = new Date();
      const month = now
        .toLocaleString("default", { month: "short" })
        .toLowerCase();
      const day = now.getDate();
      const year = now.getFullYear();
      const timestamp = Math.floor(now.getTime() / 1000);
      const filename = `${month}${day}_${year}_${timestamp}.vpr`;

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  const importTrigger = document.getElementById("importTrigger");
  const importInput = document.getElementById("importInput");
  if (importTrigger && importInput) {
    importTrigger.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const chunks = text.split("|||");
        chunks.forEach((chunk) => {
          if (!chunk.trim()) return;
          const firstLineEnd = chunk.indexOf("|\n");
          if (firstLineEnd !== -1) {
            const key = chunk.substring(0, firstLineEnd);
            const val = chunk.substring(firstLineEnd + 2).replace(/\n$/, "");

            if (val === "null") {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, val);
            }
          }
        });
        showNotif();
        setTimeout(() => location.reload(), 1000);
      };
      reader.readAsText(file);
    });
  }

  const pad = document.getElementById("colorPad");
  const padBg = document.getElementById("colorPadBg");
  const padThumb = document.getElementById("padThumb");
  const hueSlider = document.getElementById("hueSlider");
  const hueThumb = document.getElementById("hueThumb");
  const modeBtns = document.querySelectorAll(".theme-mode-btn");
  const applyBtn = document.getElementById("applyCustomThemeBtn");

  if (pad && hueSlider) {
    let currentH = 0,
      currentS = 100,
      currentV = 100,
      customMode = "dark";

    function hsvToHex(h, s, v) {
      s /= 100;
      v /= 100;
      let c = v * s;
      let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      let m = v - c;
      let r = 0,
        g = 0,
        b = 0;
      if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
      } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
      } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
      } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
      } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
      } else if (h >= 300 && h < 360) {
        r = c;
        g = 0;
        b = x;
      }
      r = Math.round((r + m) * 255)
        .toString(16)
        .padStart(2, "0");
      g = Math.round((g + m) * 255)
        .toString(16)
        .padStart(2, "0");
      b = Math.round((b + m) * 255)
        .toString(16)
        .padStart(2, "0");
      return `#${r}${g}${b}`;
    }

    const updateHue = (e) => {
      const rect = hueSlider.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      let pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      currentH = Math.round(pct * 360);
      hueThumb.style.left = `${pct * 100}%`;
      padBg.style.backgroundColor = `hsl(${currentH}, 100%, 50%)`;
      updateThumbColor();
    };

    const updatePad = (e) => {
      const rect = pad.getBoundingClientRect();
      let x = e.clientX || (e.touches && e.touches[0].clientX);
      let y = e.clientY || (e.touches && e.touches[0].clientY);
      let px = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      let py = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
      currentS = Math.round(px * 100);
      currentV = Math.round((1 - py) * 100);
      padThumb.style.left = `${px * 100}%`;
      padThumb.style.top = `${py * 100}%`;
      updateThumbColor();
    };

    const updateThumbColor = () => {
      padThumb.style.backgroundColor = hsvToHex(currentH, currentS, currentV);
    };

    let isDraggingHue = false;
    let isDraggingPad = false;
    hueSlider.addEventListener("mousedown", (e) => {
      isDraggingHue = true;
      updateHue(e);
    });
    pad.addEventListener("mousedown", (e) => {
      isDraggingPad = true;
      updatePad(e);
    });
    document.addEventListener("mousemove", (e) => {
      if (isDraggingHue) updateHue(e);
      if (isDraggingPad) updatePad(e);
    });
    document.addEventListener("mouseup", () => {
      isDraggingHue = false;
      isDraggingPad = false;
    });

    hueSlider.addEventListener("touchstart", (e) => {
      isDraggingHue = true;
      updateHue(e);
    });
    pad.addEventListener("touchstart", (e) => {
      isDraggingPad = true;
      updatePad(e);
    });
    document.addEventListener("touchmove", (e) => {
      if (isDraggingHue) updateHue(e);
      if (isDraggingPad) updatePad(e);
    });
    document.addEventListener("touchend", () => {
      isDraggingHue = false;
      isDraggingPad = false;
    });

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        customMode = btn.dataset.mode;
      });
    });

    applyBtn.addEventListener("click", async () => {
      if (currentV > 85 && currentS < 15) customMode = "light";
      if (currentV < 20) customMode = "dark";

      modeBtns.forEach((b) => b.classList.remove("active"));
      document
        .querySelector(`.theme-mode-btn[data-mode="${customMode}"]`)
        .classList.add("active");

      let blueprint = {};

      if (customMode === "dark") {
        blueprint = {
          "--bg": hsvToHex(currentH, Math.min(currentS + 20, 65), 11),
          "--secondary-bg": hsvToHex(currentH, Math.min(currentS, 45), 30),
          "--third-bg": hsvToHex(currentH, Math.min(currentS * 0.8, 30), 38),
          "--fourth-bg": hsvToHex(currentH, Math.min(currentS * 0.9, 35), 19),
          "--primary": hsvToHex(
            currentH,
            Math.max(currentS, 35),
            Math.max(currentV, 80)
          ),
          "--secondary": hsvToHex(
            currentH,
            Math.max(currentS + 10, 35),
            Math.max(currentV - 15, 70)
          ),
          "--text-color": hsvToHex(currentH, 8, 91),
          "--secondary-text-color": hsvToHex(currentH, 8, 91),
          "--button-bg": hsvToHex(currentH, Math.min(currentS, 45), 30),
          "--button-hover": hsvToHex(
            currentH,
            Math.min(currentS * 0.9, 40),
            36
          ),
          "--gradient-start": hsvToHex(
            (currentH + 320) % 360,
            Math.max(currentS, 40),
            89
          ),
          "--gradient-end": hsvToHex(currentH, Math.max(currentS + 10, 60), 78),
          "--accent": "var(--primary)",
          "--cb": "255, 255, 255",
          "--bc": "0, 0, 0",
        };
      } else {
        blueprint = {
          "--bg": hsvToHex(currentH, Math.min(currentS * 0.3, 15), 92),
          "--secondary-bg": hsvToHex(
            currentH,
            Math.min(currentS * 0.4, 20),
            85
          ),
          "--third-bg": hsvToHex(currentH, Math.min(currentS * 0.5, 25), 78),
          "--fourth-bg": hsvToHex(currentH, Math.min(currentS * 0.2, 10), 97),
          "--primary": hsvToHex(
            currentH,
            Math.max(currentS, 40),
            Math.min(currentV, 45)
          ),
          "--secondary": hsvToHex(
            currentH,
            Math.max(currentS, 50),
            Math.min(currentV + 20, 65)
          ),
          "--text-color": hsvToHex(currentH, Math.min(currentS * 0.5, 30), 12),
          "--secondary-text-color": hsvToHex(
            currentH,
            Math.min(currentS * 0.6, 40),
            35
          ),
          "--button-bg": hsvToHex(currentH, Math.min(currentS * 0.4, 20), 85),
          "--button-hover": hsvToHex(
            currentH,
            Math.min(currentS * 0.5, 25),
            78
          ),
          "--gradient-start": hsvToHex(
            currentH,
            Math.max(currentS, 40),
            Math.min(currentV, 35)
          ),
          "--gradient-end": hsvToHex(
            (currentH + 25) % 360,
            Math.max(currentS, 50),
            Math.min(currentV + 15, 60)
          ),
          "--accent": "var(--primary)",
          "--cb": "0, 0, 0",
          "--bc": "255, 255, 255",
        };
      }

      localStorage.setItem("custom_theme_config", JSON.stringify(blueprint));

      localStorage.setItem("current_theme", "custom");
      localStorage.setItem("is_alt_theme", "false");

      document
        .querySelectorAll(".theme-opt, .alt-theme-opt")
        .forEach((o) => o.classList.remove("active-server"));

      if (window.applyVtheme) await window.applyVtheme();
      if (window.parent && window.parent.applyVtheme)
        await window.parent.applyVtheme();

      showNotif();
    });
  }
});
