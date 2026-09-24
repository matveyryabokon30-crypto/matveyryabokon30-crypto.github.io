// Independent typography presets, using existing app/system fonts; no proprietary font files.
export const textPresets=Object.freeze({
 sans:{name:'Modern',family:'var(--font-ui),Arial,sans-serif',weight:500,style:'normal',spacing:0,stretch:1},
 serif:{name:'Classic',family:'Georgia,serif',weight:700,style:'normal',spacing:0,stretch:1},
 signature:{name:'Signature',family:'"Snell Roundhand","Brush Script MT",var(--font-display),cursive',weight:400,style:'italic',spacing:0,stretch:1},
 editor:{name:'Editor',family:'var(--font-display),Georgia,serif',weight:500,style:'normal',spacing:.015,stretch:1},
 poster:{name:'Poster',family:'Impact,"Arial Narrow",var(--font-ui),sans-serif',weight:900,style:'normal',spacing:-.055,stretch:.78},
 bubble:{name:'Bubble',family:'"Arial Rounded MT Bold",var(--font-ui),sans-serif',weight:800,style:'normal',spacing:.015,stretch:1.06},
 deco:{name:'Deco',family:'var(--font-display),Georgia,serif',weight:600,style:'normal',spacing:.14,stretch:1},
 squeeze:{name:'Squeeze',family:'Impact,"Arial Narrow",var(--font-ui),sans-serif',weight:900,style:'normal',spacing:-.05,stretch:.60},
 typewriter:{name:'Typewriter',family:'"Courier New",ui-monospace,monospace',weight:500,style:'normal',spacing:0,stretch:1},
 strong:{name:'Strong',family:'var(--font-ui),Arial,sans-serif',weight:800,style:'italic',spacing:-.035,stretch:1},
 meme:{name:'Meme',family:'Impact,"Arial Black",var(--font-ui),sans-serif',weight:900,style:'normal',spacing:.015,stretch:1},
 elegant:{name:'Elegant',family:'var(--font-display),Georgia,serif',weight:400,style:'italic',spacing:.01,stretch:1},
 directional:{name:'Directional',family:'var(--font-ui),Arial,sans-serif',weight:600,style:'normal',spacing:.05,stretch:.87},
 literature:{name:'Literature',family:'Palatino,"Palatino Linotype",Georgia,serif',weight:400,style:'normal',spacing:.01,stretch:1}
});
export const textAnimations=Object.freeze({none:'Нет',typewriter:'Пишущая машинка',pop:'Pop',jump:'Прыжок'});
export const textEffects=Object.freeze({none:'Нет',sparks:'Искры',neon:'Неон',shimmer:'Мерцание',pixel:'Пиксель'});
export const textPalette=Object.freeze([
 '#ffffff','#000000','#00a9ff','#22d9ae','#d7ef39','#ffc444','#ff832a','#ff3c59','#de27b4','#8122aa',
 '#ed1726','#fbd1d2','#fbe1c0','#f4c998','#e9ad73','#d48a49','#92542e','#663722','#403730','#123b29',
 '#131619','#303438','#52575b','#777c80','#a0a6aa','#c2c7cb','#d9dee2','#eaf0f3','#f5f7f8','#ffffff'
]);
export const textColor=value=>/^#[\da-f]{6}$/i.test(value||'')?value:'#ffffff';
export function textStyle(value={}){
 const font=value.font==='mono'?'typewriter':Object.hasOwn(textPresets,value.font)?value.font:'sans';
 return {font,animation:Object.hasOwn(textAnimations,value.animation)?value.animation:'none',effect:Object.hasOwn(textEffects,value.effect)?value.effect:'none',
  backgroundStyle:['none','solid','light','glass'].includes(value.backgroundStyle)?value.backgroundStyle:value.background?'glass':'none',
  backgroundColor:textColor(value.backgroundColor||'#10232d'),mentions:(Array.isArray(value.mentions)?value.mentions:[]).map(x=>String(x).replace(/^@/,'')).filter(x=>/^[\p{L}\p{N}_.]{1,40}$/u.test(x)).slice(0,20),
  place:value.place&&typeof value.place==='object'?{label:String(value.place.label||'').slice(0,160),address:String(value.place.address||'').slice(0,240)}:null};
}
export function applyTextStyle(node,layer){
 const p=textPresets[layer.font]||textPresets.sans;
 node.style.fontFamily=p.family;node.style.fontWeight=p.weight;node.style.fontStyle=p.style;node.style.letterSpacing=p.spacing+'em';
 node.style.setProperty('--text-stretch',p.stretch);node.style.color=textColor(layer.color);node.style.textAlign=layer.align||'center';
 node.dataset.font=layer.font;node.dataset.effect=layer.effect||'none';node.dataset.animation=layer.animation||'none';node.dataset.textBackground=layer.backgroundStyle||(layer.background?'glass':'none');
 node.style.setProperty('--text-bg',layer.backgroundColor||'#10232d');
}
