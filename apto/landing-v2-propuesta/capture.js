/* APTO landing · capa de captura y medicion (Marketon) · portada de v1 sin cambiar nombres de evento, ids ni payload.
   Eventos: data-track por clic · form_start · form_field_error · form_submit_success · form_submit_fail · form_submit_success_fallback
   · form_modal_open/close · nav_mobile_menu_open · section_view · video_play. Contrato con el Worker apto-landing-api sin cambios. */



    (function() {
      'use strict';

      // Marketon Worker orchestrator · single endpoint que crea Contact + Deal
      // en pipeline Marketon + Meta CAPI + GA4 + email notify · docs:
      // Landing/HubSpot-Backend-Credentials-v1.md
      const MARKETON_ENDPOINT = 'https://apto-landing-api.marketon-saap.workers.dev/submit';
      // Fallback directo a HubSpot Forms API si Worker down (degradación grácil)
      const HUBSPOT_PORTAL_ID = '2583031';
      const HUBSPOT_FORM_ID = '696bbd9e-ca44-410c-a474-af764b0e643a';
      const HUBSPOT_FALLBACK_ENDPOINT = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`;

      const FREE_EMAIL_DOMAINS = ['gmail.com','hotmail.com','yahoo.com','outlook.com','live.com','icloud.com','proton.me','protonmail.com','me.com','yahoo.com.mx','hotmail.com.mx'];

      const form = document.getElementById('diagnostico-form');
      const successView = document.getElementById('form-success');
      const messageBox = document.getElementById('form-message');
      const submitBtn = document.getElementById('form-submit');
      const submitLabel = document.getElementById('submit-label');

      function getHutk() {
        const match = document.cookie.match(/hubspotutk=([^;]+)/);
        return match ? match[1] : '';
      }

      function track(event, params) {
        params = params || {};
        params.event = event;
        (window.dataLayer = window.dataLayer || []).push(params);
      }

      document.querySelectorAll('[data-track]').forEach(el => {
        el.addEventListener('click', () => {
          var params = { label: el.textContent.trim().slice(0,50) };
          if (el.dataset.navLink) params.nav_link = el.dataset.navLink;
          if (el.dataset.producto) params.producto = el.dataset.producto;
          if (el.dataset.item) params.item = el.dataset.item;
          if (el.dataset.social) params.social = el.dataset.social;
          if (el.dataset.target) params.target = el.dataset.target;
          if (el.dataset.section) params.section = el.dataset.section;
          track(el.dataset.track, params);
        });
      });

      // Reveal on scroll · Intersection Observer sobre elementos .js-reveal
      // Threshold 0.15 · rootMargin 0px 0px -60px 0px para trigger antes del bottom
      (function initReveal(){
        if (!('IntersectionObserver' in window)) {
          document.querySelectorAll('.js-reveal').forEach(function(el){ el.classList.add('is-visible'); });
          return;
        }
        var observer = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
        document.querySelectorAll('.js-reveal').forEach(function(el){ observer.observe(el); });
      })();

      // Section view tracking · dispara section_view en GA4 al llegar a cada sección
      (function initSectionViewTracking(){
        if (!('IntersectionObserver' in window)) return;
        var sections = document.querySelectorAll('section[id]');
        var seen = new Set();
        var observer = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            var id = entry.target.id;
            if (entry.isIntersecting && !seen.has(id)) {
              seen.add(id);
              track('section_view', { section_id: id });
            }
          });
        }, { threshold: 0.35 });
        sections.forEach(function(s){ observer.observe(s); });
      })();

      // Sticky CTA · un solo CTA primario por viewport. Mientras el CTA del hero
      // está a la vista, el sticky se repliega (competían 4 "agenda" en la 1ª pantalla).
      // Sin IntersectionObserver el sticky queda visible = comportamiento previo.
      (function initStickyCtaVisibility(){
        if (!('IntersectionObserver' in window)) return;
        var sticky = document.querySelector('.sticky-cta-mobile');
        var heroCta = document.querySelector('.hero-actions');
        if (!sticky || !heroCta) return;
        sticky.classList.add('is-hidden');
        var observer = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            sticky.classList.toggle('is-hidden', entry.isIntersecting);
          });
        }, { threshold: 0 });
        observer.observe(heroCta);
      })();

      var INITIAL_HASH = window.location.hash; // se lee antes de que el fix de anclas lo borre
      // Anchor scroll fix · IG WebView + Chrome mobile in-app browsers a veces ignoran
      // href="#..." nativo (users tapean el CTA repetidamente sin respuesta). Clarity
      // 2026-08-10 registró 33 taps en "Agenda tu sesión →" desde IG en 1m38s con dead click.
      // Fix: interceptar clicks en anchors internos, hacer scrollIntoView programático,
      // compensar altura del nav sticky, y actualizar hash sin recargar.
      (function initAnchorScrollFix(){
        var NAV_OFFSET = 96; // cabecera fija de Norma + aire
        function scrollToId(id){
          if (!id) return false;
          var target = document.getElementById(id);
          if (!target) return false;
          var rect = target.getBoundingClientRect();
          var y = rect.top + window.scrollY - NAV_OFFSET;
          try {
            window.scrollTo({ top: y, behavior: 'smooth' });
          } catch(e){
            window.scrollTo(0, y);
          }
          // actualiza URL sin trigger de scroll nativo
          if (history.replaceState) history.replaceState(null, '', '#' + id);
          // focus para keyboard/AT users si target es form input
          if (target.tagName === 'FORM' || target.querySelector('input, textarea, select')) {
            var firstInput = target.querySelector('input:not([type=hidden]), textarea, select');
            if (firstInput) setTimeout(function(){ firstInput.focus({ preventScroll: true }); }, 500);
          }
          return true;
        }
        document.addEventListener('click', function(e){
          var link = e.target.closest('a[href^="#"]');
          if (!link) return;
          var href = link.getAttribute('href') || '';
          if (href === '#' || href.length < 2) return;
          var id = href.slice(1);
          if (scrollToId(id)) {
            e.preventDefault();
            // track click event si tiene data-track (mantiene compatibilidad con GTM)
            if (link.dataset.track && typeof window.dataLayer !== 'undefined') {
              window.dataLayer.push({ event: link.dataset.track, anchor: id });
            }
          }
        });
        // Force top on load · IG WebView + otros in-app browsers a veces auto-scrollean
        // al hash o restauran posición. Users deben aterrizar en el hero, no en el form.
        // Kill de cualquier scroll auto: strip hash + force scrollTo(0,0) antes y después
        // del load event. Si Meta ad manda hash en URL, lo removemos.
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        if (window.location.hash && window.location.hash.length > 1) {
          try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e){}
        }
        window.scrollTo(0, 0);
        window.addEventListener('DOMContentLoaded', function(){ window.scrollTo(0, 0); });
        // Sitelinks de Ads llegan con ?sl=<seccion>#<seccion>: aterrizar en esa seccion, no en el hero
        var SL_TARGET = (INITIAL_HASH && INITIAL_HASH !== '#cta-form' && document.getElementById(INITIAL_HASH.slice(1))) ? INITIAL_HASH.slice(1) : '';
        window.addEventListener('load', function(){
          if (SL_TARGET) { setTimeout(function(){ scrollToId(SL_TARGET); }, 150); return; }
          window.scrollTo(0, 0);
          // Re-force top después de que fonts + imágenes late-load pueden shift layout
          setTimeout(function(){ if (window.scrollY < 200) window.scrollTo(0, 0); }, 400);
        });
      })();

      // Form modal · WCAG-compliant · abre en click a href="#cta-form" o [data-open-form-modal]
      // Mobile bottom-sheet · desktop centered dialog · focus trap · escape close · body scroll lock
      var formModalLastFocused = null;
      function openFormModal(source){
        var modal = document.getElementById('form-modal');
        if (!modal) return;
        formModalLastFocused = document.activeElement;
        var card = document.getElementById('form-card'), mh = document.getElementById('form-modal-host');
        if (card && mh && card.parentNode !== mh) mh.appendChild(card);
        modal.hidden = false;
        document.body.classList.add('form-modal-open');
        setTimeout(function(){
          var firstInput = modal.querySelector('input:not([type=hidden]):not([disabled]), textarea, select');
          if (firstInput) firstInput.focus({ preventScroll: true });
        }, 320);
        track('form_modal_open', { source: source || 'unknown' });
      }
      function closeFormModal(){
        var modal = document.getElementById('form-modal');
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('form-modal-open');
        var card = document.getElementById('form-card'), ih = document.getElementById('form-inline-host');
        if (card && ih && card.parentNode !== ih) ih.appendChild(card);
        if (formModalLastFocused && formModalLastFocused.focus) {
          formModalLastFocused.focus({ preventScroll: true });
        }
        // El blur del cierre ya corrió: si nadie escribió nada, no dejar campos en rojo en la versión inline
        var f = document.getElementById('diagnostico-form');
        if (f && ![].some.call(f.querySelectorAll('input:not([type=checkbox]),textarea'), function(i){ return i.value.trim() !== ''; })) {
          [].forEach.call(f.querySelectorAll('.form-field.has-error'), function(w){
            w.classList.remove('has-error'); var e=w.querySelector('.form-field__error'); if (e) e.textContent=''; var i=w.querySelector('input,select,textarea'); if (i) i.setAttribute('aria-invalid','false');
          });
        }
        track('form_modal_close', {});
      }
      // Delegated click handler · captura anchors #cta-form + botones data-open-form-modal
      // useCapture=true para correr ANTES que el anchor scroll fix (que también está en document)
      document.addEventListener('click', function(e){
        var opener = e.target.closest('[data-open-form-modal], a[href="#cta-form"]');
        if (opener) {
          e.preventDefault();
          e.stopImmediatePropagation();
          var source = opener.getAttribute('data-track') || opener.className || 'anchor';
          // Este handler corre en fase de CAPTURA y corta la propagacion, asi que el
          // listener por elemento de [data-track] nunca alcanza a ejecutarse. Sin esto,
          // las 16 microconversiones de CTAs que abren el form nunca llegan al dataLayer
          // y GTM trigger 93 (GA4 tag 94 + Meta Pixel tag 95) se queda sin senal.
          if (opener.dataset.track) {
            track(opener.dataset.track, {
              label: (opener.textContent || '').trim().slice(0, 50),
              opens_form: true
            });
          }
          openFormModal(source);
          return;
        }
        var closer = e.target.closest('[data-close-form-modal]');
        if (closer) {
          e.preventDefault();
          closeFormModal();
        }
      }, true);
      // Escape key close
      document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') {
          var modal = document.getElementById('form-modal');
          if (modal && !modal.hidden) closeFormModal();
        }
      });
      // Deep-link · URL con #cta-form al load abre el modal
      if (INITIAL_HASH === '#cta-form') {
        setTimeout(function(){ openFormModal('deep_link'); }, 400);
      }

      // Mobile menu bottom-sheet · WCAG-compliant modal · escape key + backdrop click + a href close
      (function initMobileMenu(){
        var toggle = document.querySelector('.nav-pill__menu-toggle');
        var menu = document.getElementById('mobile-menu');
        if (!toggle || !menu) return;
        var lastFocused = null;
        function open(){
          lastFocused = document.activeElement;
          menu.hidden = false;
          toggle.setAttribute('aria-expanded', 'true');
          document.body.style.overflow = 'hidden';
          setTimeout(function(){
            var firstLink = menu.querySelector('a');
            if (firstLink) firstLink.focus({ preventScroll: true });
          }, 100);
          track('nav_mobile_menu_open', {});
        }
        function close(){
          menu.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
          if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
        }
        toggle.addEventListener('click', function(){
          if (menu.hidden) open(); else close();
        });
        menu.addEventListener('click', function(e){
          if (e.target.matches('[data-mobile-menu-close], [data-mobile-menu-close] *') || e.target === menu.querySelector('.mobile-menu__backdrop')) {
            close();
          }
        });
        document.addEventListener('keydown', function(e){
          if (e.key === 'Escape' && !menu.hidden) close();
        });
      })();

      // Menu movil de Norma: el toggle lo maneja script.js; aqui solo medimos la apertura
      (function(){ var t=document.querySelector('.menu-toggle'), m=document.getElementById('mobile-nav'); if(!t||!m) return; t.addEventListener('click', function(){ if(m.hidden===false) track('nav_mobile_menu_open', {}); }); })();
      // Nav pill opacity ramp on scroll (v1 · no aplica en Norma, sale sin hacer nada) · sutil signal de presencia sin invadir
      (function initNavPillScrollRamp(){
        var shell = document.querySelector('.nav-shell');
        if (!shell) return;
        var pill = shell.querySelector('.nav-pill');
        if (!pill) return;
        var ticking = false;
        function onScroll(){
          if (ticking) return;
          ticking = true;
          window.requestAnimationFrame(function(){
            var y = window.scrollY || 0;
            // Ramp opacity de background: 0.72 top → 0.92 después de 120px scroll
            var t = Math.min(y / 120, 1);
            var alpha = 0.72 + (0.92 - 0.72) * t;
            pill.style.background = 'rgba(3, 27, 63, ' + alpha.toFixed(3) + ')';
            ticking = false;
          });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
      })();

      // YouTube lazy facade · reemplaza thumbnail por iframe al click, cero cost hasta interacción
      document.querySelectorAll('.yt-facade').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.ytId;
          if (!id) return;
          track('video_play', { video_id: id, video_provider: 'youtube', location: btn.id || 'facade' });
          const iframe = document.createElement('iframe');
          // enablejsapi=1 permite que GTM trigger YouTube Video escuche eventos (start · progress 25/50/75 · complete)
          iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
          iframe.title = btn.getAttribute('aria-label') || 'YouTube video';
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          iframe.allowFullscreen = true;
          btn.innerHTML = '';
          btn.appendChild(iframe);
          btn.style.cursor = 'default';
        }, { once: true });
      });

      // Dígitos del número nacional por lada · fuente: planes de numeración de cada país
      const PHONE_LEN = { '52': [10], '1': [10], '34': [9], '57': [10], '54': [10], '56': [9], '51': [9], '55': [10, 11], '593': [9], '598': [8, 9] };
      function validateField(input) {
        const err = document.getElementById('err-' + input.name);
        const wrap = input.closest('.form-field');
        let msg = '';

        if (input.type === 'checkbox') {
          if (input.required && !input.checked) {
            msg = 'Debes aceptar el aviso de privacidad para continuar.';
          }
        } else if (input.required && !input.value.trim()) {
          msg = 'Este campo es requerido.';
        } else if (input.value.trim() && input.minLength > 0 && input.value.trim().length < input.minLength) {
          msg = `Mínimo ${input.minLength} caracteres.`;
        } else if (input.type === 'email' && input.value) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
            msg = 'Formato inválido. Ejemplo: nombre@empresa.com';
          }
        } else if (input.name === 'phone_number' && input.value.trim()) {
          // Longitud del número nacional según la lada elegida (México: exactamente 10 dígitos)
          const cc = (document.getElementById('f-phone_country_code').value || '').trim();
          let d = input.value.replace(/\D/g, '');
          if (cc && d.startsWith(cc) && d.length > (PHONE_LEN[cc] ? Math.max.apply(null, PHONE_LEN[cc]) : 10)) d = d.slice(cc.length);
          const allowed = PHONE_LEN[cc] || [8, 9, 10, 11, 12];
          if (allowed.indexOf(d.length) === -1) {
            msg = allowed.length === 1
              ? `Escribe los ${allowed[0]} dígitos de tu número, sin lada.`
              : `Escribe entre ${allowed[0]} y ${allowed[allowed.length - 1]} dígitos, sin lada.`;
          }
        }
        err.textContent = msg;
        wrap.classList.toggle('has-error', !!msg);
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        return !msg;
      }

      // Respect prefers-reduced-motion: no autoplay video hero
      const video = document.getElementById('hero-video');
      if (video) {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: no-preference)');
        if (mediaQuery.matches) {
          video.play().catch(() => {}); // ignore autoplay blocked
        }
      }

      const emailInput = document.getElementById('f-email');
      emailInput.addEventListener('blur', () => {
        const val = emailInput.value.trim().toLowerCase();
        const domain = val.split('@')[1];
        if (domain && FREE_EMAIL_DOMAINS.includes(domain)) {
          showMessage('warn', 'Sugerimos usar tu correo corporativo para agilizar la sesión. Aun así puedes continuar con este.');
        } else {
          hideMessage();
        }
      });

      // Tras el envío el formulario se oculta y la sección se acorta: la confirmación puede quedar
      // fuera del viewport (sobre todo en la versión inline). Scroll determinista, sin animación,
      // repetido para ganarle a cualquier scroll suave en vuelo; luego el foco para lectores de pantalla.
      function revealSuccess(view) {
        function place() {
          if (document.body.classList.contains('form-modal-open')) return; // en el modal el panel hace su propio scroll
          var y = view.getBoundingClientRect().top + window.scrollY - 120;
          var prevBehavior = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo(0, Math.max(0, y));
          document.documentElement.style.scrollBehavior = prevBehavior;
        }
        place(); setTimeout(place, 80); setTimeout(place, 450);
        try { view.focus({ preventScroll: true }); } catch (e) { view.focus(); }
      }
      function showMessage(type, text) {
        messageBox.className = 'form-message form-message--' + type;
        messageBox.textContent = text;
        messageBox.hidden = false;
      }
      function hideMessage() { messageBox.hidden = true; }

      form.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('change', () => validateField(input));
        if (input.name === 'phone_number') {
          input.addEventListener('input', () => {
            const cc = (document.getElementById('f-phone_country_code').value || '').trim();
            const max = PHONE_LEN[cc] ? Math.max.apply(null, PHONE_LEN[cc]) : 12;
            let d = input.value.replace(/\D/g, '');
            if (cc && d.startsWith(cc) && d.length > max) d = d.slice(cc.length);
            if (d.length > max) d = d.slice(0, max);
            if (input.value !== d) input.value = d;
          });
          document.getElementById('f-phone_country_code').addEventListener('change', () => { if (input.value) validateField(input); });
        }
        input.addEventListener('input', () => {
          if (input.closest('.form-field').classList.contains('has-error')) {
            validateField(input);
          }
        });
        input.addEventListener('focus', () => {
          if (!input.dataset.tracked) {
            track('form_start', { field: input.name });
            input.dataset.tracked = '1';
          }
        }, { once: false });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (form.dataset.mode === 'review') { showMessage('warn', 'Página de revisión: el formulario valida correctamente pero no envía datos ni crea registros.'); return; }
        // Reentrancy guard · previene doble submit (Enter-key rapid presses o dispatch programático)
        if (submitBtn.disabled) return;

        const inputs = form.querySelectorAll('input, textarea, select');
        let allValid = true;
        inputs.forEach(i => { if (!validateField(i)) allValid = false; });
        if (!allValid) {
          track('form_field_error', {});
          // A11y · mover focus al primer campo con error para keyboard users
          form.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus();
          return;
        }

        submitBtn.disabled = true;
        submitLabel.innerHTML = 'Enviando <span class="spinner"></span>';
        hideMessage();

        const hutk = getHutk();
        const context = {
          pageUri: window.location.href,
          pageName: document.title
        };
        if (hutk) context.hutk = hutk;
        // Meta Pixel cookies para dedup client/server CAPI
        const fbp = document.cookie.match(/_fbp=([^;]+)/)?.[1];
        const fbc = document.cookie.match(/_fbc=([^;]+)/)?.[1];
        if (fbp) context.fbp = fbp;
        if (fbc) context.fbc = fbc;
        // GA4 client_id (from _ga cookie)
        const gaMatch = document.cookie.match(/_ga=GA\d+\.\d+\.([^;]+)/);
        if (gaMatch) context.client_id = gaMatch[1];
        // Meta Pixel event_id · generado ANTES del POST para dedup client+server (48h window)
        // Worker usa este mismo id en CAPI · tag 85 GTM lo lee del dataLayer form_submit_success
        const metaEventId = 'apto-lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        context.event_id = metaEventId;
        window.__aptoLastLeadEventId = metaEventId;

        // Phone → E.164: +<cc><digits> · sin espacios ni caracteres, formato canónico Meta CAPI EMQ
        // Guard: si autofill/paste trae el country code embebido en el número (ej "+52 55 1234"
        // o "525512345678"), evitamos duplicarlo al concatenar.
        const phoneCC = (document.getElementById('f-phone_country_code').value || '').trim();
        let phoneDigits = (document.getElementById('f-phone_number').value || '').replace(/\D/g, '');
        if (phoneCC && phoneDigits.startsWith(phoneCC)) {
          phoneDigits = phoneDigits.slice(phoneCC.length);
        }
        const phoneE164 = phoneDigits ? `+${phoneCC}${phoneDigits}` : '';

        // Payload flat para Worker Marketon (Contact + Deal + CAPI + GA4 + email)
        const workerPayload = {
          firstname: document.getElementById('f-firstname').value.trim(),
          lastname: document.getElementById('f-lastname').value.trim(),
          email: document.getElementById('f-email').value.trim(),
          phone: phoneE164,
          company: document.getElementById('f-company').value.trim(),
          jobtitle: document.getElementById('f-jobtitle').value.trim(),
          industry: document.getElementById('f-industry').value.trim(),
          company_size: document.getElementById('f-company_size').value.trim(),
          message: document.getElementById('f-message').value.trim(),
          privacy_consent: document.getElementById('f-privacy_consent').checked,
          privacy_consent_ts: new Date().toISOString(),
          privacy_notice_url: 'https://apto.mx/aviso-de-privacidad',
          context: context
        };

        try {
          const res = await fetch(MARKETON_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(workerPayload)
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || 'Error de servidor');
          }

          const data = await res.json();

          track('form_submit_success', {
            // Meta Pixel event_id · dedup con CAPI server-side (mismo id que Worker CAPI usa)
            event_id: metaEventId,
            // Meta Pixel advanced matching (Pixel hashea auto client-side · Meta necesita raw)
            // NO usar como GA4 event params — GA4 tag 84 debe filtrar estos por TOS
            em_raw: workerPayload.email,
            ph_raw: workerPayload.phone || '',
            fn_raw: workerPayload.firstname,
            ln_raw: workerPayload.lastname,
            // Business signals (safe para GA4 · no PII)
            company: workerPayload.company,
            jobtitle: workerPayload.jobtitle,
            industry: workerPayload.industry || '',
            company_size: workerPayload.company_size || '',
            country: 'MX', // default MX · Worker enriquece con CF-IPCountry
            // Message · SOLO bool + longitud · texto crudo NO al DL (puede ser info comercial sensible)
            message_length: (workerPayload.message || '').length,
            has_problem_desc: !!(workerPayload.message || '').trim(),
            // Consent legal (proof of consent · siempre true si llegó a este punto por required)
            privacy_consent: workerPayload.privacy_consent,
            privacy_consent_ts: workerPayload.privacy_consent_ts,
            // Attribution IDs
            gclid: new URLSearchParams(location.search).get('gclid') || '',
            fbclid: new URLSearchParams(location.search).get('fbclid') || '',
            fbp: context.fbp || '',
            fbc: context.fbc || '',
            ga_client_id: context.client_id || '',
            hutk: context.hutk || '',
            // System IDs
            contact_id: data.contactId,
            deal_id: data.dealId,
            lead_id: data.leadId,
            // Custom event params
            value: 500,
            currency: 'MXN',
            page_url: location.href,
            page_referrer: document.referrer
          });

          form.hidden = true;
          successView.hidden = false;
          revealSuccess(successView);

        } catch (err) {
          track('form_submit_fail', { error: 'submit_failed' });
          console.error('Worker submit failed, trying fallback HubSpot Forms API:', err.message);
          // Degradación grácil · si Worker down, submit directo a HubSpot Forms API.
          // Construimos payload manual con nombres HubSpot canónicos (phone E.164, NO
          // phone_country_code/phone_number que no existen en HS · privacy_consent bool
          // real desde .checked, NO input.value "on" default del checkbox).
          try {
            // El form 696bbd9e exige mobilephone (no phone) y lastname por separado.
            // Partimos el nombre completo; si no hay apellido mandamos '-' para no fallar el required.
            const _first = (workerPayload.firstname || '').trim();
            const _last  = (workerPayload.lastname || '').trim() || '-';
            const canonicalFields = [
              { name: 'firstname', value: _first },
              { name: 'lastname',  value: _last },
              { name: 'email',     value: workerPayload.email },
              { name: 'mobilephone', value: workerPayload.phone },
              { name: 'company',   value: workerPayload.company },
              { name: 'jobtitle',  value: workerPayload.jobtitle },
              { name: 'industry',  value: workerPayload.industry },
              { name: 'company_size', value: workerPayload.company_size },
              { name: 'message',   value: workerPayload.message },
            ]
              .filter(f => f.value)
              .map(f => ({ objectTypeId: '0-1', name: f.name, value: f.value }));

            // HubSpot Forms v3 solo acepta hutk · pageUri · pageName · ipAddress en context.
            // Mandar fbp/client_id/event_id devuelve 400 INVALID_METADATA y el lead se pierde.
            const hsContext = {};
            if (context.hutk) hsContext.hutk = context.hutk;
            if (context.pageUri) hsContext.pageUri = context.pageUri;
            if (context.pageName) hsContext.pageName = context.pageName;

            const fallbackPayload = {
              fields: canonicalFields,
              context: hsContext,
              legalConsentOptions: {
                consent: {
                  consentToProcess: workerPayload.privacy_consent === true,
                  text: 'He leído y acepto el aviso de privacidad (apto.mx/aviso-de-privacidad)'
                }
              }
            };
            const res2 = await fetch(HUBSPOT_FALLBACK_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fallbackPayload)
            });
            if (!res2.ok) throw new Error('Fallback también falló');
            track('form_submit_success_fallback', { has_problem_desc: !!workerPayload.message });
            form.hidden = true;
            successView.hidden = false;
            revealSuccess(successView);
          } catch (err2) {
            showMessage('error', 'Algo falló al enviar. Intenta de nuevo o escríbenos a info@apto.mx');
            submitBtn.disabled = false;
            submitLabel.textContent = submitLabel.dataset.label || 'Enviar mi reto';
          }
        }
      });

    })();
  
