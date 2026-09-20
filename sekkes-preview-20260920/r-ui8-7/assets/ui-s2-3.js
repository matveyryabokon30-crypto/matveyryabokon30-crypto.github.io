/* SEKKES S0/S1. Real interface; no simulated AI, client records or therapeutic sessions. */
(() => {
  'use strict';
  const BUILD = '2026.09.20-s3.28';
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), hero = $('#hero'), portals = $('#portals'), dock = $('#dock');
  const root = document.documentElement;
  const draft = $('#draft'), dialog = $('#dialog'), dialogContent = $('#dialogContent');
  const allowedRoutes = new Set(['home', 'ai', 'text', 'games', 'world']);
  let route = 'home', progress = 0, collapsed = 0, height = 0, animation = 0, pointer = null;
  let toastTimer, mic = null, micPending = false, micGeneration = 0, micTimer, audioFrame;
  let pendingVersion = null, updateBusy = false, updateTimer = null, swRegistration = null;
  let lastFocus = null;
  const setting = {
    get(key) { try { return localStorage.getItem('sekkes-v2:ui:' + key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem('sekkes-v2:ui:' + key, value); } catch { /* optional UI preference */ } }
  };
  function applyTheme(theme) {
    const selected = ['luna', 'moon', 'crimson'].includes(theme) ? theme : 'luna';
    document.body.classList.remove('theme-moon', 'theme-crimson');
    if (selected !== 'luna') document.body.classList.add('theme-' + selected);
    setting.set('theme', selected);
    document.querySelectorAll('[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.theme === selected)));
  }
  applyTheme(setting.get('theme') || 'luna');
  if (setting.get('motion') === 'reduced') document.body.classList.add('reduced-motion');
  const reduced = () => document.body.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function notify(text) {
    const toast = $('#toast'); toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 5500);
  }
  function geometry() {
    const vv = window.visualViewport;
    const baseHeight = window.innerHeight;
    const keyboard = document.activeElement === draft && vv && vv.height < baseHeight - 130;
    document.body.classList.toggle('keyboard-visible', Boolean(keyboard));
    height = keyboard ? vv.height : baseHeight;
    collapsed = Math.round(baseHeight * .604);
    root.style.setProperty('--app-h', height + 'px');
    root.style.setProperty('--collapsed', collapsed + 'px');
    paint(progress);
  }
  function paint(p) {
    progress = Math.min(1, Math.max(0, p));
    const safe = parseFloat(getComputedStyle(root).getPropertyValue('--safe-top')) || 0;
    root.style.setProperty('--hero-h', (collapsed + (height - collapsed) * progress) + 'px');
    root.style.setProperty('--intro-y', ((collapsed - 252) * (1 - progress) + (safe + 105) * progress) + 'px');
    root.style.setProperty('--progress', progress.toFixed(4));
    root.style.setProperty('--bottom-radius', (36 * (1 - progress)) + 'px');
    root.style.setProperty('--dock-alpha', Math.max(0, 1 - progress * 4));
    root.style.setProperty('--full-alpha', Math.max(0, Math.min(1, (progress - .67) / .33)));
    hero.dataset.progress = progress.toFixed(3);
    $('#aiFull').hidden = progress < .58;
    portals.inert = progress > .06;
    dock.inert = route === 'ai' || route === 'text' || (route === 'home' && progress > .06);
    dock.style.pointerEvents = dock.inert ? 'none' : '';
    if (route === 'games' || route === 'world') { dock.inert = false; dock.style.pointerEvents = ''; root.style.setProperty('--dock-alpha', 1); }
  }
  function snap(open, immediate = false) {
    cancelAnimationFrame(animation);
    const from = progress, to = open ? 1 : 0;
    hero.classList.toggle('expanded', open);
    $('#heroExpand').setAttribute('aria-expanded', String(open));
    $('#heroExpand').setAttribute('aria-label', open ? 'Свернуть AI' : 'Развернуть AI');
    $('#dragHandle').setAttribute('aria-expanded', String(open));
    $('#dragHandle').setAttribute('aria-label', open ? 'Потянуть вверх или нажать, чтобы свернуть AI' : 'Потянуть вниз или нажать, чтобы раскрыть AI');
    if (immediate || reduced()) { paint(to); return; }
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 360);
      paint(from + (to - from) * (1 - Math.pow(1 - t, 4)));
      if (t < 1) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }
  function setRoute(next, replace = false) {
    if (!allowedRoutes.has(next)) next = 'home';
    if (location.hash.slice(1) !== next) {
      history[replace ? 'replaceState' : 'pushState']({ route: next }, '', '#' + next);
    }
    renderRoute(next);
  }
  function renderRoute(next, immediate = false) {
    const previous = route; route = allowedRoutes.has(next) ? next : 'home';
    if (previous !== route && !window.SekkesS2) stopMic();
    const inAI = route === 'ai' || route === 'text';
    for (const id of ['home', 'games', 'world']) $('#' + id).hidden = id !== (inAI ? 'home' : route);
    $('#voiceView').hidden = route === 'text'; $('#textView').hidden = route !== 'text';
    $('#composerLabel').textContent = route === 'text' ? 'Голосовой режим' : 'О чём поговорим?';
    $('#openText').setAttribute('aria-label', route === 'text' ? 'Перейти к голосовому режиму' : 'Перейти к текстовому режиму');
    $('#micButton').setAttribute('aria-label', route === 'text' ? 'Отправить сообщение' : 'Открыть голосовой режим');
    $('#micButton use').setAttribute('href', route === 'text' ? '#i-send' : '#i-mic');
    document.querySelectorAll('.dock [data-route]').forEach(b => {
      if (b.dataset.route === (inAI ? 'home' : route)) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    snap(inAI, immediate);
    if (!inAI) draft.blur();
    app.dataset.route = route;
    window.dispatchEvent(new CustomEvent('sekkes:route',{detail:{route}}));
    if (route === 'home') maybeApplyUpdate();
  }
  addEventListener('popstate', () => { if (dialog.open) dialog.close(); renderRoute(location.hash.slice(1)); });
  addEventListener('hashchange', () => { const next = location.hash.slice(1); if (next !== route) renderRoute(next); });
  document.addEventListener('click', e => {
    const target = e.target.closest('button[data-route]');
    if (target) setRoute(target.dataset.route);
    const trigger = e.target.closest('[data-open]');
    if (trigger) openDialog(trigger.dataset.open);
  });
  $('#heroExpand').addEventListener('click', () => setRoute(progress > .5 ? 'home' : 'ai'));
  $('#openText').addEventListener('click', () => {
    if (route === 'text') { setRoute('ai'); return; }
    setRoute('text');
    // iOS requires focus in the original user gesture to open the keyboard.
    snap(true, true); draft.focus({ preventScroll: true });
  });
  $('#micButton').addEventListener('click', () => {
    if (window.SekkesS2) { if (route === 'text') window.SekkesS2.sendText(); else { setRoute('ai'); window.SekkesS2.toggleMic(); } return; }
    notify('Подключение загружается. Попробуй через несколько секунд.'); return;
    if (route === 'text') {
      notify(draft.value.trim() ? 'AI ещё не подключён. Текст остался в поле и никуда не отправлен.' : 'Сначала напиши, о чём хочешь поговорить.');
      return;
    }
    if (mic || micPending) { stopMic(); return; }
    setRoute('ai'); openDialog('mic');
  });
  $('#micTestLink').addEventListener('click', () => { if(window.SekkesS2)window.SekkesS2.toggleMic(); else notify('Подключение ещё загружается.'); });
  draft.addEventListener('input', maybeApplyUpdate);
  draft.addEventListener('blur', () => setTimeout(geometry, 120));
  draft.addEventListener('focus', () => setTimeout(geometry, 120));

  // Direct manipulation is confined to scenery and the handle, never inputs or controls.
  hero.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const zone = e.target.closest('[data-drag-zone]');
    if (!zone || (e.target.closest('button') && zone.id !== 'dragHandle')) return;
    cancelAnimationFrame(animation);
    pointer = { id: e.pointerId, y: e.clientY, x: e.clientX, p: progress, time: performance.now(), moved: false, zone };
    try { zone.setPointerCapture(e.pointerId); } catch { /* pointer already cancelled */ }
  });
  hero.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dy = e.clientY - pointer.y;
    if (Math.abs(dy) > 5) pointer.moved = true;
    if (pointer.moved) { e.preventDefault(); paint(pointer.p + dy / Math.max(120, height - collapsed)); }
  });
  function finishPointer(e, cancelled = false) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const p = pointer; pointer = null;
    const dy = e.clientY - p.y, velocity = dy / Math.max(1, performance.now() - p.time);
    let open = progress > .5;
    if (!cancelled && p.moved && Math.abs(dy) > 34 && Math.abs(velocity) > .32) open = dy > 0;
    if (!p.moved && p.zone.id === 'dragHandle' && !cancelled) open = p.p < .5;
    if (Math.abs(progress - p.p) > .02 || p.zone.id === 'dragHandle') setRoute(open ? 'ai' : 'home');
    else snap(p.p > .5);
    maybeApplyUpdate();
  }
  hero.addEventListener('pointerup', e => finishPointer(e));
  hero.addEventListener('pointercancel', e => finishPointer(e, true));
  $('#dragHandle').addEventListener('click', e => { if (e.detail === 0) setRoute(progress > .5 ? 'home' : 'ai'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !dialog.open && (route === 'ai' || route === 'text')) setRoute('home'); });

  const dialogViews = {
    mic: () => `<div class="kicker">ПРОВЕРКА УСТРОЙСТВА</div><h2 id="dialogTitle">Проверим голос?</h2><p>Можно проверить, слышит ли тебя микрофон. Индикатор будет реагировать на настоящий звук.</p><p>Это не разговор с AI: AI ещё не подключён. Звук обрабатывается только на этом устройстве, не отправляется и не записывается. Проверка остановится через 30 секунд или при выходе.</p><div class="dialog-actions"><button class="rounded-action primary" id="allowMic">Включить микрофон</button><button class="rounded-action ghost" data-dismiss>Не сейчас</button></div>`,
    profile: () => `<div class="kicker">ТВОЁ ПРОСТРАНСТВО</div><h2 id="dialogTitle">Настройки</h2><div class="settings-row"><span>Палитра</span><div class="palette"><button class="luna" data-theme="luna" aria-label="Палитра Luna" aria-pressed="false"></button><button class="moon" data-theme="moon" aria-label="Палитра Moon" aria-pressed="false"></button><button class="crimson" data-theme="crimson" aria-label="Палитра Crimson" aria-pressed="false"></button></div></div><label class="settings-row"><span>Меньше движения</span><input id="motionSetting" type="checkbox"></label><div class="settings-row"><span>Голос помощника</span><button id="s3ProfileVoice" class="text-link" style="color:#24474b">Выбрать голос</button></div><div class="settings-row"><span>Личный AI</span><button id="s2ProfileLogin" class="text-link" style="color:#24474b">Войти в аккаунт</button></div><p>Закрытый тест S2. Войти можно со своей учётной записью SEKKES AI. Пароль и история разговора на устройстве не сохраняются.</p><div class="settings-row"><span>Версия приложения</span><button id="s3RefreshApp" class="text-link" style="color:#24474b">Обновить приложение</button></div><p class="hint">Сборка ${BUILD}. S2 · первый живой тест.<br>Голос и текст отправляются только после входа и твоего действия.</p>`,
    game001: () => `<div class="kicker">GAME-001</div><h2 id="dialogTitle">Призрачный атлас</h2><p>Рабочее название первой игры. Маршрут: холл, Зеркало, Перекрёсток, Перспектива и завершение.</p><p>Здесь появятся выборы, последствия и возможность вернуться к сохранённой игре. Сейчас это карточка будущего игрового опыта, не готовая игра.</p><div class="dialog-actions"><button class="rounded-action primary" data-dismiss>Вернуться к каталогу</button></div>`,
    worldInfo: () => `<div class="kicker">LIVING WORLD</div><h2 id="dialogTitle">Своя жизнь.<br>Свои последствия.</h2><p>У мира будут отдельные события, состояние и память персонажей. Они не получают автоматически историю личного AI или записи психолога.</p><p>Автономный мир пока не запущен. Здесь показано его место в новом интерфейсе, без выдуманной истории событий.</p><div class="dialog-actions"><button class="rounded-action primary" data-dismiss>Вернуться в пространство</button></div>`,
    vr: () => `<div class="kicker">SEKKES / VR</div><h2 id="dialogTitle">Внутри опыта.</h2><p>Будущее пространство погружений: одному, вдвоём, группой или вместе со специалистом.</p><p>Не только смотреть — менять точку зрения, взаимодействовать и исследовать сцену. Сейчас VR-сессии ещё не доступны: сначала проверяются сценарии и устройство.</p><div class="dialog-actions"><button class="rounded-action primary" data-dismiss>Понятно</button></div>`,
    pro: () => `<div class="kicker">SEKKES PRO</div><h2 id="dialogTitle">Вместе<br>со специалистом.</h2><p>Рабочий кабинет для собственных клиентов: приглашения, назначения, совместные игровые и VR-сессии.</p><p>Специалист видит только разрешённые клиентом данные. Кабинет и запись на консультацию ещё не подключены.</p><div class="dialog-actions"><button class="rounded-action primary" data-dismiss>Понятно</button></div>`
  };
  function openDialog(name) {
    if (!dialogViews[name]) return;
    lastFocus = document.activeElement;
    dialogContent.innerHTML = dialogViews[name]();
    if (!dialog.open) dialog.showModal();
    $('#dialogClose').focus({ preventScroll: true });
    dialogContent.querySelectorAll('[data-dismiss]').forEach(b => b.addEventListener('click', () => dialog.close()));
    dialogContent.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
    if (name === 'profile') {
      $('#s3RefreshApp').onclick=()=>refreshApplication();
      $('#s3ProfileVoice').onclick=()=>window.SekkesS2?.voiceSettings();
      $('#s2ProfileLogin').addEventListener('click',()=>{if(window.SekkesS2)window.SekkesS2.login();else notify('Подключение загружается.');});
      applyTheme(setting.get('theme') || 'luna');
      const motion = $('#motionSetting'); motion.checked = document.body.classList.contains('reduced-motion');
      motion.addEventListener('change', () => { document.body.classList.toggle('reduced-motion', motion.checked); setting.set('motion', motion.checked ? 'reduced' : 'normal'); });
    }
    if (name === 'mic') $('#allowMic').addEventListener('click', () => { dialog.close(); beginMic(); });
  }
  $('#dialogClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (lastFocus && lastFocus.isConnected && !lastFocus.closest('[hidden]')) lastFocus.focus({ preventScroll: true }); maybeApplyUpdate(); });

  async function beginMic() {
    if (mic || micPending) return;
    const ticket = ++micGeneration; micPending = true;
    $('#aiStateLabel').textContent = 'Ожидаем разрешение микрофона';
    $('#micTestLink').textContent = 'Отменить проверку';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (ticket !== micGeneration || document.hidden || route !== 'ai') { stream.getTracks().forEach(t => t.stop()); return; }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { stream.getTracks().forEach(t => t.stop()); throw new Error('unsupported'); }
      const context = new AudioContext();
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      const source = context.createMediaStreamSource(stream); source.connect(analyser);
      mic = { stream, context, source, analyser }; micPending = false;
      await context.resume();
      if (ticket !== micGeneration || !mic) return;
      document.body.classList.add('mic-active');
      $('#aiStateLabel').textContent = 'Проверка микрофона · только на устройстве';
      $('#voiceHint').textContent = 'Индикатор реагирует на твой голос. AI не подключён.';
      $('#micTestLink').textContent = 'Завершить проверку';
      $('#micButton').setAttribute('aria-label', 'Остановить проверку микрофона');
      const values = new Uint8Array(analyser.frequencyBinCount), bars = [...document.querySelectorAll('.wave i')];
      const draw = () => {
        if (!mic || ticket !== micGeneration) return;
        analyser.getByteFrequencyData(values);
        bars.forEach((bar, i) => { bar.style.transform = `scaleY(${1 + values[i * 3 + 2] / 28})`; });
        audioFrame = requestAnimationFrame(draw);
      };
      draw(); micTimer = setTimeout(stopMic, 30000);
    } catch (error) {
      if (ticket !== micGeneration) return;
      stopMic();
      notify(error.name === 'NotAllowedError' ? 'Доступ к микрофону не разрешён. Остальной интерфейс работает без него.' : 'Микрофон сейчас недоступен. Никакие данные не отправлены.');
    } finally { if (ticket === micGeneration) micPending = false; }
  }
  function stopMic() {
    micGeneration++; micPending = false; clearTimeout(micTimer); cancelAnimationFrame(audioFrame);
    if (mic) { mic.stream.getTracks().forEach(t => t.stop()); try { mic.source.disconnect(); mic.context.close().catch(() => {}); } catch {} mic = null; }
    document.body.classList.remove('mic-active');
    document.querySelectorAll('.wave i').forEach(b => b.style.transform = '');
    $('#aiStateLabel').textContent = 'AI пока не подключён';
    $('#voiceHint').innerHTML = 'Голос или текст.<br>Выбирай, как тебе удобнее.';
    $('#micTestLink').textContent = 'Проверить микрофон';
    $('#micButton').setAttribute('aria-label', route === 'text' ? 'Отправить сообщение' : 'Открыть голосовой режим');
  }

  // Update only this app, only from its own version manifest, and never while a draft or interaction is active.
  function canReload() { return !window.SekkesS2?.dirty && !document.hidden && route === 'home' && !dialog.open && !draft.value.trim() && !mic && !micPending && !pointer; }
  async function refreshApplication() {
    if (window.SekkesS2?.busy || mic || micPending) { notify('Сначала заверши разговор или дождись ответа.'); return; }
    if ((draft.value.trim() || window.SekkesS2?.dirty) && !confirm('Обновить приложение? Несохранённый текст и текущий контекст на экране будут сброшены. Может потребоваться повторный вход.')) return;
    await checkUpdate();
    if (window.SekkesS2?.busy || mic || micPending) return;
    const url=new URL(location.href);url.searchParams.set('v',pendingVersion||BUILD);url.searchParams.set('refresh',String(Date.now()));
    location.replace(url.href);
  }
  function showUpdateNotice() {
    let banner=document.querySelector('#sekkesUpdateNotice');
    if(!banner){banner=document.createElement('button');banner.id='sekkesUpdateNotice';banner.type='button';banner.style.cssText='position:fixed;bottom:90px;left:16px;right:16px;z-index:1000;padding:14px;border-radius:18px;background:#eaf4f1;color:#15333b';banner.onclick=refreshApplication;document.body.append(banner);}
    banner.textContent='Доступно обновление SEKKES — установить';
    const button=document.querySelector('#s3RefreshApp');if(button)button.textContent='Установить обновление';
  }
  function maybeApplyUpdate() {
    if (!pendingVersion || !canReload()) return;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      if (!pendingVersion || !canReload()) return;
      try {
        const prev = JSON.parse(sessionStorage.getItem('sekkes-v2:update-attempt') || 'null');
        if (prev && prev.version === pendingVersion && Date.now() - prev.time < 60000) return;
        sessionStorage.setItem('sekkes-v2:update-attempt', JSON.stringify({ version: pendingVersion, time: Date.now() }));
      } catch {}
      const url = new URL(location.href); url.searchParams.set('v', pendingVersion);
      location.replace(url.href);
    }, 600);
  }
  async function checkUpdate() {
    if (updateBusy || document.hidden || !navigator.onLine) return;
    updateBusy = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
    try {
      if (swRegistration) swRegistration.update().catch(() => {});
      const url = new URL('version.json', location.href); url.searchParams.set('check', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) return;
      const info = await response.json();
      if (typeof info.version === 'string' && /^[0-9A-Za-z._-]{1,64}$/.test(info.version) && info.app === 'sekkes-v2' && info.version !== BUILD) {
        pendingVersion = info.version; showUpdateNotice(); maybeApplyUpdate();
      }
    } catch { /* Last working interface remains usable offline. */ }
    finally { clearTimeout(timeout); updateBusy = false; }
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('sw.js', location.href), { scope: new URL('./', location.href).pathname, updateViaCache: 'none' })
      .then(reg => { swRegistration = reg; checkUpdate(); })
      .catch(() => { /* Network UI still works if SW registration is unavailable. */ });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data?.app === 'sekkes-v2' && e.data?.type === 'VERSION_READY') checkUpdate(); });
  }
  addEventListener('resize', geometry);
  window.visualViewport?.addEventListener('resize', geometry);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if(!window.SekkesS2)stopMic(); } else { geometry(); checkUpdate(); } });
  addEventListener('pagehide',()=>{if(!window.SekkesS2)stopMic();});
  addEventListener('pageshow', () => { geometry(); checkUpdate(); });
  addEventListener('online', checkUpdate);
  setInterval(checkUpdate, 60000);
  geometry(); renderRoute(location.hash.slice(1) || 'home', true); checkUpdate();
})();


