/**
 * AI Agent Chat Widget Loader
 *
 * Embed options:
 * 1) <script src="https://APP/widget/loader.js" data-widget-key="KEY" async></script>
 * 2) Set window.TROO_AGENT_CONFIG = { widgetKey, context: { pageType: "site", ... } } BEFORE loading this script
 * 3) data-context='{"pageType":"site","source":"sitebuilder"}' on the script tag (JSON)
 *
 * Live context updates: window.dispatchEvent(new CustomEvent("troo-agent-context", { detail: { ... } }))
 */
(() => {
  if (typeof window === "undefined") return;

  const scriptTag = document.currentScript || (() => {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  const globalCfg =
    typeof window.TROO_AGENT_CONFIG === "object" && window.TROO_AGENT_CONFIG
      ? window.TROO_AGENT_CONFIG
      : null;

  const fromDatasetKey = scriptTag?.dataset?.widgetKey;
  const widgetKey = (globalCfg && globalCfg.widgetKey) || fromDatasetKey;

  if (!widgetKey) {
    console.warn("[AI Widget] Set data-widget-key on the script tag or window.TROO_AGENT_CONFIG.widgetKey.");
    return;
  }

  const guardKey = "__troo_aiw_" + widgetKey;
  if (window[guardKey]) {
    console.warn("[AI Widget] Already initialized for this widgetKey.");
    return;
  }
  window[guardKey] = true;

  const ORIGIN = (() => {
    try {
      return new URL(scriptTag.src).origin;
    } catch {
      return "";
    }
  })();

  const apiBase = ORIGIN || "";

  let widgetContext = {};
  if (globalCfg && typeof globalCfg.context === "object" && globalCfg.context) {
    widgetContext = Object.assign({}, globalCfg.context);
  }
  if (scriptTag?.dataset?.context) {
    try {
      const parsed = JSON.parse(scriptTag.dataset.context);
      if (parsed && typeof parsed === "object") {
        widgetContext = Object.assign({}, widgetContext, parsed);
      }
    } catch (e) {
      console.warn("[AI Widget] Invalid data-context JSON", e);
    }
  }

  window.addEventListener("troo-agent-context", function (ev) {
    if (!ev || !ev.detail || typeof ev.detail !== "object") return;
    widgetContext = Object.assign({}, widgetContext, ev.detail);
    if (typeof window.TROO_AGENT_CONFIG === "object" && window.TROO_AGENT_CONFIG) {
      window.TROO_AGENT_CONFIG.context = Object.assign(
        {},
        window.TROO_AGENT_CONFIG.context || {},
        ev.detail
      );
    }
  });

  function currentContextPayload() {
    const g =
      typeof window.TROO_AGENT_CONFIG === "object" &&
      window.TROO_AGENT_CONFIG &&
      typeof window.TROO_AGENT_CONFIG.context === "object"
        ? window.TROO_AGENT_CONFIG.context
        : {};
    return Object.assign({}, widgetContext, g);
  }

  const LS_KEY = "aiw_session_" + widgetKey;
  const LS_CONSENT_KEY = "aiw_consent_" + widgetKey;
  /** Server-issued id for durable transcript; persisted per widget key. */
  const LS_CONV_KEY = "aiw_pubconv_" + widgetKey;
  let sessionId = localStorage.getItem(LS_KEY);
  let publicConversationId = localStorage.getItem(LS_CONV_KEY);
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem(LS_KEY, sessionId);
  }

  const state = {
    open: false,
    config: null,
    messages: [],
    sending: false,
    consentGiven: localStorage.getItem(LS_CONSENT_KEY) === "1",
  };

  const style = document.createElement("style");
  style.id = "aiw-dynamic-theme";
  style.textContent = `
    .aiw-btn{position:fixed;z-index:999999;display:flex;align-items:center;justify-content:center;
      width:56px;height:56px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.85);
      color:white;font-family:ui-sans-serif,system-ui;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35)}
    .aiw-panel{position:fixed;z-index:999999;width:360px;max-width:calc(100vw - 36px);
      height:520px;max-height:calc(100vh - 120px);border-radius:18px;border:1px solid rgba(255,255,255,.12);
      background:rgba(0,0,0,.92);backdrop-filter:blur(10px);display:none;overflow:hidden;
      font-family:ui-sans-serif,system-ui;color:#fff;box-shadow:0 18px 60px rgba(0,0,0,.45)}
    .aiw-panel.aiw-open{display:flex;flex-direction:column}
    .aiw-head{padding:12px 12px;border-bottom:1px solid rgba(255,255,255,.10);display:flex;align-items:center;gap:10px}
    .aiw-title{font-size:13px;font-weight:700;letter-spacing:.2px}
    .aiw-sub{font-size:11px;color:rgba(255,255,255,.65)}
    .aiw-close{margin-left:auto;background:transparent;border:0;color:rgba(255,255,255,.75);cursor:pointer;font-size:18px;line-height:1}
    .aiw-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
    .aiw-bub{max-width:85%;border-radius:14px;padding:10px 11px;font-size:13px;line-height:1.35;border:1px solid rgba(255,255,255,.10)}
    .aiw-u{align-self:flex-end;background:rgba(0,255,255,.12);border-color:rgba(0,255,255,.18)}
    .aiw-a{align-self:flex-start;background:rgba(255,165,0,.12);border-color:rgba(255,165,0,.18)}
    .aiw-foot{padding:10px;border-top:1px solid rgba(255,255,255,.10);display:flex;gap:8px}
    .aiw-in{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;
      color:#fff;padding:10px 10px;font-size:13px;outline:none}
    .aiw-send{border:0;border-radius:12px;padding:10px 12px;font-weight:700;font-size:13px;cursor:pointer}
    .aiw-send:disabled{opacity:.6;cursor:not-allowed}
    .aiw-note{padding:0 12px 10px;font-size:11px;color:rgba(255,255,255,.55)}
    .aiw-consent{display:flex;flex-direction:column;gap:12px;padding:16px;text-align:center}
    .aiw-consent p{font-size:12px;line-height:1.5;color:rgba(255,255,255,.85)}
    .aiw-consent-btn{border:0;border-radius:12px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer}
    .aiw-theme-light .aiw-panel{background:rgba(255,255,255,.96);color:#111;border-color:rgba(0,0,0,.12)}
    .aiw-theme-light .aiw-sub{color:rgba(0,0,0,.55)}
    .aiw-theme-light .aiw-bub{border-color:rgba(0,0,0,.10)}
    .aiw-theme-light .aiw-in{background:rgba(0,0,0,.04);color:#111;border-color:rgba(0,0,0,.12)}
    .aiw-theme-light .aiw-head{border-bottom-color:rgba(0,0,0,.08)}
    .aiw-theme-light .aiw-foot{border-top-color:rgba(0,0,0,.08)}
    .aiw-theme-light .aiw-note{color:rgba(0,0,0,.45)}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "aiw-btn";
  btn.type = "button";
  btn.textContent = "AI";

  const panel = document.createElement("div");
  panel.className = "aiw-panel";

  const head = document.createElement("div");
  head.className = "aiw-head";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "aiw-title";
  title.textContent = "Assistant";
  const sub = document.createElement("div");
  sub.className = "aiw-sub";
  sub.textContent = "Ask a question";

  titleWrap.appendChild(title);
  titleWrap.appendChild(sub);

  const close = document.createElement("button");
  close.className = "aiw-close";
  close.type = "button";
  close.innerHTML = "&times;";

  head.appendChild(titleWrap);
  head.appendChild(close);

  const body = document.createElement("div");
  body.className = "aiw-body";

  const note = document.createElement("div");
  note.className = "aiw-note";
  note.textContent = "Powered by TroothHertz";

  const foot = document.createElement("div");
  foot.className = "aiw-foot";

  const input = document.createElement("input");
  input.className = "aiw-in";
  input.placeholder = "Type your message…";

  const send = document.createElement("button");
  send.className = "aiw-send";
  send.type = "button";
  send.textContent = "Send";

  foot.appendChild(input);
  foot.appendChild(send);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(note);
  panel.appendChild(foot);

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function resolveUrl(pathOrAbsolute) {
    if (!pathOrAbsolute || typeof pathOrAbsolute !== "string") return "";
    if (pathOrAbsolute.startsWith("http://") || pathOrAbsolute.startsWith("https://")) return pathOrAbsolute;
    return (apiBase || "") + pathOrAbsolute;
  }

  function widgetMessageUrl() {
    const p = state.config && state.config.endpoints && state.config.endpoints.message;
    if (p) return resolveUrl(p);
    return `${apiBase}/api/widget/${encodeURIComponent(widgetKey)}/message`;
  }

  function widgetConfigUrl() {
    const p = state.config && state.config.endpoints && state.config.endpoints.config;
    if (p) return resolveUrl(p);
    return `${apiBase}/api/widget/${encodeURIComponent(widgetKey)}/config`;
  }

  function applyLayoutFromConfig() {
    const v = (state.config && state.config.visual) || {};
    const pos = v.launcherPosition === "left" ? "left" : "right";
    const bottom = "18px";
    const edge = "18px";
    btn.style[pos] = edge;
    btn.style[pos === "left" ? "right" : "left"] = "auto";
    btn.style.bottom = bottom;
    panel.style[pos] = edge;
    panel.style[pos === "left" ? "right" : "left"] = "auto";
    panel.style.bottom = "86px";
    const accent = typeof v.accent === "string" && v.accent.trim() ? v.accent.trim() : "#22d3ee";
    btn.style.borderColor = accent + "55";
    send.style.background = accent;
    send.style.color = "#0a0a0a";
    panel.querySelectorAll(".aiw-consent-btn").forEach(function (el) {
      el.style.background = accent;
      el.style.color = "#0a0a0a";
    });
    const theme = v.theme === "light" ? "light" : "dark";
    panel.classList.toggle("aiw-theme-light", theme === "light");
    if (v.launcherLabel) btn.textContent = String(v.launcherLabel).slice(0, 24);
  }

  function showConsentGate() {
    return state.config?.consentRequired === true && !state.consentGiven;
  }

  function acceptConsent() {
    localStorage.setItem(LS_CONSENT_KEY, "1");
    state.consentGiven = true;
    render();
  }

  function render() {
    panel.classList.toggle("aiw-open", state.open);

    title.textContent = state.config?.name || "Assistant";
    sub.textContent = state.config?.tagline || "Ask a question";

    body.innerHTML = "";
    if (showConsentGate()) {
      const gate = document.createElement("div");
      gate.className = "aiw-consent";
      const p = document.createElement("p");
      p.textContent =
        state.config?.consentText ||
        "This chat may be recorded and stored for follow-up. By continuing you agree.";
      gate.appendChild(p);
      const cb = document.createElement("button");
      cb.className = "aiw-consent-btn";
      cb.type = "button";
      cb.textContent = "I agree";
      cb.addEventListener("click", acceptConsent);
      gate.appendChild(cb);
      body.appendChild(gate);
      foot.style.display = "none";
    } else {
      foot.style.display = "flex";
      for (const m of state.messages) {
        const b = document.createElement("div");
        b.className = "aiw-bub " + (m.role === "user" ? "aiw-u" : "aiw-a");
        b.textContent = m.text;
        body.appendChild(b);
      }
      body.scrollTop = body.scrollHeight;
    }

    send.disabled = state.sending;
    if (state.config) applyLayoutFromConfig();
  }

  async function loadConfig() {
    try {
      const r = await fetch(widgetConfigUrl(), { cache: "no-store" });
      const j = await r.json();
      state.config = j?.config || j || null;
      if (state.config && state.config.placeholder) {
        input.placeholder = String(state.config.placeholder).slice(0, 200);
      }
      applyLayoutFromConfig();

      if (state.messages.length === 0) {
        const welcome =
          state.config?.welcomeMessage || state.config?.description || "Hi — how can I help?";
        state.messages.push({ role: "assistant", text: welcome });
      }
      render();
    } catch (e) {
      console.warn("[AI Widget] Failed to load config", e);
      state.messages.push({ role: "assistant", text: "Widget failed to load config." });
      render();
    }
  }

  async function sendMessage(text) {
    state.sending = true;
    render();

    try {
      const ctx = currentContextPayload();
      const history = state.messages
        .slice(0, -1)
        .map(function (m) {
          return { role: m.role, content: m.text };
        })
        .slice(-24);
      const r = await fetch(widgetMessageUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          text: text,
          sessionId: sessionId,
          conversationId: publicConversationId || undefined,
          history: history,
          page: { url: location.origin + location.pathname, title: document.title },
          context: ctx,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (j && typeof j.conversationId === "string" && j.conversationId.trim()) {
        publicConversationId = j.conversationId.trim();
        try {
          localStorage.setItem(LS_CONV_KEY, publicConversationId);
        } catch (e) {
          /* ignore quota / private mode */
        }
      }
      const reply = j?.reply || j?.text || "…";
      state.messages.push({ role: "assistant", text: String(reply) });
    } catch (e) {
      state.messages.push({ role: "assistant", text: "Message failed to send." });
    } finally {
      state.sending = false;
      render();
    }
  }

  btn.addEventListener("click", () => {
    state.open = !state.open;
    render();
  });

  close.addEventListener("click", () => {
    state.open = false;
    render();
  });

  send.addEventListener("click", () => {
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    state.messages.push({ role: "user", text: t });
    render();
    sendMessage(t);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send.click();
  });

  loadConfig();
})();
