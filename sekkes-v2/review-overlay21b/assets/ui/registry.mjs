export const sections=Object.freeze([
 {id:'admin',title:'Админ',icon:'settings',route:'#admin',ownerOnly:true,loadModule:()=>import('/sekkes-v2/review-overlay21b/assets/ui/owner-workspace.mjs')},
 {id:'home',title:'Главная',icon:'home',route:'#home',capability:'conversation',themeRole:'scene',loadModule:()=>import('/sekkes-v2/review-overlay21b/assets/ui/screens/home.mjs')},
 {id:'games',title:'Игры',icon:'games',route:'#games',capability:'catalog',themeRole:'media',loadModule:()=>import('/sekkes-v2/assets/ui/screens/games.mjs')},
 {id:'world',title:'Живой мир',icon:'world',route:'#world',capability:'worldPreview',themeRole:'scene',loadModule:()=>import('/sekkes-v2/assets/ui/screens/world.mjs')},
 {id:'profile',title:'Профиль',icon:'profile',route:'#profile',capability:'auth',themeRole:'content',loadModule:()=>import('/sekkes-v2/assets/ui/screens/profile.mjs')},
 {id:'settings',title:'Настройки',icon:'settings',route:'#settings',capability:'preferences',themeRole:'content',loadModule:()=>import('/sekkes-v2/assets/ui/screens/settings.mjs')}
]);
export function routeId(hash){const id=hash.replace(/^#\/?/,'');return sections.some(s=>s.id===id)?id:'home'}

