"""Real outbox/IndexedDB, current pump/upload code, bundled SDK. HTTP responses
are an isolated contract fixture, NOT a real recipient or production delivery.
"""
import argparse,json,pathlib,re,hashlib,traceback
from urllib.parse import urlparse,parse_qs,unquote
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--engine',default='chromium');p.add_argument('--executable');p.add_argument('--baseline',action='store_true');a=p.parse_args()
r=pathlib.Path(a.root);out=pathlib.Path('results');out.mkdir(exist_ok=True);checks=[]
UID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';CHAT='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
objects={};messages={};calls=[];fault={'rpc':None};errors=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'details':detail});print(('PASS ' if ok else 'FAIL ')+name,detail or '',flush=True)
 if not ok:raise AssertionError(name)
def route(req):
 u=urlparse(req.request.url);path=unquote(u.path);data=req.request.post_data_buffer
 def answer(body,status=200):return req.fulfill(status=status,content_type='application/json',body=json.dumps(body))
 if u.hostname!='fixture.test':raise AssertionError('Unexpected external network '+u.hostname)
 if path=='/':return req.fulfill(status=200,content_type='text/html',body='<!doctype html><html><body></body></html>')
 if path.startswith('/storage/v1/object/sign/message-media/'):
  key=path.split('/sign/message-media/')[1]
  return answer({'signedURL':'/object/sign/message-media/'+key+'?token=fixture'} if key in objects else {'message':'Object not found'},200 if key in objects else 400)
 if path.startswith('/storage/v1/object/message-media/'):
  key=path.split('/object/message-media/')[1]
  if req.request.method=='POST':
   objects.setdefault(key,{'bytes':data,'mime':req.request.headers.get('content-type')});calls.append('upload');return answer({'Key':'message-media/'+key,'Id':'fixture-object'})
 if path=='/rest/v1/messages':
  q=parse_qs(u.query);cid=q.get('client_message_id',['eq.'])[0][3:]
  return answer([messages[cid]] if cid in messages else [])
 if path.startswith('/rest/v1/rpc/send_'):
  content=json.loads(data);cid=content['p_client_message_id'];calls.append(path.rsplit('/',1)[1])
  if fault['rpc']=='reject':return answer({'message':'invalid attachment MIME','code':'22023'},400)
  if path.endswith('send_rich_message'):
   for b in content['p_content']['blocks']:
    if b['type']=='text':continue
    obj=objects.get(b['path']);assert obj and len(obj['bytes'])==b['size'] and obj['mime']==b['mime'],'uploaded bytes or MIME mismatch'
  msg={'id':cid,'client_message_id':cid,'server_seq':len(messages)+1,'conversation_id':content['p_conversation_id'],'type':'rich' if 'p_content' in content else content.get('p_type','text'),'attachment_metadata':content.get('p_content')}
  messages.setdefault(cid,msg)
  if fault['rpc']=='lost':fault['rpc']=None;return req.abort('failed')
  return answer(messages[cid])
 return answer({'message':'Unhandled fixture path '+path},404)
