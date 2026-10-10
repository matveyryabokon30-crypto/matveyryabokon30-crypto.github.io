import {icon} from './form-kit.mjs?v=e517eb719b5765e47495e1ef0af9d7d44ecc77f0a42f2cfd4b1917efb967463a';
import {createProfessionalWorkspace} from '../professional/ui.mjs?v=c17dd20d97a3739a81c4efcb9e5adb8e9bb78399106c64032efd7fd5beec4ec9';
import {AuthSession,accountStorage,authMessage} from '../auth/session.mjs?v=0a8014629e5d0ed29e1f9ae51a154358cc0047201795876483fe3f017c0117f8';
import {authConfig} from '../auth/config.mjs?v=5fec9d163c92bca6718a1263cf258cfb2a716700ef013fcc3947fe48d2cb0dc8';
import {AccountSync} from './sync.mjs?v=3abd0257c999d1f7ce7dec3c918c6b9e0ae44d13b0376ddc4f3554f5b6021165';
import {createAccountProfile,createAccountSettings,COLORS} from './ui.mjs?v=43a4cb08b9437a8b24282378fa2c5c1fdc64297a0c605f6f589bdd88e2d6d4f7';
const published=document.documentElement.dataset.published==='true';
const entry=published?'../?entry=1':'./';
document.getElementById('back').replaceChildren(icon('arrow-down'),document.createTextNode('В пространство'));
document.getElementById('back').href=published?'../space.html':'workspace.html';
const session=new AuthSession({...(published?{storageKey:'sekkes-'+authConfig.projectRef+'-auth'}:{}),onLost:()=>location.replace(entry)});
async function start(){
 const user=await session.restore();if(!user){location.replace(entry);return;}
 const sync=new AccountSync(session,{backing:accountStorage(localStorage,user.id)}).start(),system=matchMedia('(prefers-color-scheme:dark)');let view;
 const apply=()=>{const p=sync.snapshot?.account.data||{},r=document.documentElement;r.dataset.theme=p.theme==='dark'||(p.theme||'system')==='system'&&system.matches?'dark':'light';r.dataset.motion=p.motion===false?'reduced':'full';r.dataset.transparency=p.transparency===false?'off':'on';r.dataset.textSize=p.textSize||'system';r.dataset.font=p.font||'system';const color=COLORS.find(x=>x[0]===p.palette)?.[2]||'#747e8b';r.style.setProperty('--accent',color);};sync.subscribe(apply);system.addEventListener('change',apply);apply();
 function open(settings){view?.destroy();view=settings==='professional'?createProfessionalWorkspace(sync):settings?createAccountSettings(sync):createAccountProfile(sync);document.getElementById('account-content').replaceChildren(view.element);for(const[id,on]of [['profile-tab',!settings],['settings-tab',settings===true],['professional-tab',settings==='professional']])document.getElementById(id).setAttribute('aria-pressed',String(on));}
 document.getElementById('professional-tab').onclick=()=>open('professional');document.getElementById('profile-tab').onclick=()=>open(false);document.getElementById('settings-tab').onclick=()=>open(true);open(location.hash==='#professional'?'professional':location.hash==='#settings');
}
start().catch(error=>{const p=document.createElement('p');p.className='account-center';p.textContent=authMessage(error);document.getElementById('account-content').replaceChildren(p);});
