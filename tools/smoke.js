#!/usr/bin/env node
/* اختبار دخان في متصفح حقيقي (اختياري، يحتاج playwright):
 *   npm i -D playwright && npx playwright install chromium
 *   python3 -m http.server 8000 -d src &     # ثم:
 *   node tools/smoke.js http://localhost:8000/
 * يتحقق من: تحميل بلا أخطاء، عدم تنفيذ HTML محقون عبر اسم طبقة مستورد، عدم ظهور
 * نقطة التحذير على ⚙، تنبيه فشل الحفظ في IndexedDB، الحفظ الذكي، الاختصارات، ترحيل localStorage ← IndexedDB،
 * وتخزين الملفات لعمل التطبيق بلا إنترنت. */
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

  const st = await p.evaluate(async () => { const o = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('q', 'QuotaExceededError'); }; V.s += 1; save(); await new Promise(r => setTimeout(r, 150)); const t = document.querySelector('#tt'); const r = { on: t.classList.contains('on'), txt: t.textContent }; IDBObjectStore.prototype.put = o; await Store.flush(); return r; });
  assert(st.on && /تعذّر الحفظ/.test(st.txt), 'فشل الحفظ يُنبَّه عنه المستخدم');

  const d = await p.evaluate(async () => { tool = 'rect'; sel = []; const n = shapes.length, c = document.querySelector('#cv'), r = c.getBoundingClientRect(); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch', isPrimary: true, buttons: 1 })); ev('pointerdown', 100, 300); ev('pointermove', 180, 360); ev('pointermove', 220, 400); ev('pointerup', 220, 400); await new Promise(r => setTimeout(r, 200)); return shapes.length - n; });
  assert(d === 1, 'رسم مستطيل بالمؤشر يعمل');

  // حفظ ذكي: نقرة فارغة بأداة التحريك لا تكتب في IndexedDB، وسحب العرض يكتب سجلًّا واحدًا مؤجَّلًا
  const sv = await p.evaluate(async () => {
    tool = 'pan'; sel = []; upd();
    let sets = 0; const so = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { sets++; return so.apply(this, arguments); };
    const c = document.querySelector('#cv'), r = c.getBoundingClientRect();
    const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 2, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch', isPrimary: true, buttons: 1 }));
    ev('pointerdown', 150, 500); ev('pointerup', 150, 500); await new Promise(r => setTimeout(r, 600)); const tap = sets; sets = 0;
    ev('pointerdown', 150, 500); for (let i = 1; i <= 30; i++) ev('pointermove', 150 + i, 500 + i); ev('pointerup', 180, 530);
    const immediate = sets; await new Promise(r => setTimeout(r, 600)); const settled = sets;
    IDBObjectStore.prototype.put = so; return { tap, immediate, settled };
  });
  assert(sv.tap === 0, 'نقرة فارغة لا تكتب في التخزين');
  assert(sv.immediate === 0 && sv.settled === 1, 'سحب العرض يكتب سجل المشروع فقط، مرة واحدة مؤجَّلة بعد التوقف');

  // اختصارات لوحة المفاتيح بأحداث حقيقية
  await p.evaluate(() => { tool = 'select'; upd(); });
  const n0 = await p.evaluate(() => shapes.length);
  await p.keyboard.press('Control+z');
  assert(await p.evaluate(() => shapes.length) === n0 - 1, 'Ctrl+Z يتراجع عن آخر شكل');
  await p.keyboard.press('Control+y');
  assert(await p.evaluate(() => shapes.length) === n0, 'Ctrl+Y يعيده');
  await p.keyboard.press('KeyR');
  assert(await p.evaluate(() => tool) === 'rect', 'الحرف R يختار أداة المستطيل');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  assert(await p.evaluate(() => tool) === 'select', 'Esc يعيد أداة التحديد');
  assert(errors.length === 0, 'لا أخطاء JS أثناء الاختبارات');

  const { p: q } = await mk('allow');
  await q.evaluate(() => navigator.serviceWorker.ready); await q.waitForTimeout(800);
  const c = await q.evaluate(async () => { const k = await caches.keys(); const n = k.length ? (await (await caches.open(k[0])).keys()).length : 0; return { k, n }; });
  assert(c.k.length === 1 && c.n >= 20, `عامل الخدمة خزّن الملفات (${c.k.join(',')}: ${c.n} ملف)`);
  // ترحيل حقيقي من localStorage إلى IndexedDB ثم إعادة تحميل الصفحة
  {
    const c = await b.newContext({ viewport: { width: 420, height: 820 }, serviceWorkers: 'block' });
    await c.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('plan3:idx', JSON.stringify({ PJ: [{ id: 'a', name: 'قديم' }], pid: 'a' }));
      localStorage.setItem('plan3:p:a', JSON.stringify({ shapes: [{ t: 'rect', x: 0, y: 0, w: 2, h: 3, ly: 'l1' }], V: { x: 24, y: 24, s: 40 }, LY: [{ id: 'l1', name: 'طبقة 1', vis: 1, lock: 0 }], cl: 'l1' }));
      localStorage.setItem('other', 'keep');
    });
    const q = await c.newPage(); const errs = []; q.on('pageerror', e => errs.push(String(e)));
    await q.route(/fonts\.(googleapis|gstatic)/, r => r.abort()); await q.goto(url); await q.waitForTimeout(900);
    const keysOf = () => q.evaluate(() => new Promise(res => { const r = indexedDB.open('melkicad'); r.onsuccess = () => { const k = r.result.transaction('kv').objectStore('kv').getAllKeys(); k.onsuccess = () => res(k.result.sort()); }; }));
    const m = await q.evaluate(() => ({ kind: Store.kind, name: pname(), n: shapes.length, lsPlan: Object.keys(localStorage).filter(k => k.startsWith('plan3:')), other: localStorage.getItem('other') }));
    const keys = await keysOf();
    assert(m.kind === 'idb' && m.name === 'قديم' && m.n === 1, 'الترحيل: المشروع القديم يُحمَّل من IndexedDB');
    assert(keys.includes('@migrated') && keys.includes('p:a') && keys.includes('idx'), `الترحيل: السجلات في IndexedDB (${keys.join(',')})`);
    assert(m.lsPlan.length === 0 && m.other === 'keep', 'الترحيل: مفاتيح plan3 حُذفت من localStorage وغيرها بقي');
    await q.evaluate(() => { shapes.push({ t: 'line', a: [0, 0], b: [3, 3], ly: cl }); save(); return Store.flush(); });
    await q.reload(); await q.waitForTimeout(900);
    const r2 = await q.evaluate(() => ({ name: pname(), n: shapes.length, kind: Store.kind }));
    assert(r2.n === 2 && r2.name === 'قديم' && r2.kind === 'idb', 'بعد إعادة تحميل الصفحة تبقى البيانات من IndexedDB');
    assert(errs.length === 0, 'لا أخطاء JS أثناء الترحيل وإعادة التحميل');
    await c.close();
  }

  await b.close();
})();
