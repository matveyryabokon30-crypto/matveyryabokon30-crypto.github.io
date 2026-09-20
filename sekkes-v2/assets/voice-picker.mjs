import {assessVoice} from './registry-foundation.mjs?v=2026.09.20-s3.27';
import {StaticVoicePreview} from './preview-player.mjs?v=2026.09.20-s3.27';

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
    const heading=document.createElement('h2');heading.textContent='Выбрать голос';heading.id='dialogTitle';
    const intro=document.createElement('p');intro.textContent='Женский голос по умолчанию — Bossa, мужской — Vesper. Здесь можно выбрать другой голос для следующих разговоров.';
    this.activeGender=this.voices.find(v=>v.id===this.preferences.selected)?.gender||'female';
    this.tabs=document.createElement('div');this.tabs.className='voice-tabs';this.tabs.setAttribute('role','tablist');this.tabs.setAttribute('aria-label','Тип голоса');
    for(const [gender,label] of [['female','Женский'],['male','Мужской']]){
      const tab=document.createElement('button');tab.type='button';tab.textContent=label;tab.dataset.gender=gender;tab.id='voice-tab-'+gender;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','voice-options');
      tab.onclick=()=>{this.stopPreview();this.activeGender=gender;this.render();};
      tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'female':e.key==='End'?'male':this.activeGender==='female'?'male':'female';this.tabs.querySelector('[data-gender="'+next+'"]').click();this.tabs.querySelector('[data-gender="'+next+'"]').focus();}};
      this.tabs.append(tab);
    }
    this.list=document.createElement('div');this.list.className='voice-list';this.list.id='voice-options';this.list.setAttribute('role','tabpanel');
    this.message=document.createElement('p');this.message.setAttribute('role','status');this.message.setAttribute('aria-live','polite');
    this.root.replaceChildren(heading,intro,this.tabs,this.list,this.message);
    this.render();
  }
  render() {
    if(!this.opened)return;
    this.list.replaceChildren();
    for(const tab of this.tabs.children){const active=tab.dataset.gender===this.activeGender;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    this.list.setAttribute('aria-labelledby','voice-tab-'+this.activeGender);
    for(const voice of this.voices.filter(v=>v.gender===this.activeGender)) {
      const ready=voice.enabled===true&&assessVoice(voice).length===0;
      const selected=voice.id===this.preferences.selected;
      const row=document.createElement('div');row.className='voice-choice'+(selected?' selected':'');
      const label=document.createElement('div'),name=document.createElement('strong'),hint=document.createElement('small');
      name.textContent=voice.name||voice.id;hint.textContent=(selected?'Выбран':ready?'Русский пример':'Голос ещё не готов')+(voice.default_for_group?' · По умолчанию':'');label.append(name,hint);
      const play=document.createElement('button');play.type='button';play.dataset.preview=voice.id;play.textContent='▶ Послушать';play.disabled=!ready;play.setAttribute('aria-label','Послушать '+name.textContent);
      play.onclick=()=>{
        if(this.isLive())return this.notify('Сначала заверши голосовой разговор.');
        // Audio.play executes synchronously inside this click, preserving iOS activation.
        if(this.playingVoice===voice.id){this.stopPreview();return;}
        try{this.player.play(voice).catch(e=>{if(e?.name!=='AbortError'&&this.opened)this.message.textContent='Не удалось включить пример. Нажми ещё раз.';});}catch{this.message.textContent='Не удалось включить пример. Нажми ещё раз.';}
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
    this.playingVoice=['loading','playing'].includes(state.state)?state.voice:null;
    for(const button of this.list.querySelectorAll('[data-preview]')) {
      const current=button.dataset.preview===state.voice;
      button.textContent=current&&state.state==='loading'?'Загрузка…':current&&state.state==='playing'?'■ Остановить':'▶ Послушать';
    }
    this.message.textContent=state.state==='error'?(errors[state.code]||'Не удалось включить звук. Нажми «Послушать» ещё раз.'):'';
  }
  stopPreview(){this.player.stop();this.playback({state:'idle',voice:null});}
  close(){this.stopPreview();this.opened=false;}
}

