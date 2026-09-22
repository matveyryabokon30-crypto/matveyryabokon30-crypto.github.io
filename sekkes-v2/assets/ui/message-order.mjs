export function messagePosition(previous,serverAt,now=()=>new Date().toISOString()){
 return previous||serverAt||now();
}
export function compareMessages(a,b){return (a.at||'').localeCompare(b.at||'')||(a.messageId||'').localeCompare(b.messageId||'');}
