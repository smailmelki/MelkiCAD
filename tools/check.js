#!/usr/bin/env node
/* فحص سلامة المصدر قبل النشر (بدون أي اعتماديات):
 *  1) صياغة كل ملفات JS سليمة
 *  2) كل ملف محلي مرجعيّ في index.html موجود، وكل ملف js/ مذكور في index.html و sw.js
 *  3) كل مدخلات CORE في sw.js موجودة فعلًا (وإلا يفشل cache.addAll ويتعطّل العمل بلا إنترنت)
 *  4) لا ملفات .orig/.rej ولا بقايا لـ 20-backup
 *  5) لا تعريفات مكررة بين الملفات (النطاق العام مشترك فيُستبدل الأول بصمت)، وخريطة الملفات في index.html كاملة
 *  6) سطر VER في sw.js سليم (يُختم تلقائيًا عند النشر)، وكل أيقونات manifest موجودة
 *  7) كل url(...) في CSS موجود ومخزَّن في CORE، ولا روابط خارجية (خطوط/سكربتات) تعطّل العمل بلا إنترنت
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

if (errs.length) { console.error('✗ فشل الفحص:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log(`✓ سليم: ${jsFiles.length} ملف JS، ${core.length} مدخلة في CORE، ${refs.length} مرجع في index.html`);
