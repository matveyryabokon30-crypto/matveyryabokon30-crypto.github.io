import {parseProof} from './account-session.mjs';
export async function ownerRequest(api,path,body){
 if(!['status','activate','workspace','document','chat'].includes(path))throw Error('INVALID_ROUTE');
 await api.sessionController?.ensureFresh();const epoch=api.authEpoch;
 const r=await api.transport(api.config.projectUrl+'/functions/v1/sekkes-owner/'+path,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(80000),headers:{...api.auth(),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
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
