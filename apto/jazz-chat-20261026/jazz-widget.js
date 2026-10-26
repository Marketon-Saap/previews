/* APTO · Jazz · widget de chat para la landing (Marketon) · v0.2.1 · 2026-10-26 (en producción en landing.apto.mx desde el 26-oct-2026)
   Parte del bloque de Plasi (Marketon/infra/plasi) adaptado al look de landing.apto.mx.

   Uso: antes de </body>
     <script>window.JAZZ_CHAT = { api: 'https://apto-chat-api.marketon-saap.workers.dev' };</script>
     <script src="jazz-widget.js" defer></script>

   Backend: POST {api}/chat (SSE propio: data:{meta|delta|done|error}) y POST {api}/lead.
   Acciones: preguntar por servicios, método y casos (y "Ver en la página" lleva a la sección);
   "Hablar con alguien" abre el formulario de la landing prellenado con lo que el chat ya sabe;
   "Dejar mis datos" muestra una tarjeta en el chat y manda el prospecto a /lead (mismo contrato
   que el formulario; el Worker del formulario hace HubSpot, GA4, CAPI y correo).
   Eventos al dataLayer: chat_open, chat_start, chat_message, chat_reply, chat_lead_prefill, chat_error, chat_close, chat_action
   y generate_lead_client (mismos parámetros que form_submit_success del formulario).
   Sin encadenamiento opcional ni sintaxis posterior a ES2017: capture.js ya se rompió en un
   Android viejo por eso (15-oct-2026). */
