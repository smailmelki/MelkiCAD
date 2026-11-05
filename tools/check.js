#!/usr/bin/env node
/* فحص سلامة المصدر قبل النشر (بدون أي اعتماديات):
 *  1) صياغة كل ملفات JS سليمة
 *  2) كل ملف محلي مرجعيّ في index.html موجود، وكل ملف js/ مذكور في index.html و sw.js
 *  3) كل مدخلات CORE في sw.js موجودة فعلًا (وإلا يفشل cache.addAll ويتعطّل العمل بلا إنترنت)
 *  4) لا ملفات .orig/.rej ولا بقايا لـ 20-backup
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

if (errs.length) { console.error('✗ فشل الفحص:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log(`✓ سليم: ${jsFiles.length} ملف JS، ${core.length} مدخلة في CORE، ${refs.length} مرجع في index.html`);
