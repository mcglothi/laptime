(function () {
  const API_BASE = window.LAPTIME_API_BASE || 'https://laptime.run';
  const HARDWARE_NAME = window.LAPTIME_HARDWARE_NAME || 'hopper';
  const DEFAULT_RUNTIME = window.LAPTIME_RUNTIME || 'Ollama';
  const REFRESH_INTERVAL_MS = 2500;
  const CHAT_ROUTE_SKIP = new Set(['new', 'models', 'settings', 'workspace', 'playground']);

  const KNOWN_MODEL_LABELS = [
    'Qwen Coder 30B',
    'Qwen MoE 30B',
    'Heretic Demo 24B',
    'GPT OSS 20B',
    'GPT OSS 120B',
    'Gemma 3 27B',
    'Nemotron Mini 4B',
    'Qwen 3.5 122B MoE',
    'qwen3-coder:30b',
    'qwen3.5:122b-a10b',
    'gpt-oss:20b',
    'gpt-oss:120b',
    'gemma3:27b',
    'nemotron-mini:4b',
  ];

  const state = {
    currentPath: '',
    chatId: null,
    modelName: null,
    live: {
      observedDecodeTps: null,
      observedTtftMs: null,
      lastSampleAt: null,
      note: null,
    },
    lastTelemetryKey: null,
    telemetry: null,
  };

  const styles = `
    #laptime-telemetry-root {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 80;
      width: min(24rem, calc(100vw - 2rem));
      pointer-events: none;
    }

    #laptime-telemetry-root * {
      box-sizing: border-box;
      pointer-events: auto;
    }

    .lt-overlay-card {
      display: grid;
      gap: 0.45rem;
      padding: 0.8rem 0.95rem;
      border-radius: 1rem;
      background: rgba(6, 16, 29, 0.82);
      border: 1px solid rgba(102, 227, 255, 0.18);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35);
      color: #eff6ff;
      backdrop-filter: blur(18px) saturate(140%);
      font: 500 12px/1.4 "IBM Plex Mono", "SFMono-Regular", ui-monospace, monospace;
    }

    .lt-overlay-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .lt-overlay-title {
      font-size: 0.82rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .lt-overlay-copy {
      color: rgba(223, 240, 255, 0.8);
    }

    .lt-overlay-subtle {
      color: rgba(155, 180, 209, 0.9);
      font-size: 0.74rem;
    }

    .lt-overlay-pill {
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
      white-space: nowrap;
      font-size: 0.7rem;
    }

    .lt-fit-fit, .lt-tone-better { background: rgba(62, 180, 137, 0.18); color: #8ff0c5; }
    .lt-fit-tight, .lt-tone-notable { background: rgba(255, 194, 77, 0.18); color: #ffd98f; }
    .lt-fit-unfit, .lt-tone-worse { background: rgba(255, 97, 97, 0.18); color: #ffadad; }
    .lt-fit-unknown, .lt-tone-close, .lt-tone-empty { background: rgba(145, 178, 214, 0.18); color: #cfe4ff; }

    .lt-overlay-dismiss {
      cursor: pointer;
      border: none;
      background: transparent;
      color: rgba(223, 240, 255, 0.75);
      padding: 0;
      margin-left: auto;
      font: inherit;
    }

    .lt-overlay-dismiss:hover {
      color: #ffffff;
    }
  `;

  let root;
  let dismissed = false;

  function ensureRoot() {
    if (root) return root;

    const style = document.createElement('style');
    style.id = 'laptime-telemetry-styles';
    style.textContent = styles;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.id = 'laptime-telemetry-root';
    document.body.appendChild(root);
    return root;
  }

  function estimateTokenCount(text) {
    const normalized = String(text || '').trim();
    if (!normalized) return 0;
    return Math.max(1, Math.round(normalized.length / 4));
  }

  function buildTelemetryUrl() {
    const url = new URL('/api/runtime-telemetry', API_BASE);
    url.searchParams.set('hardwareName', HARDWARE_NAME);
    url.searchParams.set('runtime', DEFAULT_RUNTIME);
    if (state.modelName) {
      url.searchParams.set('modelName', state.modelName);
    }
    if (Number.isFinite(state.live.observedDecodeTps)) {
      url.searchParams.set('observedDecodeTps', String(state.live.observedDecodeTps));
    }
    if (Number.isFinite(state.live.observedTtftMs)) {
      url.searchParams.set('observedTtftMs', String(state.live.observedTtftMs));
    }
    return url;
  }

  function formatMetric(label, value, suffix) {
    if (!Number.isFinite(value)) return `${label} -`;
    return `${label} ${suffix === 'ms' ? Math.round(value) : value.toFixed(1)} ${suffix}`;
  }

  function formatDelta(label, delta) {
    if (!delta) return `${label} pending`;
    const sign = delta.percent > 0 ? '+' : '';
    return `${label} ${sign}${delta.percent.toFixed(0)}%`;
  }

  function renderError(message, suggestions) {
    if (dismissed) return;
    const el = ensureRoot();
    const suggestionText = Array.isArray(suggestions) && suggestions.length
      ? `<div class="lt-overlay-subtle">Closest: ${suggestions.map((item) => item.name).join(', ')}</div>`
      : '';

    el.innerHTML = `
      <div class="lt-overlay-card">
        <div class="lt-overlay-row">
          <strong class="lt-overlay-title">LapTime</strong>
          <button class="lt-overlay-dismiss" type="button" aria-label="Dismiss">hide</button>
        </div>
        <div class="lt-overlay-copy">${message}</div>
        ${suggestionText}
      </div>
    `;

    el.querySelector('.lt-overlay-dismiss')?.addEventListener('click', () => {
      dismissed = true;
      el.innerHTML = '';
    });
  }

  function clearOverlay() {
    if (root) {
      root.innerHTML = '';
    }
  }

  function renderTelemetry(payload) {
    if (dismissed) return;
    const el = ensureRoot();
    const fitClass = `lt-fit-${payload.laptime.fit.status}`;
    const decodeTone = payload.comparison?.decode?.tone ?? 'empty';
    const ttftTone = payload.comparison?.ttft?.tone ?? 'empty';
    const liveNote = state.live.note
      ? `<div class="lt-overlay-subtle">${state.live.note}</div>`
      : '';

    el.innerHTML = `
      <div class="lt-overlay-card">
        <div class="lt-overlay-row">
          <strong class="lt-overlay-title">LapTime</strong>
          <button class="lt-overlay-dismiss" type="button" aria-label="Dismiss">hide</button>
        </div>
        <div class="lt-overlay-copy">${payload.resolution.hardware.name} · ${payload.resolution.model.name}</div>
        <div class="lt-overlay-row">
          <span>${formatMetric('Est.', payload.laptime.estimated.decodeTps, 'tok/s')}</span>
          <span>${formatMetric('TTFT', payload.laptime.estimated.ttftMs, 'ms')}</span>
          <span class="lt-overlay-pill ${fitClass}">${payload.laptime.fit.status}</span>
        </div>
        <div class="lt-overlay-subtle">${payload.laptime.fit.message}</div>
        ${
          Number.isFinite(payload.observed.decodeTps)
            ? `<div class="lt-overlay-row">
                <span>${formatMetric('Live', payload.observed.decodeTps, 'tok/s')}</span>
                <span class="lt-overlay-pill lt-tone-${decodeTone}">${formatDelta('Decode', payload.comparison?.decode)}</span>
              </div>`
            : ''
        }
        ${
          Number.isFinite(payload.observed.ttftMs)
            ? `<div class="lt-overlay-row">
                <span>${formatMetric('Live', payload.observed.ttftMs, 'ms')}</span>
                <span class="lt-overlay-pill lt-tone-${ttftTone}">${formatDelta('TTFT', payload.comparison?.ttft)}</span>
              </div>`
            : ''
        }
        <div class="lt-overlay-subtle">
          Match: ${payload.resolution.model.matchMethod}/${payload.resolution.hardware.matchMethod} · ${payload.context.runtime || DEFAULT_RUNTIME}
        </div>
        ${liveNote}
      </div>
    `;

    el.querySelector('.lt-overlay-dismiss')?.addEventListener('click', () => {
      dismissed = true;
      el.innerHTML = '';
    });
  }

  function extractChatIdFromLocation() {
    const url = new URL(window.location.href);
    const queryId = url.searchParams.get('id');
    if (queryId) return queryId;

    const parts = url.pathname.split('/').filter(Boolean).reverse();
    return parts.find((part) => {
      if (!part || CHAT_ROUTE_SKIP.has(part)) return false;
      return part.length >= 8;
    }) ?? null;
  }

  function getCurrentMessageId(chatPayload) {
    return chatPayload?.chat?.history?.currentId ?? null;
  }

  function getCurrentModelFromChat(chatPayload) {
    const messages = chatPayload?.chat?.history?.messages ?? {};
    const currentId = getCurrentMessageId(chatPayload);

    if (currentId && messages[currentId]?.model) {
      return messages[currentId].model;
    }

    const reversed = Object.values(messages).reverse();
    for (const message of reversed) {
      if (message && typeof message.model === 'string' && message.model) {
        return message.model;
      }
    }

    const directModel = chatPayload?.chat?.model;
    if (typeof directModel === 'string' && directModel) {
      return directModel;
    }

    return null;
  }

  async function fetchCurrentChatModel() {
    const chatId = extractChatIdFromLocation();
    state.chatId = chatId;
    if (!chatId) return null;

    try {
      const response = await fetch(`/api/v1/chats/${chatId}`, { credentials: 'include' });
      if (!response.ok) return null;
      const payload = await response.json();
      return getCurrentModelFromChat(payload);
    } catch {
      return null;
    }
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
  }

  function guessModelFromDom() {
    const candidates = Array.from(document.querySelectorAll('button, [role="button"], h1, h2, h3, span, div'))
      .filter(isVisible)
      .slice(0, 500);

    for (const label of KNOWN_MODEL_LABELS) {
      const hit = candidates.find((node) => node.textContent && node.textContent.includes(label));
      if (hit) return label;
    }

    return null;
  }

  async function refreshTelemetry() {
    const modelName = (await fetchCurrentChatModel()) || guessModelFromDom();
    state.modelName = modelName;

    if (!modelName) {
      clearOverlay();
      return;
    }

    const telemetryUrl = buildTelemetryUrl();
    const key = telemetryUrl.toString();
    if (key === state.lastTelemetryKey && state.telemetry) {
      renderTelemetry(state.telemetry);
      return;
    }

    try {
      const response = await fetch(telemetryUrl.toString());
      const payload = await response.json();
      state.lastTelemetryKey = key;

      if (!response.ok || !payload.ok) {
        renderError(payload.error || 'LapTime telemetry lookup failed.', payload.suggestions?.models);
        return;
      }

      state.telemetry = payload;
      renderTelemetry(payload);
    } catch {
      renderError('Unable to reach LapTime telemetry right now.');
    }
  }

  function trackStreamingResponse(requestStart, response, modelNameFromBody) {
    if (!response.body || typeof response.body.tee !== 'function') {
      return response;
    }

    const [appStream, observerStream] = response.body.tee();
    const observedResponse = new Response(appStream, response);

    (async () => {
      const reader = observerStream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstContentAt = null;
      let content = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

          try {
            const payload = JSON.parse(line.slice(6));
            const delta =
              payload?.choices?.[0]?.delta?.content ??
              payload?.choices?.[0]?.message?.content ??
              payload?.message?.content ??
              '';

            if (delta) {
              if (!firstContentAt) firstContentAt = performance.now();
              content += delta;
            }
          } catch {
            // Ignore partial or non-JSON chunks.
          }
        }
      }

      const requestEnd = performance.now();
      if (firstContentAt && content.trim()) {
        const tokenEstimate = estimateTokenCount(content);
        const decodeSeconds = Math.max((requestEnd - firstContentAt) / 1000, 0.001);
        state.live.observedTtftMs = Math.max(1, Math.round(firstContentAt - requestStart));
        state.live.observedDecodeTps = tokenEstimate / decodeSeconds;
        state.live.lastSampleAt = Date.now();
        state.live.note = `Live stream rate is estimated from SSE output, not tokenizer-exact token counts.`;
        if (modelNameFromBody) {
          state.modelName = modelNameFromBody;
        }
        state.lastTelemetryKey = null;
        await refreshTelemetry();
      }
    })().catch(() => {
      // Keep the overlay quiet if stream observation fails.
    });

    return observedResponse;
  }

  function installFetchObserver() {
    if (window.__laptimeFetchWrapped) return;
    window.__laptimeFetchWrapped = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function patchedFetch(input, init) {
      const requestStart = performance.now();
      const requestUrl = typeof input === 'string' ? input : input?.url || '';

      let modelNameFromBody = null;
      try {
        if (init?.body && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (typeof body.model === 'string') {
            modelNameFromBody = body.model;
          }
        }
      } catch {
        // Ignore non-JSON request bodies.
      }

      const response = await originalFetch(input, init);
      if (requestUrl.includes('/api/chat/completions') || requestUrl.includes('/ollama/api/chat')) {
        return trackStreamingResponse(requestStart, response, modelNameFromBody);
      }
      return response;
    };
  }

  function boot() {
    ensureRoot();
    installFetchObserver();
    refreshTelemetry();
    setInterval(refreshTelemetry, REFRESH_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
