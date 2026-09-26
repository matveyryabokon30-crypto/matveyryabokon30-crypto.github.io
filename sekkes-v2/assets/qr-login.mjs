import qrcode from './vendor/qr-generator.mjs';
export async function qrRequest(account,action,values={},authenticated=false){
 const headers={apikey:account.api.config.publishableKey,'Content-Type':'application/json'};
 if(authenticated){await account.ensureFresh();headers.Authorization='Bearer '+account.api.token;}
 const response=await account.api.transport(account.api.config.projectUrl+'/functions/v1/marius-qr-login',{method:'POST',headers,body:JSON.stringify({action,...values}),signal:AbortSignal.timeout(15000)});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'QR_FAILED'),{code:data.error||'QR_FAILED'});return data;
}
export function qrImage(text){const code=qrcode(0,'M');code.addData(text);code.make();return code.createDataURL(5,20);}
export function receiveQr(account,{onCode,onState,onComplete}){
 let stopped=false,finished=false,admitting=false,request=null,timer=null;const epoch=account.epoch;
 const cancel=()=>{if(admitting&&!finished&&account.epoch===epoch)account.epoch++;stopped=true;clearTimeout(timer);if(request)void qrRequest(account,'cancel',{poll:request.poll}).catch(()=>{});};
 const expired=()=>{onState('Код истёк. Нажми «Обновить QR».');cancel();};
 (async()=>{try{
  request=await qrRequest(account,'create');if(stopped){cancel();return;}
  const url=new URL(location.pathname,location.origin);url.hash='qr='+request.scan;
  onCode({image:qrImage(url.href),code:request.code,expiresAt:request.expiresAt});
  const poll=async()=>{if(stopped)return;if(Date.now()>=Date.parse(request.expiresAt)){expired();return;}
   try{const result=await qrRequest(account,'poll',{poll:request.poll});if(stopped)return;
    if(result.state==='expired'){expired();return;}
    if(result.state==='approved'){
     admitting=true;const {data,error}=await account.candidate.auth.verifyOtp({token_hash:result.tokenHash,type:'email'});
     if(stopped||account.epoch!==epoch)return;if(error)throw error;if(data.user?.id!==result.userId)throw Error('QR_IDENTITY_MISMATCH');
     await account.admit(data.session,epoch);if(stopped||account.epoch!==epoch)return;finished=true;stopped=true;onComplete();return;
    }
    timer=setTimeout(poll,2000);
   }catch(error){if(account.epoch!==epoch)return;onState('Не удалось завершить вход. Обнови QR и попробуй ещё раз.');cancel();}
  };timer=setTimeout(poll,1500);
 }catch(error){if(!stopped){onState(error?.code==='RATE_LIMIT'?'Слишком много запросов. Подожди две минуты.':'QR не загрузился. Нажми «Обновить QR».');cancel();}}
 })();return {cancel};
}
