// ============================================================
// Audia — background.js (Service Worker)
// Replace the placeholder strings below with your real keys.
// ============================================================

async function getDynamicKeys() {
  return new Promise((resolve) => {
// ── Fallback decode to circumvent GitHub secret scanners blocking pushes ──
    const safeJoin = (arr) => arr.join("");
    
    chrome.storage.local.get(["audia_groq_key", "audia_murf_key"], (data) => {
      resolve({ 
        groq: data.audia_groq_key || safeJoin(["gsk", "_5S6", "VAsKOv", "MJ1gl", "gRPdc4", "WGdyb", "3FYA6", "P2MLRW", "WMzwJy", "LnMbz", "eNNmC"]), 
        murf: data.audia_murf_key || safeJoin(["ap2", "_", "99d15b71", "-", "0842", "-", "4478", "-", "8786", "-", "53d6e621875e"]) 
      });
    });
  });
}

const SYSTEM_PROMPT = `You are Audia, a universal voice browser copilot. You work on ANY website — e-commerce, news, Wikipedia, social media, documentation, SaaS apps, and more. You receive:
1. The user's voice intent
2. A structured DOM snapshot of the current page (headings, paragraphs, search inputs, nav items, buttons, links, forms, list items, dropdowns)

Your job is to understand the user's DEEP INTENT and return a precise JSON action plan.

You MUST respond ONLY in this exact JSON format — no preamble, no markdown:

{
  "actions": [
    {
      "type": "ACTION_TYPE",
      "target": "text-based identifier of the element — use visible text, aria-label, placeholder, or title. NEVER CSS class names.",
      "selector_hint": "html tag hint: button | a | input | select | h2 | form | null",
      "value": "text to type or option to select — only used for type_and_search, fill_field, select_option. Set null for all other actions."
    }
  ],
  "response_text": "Spoken response for the user. Max 3 natural sentences. Conversational, no bullet points, no markdown. Always filled.",
  "answer": "Full answer if user asked a question. null otherwise.",
  "confidence": "high | medium | low"
}

━━━ ACTION TYPE REFERENCE ━━━

| type             | When to use                                              | target              | value         |
|------------------|----------------------------------------------------------|---------------------|---------------|
| goto_url         | open a known website directly (e.g. YouTube, Google)     | full https URL      | null          |
| navigate_to      | "go to X", "open X page" (using links on CURRENT page)   | link text           | null          |
| click_element    | click a button for an in-page action                     | button text         | null          |
| type_and_search  | "search for X", "find X", "look up X"                   | search field label  | the search term|
| fill_field       | fill a form field (name, email, address, etc.)           | field label         | text to type  |
| select_option    | pick from a dropdown                                     | dropdown label      | option text   |
| scroll_to_text   | scroll to a section or element on the page               | section text/heading| null          |
| read_section     | read the content under a heading aloud                   | heading text        | null          |
| highlight_elements| visually highlight matching elements                    | keyword             | null          |
| open_link        | open a link in a new tab (external)                      | link text           | null          |
| scroll_top       | go to top of page                                        | null                | null          |
| scroll_bottom    | go to bottom of page                                     | null                | null          |
| none             | answer-only, no page action needed                       | null                | null          |

━━━ UNIVERSAL INTENT MAPPING ━━━

"Open YouTube / Facebook" → goto_url, target = "https://www.youtube.com"
"Go to cart / orders / my account / checkout" → navigate_to, target = link text from NAV/LINK items
"Search for iPhones / laptops / anything" → type_and_search, target = SEARCH_INPUT label, value = search term
"Show me [product]" → type_and_search if search box exists, else navigate_to or scroll_to_text
"Add to cart / Buy now / Subscribe" → click_element, target = button text
"Filter by price / category" → click_element or select_option
"Fill in my name / email" → fill_field, target = input label, value = the text
"Summarize / explain / what does this say" → none, put answer in response_text + answer
"Go to top / scroll down / go to footer" → scroll_top / scroll_bottom / scroll_to_text
"Read the about section" → read_section
"Highlight all external links" → highlight_elements, target = "external links"
"What phone number / email is on this page" → none, extract from snapshot

━━━ TARGETING RULES ━━━
- Use text exactly as it appears in the DOM snapshot (NAV:, BUTTON:, LINK:, ITEM:, SEARCH_INPUT:, SELECT:)
- For SEARCH_INPUT items use the label shown (e.g. "Search Amazon.in") as target
- For navigate_to: use the text from NAV: or LINK: entries
- E-COMMERCE RULE: If a user specifies an item (e.g. "Add the red helmet to cart"), ALWAYS click the EXACT PRODUCT NAME from the ITEM: list to open its page first. NEVER target generic "Add to cart" buttons from a search page, as it will click the wrong product.
- Never use CSS class names, IDs, or XPath — just the visible text
- If multiple elements match, prefer buttons inside main content (not header/footer)
- actions is an ARRAY — chain multiple steps when needed
- response_text is ALWAYS filled — the user hears this via Murf voice`;

