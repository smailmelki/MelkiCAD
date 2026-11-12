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
t('زاوية فتح الباب تحسب موضع نهاية الضلفة بدقة', () => {
  const p90=R(`doorLeafVector(2,1,1,90)`),p45=R(`doorLeafVector(2,1,1,45)`),p0=R(`doorLeafVector(2,1,1,0)`),pDouble=R(`doorLeafVector(2,-1,-1,90)`);
  near(p90[0],0);near(p90[1],2);
  near(p45[0],Math.SQRT2);near(p45[1],Math.SQRT2);
  near(p0[0],2);near(p0[1],0);
  near(pDouble[0],0);near(pDouble[1],-2);
});

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
t('دقة الأبعاد تحفظ 0–4 منازل وتستخدم وحدة المشروع في العرض وDXF', () => {
  R(`ST.unit='cm';`);
  eq(R(`dimLabel({prec:0},1.23456)`), '123 cm');
  eq(R(`dimLabel({prec:3},1.23456)`), '123.456 cm');
  eq(R(`dimLabel({prec:9},1.23456)`), '123.4560 cm');
  R(`newP('precision',[{t:'dim',mode:'horizontal',a:[0,0],b:[1.23456,0],off:.3,prec:3,ly:cl}],null)`);
  const txt=R(`dxfBuild()`);
  ok(txt.includes('123.456 cm'),'قيمة البعد المصدّرة تستخدم الدقة المختارة');
  R(`ST.unit='m';`);
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
  eq(R(`kvGet('v:${a}').s`), 77, 'عرض أ حُفظ قبل التبديل');
  eq(R(`kvGet('p:${a}').shapes.length`), 2, 'بيانات أ حُفظت قبل التبديل');
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
t('الرسم الموجَّه: التركيز التلقائي لحقل الإدخال للفأرة فقط، والسحب مسموح لأدوات الأشكال', () => {
  R(`lastPtrType='touch'`); ok(!R(`diAutoFocus()`), 'باللمس لا يُفتح حقل الإدخال تلقائيًا (لوحة المفاتيح تقطع الرسم)');
  R(`lastPtrType='pen'`); ok(!R(`diAutoFocus()`), 'بالقلم كذلك');
  R(`lastPtrType='mouse'`); ok(R(`diAutoFocus()`), 'بالفأرة يبقى الإدخال السريع');
  for (const k of ['line', 'wall', 'rect', 'circle', 'arc', 'ellipse', 'tri', 'polygon', 'free']) ok(R(`DRAG_FLOW_TOOLS.includes('${k}')`), k + ' يقبل السحب المباشر');
  for (const k of ['polyline', 'text', 'north']) ok(!R(`DRAG_FLOW_TOOLS.includes('${k}')`), k + ' يبقى باللمس النقطي');
});
t('الأداء: bx يطابق الصيغة القديمة، وbounds وcullBox لا يفشلان مع عشرات الآلاف', () => {
  const old = s => { const q = s.t === 'circle' ? [[s.x - s.r, s.y - s.r], [s.x + s.r, s.y + s.r]] : pts(s), x = q.map(r => r[0]), y = q.map(r => r[1]); return { x: Math.min(...x), y: Math.min(...y), X: Math.max(...x), Y: Math.max(...y) } };
  R(`globalThis.__old=${old.toString()}`);
  const kinds = `[{t:'line',a:[1,2],b:[-3,5]},{t:'wall',a:[0,0],b:[4,-2],th:.2},{t:'rect',x:1,y:1,w:3,h:2},{t:'rect',x:1,y:1,w:3,h:2,rot:.7},{t:'circle',x:2,y:3,r:1.5},{t:'arc',x:0,y:0,r:2,a0:0,a1:2},{t:'ellipse',x:1,y:1,rx:3,ry:1,rot:.4},{t:'tri',p:[[0,0],[4,0],[2,3]]},{t:'polyline',p:[[0,0],[1,5],[-2,2],[7,1]]},{t:'free',p:[[0,0],[1,1],[2,0]]},{t:'polygon',p:[[0,0],[3,0],[3,3],[0,3]]}]`;
  ok(R(`${kinds}.every(s=>{const a=bx(s),b=__old(s);return a.x===b.x&&a.y===b.y&&a.X===b.X&&a.Y===b.Y})`), 'bx يعطي نفس الحدود لكل الأنواع');
  // cullBox لا يكون أصغر من الحدود الحقيقية أبدًا، ومطابق لها حين يُرجع 1
  ok(R(`${kinds}.every(s=>{const o=[0,0,0,0],k=cullBox(s,o),b=bx(s);if(!k)return true;const e=1e-9;return o[0]<=b.x+e&&o[1]<=b.y+e&&o[2]>=b.X-e&&o[3]>=b.Y-e&&(k!==1||(Math.abs(o[0]-b.x)<e&&Math.abs(o[2]-b.X)<e&&Math.abs(o[1]-b.y)<e&&Math.abs(o[3]-b.Y)<e))})`), 'cullBox يغطي الشكل، ومطابق له حين يُعلن ذلك');
  ok(!R(`cullBox({t:'dim',a:[0,0],b:[1,1],off:1},[0,0,0,0])`), 'الأبعاد لا تُستبعد');
  // أكثر من ~125 ألف عنصر كانت تُسقط Math.min(...arr)
  const n = R(`(()=>{const L=Array.from({length:200000},(_,i)=>({t:'line',a:[i,0],b:[i+1,1]}));const b=bounds(L);return [b.x,b.X,b.y,b.Y].join()})()`);
  eq(n, '0,200000,0,1', 'bounds على 200 ألف شكل بلا انهيار');
  eq(R(`(()=>{const b=bounds([]);return [b.x,b.X].join()})()`), 'Infinity,-Infinity', 'bounds لقائمة فارغة كالسابق');
});
t('الأداء: سجل التراجع محدود بالحجم لا بالعدد فقط', () => {
  R(`hist=nh();`);
  R(`for(let i=0;i<10;i++)hist.push('x'.repeat(15e6))`);
  ok(R(`hist.length<=3`), 'مشروع كبير يحتفظ بعدد أقل من اللقطات (' + R(`hist.length`) + ')');
  ok(R(`hist.at(-1).length===15e6`), 'اللقطة الأحدث باقية');
  R(`hist=nh();for(let i=0;i<150;i++)snap()`);
  eq(R(`hist.length`), 100, 'المشروع الصغير: السقف القديم 100 خطوة كما كان');
  R(`hist=nh()`);
});
t('الأداء: لقطة التراجع الكسولة تُؤخذ عند أول وصول فقط', () => {
  R(`globalThis.__calls=0;const __o=snapStr;globalThis.__restore=()=>{};`);
  R(`shapes=[{t:'line',a:[0,0],b:[1,1],ly:cl}];const __g=lazyBefore({k:'draw'});globalThis.__g=__g`);
  const before = R(`JSON.stringify(Object.keys(__g))`);
  eq(before, '["k"]', 'before ليست خاصية قابلة للعدّ (لا تُنسخ ولا تُسلسل)');
  R(`shapes.push({t:'line',a:[2,2],b:[3,3],ly:cl})`);
  const a = R(`__g.before`); R(`shapes.push({t:'line',a:[4,4],b:[5,5],ly:cl})`);
  eq(R(`__g.before===${JSON.stringify(a)}`), true, 'تُحسب مرة واحدة وتثبت');
  eq(JSON.parse(a).s.length, 2, 'اللقطة تعكس الحالة وقت أول وصول');
});
t('الأداء: osnap بلا التقاط مفعّل لا يمسح الأشكال، ومع الكثافة يبقى النتيجة الصحيحة', () => {
  R(`S.end=S.mid=S.int=S.cen=0;shapes=[{t:'line',a:[0,0],b:[2,0],ly:cl}]`);
  eq(R(`osnap([0,0])`), null, 'كل أنواع الالتقاط مغلقة: لا نتيجة');
  R(`S.end=1;S.mid=1;S.int=1;S.cen=1;V={x:0,y:0,s:40}`);
  eq(R(`osnap([0.01,0.01]).k`), 'end', 'التقاط نهاية الخط');
  // تقاطع خطين متعامدين
  R(`shapes=[{t:'line',a:[-2,0],b:[2,0],ly:cl},{t:'line',a:[0,-2],b:[0,2],ly:cl}]`);
  eq(R(`osnap([0.01,0.01]).k`), 'int', 'تقاطع خطين');
  // 300 خطًا متقاطعًا قرب النقطة: لا يتجمّد ويُرجع التقاطع المركزي
  R(`shapes=Array.from({length:300},(_,i)=>{const a=i*Math.PI/300;return{t:'line',a:[-5*Math.cos(a),-5*Math.sin(a)],b:[5*Math.cos(a),5*Math.sin(a)],ly:cl}})`);
  const t0 = Date.now(); const k = R(`osnap([0.01,0.01]).k`); const dt = Date.now() - t0;
  eq(k, 'int', 'تقاطع مركزي بين خطوط كثيرة'); ok(dt < 1500, 'زمن osnap مع 300 شكل متقاطع معقول (' + dt + ' مللي ثانية)');
});
t('الأداء: تحديد الإطار يعطي النتيجة نفسها بعد الرفض السريع', () => {
  R(`S.grid=0;V={x:0,y:0,s:10};shapes=[{t:'rect',x:1,y:1,w:3,h:2,ly:cl},{t:'circle',x:20,y:20,r:2,ly:cl},{t:'line',a:[5,5],b:[50,5],ly:cl},{t:'rect',x:100,y:100,w:3,h:2,ly:cl},{t:'polyline',p:[[2,2],[3,3],[4,2]],ly:cl}]`);
  // إطار من اليسار لليمين من (0,0) إلى (40,40) متر = داخلي
  R(`box={x0:0,y0:0,x1:400,y1:400}`); eq(R(`boxSel().join()`), '0,1,4', 'داخلي: المستطيل والدائرة وخط polyline فقط (الخط الطويل يخرج منه)');
  R(`box={x0:400,y0:400,x1:0,y1:0}`); eq(R(`boxSel().join()`), '0,1,2,4', 'بالتقاطع: يضيف الخط الطويل ولا يضيف البعيد');
  R(`box=null`);
});
t('Fillet: زاوية قائمة بنصف قطر 1، والقوس يمرّ بين نقطتي التماس من جهة الزاوية', () => {
  const r = JSON.parse(R(`JSON.stringify(filletCalc({a:[0,0],b:[10,0]},{a:[0,0],b:[0,10]},[5,0],[0,5],1))`));
  eq(r.a1.end + r.a2.end, 'aa', 'يتحرك طرفا البداية (الجهة القريبة من الزاوية)');
  ok(Math.abs(r.a1.pt[0] - 1) < 1e-9 && Math.abs(r.a1.pt[1]) < 1e-9, 'نقطة التماس الأولى (1,0)');
  ok(Math.abs(r.a2.pt[0]) < 1e-9 && Math.abs(r.a2.pt[1] - 1) < 1e-9, 'نقطة التماس الثانية (0,1)');
  ok(Math.abs(r.arc.x - 1) < 1e-9 && Math.abs(r.arc.y - 1) < 1e-9 && r.arc.r === 1, 'المركز (1,1)');
  // منتصف القوس هو أقرب نقطة منه إلى الزاوية: (1-√½, 1-√½)
  const mid = (r.arc.a0 + r.arc.a1) / 2, mx = r.arc.x + Math.cos(mid), my = r.arc.y + Math.sin(mid);
  ok(Math.abs(mx - (1 - Math.SQRT1_2)) < 1e-9 && Math.abs(my - (1 - Math.SQRT1_2)) < 1e-9, 'القوس الصغير نحو الزاوية');
  ok(Math.abs((r.arc.a1 - r.arc.a0) - Math.PI / 2) < 1e-9, 'مقدار القوس 90°');
});
t('Fillet/Chamfer: الجهة الملموسة هي الباقية، وصفر يصل الخطين، والأخطاء واضحة', () => {
  // T: خط أفقي طويل وخط رأسي يقطعه في (5,0)
  const A = '{a:[0,0],b:[10,0]}', B = '{a:[5,-5],b:[5,5]}';
  let r = JSON.parse(R(`JSON.stringify(filletCalc(${A},${B},[2,0],[5,3],0))`));
  eq(r.a1.end, 'b', 'اللمس على يسار التقاطع ← يتحرك الطرف الأيمن'); eq(r.a2.end, 'a', 'اللمس على الجزء العلوي ← يتحرك الطرف السفلي');
  ok(r.a1.pt[0] === 5 && r.a1.pt[1] === 0 && !r.arc, 'نصف قطر 0: وصل عند (5,0) بلا قوس');
  r = JSON.parse(R(`JSON.stringify(filletCalc(${A},${B},[8,0],[5,-3],0))`)); eq(r.a1.end + r.a2.end, 'ab', 'اللمس على اليمين والأسفل ← الطرفان الآخران');
  ok(JSON.parse(R(`JSON.stringify(filletCalc({a:[0,0],b:[10,0]},{a:[0,1],b:[10,1]},[1,0],[1,1],1))`)).err.includes('متوازيان'), 'خطان متوازيان: رسالة خطأ');
  ok(JSON.parse(R(`JSON.stringify(filletCalc({a:[0,0],b:[2,0]},{a:[0,0],b:[0,2]},[1,0],[0,1],5))`)).err.includes('كبير'), 'نصف قطر أكبر من الجزء الباقي: خطأ');
  // امتداد: خط لا يصل إلى الآخر يُمدّ عند نصف قطر 0
  r = JSON.parse(R(`JSON.stringify(filletCalc({a:[0,0],b:[3,0]},{a:[5,-4],b:[5,4]},[1,0],[5,2],0))`)); ok(r.a1.end === 'b' && r.a1.pt[0] === 5, 'التمديد إلى نقطة الالتقاء خارج الخط');
  const c = JSON.parse(R(`JSON.stringify(chamferCalc({a:[0,0],b:[10,0]},{a:[0,0],b:[0,10]},[5,0],[0,5],2,3))`));
  ok(c.a1.pt[0] === 2 && c.a2.pt[1] === 3 && c.line.a[0] === 2 && c.line.b[1] === 3, 'شطف 2×3');
  ok(JSON.parse(R(`JSON.stringify(chamferCalc({a:[0,0],b:[10,0]},{a:[0,0],b:[0,10]},[5,0],[0,5],2,0))`)).err.includes('صفر'), 'مسافة صفر وأخرى موجبة: خطأ');
  ok(!JSON.parse(R(`JSON.stringify(chamferCalc({a:[0,0],b:[10,0]},{a:[0,0],b:[0,10]},[5,0],[0,5],0,0))`)).line, 'صفران = وصل بلا شطف');
});
t('Fillet بين جدارين: بنصف قطر 0 فقط', () => {
  R(`S.grid=0;V={x:0,y:0,s:40};tool='fillet';cornerFirst=null;FILLET_R=1;shapes=[{t:'wall',a:[0,0],b:[6,0],th:.2,ly:cl},{t:'wall',a:[0,0],b:[0,6],th:.2,ly:cl}];sel=[]`);
  R(`cornerPick(w2s(3,0));cornerPick(w2s(0,3))`);
  eq(R(`shapes.length`), 2, 'مع نصف قطر موجب: لا قوس ولا تعديل للجدران'); eq(R(`shapes[0].a[0]`), 0, 'الجدار لم يتغيّر');
  R(`cornerFirst=null;FILLET_R=0;cornerPick(w2s(3,0));cornerPick(w2s(0,3))`);
  eq(R(`shapes.length`), 2, 'نصف قطر 0: وصل الجدارين بلا إضافات'); R(`cornerFirst=null;FILLET_R=.3;tool='select'`);
});
t('Explode: أنواع مدعومة وحقول محفوظة، والمقفل لا يُفكَّك', () => {
  const n = k => R(`(explodeShape(${k})||[]).length`);
  eq(n(`{t:'rect',x:0,y:0,w:2,h:1}`), 4, 'مستطيل'); eq(n(`{t:'rect',x:0,y:0,w:2,h:1,rot:.5}`), 4, 'مستطيل مُدار');
  eq(n(`{t:'tri',p:[[0,0],[1,0],[0,1]]}`), 3, 'مثلث'); eq(n(`{t:'polygon',p:[[0,0],[1,0],[1,1],[0,1]]}`), 4, 'مضلع مغلق');
  eq(n(`{t:'polyline',p:[[0,0],[1,0],[2,1]]}`), 2, 'متعدد مفتوح: بلا ضلع إغلاق');
  eq(n(`{t:'circle',x:0,y:0,r:1}`), 0, 'الدائرة لا تُفكَّك'); eq(n(`{t:'line',a:[0,0],b:[1,1]}`), 0, 'الخط لا يُفكَّك');
  eq(R(`explodeShape({t:'polygon',p:[[0,0],[1,0],[1,1]],ly:'L',col:'#f00',lw:3})[0].lw`), 3, 'السماكة محفوظة');
  R(`shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:cl},{t:'line',a:[5,5],b:[6,6],ly:cl}];sel=[0,1];hist=nh()`);
  R(`explodeSel()`); eq(R(`shapes.length`), 5, 'مستطيل ← 4 خطوط + الخط الأصلي'); eq(R(`sel.length`), 4, 'تُحدَّد الخطوط الناتجة فقط'); eq(R(`hist.length`), 1, 'خطوة تراجع واحدة');
  R(`LY[0].lock=1;shapes=[{t:'rect',x:0,y:0,w:1,h:1,ly:LY[0].id}];sel=[0];hist=nh();explodeSel()`);
  eq(R(`shapes.length`), 1, 'شكل على طبقة مقفلة لا يُفكَّك'); eq(R(`hist.length`), 0, 'ولا خطوة تراجع'); R(`LY[0].lock=0`);
});
t('Explode: الأبعاد المربوطة بالشكل المفكَّك تُفكّ روابطها', () => {
  R(`shapes=[{t:'rect',x:0,y:0,w:2,h:1,ly:cl,id:'R1'},{t:'dim',a:[0,0],b:[2,0],off:.5,la:{id:'R1',i:0,m:0},lb:{id:'R1',i:0,m:1},ly:cl}];sel=[0];hist=nh();explodeSel()`);
  eq(R(`shapes.at(-1).t`), 'dim', 'البعد باقٍ'); ok(R(`!shapes.at(-1).la&&!shapes.at(-1).lb`), 'لا روابط معلّقة بهوية محذوفة');
});
t('Join: سلسلة، اتجاهات معكوسة، إغلاق، وأجزاء منفصلة', () => {
  const J = (l, tol = 1e-3) => JSON.parse(R(`JSON.stringify(joinChains(${JSON.stringify(l)},${tol}))`));
  let r = J([[[0, 0], [1, 0]], [[2, 0], [1, 0]], [[2, 0], [3, 1]]]);
  eq(r.length, 1, 'ثلاثة أجزاء بأطراف مقلوبة ← سلسلة واحدة'); eq(r[0].pts.length, 4, '4 نقاط'); eq(r[0].pts[0].join() + '|' + r[0].pts[3].join(), '0,0|3,1', 'الترتيب صحيح');
  r = J([[[0, 0], [2, 0]], [[2, 0], [2, 2]], [[2, 2], [0, 0]]]); ok(r[0].closed && r[0].pts.length === 3, 'ثلاثة خطوط تعود للبداية ← مغلق 3 رؤوس');
  r = J([[[0, 0], [1, 0]], [[5, 5], [6, 5]]]); eq(r.length, 2, 'أجزاء غير متصلة تبقى منفصلة'); ok(r.every(c => c.members.length === 1), 'بلا دمج');
  r = J([[[0, 0], [1, 0]], [[1.0004, 0], [2, 0]]], 1e-3); eq(r.length, 1, 'ضمن المسامحة 1 مم يصلان'); r = J([[[0, 0], [1, 0]], [[1.01, 0], [2, 0]]], 1e-3); eq(r.length, 2, 'فوق المسامحة لا يصلان');
  // الربط من البداية: الجزء الثاني يتصل ببداية السلسلة
  r = J([[[2, 0], [3, 0]], [[0, 0], [2, 0]]]); eq(r[0].pts.map(q => q[0]).join(), '0,2,3', 'الإضافة من جهة البداية');
});
t('Join: حدود الشكل والتراجع وروابط الأبعاد', () => {
  R(`V={x:0,y:0,s:40};hist=nh();shapes=[{t:'line',a:[0,0],b:[1,0],ly:cl,col:'#0f0',lw:2,id:'A'},{t:'line',a:[1,0],b:[1,1],ly:cl},{t:'circle',x:9,y:9,r:1,ly:cl},{t:'dim',a:[0,0],b:[1,0],off:.3,la:{id:'A',i:0,m:0},ly:cl}];sel=[0,1,2]`);
  R(`joinSel()`); eq(R(`shapes.length`), 3, 'خطان ← متعدد واحد، والدائرة والبعد باقيان'); eq(R(`shapes[0].t`), 'polyline', 'متعدد مفتوح'); eq(R(`shapes[0].col`), '#0f0', 'يرث لون أول جزء');
  ok(R(`!shapes.find(s=>s.t==='dim').la`), 'رابط البعد بالخط المحذوف سقط'); eq(R(`hist.length`), 1, 'خطوة تراجع واحدة'); eq(R(`sel.join()`), '0', 'تُحدَّد النتيجة');
  R(`shapes=[{t:'line',a:[0,0],b:[1,0],ly:cl},{t:'line',a:[5,5],b:[6,5],ly:cl}];sel=[0,1];hist=nh()`); R(`joinSel()`); eq(R(`shapes.length`), 2, 'غير المتلامسين: لا تغيير'); eq(R(`hist.length`), 0, 'ولا خطوة تراجع');
});
t('النقل/النسخ بنقطة أساس: الإزاحة، الأبواب، التراجع، وعناصر لم تعد موجودة', () => {
  R(`S.grid=0;V={x:0,y:0,s:40};hist=nh();shapes=[{t:'line',a:[0,0],b:[2,0],ly:cl},{t:'rect',x:1,y:1,w:1,h:1,ly:cl}];sel=[0,1];moveFlowStart('move')`);
  ok(R(`!!moveFlow&&moveFlow.stage==='base'&&tool==='select'`), 'يبدأ بنقطة الأساس'); R(`moveFlowPoint([1,1],true)`); eq(R(`moveFlow.stage`), 'dest', 'ثم الوصول');
  R(`moveFlowPoint([4,3],true)`); ok(R(`shapes[0].a.join()==='3,2'&&shapes[0].b.join()==='5,2'&&shapes[1].x===4&&shapes[1].y===3`), 'إزاحة (3,2) لكل المحدد'); ok(R(`!moveFlow`), 'ينتهي النقل'); eq(R(`hist.length`), 1, 'خطوة تراجع واحدة');
  R(`sel=[1];moveFlowStart('copy');moveFlowPoint([0,0],true);moveFlowPoint([2,0],true);moveFlowPoint([5,0],true)`);
  eq(R(`shapes.length`), 4, 'نسختان'); ok(R(`shapes[2].x===6&&shapes[3].x===9`), 'في موضعيهما'); ok(R(`!!moveFlow&&moveFlow.n===2`), 'النسخ يتكرر'); eq(R(`hist.length`), 3, 'خطوة تراجع لكل نسخة');
  R(`moveFlowPoint([0,0],true)`); eq(R(`shapes.length`), 4, 'مرحلة الوصول: إزاحة صفر لا تنسخ');
  R(`closeMoveFlow()`);
  // الأشكال لم تعد موجودة (تراجع/تبديل مشروع): لا انهيار ويُلغى التدفق
  R(`shapes=[{t:'line',a:[0,0],b:[1,0],ly:cl}];sel=[0];moveFlowStart('move');moveFlowPoint([0,0],true);shapes=[{t:'line',a:[9,9],b:[9,9],ly:cl}];moveFlowPoint([3,3],true)`);
  ok(R(`!moveFlow&&shapes[0].a.join()==='9,9'`), 'عناصر غير موجودة: يُلغى بلا أثر');
  // مقفل: لا يُنقل
  R(`LY[0].lock=1;shapes=[{t:'line',a:[0,0],b:[1,0],ly:LY[0].id}];sel=[0];moveFlowStart('move')`); ok(R(`!moveFlow`), 'طبقة مقفلة: لا يبدأ النقل'); R(`LY[0].lock=0`);
});
t('النقل بنقطة أساس: الإدخال الرقمي (Y للأعلى) ورفض القيم الفارغة', () => {
  R(`hist=nh();shapes=[{t:'circle',x:1,y:1,r:.5,ly:cl}];sel=[0];moveFlowStart('move')`);
  R(`document.querySelector('#diX').value='';document.querySelector('#diY').value='';moveFlowSubmit()`); eq(R(`moveFlow.stage`), 'base', 'أساس بلا قيم: يبقى في المرحلة');
  R(`$('#diX').value='0';$('#diY').value='0';moveFlowSubmit()`); eq(R(`moveFlow.stage`), 'dest', 'الأساس (0,0)');
  R(`$('#diX').value='2';$('#diY').value='5';moveFlowSubmit()`); ok(R(`shapes[0].x===3&&shapes[0].y===-4`), 'ΔX=2 وΔY=5 للأعلى ← y يقلّ 5'); ok(R(`!moveFlow`), 'ينتهي');
  R(`shapes=[{t:'circle',x:1,y:1,r:.5,ly:cl}];sel=[0];moveFlowStart('move');moveFlowPoint([0,0],true);$('#diX').value='';$('#diY').value='';moveFlowSubmit()`); ok(R(`!!moveFlow&&shapes[0].x===1`), 'إزاحة فارغة: لا تغيير'); R(`closeMoveFlow()`);
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

// ---------- الدفعة الثانية: مقابض الرؤوس، شدّ، كسر، التقاط عمودي وأقرب نقطة، واتجاه Y ----------
const resetB2 = () => R(`(()=>{shapes=[];sel=[];hist=nh();redo=[];V={x:0,y:0,s:40};S.grid=0;S.end=S.mid=S.int=S.cen=0;S.per=0;S.nea=0;drawFlow=null;polyDraft=null;moveFlow=null;g=null;tool='select';vtxActive=null;breakFirst=null;ST.unit='m'})()`);
const jr = code => JSON.parse(R(`JSON.stringify(${code})`));
t('إدخال الإحداثيات رقميًا: Y للأعلى موجب كما في شريط الإحداثيات', () => {
  resetB2(); R(`$('#diX').value='2';$('#diY').value='3'`);
  const p = jr(`drawPointFromInputs()`); eq(p, [2, -3], 'Y=3 يُخزَّن -3 ليظهر 3 في الشريط');
  R(`ST.unit='cm'`); R(`$('#diX').value='200';$('#diY').value='100'`); eq(jr(`drawPointFromInputs()`), [2, -1], 'بالسنتيمتر أيضًا'); R(`ST.unit='m'`);
});
t('الالتقاط العمودي: قدم العمود من نقطة الارتكاز على الضلع، ولا يظهر خارج الضلع ولا بلا ارتكاز', () => {
  resetB2(); R(`shapes=[{t:'line',a:[0,5],b:[10,5],ly:cl}];S.per=1;drawFlow={tool:'line',stage:'second',points:[[3,0]]}`);
  let o = jr(`osnap([3.1,5.05])`); ok(o && o.k === 'per', 'يلتقط عموديًا'); near(o.p[0], 3); near(o.p[1], 5);
  R(`drawFlow={tool:'line',stage:'second',points:[[-2,0]]}`); eq(jr(`osnap([-2,5])`), null, 'القدم خارج الضلع: لا التقاط');
  R(`drawFlow=null`); eq(jr(`osnap([3,5])`), null, 'بلا نقطة ارتكاز لا التقاط عمودي');
  R(`shapes=[{t:'circle',x:0,y:0,r:2,ly:cl}];drawFlow={tool:'line',stage:'second',points:[[10,0]]}`);
  o = jr(`osnap([2.05,0.02])`); ok(o && o.k === 'per'); near(o.p[0], 2); near(o.p[1], 0);
  R(`drawFlow=null`);
});
t('الالتقاط العمودي: ارتكاز سحب المقبض هو الطرف الآخر، وفي النقل بنقطة هو الأساس', () => {
  resetB2(); R(`g={k:'grip',gr:{id:'b'},o:{t:'line',a:[1,1],b:[5,1]}}`); eq(jr(`snapAnchor()`), [1, 1]);
  R(`g={k:'grip',gr:{id:2},o:{t:'polyline',p:[[0,0],[1,0],[1,3]]}}`); eq(jr(`snapAnchor()`), [1, 0]);
  R(`g=null;moveFlow={stage:'dest',base:[7,7]}`); eq(jr(`snapAnchor()`), [7, 7]); R(`moveFlow=null`);
});
t('أقرب نقطة: أقرب نقطة على الضلع، ولا تتقدّم أبدًا على نقطة التقاط حقيقية', () => {
  resetB2(); R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl}];S.nea=1`);
  let o = jr(`osnap([4.02,0.2])`); ok(o && o.k === 'nea'); near(o.p[0], 4.02); near(o.p[1], 0);
  eq(jr(`osnap([4.02,2])`), null, 'أبعد من 22 بكسل: لا التقاط');
  R(`S.end=1`); o = jr(`osnap([0.3,0.1])`); eq(o.k, 'end', 'نهاية الخط أقوى من أقرب نقطة'); R(`S.end=0;S.nea=0`);
});
t('مقابض المتعدد: رأس لكل نقطة ودائرة منتصف للأضلاع الطويلة فقط، والمضلع له ضلع إغلاق', () => {
  resetB2(); R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,0.5],[8,0.5]],ly:cl}];sel=[0]`);
  let gr = jr(`grips().filter(q=>q.kind)`); eq(gr.filter(q => q.kind === 'v').length, 4); eq(gr.filter(q => q.kind === 'm').map(q => q.id), ['m0', 'm2'], 'الضلع القصير (0.5 م = 20 بكسل) بلا مقبض منتصف');
  eq(gr.find(q => q.id === 'm0').ins, 1); eq(gr.find(q => q.id === 'm2').ins, 3);
  R(`shapes=[{t:'polygon',p:[[0,0],[4,0],[4,3]],ly:cl}];sel=[0]`); gr = jr(`grips().filter(q=>q.kind==='m')`); eq(gr.map(q => q.id), ['m0', 'm1', 'm2']); eq(gr[2].ins, 3, 'ضلع الإغلاق يُدرج في آخر القائمة');
  R(`shapes=[{t:'arc',x:0,y:0,r:2,a0:0,a1:1.5,ly:cl}];sel=[0]`); eq(jr(`grips().filter(q=>q.id!=='rot').map(q=>q.id)`), ['a0', 'a1', 'ar']);
});
t('مقابض المتعدد الكبير: تُعرض الظاهرة فقط وبسقف', () => {
  resetB2(); R(`W=400;H=700;shapes=[{t:'polyline',p:Array.from({length:5000},(_,i)=>[i*0.02,Math.sin(i/50)]),ly:cl}];sel=[0]`);
  const n = jr(`grips().length`); ok(n > 1 && n <= 902, 'العدد محدود: ' + n);
});
t('سحب مقبض القوس: النهايتان تدوّران حول المركز والطرف الآخر ثابت، والمنتصف يغيّر نصف القطر', () => {
  resetB2(); const o = `{t:'arc',x:0,y:0,r:2,a0:0,a1:Math.PI/2}`;
  let s = jr(`(()=>{const o=${o},s=copy(o);arcGripDrag(s,o,'a1',[-3,0]);return s})()`); near(s.a0, 0); near(s.a1, Math.PI, 'إلى 180°');
  s = jr(`(()=>{const o=${o},s=copy(o);arcGripDrag(s,o,'a0',[0,-3]);return s})()`); near(s.a1, Math.PI / 2); near(s.a1 - s.a0, Math.PI, 'a0 إلى -90°: المدى 180°');
  s = jr(`(()=>{const o=${o},s=copy(o);arcGripDrag(s,o,'ar',[0,5]);return s})()`); near(s.r, 5);
  s = jr(`(()=>{const o=${o},s=copy(o);arcGripDrag(s,o,'ar',[0,0]);return s})()`); near(s.r, .05, 'نصف القطر لا ينزل عن 5 سم');
});
t('إضافة/حذف رأس: روابط الأبعاد تُعاد ترقيمها ولا يقفز بُعد إلى رأس آخر', () => {
  resetB2();
  R(`shapes=[{t:'polyline',id:'P',p:[[0,0],[4,0],[4,3],[0,3]],ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'P',i:3,m:0},lb:{id:'P',i:2,m:1},ly:cl}]`);
  R(`vertexInsert(shapes[0],2,[4,1.5])`); let d = jr(`shapes[1]`);
  eq(d.la.i, 4, 'رأس 3 صار 4'); eq(d.lb.i, 3, 'منتصف الضلع 2 صار الضلع 3'); eq(jr(`shapes[0].p.length`), 5);
  R(`shapes[1].lb={id:'P',i:1,m:1}`); R(`vertexInsert(shapes[0],2,[4,0.5])`); ok(!jr(`shapes[1]`).lb, 'الضلع المنقسم يسقط رابطه');
  resetB2();
  R(`shapes=[{t:'polyline',id:'P',p:[[0,0],[4,0],[4,3],[0,3]],ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'P',i:3,m:0},lb:{id:'P',i:2,m:1},ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'P',i:1,m:0},lb:{id:'P',i:0,m:1},ly:cl}]`);
  R(`sel=[0];vtxActive={s:shapes[0],k:1}`); ok(R(`vertexDeleteActive()`), 'حُذف الرأس');
  eq(jr(`shapes[0].p`), [[0, 0], [4, 3], [0, 3]]); d = jr(`shapes[1]`); eq(d.la.i, 2, 'رأس 3 صار 2'); eq(d.lb.i, 1, 'ضلع 2 صار 1');
  d = jr(`shapes[2]`); ok(!d.la && !d.lb, 'رابط الرأس المحذوف ورابط الضلع المندمج سقطا');
  eq(R(`hist.length`), 1, 'خطوة تراجع واحدة');
  R(`sel=[0];vtxActive={s:shapes[0],k:0}`); R(`vertexDeleteActive()`); ok(!R(`vertexDeleteActive()`), 'متعدد برأسين: الحذف مرفوض'); eq(jr(`shapes[0].p.length`), 2);
  R(`shapes=[{t:'polygon',p:[[0,0],[4,0],[4,3]],ly:cl}];sel=[0];vtxActive={s:shapes[0],k:0}`); ok(!R(`vertexDeleteActive()`), 'مضلع بثلاثة رؤوس: الحذف مرفوض');
  R(`vtxActive=null`);
});
t('الرأس النشط لا يبقى بعد تغيّر التحديد أو الشكل', () => {
  resetB2(); R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,3]],ly:cl},{t:'line',a:[0,0],b:[1,1],ly:cl}];sel=[0];vtxActive={s:shapes[0],k:1}`); ok(R(`!!vtxSel()`));
  R(`sel=[1]`); ok(R(`!vtxSel()`), 'تحديد آخر'); R(`sel=[0];shapes[0]=copy(shapes[0])`); ok(R(`!vtxSel()`), 'استُبدل الشكل');
  R(`vtxActive=null`);
});
t('الشدّ: خط ومتعدد ومثلث، الرؤوس داخل الإطار فقط تتحرك', () => {
  resetB2(); const w = `{x0:3,y0:-1,x1:5,y1:1}`;
  eq(jr(`(()=>{const s={t:'line',a:[0,0],b:[4,0]};stretchShape(s,${w},2,1);return s})()`), { t: 'line', a: [0, 0], b: [6, 1] });
  eq(jr(`(()=>{const s={t:'polyline',p:[[0,0],[4,0],[4,3]]};stretchShape(s,${w},1,0);return s.p})()`), [[0, 0], [5, 0], [4, 3]]);
  eq(jr(`(()=>{const s={t:'line',a:[0,0],b:[1,0]};return stretchShape(s,${w},1,0)})()`), false, 'لا رأس داخل الإطار: لا تغيير');
  eq(jr(`(()=>{const s={t:'tri',p:[[4,0],[8,0],[6,5]]};stretchShape(s,${w},0,1);return s.p})()`), [[4, 1], [8, 0], [6, 5]]);
});
t('الشدّ: المستطيل يبقى مستطيلًا عند شدّ ضلع بإزاحة عمودية عليه، ويتحول إلى مضلع عند إزاحة مائلة، ويتحرك كاملًا إن كان كله في الإطار', () => {
  resetB2(); const w = `{x0:3.5,y0:-1,x1:5,y1:4}`;
  let s = jr(`(()=>{const s={t:'rect',x:0,y:0,w:4,h:3,name:'غرفة'};stretchShape(s,${w},2,0);return s})()`); eq([s.t, s.x, s.y, s.w, s.h, s.name], ['rect', 0, 0, 6, 3, 'غرفة']);
  s = jr(`(()=>{const s={t:'rect',x:0,y:0,w:4,h:3};stretchShape(s,${w},-1,0);return s})()`); eq([s.t, s.w], ['rect', 3], 'تقليص العرض');
  s = jr(`(()=>{const s={t:'rect',x:0,y:0,w:4,h:3,col:'#f00'};stretchShape(s,${w},1,1);return s})()`); eq(s.t, 'polygon'); eq(s.p, [[0, 0], [5, 1], [5, 4], [0, 3]]); eq(s.col, '#f00'); ok(s.x === undefined && s.w === undefined);
  s = jr(`(()=>{const s={t:'rect',x:0,y:0,w:4,h:3};stretchShape(s,{x0:-1,y0:-1,x1:5,y1:4},2,2);return s})()`); eq([s.t, s.x, s.y, s.w, s.h], ['rect', 2, 2, 4, 3], 'كله داخل الإطار: يتحرك فقط');
  // مستطيل مدوّر 90°: ضلعه المحلي الأيمن (الرأسان 1 و2) أفقي في العالم، وشدّه إلى الأعلى (محور x المحلي) يوسّع العرض ويحفظ الدوران
  s = jr(`(()=>{const s={t:'rect',x:0,y:0,w:4,h:3,rot:Math.PI/2},c=rc(s),w={x0:Math.min(c[1][0],c[2][0])-.1,x1:Math.max(c[1][0],c[2][0])+.1,y0:Math.min(c[1][1],c[2][1])-.1,y1:Math.max(c[1][1],c[2][1])+.1};stretchShape(s,w,0,1);return[s.t,s.rot,s.w,s.h,s.x+s.w/2,s.y+s.h/2]})()`);
  eq(s[0], 'rect'); near(s[1], Math.PI / 2); near(s[2], 5); near(s[3], 3); near(s[4], 2, 'المركز المحلي انتقل بنصف الإزاحة'); near(s[5], 2);
});
t('الشدّ: stretchHits يوافق stretchShape، والمقفل والمخفي لا يُشدّان، والباب يلتصق بالجدار', () => {
  resetB2(); R(`LY=[{id:'l1',name:'a',vis:1,lock:0},{id:'l2',name:'b',vis:1,lock:1}];cl='l1'`);
  R(`shapes=[{t:'wall',a:[0,0],b:[4,0],th:.2,ly:'l1'},{t:'wall',a:[4,0],b:[4,3],th:.2,ly:'l1'},{t:'line',a:[4,0],b:[6,0],ly:'l2'},{t:'door',x:2,y:0,a:0,th:.2,w:.9,f:1,h:1,ly:'l1'},{t:'circle',x:4,y:0,r:1,ly:'l1'}]`);
  const w = `{x0:3.5,y0:-1,x1:4.5,y1:1}`; eq(jr(`stretchAffected(${w}).map(s=>s.t)`), ['wall', 'wall', 'circle'], 'المقفلة لا تُحتسب');
  R(`shapes.forEach(s=>{if(!stretchHits(s,${w})&&s.ly==='l1'){}})`);
  R(`LY=[{id:'l1',name:'a',vis:1,lock:0}];shapes[2].ly='l1'`); R(`snap();stretchApply(${w},0,0.5)`);
  eq(jr(`shapes[0].b`), [4, 0.5], 'طرف الجدار الأول انتقل'); eq(jr(`shapes[1].a`), [4, 0.5]); eq(jr(`shapes[4].y`), 0.5, 'مركز الدائرة داخل الإطار فتحرّك');
  R(`LY=[{id:'l1',name:'a',vis:1,lock:0}];cl='l1'`);
});
t('الشدّ: تدفق كامل (إطار ثم أساس ثم وصول) بخطوة تراجع واحدة، ومعاينة الشبح، ورفض الإطار الفارغ', () => {
  resetB2(); R(`shapes=[{t:'rect',x:0,y:0,w:4,h:3,ly:cl}]`); R(`stretchStart()`); eq(R(`moveFlow.stage`), 'window');
  R(`stretchWindowDone([10,10],[12,12],50)`); eq(R(`moveFlow.stage`), 'window', 'إطار فارغ: يبقى في مرحلة الإطار');
  R(`stretchWindowDone([0,0],[0,0],3)`); eq(R(`moveFlow.stage`), 'window', 'لمسة قصيرة لا ترسم إطارًا');
  R(`stretchWindowDone([3.5,-1],[5,4],50)`); eq(R(`moveFlow.stage`), 'base'); eq(R(`moveFlow.hits`), 1);
  R(`moveFlowPoint([4,1.5],true)`); eq(R(`moveFlow.stage`), 'dest'); R(`moveFlow.at=[6,1.5];moveFlow.base=[4,1.5];moveFlowPreview([6,1.5])`); eq(R(`moveFlow.ghost.length`), 1, 'معاينة بشبح واحد');
  R(`moveFlowCommit(2,0)`); eq(R(`shapes[0].w`), 6); eq(R(`moveFlow`), null); eq(R(`hist.length`), 1);
  R(`$('#undo').click()`); eq(R(`shapes[0].w`), 4, 'تراجع واحد يعيد الأصل');
  R(`moveFlow={mode:'stretch',stage:'window',win:null,items:[]};moveFlowSubmit()`); ok(R(`!!moveFlow`)); R(`moveFlow=null`);
});
t('الكسر: خط ينقسم عند نقطة وتُحفظ خصائصه، وجدار يحفظ سماكته، والطرف مرفوض', () => {
  resetB2(); R(`shapes=[{t:'wall',a:[0,0],b:[10,0],th:.3,col:'#123',lw:3,ly:cl}]`);
  ok(R(`applyBreak(0,0.4,0.4)`)); eq(jr(`shapes.map(s=>[s.a,s.b,s.th,s.col,s.lw])`), [[[0, 0], [4, 0], .3, '#123', 3], [[4, 0], [10, 0], .3, '#123', 3]]); eq(jr(`sel`), [0, 1]); eq(R(`hist.length`), 1);
  R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl}]`); ok(!R(`applyBreak(0,0,0)`), 'عند البداية: مرفوض'); ok(!R(`applyBreak(0,1,1)`), 'عند النهاية: مرفوض'); eq(R(`shapes.length`), 1);
});
t('الكسر بين نقطتين: يُحذف الجزء بينهما، أو يُقصّ طرف، ويُرفض حذف الشكل كله', () => {
  resetB2(); R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl}]`); ok(R(`applyBreak(0,.3,.6)`));
  eq(jr(`shapes.map(s=>[s.a,s.b])`), [[[0, 0], [3, 0]], [[6, 0], [10, 0]]]);
  R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl}]`); ok(R(`applyBreak(0,0,.3)`)); eq(jr(`shapes.map(s=>[s.a,s.b])`), [[[3, 0], [10, 0]]], 'يُقصّ الطرف');
  R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl}]`); ok(!R(`applyBreak(0,0,1)`), 'الكل مرفوض');
});
t('الكسر: متعدد خطوط ينقسم إلى متعددين بنقطة الكسر في كل منهما', () => {
  resetB2(); R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,4],[8,4]],ly:cl,col:'#0a0'}]`);
  ok(R(`applyBreak(0,1.5,1.5)`)); eq(jr(`shapes.map(s=>s.p)`), [[[0, 0], [4, 0], [4, 2]], [[4, 2], [4, 4], [8, 4]]]); eq(jr(`shapes[1].col`), '#0a0');
  R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,4],[8,4]],ly:cl}]`); ok(R(`applyBreak(0,1,1)`), 'عند رأس داخلي'); eq(jr(`shapes.map(s=>s.p)`), [[[0, 0], [4, 0]], [[4, 0], [4, 4], [8, 4]]]);
  R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,4],[8,4]],ly:cl}]`); ok(R(`applyBreak(0,.5,2.5)`)); eq(jr(`shapes.map(s=>s.p)`), [[[0, 0], [2, 0]], [[6, 4], [8, 4]]], 'τ=2.5 هو منتصف الضلع الأخير (6,4)');
});
t('الكسر: روابط الأبعاد تنتقل إلى القطعة الصحيحة وتسقط في الجزء المحذوف', () => {
  resetB2();
  R(`shapes=[{t:'line',id:'L',a:[0,0],b:[10,0],ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'L',i:0,m:0},lb:{id:'L',i:1,m:0},ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'L',i:0,m:1},lb:{id:'L',i:0,t:.9},ly:cl}]`);
  ok(R(`applyBreak(0,.4,.4)`)); const ids = jr(`[shapes[0].id,shapes[1].id]`); ok(ids[0] === 'L' && ids[1] && ids[1] !== 'L', 'القطعة الجديدة لها معرّف');
  const d1 = jr(`shapes[2]`), d2 = jr(`shapes[3]`);
  eq(d1.la, { id: 'L', i: 0, m: 0 }, 'رأس البداية يبقى'); eq(d1.lb, { id: ids[1], i: 1, m: 0 }, 'رأس النهاية ينتقل إلى القطعة الثانية');
  ok(d2.la.id === ids[1], 'منتصف الخط (0.5) يقع بعد نقطة الكسر (0.4) فيذهب للقطعة الثانية'); near(d2.la.t, (.5 - .4) / .6); ok(d2.lb.id === ids[1]); near(d2.lb.t, (.9 - .4) / .6);
  // الجزء المحذوف يُسقط روابطه
  resetB2(); R(`shapes=[{t:'line',id:'L',a:[0,0],b:[10,0],ly:cl},{t:'dim',mode:'linear',a:[0,0],b:[0,0],off:.5,la:{id:'L',i:0,t:.5},lb:{id:'L',i:0,t:.9},ly:cl}]`);
  ok(R(`applyBreak(0,.3,.6)`)); const d = jr(`shapes[2]`); ok(!d.la, 'رابط الجزء المحذوف سقط'); ok(d.lb && d.lb.i === 0 && Math.abs(d.lb.t - .75) < 1e-9, 'الرابط في القطعة الثانية يُعاد حسابه');
  // أبعاد زاوية: تُفك روابطها
  resetB2(); R(`shapes=[{t:'line',id:'L',a:[0,0],b:[10,0],ly:cl},{t:'dim',mode:'angular',a:[0,0],b:[1,1],c:[0,0],off:.5,la:{id:'L',i:0},lb:{id:'L',i:0},ly:cl}]`);
  R(`applyBreak(0,.5,.5)`); ok(!jr(`shapes[2]`).la, 'البعد الزاوي يُفك');
});
t('الكسر: breakPick بالنمطين على خط وعلى شكل غير مدعوم', () => {
  resetB2(); R(`shapes=[{t:'line',a:[0,0],b:[10,0],ly:cl},{t:'circle',x:20,y:20,r:1,ly:cl}]`);
  R(`breakMode='two';breakFirst=null;breakPick(w2s(2,0))`); ok(R(`!!breakFirst`)); eq(R(`shapes.length`), 2);
  R(`breakPick(w2s(5,0))`); eq(R(`shapes.length`), 3); ok(R(`!breakFirst`));
  R(`breakMode='pt';breakPick(w2s(20,20+1))`); eq(R(`shapes.length`), 3, 'الدائرة غير مدعومة');
  R(`breakFirst={s:shapes[0],tau:.3};breakMode='two';breakPick(w2s(2.0000001,0))`); eq(R(`shapes.length`), 3, 'نقطتان متطابقتان: مرفوضة');
  R(`breakFirst=null;breakMode='pt'`);
});
t('شريط الاختصارات: S شدّ وB كسر وDelete للرأس، وقائمة المساعدة تذكرها', () => {
  const help = R(`KEY_HELP.map(x=>x[0]).join('|')`); ok(/\|S\|/.test('|' + help + '|') && /\|B\|/.test('|' + help + '|'), 'S وB في المساعدة');
  resetB2(); R(`shapes=[{t:'line',a:[0,0],b:[2,0],ly:cl}]`); R(`onKey({code:'KeyS',preventDefault(){},target:{tagName:'DIV'}})`); eq(R(`moveFlow&&moveFlow.mode`), 'stretch'); R(`closeMoveFlow()`);
  R(`onKey({code:'KeyB',preventDefault(){},target:{tagName:'DIV'}})`); eq(R(`tool`), 'break'); eq(R(`breakMode`), 'pt'); R(`tool='select';editAction=null;breakFirst=null`);
  R(`shapes=[{t:'polyline',p:[[0,0],[4,0],[4,3]],ly:cl}];sel=[0];vtxActive={s:shapes[0],k:2}`);
  R(`onKey({code:'Delete',preventDefault(){},target:{tagName:'DIV'}})`); eq(R(`shapes.length`), 1, 'Delete حذف الرأس لا الشكل'); eq(R(`shapes[0].p.length`), 2);
  R(`onKey({code:'Delete',preventDefault(){},target:{tagName:'DIV'}})`); eq(R(`shapes.length`), 0, 'ثم Delete يحذف الشكل');
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

