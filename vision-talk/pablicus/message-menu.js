/* Compact, anchored actions for a message. No data mutations live in this UI module.
 * Icons adapted from Lucide, https://github.com/lucide-icons/lucide (ISC).
 * Copyright (c) 2026 Lucide Icons and Contributors.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Some Lucide icons derive from Feather (MIT), Copyright (c)
 * 2013-present Cole Bemis. Permission is hereby granted, free of charge, to
 * any person obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to
 * the following conditions: The above copyright notice and this permission
 * notice shall be included in all copies or substantial portions of the
 * Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function (scope) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    archive: [['rect',{x:3,y:3,width:18,height:4,rx:1}],['path',{d:'M5 7v13h14V7M10 11h4'}]],
    volume: [['path',{d:'M11 4 6 8H3v8h3l5 4V4M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14'}]],
    volumeOff: [['path',{d:'M11 4 6 8H3v8h3l5 4V4M16 9l5 6M21 9l-5 6'}]],
    outbox: [['path',{d:'M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M4 14h5l1 2h4l1-2h5M12 12V3M8 7l4-4 4 4'}]],
    copy: [['rect', {width:14,height:14,x:8,y:8,rx:2,ry:2}], ['path', {d:'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'}]],
    pin: [['path', {d:'M12 17v5'}], ['path', {d:'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z'}]],
    forward: [['path', {d:'m15 17 5-5-5-5'}], ['path', {d:'M4 18v-2a4 4 0 0 1 4-4h12'}]],
    "reply": [["path",{"d":"M20 18v-2a4 4 0 0 0-4-4H4"}],["path",{"d":"m9 17-5-5 5-5"}]],
    "edit": [["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],
    "select": [["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16 9-5.5 5.5L8 12"}]],
    "download": [["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]],
    "search": [["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],
    "compose": [["path",{"d":"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"}],["path",{"d":"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"}]],
    "chats": [["path",{"d":"M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"}],["path",{"d":"M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"}]],
    "feed": [["path",{"d":"M3 5h.01"}],["path",{"d":"M3 12h.01"}],["path",{"d":"M3 19h.01"}],["path",{"d":"M8 5h13"}],["path",{"d":"M8 12h13"}],["path",{"d":"M8 19h13"}]],
    "tasks": [["path",{"d":"M13 5h8"}],["path",{"d":"M13 12h8"}],["path",{"d":"M13 19h8"}],["path",{"d":"m3 17 2 2 4-4"}],["path",{"d":"m3 7 2 2 4-4"}]],
    "bots": [["rect",{"x":"4","y":"7","width":"16","height":"13","rx":"4"}],["path",{"d":"M12 7V3m-2 0h4M8 12v2m8-2v2M9 17h6M2 11v5m20-5v5"}]],
    "agent": [["path",{"d":"m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"}]],
    "profile": [["circle",{"cx":"12","cy":"8","r":"5"}],["path",{"d":"M20 21a8 8 0 0 0-16 0"}]],
    "back": [["path",{"d":"m12 19-7-7 7-7"}],["path",{"d":"M19 12H5"}]],
    "plus": [["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],
    "microphone": [["path",{"d":"M12 19v3"}],["path",{"d":"M19 10v2a7 7 0 0 1-14 0v-2"}],["rect",{"x":"9","y":"2","width":"6","height":"13","rx":"3"}]],
    "send": [["path",{"d":"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{"d":"m21.854 2.147-10.94 10.939"}]],
    "check": [["path",{"d":"M20 6 9 17l-5-5"}]],
    "close": [["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],
    "share": [["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]],
    "users": [["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]],
    "delete": [["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],
    "play": [["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]],
    "pause": [["rect",{"x":"14","y":"3","width":"5","height":"18","rx":"1"}],["rect",{"x":"5","y":"3","width":"5","height":"18","rx":"1"}]],
    "corner-up-left": [["path",{"d":"M20 20v-7a4 4 0 0 0-4-4H4"}],["path",{"d":"M9 14 4 9l5-5"}]],
  };

  function icon(name) {
    if(scope.PablicusIcons?.has(name))return scope.PablicusIcons.icon(name);
    const document = scope.document;
    const svg = document.createElementNS(NS, 'svg');
    for (const [key, value] of Object.entries({viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'})) svg.setAttribute(key,value);
    for (const [tag, attributes] of ICONS[name] || ICONS.reply) {
      const child = document.createElementNS(NS,tag);
      for (const [key,value] of Object.entries(attributes)) child.setAttribute(key,value);
      svg.append(child);
    }
    return svg;
  }

  function create(options = {}) {
    const document = scope.document;
    if (!document?.body) throw new Error('Для меню нужен DOM.');
    const node = (tag, className) => {
      const el = document.createElement(tag); el.className = className; return el;
    };
    const root = node('div', 'pablicusMessageMenu');
    root.hidden = true; root.setAttribute('aria-label','Действия с сообщением');
    root.setAttribute('popover','manual');
    const backdrop = node('div','pmmBackdrop'), preview = node('div','pmmPreview');
    backdrop.hidden = preview.hidden = true; preview.setAttribute('aria-hidden','true');
    const reactions = node('div', 'pmmReactions');
    reactions.setAttribute('role','group'); reactions.setAttribute('aria-label','Реакция на сообщение');
    const list = node('div', 'pmmActions'); list.setAttribute('role','menu'); list.setAttribute('aria-label','Действия с сообщением');
    const content = node('div','pmmContent'); content.hidden = true;
    root.append(backdrop,reactions,preview,content,list); document.body.append(root);
    let config = null, previousFocus = null, destroyed = false, opened = false, positionFrame = 0;
    let anchorAria = null, pointOffset = null, oldOverflow = null, blurStyle = null;
    const viewport = () => {
      const vv = scope.visualViewport;
      return {left:vv?.offsetLeft || 0,top:vv?.offsetTop || 0,width:vv?.width || scope.innerWidth,height:vv?.height || scope.innerHeight};
    };
    const enabledButtons = () => [...root.querySelectorAll('button:not(:disabled)')].filter(b=>!b.closest('[hidden],.pmmPreview'));
    // A static visual copy keeps the selected message crisp above the backdrop.
    // It has no IDs, focus targets or live media, and cannot trigger content actions.
    function snapshot(anchor) {
      const original = anchor;
      const copy = original.cloneNode(true);
      const sources = [original,...original.querySelectorAll('*')];
      const copies = [copy,...copy.querySelectorAll('*')];
      sources.forEach((source,i)=>{
        const target=copies[i], style=scope.getComputedStyle(source);
        for(const name of style) target.style.setProperty(name,style.getPropertyValue(name),'important');
        target.removeAttribute('id'); target.removeAttribute('autofocus'); target.removeAttribute('popover');
        target.removeAttribute('srcset'); target.tabIndex=-1;
        target.style.setProperty('pointer-events','none','important');
        target.style.setProperty('animation','none','important');
        target.style.setProperty('transition','none','important');
        if(source.tagName==='VIDEO'){
          const canvas=document.createElement('canvas');canvas.width=source.videoWidth||1;canvas.height=source.videoHeight||1;
          canvas.style.cssText=target.style.cssText;
          try{canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height)}catch{}
          target.replaceWith(canvas);
        }else if(source.tagName==='AUDIO'){target.removeAttribute('src');target.replaceChildren()}
      });
      // Reset both logical and physical geometry; copied percentages otherwise
      // resolve against the narrower preview and shrink the message a second time.
      for(const [name,value] of Object.entries({position:'relative',inset:'auto',margin:'0',width:'100%','inline-size':'100%','max-width':'none','max-inline-size':'none','min-width':'0','min-inline-size':'0',height:'auto','block-size':'auto',transform:'none'}))copy.style.setProperty(name,value,'important');
      preview.replaceChildren(copy);
    }
    function positionSpotlight(box,bounds) {
      const gap=8, width=Math.min(380,box.width-24), right=!!config.anchor.closest('.mine')||bounds.left+bounds.width/2>box.left+box.width/2;
      root.style.cssText=`left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;max-height:none`;
      reactions.style.width=width+'px';list.style.width=Math.min(230,width)+'px';
      const reactionHeight=reactions.hidden?0:reactions.getBoundingClientRect().height;
      list.style.maxHeight=Math.max(100,box.height-reactionHeight-100)+'px';
      const actionHeight=list.getBoundingClientRect().height;
      const previewHeight=Math.max(40,Math.min(bounds.height,box.height-reactionHeight-actionHeight-48));
      const original=config.previewTarget||config.anchor;
      const rowBounds=original.getBoundingClientRect();
      preview.style.width=Math.min(rowBounds.width,box.width-24)+'px';preview.style.maxHeight=previewHeight+'px';
      const ph=Math.min(preview.getBoundingClientRect().height,previewHeight);
      const total=reactionHeight+ph+actionHeight+gap*2;
      const top=Math.max(12,Math.min(bounds.top-box.top-reactionHeight-gap,box.height-total-12));
      const x=right?box.width-12-width:12;
      reactions.style.left=x+'px';reactions.style.top=top+'px';
      preview.style.left=Math.max(12,Math.min(rowBounds.left-box.left,box.width-12-preview.getBoundingClientRect().width))+'px';
      preview.style.top=(top+reactionHeight+gap)+'px';
      list.style.left=(right?box.width-12-list.getBoundingClientRect().width:12)+'px';
      list.style.top=(top+reactionHeight+gap+ph+gap)+'px';
    }
    function position() {
      positionFrame = 0;
      if (!opened || !config) return;
      if (!config.anchor?.isConnected) { close({restoreFocus:false}); return; }
      const box = viewport(), gap = 8;
      const bounds = (config.previewTarget||config.anchor).getBoundingClientRect();
      if(bounds.bottom < box.top || bounds.top > box.top+box.height) { close({restoreFocus:false}); return; }
      if(config.spotlight){positionSpotlight(box,bounds);return}
      const px = pointOffset ? bounds.left+pointOffset.x : null;
      const py = pointOffset ? bounds.top+pointOffset.y : null;
      const width = Math.max(0, Math.min(config.content ? 300 : 220, box.width - gap*2));
      const maxHeight = Math.max(0,box.height - gap*2);
      root.style.width = width+'px'; root.style.maxHeight = maxHeight+'px';
      const height = Math.min(root.getBoundingClientRect().height,maxHeight);
      const insideTop = box.top+gap, insideBottom = box.top+box.height-gap;
      const targetTop = py !== null ? py : Math.max(insideTop,bounds.top);
      const targetBottom = py !== null ? py : Math.min(insideBottom,bounds.bottom);
      const below = insideBottom-targetBottom-gap, above = targetTop-insideTop-gap;
      let top = below >= height || below >= above ? targetBottom+gap : targetTop-height-gap;
      top = Math.max(insideTop,Math.min(top,insideBottom-height));
      let left = px !== null ? px-16 : bounds.left;
      left = Math.max(box.left+gap,Math.min(left,box.left+box.width-gap-width));
      root.style.left = left+'px'; root.style.top = top+'px';
    }
    function schedulePosition() {
      if (opened && !positionFrame) positionFrame = scope.requestAnimationFrame(position);
    }
    function close({restoreFocus = true} = {}) {
      if (!opened) return;
      opened = false;
      const anchor = config?.anchor, focus = previousFocus;
      if (positionFrame) scope.cancelAnimationFrame(positionFrame);
      positionFrame = 0;
      if (typeof root.hidePopover === 'function' && root.matches(':popover-open')) root.hidePopover();
      root.hidden = true;
      if(oldOverflow!==null){document.body.style.overflow=oldOverflow;oldOverflow=null}
      blurStyle?.remove();blurStyle=null;
      (config.previewTarget||anchor)?.classList.remove('pmmSourceHidden');
      root.classList.remove('pmmSpotlight');root.removeAttribute('style');
      for(const n of [reactions,list,preview])n.removeAttribute('style');
      preview.replaceChildren();backdrop.hidden=preview.hidden=true;
      anchor?.classList.remove('pablicusMessageMenuAnchor');
      if (anchor && anchorAria) {
        for (const [key, value] of Object.entries(anchorAria)) {
          if (value === null) anchor.removeAttribute(key); else anchor.setAttribute(key,value);
        }
      }
      config = null; previousFocus = null; anchorAria = null; pointOffset = null;
      root.replaceChildren(backdrop,reactions,preview,content,list); reactions.replaceChildren();reactions.classList.remove('pmmExpanded'); content.replaceChildren(); content.hidden = true; list.replaceChildren();
      if (restoreFocus) {
        const target = focus?.isConnected ? focus : anchor?.isConnected ? anchor : null;
        target?.focus?.({preventScroll:true});
      }
    }
    async function invoke(callback, argument, errorHandler) {
      close({restoreFocus:false});
      try { await callback(argument); }
      catch (error) { if (typeof errorHandler === 'function') errorHandler(error); }
    }
    function open(next) {
      if (destroyed) throw new Error('Меню уже удалено.');
      if (!next?.anchor?.isConnected) return;
      if (opened) close({restoreFocus:false});
      config = next; previousFocus = document.activeElement;
      if(Number.isFinite(next.point?.x) && Number.isFinite(next.point?.y)) {
        const bounds=next.anchor.getBoundingClientRect(); pointOffset={x:next.point.x-bounds.left,y:next.point.y-bounds.top};
      }
      root.setAttribute('aria-label',next.title || 'Действия с сообщением');
      anchorAria = {'aria-expanded':next.anchor.getAttribute('aria-expanded'),'aria-haspopup':next.anchor.getAttribute('aria-haspopup')};
      next.anchor.setAttribute('aria-haspopup','menu'); next.anchor.setAttribute('aria-expanded','true');
      next.anchor.classList.add('pablicusMessageMenuAnchor');
      const onError = next.onError || options.onError;
      const addReaction = item => {
        if (typeof next.onReaction !== 'function') return;
        const value = typeof item === 'string' ? {id:item,emoji:item,label:item} : item;
        if (!value || typeof value.emoji !== 'string') return;
        const button = node('button','pmmReaction'); button.type = 'button'; button.textContent = value.emoji;
        button.dataset.reactionId = String(value.id ?? value.emoji);
        button.setAttribute('aria-label',value.label || value.emoji);
        button.setAttribute('aria-pressed',value.selected ? 'true' : 'false');
        button.onclick = () => invoke(next.onReaction,value.id ?? value.emoji,onError);
        reactions.append(button);
      };
      for(const item of next.reactions||[])addReaction(item);
      if(next.moreReactions?.length){
        const more=node('button','pmmReaction pmmMore');more.type='button';more.append(icon('plus'));more.setAttribute('aria-label','Ещё реакции');more.setAttribute('aria-expanded','false');
        more.onclick=()=>{const expanded=more.getAttribute('aria-expanded')==='true';more.setAttribute('aria-expanded',String(!expanded));reactions.classList.toggle('pmmExpanded',!expanded);
          if(expanded)reactions.querySelectorAll('[data-extra]').forEach(n=>n.remove());
          else for(const item of next.moreReactions){addReaction(item);reactions.lastElementChild.dataset.extra=''}
          position();};reactions.append(more);
      }
      reactions.hidden = !reactions.childElementCount;
      if (next.content?.nodeType === 1) { content.append(next.content); content.hidden = false; }
      for (const action of Array.isArray(next.actions) ? next.actions : []) {
        if (!action || typeof action.onSelect !== 'function') continue;
        const button = node('button','pmmAction'); button.type = 'button';
        button.setAttribute('role','menuitem'); button.dataset.action = String(action.id || '');
        if (action.danger) button.classList.add('pmmDanger');
        if (action.separator) button.classList.add('pmmSeparated');
        const label = node('span','pmmLabel'); label.textContent = action.label || '';
        button.append(icon(action.icon || action.id),label);
        button.onclick = () => invoke(action.onSelect,action.id,onError);
        list.append(button);
      }
      if (!list.childElementCount && !reactions.childElementCount && !content.childElementCount) {
        opened = true; close({restoreFocus:false}); return;
      }
      if(next.spotlight){root.classList.add('pmmSpotlight');backdrop.hidden=preview.hidden=false;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';snapshot(next.previewTarget||next.anchor);(next.previewTarget||next.anchor).classList.add('pmmSourceHidden');}
      opened = true; root.hidden = false;
      if (typeof root.showPopover === 'function') root.showPopover();
      if(next.spotlight)scope.setTimeout(()=>{
        if(!opened||config!==next)return;
        // WebKit needs both the app and its composited children blurred above its glass surfaces.
        blurStyle=node('style');blurStyle.textContent='#app{filter:blur(16px)!important;transform:translateZ(0)!important}#app>*{filter:blur(12px)!important}#app *,#app *::before,#app *::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';document.head.append(blurStyle);
      },180);
      position();
      const first = content.querySelector('textarea,input,select,button,[tabindex="0"]') || list.querySelector('button') || reactions.querySelector('button');
      first?.focus({preventScroll:true});
      schedulePosition();
    }
    function onPointerDown(event) {
      if(opened && (event.target===backdrop || event.target===root && config.spotlight)){event.preventDefault();event.stopPropagation();close({restoreFocus:false});return}
      if (opened && !root.contains(event.target)) close({restoreFocus:false});
    }
    function onKeyDown(event) {
      if (!opened) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (config.content) {
        if (event.key === 'Tab') {
          const controls = [...root.querySelectorAll('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el=>!el.hidden);
          const first = controls[0], last = controls[controls.length-1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        return;
      }
      if (event.key === 'Tab') { close({restoreFocus:false}); return; }
      const buttons = enabledButtons();
      if (!buttons.length) return;
      let index = buttons.indexOf(document.activeElement);
      if (['ArrowDown','ArrowRight'].includes(event.key)) index = (index+1)%buttons.length;
      else if (['ArrowUp','ArrowLeft'].includes(event.key)) index = (index-1+buttons.length)%buttons.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = buttons.length-1;
      else return;
      event.preventDefault(); buttons[index].focus({preventScroll:true}); buttons[index].scrollIntoView({block:'nearest'});
    }
    function onScroll(event) {
      if (opened && !root.contains(event.target)) schedulePosition();
    }
    function destroy() {
      close({restoreFocus:false}); destroyed = true;
      document.removeEventListener('pointerdown',onPointerDown,true);
      document.removeEventListener('keydown',onKeyDown,true);
      document.removeEventListener('scroll',onScroll,true);
      scope.removeEventListener('resize',schedulePosition);
      scope.visualViewport?.removeEventListener('resize',schedulePosition);
      scope.visualViewport?.removeEventListener('scroll',schedulePosition);
      root.remove();
    }
    document.addEventListener('pointerdown',onPointerDown,true);
    document.addEventListener('keydown',onKeyDown,true);
    document.addEventListener('scroll',onScroll,true);
    scope.addEventListener('resize',schedulePosition);
    scope.visualViewport?.addEventListener('resize',schedulePosition);
    scope.visualViewport?.addEventListener('scroll',schedulePosition);
    return Object.freeze({open,close,destroy,get opened(){return opened;}});
  }
  scope.PablicusMessageMenu = Object.freeze({create,icon});
})(typeof window === 'undefined' ? globalThis : window);
