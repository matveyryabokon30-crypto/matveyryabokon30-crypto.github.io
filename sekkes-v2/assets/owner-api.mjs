import {parseProof} from './account-session.mjs';
export async function ownerRequest(api,path,body){
 if(!['live','status','activate','workspace','instruction','evaluation','document','chat','upload','content'].includes(path))throw Error('INVALID_ROUTE');
 await api.sessionController?.ensureFresh();const epoch=api.authEpoch;if((path==='chat'&&!/^\/(?:memory|memory-test|context-pilot|train)(?:\s|$)/.test(body?.text||''))||(path==='live'&&body?.action==='start'))await api.syncProfile();
 const r=await api.transport(api.config.projectUrl+'/functions/v1/sekkes-owner/'+path,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(135000),headers:{...api.auth(),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(path==='content'&&r.ok){if(epoch!==api.authEpoch)throw Error('AUTH_REQUIRED');return r.blob();}
 let d;try{d=await r.json()}catch{throw Error('SERVICE_UNAVAILABLE')}
 if(epoch!==api.authEpoch)throw Error('AUTH_REQUIRED');if(!r.ok)throw Object.assign(Error(d.code||'SERVICE_UNAVAILABLE'),{code:d.code});return d;
}
export async function ownerCode(account,api,code){
 const email=api.user?.email;if(!email)throw Error('AUTH_REQUIRED');
 if(code===undefined)return account.requestCode(email);
 const proof=parseProof(code,api.config.projectUrl,email);
 const {data,error}=await account.candidate.auth.verifyOtp(proof);if(error)throw error;
 if(data.user?.id!==api.user.id||!data.session?.access_token)throw Error('AUTH_REQUIRED');
 return ownerRequest(api,'activate',{proof:data.session.access_token});
}
