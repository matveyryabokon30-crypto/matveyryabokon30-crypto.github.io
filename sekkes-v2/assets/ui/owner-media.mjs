export const ACCEPT='.pdf,.txt,.md,.csv,.docx,.pptx,.xlsx,image/*,video/mp4,video/quicktime,video/webm,audio/mp4,audio/mpeg,audio/wav,audio/webm,.m4a,.mp3,.wav,.webm,.mov,.mp4';
const mimeByExt={pdf:'application/pdf',txt:'text/plain',md:'text/markdown',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
export const base64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)};
function event(node,name){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>end(Error('MEDIA_DECODE_FAILED')),15000);const yes=()=>end(),no=()=>end(Error('MEDIA_DECODE_FAILED'));function end(e){clearTimeout(timer);node.removeEventListener(name,yes);node.removeEventListener('error',no);e?reject(e):resolve()}node.addEventListener(name,yes,{once:true});node.addEventListener('error',no,{once:true})})}
function frame(source,max=1280){const w=source.videoWidth||source.naturalWidth,h=source.videoHeight||source.naturalHeight;if(!w||!h)throw Error('MEDIA_DECODE_FAILED');const scale=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d').drawImage(source,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.75).split(',')[1]}
export async function prepareFile(file){
 if(file.size>10*1024*1024)throw Error('MEDIA_TOO_LARGE');if(!file.size)throw Error('INVALID_MEDIA');
 let mime=file.type.split(';')[0]||mimeByExt[file.name.split('.').pop().toLowerCase()],name=file.name,data,frames=[],duration=null;const url=URL.createObjectURL(file);
 try{
  if(mime?.startsWith('image/')){const img=new Image(),ready=event(img,'load');img.src=url;await ready;data=frame(img,1536);mime='image/jpeg';name=name.replace(/\.[^.]+$/,'')+'.jpg';}
  else {mime=(mime==='audio/webm'?'audio/webm':mimeByExt[file.name.split('.').pop().toLowerCase()])||mime;data=base64(new Uint8Array(await file.arrayBuffer()));}
  if(mime?.startsWith('video/')){const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';const ready=event(video,'loadeddata');video.src=url;video.load();try{await ready;duration=video.duration;if(!Number.isFinite(duration)||duration<=0||duration>180)throw Error('VIDEO_TOO_LONG');for(let i=0;i<6;i++){const at=Math.min(duration*.99,Math.max(.001,duration*i/5));if(Math.abs(video.currentTime-at)>.0001){const seek=event(video,'seeked');video.currentTime=at;await seek;}frames.push({at:Math.max(0,at),data:frame(video,640)});}}finally{video.removeAttribute('src');video.load();}}
  const supported=Object.values(mimeByExt).includes(mime)||mime==='image/jpeg'||mime==='audio/webm';if(!supported)throw Error('UNSUPPORTED_FILE');
  return {id:crypto.randomUUID(),name,mime,data,frames,duration};
 }finally{URL.revokeObjectURL(url)}
}
export function bundleBlob(b){const bytes=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));return new Blob([bytes],{type:b.mime})}
