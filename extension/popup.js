// ============================================================
// Audia — popup.js
// ============================================================

// ─── DOM References ──────────────────────────────────────
const micBtn          = document.getElementById("mic-btn");
const statusText      = document.getElementById("status-text");
const conversationLog = document.getElementById("conversation-log");
const emptyState      = document.getElementById("empty-state");
const pageDomain      = document.getElementById("page-domain");
const permScreen      = document.getElementById("permission-screen");
const allowMicBtn     = document.getElementById("allow-mic-btn");
const langSelect      = document.getElementById("lang-select");

// ─── Language Preference ─────────────────────────────────
let currentLang = "en-US";
chrome.storage.local.get("audia_lang", (data) => {
  if (data.audia_lang) {
    currentLang = data.audia_lang;
    if (langSelect) langSelect.value = currentLang;
  }
});
if (langSelect) {
  langSelect.addEventListener("change", (e) => {
    currentLang = e.target.value;
    chrome.storage.local.set({ audia_lang: currentLang });
  });
}

// ─── Permission Screen Logic ──────────────────────────────
// On popup open: check if mic is already granted.
// If not → show the onboarding screen with the Allow button.
async function checkAndRequestMicPermission() {
  try {
    const status = await navigator.permissions.query({ name: "microphone" });
    if (status.state === "granted") {
      // Already allowed — hide the screen, go straight to main UI
      permScreen.style.display = "none";
      return;
    }
    // "prompt" or "denied" — show the onboarding screen
    permScreen.style.display = "flex";

    // Keep watching for the user granting permission
    status.onchange = () => {
      if (status.state === "granted") {
        permScreen.style.display = "none";
      }
    };
  } catch (_) {
    // permissions API unavailable — hide screen, attempt mic on first use
    permScreen.style.display = "none";
  }
}

// Allow button: Opens the extension's options page where the user can
// grant microphone permissions properly, since Chrome MV3 popups cannot
// trigger the getUserMedia permission dialog.
allowMicBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close(); // Close the popup so the user focuses on the new tab
});

// Run permission check immediately when popup opens
checkAndRequestMicPermission();


// ─── State ───────────────────────────────────────────────
let state = "idle"; // idle | listening | processing | speaking
let currentAudio = null;

// ─── Capture tab info from background tracker ────────────
// The background script (background.js) persistently tracks
// the last active normal-window tab via chrome.tabs.onActivated.
// We read that here — much more reliable than querying tabs from
// inside the popup (where the popup window takes focus instantly).
let activeTabId = null;
let activeTabTitle = "";
let activeTabUrl = "";

chrome.storage.local.get(["audia_tabId", "audia_tabTitle", "audia_tabUrl"], (data) => {
  if (data.audia_tabId) {
    activeTabId    = data.audia_tabId;
    activeTabTitle = data.audia_tabTitle || "";
    activeTabUrl   = data.audia_tabUrl   || "";
    try {
      const url = new URL(activeTabUrl);
      const domain = url.hostname.replace("www.", "");
      pageDomain.textContent = domain.length > 22 ? domain.slice(0, 20) + "…" : domain;
    } catch (_) {
      pageDomain.textContent = "—";
    }
  } else {
    pageDomain.textContent = "no page tracked";
  }
});


// ─── State Management ────────────────────────────────────
function setState(newState) {
  state = newState;
  micBtn.className = "";
  statusText.className = "";

  switch (newState) {
    case "idle":
      micBtn.classList.add("state-idle");
      statusText.textContent = "Tap to speak";
      statusText.classList.remove("active");
      break;
    case "listening":
      micBtn.classList.add("state-listening");
      statusText.textContent = "Listening…";
      statusText.classList.add("active");
      break;
    case "processing":
      micBtn.classList.add("state-processing");
      statusText.textContent = "Thinking…";
      statusText.classList.add("active");
      break;
    case "speaking":
      micBtn.classList.add("state-speaking");
      statusText.textContent = "Speaking…";
      statusText.classList.add("active");
      break;
  }
}

// ─── Conversation Bubbles ─────────────────────────────────
function addBubble(text, role) {
  if (emptyState && emptyState.parentNode) emptyState.remove();

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const timeEl = document.createElement("span");
  timeEl.className = "bubble-time";
  timeEl.textContent = time;

  row.appendChild(bubble);
  row.appendChild(timeEl);
  conversationLog.appendChild(row);
  conversationLog.scrollTop = conversationLog.scrollHeight;

  const rows = conversationLog.querySelectorAll(".bubble-row");
  if (rows.length > 12) rows[0].remove();
}