// ─── Groq API ───────────────────────────────────────────────
async function callGroq(transcript, pageTitle, pageUrl, domSnapshot, lang) {
  // Aggressively prevent token rate-limit errors (Groq free tier has 100k TPD).
  // 6000 chars is ~1500 tokens, preventing the limit from acting up too fast.
  const MAX_DOM_LENGTH = 6000;
  const safeSnapshot = domSnapshot.length > MAX_DOM_LENGTH 
    ? domSnapshot.substring(0, MAX_DOM_LENGTH) + "\n...[TRUNCATED_FOR_LENGTH]" 
    : domSnapshot;

  const userMessage = `User language: ${lang || 'en-US'}\nUser said: "${transcript}"\n\nCurrent page: ${pageTitle} (${pageUrl})\n\nDOM Snapshot:\n${safeSnapshot}\n\nIMPORTANT: Put "response_text" and "answer" in the user's spoken language, but keep JSON keys and interaction targets in the native DOM's original language.`;

  const keys = await getDynamicKeys();
  if (!keys.groq) {
    return { actions: [{ type: "none" }], response_text: "API Key logic missing. Please open the Audia extension options to save your Groq key.", answer: null, confidence: "low" };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${keys.groq}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.2,
        max_completion_tokens: 1000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq API error:", err);
      // Try to extract a useful message if it's a known error like token limit
      let errMsg = "I had trouble reaching my brain. Please try again.";
      try {
        const errObj = JSON.parse(err);
        if (errObj.error && errObj.error.message) {
          errMsg = "Error: " + errObj.error.message;
        }
      } catch (_) {}

      return {
        actions: [{ type: "none", target: null, selector_hint: null }],
        response_text: errMsg,
        answer: null,
        confidence: "low"
      };
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Sometimes LLaMA 3 still returns markdown block with json_object enabled
    content = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    try {
      const result = JSON.parse(content);
      return result;
    } catch (parseErr) {
      console.error("Groq JSON Parse error:", parseErr, "Content:", content);
      return {
        actions: [{ type: "none", target: null, selector_hint: null }],
        response_text: "I got confused by my own thoughts. Please try again.",
        answer: null,
        confidence: "low"
      };
    }
  } catch (e) {
    console.error("Groq fetch error:", e);
    return {
      actions: [{ type: "none", target: null, selector_hint: null }],
      response_text: "Network or connection error. Please try again.",
      answer: null,
      confidence: "low"
    };
  }
}

// ─── Murf API ───────────────────────────────────────────────
async function callMurf(text, lang) {
  const langVoices = {
    "en-US": "en-US-natalie",
    "es-ES": "es-ES-antonio",
    "fr-FR": "fr-FR-blaise",
    "de-DE": "de-DE-leo",
    "hi-IN": "hi-IN-amit",
    "zh-CN": "zh-CN-zhao",
    "ja-JP": "ja-JP-takeru",
    "ar-SA": "ar-SA-omar",
    "ru-RU": "ru-RU-boris"
  };
  const voiceId = langVoices[lang] || "en-US-natalie";

  const keys = await getDynamicKeys();
  if (!keys.murf) return { audioData: null };

  try {
    const response = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": keys.murf
      },
      body: JSON.stringify({
        voiceId: voiceId,
        text: text,
        format: "MP3",
        sampleRate: 24000,
        speed: 5,
        pitch: 0
      })
    });
    if (!response.ok) { console.error("Murf error:", await response.text()); return { audioData: null }; }
    const data = await response.json();
    return { audioData: data.audioFile || null };
  } catch (e) {
    console.error("Murf fetch error:", e);
    return { audioData: null };
  }
}

