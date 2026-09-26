const errorText=error=>error?.status===429?'Слишком много попыток. Подожди минуту.':({PHONE_INVALID:'Введи российский мобильный номер: +7 и ещё 10 цифр.',SMS_UNAVAILABLE:'SMS пока не подключены. Выбери вход по почте.',OTP_INVALID:'Введи код или скопированную ссылку из письма.',otp_expired:'Код истёк или уже использован. Запроси новый.',invalid_credentials:'Почта или пароль не подошли.',AUTH_CANCELLED:'Вход отменён.',OWNER_ONLY:'У этого аккаунта пока нет доступа к AI Marius.'}[error?.code]||'Не удалось войти. Проверь подключение и попробуй ещё раз.');
export function openAccountPanel({account,root,show,onSuccess,onAuthenticated=()=>{},onBusy=()=>{},enroll=false,emailMode=false}){
 let disposed=false,busy=false,recoveryConfirmed=false;
 const host=root.closest('dialog');
 if(!document.querySelector('link[data-account-card]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./account-card.css',import.meta.url).href;link.dataset.accountCard='true';document.head.append(link);}
 const render=html=>{host?.classList.add('account-card');root.classList.add('account-card-content');show(html);};
 const originalId=account.api?.user?.id,originalEmail=account.api?.user?.email;
 const message=text=>{if(!disposed)root.querySelector('[role="status"]').textContent=text;};
 const passkeys=account.passkeys(state=>message(state.message));
 const run=async task=>{if(busy||disposed)return;busy=true;onBusy(true);for(const b of root.querySelectorAll('button'))b.disabled=true;
  try{await task();}catch(error){message(errorText(error));}finally{busy=false;onBusy(false);if(!disposed)for(const b of root.querySelectorAll('button'))b.disabled=false;}};
 function enrollment(){
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Face ID</h2><p>Создай ключ доступа на этом устройстве. iPhone предложит подтвердить его через Face ID или код устройства.</p><p>При обычном открытии приложения вход сохраняется автоматически.</p><button type="button" class="rounded-action primary" id="accountPasskey">Подключить Face ID</button><button type="button" class="rounded-action" id="accountContinue">Продолжить</button><p role="status"></p>');
  root.querySelector('#accountPasskey').onclick=()=>run(async()=>{if(await passkeys.register()){root.querySelector('#accountPasskey').hidden=true;message('Ключ доступа сохранён.');}});
  root.querySelector('#accountContinue').onclick=()=>{dispose();onSuccess();};
 }
 function complete(offerEnrollment){if(disposed)return;onAuthenticated();if(offerEnrollment)enrollment();else{dispose();onSuccess();}}
 function setup(){
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Вход с паролем</h2><p>Для аккаунтов, у которых уже есть пароль.</p><form id="accountSetupForm"><label for="accountSetupLogin">Электронная почта</label><input id="accountSetupLogin" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="accountSetupPassword">Пароль</label><input id="accountSetupPassword" type="password" autocomplete="current-password" required><button type="submit" class="rounded-action primary">Войти</button></form><button id="accountSetupBack" type="button" class="rounded-action">Назад</button><p role="status"></p>');
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
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">'+(recovery?'Сохраним твой вход':'Вход по почте')+'</h2><p id="emailExplanation"></p><form id="emailRequest"><label for="accountEmail">Электронная почта</label><input id="accountEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com" maxlength="254" required><label id="emailCreateLabel" class="account-check"><input id="emailCreate" type="checkbox"><span>Создать новый аккаунт</span></label><button type="submit" class="rounded-action primary">Получить код</button></form><form id="emailVerify" hidden><p id="emailDestination"></p><label for="accountProof">Код из письма</label><input id="accountProof" name="verification-code" class="account-code" type="text" inputmode="numeric" autocomplete="one-time-code" autocapitalize="none" spellcheck="false" enterkeyhint="done" placeholder="Введите код" maxlength="10" pattern="[0-9]{6,10}" required aria-describedby="codeHint"><p id="codeHint" class="account-hint">Если iPhone предложит код над клавиатурой — нажми на него.</p><button type="submit" class="rounded-action primary">Войти</button><button id="emailResend" type="button" class="account-text">Отправить код ещё раз</button><button id="emailChange" type="button" class="account-text">Изменить почту</button></form><button id="emailBack" type="button" class="account-text">Другой способ входа</button><p role="status" aria-live="polite"></p>');
  const email=root.querySelector('#accountEmail'),create=root.querySelector('#emailCreate'),verify=root.querySelector('#emailVerify'),request=root.querySelector('#emailRequest'),proof=root.querySelector('#accountProof');
  email.value=recovery?originalEmail||'':'';email.readOnly=recovery;
  root.querySelector('#emailCreateLabel').hidden=recovery;
  root.querySelector('#emailExplanation').textContent=recovery?'Подтверди почту текущего аккаунта перед переключением. Твой ключ доступа сохранится.':'Gmail, Яндекс, Mail.ru и другие адреса. Пароль не нужен.';
  if(recovery&&!originalEmail){request.hidden=true;message('У текущего аккаунта не указана почта. Сохрани вход по ключу; переключение здесь пока недоступно.');}
  let requestedEmail=null,lastSent=0;
  const send=()=>{const address=email.value.trim();request.hidden=true;verify.hidden=false;proof.value='';proof.focus(); // Keep focus inside the original iPhone user gesture.
   root.querySelector('#emailDestination').textContent='Код для '+address;
   return run(async()=>{try{message('Отправляем код…');await account.requestCode(address,{createAccount:!recovery&&create.checked});if(disposed)return;requestedEmail=address;lastSent=Date.now();message('Запрос принят. Проверь входящие и папку «Спам».');}catch(error){if(!disposed){request.hidden=false;verify.hidden=true;}throw error;}});
  };
  request.onsubmit=event=>{event.preventDefault();if(!busy)send();};
  root.querySelector('#emailResend').onclick=()=>{if(busy)return;const left=Math.ceil((60000-(Date.now()-lastSent))/1000);if(left>0){message('Новый код можно запросить через '+left+' с.');return;}send();};
  root.querySelector('#emailChange').onclick=()=>{if(busy)return;requestedEmail=null;proof.value='';verify.hidden=true;request.hidden=false;message('');email.focus();};
  verify.onsubmit=event=>{event.preventDefault();if(!requestedEmail)return;return run(async()=>{const value=proof.value;await account.verifyCode(requestedEmail,value,{expectedUid:recovery?originalId:null});if(disposed)return;proof.value='';if(recovery){recoveryConfirmed=true;render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Почта подтверждена</h2><p>Основной аккаунт сохранён. Теперь можно войти с другой почтой.</p><p id="recoveryAddress"></p><button id="emailOther" type="button" class="rounded-action primary">Войти в другой аккаунт</button><button id="emailDone" type="button" class="account-text">Готово</button><p role="status"></p>');root.querySelector('#recoveryAddress').textContent=originalEmail;root.querySelector('#emailOther').onclick=()=>{if(!busy)emailLogin();};root.querySelector('#emailDone').onclick=()=>complete(false);}else complete(false);});};
  root.querySelector('#emailBack').onclick=()=>{if(!busy)login();};
 }
 function qrLogin(){
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">С другого устройства</h2><p>Войди ключом доступа, сохранённым на другом телефоне. QR-код покажет защищённое окно браузера.</p><button id="accountQRStart" class="rounded-action primary">Продолжить с QR</button><p class="account-hint">Если QR не появился, выбери в системном окне «Другие варианты» → «Другое устройство». Оба устройства должны быть рядом, с включённым Bluetooth.</p><button id="accountQRBack" class="account-text">Назад</button><p role="status" aria-live="polite"></p>');
  root.querySelector('#accountQRStart').onclick=()=>run(async()=>{if(await passkeys.signIn({preferNearby:true}))complete(false);});
  root.querySelector('#accountQRBack').onclick=()=>{if(!busy)login();};
 }
 function phoneLogin(){
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Вход по SMS</h2><p>Для российских мобильных номеров +7.</p><p id="phoneAvailability" role="status">Проверяем доступность…</p><form id="phoneRequest" hidden><label for="accountPhone">Номер телефона</label><input id="accountPhone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 900 123-45-67" required><label class="account-check"><input id="phoneCreate" type="checkbox"><span>Создать новый аккаунт</span></label><button class="rounded-action primary" type="submit">Получить SMS</button></form><form id="phoneVerify" hidden><label for="phoneProof">Код из SMS</label><input id="phoneProof" class="account-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required><button class="rounded-action primary" type="submit">Войти</button></form><button id="phoneBack" class="account-text">Другой способ входа</button>');
  const request=root.querySelector('#phoneRequest'),verify=root.querySelector('#phoneVerify');let requestedPhone=null;
  account.phoneAvailable().then(enabled=>{if(disposed||!request.isConnected)return;request.hidden=!enabled;message(enabled?'Номер должен быть привязан к твоему аккаунту. Новый номер создаёт отдельный аккаунт.':'SMS пока не подключены. Уже можно войти по почте или ключу доступа.');}).catch(()=>{if(!disposed&&request.isConnected)message('Не удалось проверить SMS. Попробуй позже или войди по почте.');});
  request.onsubmit=event=>{event.preventDefault();return run(async()=>{const phone=root.querySelector('#accountPhone').value;requestedPhone=await account.requestPhoneCode(phone,{createAccount:root.querySelector('#phoneCreate').checked});if(disposed)return;request.hidden=true;verify.hidden=false;message('Введи код из SMS.');root.querySelector('#phoneProof').focus();});};
  verify.onsubmit=event=>{event.preventDefault();return run(async()=>{await account.verifyPhoneCode(requestedPhone,root.querySelector('#phoneProof').value);complete(false);});};
  root.querySelector('#phoneBack').onclick=()=>{if(!busy)login();};
 }
 function login(){
  render('<div class="kicker">AI Marius</div><h2 id="dialogTitle">Рады тебя видеть</h2><p>Выбери удобный способ входа</p><div class="account-methods"><button id="accountKeyLogin" class="rounded-action primary"><span class="account-symbol" aria-hidden="true">◎</span><span>Face ID или ключ доступа<small>Также Touch ID и код устройства</small></span></button><button id="accountEmailLogin" class="rounded-action"><span class="account-symbol" aria-hidden="true">@</span><span>Электронная почта<small>Одноразовый код, без пароля</small></span></button><button id="accountQRLogin" class="rounded-action"><span class="account-symbol" aria-hidden="true">▦</span><span>QR-код<small>Ключ с другого устройства</small></span></button><button id="accountPhoneLogin" class="rounded-action"><span class="account-symbol" aria-hidden="true">＋</span><span>Номер телефона<small>SMS · проверка доступности</small></span></button></div><button id="accountSetup" class="account-text">Войти с прежним паролем</button><p role="status" aria-live="polite"></p>');
  root.querySelector('#accountEmailLogin').onclick=()=>{if(!busy)emailLogin();};
  root.querySelector('#accountQRLogin').onclick=()=>{if(!busy)qrLogin();};
  root.querySelector('#accountPhoneLogin').onclick=()=>{if(!busy)phoneLogin();};
  root.querySelector('#accountKeyLogin').onclick=()=>run(async()=>{if(await passkeys.signIn())complete(false);});
  root.querySelector('#accountSetup').onclick=()=>{if(!busy)setup();};
  const smsHint=root.querySelector('#accountPhoneLogin small');
  account.phoneAvailable().then(enabled=>{if(!disposed&&smsHint.isConnected)smsHint.textContent=enabled?'Одноразовый код по SMS':'SMS · скоро';}).catch(()=>{if(!disposed&&smsHint.isConnected)smsHint.textContent='SMS · временно недоступны';});
 }
 function dispose(){if(disposed)return;disposed=true;host?.classList.remove('account-card');root.classList.remove('account-card-content');passkeys.destroy();onBusy(false);}
 if(enroll)enrollment();else if(emailMode)emailLogin();else login();
 return {dispose,cancel(){if(disposed)return;account.epoch++;dispose();}};
}
