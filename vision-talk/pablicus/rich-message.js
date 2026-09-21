/* Ordered message blocks. Images/video open in the host; voice plays in the row. */
(function (scope) {
  'use strict';

  const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document']);
  const LABELS = { image: 'Фото', video: 'Видео', audio: 'Голосовое сообщение', document: 'Документ' };
  // Storage names and revisions remain transport metadata, never UI copy.
  function readableName(value, fallback = 'Документ') {
    const name = String(value || '').trim();
    const technical = !name || /(?:[\\/]|%[0-9a-f]{2}|[\u0000-\u001f])/i.test(name)
      || /\.(?:json|jsonl|log|tmp|bin|dat)$/i.test(name)
      || /(?:[0-9a-f]{12,}|\d{4}[-_]\d{2}[-_]\d{2}|\d{8,}|^(?:img|dsc|pxl|vid|image|photo|video|audio|voice|recording)[-_ ]?\d)/i.test(name)
      || /^[a-z0-9]+(?:[-_][a-z0-9]+){2,}(?:\.[a-z0-9]+)?$/i.test(name);
    return technical ? fallback : name;
  }
  function attachmentLabel(block = {}) {
    const type = block.kind || block.type;
    const label = LABELS[type] || 'Документ';
    return type === 'document' || !LABELS[type] ? readableName(block.name, label) : label;
  }
  // Tight media frames: use decoded dimensions, never a fixed portrait canvas.
  function setMediaDimensions(frame, width, height) {
    if (!(width > 0 && height > 0 && Number.isFinite(width / height))) return;
    const ratio = width / height;
    frame.dataset.sourceRatio = String(ratio);
    frame.style.setProperty('--rich-image-ratio', String(ratio));
    frame.style.setProperty('--chat-media-limit', (420 * ratio) + 'px');
    const bubble = frame.closest('.chatSingleMedia');
    if (bubble) bubble.style.setProperty('--chat-media-limit', (420 * ratio) + 'px');
  }
  // Display-only trim for uniform, paired black letterbox borders. The original
  // file and original viewer are untouched. Tainted/animated/dark images fall back.
  function fitChatImage(frame,image,block={}) {
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!(w>0&&h>0))return;
    const previous=frame.dataset.borderTrim;
    if(previous){for(const key of ['width','height','left','top','right','bottom'])image.style.removeProperty(key);delete frame.dataset.borderTrim;}
    setMediaDimensions(frame,w,h);
    if(frame.closest('.richMediaGallery')||/gif|apng/i.test(block.mime||block.mime_type||block.name||'')||w<64||h<64)return;
    try {
      const c=document.createElement('canvas'),scale=Math.min(1,256/Math.max(w,h));
      c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);
      const {data}=ctx.getImageData(0,0,c.width,c.height),W=c.width,H=c.height;
      const black=(x,y)=>{const i=(y*W+x)*4;return data[i+3]>250&&Math.max(data[i],data[i+1],data[i+2])<=8;};
      const row=y=>{for(let x=0;x<W;x++)if(!black(x,y))return false;return true;};
      const col=x=>{for(let y=0;y<H;y++)if(!black(x,y))return false;return true;};
      let top=0,bottom=0,left=0,right=0;
      while(top<H*.18&&row(top))top++;
      while(bottom<H*.18&&row(H-1-bottom))bottom++;
      while(left<W*.18&&col(left))left++;
      while(right<W*.18&&col(W-1-right))right++;
      const paired=(a,b,max)=>a>=2&&b>=2&&a<max*.18&&b<max*.18&&Math.abs(a-b)<=Math.max(3,Math.min(a,b)*.15);
      if(!paired(top,bottom,H))top=bottom=0;
      if(!paired(left,right,W))left=right=0;
      if(!(top||left))return;
      // Never turn an almost-black photograph into an arbitrary crop.
      let bright=0,total=0;
      for(let y=top;y<H-bottom;y++)for(let x=left;x<W-right;x++){const i=(y*W+x)*4;total++;if(Math.max(data[i],data[i+1],data[i+2])>32)bright++;}
      if(bright<total*.25)return;
      // Sampling undershoots, so retain the boundary pixel instead of content crop.
      const l=left/W,r=right/W,t=top/H,b=bottom/H,cw=1-l-r,ch=1-t-b;
      setMediaDimensions(frame,w*cw,h*ch);frame.dataset.borderTrim=JSON.stringify({left:l,top:t,right:r,bottom:b});
      image.style.width=(100/cw)+'%';image.style.height=(100/ch)+'%';
      image.style.left=(-100*l/cw)+'%';image.style.top=(-100*t/ch)+'%';image.style.right='auto';image.style.bottom='auto';
    }catch{/* Pixel access is optional; still retain correct decoded dimensions. */}
  }
  function prepareChatBubble(bubble) {
    const rich = [...bubble.children].find(n => n.classList.contains('richMessage'));
    const frame = rich?.children.length === 1 && rich.firstElementChild.matches('.richMedia-image,.richMedia-video')
      ? rich.firstElementChild : [...bubble.children].find(n => n.matches('.mediaOpen[data-media-type="image"]'));
    const extra = [...bubble.children].some(n => n !== rich && n !== frame && !n.matches('.meta,.messageReactions') && (n.textContent.trim() || n.querySelector('img,video')));
    if (frame && !extra) {
      bubble.classList.add('chatSingleMedia');
      const limit = frame.style.getPropertyValue('--chat-media-limit');
      if (limit) bubble.style.setProperty('--chat-media-limit', limit);
    }
  }
  const activeViews = new Set();
  let activeAudio = null;
  let removalObserver = null;
  const frame = callback => scope.requestAnimationFrame ? scope.requestAnimationFrame(callback) : scope.setTimeout(callback, 0);
  const cancelFrame = id => scope.cancelAnimationFrame ? scope.cancelAnimationFrame(id) : scope.clearTimeout(id);

  /** Shape validation for display/local drafts; the transport validates server limits separately. */
  function validate(value) {
    const errors = [];
    if (!value || typeof value !== 'object' || value.v !== 1 || !Array.isArray(value.blocks)) {
      return { ok: false, errors: ['Ожидалось сообщение с блоками версии 1.'], content: null };
    }
    const blocks = [], ids = new Set();
    value.blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object' || typeof block.id !== 'string' || !block.id.trim() || ids.has(block.id)) {
        errors.push('Некорректный или повторный идентификатор блока ' + (index + 1) + '.');
        return;
      }
      ids.add(block.id);
      if (block.type === 'text') {
        if (typeof block.text !== 'string') { errors.push('В текстовом блоке отсутствует текст.'); return; }
        blocks.push({ id: block.id, type: 'text', text: block.text });
        return;
      }
      if (!MEDIA_TYPES.has(block.type)) { errors.push('Неизвестный вид блока ' + (index + 1) + '.'); return; }
      const clean = { id: block.id, type: block.type };
      for (const key of ['path', 'assetId', 'name', 'mime']) {
        if (block[key] !== undefined && typeof block[key] !== 'string') {
          errors.push('Некорректное поле вложения: ' + key + '.');
          return;
        }
        if (typeof block[key] === 'string') clean[key] = block[key];
      }
      for (const key of ['size', 'width', 'height', 'duration']) {
        if (block[key] !== undefined && (typeof block[key] !== 'number' || !Number.isFinite(block[key]) || block[key] < 0)) {
          errors.push('Некорректный размер или длительность вложения.');
          return;
        }
        if (typeof block[key] === 'number') clean[key] = block[key];
      }
      blocks.push(clean);
    });
    return { ok: errors.length === 0, errors, content: errors.length ? null : { v: 1, blocks } };
  }

  function textContent(value) {
    const checked = validate(value);
    return checked.ok ? checked.content.blocks.filter(block => block.type === 'text').map(block => block.text).join('\n') : '';
  }

  // Only adjacent visual blocks share a tile group; prose/voice/documents retain
  // their position in the message. Empty editor insertion points are invisible.
  function groupBlocks(blocks) {
    const result = [];
    let visual = [];
    const flush = () => {
      if (visual.length > 1) result.push({ type: 'gallery', blocks: visual });
      else if (visual.length) result.push(visual[0]);
      visual = [];
    };
    for (const block of blocks) {
      if (block.type === 'text' && !block.text.trim()) continue;
      if (block.type === 'image' || block.type === 'video') visual.push(block);
      else { flush(); result.push(block); }
    }
    flush();
    return result;
  }

  function readableSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' МБ' : Math.max(1, Math.round(bytes / 1024)) + ' КБ';
  }

  function readableDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    const rounded = Math.floor(seconds);
    return Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0');
  }

  function safeResolvedUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = new scope.URL(value);
      return ['https:', 'http:', 'blob:'].includes(parsed.protocol) ? parsed.href : null;
    } catch (_) { return null; }
  }

  function rememberView(state) {
    activeViews.add(state);
    if (!removalObserver && scope.MutationObserver && scope.document.body) {
      removalObserver = new scope.MutationObserver(records => {
        for (const current of activeViews) {
          if (!current.root.isConnected) current.dispose();
          else if (records.some(record => record.type === 'attributes' && record.target.contains(current.root))) current.syncPlayback?.();
        }
      });
      removalObserver.observe(scope.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert'] });
    }
  }

  function forgetView(state) {
    activeViews.delete(state);
    if (!activeViews.size && removalObserver) { removalObserver.disconnect(); removalObserver = null; }
  }

  function stopAll() {
    for (const state of activeViews) state.stopAudio();
    activeAudio = null;
  }

  function render(value, options) {
    options = options || {};
    const document = scope.document;
    if (!document) throw new Error('Для отображения сообщения нужен DOM.');
    const element = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const root = element('div', 'richMessage');
    if (options.naturalMedia) root.classList.add('richMessageNaturalMedia');
    const checked = validate(value);
    if (!checked.ok) {
      root.append(element('p', 'richMessageUnavailable', 'Не удалось отобразить содержимое сообщения.'));
      return root;
    }
    let disposed = false, initialized = false, observer = null, playbackObserver = null, resizeFrame = null, mountFrame = null;
    const videoLife = new AbortController();
    const images = [], videos = [], audioPlayers = [];
    // NaturalList renders measurement copies too. They must never resolve media URLs.
    const isLiveRow = () => root.isConnected && !root.closest('.measureBox') &&
      (options.mountRoot ? options.mountRoot.contains(root) && options.isActive?.() !== false : !!root.closest('#canvas'));
    const notifyResize = () => {
      if (disposed || resizeFrame !== null || typeof options.onResize !== 'function') return;
      resizeFrame = frame(() => {
        resizeFrame = null;
        if (!disposed && isLiveRow()) options.onResize(root);
      });
    };
    const state = { root, syncPlayback() { for (const item of videos) syncVideo(item); }, stopAudio() {
      for (const player of audioPlayers) player.stop(true);
      for (const item of videos) item.video.pause();
    }, dispose() {
      disposed = true;
      state.stopAudio();
      if (observer) observer.disconnect();
      playbackObserver?.disconnect();videoLife.abort();
      for (const item of videos) {item.video.removeAttribute('src');item.video.load();}
      if (resizeFrame !== null) cancelFrame(resizeFrame);
      if (mountFrame !== null) cancelFrame(mountFrame);
      forgetView(state);
    } };
    const releaseObserverWhenFinished = () => {
      if (!images.some(item => item.status === 'waiting' || item.status === 'loading') &&
          !videos.some(item => item.status === 'waiting' || item.status === 'loading')) {
        if (observer) observer.disconnect();
        if (!audioPlayers.length && !videos.length) forgetView(state);
      }
    };
    function syncVideo(item) {
      if (!options.inlineVideo) return;
      const visible = item.visible && !disposed && isLiveRow() && !document.hidden && !document.querySelector('.pablicusMediaViewer[open]') && !root.closest('[hidden],[inert]');
      if (visible && item.status === 'ready') item.video.play().catch(() => {});
      else item.video.pause();
    }

    async function loadImage(item) {
      if (disposed || !isLiveRow() || item.status === 'loading' || item.status === 'ready') return;
      item.status = 'loading';
      item.button.classList.remove('richMediaError');
      item.statusNode.textContent = 'Загрузка фото…';
      if (observer) observer.unobserve(item.button);
      try {
        if (typeof options.resolveUrl !== 'function') throw new Error('Media resolver is unavailable');
        const warm = options.peekUrl?.(item.block.path || item.block.assetId || item.block.id, item.block);
        const box=item.button.getBoundingClientRect();
        const resolved = warm || await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block,{priority:box.bottom>0&&box.top<innerHeight?0:2});
        if (disposed || !isLiveRow()) return;
        const url = safeResolvedUrl(resolved);
        if (!url) throw new Error('Invalid media URL');
        item.image.onload = () => {
          if (disposed || !isLiveRow()) return;
          item.status = 'ready';
          fitChatImage(item.button,item.image,item.block);
          item.button.classList.add('richImageReady');
          item.statusNode.textContent = '';
          releaseObserverWhenFinished();
          notifyResize();
        };
        item.image.onerror = () => imageFailed(item);
        item.image.src = url;
      } catch (_) { imageFailed(item); }
    }

    async function loadVideo(item) {
      if (disposed || !isLiveRow() || item.status === 'loading' || item.status === 'ready') return;
      item.status = 'loading';
      item.statusNode.textContent = 'Загрузка видео…';
      try {
        if (typeof options.resolveUrl !== 'function') throw new Error('Media resolver is unavailable');
        const warm = options.peekUrl?.(item.block.path || item.block.assetId || item.block.id, item.block);
        const resolved = warm || await options.resolveUrl(item.block.path || item.block.assetId || item.block.id, item.block);
        if (disposed || !isLiveRow()) return;
        const url = safeResolvedUrl(resolved);
        if (!url) throw new Error('Invalid media URL');
        item.video.src = url;
        item.video.load();
        item.status = 'ready';
        item.container.classList.add('richVideoReady');
        item.statusNode.textContent = '';
        syncVideo(item);
        releaseObserverWhenFinished();
        notifyResize();
      } catch (_) {
        if (disposed) return;
        item.status = 'failed';
        item.container.classList.add('richMediaError');
        item.statusNode.textContent = 'Видео не загрузилось. Нажмите, чтобы повторить.';
        releaseObserverWhenFinished();
      }
    }

    function imageFailed(item) {
      if (disposed) return;
      item.status = 'failed';
      item.image.removeAttribute('src');
      item.button.classList.remove('richImageReady');
      item.button.classList.add('richMediaError');
      item.statusNode.textContent = 'Фото не загрузилось. Нажмите, чтобы повторить.';
      releaseObserverWhenFinished();
    }

    async function openBlock(block, button, statusNode, gallery) {
      if (disposed || !isLiveRow() || button.disabled) return;
      if (typeof options.openMedia !== 'function') {
        statusNode.textContent = 'Вложение пока недоступно.';
        notifyResize();
        return;
      }
      button.disabled = true;
      try {
        await options.openMedia(block, gallery);
        if (!disposed) statusNode.textContent = '';
      } catch (_) {
        if (!disposed) statusNode.textContent = 'Не удалось открыть. Нажмите, чтобы повторить.';
      } finally { button.disabled = false; notifyResize(); }
    }

    function renderAudio(block) {
      const container = element('div', 'richMedia richMedia-audio');
      container.dataset.blockId = block.id;
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', LABELS.audio);
      const audio = element('audio', 'richAudioElement');
      audio.preload = 'none';
      audio.setAttribute('playsinline', '');
      // Lucide play/pause/corner-up-left paths (ISC); keep one consistent 24px grid.
      const audioIcon = (name) => {
        if (scope.PablicusMessageMenu?.icon) return scope.PablicusMessageMenu.icon(name);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        const paths = name === 'pause' ? ['M9 4H5v16h4z', 'M19 4h-4v16h4z'] : name === 'reply' ? ['m9 14-5-5 5-5', 'M4 9h10a6 6 0 0 1 6 6v5'] : ['m6 3 14 9-14 9V3Z'];
        for (const d of paths) { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }
        return svg;
      };
      const play = element('button', 'richAudioPlay');
      const playIcon = audioIcon('play'), pauseIcon = audioIcon('pause');
      playIcon.classList.add('richAudioPlayIcon'); pauseIcon.classList.add('richAudioPauseIcon');
      play.append(playIcon, pauseIcon);
      play.type = 'button';
      const info = element('div', 'richAudioInfo');
      const timeline = element('div', 'richAudioTimeline');
      const track = element('div', 'richAudioTrack');
      const wave = element('div', 'richAudioWave');
      const progress = element('div', 'richAudioWaveProgress');
      const cursor = element('span', 'richAudioCursor');
      for (const node of [track, wave, progress, cursor]) node.setAttribute('aria-hidden', 'true');
      const seek = element('input', 'richAudioSeek');
      seek.type = 'range'; seek.min = '0'; seek.max = '1000'; seek.step = '1'; seek.value = '0';
      seek.disabled = true;
      seek.setAttribute('aria-label', 'Перемотать голосовое сообщение');
      const footer = element('div', 'richAudioFooter');
      const time = element('span', 'richAudioTime');
      const status = element('span', 'richAudioStatus');
      status.setAttribute('role', 'status');
      footer.append(time);
      timeline.append(track, wave, progress, cursor, seek);
      info.append(timeline, footer, status);
      container.append(play, info, audio);
      if (typeof options.onReply === 'function') {
        const reply = element('button', 'richAudioReply');
        reply.append(audioIcon('reply'));
        reply.type = 'button';
        reply.setAttribute('aria-label', 'Ответить на голосовое сообщение');
        reply.title = 'Ответить на голосовое сообщение';
        reply.addEventListener('click', event => {
          event.stopPropagation();
          if (!disposed && isLiveRow()) options.onReply(block);
        });
        container.append(reply);
      }
      let epoch = 0, loading = false, resolvedUrl = null;
      let waveformAbort = null, waveformDone = false, decodedDuration = 0;
      // Never invent a signal. Until actual PCM samples are decoded, show a slim
      // progress line. Bound this optional visual work; playback never waits for it.
      async function loadWaveform(url) {
        const Decoder = scope.OfflineAudioContext || scope.webkitOfflineAudioContext;
        const maxBytes = 8 * 1024 * 1024;
        if (waveformDone || waveformAbort || !Decoder || !scope.fetch || block.size > maxBytes || block.duration > 180) return;
        const controller = new scope.AbortController();
        waveformAbort = controller;
        const stillCurrent = () => !disposed && isLiveRow() && waveformAbort === controller && !controller.signal.aborted;
        try {
          const response = await scope.fetch(url, { signal: controller.signal });
          if (!response.ok || Number(response.headers.get('content-length')) > maxBytes) return;
          let bytes;
          if (response.body?.getReader) {
            const reader = response.body.getReader(), chunks = [];
            let size = 0;
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.byteLength;
              if (size > maxBytes || !stillCurrent()) { await reader.cancel(); return; }
              chunks.push(part.value);
            }
            bytes = new Uint8Array(size); let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          } else {
            bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.byteLength > maxBytes) return;
          }
          if (!stillCurrent()) return;
          const decoder = new Decoder(1, 1, 16000);
          const decoded = await decoder.decodeAudioData(bytes.buffer);
          if (!stillCurrent() || !decoded.length || decoded.duration > 180) return;
          decodedDuration = decoded.duration;
          const count = 40, values = [], samples = decoded.getChannelData(0);
          for (let bar = 0; bar < count; bar++) {
            const from = Math.floor(bar * samples.length / count), to = Math.floor((bar + 1) * samples.length / count);
            let square = 0;
            for (let i = from; i < to; i++) square += samples[i] * samples[i];
            values.push(Math.sqrt(square / Math.max(1, to - from)));
          }
          const max = Math.max(...values);
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 160 28'); svg.setAttribute('preserveAspectRatio', 'none');
          for (let index = 0; index < values.length; index++) {
            const height = max > 0 ? Math.max(1.5, Math.sqrt(values[index] / max) * 26) : 1.5;
            const bar = document.createElementNS(svg.namespaceURI, 'rect');
            bar.setAttribute('x', String(index * 4 + 0.8)); bar.setAttribute('width', '2.4');
            bar.setAttribute('y', String((28 - height) / 2)); bar.setAttribute('height', String(height)); bar.setAttribute('rx', '1.2');
            svg.append(bar);
          }
          wave.replaceChildren(svg); progress.replaceChildren(svg.cloneNode(true));
          container.classList.add('richAudioHasWave'); waveformDone = true; sync();
        } catch (_) {
          // Unsupported audio codecs/CORS/offline: the real seek track remains usable.
        } finally { if (waveformAbort === controller) waveformAbort = null; }
      }
      const duration = () => {
        // Do not query a native timeline before metadata exists. Some media
        // engines recalculate an unknown stream's duration when seekable is
        // read; asking during initial loading can turn its length into zero.
        if (audio.readyState >= 1) {
          const nativeDuration = audio.duration;
          if (Number.isFinite(nativeDuration) && nativeDuration > 0) return nativeDuration;
        }
        if (decodedDuration > 0) return decodedDuration;
        if (block.duration > 0) return block.duration;
        return 0;
      };
      const clock = seconds => readableDuration(Math.max(0, seconds)) || '0:00';
      // Decoded PCM can describe the waveform even when the native player is
      // an unseekable stream. Only its own timeline permits changing position.
      const canSeek = () => {
        if (!resolvedUrl || audio.readyState < 1) return false;
        const nativeDuration = audio.duration;
        if (!Number.isFinite(nativeDuration) || nativeDuration <= 0) return false;
        const ranges = audio.seekable;
        return ranges.length > 0 && ranges.end(ranges.length - 1) > ranges.start(ranges.length - 1);
      };
      function sync() {
        const length = duration();
        const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        seek.disabled = !canSeek();
        seek.value = String(length > 0 ? Math.min(1000, Math.round(position / length * 1000)) : 0);
        seek.setAttribute('aria-valuetext', clock(position) + (length ? ' из ' + clock(length) : ''));
        time.textContent = clock(position) + (length ? ' / ' + clock(length) : '');
        container.style.setProperty('--voice-progress', seek.value / 10 + '%');
        play.setAttribute('aria-label', loading ? 'Отменить загрузку голосового сообщения' : audio.paused ? 'Воспроизвести голосовое сообщение' : 'Приостановить голосовое сообщение');
        play.setAttribute('aria-pressed', String(!audio.paused));
        container.classList.toggle('richAudioPlaying', !audio.paused);
        container.classList.toggle('richAudioLoading', loading);
      }
      function stop(release) {
        ++epoch;
        loading = false;
        audio.pause();
        if (activeAudio === player) activeAudio = null;
        if (release) {
          resolvedUrl = null;
          waveformAbort?.abort(); waveformAbort = null;
          audio.removeAttribute('src');
          audio.load();
          status.textContent = '';
        }
        sync();
      }
      function failed(error, operation) {
        if (disposed || operation !== epoch) return;
        loading = false;
        if (activeAudio === player) activeAudio = null;
        // iOS may require another gesture after a network lookup. Keep the URL so
        // that the retry calls play() synchronously from the next button tap.
        status.textContent = error?.name === 'NotAllowedError' ? 'Нажмите ▶ для воспроизведения' : 'Не удалось воспроизвести. Повторить ▶';
        sync();
      }
      function start(operation) {
        if (disposed || !isLiveRow() || operation !== epoch || activeAudio !== player) return;
        loading = false;
        let result;
        try {
          // A completed voice starts from its beginning on the next explicit tap.
          if (audio.ended) audio.currentTime = 0;
          result = audio.play();
        } catch (error) { failed(error, operation); return; }
        if (result && typeof result.catch === 'function') result.catch(error => failed(error, operation));
        if (resolvedUrl) loadWaveform(resolvedUrl);
        sync();
      }
      function toggle(event) {
        event?.stopPropagation();
        if (disposed || !isLiveRow()) return;
        rememberView(state);
        if (loading || !audio.paused) { stop(false); status.textContent = ''; return; }
        if (activeAudio && activeAudio !== player) activeAudio.stop(false);
        activeAudio = player;
        const operation = ++epoch;
        status.textContent = '';
        if (resolvedUrl) { start(operation); return; }
        loading = true; sync();
        Promise.resolve().then(() => {
          if (typeof options.resolveUrl !== 'function') throw new Error('Media resolver is unavailable');
          return options.resolveUrl(block.path || block.assetId || block.id, block);
        }).then(value => {
          if (disposed || !isLiveRow() || operation !== epoch || activeAudio !== player) return;
          const url = safeResolvedUrl(value);
          if (!url) throw new Error('Invalid media URL');
          resolvedUrl = url;
          audio.src = url;
          start(operation);
        }).catch(error => failed(error, operation));
      }
      const player = { stop };
      audioPlayers.push(player);
      play.addEventListener('click', toggle);
      container.addEventListener('click', event => {
        if (event.target.closest('button,input,audio')) return;
        toggle(event);
      });
      seek.addEventListener('click', event => event.stopPropagation());
      seek.addEventListener('input', event => {
        event.stopPropagation();
        const length = duration();
        if (!disposed && isLiveRow() && canSeek() && length > 0) {
          audio.currentTime = Number(seek.value) / 1000 * length;
          sync();
        }
      });
      for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'progress', 'pause', 'play', 'ended']) audio.addEventListener(event, sync);
      audio.addEventListener('error', () => {
        if (!disposed && resolvedUrl) {
          resolvedUrl = null;
          failed(new Error('Audio unavailable'), epoch);
        }
      });
      sync();
      return container;
    }

    const displayBlocks = [];
    for (const item of groupBlocks(checked.content.blocks)) {
      if (item.type !== 'gallery') { displayBlocks.push({ block: item, parent: root }); continue; }
      const tiles = element('div', 'richMediaGallery');
      tiles.dataset.count = String(item.blocks.length);
      if (item.blocks.length > 4) tiles.dataset.expanded = 'true';
      tiles.setAttribute('role', 'group');
      tiles.setAttribute('aria-label', 'Фото и видео: ' + item.blocks.length);
      for (const [index, block] of item.blocks.entries()) {
        displayBlocks.push({ block, parent: tiles, gallery: { items: item.blocks, index } });
      }
    }
    for (const { block, parent, gallery } of displayBlocks) {
      if (parent !== root && !parent.parentNode) root.append(parent);
      if (block.type === 'text') {
        const text = element('div', 'richText', block.text);
        if (options.linkify) {
          text.replaceChildren();
          const pattern = /https?:\/\/[^\s<>]+/gu;
          let offset = 0;
          for (const match of block.text.matchAll(pattern)) {
            const value = match[0].replace(/[.,!?;:]+$/u, '');
            const href = safeResolvedUrl(value);
            if (!href) continue;
            text.append(document.createTextNode(block.text.slice(offset, match.index)));
            const link = element('a', 'richTextLink', value);
            link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
            text.append(link); offset = match.index + value.length;
          }
          text.append(document.createTextNode(block.text.slice(offset)));
        }
        text.dataset.blockId = block.id;
        root.append(text);
        continue;
      }
      root.classList.add('richMessageHasMedia');
      if (block.type === 'audio') {
        root.append(renderAudio(block));
        continue;
      }
      if (block.type === 'video' && (options.naturalMedia || options.inlineVideo)) {
        const container = element('div', 'richMedia richMedia-video richNaturalMedia');
        container.dataset.blockId = block.id;
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', 'Видео');
        const video = element('video', 'richVideo');
        video.controls = !options.inlineVideo;
        if (options.inlineVideo) {video.muted=true;video.defaultMuted=true;video.loop=true;container.classList.add('richInlineVideo');container.tabIndex=0;container.setAttribute('role','button');container.setAttribute('aria-label','Открыть видео');video.tabIndex=-1;}
        video.draggable = false;container.draggable = false;
        video.playsInline = true;
        video.preload = 'metadata';
        if (block.width > 0 && block.height > 0) {
          video.width = Math.round(block.width);
          video.height = Math.round(block.height);
          setMediaDimensions(container,block.width,block.height);
        }
        const statusNode = element('span', 'richMediaStatus', 'Загрузка видео…');
        statusNode.setAttribute('role', 'status');
        container.append(video, statusNode);
        const item = {block, container, video, statusNode, status: 'waiting'};
        videos.push(item);
        video.addEventListener('error', () => {
          if (disposed || item.status === 'failed') return;
          item.status = 'failed';
          container.classList.add('richMediaError');
          statusNode.textContent = 'Видео не загрузилось. Нажмите, чтобы повторить.';
          releaseObserverWhenFinished();
        });
        video.addEventListener('loadedmetadata', () => {setMediaDimensions(container,video.videoWidth,video.videoHeight);notifyResize();syncVideo(item);});
        video.addEventListener('canplay', () => syncVideo(item));
        container.addEventListener('keydown',event=>{if(options.inlineVideo&&(event.key==='Enter'||event.key===' ')){event.preventDefault();container.click();}});
        container.addEventListener('click', event => {
          if (options.inlineVideo) {event.stopPropagation();if(item.status==='failed'){item.status='waiting';container.classList.remove('richMediaError');loadVideo(item);}else openBlock(block,container,statusNode,gallery);return;}
          if (event.target === video || event.target.closest('video')) return;
          if (item.status === 'failed') { item.status = 'waiting'; container.classList.remove('richMediaError'); loadVideo(item); }
        });
        parent.append(container);
        continue;
      }
      const button = element('button', 'richMedia richMedia-' + block.type);
      button.type = 'button';
      button.dataset.blockId = block.id;
      button.setAttribute('aria-label', 'Открыть: ' + (attachmentLabel(block)));
      const statusNode = element('span', 'richMediaStatus');
      statusNode.setAttribute('role', 'status');
      if (block.type === 'image') {
        const image = element('img', 'richImage');
        image.alt = attachmentLabel(block);
        image.draggable = false;button.draggable = false;
        image.loading = 'eager'; // IntersectionObserver owns scheduling; visibility changes on load.
        image.decoding = 'async';
        if (block.width > 0 && block.height > 0) {
          setMediaDimensions(button,block.width,block.height);
          image.width = Math.round(block.width);
          image.height = Math.round(block.height);
        }
        statusNode.textContent = 'Фото';
        button.append(image, statusNode);
        const item = { block, button, image, statusNode, gallery, status: 'waiting' };
        images.push(item);
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (item.status === 'failed' && !gallery) loadImage(item);
          else openBlock(block, button, statusNode, gallery);
        });
      } else {
        const icon = element('span', 'richMediaIcon', block.type === 'video' ? '▶' : '▤');
        icon.setAttribute('aria-hidden', 'true');
        const label = element('span', 'richMediaInfo');
        label.append(element('span', 'richMediaTitle', attachmentLabel(block)));
        const details = [LABELS[block.type], readableDuration(block.duration), readableSize(block.size)].filter(Boolean);
        label.append(element('span', 'richMediaDetails', details.join(' · ')));
        label.append(statusNode);
        button.append(icon, label);
        button.addEventListener('click', event => { event.stopPropagation(); openBlock(block, button, statusNode, gallery); });
      }
      parent.append(button);
    }

    function activate() {
      if (disposed || initialized || !isLiveRow()) return;
      initialized = true;
      if (audioPlayers.length) rememberView(state);
      if (images.length || videos.length) {
        rememberView(state);
        if (options.inlineVideo && videos.length) {
          const sync=()=>{for(const item of videos)syncVideo(item);};
          document.addEventListener('visibilitychange',sync,{signal:videoLife.signal});
          document.addEventListener('pablicus:media-viewer',sync,{signal:videoLife.signal});
          if(scope.IntersectionObserver){playbackObserver=new scope.IntersectionObserver(entries=>{for(const e of entries){const item=videos.find(v=>v.container===e.target);if(item){item.visible=e.isIntersecting&&e.intersectionRatio>=.25;syncVideo(item);}}},{threshold:[0,.25]});for(const item of videos)playbackObserver.observe(item.container);}
          else for(const item of videos)item.visible=true;
        }
        if (scope.IntersectionObserver) {
          observer = new scope.IntersectionObserver(entries => {
            for (const entry of entries) if (entry.isIntersecting) {
              const item = images.find(candidate => candidate.button === entry.target);
              if (item) { loadImage(item); continue; }
              const video = videos.find(candidate => candidate.container === entry.target);
              if (video) loadVideo(video);
            }
          }, { rootMargin: '120px' });
          for (const item of images) observer.observe(item.button);
          for (const item of videos) observer.observe(item.container);
        } else {
          // Native lazy image loading still applies on older browsers.
          for (const item of images) loadImage(item);
          for (const item of videos) loadVideo(item);
        }
      }
      notifyResize();
    }
    // Virtualized lists append synchronously. A host mounting later may call activate().
    root.activate = activate;
    root.dispose = state.dispose;
    mountFrame = frame(() => { mountFrame = null; activate(); });
    return root;
  }

  const api = Object.freeze({setMediaDimensions,fitChatImage,prepareChatBubble, render, validate, textContent, groupBlocks, stopAll, readableName, attachmentLabel });
  scope.PablicusRichMessage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
