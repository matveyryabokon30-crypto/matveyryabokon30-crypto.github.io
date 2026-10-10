import {createClient} from '../vendor/supabase.mjs?v=4eecaf1050cef8cc64c9b347c3a31e511209d3c40c1b11debd06ccd7efadb447';
import {authConfig, OTP_LENGTH, PASSKEY_RP} from './config.mjs?v=5fec9d163c92bca6718a1263cf258cfb2a716700ef013fcc3947fe48d2cb0dc8';
import {SekkesPasskeys} from './passkeys.mjs?v=4f38dd19ca3695fc4e0bc446b907eda55f77872a17cd88058289341d3832cc8c';

const fail = code => Object.assign(new Error(code), {code});
export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('EMAIL_INVALID');
  return email;
}
export function normalizeCode(value) { return String(value || '').replace(/[\s-]/g, ''); }
export function passkeyOriginAllowed(hostname) { return hostname === PASSKEY_RP || hostname.endsWith('.' + PASSKEY_RP); }
export function authMessage(error) {
  const code = error?.code || error?.name;
  if (['OWNER_ONLY','MEMBER_REQUIRED','FORBIDDEN','ACCESS_PENDING'].includes(code)) return 'Почта подтверждена. Доступ к тестовой версии пока открывается по приглашению.';
  if (['over_email_send_rate_limit','over_request_rate_limit','LOGIN_RATE_LIMIT'].includes(code) || error?.status === 429) return 'Код уже запрошен. Подождите немного и попробуйте ещё раз.';
  if (code === 'EMAIL_INVALID') return 'Проверьте адрес электронной почты.';
  if (['OTP_INVALID','otp_expired'].includes(code)) return 'Проверьте код из последнего письма или запросите новый.';
  if (['invalid_credentials','LOGIN_FAILED','email_not_confirmed'].includes(code)) return 'Не удалось войти. Проверьте данные или выберите код из почты.';
  if (['signup_disabled','user_not_found'].includes(code)) return 'Не удалось отправить код. Проверьте адрес или выберите создание аккаунта.';
  if (code === 'PASSKEY_ORIGIN') return 'Этот ключ привязан к действующему сайту AI Marius. Здесь пока используйте вход по почте.';
  if (code === 'AUTH_CANCELLED') return 'Вход отменён. Можно попробовать снова.';
  if (code === 'AUTH_REQUIRED') return 'Сеанс не подтверждён. Запросите новый код и повторите вход.';
  if (code === 'ORIGIN_DENIED') return 'Этот адрес страницы ещё не подключён к сервису входа.';
  if (code === 'ADMISSION_UNAVAILABLE') return 'Не удалось проверить доступ к AI Marius. Попробуйте ещё раз.';
  if (code === 'STORAGE_UNAVAILABLE') return 'Браузер не разрешил сохранить вход. Разрешите хранение данных для этого сайта и повторите.';
  return 'Не удалось связаться с сервисом входа. Проверьте соединение и повторите.';
}

