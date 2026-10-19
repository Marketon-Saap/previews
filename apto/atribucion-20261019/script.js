'use strict';
const head = document.querySelector('.site-head');
const menu = document.getElementById('mobile-nav');
const toggle = document.querySelector('.menu-toggle');
function closeMenu(returnFocus = false) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); if(returnFocus) toggle.focus(); }
toggle.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); });
menu.addEventListener('click', (e) => { if(e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !menu.hidden) closeMenu(true); });
document.addEventListener('click', (e) => { if(!menu.hidden && !head.contains(e.target)) closeMenu(); });
const desktop = matchMedia('(min-width:781px)'); desktop.addEventListener('change', () => { if(desktop.matches) closeMenu(); });
let ticking = false;
function syncHeader() { ticking = false; const hero = document.getElementById('hero'); const darks = [...document.querySelectorAll('#hero,#categoria,#productos,#cta-form')]; const y = head.getBoundingClientRect().top + 25; const dark = darks.some(el => { const r=el.getBoundingClientRect(); return r.top < y && r.bottom > y; }); head.classList.toggle('on-light', !dark); }
addEventListener('scroll', () => { if(!ticking) { ticking=true; requestAnimationFrame(syncHeader); } }, {passive:true}); syncHeader();
/* facade de YouTube y formulario: viven en capture.js (Marketon) */
