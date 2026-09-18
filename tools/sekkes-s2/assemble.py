"""Build S2 from the exact existing S1 static shell. Browser assets only."""
from pathlib import Path
import hashlib,json,sys
P=Path(sys.argv[1] if len(sys.argv)>1 else 'sekkes-v2')
OLD={'index.html':'6d0276784eff4f1a9328e3f37fc76f56b4fe5410','assets/ui-s1-1.js':'7ded0bfc25272994afc6b4fcad2a5467d596126c','assets/ui-s1-1.css':'768c525a73282fd41625b2f8bf43a788cf593dea','sw.js':'7445b632e2e2e42c24d1240a1d322495f9dc3816'}
for n,h in OLD.items():
 b=(P/n).read_bytes();actual=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 if actual!=h:raise SystemExit('Unexpected baseline '+n+' — reconcile instead of overwrite.')
V='2026.09.18-s2.3'
s=(P/'assets/ui-s1-1.js').read_text().replace('2026.09.18-s1.1',V)
s=s.replace("$('#micButton').addEventListener('click', () => {", "$('#micButton').addEventListener('click', () => {\n    if (window.SekkesS2) { if (route === 'text') window.SekkesS2.sendText(); else { setRoute('ai'); window.SekkesS2.toggleMic(); } return; }\n    notify('Подключение загружается. Попробуй через несколько секунд.'); return;")
s=s.replace("$('#micTestLink').addEventListener('click', () => { if (mic || micPending) stopMic(); else openDialog('mic'); });", "$('#micTestLink').addEventListener('click', () => { if(window.SekkesS2)window.SekkesS2.toggleMic(); else notify('Подключение ещё загружается.'); });")
s=s.replace('app.dataset.route = route;',"app.dataset.route = route;\n    window.dispatchEvent(new CustomEvent('sekkes:route',{detail:{route}}));")
s=s.replace('function canReload() { return !document.hidden', 'function canReload() { return !window.SekkesS2?.dirty && !document.hidden')
s=s.replace('if (previous !== route) stopMic();','if (previous !== route && !window.SekkesS2) stopMic();')
s=s.replace('if (document.hidden) stopMic(); else','if (document.hidden) { if(!window.SekkesS2)stopMic(); } else')
s=s.replace("addEventListener('pagehide', stopMic);", "addEventListener('pagehide',()=>{if(!window.SekkesS2)stopMic();});")
s=s.replace('<span>Личная память AI</span><span class="hint">Не подключена</span>', '<span>Личный AI</span><button id="s2ProfileLogin" class="text-link" style="color:#24474b">Вход / память</button>')
s=s.replace('Сейчас здесь проверяется новый интерфейс. Учётная запись, личная память и AI не подключены. Сохраняются только выбранная палитра и настройка движения.', 'Закрытый тест S2. Войти можно со своей учётной записью SEKKES AI. Память — только из фактов, которые ты отдельно сохраняешь. Пароль и история разговора на устройстве не сохраняются.')
s=s.replace('Дизайн-кандидат S1.<br>Без трекеров, записи звука и отправки текста.', 'S2 · первый живой тест.<br>Голос и текст отправляются только после входа, согласия и твоего действия.')
s=s.replace("if (name === 'profile') {", "if (name === 'profile') {\n      $('#s2ProfileLogin').addEventListener('click',()=>{if(window.SekkesS2)window.SekkesS2.login();else notify('Подключение загружается.');});")
(P/'assets/ui-s2-3.js').write_text(s)
h=(P/'index.html').read_text().replace('2026.09.18-s1.1',V).replace('assets/ui-s1-1.js','assets/ui-s2-3.js').replace('AI пока не подключён','Войди в SEKKES для разговора').replace('maxlength="4000"','maxlength="2000"')
h=h.replace('Пока AI не подключён, текст никуда не отправляется и не сохраняется.','Текст отправляется после входа и согласия. Долгосрочная память по умолчанию выключена.')
h=h.replace('Голос или текст.<br>Выбирай, как тебе удобнее.','Скажи одну фразу и отправь.<br>Ответ можно слушать или читать.').replace('Проверить микрофон','Войти и начать')
h=h.replace('<title>SEKKES</title>','<link rel="stylesheet" href="assets/voice-s2-3.css">\n<title>SEKKES</title>')
h=h.replace('</body></html>','<script type="module" src="assets/voice-s2-3.mjs"></script>\n</body></html>')
(P/'index.html').write_text(h)
sw=(P/'sw.js').read_text().replace('2026.09.18-s1.1',V).replace("'assets/ui-s1-1.js'", "'assets/ui-s2-3.js','assets/voice-s2-3.mjs','assets/voice-s2-3.css','assets/s2-api-3.mjs','assets/voice-capture-3.mjs','assets/voice-worklet-3.mjs'")
sw=sw.replace("if (url.pathname === new URL('version.json', BASE).pathname)","if (['version.json','s2-config.json'].some(p=>url.pathname===new URL(p,BASE).pathname))")
(P/'sw.js').write_text(sw)
(P/'version.json').write_text(json.dumps({'app':'sekkes-v2','version':V,'stage':'S2_OWNER_PILOT_REAL_TEST_PENDING','ai_server_wired':True,'ai_connected':False,'live_validated':False,'game001_playable':False,'world_running':False},separators=(',',':'))+'\n')
print('S2 shell assembled; baseline geometry preserved; no provider calls.')