// A candidate never becomes a persistent session before server identity and admission checks.
export class AuthSession {
  constructor({factory = createClient, transport = globalThis.fetch, storage = globalThis.localStorage, config = authConfig, storageKey, onLost = () => {}} = {}) {
    this.config = config; this.storage = storage; this.user = null; this.epoch = 0; this.onLost = onLost; this.pendingAdmission = null;
    this.key = storageKey || 'ai-marius:' + config.projectRef + ':auth:v1';
    this.transport = (url, init = {}) => transport(url, {...init, signal: init.signal || AbortSignal.timeout(20000)});
    const auth = {flowType:'pkce', detectSessionInUrl:false, experimental:{passkey:true}};
    this.client = factory(config.projectUrl, config.publishableKey, {auth:{...auth, storage, storageKey:this.key, persistSession:true, autoRefreshToken:true}, global:{fetch:this.transport}});
    this.candidate = factory(config.projectUrl, config.publishableKey, {auth:{...auth, storageKey:this.key + ':candidate', persistSession:false, autoRefreshToken:false}, global:{fetch:this.transport}});
    this.client.auth.onAuthStateChange((event, session) => {
      if (this.user && (event === 'SIGNED_OUT' || session?.user?.id !== this.user.id)) {
        this.user = null; this.epoch++; queueMicrotask(onLost);
      }
    });
  }
  async validate(session, epoch) {
    if (!session?.access_token || !session?.user?.id) throw fail('AUTH_REQUIRED');
    const {data, error} = await this.client.auth.getUser(session.access_token);
    if (error || !data?.user?.id || data.user.id !== session.user.id || data.user.is_anonymous || !data.user.email_confirmed_at) throw fail('AUTH_REQUIRED');
    let response,body;
    try{
      response = await this.transport(this.config.projectUrl + '/functions/v1/marius-site-admission', {
        headers:{apikey:this.config.functionsKey, Authorization:'Bearer ' + session.access_token}, cache:'no-store', redirect:'error',
      });
      body=await response.json();
    }catch{throw fail('ADMISSION_UNAVAILABLE');}
    if(!response.ok)throw fail(body?.code||'ADMISSION_UNAVAILABLE');
    if(body?.admitted!==true||body.userId!==data.user.id)throw fail('ADMISSION_UNAVAILABLE');
    if (epoch !== this.epoch) throw fail('AUTH_CANCELLED');
    return data.user;
  }
  async restore() {
    const epoch = this.epoch;
    const {data, error} = await this.client.auth.getSession();
    if (error) throw error;
    if (!data?.session) return null;
    const user = await this.validate(data.session, epoch);
    this.user = user; return user;
  }
  async admit(session, epoch = this.epoch) {
    const user = await this.validate(session, epoch);
    // Verify persistence before asking the SDK to commit a session.
    try { this.storage.setItem(this.key + ':probe', '1'); this.storage.removeItem(this.key + ':probe'); }
    catch { throw fail('STORAGE_UNAVAILABLE'); }
    if (epoch !== this.epoch) throw fail('AUTH_CANCELLED');
    const {error} = await this.client.auth.setSession({access_token:session.access_token, refresh_token:session.refresh_token});
    if (error) throw error;
    if (epoch !== this.epoch) { await this.signOut(); throw fail('AUTH_CANCELLED'); }
    this.user = user; return user;
  }
  async requestCode(value, {createAccount = false} = {}) {
    const email = normalizeEmail(value);
    const {error} = await this.candidate.auth.signInWithOtp({email, options:{shouldCreateUser:createAccount}});
    if (error) throw error;
    this.pendingAdmission = null;
    return email;
  }
  async verifyCode(value, proof) {
    const email = normalizeEmail(value), token = normalizeCode(proof), epoch = this.epoch;
    if (!new RegExp('^\\d{' + OTP_LENGTH + '}$').test(token)) throw fail('OTP_INVALID');
    const {data, error} = await this.candidate.auth.verifyOtp({email, token, type:'email'});
    if (error) throw error;
    if (data?.user?.email?.toLowerCase() !== email) throw fail('LOGIN_FAILED');
    this.pendingAdmission={session:data.session,epoch};
    return this.resumeAdmission();
  }
  async resumeAdmission(){
    const pending=this.pendingAdmission;
    if(!pending||pending.epoch!==this.epoch)throw fail('AUTH_REQUIRED');
    try{const user=await this.admit(pending.session,pending.epoch);this.pendingAdmission=null;return user;}
    catch(error){
      if(['ADMISSION_UNAVAILABLE','ACCESS_PENDING','ORIGIN_DENIED'].includes(error.code))error.admissionPending=true;
      else this.pendingAdmission=null;
      throw error;
    }
  }
  async password(value, password) {
    const email = normalizeEmail(value), epoch = this.epoch;
    if (!password || password.length > 512) throw fail('LOGIN_FAILED');
    const {data, error} = await this.candidate.auth.signInWithPassword({email, password});
    if (error) throw error;
    return this.admit(data.session, epoch);
  }
  async passkey(hostname = location.hostname) {
    if (!passkeyOriginAllowed(hostname)) throw fail('PASSKEY_ORIGIN');
    const epoch = this.epoch;
    const controller = SekkesPasskeys.create({client:this.client, signInClient:this.candidate, enabled:true,
      authenticate:async session => { await this.admit(session, epoch); return true; }});
    try {
      if (!await controller.signIn()) throw Object.assign(fail('PASSKEY_FAILED'), {displayMessage:controller.snapshot().message});
      return this.user;
    } finally { controller.destroy(); }
  }
  async signOut() {
    this.epoch++; this.user = null; this.pendingAdmission=null;
    for (const suffix of ['', '-user', '-code-verifier']) { try { this.storage.removeItem(this.key + suffix); } catch {} }
    await this.client.auth.signOut({scope:'local'});
  }
}

export function accountStorage(storage, uid) {
  if (!/^[a-f0-9-]{36}$/i.test(uid || '')) throw fail('AUTH_REQUIRED');
  const prefix = 'ai-marius:user:' + uid + ':';
  return {getItem:key => storage.getItem(prefix + key), setItem:(key, value) => storage.setItem(prefix + key, value), removeItem:key => storage.removeItem(prefix + key)};
}
