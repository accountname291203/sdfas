(async function () {
  function setAppViewportHeight() {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty(
      "--app-viewport-height",
      `${vh}px`
    );
  }

  setAppViewportHeight();
  window.addEventListener("resize", setAppViewportHeight);

  const navContainer = document.getElementById("nav-container");
  const navBox = document.getElementById("nav-box");
  const navList = document.getElementById("nav-list");
  const currentPageIcon = document.getElementById("current-page-icon");
  const menuDismissOverlay = document.getElementById("menu-dismiss-overlay");
  const iframeWrapper = document.getElementById("iframe-wrapper");

  const showWhatsNewBtn = document.getElementById("show-whats-new-btn");
  const settingsBtn = document.getElementById("settings-btn");

  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingLogo = document.getElementById("loading-logo");

  let lastPointerType = "mouse";

  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointerType = e.pointerType;
    },
    { capture: true }
  );

  let allNavItems = [];
  let isTapActive = false;
  let currentActiveSideBtn = null;

  window.online_users_count = 0;
  let ws;

  let currentActivePageForServer = "Home";

  function updateHomeLabel() {
    const homeItem = allNavItems.find((item) => item.url === "/page/home.html");
    if (homeItem) {
      homeItem.name =
        window.online_users_count > 0
          ? `${window.online_users_count} online`
          : "Home";
    }

    const navLinks = document.querySelectorAll(".nav-list-item");
    navLinks.forEach((link) => {
      if (link.getAttribute("data-url") === "/page/home.html") {
        const textSpan = link.querySelector(".nav-text");
        if (textSpan) {
          textSpan.innerText =
            window.online_users_count > 0
              ? `${window.online_users_count} online`
              : "Home";
        }
      }
    });
  }

  function becomeAnOnlineUser() {
    const wsUrl =
      window.location.protocol === "https:"
        ? `wss://${BURLHOST}/logon`
        : `ws://${BURLHOST}/logon`;
    //const wsUrl = "wss://trucks.eemotors.uk/logon";
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (window.pageHeartbeatInterval)
        clearInterval(window.pageHeartbeatInterval);

      window.pageHeartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "page_heartbeat",
              page: currentActivePageForServer,
            })
          );
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "user_count") {
          window.online_users_count = data.count;
          updateHomeLabel();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      if (window.pageHeartbeatInterval)
        clearInterval(window.pageHeartbeatInterval);
      setTimeout(becomeAnOnlineUser, 5000);
    };

    ws.onerror = () => ws.close();
  }

  becomeAnOnlineUser();

  const STARTUP_NOTIFICATION = {
    iconClass: "ri-meteor-line",
    title: "VAPOR v4.4",
    content: `
    🤖 <b>New AI System</b>
    Multi-model AI Chat with custom personalities
    
    🎮 <b>Expanded Gamelists</b>
    ~4,000 games across 10 gamelists
    
    🎵 <b>Music Improvements</b>
    Favorites, queue system, and shuffling
    
    🎨 <b>Settings Redesign</b>
    New UI with custom themes and Light Mode
    `,
    buttonText: "Continue",
  };

  const CHANGELOG_DATA = {
    iconClass: "ri-history-line",
    title: "Changelog for v4.4",
    content: `
    🤖 AI
    - New AI source (that, yes, I pay for.)
    - Models:
    &nbsp;&nbsp;* Claude 4.5 Haiku
    &nbsp;&nbsp;* Gemini 3 Flash
    &nbsp;&nbsp;* GPT-OSS (low & high)
    &nbsp;&nbsp;* Automatic

    - Added personality system
    - (AI also has knowledge about VAPOR)
  
    🎮 Play
    - Added 3 new gamelists:
    &nbsp;&nbsp;* TGLSC
    &nbsp;&nbsp;* Seraph
    &nbsp;&nbsp;* 3kh0 (bugged sadly)

    - ~4,000 total games (10 gamelists)
    - Redesigned gamelist source dropdown (less cluttered)
  
    🎵 Music (Listen)
    - Added favorites system
    - Added queue system
    - Added playlist shuffle
    - Re-added repeat button
    - Fixed music source switching bug
    - Fixed TIDAL playback
    - Tweaked equalizer balancing
    - Audio and images now properly served through server
  
    🎨 Settings & UI
    - Fully redesigned Settings UI
    - Added Light Mode
    - Added custom theme system
    - Reworked color system for custom themes
    - Added partners to Partners menu
    - Replaced weather with date on Home
    - Added new splash texts
    - Updated various icons
  
    📢 Ads
    - Switched back to a more reliable ad provider
    `,
    buttonText: "Back",
  };

  const H2_TITLE_ICON = (icon) => `<i class="${icon}"></i>`;

  function resetSideButtonActiveState() {
    if (currentActiveSideBtn) {
      currentActiveSideBtn.classList.remove("active");
      currentActiveSideBtn = null;
    }
  }

  function processNotificationContent(content) {
    const lines = content.trim().split("\n");
    const processedLines = lines.map((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(">")) {
        return `<div class="blockquote">${trimmedLine
          .substring(1)
          .trim()}</div>`;
      }
      return trimmedLine;
    });
    return processedLines.join("<br>");
  }

  const proximityConfig = { maxDistance: 250, maxScale: 1.05 };
  const handleProximity = (e) => {
    if (e.pointerType === "mouse") {
      isTapActive = false;
    }

    if (isTapActive) return;

    if (navContainer.classList.contains("hover-active")) {
      const navBox = document.getElementById("nav-box");
      if (navBox) {
        navBox.style.transform = "scale(1)";
        navBox.style.boxShadow = "none";
      }
      return;
    }
    const navBox = document.getElementById("nav-box");
    if (!navBox) return;

    const rect = navBox.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.sqrt(
      Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
    );
    if (distance < proximityConfig.maxDistance) {
      const scale =
        1 +
        (proximityConfig.maxScale - 1) *
          (1 - distance / proximityConfig.maxDistance);
      navBox.style.transform = `scale(${scale})`;
      const shadowOpacity = 0.4 * (1 - distance / proximityConfig.maxDistance);
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim();
      navBox.style.boxShadow = `0 0 25px 3px rgba(${primaryColor}, ${shadowOpacity})`;
    } else {
      navBox.style.transform = "scale(1)";
      navBox.style.boxShadow = "none";
    }
  };
  document.addEventListener("mousemove", handleProximity);

  function closeMenu() {
    navContainer.classList.remove("hover-active");
    isTapActive = false;
    menuDismissOverlay.classList.remove("active");
  }

  function openMenu() {
    navContainer.classList.add("hover-active");
    isTapActive = true;
    const navBox = document.getElementById("nav-box");
    if (navBox) {
      navBox.style.transform = "scale(1)";
      navBox.style.boxShadow = "none";
    }
    menuDismissOverlay.classList.add("active");
  }

  navBox.addEventListener("click", (e) => {
    if (lastPointerType === "touch") return;
    if (!e.target.closest(".nav-list-item")) {
      e.stopPropagation();
      if (navContainer.classList.contains("hover-active")) closeMenu();
      else openMenu();
    }
  });

  navBox.addEventListener(
    "touchstart",
    (e) => {
      if (!e.target.closest(".nav-list-item")) {
        e.preventDefault();
        e.stopPropagation();
        if (navContainer.classList.contains("hover-active")) closeMenu();
        else openMenu();
      }
    },
    { passive: false }
  );

  navBox.addEventListener("mouseenter", () => {
    if (isTapActive || lastPointerType === "touch") return;
    navContainer.classList.add("hover-active");
  });

  navContainer.addEventListener("mouseleave", () => {
    if (isTapActive) return;
    navContainer.classList.remove("hover-active");
    handleProximity({ clientX: -9999, clientY: -9999, pointerType: "mouse" });
  });

  menuDismissOverlay.addEventListener("click", () => {
    if (navContainer.classList.contains("hover-active")) closeMenu();
  });

  navList.addEventListener("click", (e) => {
    const clickedElement = e.target.closest(".nav-list-item");

    if (clickedElement && !clickedElement.classList.contains("disabled")) {
      const url = clickedElement.getAttribute("data-url");
      const itemData = allNavItems.find((item) => item.url === url);
      if (itemData) {
        e.stopPropagation();
        handleNavClick(itemData, clickedElement);

        if (lastPointerType === "touch") {
          closeMenu();
        }
      }
    }
  });

  function showStartupNotification(isChangelog = false) {
    let overlay = document.querySelector(".welcome-overlay");
    let existingBox = document.querySelector(".welcome-modal-card");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "welcome-overlay";
      document.body.appendChild(overlay);
    }

    const data = isChangelog ? CHANGELOG_DATA : STARTUP_NOTIFICATION;
    const processedContent = processNotificationContent(data.content);
    const hasChangelogId = data.content.includes('id="showChangelog"');

    const box = document.createElement("div");
    box.className = `welcome-modal-card ui-card-base ${
      isChangelog ? "changelog-mode" : ""
    }`;
    box.style.width = `480px`;

    let secondaryBtnHtml = "";
    let primaryBtnHtml = "";

    if (isChangelog) {
      secondaryBtnHtml = `<button class="welcome-modal-confirm-button back-btn" id="modal-secondary-btn">Back</button>`;
    } else {
      if (!hasChangelogId) {
        secondaryBtnHtml = `<button class="welcome-modal-confirm-button back-btn" id="modal-secondary-btn">See All Changes</button>`;
      }
      primaryBtnHtml = `<button class="welcome-modal-confirm-button" id="modal-primary-btn">${data.buttonText}</button>`;
    }

    box.innerHTML = `
      <h2>${H2_TITLE_ICON(data.iconClass)}${data.title}</h2>
      <div class="welcome-modal-body ${isChangelog ? "scrollable" : ""}">
        <p>${processedContent}</p>
      </div>
      ${secondaryBtnHtml}
      ${primaryBtnHtml}
    `;

    if (existingBox) {
      existingBox.classList.add("hiding");
      setTimeout(() => {
        existingBox.remove();
        document.body.appendChild(box);
        requestAnimationFrame(() => {
          box.classList.add("visible");
          attachModalEvents(box, isChangelog);
        });
      }, 300);
    } else {
      document.body.appendChild(box);
      setTimeout(() => {
        overlay.classList.add("visible");
        box.classList.add("visible");
        attachModalEvents(box, isChangelog);
      }, 50);
    }
  }

  function attachModalEvents(box, isChangelog) {
    const primaryBtn = box.querySelector("#modal-primary-btn");
    const secondaryBtn = box.querySelector("#modal-secondary-btn");
    const overlay = document.querySelector(".welcome-overlay");
    const changelogLink = box.querySelector("#showChangelog");

    if (primaryBtn) {
      primaryBtn.addEventListener("click", () => {
        box.classList.add("hiding");
        overlay.classList.remove("visible");
        setTimeout(() => {
          overlay.remove();
          box.remove();
        }, 400);
      });
    }

    if (secondaryBtn) {
      secondaryBtn.addEventListener("click", () => {
        showStartupNotification(!isChangelog);
      });
    }

    if (changelogLink) {
      changelogLink.addEventListener("click", (e) => {
        e.preventDefault();
        showStartupNotification(true);
      });
    }
  }
  async function setupNavigation() {
    try {
      const response = await fetch("/asset/json/nav.json");
      allNavItems = await response.json();
      buildNavList();
    } catch (error) {
      console.error("Could not load nav items:", error);
    }
  }

  function buildNavList() {
    navList.innerHTML = "";
    allNavItems.forEach((item) => {
      const listItem = document.createElement("li");
      if (item.type === "item") {
        listItem.classList.add("nav-list-item");

        // --- Added: Disabled logic ---
        if (item.disabled) {
          listItem.classList.add("disabled");
          listItem.setAttribute("tabindex", "-1");
        }
        // -----------------------------

        listItem.setAttribute("data-url", item.url);

        let displayName = item.name;
        if (item.url === "/page/home.html" && window.online_users_count > 0) {
          displayName = `${window.online_users_count} online`;
        }
        let tagHtml = "";
        if (item.tag) {
          tagHtml = `<span class="nav-tag">${item.tag}</span>`;
        }

        listItem.innerHTML = `<i class="${item.iconClass}"></i><span class="nav-text">${displayName}</span>${tagHtml}`;
      } else if (item.type === "divider") {
        listItem.classList.add("divider");
      }
      navList.appendChild(listItem);
    });
    const listHeight = navList.scrollHeight;
    document.documentElement.style.setProperty(
      "--nav-expanded-height",
      `${listHeight}px`
    );
  }

  function transitionToNewPage(
    url,
    iconClass,
    pageName,
    activeElement,
    isSideAction = false
  ) {
    const oldIframe = document.getElementById("content-frame");

    currentPageIcon.className = `current-page-icon ${iconClass}`;

    resetSideButtonActiveState();
    document.querySelector(".nav-list-item.active")?.classList.remove("active");
    if (activeElement) activeElement.classList.add("active");

    if (oldIframe) {
      oldIframe.classList.add("nav-transitioning");
    }

    setTimeout(() => {
      if (oldIframe) oldIframe.remove();

      currentActivePageForServer = pageName;

      if (isSideAction) {
        currentActiveSideBtn = activeElement;
        currentActivePageForServer = "";
      }

      const newIframe = document.createElement("iframe");
      newIframe.id = "content-frame";
      newIframe.src = url;
      newIframe.classList.add("nav-transitioning");

      newIframe.addEventListener("load", () => {
        try {
          const iframeDoc =
            newIframe.contentDocument || newIframe.contentWindow.document;
          if (iframeDoc)
            newIframe.contentWindow.addEventListener(
              "mousemove",
              handleProximity
            );
        } catch (e) {}
      });

      iframeWrapper.appendChild(newIframe);

      requestAnimationFrame(() => {
        newIframe.classList.remove("nav-transitioning");
      });

      document.activeElement.blur();
    }, 250);
  }

  function handleNavClick(itemData, clickedElement) {
    if (!itemData.url) return;
    const pageName =
      itemData.url === "/page/home.html" ? "Home" : itemData.name || "";
    transitionToNewPage(
      itemData.url,
      itemData.iconClass,
      pageName,
      clickedElement
    );
  }

  loadingLogo.onload = () => loadingLogo.classList.add("loaded");

  const initialIframe = document.getElementById("content-frame");
  if (initialIframe) {
    initialIframe.addEventListener("load", () => {
      try {
        const iframeDoc =
          initialIframe.contentDocument || initialIframe.contentWindow.document;
        if (iframeDoc)
          initialIframe.contentWindow.addEventListener(
            "mousemove",
            handleProximity
          );
      } catch (e) {}
    });
  }

  await new Promise((resolve) => {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", resolve);
    else resolve();
  });

  await setupNavigation();

  loadingOverlay.classList.add("fade-out");
  setTimeout(() => {
    loadingOverlay.remove();
    const lastSeen = localStorage.getItem("vapor_last_notification");
    if (lastSeen !== JSON.stringify(STARTUP_NOTIFICATION)) {
      showStartupNotification();
      localStorage.setItem(
        "vapor_last_notification",
        JSON.stringify(STARTUP_NOTIFICATION)
      );
    }
  }, 400);

  const firstItem = allNavItems.find((item) => item.type === "item");
  if (firstItem) {
    const firstNavElement = document.querySelector(".nav-list-item");
    if (firstNavElement) firstNavElement.classList.add("active");
    currentPageIcon.className = `current-page-icon ${firstItem.iconClass}`;
    if (initialIframe) initialIframe.src = firstItem.url;
    currentActivePageForServer = "Home";
  }

  showWhatsNewBtn.addEventListener("click", () =>
    showStartupNotification(false)
  );

  settingsBtn.addEventListener("click", () => {
    transitionToNewPage(
      "/page/settings/index.html",
      "ri-settings-3-line",
      "",
      settingsBtn,
      true
    );
    closeMenu();
  });
})();
