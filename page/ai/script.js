const BASE = BURLFULL + "/worker/aichat";
const MAX_CONTEXT_MESSAGES = 15;

let conversationHistory = [];
let isGenerating = false;
let isFirstMessage = true;
let previousRetryButton = null;
let aiPersonality = localStorage.getItem("vaiPersonality") || "";
let currentModel = "auto";

const md = window
  .markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre class="hljs"><code class="language-' +
            lang +
            '">' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true })
              .value +
            "</code></pre>"
          );
        } catch (__) {}
      }

      const langClass = lang ? 'class="language-' + lang + '"' : "";

      return (
        '<pre class="hljs"><code ' +
        langClass +
        ">" +
        md.utils.escapeHtml(str) +
        "</code></pre>"
      );
    },
  })
  .use(texmath, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } },
  });

function renderMarkdown(text, targetContainer) {
  const rawHtml = md.render(text);
  targetContainer.innerHTML = rawHtml;

  const codeBlocks = targetContainer.querySelectorAll("pre.hljs");
  codeBlocks.forEach((pre) => {
    if (pre.parentElement.classList.contains("code-block-container")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-container ai-block";

    const codeEl = pre.querySelector("code");
    let lang = "text";
    if (codeEl) {
      const langClass = Array.from(codeEl.classList).find((c) =>
        c.startsWith("language-")
      );
      if (langClass) lang = langClass.replace("language-", "");
    }

    const topBar = document.createElement("div");
    topBar.className = "code-block-top-bar";

    const langSpan = document.createElement("span");
    langSpan.className = "code-block-language";
    langSpan.textContent = lang;

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-block-copy-button";
    copyBtn.innerHTML = `<i class="ri-file-copy-line"></i><span class="copy-text">Copy</span>`;

    wrapper.dataset.code = codeEl ? codeEl.innerText : "";

    topBar.appendChild(langSpan);
    topBar.appendChild(copyBtn);
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(topBar);
    wrapper.appendChild(pre);
    pre.className = "code-block-pre";
  });

  Array.from(targetContainer.children).forEach((child) => {
    child.classList.add("ai-block");
    child.style.opacity = "1";
  });
}

const inputBar = document.querySelector(".input-bar");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const messagesContainer = document.getElementById("messages-container");
const startScreen = document.getElementById("start-screen");
const scrollBtn = document.getElementById("scroll-to-bottom-btn");
const modelDropdownToggle = document.getElementById("model-dropdown-toggle");
const modelOptions = document.querySelectorAll(".option");
const modelWrapper = document.getElementById("model-dropdown-wrapper");
const currentModelIcon = document.getElementById("current-model-icon");
const currentModelText = document.getElementById("current-model-text");
const personalityWrapper = document.getElementById(
  "personality-dropdown-wrapper"
);
const personalityBtn = document.getElementById("personality-select-button");
const personalityInput = document.getElementById("personality-textarea");
const savePersonalityBtn = document.getElementById("save-personality-btn");
const saveStatus = document.getElementById("save-status");

if (personalityInput) {
  personalityInput.value = aiPersonality;
}

const defaultInputWidth = "400px";
const focusedInputWidth = "420px";

modelDropdownToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  modelWrapper.classList.toggle("open");
  personalityWrapper.classList.remove("open");
});

personalityBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  personalityWrapper.classList.toggle("open");
  modelWrapper.classList.remove("open");
});

modelOptions.forEach((option) => {
  option.addEventListener("click", () => {
    currentModel = option.dataset.model;
    modelOptions.forEach((opt) => opt.classList.remove("selected"));
    option.classList.add("selected");

    const selectedIconClass = option.querySelector("i").className;
    const selectedText = option.querySelector("span").textContent;

    currentModelIcon.className = selectedIconClass;
    currentModelText.textContent = selectedText;

    modelWrapper.classList.remove("open");
  });
});

savePersonalityBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  aiPersonality = personalityInput.value.trim().replace(/"/g, "'");
  localStorage.setItem("vaiPersonality", aiPersonality);

  saveStatus.style.opacity = "1";
  savePersonalityBtn.classList.add("success");
  savePersonalityBtn.innerText = "Saved";

  setTimeout(() => {
    saveStatus.style.opacity = "0";
    savePersonalityBtn.classList.remove("success");
    savePersonalityBtn.innerText = "Save Changes";
    personalityWrapper.classList.remove("open");
  }, 1000);
});
personalityInput.addEventListener("click", (e) => e.stopPropagation());

document.addEventListener("click", (e) => {
  if (modelWrapper && !modelWrapper.contains(e.target)) {
    modelWrapper.classList.remove("open");
  }
  if (personalityWrapper && !personalityWrapper.contains(e.target)) {
    personalityWrapper.classList.remove("open");
  }
});

function setSendButtonState(disabled) {
  if (disabled) {
    sendButton.classList.add("disabled");
    sendButton.style.pointerEvents = "none";
  } else {
    sendButton.classList.remove("disabled");
    sendButton.style.pointerEvents = "auto";
  }
}

