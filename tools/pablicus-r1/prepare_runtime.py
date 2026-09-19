from pathlib import Path
root=Path('vision-talk/pablicus')
p=root/'push-notifications.js';s=p.read_text();original=s
if 'function installationMetadata' not in s:
 s=s.replace('let generation=0,enabled=false,', 'let installationId=null,trackingState="unknown";\n  let generation=0,enabled=false,')
 marker='  async function request(method,body,uid){'
 metadata='''  function installationMetadata(uid){
    try{const key='pablicus:r1:client:'+uid;let id=root.localStorage.getItem(key);
     if(!UUID.test(id||'')){id=root.crypto.randomUUID();root.localStorage.setItem(key,id);}
     const build=root.PablicusBuild?.id;if(!/^git:[a-f0-9]{40}$/.test(build||''))return null;
     const platform=needsInstall()?'web_ios':/Android/.test(navigator.userAgent)?'web_android':'web_other';
     return{client_id:id,build_id:build,platform};
    }catch{return null;}
   }
 '''
 s=s.replace(marker,metadata+marker)
 s=s.replace("   const raw=await options.getSession()", "   if(body?.action==='subscribe'){const meta=installationMetadata(uid);if(meta)body={...body,installation:meta};}\n   const raw=await options.getSession()")
 s=s.replace("return data;}\n   finally", "if(body?.action==='subscribe'&&options.getUserId()===uid){installationId=UUID.test(data.installation_id||'')?data.installation_id:null;trackingState=data.tracking||'unknown';}return data;}\n   finally")
 s=s.replace("const uid=options.getUserId(),priorOwner=readOwner();++generation;", "const uid=options.getUserId(),priorOwner=readOwner();installationId=null;trackingState='detached';++generation;")
 s=s.replace("  return{mount,refresh,enable,disable,signOut,clear,destroy,get enabled(){return enabled;}};", "  async function inspect(){const uid=options.getUserId();if(!uid||!installationId)return{tracking:trackingState,installation_id:null,banner_visibility:'unknown'};return request('POST',{action:'status',installation_id:installationId},uid);}\n  return{mount,refresh,enable,disable,signOut,clear,destroy,inspect,get enabled(){return enabled;}};")
 assert 'installation:meta' in s and 'trackingState=data.tracking' in s and 'inspect,get enabled' in s
 p.write_text(s)

p=root/'sw.js';s=p.read_text();handlers=Path('tools/pablicus-r1/push_handlers.js').read_text()
if '// F02-R1 observations' not in s:
 s=s[:s.index("self.addEventListener('push',")]+handlers
 p.write_text(s)
p=Path('tools/pablicus-release/build_release.py');s=p.read_text().replace('F02-R0','F02-R1');p.write_text(s)
p=Path('tools/pablicus-release/test_browser_release.py');s=p.read_text().replace("initial=='pablicus-shell-f01-20260918'", "initial==json.loads((baseline/'release.json').read_text())['worker_version']");p.write_text(s)