// ─── Resolve Current Real Tab ─────────────────────────────
// Returns the active tab in the most-recently-focused NORMAL browser window.
// isRestricted = true means the page is chrome:// or extension page — content
// scripts can't run there, but chrome.tabs.update CAN still navigate it.
async function resolveCurrentTab() {
  return new Promise((resolve) => {
    chrome.windows.getAll({ windowTypes: ["normal"], populate: true }, (windows) => {
      if (!windows || windows.length === 0) { resolve(null); return; }
      const sorted = [...windows].sort((a, b) => b.id - a.id);
      for (const win of sorted) {
        // First pass: prefer a real browseable tab
        const realTab = (win.tabs || []).find(
          (t) => t.active && t.url &&
                 !t.url.startsWith("chrome://") &&
                 !t.url.startsWith("chrome-extension://") &&
                 !t.url.startsWith("about:")
        );
        if (realTab) { resolve({ ...realTab, isRestricted: false }); return; }
      }
      // Second pass: accept restricted tab (chrome://) — at least get the tabId
      // for navigation via chrome.tabs.update
      for (const win of sorted) {
        const anyTab = (win.tabs || []).find((t) => t.active);
        if (anyTab) { resolve({ ...anyTab, isRestricted: true }); return; }
      }
      resolve(null);
    });
  });
}

// ─── Popup-native Speech Recognition ──────────────────────
// Web Speech API runs directly in the popup HTML context.
// Chrome shows its OWN permission dialog when .start() is called
// for the first time — no getUserMedia() needed (which is blocked
// in MV3 extension popups).
let popupRecognition = null;

function startPopupSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addBubble("Speech recognition is not supported in this browser.", "ai");
    setState("idle");
    return;
  }

  if (popupRecognition) { try { popupRecognition.stop(); } catch (_) {} }

  const recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = currentLang;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    setState("listening");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    popupRecognition = null;
    addBubble(transcript, "user");
    processCommand(transcript);
  };

  recognition.onerror = (event) => {
    popupRecognition = null;
    setState("idle");
    console.warn("Speech error:", event.error);

    if (event.error === "not-allowed") {
      // Show the permission screen again so user can try once more
      permScreen.style.display = "flex";
      document.getElementById("perm-note").innerHTML =
        'Chrome blocked the mic. In Chrome\'s address bar type: <strong>chrome://settings/content/microphone</strong> — ensure Audia is not in the blocked list, then click Allow again.';
      allowMicBtn.textContent = "🎤 Allow Microphone";
      allowMicBtn.disabled = false;
    } else if (event.error === "no-speech") {
      addBubble("No speech detected — please speak clearly after tapping the mic.", "ai");
    } else if (event.error === "network") {
      addBubble("Network error. Speech recognition needs an internet connection.", "ai");
    } else {
      addBubble("Microphone error: " + event.error + ". Please try again.", "ai");
    }
  };

  recognition.onend = () => {
    popupRecognition = null;
    if (state === "listening") setState("idle");
  };

  popupRecognition = recognition;
  setState("listening");

  try {
    popupRecognition.start();
  } catch (e) {
    popupRecognition = null;
    setState("idle");
    addBubble("Could not start microphone: " + e.message, "ai");
  }
}

// ─── Start / Stop Listening ───────────────────────────────
// CRITICAL: Web Speech API must be called in the immediate user-gesture
// context. Start recognition FIRST (synchronous), then do async tab
// resolution in the background — otherwise Chrome silently blocks the mic.
async function startListening() {
  if (state !== "idle") return;

  // ── Step 1: Start mic IMMEDIATELY (preserves user gesture context) ──
  startPopupSpeechRecognition();

  // ── Step 2: Resolve tab + inject content script in background ───────
  resolveCurrentTab().then(async (tab) => {
    if (!tab) return;
    activeTabId    = tab.id;
    activeTabTitle = tab.title || "";
    activeTabUrl   = tab.url   || "";

    try {
      const url = new URL(activeTabUrl);
      const domain = url.hostname.replace("www.", "");
      pageDomain.textContent = domain.length > 22 ? domain.slice(0, 20) + "…" : domain;
    } catch (_) { pageDomain.textContent = "New Tab"; }

    if (!tab.isRestricted) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: "ping" });
      } catch (_) {
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        } catch (e) {
          console.warn("Audia: content.js injection failed:", e);
        }
      }
    }
  }).catch(() => {});
}

async function stopListening() {
  if (popupRecognition) { try { popupRecognition.stop(); } catch (_) {} popupRecognition = null; }
  setState("idle");
}

