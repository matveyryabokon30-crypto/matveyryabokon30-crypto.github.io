export const sections=Object.freeze([
 {id:'home',title:'Главная',icon:'home',route:'#home',capability:'live',themeRole:'scene',loadModule:()=>import('./screens/home.mjs')},
 {id:'chat',title:'Чат',icon:'chat',route:'#chat',capability:'text',themeRole:'content',loadModule:()=>import('./screens/chat.mjs')},
 {id:'games',title:'Игры',icon:'games',route:'#games',capability:'catalog',themeRole:'media',loadModule:()=>import('./screens/games.mjs')},
 {id:'world',title:'Живой мир',icon:'world',route:'#world',capability:'worldPreview',themeRole:'scene',loadModule:()=>import('./screens/world.mjs')},
 {id:'profile',title:'Профиль',icon:'profile',route:'#profile',capability:'auth',themeRole:'content',loadModule:()=>import('./screens/profile.mjs')},
 {id:'settings',title:'Настройки',icon:'settings',route:'#settings',capability:'preferences',themeRole:'content',loadModule:()=>import('./screens/settings.mjs')}
]);
export function routeId(hash){const id=hash.replace(/^#\/?/,'');return sections.some(s=>s.id===id)?id:'home'}
