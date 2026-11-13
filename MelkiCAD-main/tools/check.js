#!/usr/bin/env node
/* فحص سلامة المصدر قبل النشر (بدون أي اعتماديات):
 *  1) صياغة كل ملفات JS سليمة
 *  2) كل ملف محلي مرجعيّ في index.html موجود، وكل ملف js/ مذكور في index.html و sw.js
 *  3) كل مدخلات CORE في sw.js موجودة فعلًا (وإلا يفشل cache.addAll ويتعطّل العمل بلا إنترنت)
 *  4) لا ملفات .orig/.rej ولا بقايا لـ 20-backup
 *  5) لا تعريفات مكررة بين الملفات (النطاق العام مشترك فيُستبدل الأول بصمت)، وخريطة الملفات في index.html كاملة
 *  6) سطر VER في sw.js سليم (يُختم تلقائيًا عند النشر)، وكل أيقونات manifest موجودة
 *  7) كل url(...) في CSS موجود ومخزَّن في CORE، ولا روابط خارجية (خطوط/سكربتات) تعطّل العمل بلا إنترنت
 *  8) أيقونة أندرويد وشاشة البدء (android-wrapper/native/res): أسماء فريدة لا تصطدم بموارد Capacitor الافتراضية، ومراجع الموارد موجودة
 * الاستخدام:  node tools/check.js            */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const errs = [];
const rd = f => fs.readFileSync(path.join(src, f), 'utf8');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// 1) صياغة JS
const jsFiles = fs.readdirSync(path.join(src, 'js')).filter(f => f.endsWith('.js')).sort();
for (const f of [...jsFiles.map(f => 'js/' + f), 'sw.js']) {
  try { new vm.Script(rd(f), { filename: f }); } catch (e) { errs.push(`صياغة ${f}: ${e.message}`); }
}