source=(r/'app.js').read_text();chunk=source[source.index(' async function objectExists('):source.index(' async function showOutbox(')]
setup=f'''
const URL='https://fixture.test',KEY='fixture-key',BUCKET='message-media';
const timeoutFetch=async(u,opts={{}})=>fetch(u,opts);
const sb=supabase.createClient(URL,KEY,{{accessToken:async()=> 'fixture-token',auth:{{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}}});
let user={{id:'{UID}'}},current={{id:'{CHAT}'}},dialogs=[current],worker=false,pumpPending=false;
const toast=message=>logs.push(message),problem=e=>logs.push(e.message),syncMessages=async()=>{{syncs++}};
window.logs=[];window.syncs=0;window.PablicusMediaCache={{prepare:()=>new Promise(()=>{{}})}};
window.store=new PablicusRichStore(user.id,current.id);
window.PablicusChat={{scope:{{user:user.id,chat:current.id}},store,refreshQueue:async()=>store.readQueue()}};
window.seed=async (text,photo=false)=>{{let d=await store.read();const blocks=[{{id:crypto.randomUUID(),type:'text',text}}],files=[];if(photo){{const id=crypto.randomUUID(),file=new File([new Uint8Array([1,2,3,4,5])],'test.jpg',{{type:'image/jpeg'}});files.push({{id,file,name:file.name,type:file.type,size:file.size,lastModified:file.lastModified,kind:'image'}});blocks.push({{id:crypto.randomUUID(),type:'image',assetId:id}});}}await store.write({{...DraftVault.empty(),text,blocks,files}},d?.revision||0);d=await store.read();return (await store.enqueue(d.intent,d.revision)).item.id;}};
'''
with sync_playwright() as pw:
 opts={'headless':True}
 if a.executable:opts['executable_path']=a.executable
 browser=getattr(pw,a.engine).launch(**opts);ctx=browser.new_context();page=ctx.new_page();page.route('**/*',route);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto('https://fixture.test')
  for f in ['vendor/supabase.js','vault.js','outbox.js','transport-store.js','rich-store.js']:page.add_script_tag(content=(r/f).read_text())
  page.add_script_tag(content='(()=>{'+setup+chunk+'\nwindow.run=pump;window.sendStep=typeof sendStep==="function"?sendStep:null;window.setDialogs=v=>dialogs=v;window.sendState=()=>({worker,pumpPending});})();')
  blocked=page.evaluate("async()=>{const id=await seed('Broken old media');await store.change(id,r=>{r.state='error';r.retryable=false;r.error={message:'Old upload failed'};});return id;}")
  good=page.evaluate("seed('New text must send')");page.evaluate('run()')
  if a.baseline:
   check('UI-V4 permanently failed item blocks new text before any HTTP send',not messages and len(page.evaluate('store.readQueue(false)'))==2)
  else:
   check('new text passes a failed older item and is server-acknowledged',len(messages)==1)
   queue=page.evaluate('store.readQueue(false)');check('failed item stays visible and its identity is not erased',len(queue)==1 and queue[0]['id']==blocked and queue[0]['state']=='error')
   page.evaluate('setDialogs([])');page.evaluate("seed('Current chat without dialogs')");page.evaluate('run()');check('current chat sends before it exists in dialog snapshot',len(messages)==2)
   page.evaluate(f"setDialogs([{{id:'{CHAT}'}}])")
   page.evaluate("seed('Photo and text',true)");page.evaluate('run()');check('image bytes upload then rich RPC acknowledges despite hanging optional preview',len(messages)==3 and len(objects)==1)
   check('actual uploaded bytes and MIME match the queued file',next(iter(objects.values()))=={'bytes':bytes([1,2,3,4,5]),'mime':'image/jpeg'})
   check('fully acknowledged rich send leaves no active queue row',len(page.evaluate('store.readQueue(false)'))==1)
   failed=page.evaluate("seed('Server rejects only this attempt')");fault['rpc']='reject';page.evaluate('run()');fault['rpc']=None
   page.evaluate("seed('After server rejection')");page.evaluate('run()');check('new messages still send after a server rejection',len(messages)==4)
   check('server rejection retained as error rather than false sent',any(x['id']==failed and x['state']=='error' for x in page.evaluate('store.readQueue(false)')))
   lost=page.evaluate("seed('Lost response')");fault['rpc']='lost';page.evaluate('run()');before=len(messages);rpc_count=len(calls)
   page.evaluate('(id)=>store.retry(id)',lost);page.evaluate('run()')
   check('lost acknowledgement retry has no duplicate server message',len(messages)==before and len(calls)==rpc_count)
   check('reconciled acknowledgement removes only that queued item',not any(x['id']==lost for x in page.evaluate('store.readQueue(false)')))
   leased=page.evaluate("seed('Another tab owns this')");page.evaluate('(id)=>store.claim(id,"other-tab")',leased);before=len(messages);page.evaluate('run()');check('unexpired foreign lease is never stolen',len(messages)==before)
   page.evaluate('(id)=>store.change(id,r=>{r.lease.until=Date.now()-1})',leased);page.evaluate('run()');check('expired sending lease is recovered with stable message ID',len(messages)==before+1)
   check('renew refuses a different owner',page.evaluate('(id)=>store.renew(id,"wrong")',blocked) is None)
   timeout=page.evaluate('async()=>{try{await sendStep(()=>new Promise(()=>{}),null,25);return null;}catch(e){return e.name}}')
   check('pre-fetch/SDK wait is bounded even when promise never settles',timeout=='TimeoutError')
   cancelled=page.evaluate('async()=>{const c=new AbortController();c.abort();let invoked=false;try{await sendStep(()=>{invoked=true},c.signal,25)}catch{}return !invoked}')
   check('already cancelled stage cannot start transport',cancelled)
   check('worker is released after all completed and failed items',page.evaluate('sendState().worker') is False)
   check('no JavaScript exceptions in native IndexedDB and bundled SDK flow',not errors,errors)
 except Exception as e:
  checks.append({'name':'suite completion','passed':False,'details':str(e),'traceback':traceback.format_exc()});print(traceback.format_exc())
 finally:
  result={'passed':sum(x['passed'] for x in checks),'failed':sum(not x['passed'] for x in checks),'checks':checks,'source_sha256':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['app.js','transport-store.js','chat.js']},'boundary':'Real local stores and current pump with bundled SDK; isolated mocked HTTP. No real account, recipient or production message.'}
  (out/('send-v5-'+a.engine+('-baseline' if a.baseline else '')+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));browser.close()
if result['failed']:raise SystemExit(1)
