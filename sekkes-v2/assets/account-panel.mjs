const errorText=error=>error?.status===429?'Слишком много попыток. Подожди минуту.':({OTP_INVALID:'Введи код или скопированную ссылку из письма.',otp_expired:'Код истёк или уже использован. Запроси новый.',invalid_credentials:'Почта или пароль не подошли.',AUTH_CANCELLED:'Вход отменён.',OWNER_ONLY:'У этого аккаунта пока нет доступа к AI Marius.'}[error?.code]||'Не удалось войти. Проверь подключение и попробуй ещё раз.');
export function openAccountPanel({account,root,show,onSuccess,onAuthenticated=()=>{},onBusy=()=>{},enroll=false,emailMode=false}){
 let disposed=false,busy=false,recoveryConfirmed=false;
 const originalId=account.api?.user?.id,originalEmail=account.api?.user?.email;
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
 function emailLogin(){
  const recovery=Boolean(originalId&&!recoveryConfirmed);
  show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Войти с электронной почтой</h2><p id="emailExplanation"></p><form id="emailRequest"><label for="accountEmail">Электронная почта</label><input id="accountEmail" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" required><label id="emailCreateLabel"><input id="emailCreate" type="checkbox"> Создать аккаунт, если этой почты ещё нет</label><button type="submit" class="rounded-action primary">Получить письмо для входа</button></form><form id="emailVerify" hidden><label for="accountProof">Код или полная ссылка из письма</label><input id="accountProof" type="text" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" maxlength="4096" required><button type="submit" class="rounded-action primary">Подтвердить почту</button></form><button id="emailBack" type="button" class="rounded-action">Назад</button><p role="status" aria-live="polite"></p>');
  const email=root.querySelector('#accountEmail'),create=root.querySelector('#emailCreate'),verify=root.querySelector('#emailVerify');
  email.value=recovery?originalEmail||'':'';email.readOnly=recovery;
  root.querySelector('#emailCreateLabel').hidden=recovery;
  root.querySelector('#emailExplanation').textContent=recovery?'Сначала подтвердим почту текущего аккаунта для возврата в него. Выходить не нужно: Face ID и текущий вход сохраняются.':originalId?'Почта основного аккаунта подтверждена. Теперь можно войти с другой почтой. Текущий вход заменится только после подтверждения и проверки доступа.':'Получишь письмо со ссылкой. Не открывай её: удерживай ссылку в письме, выбери «Скопировать ссылку» и вставь сюда. Если в письме есть код, можно ввести его. Пароль не нужен. Новый аккаунт не получает доступ к чужим данным или админке.';
  if(recovery&&!originalEmail){root.querySelector('#emailRequest').hidden=true;message('У текущего аккаунта не указана почта. Сохрани вход по ключу; переключение здесь пока недоступно.');}
  let requestedEmail=null;
  email.oninput=()=>{requestedEmail=null;verify.hidden=true;root.querySelector('#accountProof').value='';};
  root.querySelector('#emailRequest').onsubmit=event=>{event.preventDefault();return run(async()=>{const address=email.value.trim();await account.requestCode(address,{createAccount:!recovery&&create.checked});if(disposed)return;requestedEmail=address;verify.hidden=false;message('Если отправка разрешена, письмо придёт на указанную почту. Удерживай ссылку в письме → «Скопировать ссылку» → вставь в поле выше. Не переходи по ней: ссылка одноразовая. Если уже открыл её, запроси новое письмо.');});};
  verify.onsubmit=event=>{event.preventDefault();if(!requestedEmail)return;return run(async()=>{const field=root.querySelector('#accountProof'),proof=field.value;field.value='';await account.verifyCode(requestedEmail,proof,{expectedUid:recovery?originalId:null});if(disposed)return;if(recovery){recoveryConfirmed=true;show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Почта подтверждена</h2><p>Ты остаёшься в основном аккаунте. Можно вернуться в него через Face ID или письмо на подтверждённую почту.</p><p id="recoveryAddress"></p><button id="emailOther" type="button" class="rounded-action primary">Войти в другой аккаунт</button><button id="emailDone" type="button" class="rounded-action">Готово</button><p role="status"></p>');root.querySelector('#recoveryAddress').textContent=originalEmail;root.querySelector('#emailOther').onclick=()=>{if(!busy)emailLogin();};root.querySelector('#emailDone').onclick=()=>complete(false);}else complete(false);});};
  root.querySelector('#emailBack').onclick=()=>{if(!busy)login();};
 }
 function login(){
  show('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Войти в AI Marius</h2><p>Используй ключ доступа. iPhone подтвердит вход через Face ID или код устройства.</p><button id="accountKeyLogin" type="button" class="rounded-action primary">Войти с Face ID</button><button id="accountEmailLogin" type="button" class="rounded-action">Войти с электронной почтой</button><p>После входа приложение запомнит тебя до выхода из аккаунта.</p><details><summary>Если ключ ещё не создан</summary><p>Первый ключ нужно привязать к существующему аккаунту после подтверждения доступа. Включение Passkeys в настройках сервера само по себе ключ не создаёт.</p></details><p role="status"></p>');
  root.querySelector('#accountEmailLogin').onclick=()=>{if(!busy)emailLogin();};
  root.querySelector('#accountKeyLogin').onclick=()=>run(async()=>{if(await passkeys.signIn())complete(false);});
  const setupButton=document.createElement('button');setupButton.type='button';setupButton.className='rounded-action';setupButton.textContent='Создать первый ключ';setupButton.id='accountSetup';
  root.querySelector('details').append(setupButton);setupButton.onclick=()=>{if(!busy)setup();};
 }
 function dispose(){if(disposed)return;disposed=true;passkeys.destroy();onBusy(false);}
 if(enroll)enrollment();else if(emailMode)emailLogin();else login();
 return {dispose,cancel(){if(disposed)return;account.epoch++;dispose();}};
}
