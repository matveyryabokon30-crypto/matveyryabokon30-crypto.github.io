// Original Marius interface drawings. Standard UI metaphors, authored independently.
const paths={
 'arrow-up':['M12 20V4','m6 10 6-6 6 6'],'arrow-down':['M12 4v16','m6 14 6 6 6-6'],
 float:['M8 3h12v13M4 8h12v13H4Z','M8 12h4m-4 4h4'],
 more:['M4 12h.01M12 12h.01M20 12h.01','M4 11.9v.2m8-.2v.2m8-.2v.2'],
 grip:['M8 5v.01M8 12v.01M8 19v.01','M16 5v.01M16 12v.01M16 19v.01'],
 image:['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z','m3 17 6-6 4 4 3-3 5 5M16 7h.01'],
 attach:['m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9','m7 14 7-7'],
 heart:['M12 20C-2 11 3-1 12 7c9-8 14 4 0 13Z','M6 8c0-1 1-2 2-2'],
 send:['m3 3 18 9-18 9 4-9-4-9Z','M7 12h14'],
 save:['M4 3h13l3 3v15H4Z','M8 3v6h8V3M8 21v-7h8v7'],
 upload:['M4 16v4h16v-4','M12 16V3m-5 5 5-5 5 5'],
 refresh:['M20 9a8 8 0 0 0-14-4M4 15a8 8 0 0 0 14 4','M20 3v6h-6M4 21v-6h6'],
 bold:['M7 3h6a4 4 0 0 1 0 8H7V3Z','M7 11h7a5 5 0 0 1 0 10H7V11Z'],
 italic:['M9 3h10M5 21h10','M15 3 9 21'],

 home:['M4 10.5 12 4l8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z','M9 20v-6h6v6'],
 chat:['M7 4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-5l-5 3v-3a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z','M8 10h8m-8 4h5'],
 note:['M6 3h11a2 2 0 0 1 2 2v15a1 1 0 0 1-1.5.86L13 18.5l-4.5 2.36A1 1 0 0 1 7 20V3M4 7h5M4 12h5M4 17h5','M11 7h5m-5 4h5'],
 compass:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z','m15.5 8.5-2 5-5 2 2-5 5-2Z'],
 bag:['M5 8h14l1 11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L5 8Z','M8 9V6a4 4 0 0 1 8 0v3'],
 document:['M5 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3Z','M14 3v6h5M9 13h6m-6 4h4'],
 users:['M8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM2 20v-2a6 6 0 0 1 12 0v2','M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5v1'],
 calendar:['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 10h18M8 3v4m8-4v4','m8 16 2 2 6-5'],
 search:['M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z','m15.2 15.2 5.3 5.3'],
 settings:['M12 3 14 5l3-.2.8 2.8L20 10l-1 2 1 2-2.2 2.4-.8 2.8-3-.2-2 2-2-2-3 .2-.8-2.8L4 14l1-2-1-2 2.2-2.4L7 4.8l3 .2Z','M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
 plus:['M12 5v14','M5 12h14'],close:['m6 6 12 12','M18 6 6 18'],
 expand:['M9 4H4v5m11-5h5v5','M4 15v5h5m11-5v5h-5'],collapse:['m7 10 5 5 5-5','M6 20h12'],
 'arrow-right':['M4 12h15','m13 6 6 6-6 6'],'arrow-left':['M20 12H5','m11 6-6 6 6 6'],
 table:['M4 4h16v16H4Z','M4 10h16M10 4v16'],folder:['M3 6a2 2 0 0 1 2-2h5l3 3h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z','M3 11h18'],
 browser:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z','M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z'],
 video:['M3 6h12v12H3Z','m15 10 6-4v12l-6-4'],
 bookmark:['M6 3h12v18l-6-4-6 4Z','M9 7h6'],
 menu:['M4 6h16M4 18h16','M4 12h16'],
};
Object.assign(paths,{
 login:['M11 4h9v16h-9','M2 12h12m-4-4 4 4-4 4'],
 team:['M4 8q3-3 6 0v9q-3 3-6 0V8Z','M14 8q3-3 6 0v9q-3 3-6 0V8Z','M6 11v2m2-2v2m8-2v2m2-2v2'],
 clinic:['M4 21V7h16v14H4Z','M9 21v-5h6v5','M12 3v8m-4-4h8'],
 feed:['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z','M7 7h4v4H7Zm8 0h2m-2 4h2','M7 16h10'],
 'all-chats':['M9 4h8a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-2l-4 3v-3H9a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z','M5 8H4a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3v3l4-3','M10 9h6m-6 4h3'],
 personal:['M8 4h8a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5h-4l-5 3v-3a5 5 0 0 1-4-5V9a5 5 0 0 1 5-5Z','M9 9h.01M15 9h.01','M9 13q3 2 6 0'],
 groups:['M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM6 21v-3a6 6 0 0 1 12 0v3','M4 8a2 2 0 0 0 0 4m-2 7v-2q0-3 3-3','M20 8a2 2 0 0 1 0 4m2 7v-2q0-3-3-3'],
 channels:['M4 9h5l9-5v15l-9-5H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2Z','m6 14 2 7h3l-2-7','M21 8q3 3 0 7'],
 communities:['M9 5a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2 18a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm14 0a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z','M4 12a8 8 0 0 1 3-5m10 0a8 8 0 0 1 3 5','M10 20h4'],
 agents:['M5 7q7-5 14 0 4 4 0 11-7 5-14 0-4-7 0-11Z','M8 11v3m8-3v3','M12 4q0-4 4-2'],
 projects:['M3 5h18v15H3Z','M7 9v7m5-7v4m5-4v6','M8 5V3h8v2'],
 folders:['M3 8h7l2 3h9l-2 10H2Z','M3 8V4h6l2 2h8v5','M6 16h7'],
 saved:['m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9Z','m10 11 2-2 2 2'],
 library:['M3 4h4v17H3Zm6 0h4v17H9Z','m15 5 4-1 4 16-4 1-4-16Z','M3 8h4m2 9h4'],
 learning:['m2 8 10-5 10 5-10 5L2 8Z','M6 11v7q6 5 12 0v-7','M22 8v9'],
 catalog:['M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Z','M17.5 14v7m-3.5-3.5h7'],
 panels:['M3 4h18v16H3Z','M8 4v16m7-16v16'],
 'panel-list':['M7 5h14M7 12h14M7 19h14','M3 5h.01M3 12h.01M3 19h.01'],
 'new-chat':['M10 4H7a4 4 0 0 0-4 4v10l4-2h9a4 4 0 0 0 4-4v-1','m13 8 6-6 3 3-6 6-4 1 1-4Z'],
 'new-tab':['M3 4h8l2 3h8v14H3Z','M12 11v6m-3-3h6'],
 'restore-panel':['M15 3h6v18h-6','M2 12h12m-5-5 5 5-5 5'],
 notification:['M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3v-5Z','M10 21h4','M20 3l1-1M3 2l1 1'],
 chevron:['m7 10 5 5 5-5'],
 check:['m5 12 4 4L19 6'],
 profile:['M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z','M4 21v-2a8 8 0 0 1 16 0v2'],
 welcome:['M3 10 12 3l9 7v11H3Z','M9 21v-7h6v7','M9 9h6'],
 subscription:['M4 7h16v14H4Z','M2 7V4h20v3M12 4v17','M8 4Q4 0 7 1q4 0 5 3 1-3 5-3 3-1-1 3'],
 payment:['M3 5h18v14H3Z','M3 10h18','M7 15h4'],
});
export const ICON_PATHS=Object.freeze(paths);
export const CHAT_ICONS=Object.freeze({all:'all-chats',personal:'personal',groups:'groups',channels:'channels',communities:'communities',agents:'agents',projects:'projects',folders:'folders',saved:'saved'});
const routes={marketplace:'bag',library:'library',learning:'learning',events:'calendar','marius-channel':'agents','self-profile':'profile',welcome:'welcome',account:'login',subscription:'subscription',payment:'payment'};
const kindIcons={feed:'feed',chats:'all-chats',notebook:'note',browser:'browser',catalog:'catalog',settings:'settings'};
export function tabIcon(tab){if(!tab)return 'panels';if(tab.kind==='chats')return tab.contentRef==='all'?'all-chats':tab.contentRef?.includes('marius')?'agents':'personal';return routes[tab.contentRef]||kindIcons[tab.kind]||'catalog';}
export function motionIcon(name){
  if(!paths[name]||!document.createElementNS)return null;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  for(const [k,v]of Object.entries({viewBox:'0 0 24 24',class:'icon motion-icon motion-'+name,fill:'none',stroke:'currentColor','stroke-width':'2.1','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
  paths[name].forEach((d,i)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('class',i?'icon-detail icon-part-'+i:'icon-outline');svg.append(path);});return svg;
}
