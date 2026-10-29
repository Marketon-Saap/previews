/* Transcargo · asistente del sitio · widget de chat · v0.1.0 · 2026-10-29 · APTO
   Clon del widget del chat de la landing de APTO, con el look del sitio de Transcargo (Manrope/Inter, morados) y sin
   captura de datos: el asistente orienta y entrega al cotizador (#cotizador), al formulario (#contacto) o a WhatsApp.

   Uso: antes de </body>
     <script>window.TRANSCARGO_CHAT = { api: 'https://HOST-DEL-ASISTENTE', whatsapp: '5213121216310' };</script>
     <script src="/js/asistente-transcargo.js" defer></script>

   Opciones de window.TRANSCARGO_CHAT: api (obligatoria), whatsapp (dígitos con 52), name, privacy (URL del aviso),
   greeting (saludo), debug (imprime los eventos del dataLayer en consola; también con ?chat_debug=1).

   Backend: POST {api}/chat (SSE propio: data:{meta|delta|done|error}) y POST {api}/event ({type:"action", action}).
   Eventos al dataLayer: chat_open, chat_start, chat_message, chat_reply, chat_action, chat_error, chat_close
   (contrato en el README del Worker). Nunca datos personales. ES2017, sin "?." ni "??". */
(function () {
  'use strict';
  if (window.__tcChatLoaded) return;
  window.__tcChatLoaded = true;

  var CFG = window.TRANSCARGO_CHAT || {};
  var API = String(CFG.api || '').replace(/\/+$/, '');
  var NAME = CFG.name || 'Asistente de Transcargo';
  var VERSION = '0.1.0';
  var WA = String(CFG.whatsapp || '5213121216310').replace(/\D/g, '');
  var PRIVACY_URL = CFG.privacy || '/uso-de-informacion/';
  var GREETING = CFG.greeting || 'Hola, soy el asistente de Transcargo. Te explico cómo funciona el seguro de mercancía y te llevo a cotizar tu embarque. ¿Qué mercancía mueves?';
  var START_CHIPS = ['¿Qué cubre?', '¿Cuánto cuesta?', 'Cotizar mi embarque'];
  var MAX_HISTORY = 14;
  var MOBILE = function () { return window.matchMedia && window.matchMedia('(max-width: 780px)').matches; };
  if (!API) { if (window.console) console.warn('[chat] falta TRANSCARGO_CHAT.api'); return; }

  /* ── estilos: tokens del sitio de Transcargo con respaldo ── */
  var css = ''
    + '#tcChatRoot{--tc-deep:#1D0C44;--tc-purple:#451DA1;--tc-lilac:#EEEBF7;--tc-line:#C2C1E3;--tc-ink:#212121;--tc-soft:#676767;--tc-paper:#fff;--tc-paper-2:#F5F6F6;--tc-z:60;--tc-sans:Manrope,system-ui,sans-serif;--tc-text:Inter,system-ui,sans-serif;font-family:var(--tc-sans);color:var(--tc-ink)}'
    + '.tc-fab{position:fixed;right:18px;bottom:18px;z-index:var(--tc-z);display:inline-flex;align-items:center;gap:12px;min-height:56px;padding:0 20px 0 8px;border:0;border-radius:999px;background:var(--tc-deep);color:#fff;font:600 15px/1.2 var(--tc-sans);cursor:pointer;box-shadow:0 14px 32px -10px rgba(29,12,68,.55);transition:transform .2s ease,background .2s;text-align:left}'
    + '.tc-fab:hover{background:var(--tc-purple);transform:translateY(-2px);color:#fff}'
    + '.tc-fab:focus-visible{outline:3px solid var(--tc-purple);outline-offset:4px}'
    + '.tc-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--tc-purple);color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em;flex:0 0 40px}'
    + '.tc-fab-txt{display:flex;flex-direction:column}'
    + '.tc-fab small{display:block;font-weight:400;font-size:12px;opacity:.75;margin-top:3px}'
    + 'body.tc-open .tc-fab{display:none}'
    + '@media (max-width:780px){.tc-fab{right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));min-height:52px;padding-right:16px}.tc-fab small{display:none}}'
    + '.tc-panel{position:fixed;right:18px;bottom:18px;z-index:calc(var(--tc-z) + 1);width:min(400px,calc(100vw - 36px));height:min(680px,calc(100vh - 36px));height:min(680px,calc(100dvh - 36px));display:none;flex-direction:column;background:var(--tc-paper);border-radius:24px;box-shadow:0 32px 64px -16px rgba(29,12,68,.4),0 0 0 1px var(--tc-line);overflow:hidden;padding:0;margin:0;box-sizing:border-box}'
    + '.tc-panel.is-open{display:flex;animation:tcIn .24s ease}'
    + '@keyframes tcIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'
    + '@media (max-width:780px){.tc-panel{right:0;bottom:0;left:0;width:100%;height:100%;height:100dvh;border-radius:0}}'
    + '@media (prefers-reduced-motion:reduce){.tc-panel.is-open{animation:none}.tc-fab:hover{transform:none}}'
    + '.tc-head{display:flex;align-items:center;gap:12px;padding:14px 14px 12px;background:var(--tc-deep);color:#fff;flex:0 0 auto}'
    + '.tc-head .tc-avatar{width:38px;height:38px;flex-basis:38px}'
    + '.tc-head-txt{flex:1;min-width:0;line-height:1.2}'
    + '.tc-head-txt strong{display:block;font-size:15px;font-weight:600}'
    + '.tc-head-txt span{display:block;font-size:12px;color:#C2C1E3;margin-top:3px}'
    + '.tc-close{width:40px;height:40px;border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:999px;cursor:pointer;display:grid;place-items:center;font-size:24px;line-height:1}'
    + '.tc-close:hover{background:rgba(255,255,255,.2)}'
    + '.tc-msgs{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px 14px 8px;background:var(--tc-paper-2);display:flex;flex-direction:column;gap:10px}'
    + '.tc-msgs>*{flex:0 0 auto}'
    + '.tc-msg{max-width:88%;padding:11px 14px;border-radius:20px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-family:var(--tc-text)}'
    + '.tc-msg.is-bot{align-self:flex-start;background:var(--tc-paper);color:var(--tc-ink);border:1px solid #E0E0E0;border-bottom-left-radius:6px}'
    + '.tc-msg.is-user{align-self:flex-end;background:var(--tc-deep);color:#fff;border-bottom-right-radius:6px}'
    + '.tc-msg.is-sys{align-self:center;background:transparent;color:var(--tc-soft);font-size:12px;text-align:center;padding:2px 8px;font-family:var(--tc-sans);max-width:100%}'
    + '.tc-msg a{color:var(--tc-purple);text-decoration:underline;text-underline-offset:2px}'
    + '.tc-typing{align-self:flex-start;display:flex;gap:4px;padding:14px 14px;background:var(--tc-paper);border:1px solid #E0E0E0;border-radius:20px;border-bottom-left-radius:6px}'
    + '.tc-typing i{width:7px;height:7px;border-radius:50%;background:#C2C1E3;animation:tcDot 1s infinite ease-in-out}'
    + '.tc-typing i:nth-child(2){animation-delay:.15s}.tc-typing i:nth-child(3){animation-delay:.3s}'
    + '@keyframes tcDot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}'
    + '.tc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 14px 8px;background:var(--tc-paper-2);flex:0 0 auto}'
    + '.tc-chips:empty{padding:0}'
    + '.tc-chip{border:1px solid var(--tc-line);background:var(--tc-paper);color:var(--tc-deep);border-radius:999px;padding:8px 12px;font:600 12.5px/1.2 var(--tc-sans);cursor:pointer;min-height:36px}'
    + '.tc-chip:hover{border-color:var(--tc-purple);color:var(--tc-purple)}'
    + '.tc-chip:focus-visible{outline:2px solid var(--tc-purple);outline-offset:2px}'
    + '.tc-chip.is-pri{background:var(--tc-deep);color:#fff;border-color:var(--tc-deep)}.tc-chip.is-pri:hover{background:var(--tc-purple);border-color:var(--tc-purple);color:#fff}'
    + '.tc-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E0E0E0;background:var(--tc-paper);flex:0 0 auto}'
    + '.tc-input{flex:1;min-height:46px;max-height:120px;resize:none;border:1px solid var(--tc-line);border-radius:16px;padding:12px 14px;font:inherit;font-family:var(--tc-text);font-size:16px;line-height:1.35;color:var(--tc-ink);background:#fff;outline:none}'
    + '.tc-input:focus{border-color:var(--tc-purple);box-shadow:0 0 0 3px rgba(69,29,161,.15)}'
    + '.tc-send{width:48px;height:46px;border:0;border-radius:999px;background:var(--tc-deep);color:#fff;cursor:pointer;display:grid;place-items:center;flex:0 0 48px}'
    + '.tc-send:hover{background:var(--tc-purple)}.tc-send:disabled{opacity:.45;cursor:not-allowed}'
    + '.tc-send svg{width:20px;height:20px}'
    + '.tc-foot{padding:6px 14px 10px;font-size:11px;color:var(--tc-soft);background:var(--tc-paper);text-align:center;line-height:1.4;flex:0 0 auto}'
    + '.tc-foot a{color:var(--tc-purple);text-decoration:underline}'
    + '.tc-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:calc(var(--tc-z) + 3);background:var(--tc-deep);color:#fff;padding:10px 16px;border-radius:999px;font:600 13px/1.3 var(--tc-sans);opacity:0;pointer-events:none;transition:opacity .2s;max-width:calc(100vw - 32px);text-align:center}'
    + '.tc-toast.is-on{opacity:1}';
  var style = document.createElement('style');
  style.id = 'tcChatStyles';
  style.textContent = css;
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement('div');
  root.id = 'tcChatRoot';
  root.innerHTML = ''
    + '<button class="tc-fab" id="tcFab" type="button" aria-haspopup="dialog" aria-controls="tcPanel" aria-expanded="false">'
    + '<span class="tc-avatar" aria-hidden="true">TC</span>'
    + '<span class="tc-fab-txt">¿Dudas sobre tu seguro?<small>Te respondemos al momento, a cualquier hora</small></span>'
    + '</button>'
    + '<div class="tc-panel" id="tcPanel" role="dialog" aria-modal="false" aria-labelledby="tcTitle" aria-hidden="true">'
    + '<header class="tc-head"><span class="tc-avatar" aria-hidden="true">TC</span>'
    + '<div class="tc-head-txt"><strong id="tcTitle">' + esc(NAME) + '</strong><span>Asistente de IA · te responde al momento</span></div>'
    + '<button class="tc-close" id="tcClose" type="button" aria-label="Cerrar chat">×</button></header>'
    + '<div class="tc-msgs" id="tcMsgs" role="log" aria-live="polite" aria-relevant="additions"></div>'
    + '<div class="tc-chips" id="tcChips"></div>'
    + '<form class="tc-form" id="tcForm" autocomplete="off">'
    + '<label for="tcInput" style="position:absolute;left:-9999px">Escribe tu mensaje</label>'
    + '<textarea class="tc-input" id="tcInput" rows="1" placeholder="Escribe tu pregunta…" maxlength="1200" enterkeyhint="send"></textarea>'
    + '<button class="tc-send" id="tcSend" type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    + '</form>'
    + '<div class="tc-foot">Asistente con inteligencia artificial de Transcargo. No pide ni guarda tus datos personales; lo que escribas puede guardarse para mejorar el servicio · <a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">Uso de información</a></div>'
    + '</div>'
    + '<div class="tc-toast" id="tcToast" role="status" aria-live="polite"></div>';
  document.body.appendChild(root);

  var fab = byId('tcFab'), panel = byId('tcPanel'), closeBtn = byId('tcClose');
  var msgs = byId('tcMsgs'), chips = byId('tcChips'), form = byId('tcForm');
  var input = byId('tcInput'), sendBtn = byId('tcSend'), toast = byId('tcToast');

  /* ── estado ── */
  var history = [];
  var busy = false, opened = false, greeted = false, turns = 0, openedAt = 0, openCount = 0;
  var mode = '', brain = '', modeNoticed = false, lastAction = '';
  var canStream = typeof window.ReadableStream !== 'undefined' && typeof window.TextDecoder !== 'undefined' && typeof Response !== 'undefined' && ('body' in Response.prototype);
  var sid = (function () {
    var make = function () { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
    try {
      var s = sessionStorage.getItem('tc_chat_sid');
      if (!s) { s = make(); sessionStorage.setItem('tc_chat_sid', s); }
      return s;
    } catch (e) { return make(); }
  })();

  /* ── medición ── */
  var DEBUG = !!CFG.debug || /[?&]chat_debug=1/.test(location.search);
  function track(ev, extra) {
    try {
      window.dataLayer = window.dataLayer || [];
      var p = { event: ev, chat_session_id: sid, chat_turn: turns, chat_open_count: openCount, chat_mode: mode || 'unknown', chat_brain: brain || 'unknown', chat_widget_version: VERSION };
      var k; for (k in (extra || {})) if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k];
      if (DEBUG && window.console) console.log('[chat] dataLayer', ev, p);
      window.dataLayer.push(p);
    } catch (e) {}
  }

  /* ── helpers de render ── */
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function scrollBottom() { msgs.scrollTop = msgs.scrollHeight; }
  function clean(t) { return String(t || '').replace(/\*\*/g, '').replace(/\r/g, ''); }
  function addMsg(role, text) {
    var el = document.createElement('div');
    el.className = 'tc-msg ' + (role === 'user' ? 'is-user' : role === 'sys' ? 'is-sys' : 'is-bot');
    el.textContent = clean(text);
    msgs.appendChild(el); scrollBottom(); return el;
  }
  var typingEl = null;
  function typing(on) {
    if (on && !typingEl) { typingEl = document.createElement('div'); typingEl.className = 'tc-typing'; typingEl.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(typingEl); scrollBottom(); }
    if (!on && typingEl) { typingEl.parentNode && typingEl.parentNode.removeChild(typingEl); typingEl = null; }
  }
  var toastT = null;
  function showToast(t) { toast.textContent = t; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3400); }
  function setBusy(b) { busy = b; sendBtn.disabled = b; input.disabled = b; }

  /* ── acciones de entrega: cotizador, formulario, WhatsApp ── */
  var ACTION_LABEL = { cotizar: 'Ir al cotizador', contacto: 'Ir al formulario de contacto', whatsapp: 'Escribir por WhatsApp' };
  var SECTION_FOR = { cotizador: '#cotizador', seguros: '#seguros', 'como-funciona': '#como-funciona', transportes: '#transportes', casos: '#casos', faqs: '#faqs', contacto: '#contacto' };
  function remember(action) {
    // Para la atribución del chat: el sitio puede leer tc_chat y mandarlo con el cotizador o el formulario.
    try { localStorage.setItem('tc_chat', JSON.stringify({ session_id: sid, action: action, ts: new Date().toISOString() })); } catch (e) {}
  }
  function act(action, from) {
    lastAction = action;
    track('chat_action', { chat_action: action, chat_from: from || '' });
    remember(action);
    try { fetch(API + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ session_id: sid, type: 'action', action: action }) }).catch(function () {}); } catch (e) {}
    if (action === 'whatsapp') {
      var txt = 'Hola, vengo del asistente del sitio de Transcargo y quiero asegurar un embarque.';
      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      return;
    }
    var sel = action === 'cotizar' ? '#cotizador' : '#contacto';
    var el = document.querySelector(sel);
    if (MOBILE()) close();
    if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } }
    else location.hash = sel;
    showToast(action === 'cotizar' ? 'Te llevamos al cotizador' : 'Te llevamos al formulario de contacto');
  }
  function goToSection(topic) {
    var sel = SECTION_FOR[topic]; var el = sel && document.querySelector(sel);
    track('chat_action', { chat_action: 'section', chat_target: sel || '' });
    if (!el) return;
    if (MOBILE()) close();
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
  }

  /* ── chips ── */
  function setChips(list, topic, action) {
    chips.innerHTML = '';
    var items = [];
    if (action && ACTION_LABEL[action]) items.push({ t: ACTION_LABEL[action], pri: true, action: action });
    (list || []).slice(0, 3).forEach(function (t) { items.push({ t: t }); });
    if (topic && SECTION_FOR[topic] && !action) items.push({ t: 'Ver en la página ↗', section: topic });
    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tc-chip' + (it.pri ? ' is-pri' : ''); b.textContent = it.t;
      b.addEventListener('click', function () { onChip(it); });
      chips.appendChild(b);
    });
  }
  function onChip(it) {
    if (it.action) { act(it.action, 'chip'); return; }
    if (it.section) { goToSection(it.section); return; }
    var t = it.t;
    if (/cotizar mi embarque|ir al cotizador|^cotizar$/i.test(t)) { act('cotizar', 'chip'); return; }
    if (/hablar con un asesor|escribir por whatsapp|whatsapp/i.test(t)) { act('whatsapp', 'chip'); return; }
    if (/formulario de contacto|dejar mis datos/i.test(t)) { act('contacto', 'chip'); return; }
    if (/intentar de nuevo/i.test(t)) { return; }
    track('chat_action', { chat_action: 'chip', chat_label: t });
    send(t, true);
  }

  /* ── abrir / cerrar ── */
  function open() {
    opened = true; panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false'); fab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('tc-open');
    if (!greeted) {
      addMsg('bot', GREETING); history.push({ role: 'assistant', content: GREETING }); greeted = true;
      setChips(START_CHIPS);
    }
    openCount++; openedAt = Date.now();
    track('chat_open', {});
    setTimeout(function () { if (!MOBILE()) input.focus({ preventScroll: true }); }, 250);
  }
  function close() {
    if (!opened) return;
    track('chat_close', { chat_duration_s: openedAt ? Math.round((Date.now() - openedAt) / 1000) : 0 });
    opened = false; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); fab.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('tc-open'); fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });

  /* ── atribución que el sitio guardó (tc_origen: utm_*, gclid, fbclid) ── */
  function attribution() {
    try {
      var o = JSON.parse(localStorage.getItem('tc_origen') || 'null'); if (!o || typeof o !== 'object') return null;
      var out = {}, keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'], i;
      for (i = 0; i < keys.length; i++) if (o[keys[i]]) out[keys[i]] = String(o[keys[i]]).slice(0, 200);
      return out;
    } catch (e) { return null; }
  }

  /* ── enviar y recibir en streaming ── */
  function send(text, fromChip) {
    text = String(text || '').trim(); if (!text || busy) return;
    addMsg('user', text); history.push({ role: 'user', content: text });
    input.value = ''; input.style.height = ''; setChips([]); setBusy(true); typing(true);
    turns++;
    var t0 = Date.now();
    if (turns === 1) track('chat_start', {});
    track('chat_message', { chat_message_len: text.length, chat_from: fromChip ? 'chip' : 'typed' });
    var topic = '';
    var body = { session_id: sid, messages: history.slice(-MAX_HISTORY), stream: canStream, attr: attribution() || undefined, page: { pageUri: location.href.slice(0, 2000), pageName: document.title.slice(0, 200) } };
    var attempt = 0, lastErr = '', rendered = false;

    function request() {
      attempt++;
      return fetch(API + '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) {
          if (!r.ok) {
            return r.json().catch(function () { return {}; }).then(function (j) {
              lastErr = 'http_' + r.status + (j && j.error ? '_' + j.error : '');
              throw new Error(lastErr);
            });
          }
          var ct = r.headers.get('Content-Type') || '';
          if (ct.indexOf('text/event-stream') < 0 || !canStream) {
            return r.json().then(function (j) { if (j.brain) brain = j.brain; if (j.topic) topic = j.topic; finish(clean(j.reply || ''), j.suggestions || [], j.mode, null, j.action || null); });
          }
          return readStream(r);
        })
        .catch(function (e) {
          if (!lastErr) lastErr = 'network_' + String(e && e.message || e).slice(0, 60);
          if (!rendered && attempt < 2) return new Promise(function (res) { setTimeout(res, 1200); }).then(request);
          throw e;
        });
    }
    function readStream(r) {
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', el = null, full = '', done = false;
      function handle(obj) {
        if (obj.meta) { setMode(obj.meta.mode); if (obj.meta.brain) brain = obj.meta.brain; }
        if (typeof obj.delta === 'string' && obj.delta) {
          if (!el) { typing(false); el = addMsg('bot', ''); rendered = true; }
          full += obj.delta; el.textContent = clean(full); scrollBottom();
        }
        if (obj.error) { lastErr = String(obj.error); throw new Error(lastErr); }
        if (obj.done) { done = true; if (obj.topic) topic = obj.topic; finish(clean(full), obj.suggestions || [], mode, el, obj.action || null); }
      }
      function pump() {
        return reader.read().then(function (c) {
          if (c.done) { if (!done) { if (full) finish(clean(full), [], mode, el, null); else throw new Error(lastErr = 'stream_ended_early'); } return; }
          buf += dec.decode(c.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            var block = buf.slice(0, idx); buf = buf.slice(idx + 2);
            var lines = block.split('\n'), i;
            for (i = 0; i < lines.length; i++) {
              if (lines[i].indexOf('data:') !== 0) continue;
              var obj; try { obj = JSON.parse(lines[i].slice(5).trim()); } catch (e) { continue; }
              handle(obj);
            }
          }
          return pump();
        });
      }
      return pump();
    }
    function finish(reply, suggestions, m, el, action) {
      typing(false);
      if (!reply) reply = 'Se me fue la señal un segundo. ¿Me lo repites?';
      if (el) el.textContent = reply; else addMsg('bot', reply);
      rendered = true;
      history.push({ role: 'assistant', content: reply });
      if (m) setMode(m);
      track('chat_reply', { chat_reply_len: reply.length, chat_latency_ms: Date.now() - t0, chat_suggested_action: action || '' });
      setChips(suggestions, topic, action);
    }
    request()
      .catch(function () {
        typing(false);
        track('chat_error', { chat_error: lastErr || 'unknown', chat_online: navigator.onLine ? 'true' : 'false' });
        var el = document.createElement('div'); el.className = 'tc-msg is-bot';
        if (/http_429/.test(lastErr)) el.textContent = 'Vas muy rápido. Espera un momento e intenta de nuevo.';
        else el.innerHTML = 'No pude conectar ahora mismo. Intenta de nuevo o escríbele al asesor por <a href="https://wa.me/' + WA + '" target="_blank" rel="noopener">WhatsApp</a>.';
        msgs.appendChild(el); scrollBottom();
        setChips(['Intentar de nuevo', 'Hablar con un asesor']);
        var retry = chips.querySelector('.tc-chip');
        if (retry) retry.addEventListener('click', function () { history.pop(); send(text); }, { once: true });
      })
      .then(function () { setBusy(false); if (opened && !MOBILE()) input.focus({ preventScroll: true }); });
  }
  function setMode(m) {
    if (!m || mode === m) return;
    mode = m;
    if (m === 'mock' && !modeNoticed) { modeNoticed = true; addMsg('sys', 'Modo de prueba: las respuestas son simuladas.'); }
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', function () { input.style.height = ''; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
})();
