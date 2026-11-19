#!/usr/bin/env node
/* اختبار تفكيك كتل DXF الخارجية (INSERT) في src/js/17-dxf.js — بلا اعتماديات ولا متصفح.
 * الاستخدام:  node tools/test-dxf-blocks.js            */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const file = process.env.DXF_FILE || path.join(__dirname, '..', 'src', 'js', '17-dxf.js');
let n = 0;
const ctx = {
  console, Math, Number, String, Array, Map, Set, Object, JSON, TextDecoder,
  uid: (() => { let i = 0; return () => 'id' + (++i); })(),
  isDrawLineShape: s => !!s && ['line', 'wall', 'rect', 'circle', 'arc', 'ellipse', 'polygon', 'polyline', 'tri', 'free'].includes(s.t)
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: '17-dxf.js' });
const run = code => vm.runInContext(code, ctx);
ctx.__txt = '';

// يبني نص DXF من مصفوفة [كود، قيمة]
const dxf = pairs => pairs.map(([c, v]) => c + '\n' + v).join('\n') + '\n';
const imp = pairs => { ctx.__txt = dxf(pairs); return run('(()=>{const E=dxfEntities(__txt);return{E,R:dxfShapes(E,1)}})()'); };
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || ''}: ${a} ≠ ${b}`);
const t = (name, fn) => { fn(); n++; console.log('✓ ' + name); };
const layerName = (R, s) => R.LY.find(l => l.id === s.ly).name;

// رأس BLOCK كما يكتبه AutoCAD: مقبض وطبقة قبل الاسم، ونقطة أساس
const BLK = (name, base, ents) => [
  [0, 'BLOCK'], [5, '1F'], [330, '1'], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockBegin'],
  [2, name], [70, 0], [10, base[0]], [20, base[1]], [30, 0], [3, name], [1, ''],
  ...ents, [0, 'ENDBLK'], [5, '20'], [100, 'AcDbEntity'], [8, '0'], [100, 'AcDbBlockEnd']
];
const SEC = (name, body) => [[0, 'SECTION'], [2, name], ...body, [0, 'ENDSEC']];
const HEAD = SEC('HEADER', [[9, '$INSUNITS'], [70, 6]]);
const TABLES = SEC('TABLES', [[0, 'TABLE'], [2, 'LAYER'], [70, 2],
  [0, 'LAYER'], [2, 'WALLS'], [70, 0], [62, 3], [6, 'CONTINUOUS'],
  [0, 'LAYER'], [2, '0'], [70, 0], [62, 7], [6, 'CONTINUOUS'], [0, 'ENDTAB']]);
const ENT = list => SEC('ENTITIES', list);
const END = [[0, 'EOF']];
const INS = (name, x, y, o = {}) => [[0, 'INSERT'], [8, o.ly || '0'], [2, name], [10, x], [20, y], [30, 0],
  ...(o.sx !== undefined ? [[41, o.sx]] : []), ...(o.sy !== undefined ? [[42, o.sy]] : []),
  ...(o.rot !== undefined ? [[50, o.rot]] : []), ...(o.extra || [])];

const DOOR = BLK('DOOR', [0.5, 0], [
  [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 1], [21, 0], [31, 0],
  [0, 'ARC'], [8, '0'], [10, 0], [20, 0], [30, 0], [40, 1], [50, 0], [51, 90],
  [0, 'CIRCLE'], [8, 'DETAIL'], [10, 0.5], [20, 0.5], [30, 0], [40, 0.1]
]);

t('اسم الكتلة يُقرأ من الكود 2 رغم وجود المقبض والطبقة قبله، مع نقطة الأساس', () => {
  const { E } = imp([...HEAD, ...SEC('BLOCKS', DOOR), ...ENT([...INS('DOOR', 0, 0)]), ...END]);
  assert.ok(E.blocks.has('DOOR'), 'الكتلة DOOR غير موجودة: ' + [...E.blocks.keys()]);
  assert.strictEqual(E.blocks.get('DOOR').length, 3);
  assert.deepStrictEqual(Array.from(E.blockBase.get('DOOR')), [0.5, 0]);
});

t('INSERT بتحجيم 2 وتدوير 90° وإزاحة: الخط والقوس والدائرة تتحول بدقة', () => {
  const { R } = imp([...HEAD, ...TABLES, ...SEC('BLOCKS', DOOR),
    ...ENT([...INS('DOOR', 10, 5, { ly: 'WALLS', sx: 2, sy: 2, rot: 90 })]), ...END]);
  assert.strictEqual(R.shapes.length, 3, 'عدد الأشكال');
  const line = R.shapes.find(s => s.t === 'line'), arc = R.shapes.find(s => s.t === 'arc'), c = R.shapes.find(s => s.t === 'circle');
  // (0,0)→(1,0) ناقص الأساس (0.5,0) ×2 ثم تدوير 90° وإزاحة (10,5) = (10,4)→(10,6) ثم قلب Y
  near(line.a[0], 10, 'line.a.x'); near(line.a[1], -4, 'line.a.y'); near(line.b[0], 10, 'line.b.x'); near(line.b[1], -6, 'line.b.y');
  near(arc.x, 10, 'arc.x'); near(arc.y, -4, 'arc.y'); near(arc.r, 2, 'arc.r');
  near(arc.a0, -Math.PI, 'arc.a0'); near(arc.a1, -Math.PI / 2, 'arc.a1');
  near(c.x, 10 - 2 * 0.5, 'circle.x'); near(c.y, -(5 + 2 * 0), 'circle.y'); near(c.r, 0.2, 'circle.r');
  assert.strictEqual(layerName(R, line), 'WALLS', 'طبقة الخط الموروثة');
  assert.strictEqual(layerName(R, c), 'DETAIL', 'طبقة الدائرة الصريحة تبقى');
});

t('مرآة (تحجيم x سالب): الخط يُعكس والقوس يتحول إلى خط متعدد', () => {
  const { R } = imp([...HEAD, ...SEC('BLOCKS', DOOR), ...ENT([...INS('DOOR', 0, 0, { sx: -1, sy: 1 })]), ...END]);
  const line = R.shapes.find(s => s.t === 'line');
  near(line.a[0], 0.5, 'a.x'); near(line.b[0], -0.5, 'b.x');
  assert.ok(!R.shapes.some(s => s.t === 'arc'), 'القوس المعكوس لا يبقى أصليًا');
  const pl = R.shapes.find(s => s.t === 'polyline');
  assert.ok(pl && pl.p.length >= 8, 'خط متعدد مأخوذ العيّنات');
  // القوس الأصلي ربع دائرة حول (0,0) نصف قطرها 1 يبدأ عند (1,0)؛ بعد طرح الأساس (0.5,0) وعكس x تبدأ النقطة الأولى عند (-0.5,0)
  near(pl.p[0][0], -0.5, 'بداية القوس x'); near(pl.p[0][1], 0, 'بداية القوس y');
  const last = pl.p[pl.p.length - 1];
  near(last[0], 0.5, 'نهاية القوس x'); near(last[1], -1, 'نهاية القوس y');
});

t('تحجيم غير منتظم: الدائرة تتحول إلى مضلع مغلق', () => {
  const { R } = imp([...HEAD, ...SEC('BLOCKS', DOOR), ...ENT([...INS('DOOR', 0, 0, { sx: 3, sy: 1 })]), ...END]);
  const pg = R.shapes.find(s => s.t === 'polygon');
  assert.ok(pg && pg.p.length === 48, 'مضلع من 48 نقطة');
  const xs = pg.p.map(q => q[0]);
  near(Math.max(...xs) - Math.min(...xs), 0.6 * 1, 'العرض ≈ 2·r·3 = 0.6');
});

t('كتل متداخلة: التحويلان يتركّبان', () => {
  const INNER = BLK('INNER', [0, 0], [[0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 1], [21, 0], [31, 0]]);
  const OUTER = BLK('OUTER', [0, 0], [...INS('INNER', 2, 0, { rot: 90 })]);
  const { R } = imp([...HEAD, ...SEC('BLOCKS', [...INNER, ...OUTER]), ...ENT([...INS('OUTER', 10, 10, { sx: 2, sy: 2 })]), ...END]);
  const line = R.shapes.find(s => s.t === 'line');
  // الداخلي: (0,0)→(1,0) بتدوير 90° وإزاحة (2,0) = (2,0)→(2,1)؛ ثم الخارجي ×2 وإزاحة (10,10) = (14,10)→(14,12)
  near(line.a[0], 14); near(line.a[1], -10); near(line.b[0], 14); near(line.b[1], -12);
});

t('كتلة ناقصة ودوران ذاتي: لا يتعطل ويُحصى INSERT كمتجاهَل', () => {
  const LOOP = BLK('LOOP', [0, 0], [...INS('LOOP', 1, 1), [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 1], [21, 1], [31, 0]]);
  const { R } = imp([...HEAD, ...SEC('BLOCKS', LOOP),
    ...ENT([...INS('LOOP', 0, 0), ...INS('GHOST', 5, 5), [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 9], [21, 9], [31, 0]]), ...END]);
  assert.strictEqual(R.skip.INSERT, 2, 'GHOST + الاستدعاء الذاتي');
  assert.ok(R.shapes.filter(s => s.t === 'line').length >= 2);
});

t('MINSERT: صفوف وأعمدة بتباعد غير مقيس', () => {
  const B = BLK('BOX', [0, 0], [[0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 1], [21, 0], [31, 0]]);
  const { R } = imp([...HEAD, ...SEC('BLOCKS', B),
    ...ENT([...INS('BOX', 0, 0, { sx: 2, sy: 2, extra: [[70, 3], [71, 2], [44, 10], [45, 5]] })]), ...END]);
  const lines = R.shapes.filter(s => s.t === 'line');
  assert.strictEqual(lines.length, 6);
  const xs = [...new Set(lines.map(l => Math.round(l.a[0])))].sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [0, 10, 20]);
  const ys = [...new Set(lines.map(l => Math.round(l.a[1])))].sort((a, b) => a - b);
  assert.deepStrictEqual(ys, [-5, 0]);
});

t('طبقة 0 ولون BYBLOCK يرثان من INSERT', () => {
  const B = BLK('COL', [0, 0], [[0, 'LINE'], [8, '0'], [62, 0], [10, 0], [20, 0], [30, 0], [11, 1], [21, 0], [31, 0]]);
  const { R } = imp([...HEAD, ...TABLES, ...SEC('BLOCKS', B), ...ENT([...INS('COL', 0, 0, { ly: 'WALLS', extra: [[62, 1]] })]), ...END]);
  const l = R.shapes.find(s => s.t === 'line');
  assert.strictEqual(layerName(R, l), 'WALLS');
  assert.strictEqual(l.col, '#dc2626');
});

t('متعدد POLYLINE/VERTEX وLWPOLYLINE داخل كتلة (مع انعكاس الانحناء)', () => {
  const B = BLK('PL', [0, 0], [
    [0, 'LWPOLYLINE'], [8, '0'], [90, 3], [70, 1], [10, 0], [20, 0], [10, 2], [20, 0], [10, 2], [20, 1],
    [0, 'POLYLINE'], [8, '0'], [66, 1], [10, 0], [20, 0], [30, 0], [70, 0],
    [0, 'VERTEX'], [8, '0'], [10, 0], [20, 0], [30, 0], [0, 'VERTEX'], [8, '0'], [10, 0], [20, 3], [30, 0], [0, 'SEQEND'], [8, '0']
  ]);
  const { R } = imp([...HEAD, ...SEC('BLOCKS', B), ...ENT([...INS('PL', 100, 0)]), ...END]);
  const tri = R.shapes.find(s => s.t === 'tri'), ln = R.shapes.find(s => s.t === 'line');
  assert.ok(tri, 'المثلث المغلق'); near(tri.p[0][0], 100); near(tri.p[1][0], 102);
  assert.ok(ln, 'الخط من POLYLINE'); near(ln.a[0], 100); near(ln.b[1], -3);
});

t('نص داخل كتلة: الارتفاع والدوران يُحوَّلان', () => {
  const B = BLK('TX', [0, 0], [[0, 'TEXT'], [8, '0'], [10, 0], [20, 0], [30, 0], [40, 0.5], [1, 'AB'], [50, 0]]);
  const { R } = imp([...HEAD, ...SEC('BLOCKS', B), ...ENT([...INS('TX', 0, 0, { sx: 2, sy: 2, rot: 90 })]), ...END]);
  const tx = R.shapes.find(s => s.t === 'text');
  near(tx.h, 1, 'الارتفاع'); near(tx.a, -Math.PI / 2, 'الزاوية');
});

t('كتل MelkiCAD (MKD_) تعمل كما كانت ولا تُفكّ', () => {
  const { E, R } = imp([...HEAD, ...ENT([...INS('MKD_W_1.2_0.2', 3, 4)]), ...END]);
  assert.strictEqual(E.length, 1);
  assert.strictEqual(R.shapes.length, 1);
  assert.strictEqual(R.shapes[0].t, 'win');
  assert.ok(!R.skip.INSERT);
});

t('ملف بلا INSERT خارجي: dxfExpandInserts يعيد E نفسه بلا نسخ', () => {
  const { E } = imp([...HEAD, ...ENT([[0, 'LINE'], [8, '0'], [10, 0], [20, 0], [30, 0], [11, 1], [21, 1], [31, 0]]), ...END]);
  assert.strictEqual(E.length, 1);
  assert.strictEqual(run('(()=>{const E=dxfEntities(__txt);return dxfExpandInserts(E)===E})()'), true);
});

t('المسح الثاني (dxfImport يستدعي dxfShapes مرتين) يعطي نتيجة مطابقة', () => {
  ctx.__txt = dxf([...HEAD, ...SEC('BLOCKS', DOOR), ...ENT([...INS('DOOR', 1, 1), ...INS('NOPE', 0, 0)]), ...END]);
  const r = run('(()=>{const E=dxfEntities(__txt),a=dxfShapes(E,1),b=dxfShapes(E,0.01);return{a:a.shapes.length,b:b.shapes.length,sa:a.skip.INSERT,sb:b.skip.INSERT}})()');
  assert.deepStrictEqual({ ...r }, { a: 3, b: 3, sa: 1, sb: 1 });
});

console.log(`\n✓ سليم: ${n} اختبار لتفكيك كتل DXF`);
