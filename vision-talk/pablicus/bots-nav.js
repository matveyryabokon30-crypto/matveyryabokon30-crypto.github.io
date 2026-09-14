/* Block 01 Bot Core navigation adapter: shared session/client and explicit routes. */
(function(){'use strict';
 const home=document.getElementById('home'),nav=document.getElementById('mainNav'),content=document.getElementById('screenContent'),search=document.getElementById('searchChats'),filters=document.getElementById('chatFilters'),newChat=document.getElementById('newChat');
 const controller=window.PablicusController,services=controller?.getServices();if(!home||!nav||!content||!controller||!services?.client||!window.PablicusBots)return;
 function css(href){if(document.querySelector(`link[href="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l)}
 function script(src,signal){if(document.querySelector(`script[src="${src}"]`))return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement('script'),abort=()=>{s.remove();rej(new DOMException('Aborted','AbortError'))};s.src=src;s.onload=()=>{signal?.removeEventListener('abort',abort);res()};s.onerror=()=>{signal?.removeEventListener('abort',abort);rej(Error('Не удалось загрузить '+src))};if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});document.head.append(s)})}
 css('bot-factory.css');
 let factoryScript=null;
 const ensureFactory=()=>window.PublicBotFactory?Promise.resolve():factoryScript||(factoryScript=script('bot-factory.js').catch(e=>{document.querySelector('script[src="bot-factory.js"]')?.remove();factoryScript=null;throw e}));
 const bots=PablicusBots.create({client:services.client,getUser:()=>services.getUser?.(),onError:e=>services.notify?.(e?.message||'Ошибка Bot Core'),onFactory:()=>controller.navigate({section:'bots',screen:'factory'}),onScenario:id=>controller.navigate({section:'bots',screen:'scenario',resourceId:id})});
 controller.register('bots',async({isCurrent,onCleanup})=>{if(!isCurrent())return;bots.mount(content);onCleanup(()=>bots.reset())});
 controller.register('factory',async({isCurrent,onCleanup})=>{
  const uid=services.getUser?.()?.id;
  const identityCurrent=()=>isCurrent()&&!!uid&&services.getUser?.()?.id===uid&&services.getProfile?.()?.id===uid&&services.getProfile?.()?.is_approved===true;
  const deny=()=>{if(isCurrent())return controller.navigate({section:'chats',screen:'home'})};
  // A cached approved profile is necessary, but never sufficient to enter Factory.
  if(!identityCurrent())return deny();
  try{
   const result=await services.getSession?.(),session=result?.data?.session;
   if(!identityCurrent()||result?.error||!session?.access_token||session.user?.id!==uid||!(session.expires_at*1000>Date.now()))return deny();
   const {data:currentProfile,error}=await services.client.from('profiles').select('id,is_approved').eq('id',uid).single();
   if(!identityCurrent()||error||currentProfile?.id!==uid||currentProfile.is_approved!==true)return deny();
   await ensureFactory();
   if(!identityCurrent()||!(session.expires_at*1000>Date.now()))return deny();
  }catch{return deny()}
  // Own the DOM and requests for this route. Late completions cannot repaint a new
  // route, and a queued upload cannot start another request after logout/navigation.
  let active=true;
  const allowed=()=>active&&identityCurrent();
  const denied=()=>Promise.resolve({data:null,error:Error('UNAUTHORIZED')});
  const client={
   rpc:(...args)=>allowed()?services.client.rpc(...args):denied(),
   storage:{from:bucket=>({upload:(...args)=>allowed()?services.client.storage.from(bucket).upload(...args):denied()})}
  };
  const factory=window.PublicBotFactory.create({client,getUser:()=>allowed()?services.getUser?.():null});
  onCleanup(()=>{active=false;factory.reset()});
  factory.mount(content,()=>{if(allowed())return controller.navigate({section:'bots',screen:'bots'})});
 });
 script('bot-scenario-bridge.js');
})();
