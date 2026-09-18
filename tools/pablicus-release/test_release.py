"""Integrity regression, including deliberately corrupt releases; no external I/O."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from build_release import build, check, digest

ROOT = Path('vision-talk/pablicus')


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'app'
        shutil.copytree(ROOT, self.root)
        self.sha = 'a' * 40
        self.result = build(self.root, self.sha)

    def tearDown(self):
        self.temp.cleanup()

    def test_complete_release(self):
        self.assertEqual(check(self.root)['integrity'], 'PASS')

    def test_repeatable(self):
        before = {p.name: p.read_bytes() for p in self.root.iterdir() if p.is_file()}
        build(self.root, self.sha)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir() if p.is_file()})

    def test_protected_data_and_push_modules_unchanged(self):
        for name in ['app.js', 'auto-update.js', 'push-notifications.js', 'vault.js', 'outbox.js', 'auth-config.js', 'manifest.webmanifest']:
            self.assertEqual((ROOT / name).read_bytes(), (self.root / name).read_bytes(), name)
        for p in (ROOT / 'assets').glob('*'):
            if p.is_file():
                self.assertEqual(p.read_bytes(), (self.root / 'assets' / p.name).read_bytes())
        old = (ROOT / 'sw.js').read_text().split('const PUSH_UUID=', 1)[1]
        new = (self.root / 'sw.js').read_text().split('const PUSH_UUID=', 1)[1]
        self.assertEqual(old, new)

    def test_corrupt_assets_rejected(self):
        for name in ['index.html', 'manifest.webmanifest', 'media-cache.js', 'release-info.js']:
            with self.subTest(asset=name):
                p = self.root / name
                original = p.read_bytes()
                p.write_bytes(original + b'\nCORRUPTED')
                with self.assertRaises((ValueError, json.JSONDecodeError)):
                    check(self.root)
                p.write_bytes(original)

    def test_modified_push_rejected(self):
        p = self.root / 'sw.js'
        p.write_text(p.read_text().replace("const PUSH_UUID=", "/* tampered */const PUSH_UUID=", 1))
        with self.assertRaises(ValueError):
            check(self.root)

    def test_manifest_alias_mismatch_rejected(self):
        p = self.root / 'release-p01r2.json'
        m = json.loads(p.read_text());m['release'] = 'WRONG';p.write_text(json.dumps(m))
        with self.assertRaises(ValueError):
            check(self.root)

    def test_query_versioned_icons_covered(self):
        m = json.loads((self.root / 'release.json').read_text())
        names = [p for p in m['assets'] if '?v=' in p]
        self.assertGreaterEqual(len(names), 4)
        for name in names:
            self.assertEqual(m['assets'][name], digest((self.root / name.split('?')[0]).read_bytes()))

    def test_invalid_source_identity_rejected(self):
        with self.assertRaises(ValueError):
            build(self.root, 'main')


if __name__ == '__main__':
    unittest.main(verbosity=2)
