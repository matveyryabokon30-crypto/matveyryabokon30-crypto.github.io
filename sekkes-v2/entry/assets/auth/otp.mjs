import {el} from '../workspace/dom.mjs?v=b6f0181932abbec0bb8575d4b6ee617fbdb4d456b5ce0fd10ef6b98a822c9769';
import {normalizeCode} from './session.mjs?v=0a8014629e5d0ed29e1f9ae51a154358cc0047201795876483fe3f017c0117f8';
import {OTP_LENGTH} from './config.mjs?v=5fec9d163c92bca6718a1263cf258cfb2a716700ef013fcc3947fe48d2cb0dc8';

// Eight visual cells share one native input: AutoFill, paste, selection and
// assistive technology see the complete code, as in native MariusOTPField.
export function createOtpInput({onComplete=()=>{},length=OTP_LENGTH}={}) {
  const element=el('label',{class:'auth-field otp-field'},el('span',{text:'Код из письма'}));
  const wrap=el('div',{class:'otp-wrap'}),grid=el('div',{class:'otp-cells','aria-hidden':'true'});
  const cells=Array.from({length},(_,index)=>el('span',{class:'otp-cell',style:'--slot:'+index},el('span',{class:'otp-digit'})));
  grid.append(...cells);
  const input=el('input',{id:'email-code',name:'one-time-code',type:'text',class:'otp-native',autocomplete:'one-time-code',inputmode:'numeric',autocapitalize:'none',spellcheck:'false',enterkeyhint:'go',pattern:'[0-9]{'+length+'}',required:'','aria-describedby':'code-hint','aria-label':'Код из письма, '+length+' цифр'});
  wrap.append(grid,input);element.append(wrap);let value='',accepted=false;
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  function paint(){
    const next=normalizeCode(input.value).replace(/\D/g,'').slice(0,length);
    if(input.value!==next)input.value=next;
    const focused=document.activeElement===input,start=input.selectionStart??next.length,end=input.selectionEnd??start;
    cells.forEach((cell,index)=>{
      if(value[index]!==next[index]){cell.replaceChildren(el('span',{class:'otp-digit'+(next[index]?' is-arriving':''),text:next[index]||''}));}
      cell.classList.toggle('is-filled',!!next[index]);
      cell.classList.toggle('is-active',focused&&!accepted&&(start===end?index===Math.min(start,length-1):index>=start&&index<end));
    });value=next;
  }
  input.addEventListener('input',()=>{paint();if(value.length===length&&!input.readOnly&&!accepted)onComplete(value);});
  for(const event of ['focus','blur','click','keyup','select'])input.addEventListener(event,paint);
  function selection(){if(document.activeElement===input)paint();}document.addEventListener('selectionchange',selection);
  const resize=()=>{const size=cells[0]?.getBoundingClientRect().width||32;wrap.style.setProperty('--cell-size',size+'px');};
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);observer?.observe(wrap);
  return {element,input,
    setBusy(busy){wrap.classList.toggle('is-checking',busy&&!accepted);input.readOnly=busy;},
    setError(error){wrap.classList.toggle('has-error',!!error);input.setAttribute('aria-invalid',String(!!error));},
    async capture(target){
      accepted=true;input.blur();wrap.classList.remove('is-checking');
      if(reduced())return;
      const aim=target.getBoundingClientRect();
      await Promise.all(cells.map((cell,index)=>{
        const rect=cell.getBoundingClientRect(),x=aim.x+aim.width/2-rect.x-rect.width/2,y=aim.y+aim.height/2-rect.y-rect.height/2;
        if(!cell.animate)return;
        return cell.animate([{transform:'translate(0,0) scale(1)',opacity:1},{offset:.22,transform:'translate(0,8px) scale(1.07)',opacity:1},{transform:'translate('+x+'px,'+y+'px) scale(.12)',opacity:0}],{duration:560,delay:index*32,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'}).finished.catch(()=>{});
      }));
    },
    clear(){input.value='';accepted=false;paint();},
    destroy(){observer?.disconnect();document.removeEventListener('selectionchange',selection);}
  };
}