// 2) index.html
const html = rd('index.html');
const refs = [...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map(m => m[1]).filter(r => !/^(https?:|data:)/.test(r));
for (const r of refs) if (!fs.existsSync(path.join(src, r))) errs.push(`index.html يشير إلى ملف غير موجود: ${r}`);
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
for (const f of jsFiles) if (!scripts.includes('js/' + f)) errs.push(`js/${f} غير محمّل في index.html`);

// 3) sw.js
const sw = rd('sw.js');
const core = [...(sw.match(/const CORE=\[([\s\S]*?)\]/) || [, ''])[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
if (!core.length) errs.push('تعذّر قراءة CORE من sw.js');
for (const c of core) if (c !== './' && !fs.existsSync(path.join(src, c))) errs.push(`sw.js CORE يحتوي ملفًا غير موجود: ${c}`);
for (const f of jsFiles) if (!core.includes('js/' + f)) errs.push(`js/${f} غير موجود في CORE بـ sw.js`);

// 4) بقايا
for (const f of walk(src)) if (/\.(orig|rej)$/.test(f)) errs.push(`ملف مؤقت يجب حذفه: ${path.relative(src, f)}`);
if (/20-backup/.test(html + sw)) errs.push('بقايا مرجع إلى 20-backup');

// 5) تعريفات مكررة + اكتمال خريطة الملفات
const defs = new Map();
for (const f of jsFiles) {
  const code = rd('js/' + f);
  for (const m of code.matchAll(/^(?:async\s+)?(?:function|const|let|var)\s+([\w$]+)/gm)) {
    if (defs.has(m[1])) errs.push(`«${m[1]}» معرَّف في ${defs.get(m[1])} وفي ${f}`); else defs.set(m[1], f);
  }
  if (!html.includes('js/' + f.replace(/\.js$/, '') + '.js ') && !new RegExp('js/' + f.replace('.', '\\.') + '\\s').test(html)) errs.push(`js/${f} غير مذكور في خريطة الملفات داخل index.html`);
}

// 6) VER وأيقونات manifest
if (!/^const VER='[^']+';/m.test(sw)) errs.push("sw.js: يجب أن يبدأ سطر الإصدار هكذا: const VER='...'; (يعتمد عليه ختم النشر)");
try {
  const mf = JSON.parse(rd('manifest.json'));
  for (const i of mf.icons || []) if (!fs.existsSync(path.join(src, i.src))) errs.push(`manifest.json: أيقونة غير موجودة ${i.src}`);
  for (const i of mf.icons || []) if (!core.includes(i.src)) errs.push(`manifest.json: الأيقونة ${i.src} غير موجودة في CORE بـ sw.js`);
} catch (e) { errs.push('manifest.json: ' + e.message); }

// 7) مراجع url(...) في CSS وروابط خارجية في index.html
for (const cssFile of fs.readdirSync(path.join(src, 'css')).filter(f => f.endsWith('.css'))) {
  for (const m of rd('css/' + cssFile).matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g)) {
    const u = m[1];
    if (/^https?:/.test(u)) { errs.push(`css/${cssFile}: مرجع خارجي ${u} (لن يعمل بلا إنترنت)`); continue; }
    if (/^(data:|#)/.test(u)) continue;
    const rel = path.posix.normalize('css/' + u.split(/[?#]/)[0]);
    if (!fs.existsSync(path.join(src, rel))) errs.push(`css/${cssFile}: الملف غير موجود ${rel}`);
    else if (!core.includes(rel)) errs.push(`css/${cssFile}: ${rel} غير موجود في CORE بـ sw.js`);
  }
}
for (const m of html.matchAll(/<(?:link|script)\b[^>]*\b(?:href|src)=["'](https?:\/\/[^"']+)["']/g)) errs.push(`index.html: مرجع خارجي ${m[1]} (لن يعمل بلا إنترنت)`);

// 8) أيقونة أندرويد: Capacitor يولّد موارد افتراضية بأسماء ic_launcher_foreground/ic_launcher_background (شعار Capacitor)،
//    فإن سمّينا موردنا بالاسم نفسه فقد يغلب الافتراضي أيقونتنا في الجهاز. نشترط أسماء فريدة ومراجع تُحَلّ ضمن native/res
const nat = path.join(__dirname, '..', 'android-wrapper', 'native', 'res');
if (fs.existsSync(nat)) {
  const RESERVED = new Set(['ic_launcher_foreground', 'ic_launcher_background']);
  const files = walk(nat).map(f => ({ dir: path.basename(path.dirname(f)), name: path.basename(f).replace(/\.[^.]+$/, ''), file: f }));
  const colors = new Set();
  for (const f of files.filter(f => f.dir.startsWith('values'))) {
    for (const m of fs.readFileSync(f.file, 'utf8').matchAll(/<color\s+name="([^"]+)"/g)) colors.add(m[1]);
  }
  for (const f of files) if (!f.dir.startsWith('values') && RESERVED.has(f.name)) errs.push(`native/res/${f.dir}/${f.name}: الاسم محجوز لموارد Capacitor الافتراضية، استعمل اسمًا فريدًا`);
  for (const c of colors) if (RESERVED.has(c)) errs.push(`native/res/values: اللون ${c} محجوز لموارد Capacitor الافتراضية`);
  for (const f of files.filter(f => /^(mipmap-anydpi|drawable)/.test(f.dir) && f.file.endsWith('.xml'))) {
    for (const m of fs.readFileSync(f.file, 'utf8').matchAll(/@(drawable|mipmap|color)\/([\w]+)/g)) {
      const [, type, name] = m;
      if (RESERVED.has(name)) errs.push(`native/res/${f.dir}/${f.name}.xml: يشير إلى ${name} (مورد Capacitor الافتراضي)`);
      const ok = type === 'color' ? colors.has(name) : files.some(x => x.dir.startsWith(type) && x.name === name);
      if (!ok) errs.push(`native/res/${f.dir}/${f.name}.xml: المورد @${type}/${name} غير موجود`);
    }
  }
  // شاشة البدء: قالب Capacitor يشير إلى @drawable/splash. يجب أن يكون لدينا drawable/splash.xml وحده بهذا الاسم،
  // وإلا يتصادم مع splash.png الافتراضي (خطأ موارد مكررة) أو يغلب الافتراضي شاشتنا (سير البناء يحذف الافتراضيات قبل النسخ)
  const splashes = files.filter(f => f.dir.startsWith('drawable') && f.name === 'splash');
  if (!splashes.some(f => f.dir === 'drawable' && f.file.endsWith('.xml'))) errs.push('native/res/drawable/splash.xml غير موجود (شاشة البدء)');
  for (const f of splashes) if (!(f.dir === 'drawable' && f.file.endsWith('.xml'))) errs.push(`native/res/${f.dir}/${path.basename(f.file)}: يتصادم مع شاشة البدء drawable/splash.xml`);
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const n of ['ic_launcher', 'ic_launcher_round']) if (!files.some(x => x.dir === 'mipmap-' + d && x.name === n)) errs.push(`native/res/mipmap-${d}/${n}.png غير موجود`);
  }
}

if (errs.length) { console.error('✗ فشل الفحص:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log(`✓ سليم: ${jsFiles.length} ملف JS، ${core.length} مدخلة في CORE، ${refs.length} مرجع في index.html`);
