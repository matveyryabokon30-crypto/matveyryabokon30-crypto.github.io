import {assessVoice} from '../../vnext-foundation/foundation.mjs';
import {StaticVoicePreview} from '../../vnext-foundation/preview-player.mjs?v=20260919.2';

const errors={AUDIO_GESTURE_REQUIRED:'Нажми «Послушать» ещё раз, чтобы включить звук.',AUDIO_ASSET_ERROR:'Не удалось загрузить пример. Попробуй ещё раз.',AUDIO_LOAD_TIMEOUT:'Пример загружается слишком долго. Попробуй ещё раз.'};
export class VoicePicker {
  constructor({root,voices,preferences,isLive=()=>false,notify=()=>{},audioFactory=()=>new Audio(),origin=location.origin}) {
    Object.assign(this,{root,voices,preferences,isLive,notify});
    this.player=new StaticVoicePreview({audioFactory,origin,onState:s=>this.playback(s)});
    this.opened=false;
  }
  open() {
    if(this.isLive())return this.notify('Сначала заверши голосовой разговор.');
    this.close();this.opened=true;
    const heading=document.createElement('h2');heading.textContent='Выбери голос';
    const intro=document.createElement('p');intro.textContent='Прослушай русский пример. Выбранный голос будет звучать в следующем разговоре.';
    this.list=document.createElement('div');this.list.className='voice-list';
    this.message=document.createElement('p');this.message.setAttribute('role','status');this.message.setAttribute('aria-live','polite');
    this.root.replaceChildren(heading,intro,this.list,this.message);
    this.render();
  }
  render() {
    if(!this.opened)return;
    this.list.replaceChildren();
    for(const voice of this.voices) {
      const ready=voice.enabled===true&&assessVoice(voice).length===0;
      const selected=voice.id===this.preferences.selected;
      const row=document.createElement('div');row.className='voice-choice'+(selected?' selected':'');
      const label=document.createElement('div'),name=document.createElement('strong'),hint=document.createElement('small');
      name.textContent=voice.name||voice.id;hint.textContent=selected?'Выбран':ready?'Русский пример':'Голос ещё не готов';label.append(name,hint);
      const play=document.createElement('button');play.type='button';play.dataset.preview=voice.id;play.textContent='▶ Послушать';play.disabled=!ready;play.setAttribute('aria-label','Послушать '+name.textContent);
      play.onclick=()=>{
        if(this.isLive())return this.notify('Сначала заверши голосовой разговор.');
        // Audio.play executes synchronously inside this click, preserving iOS activation.
        this.player.play(voice).catch(()=>{});
      };
      const choose=document.createElement('button');choose.type='button';choose.dataset.select=voice.id;choose.textContent=selected?'✓ Выбран':'Выбрать';choose.setAttribute('aria-label','Выбрать '+name.textContent);choose.setAttribute('aria-pressed',String(selected));choose.disabled=!ready||this.preferences.busy;
      choose.onclick=async()=>{
        if(this.isLive())return this.notify('Сначала заверши голосовой разговор.');
        this.player.stop();
        if(!this.preferences.loaded){this.message.textContent='Войди в SEKKES, чтобы сохранить голос в профиле.';return;}
        const saved=this.preferences.select(voice.id);this.render();
        try{await saved;if(this.opened)this.message.textContent='Голос сохранён для следующего разговора.';}
        catch{if(this.opened)this.message.textContent='Не удалось сохранить голос. Попробуй ещё раз.';}
        finally{this.render();}
      };
      row.append(label,play,choose);this.list.append(row);
    }
  }
  playback(state) {
    if(!this.opened)return;
    for(const button of this.list.querySelectorAll('[data-preview]')) {
      const current=button.dataset.preview===state.voice;
      button.textContent=current&&state.state==='loading'?'Загрузка…':current&&state.state==='playing'?'Играет…':'▶ Послушать';
    }
    this.message.textContent=state.state==='error'?(errors[state.code]||'Не удалось включить звук. Нажми «Послушать» ещё раз.'):'';
  }
  close(){this.opened=false;this.player.stop();}
}
