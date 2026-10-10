// Shared account preferences; the existing voice and media runtimes keep ownership
// of their data and session lifecycle. This adapter never signs the user out.
export async function watchAccountPreferences(signal, receive) {
 let sync, stopped=false;
 const stop=()=>{stopped=true;sync?.destroy();receive(null);};
 signal.addEventListener('abort',stop,{once:true});
 try {
  const [{AuthSession,accountStorage},{authConfig},{AccountSync}]=await Promise.all([
   import('../../entry/assets/auth/session.mjs'),
   import('../../entry/assets/auth/config.mjs'),
   import('../../entry/assets/account/sync.mjs'),
  ]);
  if(stopped)return;
  const session=new AuthSession({storageKey:'sekkes-'+authConfig.projectRef+'-auth',onLost:stop});
  const user=await session.restore();if(!user||stopped)return;
  sync=new AccountSync(session,{backing:accountStorage(localStorage,user.id)});
  sync.subscribe(()=>{if(!stopped&&sync.snapshot)receive(sync.snapshot.account.data);});
  sync.start();
 } catch { /* Local preferences remain available when the server is offline. */ }
}
