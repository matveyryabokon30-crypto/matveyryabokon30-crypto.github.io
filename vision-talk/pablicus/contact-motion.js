/* Scroll-linked contact masthead. Presentation only: no account, network or storage access. */
(function (root) {
 'use strict';
 const clamp = value => Math.max(0, Math.min(1, value));
 const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
 function mount(page, bar, hero) {
  const photo = hero.querySelector('.contactPhotoButton');
  const name = hero.querySelector('.contactName');
  const handle = hero.querySelector('.contactHandle');
  const actions = hero.querySelector('.contactActions');
  const hint = hero.querySelector('.contactPrivateHint');
  if (!photo || !name || !handle || !actions) return null;
  const lifetime = new AbortController(), signal = lifetime.signal;
  const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
  const mast = document.createElement('div'), glass = document.createElement('div');
  mast.className = 'contactMasthead'; glass.className = 'contactEdgeFade';
  glass.setAttribute('aria-hidden', 'true');
  page.insertBefore(mast, bar); mast.append(glass, bar, hero);
  page.classList.add('contactMotion');
  name.title = name.textContent;
  let dead = false, frame = 0, needsMeasure = true, geometry = null;
  const items = [photo, name, handle, actions, hint].filter(Boolean);
  const px = n => n.toFixed(3) + 'px';
  const transform = (node, y, scale = 1) => { node.style.transform = `translate3d(0,${px(y)},0) scale(${scale.toFixed(5)})`; };
  function visibility(node, hidden) {
   if (hidden && node.contains(document.activeElement)) bar.querySelector('.contactBack')?.focus({preventScroll:true});
   node.inert = hidden;
   node.style.visibility = hidden ? 'hidden' : '';
  }
  function measure() {
   // Geometry is read only at mount / resize / font changes, never for each scroll frame.
   for (const node of items) node.style.transform = '';
   bar.style.transform = ''; glass.style.transform = '';
   const origin = mast.getBoundingClientRect().top;
   const center = node => { const r = node.getBoundingClientRect(); return r.top - origin + r.height / 2; };
   const height = mast.offsetHeight, toolbar = bar.offsetHeight;
   const safe = Math.max(0, toolbar - 60), width = page.clientWidth;
   const nameFont = parseFloat(getComputedStyle(name).fontSize) || 29;
   const handleFont = parseFloat(getComputedStyle(handle).fontSize) || 17;
   const available = Math.max(72, width - 160);
   geometry = {range:Math.max(1, height-toolbar), toolbar, safe,
    photo:center(photo), name:center(name), handle:center(handle), actions:center(actions),
    nameScale:Math.min(17/nameFont, available/Math.max(1,name.offsetWidth)),
    handleScale:Math.min(12/handleFont, available/Math.max(1,handle.offsetWidth))};
   mast.style.top = px(-geometry.range);
   page.style.setProperty('--contact-bar-height', px(toolbar));
   glass.style.height = px(toolbar + 26);
   needsMeasure = false;
  }
  function paint() {
   frame = 0;
   if (dead || !page.open || !mast.isConnected) return;
   if (needsMeasure || !geometry) measure();
   const g = geometry, scroll = Math.max(0, Math.min(g.range, page.scrollTop));
   const p = scroll/g.range, titleP = ease(p/.76), avatarP = ease(p/.70);
   transform(bar, scroll); transform(glass, scroll);
   transform(name, scroll + (g.safe+21-g.name)*titleP, 1+(g.nameScale-1)*(reduced.matches?1:titleP));
   transform(handle, scroll + (g.safe+42-g.handle)*titleP, 1+(g.handleScale-1)*(reduced.matches?1:titleP));
   // One actual portrait and one actual name travel through the transition; no duplicate title swap.
   transform(photo, scroll + (g.safe-18-g.photo)*avatarP, reduced.matches?1:1-.68*avatarP);
   photo.style.opacity = String(1-ease((p-.12)/.48));
   visibility(photo, p >= .60);
   if (hint) { hint.style.opacity = String(1-ease(p/.30)); visibility(hint,p>=.30); }
   const actionP = ease(p), fade = 1-ease((p-.64)/.28);
   const actionCenter = Math.min(g.actions+(g.toolbar+6-g.actions)*actionP, g.toolbar+g.range-scroll-46);
   transform(actions, scroll + actionCenter-g.actions);
   actions.style.opacity = String(fade);
   actions.style.setProperty('--contact-action-y', String(reduced.matches?1:1-.66*actionP));
   actions.style.setProperty('--contact-icon-y', px(9*actionP));
   actions.style.setProperty('--contact-icon-scale', String(reduced.matches?1:1-.24*actionP));
   actions.style.setProperty('--contact-label-opacity', String(1-ease((p-.26)/.40)));
   visibility(actions, fade < .08);
   page.dataset.contactCollapse = p.toFixed(3);
  }
  function schedule(resize = false) {
   if (dead) return;
   if (resize) needsMeasure = true;
   if (!frame) frame = root.requestAnimationFrame(paint);
  }
  // Passive native scrolling, no touch interception, synthetic momentum, snapping or height feedback.
  page.addEventListener('scroll', () => schedule(), {passive:true,signal});
  root.addEventListener('resize', () => schedule(true), {passive:true,signal});
  reduced.addEventListener('change', () => schedule(true), {signal});
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule(true)) : null;
  observer?.observe(hero); observer?.observe(bar);
  document.fonts?.ready.then(() => { if (!dead) schedule(true); });
  paint();
  return {mast,hero, destroy() {
   if (dead) return; dead = true;
   lifetime.abort(); observer?.disconnect(); if (frame) root.cancelAnimationFrame(frame);
   for (const node of items) { node.style.transform = ''; node.style.opacity = ''; node.style.visibility = ''; node.inert = false; }
   bar.style.transform = ''; page.classList.remove('contactMotion');
   page.style.removeProperty('--contact-bar-height'); delete page.dataset.contactCollapse;
  }};
 }
 function watch(page) {
  let current = null;
  function update() {
   if (current && (!page.open || !current.mast.isConnected || !page.contains(current.mast))) { current.destroy(); current = null; }
   // Arrow-only chrome also covers photo/QR/loading views; edit Cancel retains its text.
   for (const back of page.querySelectorAll('.contactBack')) back.classList.toggle('contactBackIcon', !!back.querySelector('svg'));
   if (!page.open || current) return;
   const bar = page.querySelector(':scope > .contactTop'), hero = page.querySelector(':scope > .contactHero');
   if (bar && hero) current = mount(page,bar,hero);
  }
  const observer = new MutationObserver(update);
  observer.observe(page,{childList:true,attributes:true,attributeFilter:['open']});
  update();
  return () => { observer.disconnect(); current?.destroy(); };
 }
 let page = null, dispose = null;
 function discover() {
  const next = document.getElementById('pablicusContactCard');
  if (next === page) return;
  dispose?.(); page = next; dispose = page ? watch(page) : null;
 }
 if (document.body) {
  const observer = new MutationObserver(discover);
  observer.observe(document.body,{childList:true}); discover();
 }
 root.PablicusContactMotion = {mount};
})(window);
