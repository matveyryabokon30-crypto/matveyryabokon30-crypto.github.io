import {el,icon} from '../workspace/dom.mjs?v=b6f0181932abbec0bb8575d4b6ee617fbdb4d456b5ce0fd10ef6b98a822c9769';
import {createLiveHead} from '../workspace/character.mjs?v=87c9209f479e1d1bb19bdb27c051101cffb62804d489fdefe709f4e4d1372492';
import {AuthSession} from './session.mjs?v=0a8014629e5d0ed29e1f9ae51a154358cc0047201795876483fe3f017c0117f8';
import {AuthFlow} from './flow.mjs?v=39306e98d3d0090359f1576bfc05c91fd33e6cc607dbb806ef94ebd40471ed8d';
import {createOtpInput} from './otp.mjs?v=38c877f5724ba7f2a10f58543cec16185b59366a93f9f14abe558ff4a0ace5b7';

export function mountAuthEntry({sessionFactory=()=>new AuthSession(),navigate=()=>location.assign('./workspace.html')}={}){
const $=id=>document.getElementById(id),scene=$('auth-scene'),surface=$('auth-surface'),panel=$('auth-panel'),content=$('auth-content');
const head=createLiveHead({state:{preferences:{palette:'iris',motion:true}},subscribe(){return()=>{}}},{minimumResolution:312,pointerTracking:false});$('auth-character').append(head.element);
$('auth-close').append(icon('close'));$('auth-back').append(icon('arrow-left'));
let session,otp=null,pendingCode=null,renderedStep='',opened=false,returnStep='signup',resizeFrame,openingTimer;
const api=new Proxy({}, {get:(_,method)=>(...args)=>{session ||= sessionFactory();return session[method](...args);}});
const flow=new AuthFlow(api,{change:render,complete:async()=>{
  if(otp)await otp.capture($('auth-character'));surface.classList.add('is-authenticated');flow.update({step:'success',message:''});
  await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion:reduce)').matches?100:850));navigate();
}});
function keyIcon(){return el('img',{src:'assets/auth/icons/key-round.svg',class:'auth-symbol',alt:'',width:22,height:22});}
function action(label,run,{kind='button',secondary=false,key=false}={}){return el('button',{type:kind,class:'auth-action'+(secondary?' auth-secondary':''),onClick:run},key?keyIcon():null,el('span',{text:label}),secondary?null:icon('arrow-right'));}
function link(label,run){return el('button',{type:'button',class:'link-button',onClick:run,text:label});}
function title(box,heading,description){box.append(el('h1',{id:'auth-title',text:heading}));if(description)box.append(el('p',{class:'auth-description',text:description}));}
function field(box,label,attributes){const input=el('input',attributes);const wrapped=attributes.type==='email'?el('div',{class:'auth-input-wrap'},el('img',{src:'assets/auth/icons/mail.svg',class:'auth-symbol',alt:'',width:21,height:21}),input):input;box.append(el('label',{class:'auth-field'},el('span',{text:label}),wrapped));return input;}
function measure(){
  cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{
    if(!opened)return;
    // Measure the live content, preserving the single physical morphing surface.
    const styles=getComputedStyle(panel);
    const header=panel.querySelector('header');const headerStyles=getComputedStyle(header);const footer=panel.querySelector('footer');
    const need=header.offsetHeight+parseFloat(headerStyles.marginBottom)+content.scrollHeight+($('auth-status').hidden?0:$('auth-status').offsetHeight+15)+footer.offsetHeight+parseFloat(getComputedStyle(footer).marginTop)+parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom);
    surface.style.setProperty('--panel-height',Math.ceil(need)+'px');
  });
}
function show(){if(opened)return;opened=true;panel.inert=true;panel.hidden=false;$('enter').hidden=true;$('enter').setAttribute('aria-expanded','true');scene.classList.add('auth-scene-open');surface.classList.add('is-open');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','auth-title');document.querySelector('.auth-brand').tabIndex=-1;render(flow.state);measure();clearTimeout(openingTimer);openingTimer=setTimeout(()=>{if(!opened)return;panel.inert=false;$('auth-close').focus({preventScroll:true});},matchMedia('(prefers-reduced-motion:reduce)').matches?0:820);}
function close(){if(flow.state.busy)return;clearTimeout(openingTimer);opened=false;panel.inert=false;document.activeElement?.blur();surface.classList.remove('is-open');scene.classList.remove('auth-scene-open');panel.hidden=true;panel.removeAttribute('role');panel.removeAttribute('aria-modal');document.querySelector('.auth-brand').removeAttribute('tabindex');$('enter').hidden=false;$('enter').setAttribute('aria-expanded','false');$('enter').focus({preventScroll:true});content.querySelectorAll('input[type=password]').forEach(input=>input.value='');otp?.clear();}
function render(state){
  if(!opened)return;
  if(renderedStep!==state.step){
    otp?.destroy();otp=null;pendingCode=null;renderedStep=state.step;const box=el('div',{class:'auth-step'});content.replaceChildren(box);$('auth-scroll').scrollTop=0;
    $('auth-back').hidden=state.step==='signup';$('auth-caption').textContent=['privacy','terms'].includes(state.step)?'AI Marius':'Войти';
    if(state.step==='signup'||state.step==='email'){
      const signup=state.step==='signup';title(box,signup?'Начнём с почты':'Вход по почте',signup?'Пришлём код для создания аккаунта.':'Пришлём одноразовый код для входа.');
      const form=el('form');const email=field(form,'Электронная почта',{id:'email',name:'email',type:'email',autocomplete:'username',inputmode:'email',autocapitalize:'none',spellcheck:'false',placeholder:'name@example.com',value:state.email,required:'',maxlength:254});
      email.addEventListener('input',()=>{flow.state.email=email.value;});
      form.append(action('Получить код',null,{kind:'submit'}));form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())void flow.send(email.value);});box.append(form);
      if(signup)box.append(el('p',{class:'auth-switch'},'Уже есть аккаунт? ',link('Войти',()=>flow.navigate('methods'))));
      box.append(el('div',{class:'auth-or',text:'или'}),action('У меня есть ключ доступа',()=>void flow.passkey(),{secondary:true,key:true}));
    }else if(state.step==='methods'){
      title(box,'С возвращением','Выберите удобный способ входа.');box.append(el('div',{class:'auth-methods'},action('Код из электронной почты',()=>flow.navigate('email')),action('Ключ доступа',()=>void flow.passkey(),{key:true}),action('Пароль аккаунта',()=>flow.navigate('password'))));
      box.append(el('p',{class:'auth-footnote',text:'Ключ доступа подтверждается через Face ID, Touch ID или код вашего устройства.'}),el('p',{class:'auth-switch'},'Первый раз здесь? ',link('Создать аккаунт',()=>flow.navigate('signup'))));
    }else if(state.step==='code'){
      title(box,'Код из письма','Отправляем код…');const form=el('form');
      otp=createOtpInput({onComplete:value=>{if(!flow.state.busy)void flow.verify(value);else if(flow.state.action==='send')pendingCode=value;}});const code=otp.input;form.append(otp.element);
      form.append(action('Продолжить',null,{kind:'submit'}));form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())void flow.verify(code.value);});box.append(form,el('p',{class:'auth-footnote',id:'code-hint',text:'Код можно вставить целиком или выбрать над клавиатурой, если устройство предложит его.'}),el('div',{class:'auth-resend'},link('Отправить ещё раз',()=>void flow.send())),el('p',{class:'auth-switch'},link('Изменить почту',()=>flow.navigate(state.createAccount?'signup':'email'))));
      code.focus({preventScroll:true});
    }else if(state.step==='access'){
      title(box,'Почта подтверждена','Осталось проверить доступ к AI Marius.');
      box.append(action('Повторить вход',()=>void flow.retryAccess()),el('p',{class:'auth-footnote',text:'Код повторно вводить не нужно, пока эта страница открыта.'}),el('p',{class:'auth-switch'},link('Другая почта',()=>flow.navigate('signup'))));
    }else if(state.step==='password'){
      title(box,'Вход с паролем','Используйте пароль вашего аккаунта AI Marius.');const form=el('form');const email=field(form,'Электронная почта',{name:'email',type:'email',autocomplete:'username',placeholder:'name@example.com',value:state.email,required:'',maxlength:254});const password=field(form,'Пароль',{name:'password',type:'password',autocomplete:'current-password',required:'',maxlength:512});
      form.append(action('Войти',null,{kind:'submit'}));form.addEventListener('submit',async event=>{event.preventDefault();if(form.reportValidity()){await flow.password(email.value,password.value);password.value='';}});box.append(form,el('p',{class:'auth-switch'},link('Войти по коду без пароля',()=>flow.navigate('email'))));
    }else if(state.step==='success'){
      $('auth-back').hidden=true;title(box,'Вы вошли','Добро пожаловать в AI Marius.');box.append(el('div',{class:'auth-success-mark','aria-hidden':'true'},icon('check')),el('p',{class:'auth-footnote',text:'Открываем ваше пространство…'}));
    }else{
      const privacy=state.step==='privacy';title(box,privacy?'Конфиденциальность':'Тестовая версия');const reading=el('div',{class:'auth-reading'});
      const paragraphs=privacy?['Электронная почта используется для подтверждения аккаунта и входа. Коды и пароли не сохраняются в блокнотах или профиле.','При входе по ключу доступа лицо, отпечаток и код устройства проверяет само устройство. AI Marius не получает ваши биометрические данные.','Сеанс входа сохраняется в этом браузере. На общем устройстве завершайте работу кнопкой «Выйти».']:['AI Marius сейчас доступен участникам тестирования. Подтверждение почты создаёт аккаунт; доступ к закрытой версии проверяется отдельно.','Полные условия использования и политика обработки персональных данных будут опубликованы перед общим запуском.'];
      for(const text of paragraphs)reading.append(el('p',{text}));box.append(reading);
    }
  }
  const status=$('auth-status');status.textContent=state.message;status.hidden=!state.message;
  panel.setAttribute('aria-busy',String(state.busy));panel.querySelectorAll('button').forEach(b=>b.disabled=state.busy);panel.querySelectorAll('input').forEach(input=>input.readOnly=state.busy&&state.action!=='send');
  if(state.step==='code'){content.querySelector('.auth-description').textContent=state.delivery==='sending'?'Отправляем код…':state.delivery==='failed'?'Не удалось отправить письмо. Можно повторить запрос.':'Код отправлен на '+state.email;}
  otp?.setBusy(state.busy&&state.action!=='send');otp?.setError(state.message&&state.step==='code'&&!state.busy);
  $('entry-status').textContent=state.step==='success'?'Вход подтверждён. Открываем пространство.':state.busy?'Проверяем…':'';updateResend();measure();
  // A suggestion/paste can arrive before the send response. Verify once after
  // delivery completes, provided the user has not changed or dismissed it.
  if(!state.busy&&state.action==='send'&&pendingCode){
    const proof=pendingCode;pendingCode=null;
    if(state.delivery==='sent')queueMicrotask(()=>{if(opened&&flow.state.step==='code'&&!flow.state.busy&&otp?.input.value===proof)void flow.verify(proof);});
  }
}
function updateResend(){const button=content.querySelector('.auth-resend button');if(button){const seconds=flow.seconds();button.disabled=flow.state.busy||seconds>0;button.textContent=seconds?'Повторно через '+seconds+' с':'Отправить ещё раз';}}
$('enter').addEventListener('click',show);$('auth-close').addEventListener('click',close);
$('auth-back').addEventListener('click',()=>flow.navigate(['privacy','terms'].includes(flow.state.step)?returnStep:flow.state.step==='code'?(flow.state.createAccount?'signup':'email'):flow.state.step==='methods'?'signup':'methods'));
for(const step of ['terms','privacy'])$(step).addEventListener('click',()=>{if(!['privacy','terms'].includes(flow.state.step))returnStep=flow.state.step;flow.navigate(step);});
addEventListener('keydown',event=>{
  if(!opened)return;if(event.key==='Escape'){event.preventDefault();close();}
  if(event.key==='Tab'){const list=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(n=>!n.hidden&&n.getClientRects().length);const index=list.indexOf(document.activeElement);if(event.shiftKey&&(index<=0)){event.preventDefault();list.at(-1)?.focus();}else if(!event.shiftKey&&(index===list.length-1)){event.preventDefault();list[0]?.focus();}}
});
function viewport(){const view=globalThis.visualViewport;scene.style.setProperty('--viewport-height',(view?.height||innerHeight)+'px');scene.style.setProperty('--viewport-top',(view?.offsetTop||0)+'px');measure();}
globalThis.visualViewport?.addEventListener('resize',viewport);globalThis.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);viewport();
const contentObserver=new ResizeObserver(measure);contentObserver.observe(content);
const timer=setInterval(updateResend,1000);addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);clearTimeout(openingTimer);contentObserver.disconnect();otp?.destroy();head.destroy();}},{once:true});

return {flow,show,close};
}
