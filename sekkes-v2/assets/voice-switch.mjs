// Switching changes transport + saved voice, never the account or conversation store.
export class VoiceSwitch {
 constructor({close,flush,select,start,isCurrent,onState=()=>{},onError=()=>{}}){Object.assign(this,{close,flush,select,start,isCurrent,onState,onError});this.pending=false;this.epoch=0;}
 cancel(){++this.epoch;}
 async run(target){
  if(this.pending||!['vera','marius'].includes(target))return false;
  this.pending=true;const epoch=++this.epoch;
  const check=()=>{if(epoch!==this.epoch||!this.isCurrent())throw Error('CANCELLED');};
  try{
   check();this.onState(target);
   // Finish and persist the old transport before opening another one.
   await this.close();check();await this.flush();check();
   await this.select(target==='vera'?'bossa':'vesper');check();
   await this.start();check();return true;
  }catch(e){if(e.message!=='CANCELLED')this.onError(e);return false;}
  finally{this.pending=false;}
 }
}
