# Audia — Voice Browser Copilot

Audia is a Chrome extension that lets you control and understand any webpage using natural language voice commands. Powered by Groq's LLaMA 3.3 70B for deep intent understanding and Murf AI for lifelike voice responses.

---

## Setup

### 1. Add your API keys

Open `extension/background.js` and replace the placeholders at the top:

```js
const GROQ_API_KEY = "YOUR_GROQ_API_KEY";   // https://console.groq.com
const MURF_API_KEY = "YOUR_MURF_API_KEY";   // https://murf.ai/api
```

### 2. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load Unpacked**
4. Select the `extension/` folder from this project

### 3. Use it

- Click the **Audia icon** in your Chrome toolbar
- Press the **mic button** or hit **Space** to start speaking
- Say your command — Audia will understand, act, and respond with voice

---

## Best Demo Commands

Try these on any webpage:

1. **"Summarize this entire page in 3 sentences."**
2. **"Is there a pricing section? Take me there."**
3. **"Find and highlight all external links on this page."**
4. **"Explain this page like I'm 12 years old."**
5. **"Go to the FAQ section and read me the first 3 questions."**
6. **"What phone number or email is on this page?"**
7. **"Find the most important button on this page and click it."**
8. **"Find all headings on this page and list them."**

---

## Architecture

```
popup.html / popup.js  ←→  background.js  ←→  Groq API (LLaMA 3.3 70B)
        ↓                                  ←→  Murf AI (TTS)
   content.js  (DOM snapshot + action execution)
```

- **popup.js** — state machine, speech recognition, UI, audio playback
- **background.js** — orchestrates Groq + Murf API calls
- **content.js** — extracts DOM snapshot, executes actions on the page
- **styles.css** — dark terminal aesthetic with DM Mono font

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (MV3) |
| `popup.html` | Extension popup UI |
| `popup.js` | Core logic, state machine |
| `background.js` | Service worker, API calls |
| `content.js` | Page DOM interaction |
| `styles.css` | UI styles |

---

## Requirements

- Chrome 88+ (for Manifest V3 support)
- Groq API key (free tier available at [console.groq.com](https://console.groq.com))
- Murf AI API key ([murf.ai/api](https://murf.ai/api))
- Internet connection (for API calls)
