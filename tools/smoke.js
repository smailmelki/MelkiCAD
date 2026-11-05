#!/usr/bin/env node
/* اختبار دخان في متصفح حقيقي (اختياري، يحتاج playwright):
 *   npm i -D playwright && npx playwright install chromium
 *   python3 -m http.server 8000 -d src &     # ثم:
 *   node tools/smoke.js http://localhost:8000/
 * يتحقق من: تحميل بلا أخطاء، عدم تنفيذ HTML محقون عبر اسم طبقة مستورد، عدم ظهور
 * نقطة التحذير على ⚙، تنبيه فشل الحفظ، رسم مستطيل، وتخزين الملفات لعمل التطبيق بلا إنترنت. */
const { chromium } = require(process.env.PW_PATH||'playwright');
const url = process.argv[2] || 'http://localhost:8000/';
const assert = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const mk = async sw => { const c = await b.newContext({ viewport: { width: 420, height: 820 }, serviceWorkers: sw }); const p = await c.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e))); await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); await p.goto(url); await p.waitForTimeout(600); return { p, errors }; };

  const { p, errors } = await mk('block');
  assert(errors.length === 0, 'تحميل الصفحة بلا أخطاء JS');

  const x = await p.evaluate(async () => {
    const bad = 'l1" data-x="1';
    impText(JSON.stringify({ app: 'plan', schemaVersion: 2, name: 't', cl: bad,
      LY: [{ id: bad, name: '<img src=x onerror="window.__pwn=1">', vis: 1, lock: 0 }, { id: 'l2', name: 'A&B <b>x</b>', vis: 1, lock: 0 }],
      shapes: [{ t: 'rect', x: 0, y: 0, w: 3, h: 3, ly: bad }] }));
    tool = 'select'; sel = [0]; upd(); draw(); document.querySelector('#op').click();
    await new Promise(r => setTimeout(r, 700));
    const o = document.querySelector('#elementLayer');
    return { pwned: !!window.__pwn, img: !!document.querySelector('#sheet img'), texts: o ? [...o.options].map(q => q.textContent) : [], values: o ? [...o.options].map(q => q.value) : [] };
  });
  assert(!x.pwned && !x.img, 'اسم طبقة مستورد يحتوي HTML لا يُنفَّذ');
  assert(x.texts.includes('<img src=x onerror="window.__pwn=1">') && x.values.includes('l1" data-x="1'), 'الاسم والمعرّف يظهران كنص حرفي سليم');

  const warn = await p.evaluate(() => { document.querySelector('#sheet').classList.remove('on'); for (let i = 0; i < 3; i++) shapes.push({ t: 'rect', x: i * 4, y: 0, w: 2, h: 2, ly: cl }); upd(); return document.querySelector('#stg').classList.contains('warn'); });
  assert(!warn, 'لا نقطة تحذير دائمة على ⚙');

  const st = await p.evaluate(async () => { const o = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('q', 'QuotaExceededError'); }; save(); await new Promise(r => setTimeout(r, 100)); const t = document.querySelector('#tt'); Storage.prototype.setItem = o; return { on: t.classList.contains('on'), txt: t.textContent }; });
  assert(st.on && /تعذّر الحفظ/.test(st.txt), 'فشل الحفظ يُنبَّه عنه المستخدم');

  const d = await p.evaluate(async () => { tool = 'rect'; sel = []; const n = shapes.length, c = document.querySelector('#cv'), r = c.getBoundingClientRect(); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch', isPrimary: true, buttons: 1 })); ev('pointerdown', 100, 300); ev('pointermove', 180, 360); ev('pointermove', 220, 400); ev('pointerup', 220, 400); await new Promise(r => setTimeout(r, 200)); return shapes.length - n; });
  assert(d === 1, 'رسم مستطيل بالمؤشر يعمل');
  assert(errors.length === 0, 'لا أخطاء JS أثناء الاختبارات');

  const { p: q } = await mk('allow');
  await q.evaluate(() => navigator.serviceWorker.ready); await q.waitForTimeout(800);
  const c = await q.evaluate(async () => { const k = await caches.keys(); const n = k.length ? (await (await caches.open(k[0])).keys()).length : 0; return { k, n }; });
  assert(c.k.length === 1 && c.n >= 20, `عامل الخدمة خزّن الملفات (${c.k.join(',')}: ${c.n} ملف)`);
  await b.close();
})();
