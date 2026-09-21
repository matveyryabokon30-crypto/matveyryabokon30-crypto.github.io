const errorText=error=>error?.status===429?'Слишком много попыток. Подожди минуту.':({OTP_INVALID:'Введи код или скопированную ссылку из письма.',otp_expired:'Код истёк или уже использован. Запроси новый.',invalid_credentials:'Почта или пароль не подошли.',AUTH_CANCELLED:'Вход отменён.',OWNER_ONLY:'У этого аккаунта пока нет доступа к SEKKES.'}[error?.code]||'Не удалось войти. Проверь подключение и попробуй ещё раз.');
export function openAccountPanel({account,root,show,onSuccess,onAuthenticated=()=>{},onBusy=()=>{},enroll=false}){
 let disposed=false,busy=false,cooldown=0;
 const message=text=>{if(!disposed)root.querySelector('[role="status"]').textContent=text;};
 const passkeys=account.passkeys(state=>message(state.message));
 const run=async task=>{if(busy||disposed)return;busy=true;onBusy(true);for(const b of root.querySelectorAll('button'))b.disabled=true;
  try{await task();}catch(error){message(errorText(error));}finally{busy=false;onBusy(false);if(!disposed)for(const b of root.querySelectorAll('button'))b.disabled=false;}};
 function enrollment(){
  show('<div class="kicker">SEKKES</div><h2 id="dialogTitle">Face ID</h2><p>Создай ключ доступа на этом устройстве. iPhone предложит подтвердить его через Face ID или код устройства.</p><p>При обычном открытии приложения вход сохраняется автоматически.</p><button type="button" class="rounded-action primary" id="accountPasskey">Подключить Face ID</button><button type="button" class="rounded-action" id="accountContinue">Продолжить</button><p role="status"></p>');
  root.querySelector('#accountPasskey').onclick=()=>run(async()=>{if(await passkeys.register()){root.querySelector('#accountPasskey').hidden=true;message('Ключ доступа сохранён.');}});
  root.querySelector('#accountContinue').onclick=()=>{dispose();onSuccess();};
 }
 function complete(offerEnrollment){if(disposed)return;onAuthenticated();if(offerEnrollment)enrollment();else{dispose();onSuccess();}}
 function login(){
  show('<div class="kicker">SEKKES</div><h2 id="dialogTitle">Войти в SEKKES</h2><p>Войди один раз. Приложение сохранит вход до выхода из аккаунта.</p><form id="accountEmail"><label class="s2-label">Почта<input id="accountEmailInput" type="email" autocomplete="username" autocapitalize="none" required></label><button class="rounded-action primary">Получить код</button></form><form id="accountProof" hidden><label class="s2-label">Код из письма<input id="accountCode" type="text" autocomplete="one-time-code" required></label><p>Если в письме кнопка входа, скопируй её ссылку и вставь сюда.</p><button class="rounded-action primary">Войти по коду</button></form><button id="accountKeyLogin" type="button" class="rounded-action">Войти с Face ID</button><details><summary>Войти по паролю</summary><form id="accountPassword"><label class="s2-label">Пароль<input id="accountPasswordInput" type="password" autocomplete="current-password" required></label><button class="rounded-action">Войти</button></form></details><p role="status"></p>');
  const email=()=>root.querySelector('#accountEmailInput').value.trim();
  root.querySelector('#accountEmail').onsubmit=e=>{e.preventDefault();run(async()=>{if(Date.now()<cooldown){message('Новое письмо можно запросить через минуту.');return;}await account.requestCode(email());cooldown=Date.now()+60000;root.querySelector('#accountProof').hidden=false;message('Письмо отправлено. Введи код здесь, в приложении.');root.querySelector('#accountCode').focus();});};
  root.querySelector('#accountProof').onsubmit=e=>{e.preventDefault();run(async()=>{await account.verifyCode(email(),root.querySelector('#accountCode').value);complete(true);});};
  root.querySelector('#accountPassword').onsubmit=e=>{e.preventDefault();run(async()=>{if(!root.querySelector('#accountEmailInput').reportValidity())return;const input=root.querySelector('#accountPasswordInput');const value=input.value;input.value='';await account.password(email(),value);complete(true);});};
  root.querySelector('#accountKeyLogin').onclick=()=>run(async()=>{if(await passkeys.signIn())complete(false);});
 }
 function dispose(){if(disposed)return;disposed=true;passkeys.destroy();onBusy(false);}
 if(enroll)enrollment();else login();
 return {dispose,cancel(){if(disposed)return;account.epoch++;dispose();}};
}
