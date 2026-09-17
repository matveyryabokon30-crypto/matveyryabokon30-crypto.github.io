/* P02: real user JWT + original Storage RLS on every request. No admin-entry route.
 * Derivatives are private, keyed by immutable source object/version; originals are never written.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const PROJECT=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(PROJECT,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const PREVIEWS='pablicus-media-previews',BUCKETS=new Set(['message-media','profile-media','pablicus-story-media']),SIZES=[192,960,1600],TTL=120,MAX_SOURCE=16*1024*1024;
const jobs=new Map<string,Promise<any>>();let bucketReady=false;
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const cors={'Access-Control-Allow-Origin':'https://matveyryabokon30-crypto.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
function validate(v:any){if(!v||!BUCKETS.has(v.bucket)||typeof v.path!=='string'||!v.path||v.path.length>1024||v.path.startsWith('/')||v.path.includes('..')||v.path.includes('://')||/[\x00-\x1f]/.test(v.path)||!SIZES.includes(v.width))throw Error('invalid_item');return{bucket:v.bucket,path:v.path,width:v.width};}
async function ensureBucket(){if(bucketReady)return;const r=await admin.storage.getBucket(PREVIEWS);if(r.data){if(r.data.public)throw Error('preview_bucket_must_be_private');bucketReady=true;return;}const c=await admin.storage.createBucket(PREVIEWS,{public:false,fileSizeLimit:4*1024*1024,allowedMimeTypes:['image/webp']});if(c.error){const again=await admin.storage.getBucket(PREVIEWS);if(!again.data||again.data.public)throw Error('preview_bucket_unavailable');}bucketReady=true;}
async function baseKey(row:any){return row.object_id+'/'+await digest('p02-v1:'+row.version)+'/';}
async function describe(client:any,items:any[]){const r=await client.rpc('pablicus_media_describe',{p_items:items.map(({bucket,path})=>({bucket,path}))});if(r.error)throw Error('authorization_unavailable');return r.data||[];}
async function sourceURL(client:any,row:any){const r=await client.storage.from(row.bucket).createSignedUrl(row.path,TTL);if(r.error||!r.data?.signedUrl)throw Error('source_unavailable');return r.data.signedUrl;}
async function current(client:any,item:any,row:any){const rows=await describe(client,[item]);return rows.some((r:any)=>r.bucket===row.bucket&&r.path===row.path&&r.object_id===row.object_id&&r.version===row.version);}
async function build(client:any,row:any){
 if(!['image/jpeg','image/png','image/webp'].includes(row.mime)||row.bytes>MAX_SOURCE)return{status:'original'};
 const key=await baseKey(row),previous=jobs.get(key);if(previous)return previous;if(jobs.size>=4)throw Error('preparation_busy');
 const job=(async()=>{await ensureBucket();const existing=await admin.storage.from(PREVIEWS).createSignedUrls(SIZES.map(s=>key+s+'.webp'),TTL);
 if(existing.data?.length===SIZES.length&&existing.data.every((x:any)=>x.signedUrl&&!x.error))return{status:'ready'};
 const downloaded=await client.storage.from(row.bucket).download(row.path);if(downloaded.error||!downloaded.data)throw Error('source_unavailable');if(downloaded.data.size>MAX_SOURCE)throw Error('source_limit');
 const bytes=new Uint8Array(await downloaded.data.arrayBuffer());const{derivatives}=await import('./raster.ts');let outputs;
 try{outputs=await derivatives(bytes,row.mime);}catch(e){if(['unsupported_source','image_dimensions_limit'].includes((e as Error).message))return{status:'original'};throw e;}
 for(const o of outputs){const path=key+o.size+'.webp';const r=await admin.storage.from(PREVIEWS).upload(path,o.bytes,{contentType:'image/webp',upsert:false,cacheControl:'3600'});if(r.error){const exists=await admin.storage.from(PREVIEWS).createSignedUrl(path,TTL);if(exists.error)throw Error('preview_write_failed');}}
 return{status:'ready'};})();jobs.set(key,job);try{return await job;}finally{jobs.delete(key);}
}
export async function handle(req:Request):Promise<Response>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return reply({error:'method_not_allowed'},405);if(Number(req.headers.get('content-length')||0)>32768)return reply({error:'request_limit'},413);
 try{const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return reply({error:'unauthorized'},401);const identity=await admin.auth.getUser(authorization.slice(7));if(identity.error||!identity.data.user)return reply({error:'unauthorized'},401);
 const client=createClient(PROJECT,ANON,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const text=await req.text();if(text.length>32768)return reply({error:'request_limit'},413);const body=JSON.parse(text);
 if(!['build','resolve'].includes(body.action))return reply({error:'invalid_action'},400);
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>24)return reply({error:'invalid_items'},400);const items=body.items.map(validate),rows=await describe(client,items);
 if(body.action==='build'){
  if(items.length!==1)return reply({error:'one_build_per_request'},400);const item=items[0],row=rows.find((r:any)=>r.bucket===item.bucket&&r.path===item.path);if(!row)return reply({error:'not_available'},403);
  const result=await build(client,row);if(!await current(client,item,row))return reply({error:'not_available'},403);
  if(result.status!=='ready')return reply({...item,url:await sourceURL(client,row),kind:'original',sourceVersion:row.version,sourceBytes:row.bytes,expiresIn:105});
  const signed=await admin.storage.from(PREVIEWS).createSignedUrl(await baseKey(row)+item.width+'.webp',TTL);if(signed.error)throw Error('preview_unavailable');
  return reply({...item,url:signed.data.signedUrl,kind:'preview',sourceVersion:row.version,sourceBytes:row.bytes,expiresIn:105});
 }
 const authorized=[];for(const item of items){const row=rows.find((r:any)=>r.bucket===item.bucket&&r.path===item.path);if(row)authorized.push({item,row,previewPath:await baseKey(row)+item.width+'.webp'});}
 const signed=authorized.length?await admin.storage.from(PREVIEWS).createSignedUrls(authorized.map(x=>x.previewPath),TTL):{data:[]};const byPath=new Map((signed.data||[]).map((x:any)=>[x.path,x]));
 const results=await Promise.all(items.map(async item=>{const found=authorized.find(x=>x.item===item);if(!found)return{...item,error:'not_available'};const{row,previewPath}=found;const preview:any=byPath.get(previewPath);if(preview?.signedUrl&&!preview.error)return{...item,url:preview.signedUrl,kind:'preview',sourceVersion:row.version,sourceBytes:row.bytes,expiresIn:105};try{return{...item,url:await sourceURL(client,row),kind:'original',sourceVersion:row.version,sourceBytes:row.bytes,expiresIn:105,canPrepare:['image/jpeg','image/png','image/webp'].includes(row.mime)&&row.bytes<=MAX_SOURCE};}catch{return{...item,error:'not_available'};}}));return reply({release:'P02',items:results});
 }catch{return reply({error:'preview_unavailable'},400);}
}
if(import.meta.main)Deno.serve(handle);