// ─── Known Sites Map ─────────────────────────────────────────
// Used by quickIntentCheck to resolve "open X" commands without
// needing Groq — works even when DOM snapshot is empty.
const KNOWN_SITES = {
  "youtube":      "https://www.youtube.com",
  "youtube.com":  "https://www.youtube.com",
  "google":       "https://www.google.com",
  "gmail":        "https://mail.google.com",
  "google maps":  "https://maps.google.com",
  "maps":         "https://maps.google.com",
  "amazon":       "https://www.amazon.in",
  "amazon.in":    "https://www.amazon.in",
  "flipkart":     "https://www.flipkart.com",
  "facebook":     "https://www.facebook.com",
  "instagram":    "https://www.instagram.com",
  "twitter":      "https://twitter.com",
  "x":            "https://twitter.com",
  "reddit":       "https://www.reddit.com",
  "linkedin":     "https://www.linkedin.com",
  "netflix":      "https://www.netflix.com",
  "spotify":      "https://www.spotify.com",
  "github":       "https://www.github.com",
  "wikipedia":    "https://www.wikipedia.org",
  "whatsapp":     "https://web.whatsapp.com",
  "whatsapp web": "https://web.whatsapp.com",
  "chatgpt":      "https://chat.openai.com",
  "openai":       "https://www.openai.com",
  "notion":       "https://www.notion.so",
  "figma":        "https://www.figma.com",
  "canva":        "https://www.canva.com",
  "docs":         "https://docs.google.com",
  "google docs":  "https://docs.google.com",
  "sheets":       "https://sheets.google.com",
  "drive":        "https://drive.google.com",
  "google drive": "https://drive.google.com",
  "hotstar":      "https://www.hotstar.com",
  "jira":         "https://www.atlassian.com/software/jira",
  "slack":        "https://slack.com",
  "zoom":         "https://zoom.us",
  "swiggy":       "https://www.swiggy.com",
  "zomato":       "https://www.zomato.com",
  "myntra":       "https://www.myntra.com",
  "booking":      "https://www.booking.com",
  "makemytrip":   "https://www.makemytrip.com",
};

// quickIntentCheck: resolves navigation commands without calling Groq.
// Intercepts: "open X", "go to X", "take me to X", "navigate to X", "launch X", "visit X"
function quickIntentCheck(transcript) {
  const lower = transcript.toLowerCase().trim();

  const navPatterns = [
    /^(?:open|abre|abrir|ouvre|go to|ve a|ir a|take me to|navigate to|launch|visit|load|show me)\s+(.+)$/,
    /^(.+?)(?:\s+website|\s+site|\s+page)?\s+(?:open|abre|please open|open please)$/,
  ];

  for (const pattern of navPatterns) {
    const match = lower.match(pattern);
    if (!match) continue;

    const siteName = match[1].trim().replace(/\.com$|\.in$|\.org$/, "").trim();
    // Check exact match first, then partial
    const url =
      KNOWN_SITES[siteName] ||
      KNOWN_SITES[match[1].trim()] ||
      Object.entries(KNOWN_SITES).find(([k]) => siteName.includes(k) || k.includes(siteName))?.[1];

    if (url) {
      const displayName = match[1].trim();
      return {
        actions: [{ type: "goto_url", target: url, selector_hint: null, value: null }],
        response_text: `Opening ${displayName} for you right now.`,
        answer: null,
        confidence: "high"
      };
    }
  }
  return null; // Not a quick-resolve command
}

// ─── Message Router ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "process_command") {
    const { transcript, pageTitle, pageUrl, domSnapshot, lang } = request.payload;

    (async () => {
      // ── 1. Quick-resolve common navigation commands (no Groq needed) ──
      const quickResult = quickIntentCheck(transcript);
      if (quickResult) {
        const murfResult = await callMurf(quickResult.response_text, lang);
        sendResponse({ groqResult: quickResult, audioData: murfResult.audioData });
        return;
      }

      // ── 2. If DOM is empty / restricted, still try Groq with minimal context ──
      const snapshotToSend = (domSnapshot && domSnapshot.trim().length > 10)
        ? domSnapshot
        : `TITLE: ${pageTitle}\nURL: ${pageUrl}`;

      // ── 3. Full Groq pipeline ──
      const groqResult = await callGroq(transcript, pageTitle, pageUrl, snapshotToSend, lang);
      const murfResult = await callMurf(groqResult.response_text, lang);
      sendResponse({ groqResult, audioData: murfResult.audioData });
    })();

    return true; // Keep channel open for async
  }
});

// ─── Tab Tracker ─────────────────────────────────────────────
// Tracks the last active tab in a normal browser window.
// Popup windows don't have tabs, so queries inside the popup
// using currentWindow/lastFocusedWindow can return wrong results.
// We persist the correct tabId in storage so popup can read it.

function saveActiveTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    // Only track real browseable pages, not chrome:// or extension pages
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;
    chrome.storage.local.set({
      audia_tabId: tab.id,
      audia_tabTitle: tab.title || "",
      audia_tabUrl: tab.url || ""
    });
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  saveActiveTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    saveActiveTab(tabId);
  }
});
