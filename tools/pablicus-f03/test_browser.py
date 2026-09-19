"""Isolated actual-module browser checks; no production accounts or requests."""
import argparse,json,pathlib
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--engine',choices=['chromium','webkit'],default='chromium');p.add_argument('--output');p.add_argument('--root');args=p.parse_args()
root=pathlib.Path(args.root).resolve() if args.root else pathlib.Path(__file__).resolve().parents[2]
if not (root/'vision-talk/pablicus/contact-discovery.js').exists() and (root/'contact-discovery.js').exists(): root=root.parents[1]
module=(root/'vision-talk/pablicus/contact-discovery.js').read_text()
fixture="""window.calls=[];window.user={id:'fixture-owner'};window.state={search_enabled:true,discoverable_email:false,discoverable_phone:false,verified_email:true,verified_phone:false,revision:1,hidden:[]};window.mode='normal';window.rpc=async(name,args)=>{calls.push(args);if(mode==='late')return new Promise(resolve=>window.resolveLate=resolve);if(args.p_action==='match')return {data:{matches:[{id:'fixture-target',display_name:'Fixture Contact',username:'fixture'}]}};if(args.p_action==='preferences'){Object.assign(state,args.p_input);state.revision++;}if(args.p_action==='hide')state.hidden=[{id:'fixture-target',display_name:'Fixture Contact'}];if(args.p_action==='unhide')state.hidden=[];return {data:structuredClone(state)}};window.api=PablicusContactDiscovery.create({client:{rpc},getUser:()=>user,onSearch:()=>calls.push('search'),onShare:()=>calls.push('share'),onOpen:()=>calls.push('open')});api.mount(document.body);"""
checks=[]
with sync_playwright() as pw:
 browser=getattr(pw,args.engine).launch()
 page=browser.new_page(viewport={'width':390,'height':844})
 page.set_default_timeout(10000)
 def setup(picker=False):
  page.set_content('<!doctype html><html lang="ru"><body></body></html>')
  page.add_script_tag(content=module)
  if picker: page.evaluate("Object.defineProperty(navigator,'contacts',{configurable:true,value:{getProperties:async()=>['name','email','tel'],select:async(props)=>{window.selectedProps=props;return [{email:['fixture@example.test'],tel:[]}]}}})")
  else: page.evaluate("Object.defineProperty(navigator,'contacts',{configurable:true,value:undefined})")
  page.add_script_tag(content=fixture)
  page.get_by_role('button',name='Поиск по контактам',exact=True).click()
  page.get_by_role('button',name='Сохранить согласия').wait_for()
  page.wait_for_function("!document.querySelector('button[type=submit]').disabled")
 def check(name,condition):
  assert condition,name
  checks.append(name)
 setup()
 check('dialog receives keyboard focus',page.locator('dialog').evaluate('(node)=>node.contains(document.activeElement)'))
 page.keyboard.press('Escape')
 check('escape closes dialog',page.locator('dialog').evaluate('(node)=>!node.open'))
 page.get_by_role('button',name='Поиск по контактам',exact=True).click()
 page.wait_for_function("!document.querySelector('button[type=submit]').disabled")
 check('unsupported picker disabled',page.get_by_role('button',name='Выбрать контакты').is_disabled())
 page.get_by_role('button',name='Поиск по имени',exact=True).click()
 check('fallback search callable',page.evaluate("calls.at(-1)==='search'"))
 setup(True)
 page.get_by_role('button',name='Выбрать контакты').click()
 check('selected identifiers not uploaded before confirmation',page.evaluate('calls.length===1'))
 check('picker requests no names',page.evaluate("JSON.stringify(selectedProps)===JSON.stringify(['tel','email'])"))
 page.get_by_role('button',name='Найти выбранные контакты').click()
 page.get_by_role('button',name='Fixture Contact',exact=True).wait_for()
 check('explicit match request',page.evaluate("calls[1].p_action==='match'&&calls[1].p_input.identifiers.length===1"))
 page.get_by_role('button',name='Скрыть из поиска').click()
 page.get_by_role('button',name='Вернуть в поиск').wait_for()
 check('hidden result removed',page.get_by_role('button',name='Fixture Contact',exact=True).count()==0)
 page.get_by_role('button',name='Вернуть в поиск').click()
 page.wait_for_function("!Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Вернуть в поиск')")
 check('unhide explicit',page.evaluate("calls.at(-1).p_action==='unhide'"))
 page.get_by_label('Разрешаю искать выбранные мной контакты',exact=True).uncheck()
 page.get_by_role('button',name='Сохранить согласия').click()
 page.wait_for_function('state.search_enabled===false')
 check('revoke disables picker',page.get_by_role('button',name='Выбрать контакты').is_disabled())
 check('unverified phone cannot opt in',page.get_by_label('Меня можно найти по подтверждённому телефону',exact=True).is_disabled())
 page.evaluate("()=>{api.close();mode='late';void api.open();}")
 page.wait_for_function("typeof resolveLate==='function'")
 page.evaluate("user={id:'different-owner'};api.clear();resolveLate({data:{search_enabled:true}})")
 check('late previous-owner state discarded',page.locator('dialog').evaluate('(node)=>!node.open'))
 browser.close()
result={'engine':args.engine,'passed':len(checks),'checks':checks}
output=pathlib.Path(args.output or f'results/f03-{args.engine}.json');output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