(function () {
  'use strict';
  if (window.__jazzWidgetLoaded) return;
  window.__jazzWidgetLoaded = true;

  var CFG = window.JAZZ_CHAT || {};
  var API = String(CFG.api || 'https://apto-chat-api.marketon-saap.workers.dev').replace(/\/+$/, '');
  var NAME = CFG.name || 'Jazz';
  var VERSION = '0.2.1';
  var PRIVACY_URL = CFG.privacy || 'https://landing.apto.mx/aviso-de-privacidad/'; // aviso de la landing (previews lo carga desde su copia)
  var MAX_HISTORY = 14;
  var MOBILE = function () { return window.matchMedia && window.matchMedia('(max-width: 780px)').matches; };

  /* ── estilos: tokens de la landing (--navy, --accent, --paper…) con respaldo ── */
  var css = ''
    + '#jazzRoot{--jz-navy:var(--navy,#01122d);--jz-accent:var(--accent,#2563ff);--jz-accent-2:var(--accent-2,#1a52e6);--jz-paper:var(--paper,#fff);--jz-paper-2:var(--paper-2,#f4f1ea);--jz-ink:var(--ink,#1b1712);--jz-ink-70:var(--ink-70,#655e55);--jz-line:var(--line,rgba(27,23,18,.15));--jz-radius:var(--radius,4px);--jz-z:60;font-family:var(--sans,Satoshi,system-ui,sans-serif);color:var(--jz-ink)}'
    + '.jz-fab{position:fixed;right:18px;bottom:18px;z-index:var(--jz-z);display:inline-flex;align-items:center;gap:12px;min-height:56px;padding:0 20px 0 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:var(--jz-navy);color:#fff;font:500 15px/1.2 var(--sans,Satoshi,system-ui,sans-serif);cursor:pointer;box-shadow:0 14px 32px -10px rgba(1,18,45,.6);transition:transform .2s var(--ease,ease),background .2s;text-align:left}'
    + '.jz-fab:hover{background:var(--jz-accent);transform:translateY(-2px);color:#fff}'
    + '.jz-fab:focus-visible{outline:3px solid var(--jz-accent);outline-offset:4px}'
    + '.jz-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--jz-accent);color:#fff;font-weight:600;font-size:13px;letter-spacing:.04em;flex:0 0 40px}'
    + '.jz-fab-txt{display:flex;flex-direction:column}'
    + '.jz-fab small{display:block;font-weight:400;font-size:12px;opacity:.75;margin-top:3px}'
    + 'body.jz-open .jz-fab,body.form-modal-open .jz-fab{display:none}'
    + '@media (max-width:780px){.jz-fab{right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));min-height:52px;padding-right:16px}.jz-fab small{display:none}}'
    + '.jz-panel{position:fixed;right:18px;bottom:18px;z-index:calc(var(--jz-z) + 1);width:min(400px,calc(100vw - 36px));height:min(680px,calc(100vh - 36px));height:min(680px,calc(100dvh - 36px));display:none;flex-direction:column;background:var(--jz-paper);border-radius:var(--jz-radius);box-shadow:0 32px 64px -16px rgba(1,18,45,.45),0 0 0 1px var(--jz-line);overflow:hidden;padding:0;margin:0;box-sizing:border-box}'
    + '.jz-panel.is-open{display:flex;animation:jzIn .24s var(--ease,ease)}'
    + '@keyframes jzIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'
    + '@media (max-width:780px){.jz-panel{right:0;bottom:0;left:0;width:100%;height:100%;height:100dvh;border-radius:0}}'
    + '@media (prefers-reduced-motion:reduce){.jz-panel.is-open{animation:none}.jz-fab:hover{transform:none}}'
    + '.jz-head{display:flex;align-items:center;gap:12px;padding:14px 14px 12px;background:var(--jz-navy);color:#fff;flex:0 0 auto}'
    + '.jz-head .jz-avatar{width:38px;height:38px;flex-basis:38px}'
    + '.jz-head-txt{flex:1;min-width:0;line-height:1.2}'
    + '.jz-head-txt strong{display:block;font-size:15px;font-weight:500}'
    + '.jz-head-txt span{display:block;font-size:12px;color:#bcb6ac;margin-top:3px}'
    + '.jz-close{width:40px;height:40px;border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:var(--jz-radius);cursor:pointer;display:grid;place-items:center;font-size:24px;line-height:1}'
    + '.jz-close:hover{background:rgba(255,255,255,.16)}'
    + '.jz-msgs{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px 14px 8px;background:var(--jz-paper-2);display:flex;flex-direction:column;gap:10px}'
    + '.jz-msgs>*{flex:0 0 auto}'
    + '.jz-msg{max-width:88%;padding:11px 14px;border-radius:var(--jz-radius);font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-family:var(--prose,"Clash Grotesk",system-ui,sans-serif)}'
    + '.jz-msg.is-bot{align-self:flex-start;background:var(--jz-paper);color:var(--jz-ink);border:1px solid var(--jz-line)}'
    + '.jz-msg.is-user{align-self:flex-end;background:var(--jz-navy);color:#fff}'
    + '.jz-msg.is-sys{align-self:center;background:transparent;color:var(--jz-ink-70);font-size:12px;text-align:center;padding:2px 8px;font-family:var(--sans,Satoshi,system-ui,sans-serif);max-width:100%}'
    + '.jz-msg a{color:var(--jz-accent);text-decoration:underline;text-underline-offset:2px}'
    + '.jz-typing{align-self:flex-start;display:flex;gap:4px;padding:14px 14px;background:var(--jz-paper);border:1px solid var(--jz-line);border-radius:var(--jz-radius)}'
    + '.jz-typing i{width:7px;height:7px;border-radius:50%;background:#b9b3a9;animation:jzDot 1s infinite ease-in-out}'
    + '.jz-typing i:nth-child(2){animation-delay:.15s}.jz-typing i:nth-child(3){animation-delay:.3s}'
    + '@keyframes jzDot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}'
    + '.jz-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 14px 8px;background:var(--jz-paper-2);flex:0 0 auto}'
    + '.jz-chips:empty{padding:0}'
    + '.jz-chip{border:1px solid #b9b3a9;background:var(--jz-paper);color:var(--jz-ink);border-radius:999px;padding:8px 12px;font:500 12.5px/1.2 var(--sans,Satoshi,system-ui,sans-serif);cursor:pointer;min-height:36px}'
    + '.jz-chip:hover{border-color:var(--jz-accent);color:var(--jz-accent)}'
    + '.jz-chip:focus-visible{outline:2px solid var(--jz-accent);outline-offset:2px}'
    + '.jz-chip.is-pri{background:var(--jz-ink);color:#fff;border-color:var(--jz-ink)}.jz-chip.is-pri:hover{background:var(--jz-accent);border-color:var(--jz-accent);color:#fff}'
    + '.jz-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--jz-line);background:var(--jz-paper);flex:0 0 auto}'
    + '.jz-input{flex:1;min-height:46px;max-height:120px;resize:none;border:1px solid #b9b3a9;border-radius:var(--jz-radius);padding:12px 11px;font:inherit;font-size:16px;line-height:1.35;color:var(--jz-ink);background:rgba(255,255,255,.8);outline:none}'
    + '.jz-input:focus{border-color:var(--jz-accent);box-shadow:0 0 0 3px rgba(37,99,255,.18)}'
    + '.jz-send{width:48px;height:46px;border:0;border-radius:var(--jz-radius);background:var(--jz-accent);color:#fff;cursor:pointer;display:grid;place-items:center;flex:0 0 48px}'
    + '.jz-send:hover{background:var(--jz-accent-2)}.jz-send:disabled{opacity:.45;cursor:not-allowed}'
    + '.jz-send svg{width:20px;height:20px}'
    + '.jz-foot{padding:6px 14px 10px;font-size:11px;color:var(--jz-ink-70);background:var(--jz-paper);text-align:center;line-height:1.4;flex:0 0 auto}'
    + '.jz-foot a{color:var(--jz-accent);text-decoration:underline}'
    + '.jz-lead{align-self:stretch;max-width:100%;background:var(--jz-paper);border:1px solid var(--jz-line);border-radius:var(--jz-radius);padding:14px}'
    + '.jz-lead-t{font-weight:500;font-size:15px;margin:0 0 4px}'
    + '.jz-lead-s{font-size:12.5px;color:var(--jz-ink-70);margin:0 0 6px;line-height:1.4}'
    + '.jz-lead label.jz-l{display:block;font-size:12px;font-weight:500;margin:10px 0 4px}'
    + '.jz-lead input[type=text],.jz-lead input[type=email],.jz-lead input[type=tel]{width:100%;min-height:44px;border:1px solid #b9b3a9;border-radius:var(--jz-radius);padding:10px 11px;font:inherit;font-size:16px;color:var(--jz-ink);background:rgba(255,255,255,.8);box-sizing:border-box}'
    + '.jz-lead input:focus{outline:none;border-color:var(--jz-accent);box-shadow:0 0 0 3px rgba(37,99,255,.18)}'
    + '.jz-lead input.is-bad{border-color:#b42318}'
    + '.jz-err{display:none;color:#b42318;font-size:12px;margin-top:4px}.jz-err.is-on{display:block}'
    + '.jz-consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--jz-ink-70);margin:12px 0 4px;line-height:1.4}'
    + '.jz-consent input{width:18px;height:18px;margin:1px 0 0;flex:0 0 18px}'
    + '.jz-lead-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}'
    + '.jz-btn{font:500 13.5px/1.2 var(--sans,Satoshi,system-ui,sans-serif);padding:11px 14px;border-radius:var(--jz-radius);cursor:pointer;border:1px solid var(--jz-ink);min-height:42px}'
    + '.jz-btn.is-pri{background:var(--jz-ink);color:#fff}.jz-btn.is-pri:hover{background:var(--jz-accent);border-color:var(--jz-accent)}'
    + '.jz-btn.is-sec{background:transparent;color:var(--jz-ink)}.jz-btn.is-sec:hover{border-color:var(--jz-accent);color:var(--jz-accent)}'
    + '.jz-btn:disabled{opacity:.5;cursor:not-allowed}'
    + '.jz-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:calc(var(--jz-z) + 3);background:var(--jz-navy);color:#fff;padding:10px 16px;border-radius:999px;font:500 13px/1.3 var(--sans,Satoshi,system-ui,sans-serif);opacity:0;pointer-events:none;transition:opacity .2s;max-width:calc(100vw - 32px);text-align:center}'
    + '.jz-toast.is-on{opacity:1}';
  var style = document.createElement('style');
  style.id = 'jazzStyles';
  style.textContent = css;
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement('div');
  root.id = 'jazzRoot';
  root.innerHTML = ''
    + '<button class="jz-fab" id="jzFab" type="button" aria-haspopup="dialog" aria-controls="jzPanel" aria-expanded="false">'
    + '<span class="jz-avatar" aria-hidden="true">JZ</span>'
    + '<span class="jz-fab-txt">Pregúntale a ' + esc(NAME) + '<small>Servicios, método y casos de APTO</small></span>'
    + '</button>'
    + '<div class="jz-panel" id="jzPanel" role="dialog" aria-modal="false" aria-labelledby="jzTitle" aria-hidden="true">'
    + '<header class="jz-head"><span class="jz-avatar" aria-hidden="true">JZ</span>'
    + '<div class="jz-head-txt"><strong id="jzTitle">' + esc(NAME) + ' · APTO</strong><span>Asistente de IA · te responde al momento</span></div>'
    + '<button class="jz-close" id="jzClose" type="button" aria-label="Cerrar chat">×</button></header>'
    + '<div class="jz-msgs" id="jzMsgs" role="log" aria-live="polite" aria-relevant="additions"></div>'
    + '<div class="jz-chips" id="jzChips"></div>'
    + '<form class="jz-form" id="jzForm" autocomplete="off">'
    + '<label for="jzInput" style="position:absolute;left:-9999px">Escribe tu mensaje</label>'
    + '<textarea class="jz-input" id="jzInput" rows="1" placeholder="Escribe tu pregunta…" maxlength="1200" enterkeyhint="send"></textarea>'
    + '<button class="jz-send" id="jzSend" type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    + '</form>'
    + '<div class="jz-foot">' + esc(NAME) + ' es el asistente de IA de APTO. Lo que escribas puede guardarse para mejorar el servicio · <a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">Aviso de privacidad</a></div>'
    + '</div>'
    + '<div class="jz-toast" id="jzToast" role="status" aria-live="polite"></div>'
    + '<button type="button" id="jzFormOpener" data-open-form-modal data-track="chat" hidden tabindex="-1" aria-hidden="true">Cuéntanos tu reto</button>';
  document.body.appendChild(root);

  var fab = byId('jzFab'), panel = byId('jzPanel'), closeBtn = byId('jzClose');
  var msgs = byId('jzMsgs'), chips = byId('jzChips'), form = byId('jzForm');
  var input = byId('jzInput'), sendBtn = byId('jzSend'), toast = byId('jzToast');

  /* ── estado ── */
  var history = [];           // [{role, content}] lo que ve Jazz
  var lead = { firstname: '', lastname: '', email: '', company: '', phone: '', jobtitle: '', industry: '', company_size: '' };
  var busy = false, opened = false, greeted = false, turns = 0, openedAt = 0, openCount = 0;
  var mode = '', brain = '', modeNoticed = false, leadSent = false, watchingForm = false, botChallenge = '', leadCard = null, lastAction = '', firstFreeText = '';
  var canStream = typeof window.ReadableStream !== 'undefined' && typeof window.TextDecoder !== 'undefined' && typeof Response !== 'undefined' && ('body' in Response.prototype);
  var sid = (function () {
    var make = function () { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
    try {
      var s = sessionStorage.getItem('jazz_sid');
      if (!s) { s = make(); sessionStorage.setItem('jazz_sid', s); }
      return s;
    } catch (e) { return make(); }
  })();

  /* ── medición ── */
  // Eventos al dataLayer (contrato en el README del Worker): chat_open, chat_start, chat_message, chat_reply,
  // chat_lead_prefill, chat_error, chat_close, chat_action. Todos llevan chat_session_id, chat_turn, chat_brain,
  // chat_mode, chat_open_count y chat_widget_version. Sin PII. Con JAZZ_CHAT.debug o ?chat_debug=1 se ven en consola.
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
    el.className = 'jz-msg ' + (role === 'user' ? 'is-user' : role === 'sys' ? 'is-sys' : 'is-bot');
    el.textContent = clean(text);
    msgs.appendChild(el); scrollBottom(); return el;
  }
  var typingEl = null;
  function typing(on) {
    if (on && !typingEl) { typingEl = document.createElement('div'); typingEl.className = 'jz-typing'; typingEl.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(typingEl); scrollBottom(); }
    if (!on && typingEl) { typingEl.parentNode && typingEl.parentNode.removeChild(typingEl); typingEl = null; }
  }
  var toastT = null;
  function showToast(t) { toast.textContent = t; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('is-on'); }, 3400); }
  function setBusy(b) { busy = b; sendBtn.disabled = b; input.disabled = b; }

  // Chips: el servidor sugiere hasta 3; el widget asegura una salida a persona y a "ver en la página".
  var SECTION_FOR = { servicios: '#productos', metodo: '#metodo', casos: '#casos' };
  function topicOf(text) {
    var t = String(text || '').toLowerCase();
    if (/servicio|hacen|ofrecen|capacidad/.test(t)) return 'servicios';
    if (/m[eé]todo|metodolog|trabajan|proceso|etapa/.test(t)) return 'metodo';
    if (/caso|cliente|proyecto|ejemplo|éxito|exito/.test(t)) return 'casos';
    return '';
  }
  function setChips(list, topic) {
    chips.innerHTML = '';
    var items = (list || []).slice(0, 3);
    if (topic && SECTION_FOR[topic]) items.push('Ver en la página ↗');
    var hasHuman = items.some(function (t) { return /hablar con alguien|dejar mis datos/i.test(t); });
    if (!hasHuman && !leadSent) items.push('Hablar con alguien');
    items.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'jz-chip'; b.textContent = t;
      if (/dejar mis datos/i.test(t)) b.className += ' is-pri';
      b.setAttribute('data-topic', topic || '');
      b.addEventListener('click', function () { onChip(t, topic); });
      chips.appendChild(b);
    });
  }
  function onChip(text, topic) {
    if (/hablar con alguien/i.test(text)) { openLandingForm('chip'); return; }
    if (/dejar mis datos/i.test(text)) { showLeadCard('chip'); return; }
    if (/ver en la página/i.test(text)) { goToSection(topic); return; }
    if (/seguir preguntando/i.test(text)) { setChips(['¿Qué servicios ofrecen?', '¿Cómo trabajan?', 'Ver casos de éxito']); input.focus({ preventScroll: true }); return; }
    var t = topicOf(text);
    if (t) { lastAction = t; track('chat_action', { chat_action: t, chat_label: text }); }
    send(text, true);
  }
  function goToSection(topic) {
    var sel = SECTION_FOR[topic]; var el = sel && document.querySelector(sel);
    lastAction = 'section';
    track('chat_action', { chat_action: 'section', chat_target: sel || '' });
    if (!el) return;
    if (MOBILE()) close();
    try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
  }

  /* ── abrir / cerrar ── */
  function open() {
    opened = true; panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false'); fab.setAttribute('aria-expanded', 'true');
    document.body.classList.add('jz-open');
    if (!greeted) {
      var hi = 'Hola, soy ' + NAME + ', el asistente de APTO. Puedo contarte qué hacemos, cómo trabajamos y qué proyectos hemos hecho, o ayudarte a que alguien del equipo te escriba. ¿Qué quieres resolver?';
      addMsg('bot', hi); history.push({ role: 'assistant', content: hi }); greeted = true;
      setChips(['¿Qué servicios ofrecen?', '¿Cómo trabajan?', 'Ver casos de éxito']);
    }
    openCount++; openedAt = Date.now();
    track('chat_open', {});
    setTimeout(function () { if (!MOBILE()) input.focus({ preventScroll: true }); }, 250);
  }
  function close() {
    if (!opened) return;
    track('chat_close', { chat_duration_s: openedAt ? Math.round((Date.now() - openedAt) / 1000) : 0 });
    opened = false; panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); fab.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('jz-open'); fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && opened) close(); });

  /* ── enviar y recibir en streaming ── */
  function send(text, fromChip) {
    text = String(text || '').trim(); if (!text || busy) return;
    if (!fromChip && !firstFreeText) firstFreeText = text; // lo que la persona escribió con sus palabras: va al formulario
    addMsg('user', text); history.push({ role: 'user', content: text });
    input.value = ''; input.style.height = ''; setChips([]); setBusy(true); typing(true);
    turns++;
    var t0 = Date.now();
    if (turns === 1) track('chat_start', {});
    track('chat_message', { chat_message_len: text.length, chat_from: fromChip ? 'chip' : 'typed' });
    var topic = topicOf(text);
    var attrAll = attribution(); var attrOne = attrAll ? (attrAll.last || attrAll.first) : null;
    var body = { session_id: sid, messages: history.slice(-MAX_HISTORY), stream: canStream, lead_sent: leadSent, attr: attrOne || undefined, page: { pageUri: location.href.slice(0, 2000), pageName: document.title.slice(0, 200) } };
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
            return r.json().then(function (j) { if (j.brain) brain = j.brain; if (j.topic) topic = j.topic; finish(clean(j.reply || ''), j.suggestions || [], j.mode); if (j.lead && typeof j.lead === 'object' && !leadSent) openPrefilledForm(j.lead); });
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
        if (obj.done) { done = true; if (obj.topic) topic = obj.topic; finish(clean(full), obj.suggestions || [], mode, el); if (obj.lead && typeof obj.lead === 'object' && !leadSent) openPrefilledForm(obj.lead); }
      }
      function pump() {
        return reader.read().then(function (c) {
          if (c.done) { if (!done) { if (full) finish(clean(full), [], mode, el); else throw new Error(lastErr = 'stream_ended_early'); } return; }
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
    function finish(reply, suggestions, m, el) {
      typing(false);
      if (!reply) reply = 'Se me fue la señal un segundo. ¿Me lo repites?';
      if (el) el.textContent = reply; else addMsg('bot', reply);
      rendered = true;
      history.push({ role: 'assistant', content: reply });
      if (m) setMode(m);
      track('chat_reply', { chat_reply_len: reply.length, chat_latency_ms: Date.now() - t0 });
      setChips(suggestions, topic);
    }
    request()
      .catch(function () {
        typing(false);
        track('chat_error', { chat_error: lastErr || 'unknown', chat_online: navigator.onLine ? 'true' : 'false' });
        var el = document.createElement('div'); el.className = 'jz-msg is-bot';
        if (/http_429/.test(lastErr)) el.textContent = 'Vas muy rápido. Espera un momento e intenta de nuevo.';
        else el.innerHTML = 'No pude conectar ahora mismo. Intenta de nuevo o escríbenos a <a href="mailto:info@apto.mx">info@apto.mx</a>.';
        msgs.appendChild(el); scrollBottom();
        setChips(['Intentar de nuevo'].concat(leadSent ? [] : ['Hablar con alguien']));
        var retry = chips.querySelector('.jz-chip');
        if (retry) retry.addEventListener('click', function () { history.pop(); send(text); }, { once: true });
      })
      .then(function () { setBusy(false); if (opened && !MOBILE()) input.focus({ preventScroll: true }); });
  }
  function setMode(m) {
    if (!m || mode === m) return;
    mode = m;
    if (m === 'mock' && !modeNoticed) { modeNoticed = true; addMsg('sys', 'Modo de prueba: las respuestas son simuladas. Jazz todavía no está conectado.'); }
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', function () { input.style.height = ''; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  /* ── "Hablar con alguien": abre el formulario de la landing prellenado ── */
  // Primer mensaje escrito por la persona (no los chips): es lo que se lleva al formulario y al CRM.
  function firstUserMessage() { return firstFreeText; }
  function readLeadFromCard() {
    if (!leadCard) return;
    var g = function (n) { var el = leadCard.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    lead.firstname = g('firstname') || lead.firstname; lead.email = g('email') || lead.email; lead.company = g('company') || lead.company; lead.phone = g('phone') || lead.phone;
  }
  function setSelect(id, v) {
    var el = byId(id); if (!el || !v || el.value) return;
    var n = function (x) { return String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+]/g, ''); };
    var want = n(v), i;
    for (i = 0; i < el.options.length; i++) {
      var o = el.options[i];
      if (o.value && (n(o.value) === want || n(o.textContent) === want || n(o.textContent).indexOf(want) === 0 || (want.length >= 5 && n(o.textContent).indexOf(want) >= 0))) { el.value = o.value; try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} return; }
    }
  }
  function setField(id, v) {
    var el = byId(id); if (!el || !v) return;
    if (el.tagName === 'SELECT') { setSelect(id, v); return; }
    if (!el.value) { el.value = v; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
  }
  function prefillForm() {
    readLeadFromCard();
    var set = function (id, v) { var el = byId(id); if (el && !el.value && v) { el.value = v; try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} } };
    var parts = lead.firstname.split(/\s+/).filter(Boolean);
    if (parts.length) { set('f-firstname', parts[0]); if (parts.length > 1 && !lead.lastname) set('f-lastname', parts.slice(1).join(' ')); }
    if (lead.lastname) set('f-lastname', lead.lastname);
    set('f-email', lead.email.toLowerCase());
    set('f-company', lead.company);
    setField('f-jobtitle', lead.jobtitle); // hoy es texto libre; si algún día es un select, se elige la opción más cercana
    setSelect('f-industry', lead.industry);
    setSelect('f-company_size', lead.company_size);
    var digits = lead.phone.replace(/\D/g, ''); if (digits.length >= 12 && digits.indexOf('52') === 0) digits = digits.slice(2);
    if (digits.length === 10) set('f-phone_number', digits);
    var m = botChallenge || firstUserMessage(); if (m && m.length >= 10) set('f-message', m.slice(0, 500));
  }
  function openLandingForm(from) {
    lastAction = 'humano';
    track('chat_action', { chat_action: 'humano', chat_from: from || '' });
    // Cualquier formulario abierto desde el chat es canal 'chat': capture.js lo lee para lead_channel y chat_session_id.
    window.APTO_CHAT_LEAD = { channel: 'chat', session_id: sid, opened_at: Date.now() };
    watchFormSent();
    close();
    var opener = byId('jzFormOpener');
    var hasHandler = !!document.getElementById('form-modal');
    if (opener && hasHandler) opener.click(); else location.hash = '#cta-form';
    setTimeout(prefillForm, 380);
    showToast('Abrimos el formulario con lo que ya nos contaste');
  }
  // El cerebro captó nombre, correo y empresa en la conversación (marcador [[lead: …]] que el Worker convierte en
  // lead:{…}): se guarda y se abre el formulario de la landing prellenado. El prospecto entra por el formulario, nunca
  // lo registra el chat (decisión de Chucho, 26-oct).
  function openPrefilledForm(d) {
    if (d.firstname) lead.firstname = String(d.firstname);
    if (d.lastname) lead.lastname = String(d.lastname);
    if (d.email) lead.email = String(d.email);
    if (d.company) lead.company = String(d.company);
    if (d.phone) lead.phone = String(d.phone);
    if (d.jobtitle) lead.jobtitle = String(d.jobtitle);
    if (d.industry) lead.industry = String(d.industry);
    if (d.company_size) lead.company_size = String(d.company_size);
    if (d.message) botChallenge = String(d.message).slice(0, 500);
    var fields = []; var fk; for (fk in d) if (Object.prototype.hasOwnProperty.call(d, fk) && d[fk]) fields.push(fk);
    track('chat_lead_prefill', { chat_prefilled_fields: fields.join(',') });
    setTimeout(function () { openLandingForm('bot'); }, 900);
  }
  // Detecta el envío real del formulario (capture.js manda form_submit_success al dataLayer) para avisarle al Worker
  // con lead_sent y que el cerebro no vuelva a pedir datos. Se instala solo cuando hace falta, con GTM ya cargado.
  function watchFormSent() {
    if (watchingForm) return;
    watchingForm = true;
    try {
      var dl = window.dataLayer = window.dataLayer || [];
      var orig = dl.push;
      dl.push = function () {
        try {
          for (var i = 0; i < arguments.length; i++) {
            var a = arguments[i];
            if (a && typeof a === 'object' && /^form_submit_success/.test(String(a.event || ''))) {
              if (!a.lead_channel) { a.lead_channel = 'chat'; a.chat_session_id = sid; } // capture.js anterior al 26-oct
              onFormSent(a);
            }
          }
        } catch (e) {}
        return orig.apply(dl, arguments);
      };
    } catch (e) {}
  }
  function onFormSent(a) {
    if (leadSent) return;
    leadSent = true;
    lastAction = 'form_sent';
    try {
      fetch(API + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ session_id: sid, type: 'lead_submitted', contact_id: (a && a.contact_id) ? String(a.contact_id) : '', deal_id: (a && a.deal_id) ? String(a.deal_id) : '' }) }).catch(function () {});
    } catch (e) {}
    track('chat_action', { chat_action: 'form_sent' });
    var reply = 'Gracias, ya recibimos tu formulario. Alguien de APTO te escribe. Mientras tanto, ¿te cuento algo más de cómo trabajamos?';
    addMsg('bot', reply); history.push({ role: 'assistant', content: reply });
    setChips(['¿Cómo trabajan?', 'Ver casos de éxito']);
  }

  /* ── tarjeta de datos dentro del chat → POST /lead ── */
  function field(label, name, type, ac, ph) {
    return '<label class="jz-l" for="jz-' + name + '">' + label + '</label><input type="' + type + '" id="jz-' + name + '" name="' + name + '" autocomplete="' + ac + '" placeholder="' + esc(ph || '') + '"><div class="jz-err" data-for="' + name + '"></div>';
  }
  function showLeadCard(from) {
    lastAction = 'lead_card';
    track('chat_action', { chat_action: 'lead_card', chat_from: from || '' });
    if (leadCard) { leadCard.scrollIntoView({ block: 'nearest' }); var f = leadCard.querySelector('input'); if (f) f.focus({ preventScroll: true }); return; }
    setChips([]);
    var el = document.createElement('div'); el.className = 'jz-lead';
    el.innerHTML = '<p class="jz-lead-t">Déjanos tus datos</p><p class="jz-lead-s">Alguien de APTO te escribe para platicar de tu reto.</p>'
      + field('Nombre', 'firstname', 'text', 'name', 'Tu nombre')
      + field('Correo de empresa', 'email', 'email', 'email', 'tu@empresa.com')
      + field('Empresa', 'company', 'text', 'organization', 'Nombre de la empresa')
      + field('Teléfono (opcional)', 'phone', 'tel', 'tel', '10 dígitos')
      + '<label class="jz-consent"><input type="checkbox" name="privacy_consent" id="jz-consent"><span>He leído y acepto el <a href="' + PRIVACY_URL + '" target="_blank" rel="noopener">aviso de privacidad</a>.</span></label>'
      + '<div class="jz-err" data-for="privacy_consent"></div>'
      + '<div class="jz-lead-btns"><button type="button" class="jz-btn is-pri" data-act="send">Enviar</button><button type="button" class="jz-btn is-sec" data-act="form">Prefiero el formulario completo</button></div>';
    msgs.appendChild(el); scrollBottom(); leadCard = el;
    if (lead.firstname) el.querySelector('[name=firstname]').value = lead.firstname;
    el.querySelector('[data-act=form]').addEventListener('click', function () { openLandingForm('lead_card'); });
    el.querySelector('[data-act=send]').addEventListener('click', function () { submitLead(el, this); });
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.keyCode === 13) && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); submitLead(el, el.querySelector('[data-act=send]')); } });
    setTimeout(function () { el.querySelector('[name=firstname]').focus({ preventScroll: true }); }, 120);
  }
  function validateCard(el) {
    var g = function (n) { return el.querySelector('[name="' + n + '"]'); };
    var errs = {};
    var v = function (n) { return (g(n).value || '').trim(); };
    if (v('firstname').length < 2) errs.firstname = 'Escribe tu nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) errs.email = 'Revisa el correo.';
    if (v('company').length < 2) errs.company = 'Escribe el nombre de tu empresa.';
    var d = v('phone').replace(/\D/g, '');
    if (d && !/^\d{8,15}$/.test(d)) errs.phone = 'Revisa el teléfono (10 dígitos).';
    if (!g('privacy_consent').checked) errs.privacy_consent = 'Necesitamos tu aceptación del aviso de privacidad.';
    ['firstname', 'email', 'company', 'phone', 'privacy_consent'].forEach(function (n) {
      var e = el.querySelector('.jz-err[data-for="' + n + '"]'); var inp = g(n);
      if (errs[n]) { e.textContent = errs[n]; e.classList.add('is-on'); if (inp.type !== 'checkbox') inp.classList.add('is-bad'); }
      else { e.textContent = ''; e.classList.remove('is-on'); inp.classList.remove('is-bad'); }
    });
    var first = Object.keys(errs)[0];
    if (first) { g(first).focus({ preventScroll: true }); return null; }
    var digits = d; if (digits.length === 10) digits = '52' + digits;
    return { firstname: v('firstname'), email: v('email').toLowerCase(), company: v('company'), phone: digits ? '+' + digits : '' };
  }
  function cookie(re) { var m = document.cookie.match(re); return m ? decodeURIComponent(m[1]) : ''; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function attribution() { var f = lsGet('apto_attr_first'), l = lsGet('apto_attr_last'); return (f || l) ? { first: f || undefined, last: l || undefined } : null; }
  function scrollPct() {
    var doc = document.documentElement; var total = Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight;
    return total <= 0 ? 100 : Math.min(100, Math.round(((window.scrollY || doc.scrollTop || 0) / total) * 100));
  }
  function submitLead(el, btn) {
    var data = validateCard(el); if (!data) return;
    btn.disabled = true; btn.textContent = 'Enviando…';
    lead.firstname = data.firstname; lead.email = data.email; lead.company = data.company; lead.phone = data.phone;
    var attr = attribution();
    var eventId = 'apto-lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    var context = {
      pageUri: location.href, pageName: document.title,
      hutk: cookie(/hubspotutk=([^;]+)/), client_id: cookie(/_ga=GA\d+\.\d+\.([^;]+)/), fbp: cookie(/_fbp=([^;]+)/), fbc: cookie(/_fbc=([^;]+)/),
      event_id: eventId,
      meta: {
        time_on_page_s: Math.round((window.performance && performance.now ? performance.now() : 0) / 1000),
        scroll_depth_pct: scrollPct(),
        clarity_user_id: cookie(/(?:^|; )_clck=([^;|]+)/), clarity_session_id: cookie(/(?:^|; )_clsk=([^;|]+)/),
        chat_session_id: sid, chat_turns: turns
      }
    };
    if (attr) context.attribution = attr;
    var payload = { firstname: data.firstname, lastname: '', email: data.email, phone: data.phone, company: data.company, jobtitle: '', industry: '', company_size: '', message: firstUserMessage().slice(0, 480), privacy_consent: true, context: context };
    lastAction = 'lead_sent';
    fetch(API + '/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; }); })
      .then(function (j) {
        if (!j.ok) { throw new Error(j.error || ('http_' + j.__status)); }
        leadSent = true;
        var a = (attr && (attr.last || attr.first)) || {};
        track('form_submit_success', {
          lead_channel: 'chat', chat_session_id: sid, lead_source: 'chat_card',
          event_id: eventId,
          em_raw: payload.email, ph_raw: payload.phone || '', fn_raw: payload.firstname, ln_raw: '',
          company: payload.company, jobtitle: '', industry: '', company_size: '', country: 'MX',
          message_length: payload.message.length, has_problem_desc: !!payload.message,
          privacy_consent: true, privacy_consent_ts: new Date().toISOString(),
          campaign_id: a.campaign_id || '', ad_group_id: a.adgroup_id || '', keyword: a.keyword || '', match_type: a.match_type || '', creative_id: a.creative_id || '', ad_network: a.network || '',
          attribution_touch: attr ? 'stored' : 'none',
          form_origin_cta: 'chat', time_on_page_s: context.meta.time_on_page_s, scroll_depth_pct: context.meta.scroll_depth_pct, form_error_count: 0,
          gclid: '', fbclid: '', fbp: context.fbp || '', fbc: context.fbc || '', ga_client_id: context.client_id || '', hutk: context.hutk || '',
          contact_id: j.contactId || '', deal_id: j.dealId || '', lead_id: j.leadId || '',
          lead_mock: j.mock ? 'true' : 'false',
          value: 500, currency: 'MXN', page_url: location.href, page_referrer: document.referrer
        });
        track('chat_action', { chat_action: 'lead_sent' });
        var btns = el.querySelector('.jz-lead-btns'); if (btns) btns.parentNode.removeChild(btns);
        el.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
        var ok = document.createElement('p'); ok.className = 'jz-lead-s'; ok.style.marginTop = '10px';
        ok.textContent = 'Listo, ' + data.firstname.split(' ')[0] + '. Alguien de APTO te escribe a ' + data.email + '.' + (j.mock ? ' (Prueba: no se creó ningún registro.)' : '');
        el.appendChild(ok);
        var reply = 'Gracias, ' + data.firstname.split(' ')[0] + '. Ya tiene tus datos el equipo. Mientras tanto, ¿quieres que te cuente algo más de cómo trabajamos?';
        addMsg('bot', reply); history.push({ role: 'assistant', content: reply });
        setChips(['¿Cómo trabajan?', 'Ver casos de éxito']);
      })
      .catch(function (e) {
        var code = String(e && e.message || e).slice(0, 60);
        track('chat_error', { chat_error: 'lead_' + code, chat_online: navigator.onLine ? 'true' : 'false' });
        btn.disabled = false; btn.textContent = 'Enviar';
        var err = el.querySelector('.jz-err[data-for="privacy_consent"]');
        err.textContent = /rate_limited|429/.test(code) ? 'Espera un momento e intenta de nuevo.' : 'No pudimos enviar tus datos. Intenta de nuevo o usa el formulario completo.';
        err.classList.add('is-on');
      });
  }
})();
