/* Ordered boot for the story UI, including its offline shell dependencies. */
(function(){'use strict';const here=new URL('.',document.currentScript.src);
if(!document.getElementById('story-layout-css')){const l=document.createElement('link');l.id='story-layout-css';l.rel='stylesheet';l.href=new URL('story-layout.css',here).href;document.head.append(l);}
function load(name,next){const s=document.createElement('script');s.src=new URL(name,here).href;s.onload=next||null;s.onerror=()=>console.error('[Pablicus stories] failed:',name);document.head.append(s);}
load('story-layout.js',()=>load('stories-v3-core.js',()=>load('stories-v3-viewer.js')));
})();
