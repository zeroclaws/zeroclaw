(() => {
  'use strict';

  const routes = [
    ['/', 'Overview', 'status'], ['/provider', 'PROVIDER', 'provider'], ['/chat', 'Chat', 'chat'],
    ['/channel', 'Telegram', 'tg'], ['/runtime', 'Runtime', 'power'], ['/logs', 'Logs', 'tail'],
    ['/doctor', 'Doctor', 'check'], ['/tools', 'Tools', 'toggle'], ['/review', 'Review', 'warn'],
    ['/settings', 'Settings', 'gear']
  ];
  const tokenKey = 'zeroclaw.token';
  const state = { token: sessionStorage.getItem(tokenKey) || '', status: null, config: null, doctor: null, logs: '', credentialHealth: null, chatMessages: [], chatUsage: null, fallbackModalOpen: false, fallbackReason: '', modelModalOpen: false, customApiOpen: false, providerModels: [], providerModelsLoaded: false, providerModelsLoading: false, providerModelsSource: '' };
  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
    });
    children.forEach((child) => node.append(child && child.nodeType ? child : document.createTextNode(String(child))));
    return node;
  }
  const json = (v) => JSON.stringify(v, null, 2);
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let body = text;
    try { body = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!res.ok) throw new Error((body && (body.message || body.error)) || `HTTP ${res.status}`);
    return body;
  }

  function flash(message, bad = false) {
    const n = $('notice');
    n.textContent = message;
    n.hidden = false;
    n.setAttribute('role', bad ? 'alert' : 'status');
    n.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    n.style.borderColor = bad ? 'rgba(255,95,117,.65)' : 'rgba(0,255,157,.45)';
  }

  function go(path) { history.pushState(null, '', path); render(); }
  function redactedRef(ref) { return ref ? ref.replace(/^(env:|oauth:|secret:)(.).+$/, '$1$2••••') : 'Belum dipilih'; }
  function isTrustedOAuthMessage(event) {
    if (!event.data || event.data.type !== 'zeroclaw-oauth-connected') return false;
    if (event.origin === location.origin) return true;
    try {
      const origin = new URL(event.origin);
      return origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
    } catch (_) { return false; }
  }
  function consumeOAuthReturnMarker() {
    const params = new URLSearchParams(location.search);
    const connected = params.get('oauth') === 'connected';
    if (!connected) return false;
    params.delete('oauth');
    const next = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
    history.replaceState(null, '', next);
    return true;
  }
  function friendlyCredentialStatus() {
    const h = state.credentialHealth;
    if (!h) return { label: 'Not checked yet', tone: 'warn', detail: 'Use Check connection to confirm the saved provider credential is ready for chat.' };
    if (h.ok || h.status === 'connected' || h.status === 'ok' || h.connected) { const account = h.email || h.chatgptAccountId || ''; return { label: account ? `Connected: ${account}` : 'Connected', tone: 'ok', detail: h.chatgptPlanType ? `${h.message || 'Your provider connection is ready.'} Plan: ${h.chatgptPlanType}` : (h.message || 'Your provider connection is ready. The saved credential remains on the server.') }; }
    if (h.status === 'missing') return { label: 'Reconnect needed', tone: 'bad', detail: h.message || 'No saved provider credential was found. Reconnect OpenAI OAuth to use chat.' };
    if (h.status === 'invalid' || h.mode === 'credential-error') return { label: 'Reconnect needed', tone: 'bad', detail: h.message || 'The saved credential is expired or no longer accepted. Clear it, then reconnect OpenAI OAuth.' };
    return { label: 'Needs attention', tone: 'warn', detail: h.message || 'The connection could not be confirmed. Try checking again or reconnect OpenAI OAuth.' };
  }

  function setAuth() {
    const authed = Boolean(state.token);
    $('authState').textContent = authed ? 'Login aktif' : 'Belum login';
    $('authHint').textContent = authed ? 'Bearer token aktif sesi ini.' : 'Masuk untuk akses API lokal.';
    document.querySelector('.dot')?.classList.toggle('on', authed);
    $('logoutBtn').hidden = !authed;
    $('refreshBtn').hidden = !authed;
    $('menuBtn').hidden = !authed;
    $('sidebar').hidden = !authed;
    $('shell').classList.toggle('auth-shell', !authed);
    $('shell').classList.toggle('nav-open', false);
    $('menuBtn').setAttribute('aria-expanded', 'false');
  }

  function renderNav() {
    const nav = $('nav'); nav.replaceChildren();
    routes.forEach(([path, label, badge]) => {
      const a = el('a', { href: path, class: location.pathname === path ? 'active' : '', 'aria-current': location.pathname === path ? 'page' : null }, [label, el('small', { text: badge })]);
      a.addEventListener('click', (e) => { e.preventDefault(); $('shell').classList.remove('nav-open'); $('menuBtn').setAttribute('aria-expanded', 'false'); go(path); });
      nav.append(a);
    });
  }

  async function loadBase() {
    if (!state.token) return;
    try {
      const [status, config] = await Promise.all([api('/api/status'), api('/api/config')]);
      state.status = status; state.config = config;
    } catch (err) { flash(`Gagal load: ${err.message}`, true); }
  }

  function card(name, body, cls = 'span-4') { return el('section', { class: `card ${cls}` }, [el('h3', { text: name }), body]); }
  function pre(obj, cls = 'logbox') { return el('pre', { class: cls, text: typeof obj === 'string' ? obj : json(obj || {}) }); }

  function input(label, id, value = '', attrs = {}) {
    return el('div', {}, [el('label', { for: id, text: label }), el(attrs.textarea ? 'textarea' : 'input', { id, name: id, value, ...attrs })]);
  }

  const views = {
    '/': () => el('div', { class: 'grid' }, [
      card('Status', el('div', { class: 'metric', text: state.status?.running ? 'RUNNING' : 'LOCAL' })),
      card('Provider', el('p', { class: 'muted', text: state.config?.provider?.type || 'Provider belum dikonfigurasi' })),
      card('Channel', el('p', { class: 'muted', text: state.config?.channel?.type || 'Telegram private chat belum aktif' })),
      card('Konfigurasi mentah', pre(state.config), 'span-8'),
      card('Aksi awal', el('div', { class: 'row' }, [el('button', { class: 'primary', onclick: init, text: 'Init workspace' }), el('a', { class: 'ghost', href: '/provider', text: 'Setup provider' })]), 'span-4')
    ]),
    '/provider': () => providerView(),
    '/chat': () => chatView(),
    '/channel': () => channelView(),
    '/runtime': () => el('div', { class: 'grid' }, [card('Runtime controls', el('div', { class: 'row' }, ['start','stop','restart'].map(a => el('button', { class: a === 'stop' ? 'danger ghost' : 'primary', onclick: () => runtime(a), text: title(a) }))), 'span-6'), card('Status API', pre(state.status), 'span-6')]),
    '/logs': () => el('div', { class: 'grid' }, [card('Logs viewer', el('div', { class: 'stack' }, [el('button', { class: 'primary', onclick: loadLogs, text: 'Ambil logs' }), pre(state.logs || 'Placeholder logs. Klik Ambil logs untuk GET /api/logs.')]), 'span-12')]),
    '/doctor': () => el('div', { class: 'grid' }, [card('Local doctor checks', el('div', { class: 'stack' }, [el('button', { class: 'primary', onclick: loadDoctor, text: 'Jalankan doctor' }), pre(state.doctor || 'Belum dijalankan.')]), 'span-12')]),
    '/tools': () => toolsView(),
    '/review': () => el('div', { class: 'grid' }, [card('Final summary', pre({ routes: routes.map(r => r[0]), auth: 'POST /api/login, sessionStorage bearer token', warnings: ['Password 123456 hanya bootstrap lokal', 'Ganti credential env sebelum produksi', 'Logs/doctor tergantung backend API'] }), 'span-12')]),
    '/settings': () => settingsView()
  };


  function providerView() {
    const status = friendlyCredentialStatus();
    const provider = state.config?.provider || {};
    const shouldShowFallback = state.credentialHealth && hasFallbackSignal(state.credentialHealth);
    if (shouldShowFallback && !state.fallbackModalOpen) {
      state.fallbackModalOpen = true;
      state.fallbackReason = fallbackMessage(state.credentialHealth);
    }
    const hero = el('section', { class: 'provider-hero span-12', 'aria-labelledby': 'providerHeroTitle' }, [
      el('div', {}, [
        el('p', { class: 'provider-kicker', text: 'OPENAI-COMPATIBLE SETUP' }),
        el('h2', { id: 'providerHeroTitle', class: 'provider-main-title', text: 'PROVIDER' }),
        el('p', { class: 'muted', text: 'Connect OpenAI with OAuth when available, or keep a Custom API fallback ready for OpenAI-compatible endpoints.' })
      ]),
      el('div', { class: 'provider-status', role: 'status', 'aria-live': 'polite' }, [
        el('span', { class: `status-dot ${status.tone}`, 'aria-hidden': 'true' }),
        el('strong', { text: status.label }),
        el('small', { text: state.credentialHealth?.email || state.credentialHealth?.chatgptAccountId || redactedRef(provider.credentialRef) })
      ])
    ]);
    const sectionOne = el('div', { class: 'provider-section span-12' }, [el('h3', { class: 'provider-section-title', text: 'OpenAI Template' })]);
    const templateCard = el('section', { class: 'card provider-card span-4', 'aria-labelledby': 'templateTitle' }, [
      el('div', { class: 'template-mark', 'aria-hidden': 'true', text: 'AI' }),
      el('h3', { id: 'templateTitle', text: 'OpenAI template' }),
      el('p', { class: 'muted', text: 'Recommended defaults for OpenAI-compatible chat: provider type openai, OAuth credential storage, and a modern default model.' }),
      el('dl', { class: 'template-list' }, [
        el('dt', { text: 'Provider' }), el('dd', { text: provider.type || 'openai' }),
        el('dt', { text: 'Model' }), el('dd', { text: provider.model || 'gpt-4o-mini' }),
        el('dt', { text: 'Credential' }), el('dd', { text: redactedRef(provider.credentialRef || 'oauth:openai') })
      ])
    ]);
    const sectionTwo = el('div', { class: 'provider-section span-12' }, [el('h3', { class: 'provider-section-title', text: 'Connect OAuth OpenAI' })]);
    const oauthCard = el('section', { class: 'card provider-card span-8', 'aria-labelledby': 'oauthTitle' }, [
      el('h3', { id: 'oauthTitle', text: 'Connect OAuth OpenAI' }),
      el('p', { class: 'muted', text: 'Primary flow: generate an OpenAI OAuth link and continue directly to OpenAI. Custom API popup only appears when OAuth cannot be accepted automatically.' }),
      el('div', { class: 'provider-actions' }, [
        el('button', { class: 'primary', onclick: reconnectOpenAI, text: 'Connect OpenAI OAuth' }),
        el('button', { class: 'ghost', onclick: checkProviderConnection, text: 'Check connection' }),
        el('button', { class: 'ghost', onclick: openCustomApiFallback, text: 'Use Custom API instead' })
      ]),
      el('p', { class: 'secret-note', text: 'Tokens remain server-side. This page never displays OAuth tokens or API keys.' })
    ]);
    const healthCard = el('section', { class: 'card provider-card span-4 credential-health', 'aria-labelledby': 'healthTitle' }, [
      el('h3', { id: 'healthTitle', text: 'Credential health' }),
      el('div', { class: `health-badge ${status.tone}`, role: 'status', 'aria-live': 'polite' }, [el('span', { text: status.label }), el('small', { text: state.credentialHealth?.email || state.credentialHealth?.chatgptAccountId || redactedRef(provider.credentialRef) })]),
      el('p', { class: 'muted', text: status.detail }),
      state.credentialHealth?.expiresAt ? el('p', { class: 'secret-note', text: `Token expires: ${new Date(state.credentialHealth.expiresAt).toLocaleString()}` }) : el('span', { hidden: true }),
      el('button', { class: 'ghost danger', onclick: clearSavedCredential, text: 'Clear saved credential' })
    ]);
    const modelCard = el('section', { class: 'card provider-card span-12 model-default-card', 'aria-labelledby': 'defaultModelTitle' }, [
      el('div', { class: 'model-default-head' }, [
        el('div', {}, [
          el('p', { class: 'provider-kicker', text: 'DEFAULT MODEL' }),
          el('h3', { id: 'defaultModelTitle', text: provider.model || 'gpt-4o-mini' }),
          el('p', { class: 'muted', text: state.providerModelsLoaded ? `${state.providerModels.length || 1} available model(s) imported (${state.providerModelsSource || 'provider/config'}).` : 'Available models auto-import when this Provider page opens.' })
        ]),
        el('button', { class: 'primary', type: 'button', onclick: openModelPicker, text: state.providerModelsLoading ? 'Importing models…' : 'Choose default model' })
      ]),
      el('div', { class: 'model-chip-row', role: 'list', 'aria-label': 'Available provider models' }, (state.providerModels.length ? state.providerModels.slice(0, 8) : [provider.model || 'gpt-4o-mini']).map((model) => el('button', { class: model === provider.model ? 'model-chip active' : 'model-chip', type: 'button', onclick: () => chooseModel(model), text: model }))),
      state.providerModels.length > 8 ? el('button', { class: 'ghost', type: 'button', onclick: openModelPicker, text: `Show all ${state.providerModels.length} models` }) : el('span', { hidden: true })
    ]);
    const sectionThree = el('div', { class: 'provider-section span-12 provider-manual-section' }, [
      el('h3', { class: 'provider-section-title', text: 'Custom API' }),
      el('p', { class: 'muted', text: 'Manual fallback is optional. Use it only if OpenAI OAuth cannot connect or you want an OpenAI-compatible gateway.' }),
      el('button', { class: 'ghost', onclick: openCustomApiFallback, text: 'Open Custom API fallback' })
    ]);
    const children = [hero, sectionOne, templateCard, sectionTwo, oauthCard, healthCard, modelCard, sectionThree];
    if (state.modelModalOpen) children.push(modelPickerModal());
    if (state.customApiOpen || state.fallbackModalOpen) children.push(fallbackModal());
    return el('div', { class: 'grid provider-grid' }, children);
  }

  function modelField(value) {
    return el('div', { class: 'model-field' }, [
      el('label', { for: 'model', text: 'Default model' }),
      el('div', { class: 'model-picker-row' }, [
        el('input', { id: 'model', name: 'model', value, readonly: true, 'aria-describedby': 'modelHint' }),
        el('button', { class: 'ghost', type: 'button', onclick: openModelPicker, text: state.providerModelsLoading ? 'Importing…' : 'Choose model' })
      ]),
      el('small', { id: 'modelHint', class: 'muted', text: state.providerModelsLoaded ? `${state.providerModels.length || 1} model(s) available. Auto-import runs when opening Provider.` : 'Models auto-import when you open Provider.' })
    ]);
  }

  function customApiForm(cls = 'span-12') {
    const provider = state.config?.provider || {};
    const form = el('form', { class: `card stack custom-api-card ${cls}`, 'aria-labelledby': 'customApiTitle' }, [
      el('div', { class: 'section-heading' }, [
        el('p', { class: 'provider-kicker', text: 'MANUAL FALLBACK' }),
        el('h2', { id: 'customApiTitle', text: 'Custom API' }),
        el('p', { class: 'muted', text: 'Use this fallback for OpenAI-compatible gateways or when OAuth is not available. Save a base URL, API key reference, and default model.' })
      ]),
      el('div', { class: 'form-grid provider-form-grid' }, [
        input('Provider type', 'type', provider.type || 'openai'),
        input('Base URL', 'baseUrl', provider.baseUrl || 'https://api.openai.com/v1'),
        modelField(provider.model || 'gpt-4o-mini'),
        input('API key / credential ref', 'credentialRef', provider.credentialRef || 'env:OPENAI_API_KEY')
      ]),
      el('button', { class: 'primary', type: 'submit', text: 'Save Custom API fallback' })
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await save('/api/config/provider', { preset: 'custom', type: fd.get('type'), baseUrl: fd.get('baseUrl'), model: fd.get('model'), credentialRef: fd.get('credentialRef') });
      state.fallbackModalOpen = false;
      state.customApiOpen = false;
    });
    return form;
  }

  async function loadProviderModels(force = false) {
    if (!state.token || state.providerModelsLoading || (state.providerModelsLoaded && !force)) return;
    state.providerModelsLoading = true;
    try {
      const r = await api('/api/provider/models');
      const current = state.config?.provider?.model || 'gpt-4o-mini';
      state.providerModels = Array.from(new Set([...(Array.isArray(r.models) ? r.models : []), current].filter(Boolean))).sort();
      state.providerModelsSource = r.source || 'provider';
      state.providerModelsLoaded = true;
      if (r.message) flash(r.message, r.source === 'configured');
    } catch (e) {
      const current = state.config?.provider?.model || 'gpt-4o-mini';
      state.providerModels = [current];
      state.providerModelsLoaded = true;
      flash(`Model import failed: ${e.message}`, true);
    } finally {
      state.providerModelsLoading = false;
    }
  }

  async function openModelPicker() {
    state.modelModalOpen = true;
    await loadProviderModels(true);
    render();
  }

  async function chooseModel(model) {
    await api('/api/provider/default-model', { method: 'POST', body: JSON.stringify({ model }) });
    state.modelModalOpen = false;
    await loadBase();
    state.providerModels = Array.from(new Set([model, ...state.providerModels]));
    flash(`Default model set to ${model}.`);
    render();
  }

  function modelPickerModal() {
    const close = () => { state.modelModalOpen = false; render(); };
    const models = state.providerModels.length ? state.providerModels : [state.config?.provider?.model || 'gpt-4o-mini'];
    const modal = el('div', { class: 'modal-backdrop', role: 'presentation' }, [
      el('section', { class: 'modal-card model-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modelPickerTitle' }, [
        el('button', { class: 'modal-close ghost', type: 'button', onclick: close, 'aria-label': 'Close model picker', text: '×' }),
        el('p', { class: 'provider-kicker', text: 'AVAILABLE MODELS' }),
        el('h2', { id: 'modelPickerTitle', text: 'Choose default model' }),
        el('p', { class: 'muted', text: state.providerModelsLoading ? 'Importing models from provider…' : 'Models are imported automatically when you open Provider. Pick one for chat/default config.' }),
        el('div', { class: 'model-list' }, models.map((model) => el('button', { class: model === state.config?.provider?.model ? 'primary model-choice' : 'ghost model-choice', type: 'button', onclick: () => chooseModel(model), text: model }))),
        el('button', { class: 'ghost', type: 'button', onclick: async () => { await loadProviderModels(true); render(); }, text: 'Re-import models' })
      ])
    ]);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    setTimeout(() => modal.querySelector('.model-choice')?.focus(), 0);
    return modal;
  }

  function hasFallbackSignal(body) {
    if (!body || typeof body !== 'object') return false;
    return Boolean(body.fallbackRequired || body.fallback === true || body.requiresFallback || body.oauthFallbackRequired || body.mode === 'fallback-required' || body.status === 'fallback-required');
  }

  function openCustomApiFallback() {
    state.customApiOpen = true;
    state.fallbackReason = 'Manual Custom API fallback. OAuth is still the recommended OpenAI connection.';
    render();
  }

  function fallbackMessage(body) {
    return (body && (body.message || body.reason || body.detail)) || 'OAuth cannot directly connect in this backend response. Use Custom API fallback to save an OpenAI-compatible base URL, API key reference, and model.';
  }

  function fallbackModal() {
    const close = () => { state.fallbackModalOpen = false; state.customApiOpen = false; render(); };
    const modal = el('div', { class: 'modal-backdrop', role: 'presentation' }, [
      el('section', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fallbackTitle', 'aria-describedby': 'fallbackDesc' }, [
        el('button', { class: 'modal-close ghost', type: 'button', onclick: close, 'aria-label': 'Close Custom API fallback dialog', text: '×' }),
        el('p', { class: 'provider-kicker', text: state.fallbackModalOpen ? 'FALLBACK REQUIRED' : 'MANUAL FALLBACK' }),
        el('h2', { id: 'fallbackTitle', text: state.fallbackModalOpen ? 'Use Custom API fallback' : 'Custom API fallback' }),
        el('p', { id: 'fallbackDesc', class: 'muted', text: state.fallbackReason || 'OAuth is not directly available. Add OpenAI-compatible connection details below.' }),
        customApiForm('modal-form')
      ])
    ]);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    setTimeout(() => modal.querySelector('input')?.focus(), 0);
    return modal;
  }

  function chatView() {
    const usage = state.chatUsage || {};
    const usageTotal = usage.totalTokens ?? usage.total ?? 0;
    const usageDetail = state.chatUsage ? `${usageTotal} total · ${usage.inputTokens ?? usage.input ?? 0} in · ${usage.outputTokens ?? usage.output ?? 0} out` : 'No model usage in this session yet';
    const chat = el('section', { class: 'card stack span-12' }, [
      el('h2', { text: 'Chat test' }),
      el('div', { class: 'usage-bar', role: 'status', 'aria-live': 'polite' }, [
        el('strong', { text: 'Token usage' }), el('span', { text: usageDetail })
      ]),
      el('div', { class: 'chat-box', id: 'chatBox', 'aria-live': 'polite' }, state.chatMessages.length ? state.chatMessages.map(messageBubble) : [messageBubble({ role: 'assistant', content: 'Send a short test message to confirm chat is working. If the provider needs attention, I will show a simple reconnect button here.' })]),
      el('form', { class: 'chat-form' }, [el('input', { name: 'message', placeholder: 'Write a test message…', 'aria-label': 'Chat message' }), el('button', { class: 'primary', type: 'submit', text: 'Send' })])
    ]);
    chat.querySelector('form').addEventListener('submit', sendChat);
    return el('div', { class: 'grid' }, [chat]);
  }

  function channelView() {
    const channel = formView('Telegram Private Chat', '/api/config/channel', [
      input('Channel type', 'type', 'telegram'), input('Bot token ref', 'botTokenRef', state.config?.channel?.botTokenRef || 'env:TELEGRAM_BOT_TOKEN'),
      input('Private chat ID', 'chatId', state.config?.channel?.chatId || '')
    ], (fd) => ({ type: fd.get('type'), botTokenRef: fd.get('botTokenRef'), chatId: fd.get('chatId') }), 'Gunakan chat pribadi untuk kontrol lokal.');
    return channel;
  }

  function messageBubble(msg) {
    const children = [el('p', { text: msg.content })];
    if (msg.cta) children.push(el('button', { class: 'primary', onclick: () => go('/provider'), text: msg.cta, 'aria-label': 'Open Provider settings to reconnect credential' }));
    return el('div', { class: `message ${msg.role === 'user' ? 'user' : 'assistant'}` }, children);
  }

  function formView(heading, endpoint, fields, mapper, hint) {
    const form = el('form', { class: 'card stack span-12' }, [el('h2', { text: heading }), el('p', { class: 'muted', text: hint }), el('div', { class: 'form-grid' }, fields), el('button', { class: 'primary', type: 'submit', text: 'Simpan' })]);
    form.addEventListener('submit', async (e) => { e.preventDefault(); await save(endpoint, mapper(new FormData(form))); });
    return el('div', { class: 'grid' }, [form]);
  }

  function settingsView() {
    const chat = state.config?.chat || { enabled: true, systemPrompt: '', historyLimit: 20 };
    const chatForm = el('form', { class: 'stack' }, [
      el('label', { class: 'toggle-item' }, [el('span', { text: 'Enable chat endpoint' }), el('input', { class: 'switch', type: 'checkbox', name: 'enabled', checked: chat.enabled !== false })]),
      input('System prompt / agent guidance', 'systemPrompt', chat.systemPrompt || '', { textarea: true, placeholder: 'Optional. If empty, backend uses Zeroclaw default agent guidance.' }),
      input('History limit', 'historyLimit', String(chat.historyLimit || 20), { type: 'number', min: '1', max: '100' }),
      el('p', { class: 'muted', text: 'Saved server-side. The backend owns the system prompt; user chat messages cannot override it with a system role.' }),
      el('button', { class: 'primary', type: 'submit', text: 'Save chat guidance' })
    ]);
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(chatForm);
      await save('/api/settings/chat', { enabled: fd.get('enabled') === 'on', systemPrompt: fd.get('systemPrompt')?.toString() || '', historyLimit: Number(fd.get('historyLimit') || 20) });
    });
    return el('div', { class: 'grid' }, [
      card('Dashboard password', el('div', { class: 'stack' }, [
        el('p', { class: 'muted', text: 'Use POST /api/settings/password or set ZEROCLAW_DASHBOARD_PASSWORD before starting the dashboard to replace the local bootstrap password.' })
      ]), 'span-6'),
      card('Chat system prompt', chatForm, 'span-6')
    ]);
  }

  function toolsView() {
    const tools = state.config?.tools || { shell: false, browser: true, files: true, network: false };
    const list = el('div', { class: 'toggle-list' });
    Object.entries(tools).forEach(([name, enabled]) => list.append(el('label', { class: 'toggle-item' }, [el('span', { text: name }), el('input', { class: 'switch', type: 'checkbox', name, checked: enabled })])));
    const form = el('form', { class: 'card stack span-12' }, [el('h2', { text: 'Tool toggles' }), list, el('button', { class: 'primary', type: 'submit', text: 'Simpan toggles' })]);
    form.addEventListener('submit', async (e) => { e.preventDefault(); const payload = {}; new FormData(form).forEach((_, k) => payload[k] = true); Object.keys(tools).forEach(k => payload[k] = Boolean(payload[k])); await save('/api/config/tools', payload); });
    return el('div', { class: 'grid' }, [form]);
  }


  async function checkProviderConnection() {
    try { state.credentialHealth = await api('/api/provider/credential-health'); if (hasFallbackSignal(state.credentialHealth)) { state.fallbackModalOpen = true; state.fallbackReason = fallbackMessage(state.credentialHealth); } await loadProviderModels(true); flash('Connection check complete.'); }
    catch (e) { state.credentialHealth = { status: 'unknown', message: 'Credential health endpoint is not available yet. Saved settings are still visible here.' }; flash('Credential health endpoint not available.', true); }
    render();
  }
  async function clearSavedCredential() {
    if (!confirm('Clear the saved provider credential? Chat will stop working until you reconnect OpenAI OAuth. Tokens stay server-side and are never displayed.')) return;
    try { await api('/api/provider/credential-clear', { method: 'POST', body: '{}' }); state.credentialHealth = { status: 'missing', message: 'Saved credential cleared. Reconnect OpenAI OAuth to chat again.' }; flash('Saved credential cleared. Reconnect OpenAI OAuth to chat again.'); }
    catch (e) { state.credentialHealth = { status: 'unknown', message: 'Clear credential endpoint is not available yet, so nothing was changed.' }; flash('Backend clear endpoint belum tersedia; credential tidak diubah.', true); }
    render();
  }
  async function reconnectOpenAI() {
    try {
      const r = await api('/api/provider/oauth-url', { method: 'POST', body: JSON.stringify({ provider: 'openai' }) });
      if (hasFallbackSignal(r)) { state.fallbackModalOpen = true; state.fallbackReason = fallbackMessage(r); render(); return; }
      const oauthTarget = r.connectUrl || r.url || r.oauthUrl || r.authorizationUrl;
      if (oauthTarget) { sessionStorage.setItem('zeroclaw.oauth.returning', '1'); location.href = oauthTarget; }
      else { state.fallbackModalOpen = true; state.fallbackReason = 'OAuth URL is not available from the backend yet. Use Custom API fallback instead.'; render(); flash('OAuth URL belum tersedia; fallback Custom API dibuka.', true); }
    }
    catch (e) { state.fallbackModalOpen = true; state.fallbackReason = 'OpenAI OAuth is not available in this backend yet. Use Custom API fallback instead.'; render(); flash('OpenAI OAuth unavailable; Custom API fallback opened.', true); }
  }
  async function sendChat(e) {
    e.preventDefault();
    const form = e.target; const text = new FormData(form).get('message')?.toString().trim(); if (!text) return;
    state.chatMessages.push({ role: 'user', content: text }); form.reset(); render();
    try {
      const history = state.chatMessages.slice(0, -1).filter((msg) => ['user', 'assistant'].includes(msg.role) && msg.content && !msg.cta).slice(-((state.config?.chat?.historyLimit || 20) * 2));
      const r = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text, messages: history }) });
      state.chatUsage = r.usage || state.chatUsage;
      if (r.mode === 'credential-error') {
        state.credentialHealth = r.credential || { status: 'invalid' };
        state.chatMessages.push({ role: 'assistant', content: r.reply || 'I need a fresh provider connection before I can chat. Please reconnect OpenAI OAuth, then try again.', cta: 'Open Provider settings' });
      } else {
        state.chatMessages.push({ role: 'assistant', content: r.reply || r.message || r.response || 'Chat response received.' });
      }
    } catch (err) {
      if (String(err.message).includes('credential')) state.chatMessages.push({ role: 'assistant', content: 'I need a fresh provider connection before I can chat. Please reconnect OpenAI OAuth, then try again.', cta: 'Open Provider settings' });
      else state.chatMessages.push({ role: 'assistant', content: 'Chat is not available right now. Please try again after checking the provider connection.' });
    }
    render();
  }

  async function save(endpoint, payload) { try { await api(endpoint, { method: 'POST', body: JSON.stringify(payload) }); flash('Tersimpan.'); await loadBase(); render(); } catch (e) { flash(e.message, true); } }
  async function init() { await save('/api/init', {}); }
  async function runtime(action) { try { state.status = await api(`/api/runtime/${action}`, { method: 'POST', body: '{}' }); flash(`Runtime ${action} OK.`); render(); } catch (e) { flash(e.message, true); } }
  async function loadDoctor() { try { state.doctor = await api('/api/doctor'); render(); } catch(e) { flash(e.message, true); } }
  async function loadLogs() { try { const r = await api('/api/logs'); state.logs = typeof r === 'string' ? r : json(r); render(); } catch(e) { flash(e.message, true); } }

  function renderLogin() {
    $('pageTitle').textContent = 'Masuk Zeroclaw';
    $('routeEyebrow').textContent = '/login';
    $('notice').hidden = true;
    $('view').replaceChildren($('loginTemplate').content.cloneNode(true));
    const form = $('loginForm');
    const status = $('loginStatus');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Membuka sesi lokal…';
      try {
        const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: new FormData(form).get('password') }) });
        state.token = res.token || res.accessToken || res.session?.token || '';
        if (!state.token) throw new Error('Token tidak ditemukan di respons login.');
        sessionStorage.setItem(tokenKey, state.token);
        history.pushState(null, '', '/');
        await loadBase();
        render();
        flash('Login berhasil.');
      } catch (err) {
        status.textContent = err.message;
        status.setAttribute('role', 'alert');
        form.querySelector('#password')?.focus();
      } finally {
        button.disabled = false;
      }
    });
  }

  async function render() {
    if (location.pathname === '/login' || !state.token) { history.replaceState(null, '', '/login'); setAuth(); renderNav(); return renderLogin(); }
    if (sessionStorage.getItem('zeroclaw.oauth.returning') === '1' || consumeOAuthReturnMarker()) {
      sessionStorage.removeItem('zeroclaw.oauth.returning');
      try { await loadBase(); state.credentialHealth = await api('/api/provider/credential-health'); await loadProviderModels(true); flash('OpenAI OAuth status refreshed. Models imported.'); } catch (_) {}
    }
    if (!views[location.pathname]) history.replaceState(null, '', '/');
    if (location.pathname === '/provider') await loadProviderModels();
    setAuth(); renderNav(); $('routeEyebrow').textContent = location.pathname; $('pageTitle').textContent = routes.find(r => r[0] === location.pathname)?.[1] || 'Overview';
    $('view').replaceChildren(views[location.pathname]());
  }

  $('menuBtn').addEventListener('click', () => {
    const open = !$('shell').classList.contains('nav-open');
    $('shell').classList.toggle('nav-open', open);
    $('menuBtn').setAttribute('aria-expanded', String(open));
  });
  $('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem(tokenKey); state.token = ''; history.pushState(null, '', '/login'); render(); });
  $('refreshBtn').addEventListener('click', async () => { await loadBase(); render(); flash('Data diperbarui.'); });
  addEventListener('message', async (event) => {
    if (!isTrustedOAuthMessage(event)) return;
    await loadBase();
    await checkProviderConnection();
    await loadProviderModels(true);
    render();
    flash('OpenAI connected. Models imported.');
  });
  addEventListener('popstate', render);
  loadBase().then(render);
})();
