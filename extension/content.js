// ============================================================
// Audia — content.js  (v2 — Deep E-Commerce Mode)
// Handles:
//   1. Speech recognition (page context has mic access)
//   2. Deep DOM snapshot (strips noise, adds semantic attrs)
//   3. XPath + Shadow DOM + iFrame element resolution
//   4. Clickability verification before acting
// ============================================================

(function () {
  "use strict";

  // ════════════════════════════════════════════════════════
  // SECTION 1 — SPEECH RECOGNITION
  // ════════════════════════════════════════════════════════

  let recognition = null;
  let currentLang = "en-US";
  try {
    chrome.storage.local.get("audia_lang", (data) => {
      if (data && data.audia_lang) currentLang = data.audia_lang;
    });
  } catch (e) {}

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = currentLang;
    r.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      chrome.runtime.sendMessage({ action: "transcript_result", transcript });
    };
    r.onerror = (event) => {
      chrome.runtime.sendMessage({ action: "transcript_result", transcript: null, error: event.error });
    };
    r.onend = () => { recognition = null; };
    return r;
  }

  function startListening() {
    if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
    recognition = initRecognition();
    if (!recognition) {
      chrome.runtime.sendMessage({ action: "transcript_result", transcript: null, error: "not-supported" });
      return;
    }
    try { recognition.start(); } catch (e) {
      chrome.runtime.sendMessage({ action: "transcript_result", transcript: null, error: e.message });
    }
  }

  function stopListening() {
    if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
  }

  // ════════════════════════════════════════════════════════
  // SECTION 2 — DEEP DOM SNAPSHOT (clean, token-efficient)
  // ════════════════════════════════════════════════════════

  function extractDOMSnapshot() {
    try {
      const snapshot = [];
      snapshot.push(`TITLE: ${document.title}`);

      const meta = document.querySelector('meta[name="description"]');
      if (meta) snapshot.push(`META: ${meta.content.slice(0, 200)}`);

      // Headings
      document.querySelectorAll("h1,h2,h3,h4").forEach((h) => {
        const text = h.innerText?.trim().slice(0, 120);
        if (text) snapshot.push(`${h.tagName}: ${text}`);
      });

      // Paragraphs — max 10
      let pCount = 0;
      document.querySelectorAll("p").forEach((p) => {
        if (pCount >= 10) return;
        const text = p.innerText?.trim();
        if (text && text.length > 30) {
          snapshot.push(`P: ${text.slice(0, 250)}`);
          pCount++;
        }
      });

      // Search inputs — critical for "search for X" commands
      document.querySelectorAll('input[type="search"], input[type="text"], input[placeholder*="search" i], input[aria-label*="search" i]').forEach((el) => {
        const label = el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("title") || el.name || "search";
        snapshot.push(`SEARCH_INPUT: ${label}`);
      });

      // Select dropdowns and their options (first 8 opts each)
      document.querySelectorAll("select").forEach((sel) => {
        const label = sel.getAttribute("aria-label") || sel.getAttribute("title") || sel.name || "dropdown";
        const opts = Array.from(sel.options).slice(0, 8).map((o) => o.text.trim()).filter(Boolean).join(" | ");
        if (opts) snapshot.push(`SELECT [${label}]: ${opts}`);
      });

      // Nav items (links in nav/header) — max 15
      let navCount = 0;
      document.querySelectorAll("nav a, header a, [role='navigation'] a").forEach((a) => {
        if (navCount >= 15) return;
        const text = a.innerText?.trim();
        if (text && text.length > 1 && text.length < 60) {
          snapshot.push(`NAV: ${text}`);
          navCount++;
        }
      });

      // Tab/filter items (e.g. category tabs, filter chips)
      let tabCount = 0;
      document.querySelectorAll('[role="tab"], [role="option"], .filter-item, [data-tab]').forEach((el) => {
        if (tabCount >= 10) return;
        const text = el.innerText?.trim();
        if (text && text.length < 60) {
          snapshot.push(`TAB: ${text}`);
          tabCount++;
        }
      });

      // List items — product names, menu entries, search results (max 10)
      let listCount = 0;
      document.querySelectorAll("li, [role='listitem'], article").forEach((li) => {
        if (listCount >= 10) return;
        const headingEl = li.querySelector("h1,h2,h3,h4,h5,a");
        const text = (headingEl || li).innerText?.trim().slice(0, 120);
        if (text && text.length > 5) {
          snapshot.push(`ITEM: ${text}`);
          listCount++;
        }
      });

      // Interactive elements — buttons, links, inputs — semantic attrs only
      const interactiveSelectors = [
        'button',
        '[role="button"]',
        'a[href]',
        'input:not([type="hidden"]):not([type="search"]):not([type="text"])',
        '[tabindex]:not([tabindex="-1"])',
      ];
      const seen = new Set();
      let interactiveCount = 0;
      document.querySelectorAll(interactiveSelectors.join(",")).forEach((el) => {
        if (interactiveCount >= 35) return;
        const text = (
          el.innerText?.trim() ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("placeholder") ||
          el.value ||
          ""
        ).slice(0, 80);
        if (!text || text.length < 2 || seen.has(text.toLowerCase())) return;
        seen.add(text.toLowerCase());
        const role = el.getAttribute("role") || el.tagName.toLowerCase();
        const ariaLabel = el.getAttribute("aria-label") ? ` [aria="${el.getAttribute("aria-label")}"]` : "";
        snapshot.push(`${role.toUpperCase()}: ${text}${ariaLabel}`);
        interactiveCount++;
      });

      // Forms
      document.querySelectorAll("form").forEach((form, i) => {
        const inputs = Array.from(form.querySelectorAll("input,textarea,select"))
          .map((el) => el.placeholder || el.getAttribute("aria-label") || el.name || el.type)
          .filter(Boolean).join(", ");
        if (inputs) snapshot.push(`FORM ${i + 1}: ${inputs}`);
      });

      return snapshot.join("\n").slice(0, 4500);
    } catch (e) {
      console.error("Audia snapshot error:", e);
      return "";
    }
  }

  // ════════════════════════════════════════════════════════
  // SECTION 3 — ELEMENT RESOLUTION ENGINE
  // Priority: XPath → Semantic Attrs → Shadow DOM → iFrame
  // ════════════════════════════════════════════════════════

  /**
   * Master find function — tries all strategies in order.
   * Returns { el, context } where context is the owning document.
   */
  function findElement(keyword, selectorHint) {
    if (!keyword) return null;
    const kw = keyword.toLowerCase().trim();

    // 1. XPath — most stable for e-commerce (text-based, ignores classes)
    const xpathResult = findByXPath(kw, selectorHint, document);
    if (xpathResult) return { el: xpathResult, context: document };

    // 2. Semantic attribute search
    const semanticResult = findBySemantic(kw, document);
    if (semanticResult) return { el: semanticResult, context: document };

    // 3. Shadow DOM deep traversal
    const shadowResult = findInShadowDOM(document.body, kw);
    if (shadowResult) return { el: shadowResult, context: document };

    // 4. iFrame context switch (same-origin only)
    const iframeResult = findInIframes(kw, selectorHint);
    if (iframeResult) return iframeResult;

    return null;
  }

  /** XPath search — ignores dynamic class names, works on text/aria/title */
  function findByXPath(kw, hint, root) {
    // Build XPath candidates based on hint tag if available
    const tags = hint
      ? [hint, "*"]
      : ["button", "a", "*[@role='button']", "input", "*"];

    const xpaths = [];
    tags.forEach((tag) => {
      xpaths.push(
        // Exact text
        `//${tag}[normalize-space(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'))='${kw}']`,
        // Contains text
        `//${tag}[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')]`,
        // aria-label
        `//${tag}[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')]`,
        // title
        `//${tag}[contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')]`,
      );
    });

    for (const xpath of xpaths) {
      try {
        const iter = root.evaluate(xpath, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        const candidates = [];
        let node;
        while ((node = iter.iterateNext())) {
          candidates.push(node);
        }
        if (candidates.length === 0) continue;
        // If multiple matches, prefer the one in the main content area (not header/footer)
        const best = disambiguate(candidates);
        if (best) return best;
      } catch (_) {}
    }
    return null;
  }

  /** Semantic attribute search — aria-label, placeholder, role, title */
  function findBySemantic(kw, root) {
    const selectors = [
      `[aria-label*="${kw}" i]`,
      `[title*="${kw}" i]`,
      `[placeholder*="${kw}" i]`,
      `[role="button"]`,
    ];
    for (const sel of selectors) {
      try {
        const els = Array.from(root.querySelectorAll(sel)).filter((el) => {
          const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
          return text.includes(kw);
        });
        if (els.length > 0) return disambiguate(els);
      } catch (_) {}
    }
    return null;
  }

  /**
   * Recursive Shadow DOM traversal.
   * Walks every element's shadowRoot looking for text/aria matches.
   */
  function findInShadowDOM(root, kw, depth = 0) {
    if (depth > 8) return null; // Safety limit
    const all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of all) {
      // Check this element's text/aria
      const text = (
        el.innerText?.trim() ||
        el.getAttribute?.("aria-label") ||
        el.getAttribute?.("title") ||
        ""
      ).toLowerCase();
      if (text.includes(kw) && isLeafOrInteractive(el)) {
        return el;
      }
      // Recurse into shadow root
      if (el.shadowRoot) {
        const found = findInShadowDOM(el.shadowRoot, kw, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  /** iFrame context switch (same-origin iframes only) */
  function findInIframes(kw, hint) {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      try {
        const iDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iDoc) continue;
        const xpathResult = findByXPath(kw, hint, iDoc);
        if (xpathResult) return { el: xpathResult, context: iDoc };
        const semanticResult = findBySemantic(kw, iDoc);
        if (semanticResult) return { el: semanticResult, context: iDoc };
      } catch (_) {
        // Cross-origin iframe — browser blocks access, skip
      }
    }
    return null;
  }

  /** When multiple elements match, pick the most likely primary action target */
  function disambiguate(candidates) {
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Prefer elements NOT in header/nav/footer
    const mainCandidates = candidates.filter((el) => {
      const parent = el.closest("header, nav, footer, [role='navigation'], [role='banner']");
      return !parent;
    });
    const pool = mainCandidates.length > 0 ? mainCandidates : candidates;

    // Score by: is a button/CTA > is in main/article > closest to center of viewport
    const scored = pool.map((el) => {
      let score = 0;
      const tag = el.tagName?.toLowerCase();
      const role = el.getAttribute?.("role");
      if (tag === "button" || role === "button") score += 10;
      if (tag === "a") score += 5;
      if (el.closest("main, article, [role='main'], section")) score += 8;
      // Viewport proximity
      const rect = el.getBoundingClientRect();
      const distFromCenter = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
      score -= Math.floor(distFromCenter / 100);
      return { el, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].el;
  }

  function isLeafOrInteractive(el) {
    const tag = el.tagName?.toLowerCase();
    const role = el.getAttribute?.("role");
    return (
      tag === "button" ||
      tag === "a" ||
      tag === "input" ||
      role === "button" ||
      role === "link" ||
      el.children?.length <= 2
    );
  }

  // ════════════════════════════════════════════════════════
  // SECTION 4 — CLICKABILITY VERIFICATION
  // ════════════════════════════════════════════════════════

  function isElementClickable(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.pointerEvents === "none") return false;
    if (style.display === "none") return false;
    if (style.visibility === "hidden") return false;
    if (parseFloat(style.opacity) < 0.1) return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    // Overlay / obstruction check
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx >= 0 && cy >= 0) {
      const topEl = document.elementFromPoint(cx, cy);
      if (topEl && topEl !== el && !el.contains(topEl)) {
        const topStyle = window.getComputedStyle(topEl);
        const zIndex = parseInt(topStyle.zIndex) || 0;
        const elZIndex = parseInt(style.zIndex) || 0;
        if (
          (topStyle.position === "fixed" || topStyle.position === "absolute") &&
          zIndex > elZIndex
        ) {
          // Covered by a sticky/modal overlay — try to dismiss it first
          dismissOverlay(topEl);
          return false;
        }
      }
    }
    return true;
  }

  /** Try to close modal/cookie/popup overlays blocking the target */
  function dismissOverlay(overlayEl) {
    const closeTriggers = [
      overlayEl.querySelector('[aria-label*="close" i], [aria-label*="dismiss" i]'),
      overlayEl.querySelector('button[class*="close"], button[class*="dismiss"]'),
      document.querySelector('[aria-label*="close" i][role="button"]'),
    ].filter(Boolean);

    if (closeTriggers.length > 0) {
      try { closeTriggers[0].click(); } catch (_) {}
    }
  }

  // ════════════════════════════════════════════════════════
  // SECTION 5 — HIGHLIGHT HELPERS
  // ════════════════════════════════════════════════════════

  function glowElement(el, ms = 3000) {
    if (!el) return;
    const prev = {
      outline: el.style.outline,
      boxShadow: el.style.boxShadow,
      transition: el.style.transition,
    };
    el.style.transition = "outline 0.2s, box-shadow 0.2s";
    el.style.outline = "2px solid #00e5c8";
    el.style.boxShadow = "0 0 14px #00e5c880";
    setTimeout(() => {
      el.style.outline = prev.outline;
      el.style.boxShadow = prev.boxShadow;
      el.style.transition = prev.transition;
    }, ms);
  }

  // ════════════════════════════════════════════════════════
  // SECTION 6 — ACTION HANDLERS (upgraded)
  // ════════════════════════════════════════════════════════

  function scrollToText(target, selectorHint) {
    if (!target) return;
    const found = findElement(target, selectorHint);
    if (found?.el) {
      found.el.scrollIntoView({ behavior: "smooth", block: "center" });
      glowElement(found.el, 3000);
      return;
    }
    // Fallback: tree-walk all text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue?.toLowerCase().includes(target.toLowerCase())) {
        const el = node.parentElement;
        if (el && el.tagName !== "SCRIPT" && el.tagName !== "STYLE") {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          glowElement(el, 3000);
          return;
        }
      }
    }
  }

  function clickElement(target, selectorHint) {
    if (!target) return;
    const found = findElement(target, selectorHint);
    if (!found?.el) {
      console.warn("Audia: could not find element for:", target);
      return;
    }
    const el = found.el;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    glowElement(el, 1200);

    // For anchor tags: navigate directly — don't wait for the overlay check
    // because the page-level nav elements (Cart, Checkout) are often in sticky
    // headers which the overlay detector wrongly blocks.
    const aTag = el.tagName === "A" ? el : el.closest("a");
    if (aTag?.href && aTag.href !== "#" && !aTag.href.startsWith("javascript")) {
      setTimeout(() => { window.location.href = aTag.href; }, 300);
      return;
    }

    // For buttons / non-anchor interactive elements — check clickability first
    setTimeout(() => {
      if (!isElementClickable(el)) {
        // Covered by overlay — dismiss and retry
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { try { el.click(); } catch (_) {} }, 400);
        return;
      }
      try { el.click(); } catch (_) {}
    }, 400);
  }

  function highlightElements(target) {
    if (!target) return;
    if (target.toLowerCase().includes("external")) {
      highlightExternalLinks();
      return;
    }
    const kw = target.toLowerCase();
    // XPath for all matching elements
    try {
      const xpath = `//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')]`;
      const iter = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      let node;
      let count = 0;
      while ((node = iter.iterateNext()) && count < 20) {
        if (node.nodeType === 1 && node.children.length <= 3) {
          node.style.transition = "background 0.3s, outline 0.3s";
          node.style.background = "rgba(255, 220, 0, 0.30)";
          node.style.outline = "1.5px solid #00e5c8";
          setTimeout(() => {
            node.style.background = "";
            node.style.outline = "";
          }, 5000);
          count++;
        }
      }
    } catch (_) {}
  }

  function readSection(target) {
    if (!target) return "";
    const kw = target.toLowerCase();
    // Find heading using XPath
    let heading = null;
    try {
      const xpath = `//h1[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')] | //h2[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')] | //h3[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${kw}')]`;
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      heading = result.singleNodeValue;
    } catch (_) {}

    if (!heading) return "";

    heading.scrollIntoView({ behavior: "smooth", block: "center" });
    glowElement(heading, 2500);

    const texts = [];
    let sibling = heading.nextElementSibling;
    let depth = 0;
    while (sibling && depth < 25) {
      if (/^H[1-3]$/.test(sibling.tagName)) break;
      const t = sibling.innerText?.trim();
      if (t) texts.push(t);
      sibling = sibling.nextElementSibling;
      depth++;
    }
    if (texts.length === 0 && heading.parentElement) {
      heading.parentElement.querySelectorAll("p, li").forEach((el) => {
        const t = el.innerText?.trim();
        if (t) texts.push(t);
      });
    }
    return texts.join(" ").slice(0, 1500);
  }

  // navigate_to: find a link by text and navigate the current tab to it (same tab, not new tab)
  function navigateTo(target, selectorHint) {
    if (!target) return;
    const found = findElement(target, selectorHint || "a");
    const aTag = found?.el
      ? (found.el.tagName === "A" ? found.el : found.el.closest("a"))
      : null;
    if (aTag?.href && aTag.href !== "#" && !aTag.href.startsWith("javascript")) {
      glowElement(aTag, 600);
      setTimeout(() => { window.location.href = aTag.href; }, 250);
      return;
    }
    if (found?.el) {
      glowElement(found.el, 600);
      setTimeout(() => { try { found.el.click(); } catch (_) {} }, 250);
      return;
    }
    console.warn("Audia navigate_to: could not find link for:", target);
  }

  // type_and_search: find a search/text input, type the value, then press Enter
  function typeAndSearch(fieldTarget, value) {
    if (!value) return;
    const kw = (fieldTarget || "search").toLowerCase();

    // Find the search input — try specific selectors first
    let input = (
      document.querySelector('input[type="search"]') ||
      document.querySelector('input[placeholder*="search" i]') ||
      document.querySelector('input[aria-label*="search" i]') ||
      document.querySelector('input[name*="search" i]') ||
      document.querySelector('input[type="text"]') ||
      findElement(kw, "input")?.el
    );

    if (!input) {
      console.warn("Audia type_and_search: no input found for", fieldTarget);
      return;
    }

    // Focus and clear the field
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Type each character to simulate real typing (important for React inputs)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    glowElement(input, 1500);
    input.scrollIntoView({ behavior: "smooth", block: "center" });

    // Submit — try Enter key, then find submit button, then form submit
    setTimeout(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup",   { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));

      // Fallback: click the nearest submit button
      setTimeout(() => {
        const form = input.closest("form");
        if (form) {
          const submitBtn = form.querySelector('[type="submit"], button:not([type="button"])');
          if (submitBtn) { try { submitBtn.click(); } catch (_) {} }
          else { try { form.submit(); } catch (_) {} }
        }
      }, 200);
    }, 300);
  }

  // fill_field: fill any labeled input (name, email, address, etc.)
  function fillField(fieldTarget, value) {
    if (!value || !fieldTarget) return;
    const found = findElement(fieldTarget, "input") || findElement(fieldTarget, "textarea");
    const el = found?.el;
    if (!el) {
      console.warn("Audia fill_field: field not found:", fieldTarget);
      return;
    }
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    glowElement(el, 1200);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // select_option: select a value from a <select> dropdown
  function selectOption(fieldTarget, value) {
    if (!fieldTarget || !value) return;
    let sel = findElement(fieldTarget, "select")?.el;
    if (!sel) sel = document.querySelector("select");
    if (!sel || sel.tagName !== "SELECT") return;

    const kw = value.toLowerCase();
    const opt = Array.from(sel.options).find((o) => o.text.toLowerCase().includes(kw));
    if (opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      glowElement(sel, 1500);
    } else {
      console.warn("Audia select_option: option not found:", value);
    }
  }

  // press_key: dispatch a keyboard event on the focused or specified element
  function pressKey(key) {
    const el = document.activeElement || document.body;
    const init = { key, code: key, keyCode: key === "Enter" ? 13 : key === "Escape" ? 27 : 0, bubbles: true };
    el.dispatchEvent(new KeyboardEvent("keydown", init));
    el.dispatchEvent(new KeyboardEvent("keyup",   init));
  }

  function openLink(target) {
    if (!target) return;
    const found = findElement(target, "a");
    if (found?.el) {
      const a = found.el.tagName === "A" ? found.el : found.el.closest("a");
      if (a?.href) {
        glowElement(a, 800);
        const isExternal = a.hostname && a.hostname !== window.location.hostname;
        setTimeout(() => {
          if (isExternal) { window.open(a.href, "_blank"); }
          else            { window.location.href = a.href; }
        }, 600);
      }
    }
  }

  function highlightExternalLinks() {
    const host = window.location.hostname;
    let count = 0;
    document.querySelectorAll("a[href]").forEach((a) => {
      try {
        const u = new URL(a.href, window.location.origin);
        if (u.hostname && u.hostname !== host) {
          a.style.transition = "background 0.3s, outline 0.3s";
          a.style.background = "rgba(0,229,200,0.15)";
          a.style.outline = "1.5px solid #00e5c8";
          a.title = `External: ${u.hostname}`;
          setTimeout(() => { a.style.background = ""; a.style.outline = ""; }, 6000);
          count++;
        }
      } catch (_) {}
    });
    return count;
  }

  // ════════════════════════════════════════════════════════
  // SECTION 7 — ACTION DISPATCHER
  // ════════════════════════════════════════════════════════

  function executeActions(actions) {
    if (!Array.isArray(actions)) return { sectionText: "" };
    let sectionText = "";

    actions.forEach((action) => {
      const target = action.target;
      const hint   = action.selector_hint;
      const value  = action.value; // for type/fill/select actions

      switch (action.type) {
        case "scroll_to_text":    scrollToText(target, hint);           break;
        case "click_element":     clickElement(target, hint);            break;
        case "navigate_to":       navigateTo(target, hint);              break;
        case "goto_url":
          if (target) setTimeout(() => { window.location.href = target; }, 200);
          break;
        case "open_link":         openLink(target);                      break;
        case "type_and_search":   typeAndSearch(target, value);          break;
        case "fill_field":        fillField(target, value);              break;
        case "select_option":     selectOption(target, value);           break;
        case "press_key":         pressKey(target);                      break;
        case "highlight_elements":highlightElements(target);             break;
        case "read_section":      sectionText = readSection(target);     break;
        case "scroll_top":
          window.scrollTo({ top: 0, behavior: "smooth" });               break;
        case "scroll_bottom":
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); break;
        case "none":
        default: break;
      }
    });

    return { sectionText };
  }

  // ════════════════════════════════════════════════════════
  // SECTION 8 — MESSAGE LISTENER
  // ════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === "ping") {
        sendResponse({ ok: true });
        return true;
      }
      if (request.action === "start_listening") {
        startListening();
        sendResponse({ ok: true });
        return true;
      }
      if (request.action === "stop_listening") {
        stopListening();
        sendResponse({ ok: true });
        return true;
      }
      if (request.action === "get_dom_snapshot") {
        sendResponse({ domSnapshot: extractDOMSnapshot() });
        return true;
      }
      if (request.action === "execute_actions") {
        const result = executeActions(request.actions);
        sendResponse({ ok: true, sectionText: result.sectionText });
        return true;
      }
    } catch (e) {
      console.error("Audia content.js error:", e);
      sendResponse({ error: e.message });
    }
    return true;
  });

})();