function createMessageElement(type) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}-message`;
  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";
  messageDiv.appendChild(contentDiv);
  return { element: messageDiv, contentContainer: contentDiv };
}

function createActionsBar(aiMessageElement, userMessage, isLastMessage) {
  const actionsContainer = document.createElement("div");
  actionsContainer.className = "message-actions-container";
  const actionsBar = document.createElement("div");
  actionsBar.className = "message-actions";
  actionsContainer.appendChild(actionsBar);

  const createButton = (icon, action, delay) => {
    const button = document.createElement("button");
    button.className = "action-button";
    button.innerHTML = `<i class="${icon}"></i>`;
    button.dataset.action = action;
    button.style.transition = `opacity 0.5s ease ${delay}ms, color 0.35s ease, background-color 0.35s ease`;
    return button;
  };

  const copyButton = createButton("ri-file-copy-line", "copy", 0);
  copyButton.addEventListener("click", () => {
    const textToCopy =
      aiMessageElement.querySelector(".message-content").innerText;
    navigator.clipboard.writeText(textToCopy);
    copyButton.innerHTML = '<i class="ri-check-line" style="color: lime;"></i>';
    setTimeout(() => {
      copyButton.innerHTML = '<i class="ri-file-copy-line"></i>';
    }, 1500);
  });

  const retryButton = createButton("ri-refresh-line", "retry", 150);
  if (isLastMessage) {
    if (previousRetryButton) previousRetryButton.classList.remove("can-retry");
    retryButton.classList.add("can-retry");
    previousRetryButton = retryButton;

    retryButton.addEventListener("click", () => {
      if (isGenerating) return;
      if (
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === "assistant"
      ) {
        conversationHistory.pop();
      }
      aiMessageElement.remove();
      actionsContainer.remove();
      const lastUserMsg =
        conversationHistory.length > 0
          ? conversationHistory[conversationHistory.length - 1].content
          : userMessage;
      if (
        conversationHistory.length > 0 &&
        conversationHistory[conversationHistory.length - 1].role === "user"
      ) {
        conversationHistory.pop();
      }
      startAiResponse(lastUserMsg);
    });
  }

  actionsBar.appendChild(copyButton);
  actionsBar.appendChild(createButton("ri-thumb-up-line", "thumb-up", 50));
  actionsBar.appendChild(createButton("ri-thumb-down-line", "thumb-down", 100));
  actionsBar.appendChild(retryButton);

  setTimeout(() => {
    actionsBar
      .querySelectorAll(".action-button")
      .forEach((btn) => (btn.style.opacity = "1"));
  }, 50);

  return actionsContainer;
}

function checkScrollButtonVisibility() {
  const isBelowFold =
    messagesContainer.scrollTop + messagesContainer.clientHeight <
    messagesContainer.scrollHeight - 100;
  if (
    messagesContainer.scrollHeight > messagesContainer.clientHeight &&
    isBelowFold
  ) {
    scrollBtn.classList.add("show");
  } else {
    scrollBtn.classList.remove("show");
  }
}

scrollBtn.addEventListener("click", () => {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: "smooth",
  });
});

async function startAiResponse(userMessage) {
  isGenerating = true;
  setSendButtonState(true);

  const typingIndicator = document.createElement("div");
  typingIndicator.className = "message ai-message typing-indicator show";
  typingIndicator.innerHTML = `<div class="message-content">
      <i class="ri-shining-2-fill typing-spinner"></i>
      <span class="typing-text">One moment...</span>
    </div>`;
  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: "smooth",
  });

  const { element: aiMsgElement, contentContainer } =
    createMessageElement("ai");
  messagesContainer.appendChild(aiMsgElement);

  let fullAiResponse = "";
  let buffer = "";

  try {
    const historySlice = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);

    const response = await fetch(`${BASE}/chat/${currentModel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        req: userMessage,
        history: historySlice,
        personality: aiPersonality,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "API Error");
    }

    typingIndicator.remove();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.replace("data: ", "");
        if (dataStr === "[DONE]") break;

        try {
          const json = JSON.parse(dataStr);
          const content = json.choices[0].delta?.content || "";
          fullAiResponse += content;

          renderMarkdown(fullAiResponse, contentContainer);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (e) {
          buffer = line + "\n" + buffer;
        }
      }
    }

    conversationHistory.push({ role: "user", content: userMessage });
    conversationHistory.push({ role: "assistant", content: fullAiResponse });
  } catch (error) {
    if (typingIndicator) typingIndicator.remove();
    contentContainer.innerHTML = `<span style="color: #ff4444;">Error: ${error.message}</span>`;
  } finally {
    isGenerating = false;
    setSendButtonState(false);

    const actions = createActionsBar(aiMsgElement, userMessage, true);
    messagesContainer.appendChild(actions);
    checkScrollButtonVisibility();
  }
}
function sendMessage() {
  const userMessage = messageInput.value.trim();
  if (!userMessage || isGenerating) return;
  if (isFirstMessage) {
    startScreen.classList.add("gone");
    isFirstMessage = false;
  }
  const { element, contentContainer } = createMessageElement("user");
  contentContainer.textContent = userMessage;
  messagesContainer.appendChild(element);
  setTimeout(() => {
    contentContainer.classList.add("show");
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: "smooth",
    });
  }, 10);
  messageInput.value = "";
  startAiResponse(userMessage);
}

sendButton.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputBar.addEventListener(
  "focus",
  () => {
    if (window.innerWidth > 650) inputBar.style.width = focusedInputWidth;
  },
  true
);
inputBar.addEventListener(
  "blur",
  () => {
    if (window.innerWidth > 650) inputBar.style.width = defaultInputWidth;
  },
  true
);

messagesContainer.addEventListener("scroll", checkScrollButtonVisibility);

messagesContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".code-block-copy-button");
  if (button) {
    const container = button.closest(".code-block-container");
    const codeToCopy = container.dataset.code;
    navigator.clipboard.writeText(codeToCopy).then(() => {
      const icon = button.querySelector("i");
      const text = button.querySelector(".copy-text");
      icon.className = "ri-check-line";
      text.textContent = "Copied!";
      button.style.color = "lime";
      setTimeout(() => {
        icon.className = "ri-file-copy-line";
        text.textContent = "Copy";
        button.style.color = "";
      }, 2000);
    });
  }
});
