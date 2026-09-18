"""Verify exact published bytes and cold browser boot; never claim device Push delivery."""
import concurrent.futures
import hashlib
import json
import os
import pathlib
import time
import urllib.request
from playwright.sync_api import sync_playwright
from build_release import check

ROOT = pathlib.Path('vision-talk/pablicus')
OUT = pathlib.Path('public-evidence');OUT.mkdir(exist_ok=True)
BASE = 'https://matveyryabokon30-crypto.github.io/vision-talk/pablicus/'
SHA = os.environ['GITHUB_SHA']
manifest = json.loads((ROOT / 'release.json').read_text())
checks = []
fatal = None


def digest(b):
    return hashlib.sha256(b).hexdigest()


def fetch(path, cache_bust=True):
    url = BASE + ('' if path == './' else path)
    if cache_bust:
        url += ('&' if '?' in url else '?') + 'verify=' + SHA
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=25) as r:
        return r.read()


def record(name, passed, details=None):
    checks.append(dict(name=name, passed=bool(passed), details=details))
    print(('PASS ' if passed else 'FAIL ') + name, details or '', flush=True)
    if not passed:
        raise AssertionError(name)


try:
    check(ROOT)
    observed = None
    for attempt in range(24):
        try:
            observed = {'sw': digest(fetch('sw.js')), 'index': digest(fetch('index.html')), 'release': digest(fetch('release.json'))}
            if observed == {'sw': manifest['sw_sha256'], 'index': manifest['assets']['index.html'], 'release': digest((ROOT / 'release.json').read_bytes())}:
                break
        except Exception as exc:
            observed = {'network_error': type(exc).__name__}
        time.sleep(10)
    else:
        raise RuntimeError('Exact candidate not served by Pages: ' + json.dumps(observed))
    record('Pages serves exact tested build', True, {'deployment_commit': SHA, 'build_id': manifest['build_id']})

    def verify_asset(item):
        name, expected = item
        try:
            actual = digest(fetch(name))
            return {'path': name, 'pass': actual == expected, 'actual': actual}
        except Exception as exc:
            return {'path': name, 'pass': False, 'error': type(exc).__name__}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        assets = list(executor.map(verify_asset, manifest['assets'].items()))
    record('All published asset bytes match', all(x['pass'] for x in assets), {'verified': len(assets), 'failed': [x for x in assets if not x['pass']]})
    record('Canonical URL has current HTML', digest(fetch('index.html', False)) == manifest['assets']['index.html'])
    record('Canonical worker is current', digest(fetch('sw.js', False)) == manifest['sw_sha256'])
    record('Legacy release manifest agrees', json.loads(fetch('release-p01r2.json')) == manifest)
    for engine in ['chromium', 'webkit']:
        with sync_playwright() as pw:
            browser = getattr(pw, engine).launch(headless=True)
            ctx = browser.new_context();page = ctx.new_page();errors = []
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            page.add_init_script('window.initialNativeFetch=window.fetch;')
            page.goto(BASE, wait_until='domcontentloaded', timeout=45000)
            page.wait_for_function('window.PablicusDebug && window.PablicusBuild', timeout=45000)
            page.wait_for_function('navigator.serviceWorker.controller', timeout=90000)
            page.wait_for_timeout(6500)
            status = page.evaluate('PablicusBuild.inspect()')
            record(engine + ' coherent active build', status['coherent'] and status['buildId'] == status['htmlBuildId'] == status['workerBuildId'] == manifest['build_id'], status)
            record(engine + ' expected worker version', status['workerVersion'] == manifest['worker_version'])
            record(engine + ' P06 modules and native fetch intact', page.evaluate("PablicusDebug.version==='P06' && fetch===initialNativeFetch && !!PablicusMediaCache"))
            record(engine + ' no manual update prompt', page.locator('#updateNotice').is_hidden())
            record(engine + ' no JavaScript exceptions', not errors, errors)
            page.screenshot(path=str(OUT / (engine + '-public-boot.png')))
            browser.close()
except Exception as exc:
    fatal = str(exc)
    if not any(not c['passed'] for c in checks):
        checks.append(dict(name='verification completed', passed=False, details=fatal))
    raise
finally:
    result = dict(deployment_commit=SHA, build_id=manifest['build_id'], release=manifest['release'], passed=sum(c['passed'] for c in checks), failed=sum(not c['passed'] for c in checks), checks=checks, error=fatal, boundary='Unauthenticated public boot and byte integrity. No physical iPhone, lock-screen or Push delivery acceptance.')
    (OUT / 'public-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
