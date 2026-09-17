/* Actual Edge handler and SDK against an isolated Auth/Storage HTTP fixture.
 * No production account, token, or private media. The SDK uses GET /object/<bucket>/<path>.
 */
const original=await Deno.readFile('results/fixtures/original.jpg');const checks:any[]=[],store=new Map<string,Uint8Array>();let access=true,downloads=0,rpc=0,originalWrites=0,wrongScope=0;const requests:string[]=[];
function check(name:string,pass:boolean,details:unknown=null){checks.push({name,pass,details});console.log(pass?'PASS':'FAIL',name);if(!pass)throw Error(name);}
const svc=Deno.serve({hostname:'127.0.0.1',port:0,onListen:()=>{}},async req=>{
 const url=new URL(req.url),path=decodeURIComponent(url.pathname),auth=req.headers.get('authorization');requests.push(req.method+' '+path);
 const user=auth==='Bearer test-user',admin=auth==='Bearer service-test';
 if(path==='/auth/v1/user')return user?Response.json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid'}):Response.json({msg:'Invalid token'},{status:401});
 if(path==='/rest/v1/rpc/pablicus_media_describe'){rpc++;if(!user){wrongScope++;return Response.json([],{status:403});}const b=await req.json();return Response.json(access?b.p_items.filter((x:any)=>x.path==='source.jpg').map((x:any)=>({...x,object_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',version:'v1',bytes:original.length,mime:'image/jpeg'})):[]);}
 if(path==='/storage/v1/bucket/pablicus-media-previews')return admin?Response.json({id:'pablicus-media-previews',name:'pablicus-media-previews',public:false}):Response.json({message:'forbidden'},{status:403});
 if(path.startsWith('/storage/v1/object/sign/')){
  const rest=path.slice('/storage/v1/object/sign/'.length),parts=rest.split('/'),bucket=parts.shift()!,file=parts.join('/'),body=await req.json();
  if(bucket==='pablicus-media-previews'&&!admin)return Response.json({message:'forbidden'},{status:403});
  if(bucket!=='pablicus-media-previews'&&!user){wrongScope++;return Response.json({message:'forbidden'},{status:403});}
  const signed=(p:string)=>bucket==='pablicus-media-previews'&&!store.has(p)?{path:p,error:'Object not found',signedURL:null}:{path:p,error:null,signedURL:'/object/sign/'+bucket+'/'+p+'?token=fixture'};
  if(body.paths)return Response.json(body.paths.map(signed));
  const value=signed(file);return value.error?Response.json({message:value.error},{status:404}):Response.json({signedURL:value.signedURL});
 }
 if(path==='/storage/v1/object/message-media/source.jpg'&&req.method==='GET'){
  if(!user||!access){wrongScope++;return Response.json({message:'forbidden'},{status:403});}downloads++;return new Response(original,{headers:{'content-type':'image/jpeg'}});
 }
 if(path.startsWith('/storage/v1/object/')&&req.method==='POST'){
  const rest=path.slice('/storage/v1/object/'.length),bucket=rest.split('/')[0],p=rest.slice(bucket.length+1);
  if(bucket!=='pablicus-media-previews'){originalWrites++;return Response.json({message:'forbidden'},{status:403});}
  if(!admin)return Response.json({message:'forbidden'},{status:403});
  store.set(p,new Uint8Array(await req.arrayBuffer()));return Response.json({Key:bucket+'/'+p,Id:'fixture'});
 }
 return Response.json({message:'Unexpected fixture request',path},{status:404});
});
const port=(svc.addr as Deno.NetAddr).port;Deno.env.set('SUPABASE_URL','http://127.0.0.1:'+port);Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','service-test');Deno.env.set('SUPABASE_ANON_KEY','anon-test');
const{handle}=await import('./backend/index.ts');const item={bucket:'message-media',path:'source.jpg',width:960};
async function call(body:any,token:string|null='test-user'){return await handle(new Request('http://local/preview',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));}
try{
 check('endpoint rejects missing user token',(await call({action:'resolve',items:[item]},null)).status===401);
 check('service credential is not accepted as user identity',(await call({action:'resolve',items:[item]},'service-test')).status===401);
 const cold=await(await call({action:'resolve',items:[item]})).json();check('missing derivative returns authorized original lease',cold.items[0].kind==='original'&&cold.items[0].canPrepare===true&&downloads===0);
 const br=await call({action:'build',items:[item]}),built=await br.json();check('real handler builds three private image sizes',br.ok&&built.kind==='preview'&&store.size===3,{status:br.status,body:built,stored:store.size});
 check('original is fetched once using user authorization',downloads===1&&wrongScope===0);
 const ready=await(await call({action:'resolve',items:[item]})).json();check('subsequent client receives a small derivative',ready.items[0].kind==='preview'&&store.get([...store.keys()].find(x=>x.endsWith('/960.webp'))!)!.length<original.length*.4);
 await call({action:'build',items:[item]});check('repeat preparation reuses derivatives',downloads===1&&store.size===3);
 access=false;const denied=await(await call({action:'resolve',items:[item]})).json();check('revoked source permission cannot issue preview capability',denied.items[0].error==='not_available'&&!denied.items[0].url);
 check('revoked source cannot trigger build',(await call({action:'build',items:[item]})).status===403);
 check('originals and source policy were not mutated',originalWrites===0&&wrongScope===0);
 check('invalid bucket is rejected',(await call({action:'resolve',items:[{...item,bucket:'other'}]})).status===400);
 check('batch size is limited',(await call({action:'resolve',items:Array.from({length:25},()=>item)})).status===400);
}catch(e){checks.push({name:'handler integration failure',pass:false,details:String(e)});console.error(e);}finally{await svc.shutdown();await Deno.writeTextFile('results/p02-backend.json',JSON.stringify({passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).length,checks,fixture:'actual Edge handler + SDK + WASM, isolated local Auth/Storage; no production identity',downloads,rpc,requests,storedSizes:[...store].map(([path,b])=>({size:Number(path.match(/(\d+)\.webp$/)?.[1]),bytes:b.length}))},null,2));}
if(checks.some(x=>!x.pass))Deno.exit(1);
