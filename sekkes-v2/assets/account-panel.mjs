const errorText=error=>error?.status===429?'Слишком много попыток. Подожди минуту.':({OTP_INVALID:'Введи код или скопированную ссылку из письма.',otp_expired:'Код истёк или уже использован. Запроси новый.',invalid_credentials:'Почта или пароль не подошли.',AUTH_CANCELLED:'Вход отменён.',OWNER_ONLY:'У этого аккаунта пока нет доступа к AI Marius.'}[error?.code]||'Не удалось войти. Проверь подключение и попробуй ещё раз.');
export function openAccountPanel({account,root,show,onSuccess,onAuthenticated=()=>{},onBusy=()=>{},enroll=false}){
 let disposed=false,busy=false;
 const message=text=>{if(!disposed)root.querySelector('[role="status"]').textContent=text;};
 const passkeys=account.passkeys(state=>message(state.message));
 const run=async task=>{if(busy||disposed)return;busy=true;onBusy(true);for(const b of root.querySelectorAll('button'))b.disabled=true;
  try{await task();}catch(error){message(errorText(error));}finally{busy=false;onBusy(false);if(!disposed)for(const b of root.querySelectorAll('button'))b.disabled=false;}};
 function enrollment(){
  show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Face ID</h2><p>Создай ключ доступа на этом устройстве. iPhone предложит подтвердить его через Face ID или код устройства.</p><p>При обычном открытии приложения вход сохраняется автоматически.</p><button type="button" class="rounded-action primary" id="accountPasskey">Подключить Face ID</button><button type="button" class="rounded-action" id="accountContinue">Продолжить</button><p role="status"></p>');
  root.querySelector('#accountPasskey').onclick=()=>run(async()=>{if(await passkeys.register()){root.querySelector('#accountPasskey').hidden=true;message('Ключ доступа сохранён.');}});
  root.querySelector('#accountContinue').onclick=()=>{dispose();onSuccess();};
 }
 function complete(offerEnrollment){if(disposed)return;onAuthenticated();if(offerEnrollment)enrollment();else{dispose();onSuccess();}}
 function setup(){
  show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Создать первый ключ</h2><p>Один раз подтверди существующий аккаунт прежним логином и паролем. Логин — адрес, с которым ты входил раньше. Письма и коды отправляться не будут.</p><form id="accountSetupForm"><label for="accountSetupLogin">Прежний логин</label><input id="accountSetupLogin" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="accountSetupPassword">Прежний пароль</label><input id="accountSetupPassword" type="password" autocomplete="current-password" required><button type="submit" class="rounded-action primary">Продолжить к Face ID</button></form><button id="accountSetupBack" type="button" class="rounded-action">Назад</button><p role="status"></p>');
  root.querySelector('#accountSetupForm').onsubmit=event=>{event.preventDefault();return run(async()=>{
   const login=root.querySelector('#accountSetupLogin').value.trim();
   const field=root.querySelector('#accountSetupPassword');
   const pending=account.password(login,field.value);field.value='';
   await pending;complete(true);
  });};
  root.querySelector('#accountSetupBack').onclick=()=>{if(!busy)login();};
 }
 function login(){
  show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Войти в AI Marius</h2><p>Используй ключ доступа. iPhone подтвердит вход через Face ID или код устройства.</p><button id="accountKeyLogin" type="button" class="rounded-action primary">Войти с Face ID</button><p>После входа приложение запомнит тебя до выхода из аккаунта.</p><details><summary>Если ключ ещё не создан</summary><p>Первый ключ нужно привязать к существующему аккаунту после подтверждения доступа. Включение Passkeys в настройках сервера само по себе ключ не создаёт.</p></details><p role="status"></p>');
  root.querySelector('#accountKeyLogin').onclick=()=>run(async()=>{if(await passkeys.signIn())complete(false);});
  const setupButton=document.createElement('button');setupButton.type='button';setupButton.className='rounded-action';setupButton.textContent='Создать первый ключ';setupButton.id='accountSetup';
  root.querySelector('details').append(setupButton);setupButton.onclick=()=>{if(!busy)setup();};
 }
 function dispose(){if(disposed)return;disposed=true;passkeys.destroy();onBusy(false);}
 if(enroll)enrollment();else login();
 return {dispose,cancel(){if(disposed)return;account.epoch++;dispose();}};
}
