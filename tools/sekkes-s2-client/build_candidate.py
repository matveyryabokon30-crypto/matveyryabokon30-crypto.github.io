"""Generate only SEKKES assets from the exact existing S1. No production push."""
from pathlib import Path
import hashlib, json, shutil
root=Path('sekkes-v2'); out=Path('sekkes-qa/candidate');out.mkdir(parents=True,exist_ok=True)
expected={'index.html':'6d0276784eff4f1a9328e3f37fc76f56b4fe5410','assets/ui-s1-1.css':'768c525a73282fd41625b2f8bf43a788cf593dea','assets/ui-s1-1.js':'7ded0bfc25272994afc6b4fcad2a5467d596126c','sw.js':'7445b632e2e2e42c24d1240a1d322495f9dc3816'}
for name,sha in expected.items():
 b=(root/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==sha, 'Baseline changed: '+name
shutil.copytree(root,out,dirs_exist_ok=True)
js=(root/'assets/ui-s1-1.js').read_text().replace("const BUILD = '2026.09.18-s1.1';","const BUILD = '2026.09.18-s2.3';")
js=js.replace("$('#micButton').addEventListener('click', () => {","$('#micButton').addEventListener('click', () => {\n    if (window.SekkesS2) { if (route === 'text') window.SekkesS2.sendText(); else { setRoute('ai'); window.SekkesS2.toggleMic(); } return; }")
js=js.replace("$('#micTestLink').addEventListener('click', () => { if (mic || micPending) stopMic(); else openDialog('mic'); });","$('#micTestLink').addEventListener('click', () => { if (window.SekkesS2) { window.SekkesS2.toggleMic(); return; } if (mic || micPending) stopMic(); else openDialog('mic'); });")
js=js.replace('app.dataset.route = route;',"app.dataset.route = route;\n    window.dispatchEvent(new CustomEvent('sekkes:route', { detail: { route } }));")
js=js.replace('function canReload() { return !document.hidden','function canReload() { return !window.SekkesS2?.dirty && !document.hidden')
js=js.replace('if (previous !== route) stopMic();','if (previous !== route && !window.SekkesS2) stopMic();')
js=js.replace('if (document.hidden) stopMic(); else','if (document.hidden) { if (!window.SekkesS2) stopMic(); } else')
js=js.replace("addEventListener('pagehide', stopMic);","addEventListener('pagehide', () => { if (!window.SekkesS2) stopMic(); });")
js=js.replace("const trigger = e.target.closest('[data-open]');","const trigger = e.target.closest('[data-open]');\n    if (trigger?.dataset.open === 'profile' && window.SekkesS2) { window.SekkesS2.account(); return; }")
(out/'assets/ui-s2-3.js').write_text(js)
html=(root/'index.html').read_text().replace('2026.09.18-s1.1','2026.09.18-s2.3').replace('assets/ui-s1-1.js','assets/ui-s2-3.js')
html=html.replace('<title>SEKKES</title>','<link rel="stylesheet" href="assets/voice-s2.css">\n<title>SEKKES</title>')
html=html.replace('</body>','<script type="module" src="assets/voice-s2.mjs"></script>\n</body>')
assert html.count('src="assets/voice-s2.mjs"')==1
html=html.replace('Пока AI не подключён, текст никуда не отправляется и не сохраняется.','Отправка — только после входа и согласия. AI может ошибаться; это закрытый тест.').replace('maxlength="4000"','maxlength="2000"').replace('AI пока не подключён','Подключаем тестовый вход…').replace('Голос или текст.<br>Выбирай, как тебе удобнее.','Говори фразой, затем отправь.<br>Ответит искусственный интеллект.')
(out/'index.html').write_text(html)
sw=(root/'sw.js').read_text().replace('2026.09.18-s1.1','2026.09.18-s2.3').replace("'assets/ui-s1-1.js'","'assets/ui-s2-3.js', 'assets/voice-s2.mjs', 'assets/voice-s2.css', 'assets/voice-capture.mjs', 'assets/voice-worklet.mjs', 'assets/s2-api.mjs'")
sw=sw.replace("if (url.pathname === new URL('version.json', BASE).pathname)","if (['version.json','s2-config.json'].some(p => url.pathname === new URL(p, BASE).pathname))")
(out/'sw.js').write_text(sw)
(out/'version.json').write_text(json.dumps({'app':'sekkes-v2','version':'2026.09.18-s2.3','stage':'S2_OWNER_PILOT_PENDING_FIRST_LIVE_TURN','backend_configured':True,'login_connected':True,'live_validated':False,'ai_connected':False,'game001_playable':False,'world_running':False},separators=(',',':'))+'\n')
print('Candidate generated. S1 CSS and other apps unchanged. Not published.')
