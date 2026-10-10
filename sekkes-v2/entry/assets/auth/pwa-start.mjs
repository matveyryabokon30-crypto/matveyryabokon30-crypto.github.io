// Published SEKKES PWA keeps its existing scope, SDK session and working space.
import {mountAuthEntry} from './entry.mjs?v=8be11b1fc53dcda55dfdc9c54fefcdef0aead02ca878dd472d42e33695424bed';
import {AuthSession} from './session.mjs?v=0a8014629e5d0ed29e1f9ae51a154358cc0047201795876483fe3f017c0117f8';
import {authConfig} from './config.mjs?v=5fec9d163c92bca6718a1263cf258cfb2a716700ef013fcc3947fe48d2cb0dc8';

const root=new URL('../',document.baseURI);
const destination=new URL('space.html',root);
// A scanned existing login QR remains on the same origin; it is never logged.
if(/^#qr=[a-f0-9]{64}$/.test(location.hash))destination.hash=location.hash;
const session=new AuthSession({storageKey:'sekkes-'+authConfig.projectRef+'-auth'});
let interacting=false;
document.addEventListener('pointerdown',()=>{interacting=true;},{once:true});
document.addEventListener('keydown',()=>{interacting=true;},{once:true});
const navigate=()=>location.replace(destination.href);
mountAuthEntry({sessionFactory:()=>session,navigate});
if(new URLSearchParams(location.search).get('entry')!=='1'){
  session.restore().then(user=>{if(user&&!interacting)navigate();}).catch(()=>{});
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'}).catch(()=>{});
}
