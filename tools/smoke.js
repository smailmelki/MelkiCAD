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

  // الخط مضمَّن محليًا: لا طلبات خارجية، ويعمل التطبيق بعد قطع الإنترنت
  {
    const FONT = '400 14px "IBM Plex Sans Arabic"';
    const c = await b.newContext({ viewport: { width: 420, height: 820 }, serviceWorkers: 'allow' });
    const q = await c.newPage(); const ext = [], errs = [];
    q.on('request', r => { if (/^https?:/.test(r.url())) { const h = new URL(r.url()).hostname; if (h !== 'localhost' && h !== '127.0.0.1') ext.push(r.url()); } });
    q.on('pageerror', e => errs.push(String(e)));
    await q.goto(url); await q.evaluate(() => navigator.serviceWorker.ready); await q.waitForTimeout(1000);
    const fontState = () => q.evaluate(async f => { await document.fonts.load(f); return [...document.fonts].filter(x => x.family.includes('IBM Plex')).map(x => x.status); }, FONT);
    assert(ext.length === 0, 'لا طلبات إلى مواقع خارجية' + (ext.length ? ': ' + ext.join(',') : ''));
    assert((await fontState()).includes('loaded'), 'الخط IBM Plex Sans Arabic يُحمَّل من الملف المحلي');
    assert(await q.evaluate(async () => { const k = await caches.keys(); return !!(await (await caches.open(k[0])).match('fonts/IBMPlexSansArabic-Regular.ttf')); }), 'ملف الخط في كاش عامل الخدمة');
    await c.setOffline(true); await q.reload(); await q.waitForTimeout(1200);
    assert((await fontState()).includes('loaded') && await q.evaluate(() => !!document.querySelector('nav')), 'بلا إنترنت: إعادة التحميل من الكاش والخط محمَّل');
    assert(errs.length === 0, 'لا أخطاء JS بلا إنترنت');
    await c.close();
  }

  // الرسم الموجَّه (الشريط الرقمي ظاهر): السحب باللمس يرسم مباشرة، واللمستان تعملان، ولا تركيز تلقائي يفتح لوحة المفاتيح باللمس.
  {
    const { p: f, errors: fe } = await mk('block');
    const ptr = (type, id, x, y, pt = 'touch') => f.evaluate(([type, id, x, y, pt]) => { const cv = document.querySelector('#cv'), r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: pt, clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: true })); }, [type, id, x, y, pt]);
    const st = () => f.evaluate(() => ({ n: shapes.length, flow: !!drawFlow, stage: drawFlow && drawFlow.stage, ae: document.activeElement && document.activeElement.id }));
    await f.evaluate(() => { S.grid = 0; S.end = S.mid = S.int = S.cen = 0; diSetOpen(true, false); });
    const tapTool = () => f.evaluate(() => { const b = document.querySelector('[data-t="line"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); b.click(); });
    await tapTool();
    await f.waitForTimeout(120); let s0 = await st(); assert(s0.ae !== 'diX' && s0.ae !== 'diY', 'الرسم الموجَّه: الضغط على زر الأداة باللمس لا يفتح لوحة المفاتيح');
    const n0 = (await st()).n;
    await ptr('pointerdown', 1, 100, 300); await ptr('pointermove', 1, 180, 320); await ptr('pointermove', 1, 260, 340); await ptr('pointerup', 1, 260, 340);
    let s = await st(); assert(s.n === n0 + 1 && !s.flow, 'الرسم الموجَّه: سحب الإصبع يرسم الخط مباشرة ويُنهي الرسم الموجَّه');
    await tapTool();
    await ptr('pointerdown', 2, 100, 400); await ptr('pointerup', 2, 101, 401);
    s = await st(); assert(s.flow && s.stage === 'second' && s.n === n0 + 1, 'الرسم الموجَّه: لمسة قصيرة تثبّت النقطة الأولى فقط');
    await f.waitForTimeout(120); s = await st(); assert(s.ae !== 'diX' && s.ae !== 'diY', 'الرسم الموجَّه: لا تركيز تلقائي على حقول الإدخال باللمس');
    await ptr('pointerdown', 2, 260, 420); await ptr('pointerup', 2, 260, 420);
    s = await st(); assert(s.n === n0 + 2 && !s.flow, 'الرسم الموجَّه: اللمسة الثانية تُكمل الخط');
    assert(fe.length === 0, 'الرسم الموجَّه بلا أخطاء JS');
  }

  // أدوات التعديل الجديدة باللمس: تدوير زاوية، تفكيك/ربط، ونقل بنقطة أساس (سحب وإفلات) مع التراجع.
  {
    const { p: f, errors: fe } = await mk('block');
    const ptr = (type, id, x, y) => f.evaluate(([type, id, x, y]) => { const cv = document.querySelector('#cv'), r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: true })); }, [type, id, x, y]);
    const W = (x, y) => f.evaluate(([x, y]) => w2s(x, y), [x, y]);
    const tap = async (id, q) => { await ptr('pointerdown', id, q[0], q[1]); await ptr('pointerup', id, q[0], q[1]); };
    await f.evaluate(() => { S.grid = 0; S.end = S.mid = S.int = S.cen = 0; V = { x: 100, y: 100, s: 40 }; shapes = [{ t: 'line', a: [0, 0], b: [6, 0], ly: cl }, { t: 'line', a: [0, 0], b: [0, 6], ly: cl }]; FILLET_R = 1; document.querySelector('[data-t="fillet"]').click(); document.querySelector('#opx').click(); });
    await tap(1, await W(3, 0)); await tap(2, await W(0, 3));
    let s = await f.evaluate(() => ({ n: shapes.length, t: shapes[2] && shapes[2].t })); assert(s.n === 3 && s.t === 'arc', 'تدوير زاوية باللمس: يُضاف قوس عند الزاوية');
    await f.evaluate(() => document.querySelector('#undo').click()); s = await f.evaluate(() => shapes.length); assert(s === 2, 'تدوير زاوية: التراجع بخطوة واحدة');
    await f.evaluate(() => { cornerFirst = null; tool = 'select'; shapes = [{ t: 'rect', x: 0, y: 0, w: 4, h: 3, ly: cl }]; sel = [0]; opAction('explode'); });
    s = await f.evaluate(() => shapes.length); assert(s === 4, 'تفكيك: المستطيل ← 4 خطوط');
    await f.evaluate(() => opAction('join')); s = await f.evaluate(() => shapes.length + shapes[0].t); assert(s === '1polygon', 'ربط: الخطوط الأربعة ← مضلع مغلق');
    await f.evaluate(() => { shapes = [{ t: 'line', a: [0, 0], b: [2, 0], ly: cl }, { t: 'circle', x: 5, y: 5, r: 1, ly: cl }]; sel = [0, 1]; opAction('bmove'); });
    await tap(3, await W(0, 0)); const d = await W(3, 2); await ptr('pointerdown', 4, d[0] - 40, d[1] - 30); await ptr('pointermove', 4, d[0], d[1]); await ptr('pointerup', 4, d[0], d[1]);
    s = await f.evaluate(() => ({ a: shapes[0].a.map(v => Math.round(v * 1000) / 1000), flow: !!moveFlow })); assert(s.a.join() === '3,2' && !s.flow, 'نقل بنقطة أساس: الإزاحة (3,2) تُطبَّق وينتهي التدفق');
    await f.evaluate(() => document.querySelector('#undo').click()); s = await f.evaluate(() => shapes[0].a.join()); assert(s === '0,0', 'نقل بنقطة أساس: التراجع بخطوة واحدة');
    assert(fe.length === 0, 'أدوات التعديل الجديدة بلا أخطاء JS');
  }

  // الدفعة الثانية باللمس: مقابض رؤوس المتعدد (سحب/إضافة/حذف)، شدّ بإطار، وكسر، مع التراجع.
  {
    const { p: f, errors: fe } = await mk('block');
    const ptr = (type, id, x, y) => f.evaluate(([type, id, x, y]) => { const cv = document.querySelector('#cv'), r = cv.getBoundingClientRect(); cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: true })); }, [type, id, x, y]);
    const W = (x, y) => f.evaluate(([x, y]) => w2s(x, y), [x, y]);
    const tap = async (id, q) => { await ptr('pointerdown', id, q[0], q[1]); await ptr('pointerup', id, q[0], q[1]); };
    const drag = async (id, a, b) => { await ptr('pointerdown', id, a[0], a[1]); await ptr('pointermove', id, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); await ptr('pointermove', id, b[0], b[1]); await ptr('pointerup', id, b[0], b[1]); };
    const undo = () => f.evaluate(() => document.querySelector('#undo').click());
    const rnd = v => Math.round(v * 1000) / 1000;
    await f.evaluate(() => { S.grid = 0; S.end = S.mid = S.int = S.cen = 0; V = { x: 100, y: 150, s: 40 }; shapes = [{ t: 'polyline', p: [[0, 0], [4, 0], [4, 3]], ly: cl }]; tool = 'select'; sel = [0]; upd(); draw(); });
    await drag(1, await W(4, 0), await W(5, 1));
    let s = await f.evaluate(() => shapes[0].p.map(q => q.map(v => Math.round(v * 1000) / 1000).join()).join(' ')); assert(s === '0,0 5,1 4,3', 'مقبض رأس المتعدد: السحب يحرّك الرأس');
    await undo(); s = await f.evaluate(() => shapes[0].p[1].join()); assert(s === '4,0', 'مقبض رأس المتعدد: التراجع بخطوة واحدة');
    await f.evaluate(() => { sel = [0]; upd(); draw(); });
    await drag(2, await W(2, 0), await W(2, -1));
    s = await f.evaluate(() => ({ n: shapes[0].p.length, m: shapes[0].p[1].map(v => Math.round(v * 1000) / 1000).join() })); assert(s.n === 4 && s.m === '2,-1', 'سحب مقبض منتصف الضلع يضيف رأسًا جديدًا');
    await undo(); s = await f.evaluate(() => shapes[0].p.length); assert(s === 3, 'إضافة الرأس: التراجع بخطوة واحدة');
    await f.evaluate(() => { sel = [0]; upd(); draw(); });
    await tap(3, await W(4, 0));
    s = await f.evaluate(() => ({ vis: document.querySelector('#vdel').style.display !== 'none' })); assert(s.vis, 'لمسة على رأس تُظهر زر «حذف رأس»');
    await f.evaluate(() => document.querySelector('#vdel').click());
    s = await f.evaluate(() => shapes[0].p.map(q => q.join()).join(' ')); assert(s === '0,0 4,3', 'حذف الرأس النشط');
    await undo(); s = await f.evaluate(() => shapes[0].p.length); assert(s === 3, 'حذف الرأس: التراجع بخطوة واحدة');
    // قوس: سحب مقبض النهاية يغيّر الزاوية
    await f.evaluate(() => { shapes = [{ t: 'arc', x: 0, y: 0, r: 3, a0: 0, a1: Math.PI / 2, ly: cl }]; sel = [0]; upd(); draw(); });
    await drag(4, await W(0, 3), await W(-3, 0));
    s = await f.evaluate(() => Math.round((shapes[0].a1 - shapes[0].a0) * 1000) / 1000); assert(Math.abs(s - Math.round(Math.PI * 1000) / 1000) < .01, 'مقبض نهاية القوس: السحب إلى 180° يجعل المدى نصف دائرة');
    // شدّ: إطار حول الضلع الأيمن لمستطيل ثم سحبه لليمين
    await f.evaluate(() => { shapes = [{ t: 'rect', x: 0, y: 0, w: 4, h: 3, ly: cl }]; sel = []; opAction('stretch'); });
    await drag(5, await W(3.5, -0.5), await W(4.5, 3.5));
    s = await f.evaluate(() => ({ st: moveFlow && moveFlow.stage, hits: moveFlow && moveFlow.hits })); assert(s.st === 'base' && s.hits === 1, 'شدّ: رسم الإطار ينقل إلى مرحلة نقطة الأساس');
    await tap(6, await W(4, 1.5));
    const d = await W(6, 1.5); await ptr('pointerdown', 7, d[0], d[1]); await ptr('pointermove', 7, d[0], d[1]); await ptr('pointerup', 7, d[0], d[1]);
    s = await f.evaluate(() => ({ t: shapes[0].t, w: Math.round(shapes[0].w * 1000) / 1000, flow: !!moveFlow })); assert(s.t === 'rect' && s.w === 6 && !s.flow, 'شدّ: الضلع الأيمن للمستطيل يتحرك فيصير عرضه 6 ويبقى مستطيلًا');
    await undo(); s = await f.evaluate(() => shapes[0].w); assert(s === 4, 'شدّ: التراجع بخطوة واحدة');
    // كسر عند نقطة
    await f.evaluate(() => { shapes = [{ t: 'line', a: [0, 0], b: [6, 0], ly: cl }]; sel = []; opAction('brk1'); });
    await tap(8, await W(2, 0));
    s = await f.evaluate(() => shapes.map(q => q.a.join() + '>' + q.b.join()).join(' | ')); assert(s === '0,0>2,0 | 2,0>6,0', 'كسر عند نقطة: الخط ينقسم إلى قطعتين');
    await undo(); s = await f.evaluate(() => shapes.length); assert(s === 1, 'كسر: التراجع بخطوة واحدة');
    // كسر بين نقطتين
    await f.evaluate(() => { shapes = [{ t: 'line', a: [0, 0], b: [6, 0], ly: cl }]; sel = []; opAction('brk2'); });
    await tap(9, await W(2, 0)); await tap(10, await W(4, 0));
    s = await f.evaluate(() => shapes.map(q => q.a.join() + '>' + q.b.join()).join(' | ')); assert(s === '0,0>2,0 | 4,0>6,0', 'كسر بين نقطتين: يُحذف الجزء بينهما');
    assert(fe.length === 0, 'أدوات الدفعة الثانية بلا أخطاء JS: ' + fe.join(' ; '));
  }

  // استيراد DXF عربي بترميز ANSI_1256 (بايتات خام) عبر ملف حقيقي: كان f.text() يفسدها بتفسير UTF-8
  {
    const { p: f, errors: fe } = await mk('block');
    const cp = Buffer.from([0xDB, 0xD1, 0xDD, 0xC9]);   // «غرفة» بـ windows-1256
    const buffer = Buffer.concat([
      Buffer.from('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$DWGCODEPAGE\n3\nANSI_1256\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n', 'latin1'), cp,
      Buffer.from('\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nTEXT\n8\n', 'latin1'), cp,
      Buffer.from('\n10\n1\n20\n1\n40\n0.3\n1\n', 'latin1'), cp, Buffer.from('\n0\nENDSEC\n0\nEOF\n', 'latin1')]);
    await f.setInputFiles('#fin', { name: 'ar.dxf', mimeType: 'application/dxf', buffer }); await f.waitForTimeout(500);
    const info = await f.textContent('#dxi'); assert(/ANSI_1256/.test(info), 'استيراد DXF عربي: نافذة الاستيراد تعرض الترميز المكتشف: ' + info);
    await f.click('#opk'); await f.waitForTimeout(400);
    const r = await f.evaluate(() => ({ t: shapes.filter(q => q.t === 'text').map(q => q.txt), l: LY.map(l => l.name) }));
    assert(r.t.join() === 'غرفة' && r.l.includes('غرفة'), 'استيراد DXF عربي بـ ANSI_1256: النص واسم الطبقة سليمان: ' + JSON.stringify(r));
    assert(fe.length === 0, 'استيراد DXF عربي بلا أخطاء JS: ' + fe.join(' ; '));
  }

  // تصدير PDF: متجهي افتراضيًا (بلا JPEG)، ويرجع إلى صورة JPEG إن فشل المسار المتجهي
  {
    const { p: x, errors: xe } = await mk('block');
    const cap = failSim => x.evaluate(async fail => {
      impText(JSON.stringify({ app: 'plan', schemaVersion: 2, name: 'pdf', cl: 'l1', LY: [{ id: 'l1', name: 'A', vis: 1, lock: 0 }],
        shapes: [{ t: 'wall', a: [0, 0], b: [6, 0], th: .2, ly: 'l1' }, { t: 'circle', x: 3, y: 2, r: 1, fk: 'solid', ly: 'l1' },
          { t: 'text', x: 1.5, y: 1, h: .3, txt: 'غرفة', ly: 'l1' }, { t: 'dim', a: [0, 0], b: [6, 0], off: .6, ly: 'l1' }] }));
      const orig = saveBlob, sp = PdfRecorder.prototype.stroke; let got = null;
      saveBlob = async (n, b) => { got = { n, b }; return 'ok' };
      if (fail) PdfRecorder.prototype.stroke = () => { throw new Error('محاكاة فشل') };
      try { await doExport('pdf', 'عنوان'); } finally { saveBlob = orig; PdfRecorder.prototype.stroke = sp; }
      const u = new Uint8Array(await got.b.arrayBuffer()); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { n: got.n, type: got.b.type, b64: btoa(bin) };
    }, failSim);
    const chk = r => { const t = Buffer.from(r.b64, 'base64').toString('latin1'); const sx = /startxref\n(\d+)\n%%EOF\n?$/.exec(t);
      return { t, ok: t.startsWith('%PDF-') && !!sx && t.startsWith('xref\n', +sx[1]) }; };
    const v = await cap(false), vc = chk(v);
    assert(v.type === 'application/pdf' && v.n.endsWith('.pdf') && vc.ok, 'تصدير PDF: ملف صالح الهيكل (xref وstartxref)');
    assert(!/DCTDecode/.test(vc.t) && /FlateDecode/.test(vc.t), 'تصدير PDF افتراضيًا متجهي: بلا صورة JPEG وبمحتوى مضغوط');
    assert(((vc.t.match(/\/Subtype\/Image/g) || []).length % 2) === 0 && /SMask/.test(vc.t), 'تصدير PDF: النصوص صور بقناع شفافية');
    const fb = await cap(true), fc = chk(fb);
    assert(fc.ok && /DCTDecode/.test(fc.t), 'تصدير PDF: عند فشل المسار المتجهي يُحفظ PDF بصورة JPEG بدل الفشل');
    assert(xe.filter(e => !/محاكاة فشل|PDF متجهي/.test(e)).length === 0, 'تصدير PDF بلا أخطاء JS غير متوقعة: ' + xe.join(' ; '));
  }

  await b.close();
})();