// ─── Core Processing Pipeline ─────────────────────────────
async function processCommand(transcript) {
  setState("processing");

  // Use the tab captured at popup-open time.
  // Do NOT re-query here — while the popup is open, currentWindow
  // resolves to the popup window, not the browser tab.
  if (!activeTabId) {
    addBubble("No active tab found. Try closing and reopening the popup.", "ai");
    setState("idle");
    return;
  }

  const pageTitle = activeTabTitle;
  const pageUrl   = activeTabUrl;

  // 2. Get DOM snapshot from content.js (or intercept PDFs)
  let domSnapshot = "";
  
  if (pageUrl.toLowerCase().endsWith(".pdf")) {
    // Highly efficient way to get PDF content without huge local libraries:
    // fetch the PDF and parse it using our lightweight Next.js backend endpoint 
    try {
      addBubble("Reading PDF content...", "ai");
      
      let parseData;
      if (pageUrl.startsWith("file://")) {
        const res = await fetch("http://localhost:3000/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: pageUrl })
        });
        parseData = await res.json();
      } else {
        const pdfResponse = await fetch(pageUrl);
        const pdfBlob = await pdfResponse.blob();
        
        const parseRes = await fetch("http://localhost:3000/api/pdf", {
          method: "POST",
          body: pdfBlob
        });
        parseData = await parseRes.json();
      }
      
      domSnapshot = parseData.text ? `[PDF CONTENT]\n${parseData.text.slice(0, 5000)}` : `TITLE: ${pageTitle}`;
    } catch (e) {
      console.warn("Could not read PDF:", e);
      domSnapshot = `TITLE: ${pageTitle}\n[Note: Error extracting PDF text]`;
    }
  } else {
    try {
      const snapshotResponse = await chrome.tabs.sendMessage(activeTabId, {
        action: "get_dom_snapshot"
      });
      domSnapshot = snapshotResponse?.domSnapshot || "";
    } catch (e) {
      console.warn("Could not get DOM snapshot:", e);
      domSnapshot = `TITLE: ${pageTitle}`;
    }
  }

  // 3. Send to background.js → Groq + Murf
  let groqResult = null;
  let audioData = null;

  try {
    const bgResponse = await chrome.runtime.sendMessage({
      action: "process_command",
      payload: { transcript, pageTitle, pageUrl, domSnapshot, lang: currentLang }
    });
    groqResult = bgResponse?.groqResult;
    audioData = bgResponse?.audioData;
  } catch (e) {
    console.error("Background message error:", e);
    addBubble("I had trouble connecting. Please try again.", "ai");
    setState("idle");
    return;
  }

  if (!groqResult) {
    addBubble("Something went wrong. No response from AI.", "ai");
    setState("idle");
    return;
  }

  // 4. Execute DOM actions
  if (groqResult.actions && groqResult.actions.length > 0) {
    const validActions = groqResult.actions.filter((a) => a.type !== "none");

    // ── goto_url: execute directly via chrome.tabs.update ───────────────────
    // This works on ANY tab including chrome:// NTP pages — no content script needed.
    for (const act of validActions) {
      if (act.type === "goto_url" && act.target) {
        chrome.tabs.update(activeTabId, { url: act.target });
      }
    }

    // ── All other actions: send to content.js ───────────────────────────────
    const contentActions = validActions.filter((a) => a.type !== "goto_url");
    if (contentActions.length > 0) {
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          action: "execute_actions",
          actions: contentActions
        });
      } catch (e) {
        console.warn("Could not execute content actions:", e);
      }
    }
  }

  // 5. Determine display text
  const displayText = groqResult.answer || groqResult.response_text || "Done.";
  addBubble(displayText, "ai");

  // 6. Play audio from Murf
  if (audioData) {
    setState("speaking");
    await playAudio(audioData);
  } else {
    // Fallback — no audio, just show text
    setState("speaking");
    await new Promise((r) => setTimeout(r, 1200));
  }

  setState("idle");
}

// ─── Audio Playback ───────────────────────────────────────
function playAudio(audioData) {
  return new Promise((resolve) => {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      
      const audioSource = audioData.startsWith("http") 
        ? audioData 
        : `data:audio/mp3;base64,${audioData}`;

      const audio = new Audio(audioSource);
      currentAudio = audio;
      audio.onended = () => {
        currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        currentAudio = null;
        resolve();
      };
      audio.play().catch(() => resolve());
    } catch (e) {
      resolve();
    }
  });
}

// ─── Receive Transcript from Content Script ──────────────
// content.js does the actual speech recognition (page context)
// and sends the result back here via chrome.runtime.sendMessage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "transcript_result") {
    const { transcript, error } = request;
    if (error || !transcript) {
      setState("idle");
      if (error && error !== "no-speech" && error !== "aborted") {
        addBubble("Couldn't hear you clearly. Please try again.", "ai");
      }
      return;
    }
    addBubble(transcript, "user");
    processCommand(transcript);
  }
});

// ─── Mic Button Click ─────────────────────────────────────
micBtn.addEventListener("click", () => {
  if (state === "idle") {
    startListening();
  } else if (state === "listening") {
    stopListening(); // stopListening sets state to idle internally
  } else if (state === "speaking") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    setState("idle");
  }
});

// ─── Space Bar Shortcut ───────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    if (state === "idle") {
      startListening();
    } else if (state === "listening") {
      stopListening();
    }
  }
});

// ─── Init ─────────────────────────────────────────────────
setState("idle");
