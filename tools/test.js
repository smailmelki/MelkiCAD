#!/usr/bin/env node
/* اختبارات وحدة بلا اعتماديات: تحمّل ملفات src/js بالترتيب نفسه داخل بيئة DOM وهمية (vm)،
 * ثم تختبر الهندسة والالتقاط والتحقق من الملفات المستوردة والتخزين والتراجع وDXF.
 * الاستخدام:  node tools/test.js
 * لا تحتاج متصفحًا؛ للاختبار في متصفح حقيقي استخدم tools/smoke.js. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');

// ---------- بيئة DOM وهمية بالحد الأدنى ----------
function fakeCtx() {
  const store = { measureText: t => ({ width: String(t).length * 6 }) };
  return new Proxy(function () {}, {
    get: (_, k) => k in store ? store[k] : (typeof k === 'symbol' ? undefined : () => {}),
    set: (_, k, v) => { store[k] = v; return true; },
  });
}
function fakeEl(sel) {
  const store = {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', hidden: false, disabled: false,
    width: 0, height: 0, children: [], files: [],
    classList: (() => { const s = new Set(); return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle: (c, f) => { (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); } }; })(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700, right: 400, bottom: 700 }),
    getContext: () => fakeCtx(), querySelector: s => fakeEl(s), querySelectorAll: () => [],
    addEventListener: () => {}, setAttribute: () => {}, append: () => {}, before: () => {}, insertAdjacentHTML: () => {},
    click: () => { if (!store.disabled && typeof store.onclick === 'function') store.onclick({ currentTarget: proxy }); }, focus: () => {}, select: () => {}, remove: () => {}, toDataURL: () => 'data:,', toBlob: cb => cb(new Blob([])),
  };
  const proxy = new Proxy(function () {}, {
    get: (_, k) => k in store ? store[k] : (typeof k === 'symbol' ? undefined : () => {}),
    set: (_, k, v) => { store[k] = v; return true; },
  });
  return proxy;
}
// IndexedDB وهمي في الذاكرة (يكفي لما تستخدمه طبقة التخزين): يعدّ الكتابات ويحاكي فشلها.
function fakeIDB() {
  const dbs = new Map();
  const api = {
    puts: 0, txs: 0, failPut: false, dbs,
    dump: (n = 'melkicad') => Object.fromEntries((dbs.get(n) && dbs.get(n).stores.get('kv')) || []),
    open(name) {
      const req = {};
      setTimeout(() => {
        let d = dbs.get(name); const fresh = !d;
        if (fresh) { d = { stores: new Map() }; dbs.set(name, d); }
        const db = {
          createObjectStore: n => { d.stores.set(n, new Map()); },
          transaction: (n, mode) => {
            const m = d.stores.get(n), tx = {}, ops = [];
            if (mode === 'readwrite') api.txs++;
            const os = {
              put: (v, k) => { if (api.failPut) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } api.puts++; ops.push(() => m.set(k, v)); },
              delete: k => { ops.push(() => m.delete(k)); },
              openCursor: () => {
                const r = {}, keys = [...m.keys()]; let i = 0;
                const step = () => setTimeout(() => { r.result = i < keys.length ? { key: keys[i], value: m.get(keys[i]), continue: () => { i++; step(); } } : null; r.onsuccess && r.onsuccess(); }, 0);
                step(); return r;
              },
            };
            tx.objectStore = () => os;
            tx.abort = () => { ops.length = 0; };
            if (mode === 'readwrite') setTimeout(() => { ops.forEach(f => f()); tx.oncomplete && tx.oncomplete(); }, 0);
            return tx;
          },
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    },
  };
  return api;
}
function makeEnv(opts = {}) {
  const els = new Map(), ls = new Map(Object.entries(opts.ls || {}));
  const document = {
    querySelector: s => { if (!els.has(s)) els.set(s, fakeEl(s)); return els.get(s); },
    querySelectorAll: () => [],
    createElement: t => fakeEl(t),
    documentElement: fakeEl('html'), body: fakeEl('body'),
    addEventListener: () => {},
  };
  const localStorage = { get length() { return ls.size; }, key: i => [...ls.keys()][i] ?? null, getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => { ls.set(k, String(v)); }, removeItem: k => { ls.delete(k); } };
  const win = { addEventListener: () => {}, devicePixelRatio: 1, localStorage };
  const ctx = vm.createContext({
    document, localStorage, window: win, navigator: {}, location: { protocol: 'file:' }, console: { log: console.log, error: console.error, warn: () => {} },
    setTimeout, clearTimeout, requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: () => '#123456' }), ResizeObserver: class { observe() {} },
    Path2D: class { moveTo() {} lineTo() {} arc() {} closePath() {} }, PointerEvent: class {},
    Blob, TextEncoder, URL, Uint8Array, devicePixelRatio: 1, File: class {},
    indexedDB: opts.noIdb ? undefined : (opts.idb || fakeIDB()),
  });
  ctx.window.window = ctx.window;
  return { ctx, els, ls };
}
function loadApp(opts) {
  const env = makeEnv(opts);
  const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), env.ctx, { filename: f });
  env.run = code => vm.runInContext(code, env.ctx);
  return env;
}

// ---------- مُشغّل اختبارات مصغّر ----------
let pass = 0, fail = 0;
const queue = [];
const t = (name, fn) => queue.push([name, fn]);   // تُنفَّذ بالترتيب في النهاية (تدعم async)
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || 'غير متساوٍ'}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const near = (a, b, m, e = 1e-6) => { if (!(Math.abs(a - b) <= e)) throw new Error(`${m || 'غير متقارب'}: ${a} ≠ ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'الشرط خاطئ'); };
const throws = (fn, m) => { let hit = false; try { fn(); } catch (e) { hit = true; } if (!hit) throw new Error(m || 'كان يجب أن يرمي خطأ'); };

const A = loadApp(), R = A.run;
const tick = () => new Promise(r => setTimeout(r, 15));
t('تهيئة التخزين (IndexedDB) قبل بقية الاختبارات', async () => { await R('Store.init()'); await tick(); eq(R('Store.kind'), 'idb'); ok(R('Store.ready')); });

// ---------- الهندسة ----------
t('المساحة: مستطيل ودائرة ومثلث', () => {
  near(R(`area({t:'rect',x:0,y:0,w:3,h:4})`), 12);
  near(R(`area({t:'circle',x:0,y:0,r:2})`), Math.PI * 4);
  near(R(`area({t:'tri',p:[[0,0],[4,0],[0,3]]})`), 6);
  near(R(`area({t:'line',a:[0,0],b:[1,1]})`), 0);
});
t('صلاحية الأشكال: الصغيرة جدًا مرفوضة', () => {
  ok(!R(`valid({t:'line',a:[0,0],b:[0.01,0]})`));
  ok(R(`valid({t:'line',a:[0,0],b:[1,0]})`));
  ok(!R(`valid({t:'circle',x:0,y:0,r:0.01})`));
  ok(!R(`valid({t:'rect',x:0,y:0,w:.05,h:3})`));
});
t('تدوير المستطيل 90° حول مركزه يبدّل الأبعاد الظاهرة ويحفظ المركز', () => {
  const r = R(`(()=>{const o={t:'rect',x:0,y:0,w:4,h:2},s=copy(o);rotS(s,o,[2,1],Math.PI/2);const b=bx(s);return[b.x,b.y,b.X,b.Y]})()`);
  near(r[0], 1); near(r[1], -1); near(r[2], 3); near(r[3], 3);
});
t('تدوير ثم عكس التدوير يعيد النقاط', () => {
  const r = R(`(()=>{const o={t:'line',a:[1,2],b:[5,3]},s=copy(o);rotS(s,o,[0,0],.7);const back=copy(s);rotS(back,s,[0,0],-.7);return[back.a,back.b]})()`);
  near(r[0][0], 1); near(r[0][1], 2); near(r[1][0], 5); near(r[1][1], 3);
});
t('copy يحذف المعرّف ولا يشارك المراجع', () => {
  const r = R(`(()=>{const o={t:'rect',id:'x',x:0,y:0,w:1,h:1},c=copy(o);c.w=9;return[c.id,o.w]})()`);
  eq(r, [undefined, 1]);
});
t('dseg: أقرب مسافة من نقطة إلى قطعة', () => {
  near(R(`dseg(0,1,-1,0,1,0)`), 1);
  near(R(`dseg(5,0,-1,0,1,0)`), 4);
});

// ---------- الالتقاط ----------
t('تقاطع قطعتين / موازيتين / منفصلتين', () => {
  eq(R(`xSS([[0,0],[2,2]],[[0,2],[2,0]])`), [[1, 1]]);
  eq(R(`xSS([[0,0],[2,0]],[[0,1],[2,1]])`), []);
  eq(R(`xSS([[0,0],[1,0]],[[2,-1],[2,1]])`), []);
});
t('تقاطع قطعة ودائرة ودائرتين', () => {
  eq(R(`xSC([[-2,0],[2,0]],{x:0,y:0,r:1}).length`), 2);
  eq(R(`xSC([[-2,5],[2,5]],{x:0,y:0,r:1}).length`), 0);
  eq(R(`xCC({x:0,y:0,r:1},{x:1,y:0,r:1}).length`), 2);
  eq(R(`xCC({x:0,y:0,r:1},{x:5,y:0,r:1}).length`), 0);
});
t('osnap يلتقط الطرف ثم المنتصف ثم التقاطع', () => {
  R(`shapes=[{t:'line',a:[0,0],b:[4,0]},{t:'line',a:[2,-2],b:[2,2]}];V={x:0,y:0,s:40};`);
  eq(R(`osnap([0.01,0.01]).k`), 'end');
  eq(R(`osnap([2.01,0.01]).k`), 'int');
  eq(R(`osnap([2.01,2.01]).k`), 'end');
  eq(R(`osnap([3,3])`), null);
});
t('constrain: Ortho يفرض أفقيًا أو رأسيًا', () => {
  R(`S.ortho=1;S.polar=0;S.parallel=0;S.perpendicular=0;`);
  eq(R(`constrain([0,0],[5,1])`), [5, 0]);
  eq(R(`constrain([0,0],[1,5])`), [0, 5]);
  R(`S.ortho=0;`);
});

// ---------- التحقق من الملفات المستوردة ----------
t('validateProjectData يرفض ما ليس مشروعًا', () => {
  throws(() => R(`validateProjectData(null)`));
  throws(() => R(`validateProjectData({shapes:'x'})`));
  throws(() => R(`validateProjectData({shapes:[{t:'rect',x:0,y:0,w:-1,h:1}]})`), 'مستطيل بعرض سالب يجب ألا يُقبل');
});
t('validateProjectData يرمي عند قيم هندسية غير منتهية', () => {
  throws(() => R(`validateProjectData({shapes:[{t:'rect',x:'a',y:0,w:1,h:1}]})`));
});
t('validateProjectData يصلح الطبقات المفقودة ويقصّ النصوص', () => {
  const v = R(`validateProjectData({shapes:[{t:'rect',x:0,y:0,w:1,h:1,ly:'ghost'},{t:'text',x:0,y:0,h:1,txt:'${'ا'.repeat(20000)}'},{t:'evil',x:0}],LY:[{id:'a',name:'x'.repeat(200),vis:1,lock:0}],cl:'zzz'})`);
  eq(v.shapes.length, 2, 'يُسقط النوع المجهول');
  eq(v.shapes[0].ly, 'a'); eq(v.cl, 'a'); eq(v.LY[0].name.length, 64);
  eq(v.shapes[1].txt.length, 10000);
});
t('validateProjectData يحفظ عرض جهتي الباب المزدوج', () => {
  const v=R(`validateProjectData({shapes:[{t:'door2',x:1,y:2,w:1.4,w1:.6,w2:.8,h:1,a:0,th:.2,f:-1,oa:125},{t:'door',x:0,y:0,w:.9,h:1,a:0}]})`);
  eq(v.shapes[0].w1,.6);eq(v.shapes[0].w2,.8);eq(v.shapes[0].w,1.4);eq(v.shapes[0].f,-1);eq(v.shapes[0].oa,125);
  eq(v.shapes[1].oa,90,'الزاوية الافتراضية للباب المفرد');
  const bounded=R(`validateProjectData({shapes:[{t:'door',x:0,y:0,w:.9,h:1,oa:240}]})`);eq(bounded.shapes[0].oa,180);
  throws(()=>R(`validateProjectData({shapes:[{t:'door2',x:1,y:2,w:1.4,w1:0,w2:.8,h:1,a:0}]})`),'عرض الجهة غير الموجب مرفوض');
});
t('impText: JSON صحيح يُنشئ مشروعًا جديدًا بعدد العناصر الصحيح', () => {
  R(`impText(JSON.stringify({app:'plan',name:'اختبار',shapes:[{t:'rect',x:0,y:0,w:2,h:3},{t:'line',a:[0,0],b:[1,1]}]}))`);
  eq(R(`shapes.length`), 2); eq(R(`pname()`), 'اختبار');
});
t('impText: نسخة احتياطية متعددة المشاريع', () => {
  const n0 = R(`PJ.length`);
  R(`impText(JSON.stringify({projects:[{name:'أ',d:{shapes:[{t:'rect',x:0,y:0,w:1,h:1}]}},{name:'ب',d:{shapes:[]}}]}))`);
  eq(R(`PJ.length`), n0 + 1, 'مشروع واحد صالح فقط');
});
t('impText: اسم طبقة يحتوي HTML يبقى نصًّا حرفيًا عبر esc', () => {
  eq(R(`esc('<img src=x onerror="1">&\\'')`), '&lt;img src=x onerror=&quot;1&quot;&gt;&amp;&#39;');
});

// ---------- خصائص زاوية فتح الأبواب ----------
t('خصائص الباب تعرض زاوية الفتح وتطبقها ضمن 0–180 درجة', () => {
  R(`globalThis.__one={t:'door',w:.9,h:1,a:0};globalThis.__two={t:'door2',w1:.6,w2:.8,w:1.4,a:0};`);
  const d=R(`dynSpec(globalThis.__one)`),d2=R(`dynSpec(globalThis.__two)`);
  ok(d.some(x=>x[0]==='oa'&&x[2]==='90'),'زاوية الباب المفرد الافتراضية');
  ok(d2.some(x=>x[0]==='oa'&&x[2]==='90'),'زاوية الباب المزدوج الافتراضية');
  R(`applyGeometryValues(globalThis.__one,k=>k==='oa'?'135':undefined);applyGeometryValues(globalThis.__two,k=>k==='oa'?'45':undefined);`);
  eq(R(`globalThis.__one.oa`),135);eq(R(`globalThis.__two.oa`),45);
  R(`applyGeometryValues(globalThis.__one,k=>k==='oa'?'240':undefined)`);eq(R(`globalThis.__one.oa`),180);
});

// ---------- التخزين والتراجع ----------
t('save ثم load يعيدان الأشكال والطبقات', () => {
  R(`newP('حفظ',[{t:'rect',x:1,y:1,w:2,h:2,ly:cl}],null);save();`);
  const id = R(`pid`);
  R(`shapes=[];load();`);
  R(`openP('${id}',1)`);
  eq(R(`shapes.length`), 1); eq(R(`shapes[0].w`), 2);
});
t('تراجع/إعادة: لقطة قبل التعديل ثم استعادتها', () => {
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}];hist=nh();snap();shapes.push({t:'line',a:[0,0],b:[2,2],ly:cl});`);
  eq(R(`shapes.length`), 2);
  R(`$('#undo').onclick()`); eq(R(`shapes.length`), 1, 'بعد التراجع');
  R(`$('#redo').onclick()`); eq(R(`shapes.length`), 2, 'بعد الإعادة');
});
t('إجراء جديد بعد التراجع يمسح قائمة الإعادة', () => {
  R(`snap();`); eq(R(`redo.length`), 0);
});
t('سجل التراجع محدود بـ 100 لقطة', () => {
  R(`hist=nh();for(let i=0;i<130;i++)snap();`); eq(R(`hist.length`), 100);
});

// ---------- DXF وPDF ----------
t('DXF: التصدير ثم الاستيراد يحفظان الأنواع الأساسية', () => {
  R(`newP('dxf',[{t:'line',a:[0,0],b:[4,0],ly:cl},{t:'circle',x:2,y:2,r:1,ly:cl},{t:'rect',x:0,y:0,w:3,h:2,ly:cl}],null)`);
  const txt = R(`dxfBuild()`);
  ok(/SECTION/.test(txt) && /EOF/.test(txt), 'بنية DXF');
  A.ctx.__txt = txt;
  const kinds = R(`dxfShapes(dxfEntities(__txt),1).shapes.map(s=>s.t).sort()`);
  ok(kinds.includes('line') && kinds.includes('circle'), 'خط ودائرة بعد الاستيراد: ' + kinds);
  ok(kinds.length >= 3, 'ثلاثة عناصر على الأقل: ' + kinds);
});
t('DXF: الأبعاد الهندسية تُحفظ عند الاستيراد', () => {
  R(`newP('dxf2',[{t:'line',a:[0,0],b:[4,0],ly:cl}],null)`);
  A.ctx.__txt = R(`dxfBuild()`);
  const l = R(`dxfShapes(dxfEntities(__txt),1).shapes.find(s=>s.t==='line')`);
  near(Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), 4, 'طول الخط');
});
t('DXF: الباب المزدوج يحفظ عرض كل جهة', () => {
  R(`newP('double-door',[{t:'door2',x:3,y:4,a:.25,w:1.4,w1:.6,w2:.8,th:.2,f:-1,h:1,oa:125,ly:cl}],null)`);
  A.ctx.__txt=R(`dxfBuild()`);
  const d=R(`dxfShapes(dxfEntities(__txt),1).shapes.find(s=>s.t==='door2')`);
  ok(!!d,'يُستورد الباب المزدوج');near(d.w1,.6);near(d.w2,.8);near(d.w,1.4);eq(d.f,-1);near(d.oa,125,'زاوية فتح الباب المزدوج');
  R(`newP('single-door',[{t:'door',x:0,y:0,a:0,w:.9,th:.2,f:1,h:-1,oa:55,ly:cl}],null)`);
  A.ctx.__txt=R(`dxfBuild()`);
  const sd=R(`dxfShapes(dxfEntities(__txt),1).shapes.find(s=>s.t==='door')`);
  ok(!!sd,'يُستورد الباب المفرد');near(sd.oa,55,'زاوية فتح الباب المفرد');eq(sd.h,-1);
});
t('makePDF ينتج ملفًا يبدأ بـ %PDF وينتهي بـ %%EOF', () => {
  const b = R(`makePDF(new Uint8Array([1,2,3]),10,10,210,297)`);
  ok(b.size > 100 && b.type === 'application/pdf');
});


// ---------- الأداء: رسم مؤجَّل وحفظ ذكي ----------
t('redraw يدمج عدة طلبات في رسمة واحدة', async () => {
  R(`globalThis.__n=0;const __d=draw;draw=function(){__n++;__d()};redraw();redraw();redraw();`);
  eq(R(`__n`), 0, 'لا رسم متزامن');
  await new Promise(r => setTimeout(r, 30));
  eq(R(`__n`), 1, 'رسمة واحدة فقط');
});
t('saveSoon لا يكتب فورًا، وsave يُلغي المؤجَّل ويكتب', () => {
  R(`newP('s',[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}],null);save();`);
  R(`shapes.push({t:'line',a:[0,0],b:[3,3],ly:cl});saveSoon();`);
  ok(R(`saveTimer`), 'مؤقّت الحفظ يعمل');
  eq(R(`kvGet('p:'+pid).shapes.length`), 1, 'لم يُكتب بعد');
  R(`save()`);
  eq(R(`saveTimer`), 0); eq(R(`kvGet('p:'+pid).shapes.length`), 2, 'كُتب بعد save');
});
t('الحفظ المؤجَّل لا يلوّث مشروعًا آخر عند التبديل', () => {
  R(`newP('أ',[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}],null);save();`);
  const a = R(`pid`);
  R(`shapes.push({t:'line',a:[0,0],b:[3,3],ly:cl});V.s=77;saveSoon();`);
  R(`newP('ب',[],null)`);                         // newP يستدعي save() أولًا
  eq(R(`kvGet('p:${a}').V.s`), 77, 'بيانات أ حُفظت قبل التبديل');
  eq(R(`saveTimer`), 0, 'لا مؤقّت معلّق');
  eq(R(`kvGet('p:'+pid).shapes.length`), 0, 'ب لم يتأثر');
});

// ---------- طبقة التخزين: IndexedDB ----------
const oldProject = (id, n = 1) => ({ [`plan3:p:${id}`]: JSON.stringify({ shapes: Array.from({ length: n }, (_, i) => ({ t: 'rect', x: i * 3, y: 0, w: 2, h: 3, ly: 'l1' })), V: { x: 1, y: 2, s: 30 }, LY: [{ id: 'l1', name: 'طبقة 1', vis: 1, lock: 0 }], cl: 'l1' }) });
const oldStore = () => ({ 'plan3:idx': JSON.stringify({ PJ: [{ id: 'a', name: 'قديم' }], pid: 'a' }), 'plan3:set': JSON.stringify({ S: {}, D: { col: '', lw: 2 }, ST: { unit: 'cm' } }), ...oldProject('a', 1), 'other:key': 'يبقى' });
const boot = async o => { const E = loadApp(o); await E.run('Store.init()'); await tick(); return E; };

t('ترحيل: بيانات localStorage القديمة تنتقل إلى IndexedDB وتُحذف، وغيرها يبقى', async () => {
  const idb = fakeIDB(), B = await boot({ idb, ls: oldStore() });
  eq(B.run('Store.kind'), 'idb'); eq(B.run('pname()'), 'قديم'); eq(B.run('shapes.length'), 1); eq(B.run('ST.unit'), 'cm', 'الإعدادات انتقلت');
  const d = idb.dump(); ok(d['p:a'] && d['idx'] && d['set'] && d['@migrated'], 'كل السجلات + علامة الترحيل: ' + Object.keys(d));
  eq([...B.ls.keys()], ['other:key'], 'مفاتيح plan3 حُذفت وغيرها بقي');
});
t('الترحيل لا يتكرر: تشغيل ثانٍ يقرأ IndexedDB ويتجاهل localStorage', async () => {
  const idb = fakeIDB(); await boot({ idb, ls: oldStore() });
  const C = await boot({ idb, ls: { ...oldProject('zzz', 5), 'plan3:idx': JSON.stringify({ PJ: [{ id: 'zzz', name: 'دخيل' }], pid: 'zzz' }) } });
  eq(C.run('pname()'), 'قديم', 'IndexedDB هو المرجع بعد الترحيل');
});
t('حفظ ثم إعادة فتح التطبيق (نسخة جديدة) تعيد المشروع من IndexedDB', async () => {
  const idb = fakeIDB(), B = await boot({ idb });
  B.run(`newP('دورة',[{t:'rect',x:0,y:0,w:4,h:5,ly:cl}],null);save();`); ok(await B.run('Store.flush()'));
  const C = await boot({ idb });
  eq(C.run('pname()'), 'دورة'); eq(C.run('shapes.length'), 1); eq(C.run('shapes[0].w'), 4);
});
t('لا كتابة لقيمة لم تتغيّر، وتغيير العرض وحده يكتب سجلًّا واحدًا', async () => {
  const idb = fakeIDB(), B = await boot({ idb });
  B.run(`newP('د',[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}],null);save();`); await B.run('Store.flush()');
  const n = idb.puts; B.run('save()'); await B.run('Store.flush()'); eq(idb.puts, n, 'حفظ بلا تغيير');
  B.run('V.s=99;save()'); await B.run('Store.flush()'); eq(idb.puts - n, 1, 'سجل المشروع فقط');
});
t('استدعاءات save المتتالية تُجمَّع في معاملة كتابة واحدة وتُكتب آخر حالة', async () => {
  const idb = fakeIDB(), B = await boot({ idb });
  B.run(`newP('م',[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}],null);save();`); await B.run('Store.flush()');
  const tx0 = idb.txs;
  B.run(`for(let i=0;i<5;i++){shapes.push({t:'line',a:[0,0],b:[i+1,1],ly:cl});save()}`);
  await B.run('Store.flush()');
  eq(idb.txs - tx0, 1, 'معاملة واحدة لخمس عمليات حفظ');
  eq(JSON.parse(idb.dump()['p:' + B.run('pid')]).shapes.length, 6, 'آخر حالة فقط كُتبت');
});
t('فشل الكتابة: ينبَّه المستخدم، يبقى معلّقًا، ثم يُكتب عند عودة التخزين', async () => {
  const idb = fakeIDB(), B = await boot({ idb });
  B.run(`newP('ف',[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}],null);save();`); await B.run('Store.flush()');
  idb.failPut = true; B.run(`shapes.push({t:'line',a:[0,0],b:[3,3],ly:cl});save();`);
  eq(await B.run('Store.flush()'), false); ok(B.run('Store.pendingCount') > 0, 'بقي معلّقًا');
  ok(/تعذّر الحفظ/.test(B.els.get('#tt').textContent), 'ظهر تنبيه');
  eq(JSON.parse(idb.dump()['p:' + B.run('pid')]).shapes.length, 1, 'التخزين لم يتغيّر');
  idb.failPut = false; eq(await B.run('Store.flush()'), true); eq(B.run('Store.pendingCount'), 0);
  eq(JSON.parse(idb.dump()['p:' + B.run('pid')]).shapes.length, 2, 'كُتب بعد العودة');
});
t('حذف مشروع يحذف سجله من IndexedDB', async () => {
  const idb = fakeIDB(), B = await boot({ idb });
  B.run(`newP('1',[],null);newP('2',[],null);save();`); await B.run('Store.flush()');
  const id = B.run('pid'); ok(('p:' + id) in idb.dump());
  B.run('delP()'); await B.run('Store.flush()'); ok(!(('p:' + id) in idb.dump()), 'السجل حُذف');
});
t('save قبل جاهزية التخزين لا تطمس المشاريع المحفوظة', async () => {
  const idb = fakeIDB(), E = loadApp({ idb, ls: oldStore() });
  eq(E.run('Store.ready'), false); E.run('save()');       // قبل اكتمال Store.init
  await E.run('Store.init()'); await tick();
  eq(E.run('pname()'), 'قديم'); eq(E.run('shapes.length'), 1);
});
t('الوضع الاحتياطي: بلا IndexedDB يعمل على localStorage ويحفظ فيه', async () => {
  const B = await boot({ noIdb: true, ls: oldStore() });
  eq(B.run('Store.kind'), 'ls'); eq(B.run('pname()'), 'قديم'); eq(B.run('shapes.length'), 1);
  B.run(`shapes.push({t:'line',a:[0,0],b:[2,2],ly:cl});save();`);
  eq(JSON.parse(B.ls.get('plan3:p:a')).shapes.length, 2, 'كُتب في localStorage');
});
t('فشل الترحيل لا يفقد شيئًا: يعمل على localStorage وبياناته سليمة', async () => {
  const idb = fakeIDB(); idb.failPut = true;
  const B = await boot({ idb, ls: oldStore() });
  eq(B.run('Store.kind'), 'ls'); eq(B.run('pname()'), 'قديم'); ok(B.ls.has('plan3:p:a'), 'النسخة القديمة لم تُحذف');
});
t('وصف التخزين للإعدادات', async () => {
  const B = await boot({ idb: fakeIDB() }); const d = await B.run('Store.describe()');
  ok(/IndexedDB/.test(d) && /المشاريع/.test(d), d);
});

// ---------- لوحة المفاتيح ----------
const key = (code, o = {}) => R(`onKey(${JSON.stringify({ code, target: { tagName: 'BODY' }, ...o })})`);
const setup = () => { A.ctx.document.querySelector('#io').hidden = true; A.ctx.document.querySelector('#ov').hidden = true; };
t('Ctrl+Z / Ctrl+Y تراجع وإعادة', () => {
  setup();
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}];hist=nh();snap();shapes.push({t:'line',a:[0,0],b:[2,2],ly:cl});upd();`);
  key('KeyZ', { ctrlKey: true }); eq(R(`shapes.length`), 1, 'تراجع');
  key('KeyY', { ctrlKey: true }); eq(R(`shapes.length`), 2, 'إعادة');
  key('KeyZ', { ctrlKey: true }); key('KeyZ', { ctrlKey: true, shiftKey: true }); eq(R(`shapes.length`), 2, 'Ctrl+Shift+Z إعادة');
});
t('Delete يحذف المحدد، ولا يعمل أثناء الكتابة في حقل', () => {
  setup();
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl},{t:'rect',x:5,y:5,w:1,h:1,ly:cl}];sel=[0];upd();`);
  key('Delete', { target: { tagName: 'INPUT' } }); eq(R(`shapes.length`), 2, 'محمي داخل الحقول');
  key('Delete'); eq(R(`shapes.length`), 1); eq(R(`sel.length`), 0);
});
t('Ctrl+C ثم Ctrl+V تنسخ وتلصق', () => {
  setup();
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}];sel=[0];clip=[];upd();`);
  key('KeyC', { ctrlKey: true }); eq(R(`clip.length`), 1);
  key('KeyV', { ctrlKey: true }); eq(R(`shapes.length`), 2);
});
t('Esc يتراجع خطوة خطوة: التحديد ثم لا شيء', () => {
  setup();
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl}];sel=[0];drawFlow=null;polyDraft=null;tool='select';upd();`);
  key('Escape'); eq(R(`sel.length`), 0);
});
t('Esc يلغي الرسم الجاري', () => {
  setup();
  R(`drawFlow={tool:'line',stage:'second',points:[[0,0]]};`);
  key('Escape'); eq(R(`drawFlow`), null);
});
t('معاينة الإدخال الرقمي تستخدم Snap وتظهر أثناء تحريك المؤشر', () => {
  R(`tool='line';S.grid=1;S.ortho=0;parallelRef=null;mk=null;drawFlow={tool:'line',stage:'second',points:[[0,0]]};updateDrawFlowPreview([2.2,1.2]);`);
  eq(R(`cur.t`), 'line'); eq(R(`cur.b`), [2,1]);
  const css=fs.readFileSync(path.join(src,'css/components.css'),'utf8');
  ok(/#drawInput\{[^}]*pointer-events:none/.test(css),'اللوحة لا تعترض أحداث اللوحة الفارغة');
  ok(/#drawInput button,#drawInput input\{pointer-events:auto\}/.test(css),'الأزرار والحقول الرقمية تبقى تفاعلية');
  R(`drawFlow=null;cur=null;S.grid=0;`);
});
t('الأسهم تحرّك العرض، و+/- تكبّر وتصغّر، F8/F9 تبدّل القيود', () => {
  setup();
  R(`V={x:100,y:100,s:40};W=400;H=700;`);
  key('ArrowRight'); eq(R(`V.x`), 40);
  key('ArrowDown', { shiftKey: true }); eq(R(`V.y`), -140);
  R(`V={x:100,y:100,s:40};`);
  key('Equal'); near(R(`V.s`), 50); key('Minus'); near(R(`V.s`), 40);
  R(`S.ortho=0;S.grid=1;`);
  key('F8'); eq(R(`S.ortho`), 1); key('F8'); eq(R(`S.ortho`), 0);
  key('F9'); eq(R(`S.grid`), 0); key('F9'); eq(R(`S.grid`), 1);
});
t('F3 يبدّل مجموعة الالتقاط بالنقاط كلها', () => {
  setup();
  R(`S.end=S.mid=S.int=S.cen=1;`); key('F3'); eq(R(`[S.end,S.mid,S.int,S.cen]`), [0, 0, 0, 0]);
  key('F3'); eq(R(`[S.end,S.mid,S.int,S.cen]`), [1, 1, 1, 1]);
});
t('قائمة الاختصارات تُبنى بلا أخطاء وتغطي كل مفاتيح الأدوات', () => {
  R(`keysSheet()`);
  const tools = R(`Object.values(TOOL_KEYS)`);
  ok(tools.length >= 10);
  const help = R(`KEY_HELP.map(r=>r[0]).join('|')`);
  ok(/Ctrl\+Z/.test(help) && /F8/.test(help));
});

// ---------- الملفات: saveBlob ----------
t('saveBlob: مسار التنزيل الاحتياطي يعمل عند غياب نافذة الحفظ والمشاركة', async () => {
  const r = await A.ctx.saveBlob('x.json', new Blob(['{}']));
  ok(r === 'ok' || r === 'err', 'نتيجة معروفة: ' + r);
});
t('saveBlob: إلغاء المستخدم لنافذة الحفظ يُرجع no ولا ينزّل ملفًا', async () => {
  A.ctx.window.showSaveFilePicker = async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; };
  const r = await A.ctx.saveBlob('x.dxf', new Blob(['0']));
  eq(r, 'no'); delete A.ctx.window.showSaveFilePicker;
});
t('saveBlob: وصف نوع الملف يتبع الامتداد (وليس DXF دائمًا)', async () => {
  let got = null;
  A.ctx.window.showSaveFilePicker = async o => { got = o; return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) }; };
  await A.ctx.saveBlob('a.json', new Blob(['{}'], { type: 'application/json' }));
  eq(got.types[0].description, 'ملف مشروع JSON'); ok(got.types[0].accept['application/json'].includes('.json'));
  await A.ctx.saveBlob('a.csv', new Blob(['x'], { type: 'text/csv' }));
  eq(got.types[0].description, 'جدول CSV'); delete A.ctx.window.showSaveFilePicker;
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n    ' + (e && e.message || e)); }
  }
  console.log(`\n${pass} نجح، ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})();

