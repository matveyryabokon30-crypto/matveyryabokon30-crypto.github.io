// Retain the user-granted capture and playback resources across voice changes.
// The old peer owns neither after transfer, so its delayed cleanup cannot stop them.
export function retainVoiceMedia(session){
 if(!session?.stream||!session.audio)throw Error('MEDIA_UNAVAILABLE');
 const stream=session.stream,audio=session.audio;
 session.stream=null;session.audio=null;
 let owned=true;
 return {
  take(){
   if(!owned)throw Error('MEDIA_ALREADY_TRANSFERRED');
   const tracks=stream.getAudioTracks();
   if(!tracks.length||tracks.some(t=>t.readyState==='ended'))throw Error('MIC_ENDED');
   owned=false;for(const track of tracks)track.enabled=true;
   audio.muted=false;return {stream,audio};
  },
  release(){
   if(!owned)return;owned=false;
   for(const track of stream.getTracks()){try{track.stop()}catch{}}
   try{audio.muted=true;audio.pause();audio.srcObject=null}catch{}
  }
 };
}
