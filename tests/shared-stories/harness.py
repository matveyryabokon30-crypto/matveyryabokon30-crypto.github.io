import asyncio,base64,json,time,uuid,mimetypes
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.async_api import async_playwright
ROOT=Path(__file__).parent
A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';CID='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
API='ctcoqgsztdtsazdiwcmd.supabase.co'
def jwt():
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':A,'aud':'authenticated','role':'authenticated','exp':4102444800,'iat':int(time.time())})+'.test_signature'
def profile(id):return {'id':id,'username':'tester' if id==A else 'friend','display_name':'Тестовый профиль' if id==A else 'Длинное имя собеседника','avatar_url':'https://fixture.test/'+id+'.svg','is_approved':True}
class Boundary:
 def __init__(self,root):self.root=root;self.calls=[];self.unknown=[];self.count=1;self.deny=False;self.delay=0;self.sent=[]
 async def handle(self,route):
  req=route.request;u=urlparse(req.url);q=parse_qs(u.query);path=u.path;data=None
  try:data=req.post_data_json
  except:pass
  if u.hostname in ('127.0.0.1','localhost'):
   p=self.root/(path.removeprefix('/pablicus/') or 'index.html')
   if p.is_file():return await route.fulfill(status=200,content_type=mimetypes.guess_type(p.name)[0] or 'application/octet-stream',body=p.read_bytes())
   return await route.fulfill(status=404,body='Not found')
  self.calls.append([req.method,path])
  if u.hostname=='fixture.test':
   color='#23899c' if A in path else '#ab4160'
   return await route.fulfill(status=200,content_type='image/svg+xml',body=f'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="{color}"/><circle cx="120" cy="88" r="42" fill="#f5d2ab"/><path d="M40 240V190Q120 100 200 190V240" fill="#12334d"/></svg>')
  if u.hostname!=API:return await route.abort()
  if req.method=='OPTIONS':return await route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'})
  result=[]
  if path=='/auth/v1/user':result={'id':A,'aud':'authenticated','role':'authenticated','email':'fixture@example.test','user_metadata':{}}
  elif path=='/rest/v1/profiles':
   ident=q.get('id',['eq.'+A])[0][3:];result=profile(ident) if ident in (A,B) else [profile(A),profile(B)]
  elif path.startswith('/rest/v1/rpc/'):
   name=path.split('/')[-1]
   if name in ['my_conversations_v3','my_conversations_v2']:
    result=[{'id':CID if i==0 else str(uuid.UUID(int=i+33)),'conversation_id':CID if i==0 else str(uuid.UUID(int=i+33)),'type':'direct','title':'Длинное имя собеседника '+str(i+1),'last_message':'Проверка сообщений','last_seq':60,'last_message_at':'2026-09-17T10:00:00Z','unread_count':0,'pinned':False,'muted':False,'archived':False} for i in range(self.count)]
   elif name=='pablicus_contact_card':result={'kind':'contact','conversation_id':data['p_conversation_id'],'conversation_ids':[data['p_conversation_id']],'profile':profile(B),'personal':{'first_name':'','last_name':'','note':'','revision':1}}
   elif name=='pablicus_story_feed':result={'server_now':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'stories':[{'id':str(uuid.UUID(int=(1 if id==A else 2)*100+i+1)),'owner_id':id,'body':'Тестовая история '+str(i+1),'created_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'expires_at':'2099-01-01T00:00:00Z','media':{'path':id+'/fixture.'+('mp4' if i==1 else 'png'),'type':'video' if i==1 else 'image'}} for id in data['p_owners'] for i in range(2)]}
   elif name=='pablicus_profile_photos_list':result={'owner_id':data['p_owner_id'],'photos':[{'path':'https://fixture.test/'+data['p_owner_id']+'.svg','is_main':True}],'total':1,'next_offset':None}
   elif name=='pablicus_contact_activity':result={'status':'recent','status_form':'neutral'}
   elif name=='pablicus_touch_activity':result={'status_form':'neutral'}
   elif name in ['mark_conversation_read','pablicus_set_chat_preference']:result={}
   elif name=='send_rich_message':
    self.sent.append(data);result={'id':str(uuid.uuid4()),'server_seq':61,'client_message_id':data['p_client_message_id'],'conversation_id':data['p_conversation_id']}
   elif name=='pablicus_get_canvas':result={'conversation_id':CID,'tasks':[],'participants':[],'plan':{'body':''}}
   else:self.unknown.append(path)
  elif path=='/rest/v1/messages':
   result=[{'id':str(uuid.UUID(int=i+500)),'conversation_id':CID,'server_seq':i,'sender_id':A if i%2 else B,'body':'Сообщение '+str(i),'type':'text','created_at':'2026-09-17T10:00:00Z','edited_at':None,'deleted_at':None} for i in range(1,61)]
   seq=q.get('server_seq',[''])[0]
   if seq.startswith('gt.'):result=[r for r in result if r['server_seq']>int(seq[3:])]
   if seq.startswith('lt.'):result=[r for r in result if r['server_seq']<int(seq[3:])]
   if 'desc' in q.get('order',[''])[0]:result.reverse()
  elif path=='/rest/v1/conversation_members':result=[{'conversation_id':CID,'user_id':id,'last_read_seq':60} for id in [A,B]]
  elif path=='/rest/v1/conversations':result=[{'id':CID,'type':'direct'}]
  elif path=='/rest/v1/pablicus_profile_details':result={'owner_id':A,'bio':'Описание тестового профиля','phone':None,'birthday':None}
  elif path.startswith('/storage/v1/object/sign/') and req.method=='POST':result={'signedURL':path.removeprefix('/storage/v1')+'?token=fixture'}
  elif path.startswith('/storage/v1/object/'):
   if self.delay:await asyncio.sleep(self.delay)
   if self.deny:return await route.fulfill(status=403,body='Forbidden')
   f=ROOT/('fixture.mp4' if path.endswith('mp4') else 'fixture.png')
   return await route.fulfill(status=200,content_type='video/mp4' if f.suffix=='.mp4' else 'image/png',body=f.read_bytes())
  else:self.unknown.append(path)
  return await route.fulfill(status=200,content_type='application/json',headers={'access-control-allow-origin':'*'},body=json.dumps(result))
 async def boot(self,browser,width=390,height=844):
  ctx=await browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,service_workers='block')
  session={'access_token':jwt(),'refresh_token':'fixture','token_type':'bearer','expires_in':86400000,'expires_at':4102444800,'user':{'id':A,'email':'fixture@example.test','aud':'authenticated','role':'authenticated'}}
  await ctx.add_init_script("localStorage.setItem('sb-ctcoqgsztdtsazdiwcmd-auth-token',"+json.dumps(json.dumps(session))+")")
  await ctx.route('**/*',self.handle)
  await ctx.route_web_socket('**/*',lambda ws:ws.on_message(lambda raw: None))
  p=await ctx.new_page();p.errors=[];p.on('pageerror',lambda e:p.errors.append(str(e)));p.set_default_timeout(8000)
  await p.goto('http://127.0.0.1:8123/pablicus/',wait_until='domcontentloaded');await p.wait_for_timeout(1500)
  return ctx,p
