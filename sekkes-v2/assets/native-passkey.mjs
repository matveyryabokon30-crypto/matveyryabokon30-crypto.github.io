// No session tokens, network requests, storage, telemetry, or third-party scripts.
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), x=>x.charCodeAt(0));
const encode = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const button = document.querySelector('#confirm'), status = document.querySelector('#status');
let input;
try {
  input = JSON.parse(new TextDecoder().decode(decode(location.hash.slice(1))));
  history.replaceState(null,'',location.pathname);
  if (!/^[0-9a-f-]{36}$/i.test(input.state) || typeof input.registration !== 'boolean' || !input.options) throw Error();
  const rp = input.registration ? input.options.rp?.id : input.options.rpId;
  if (rp !== location.hostname) throw Error();
  document.querySelector('#description').textContent = input.registration
    ? 'Создайте ключ в Apple «Пароли» и подтвердите его через Face ID. После этого пароль вводить не потребуется.'
    : 'Выберите сохранённый ключ Мариуса в Apple «Пароли» и подтвердите вход через Face ID.';
  button.textContent = input.registration ? 'Создать ключ входа' : 'Войти с ключом';
} catch {
  button.disabled = true; status.textContent = 'Откройте создание ключа из приложения Мариус.';
}
button.addEventListener('click', async () => {
  button.disabled = true; status.textContent = '';
  try {
    const options = structuredClone(input.options);
    options.challenge = decode(options.challenge);
    if (input.registration) {
      options.user.id = decode(options.user.id);
      options.authenticatorSelection = {...options.authenticatorSelection, authenticatorAttachment:'platform', residentKey:'required', userVerification:'required'};
      options.attestation = 'none';
      options.excludeCredentials = (options.excludeCredentials || []).map(x=>({...x,id:decode(x.id)}));
    } else {
      options.userVerification = 'required';
      options.allowCredentials = (options.allowCredentials || []).map(x=>({...x,id:decode(x.id)}));
    }
    const credential = input.registration
      ? await navigator.credentials.create({publicKey:options}) : await navigator.credentials.get({publicKey:options});
    if (!credential) throw Error();
    const response = {clientDataJSON:encode(credential.response.clientDataJSON)};
    if (input.registration) {
      response.attestationObject = encode(credential.response.attestationObject);
      response.transports = credential.response.getTransports?.() || [];
    } else {
      response.authenticatorData = encode(credential.response.authenticatorData);
      response.signature = encode(credential.response.signature);
      response.userHandle = credential.response.userHandle ? encode(credential.response.userHandle) : null;
    }
    const result = {id:credential.id,rawId:encode(credential.rawId),type:credential.type,response,
      authenticatorAttachment:credential.authenticatorAttachment,clientExtensionResults:credential.getClientExtensionResults()};
    const callback = new URL('marius://passkey');
    callback.searchParams.set('state',input.state);
    callback.searchParams.set('credential',btoa(JSON.stringify(result)));
    location.replace(callback.href);
  } catch {
    status.textContent = 'Подтверждение отменено или ключ недоступен. Можно повторить.';
    button.disabled = false;
  }
});
