/* ==================================================================
 * 23-main.js
 * نقطة البدء: تحميل البيانات، مراقبة تغيّر الحجم، أول رسم، وتسجيل عامل الخدمة. يجب
 * أن يكون آخر ملف يُحمَّل.
 *
 * يعرّف: 
 * يعتمد على: 01-core.js، 05-persistence.js، 09-render.js، 22-toolbar.js
 * ================================================================== */

load();new ResizeObserver(resize).observe($('main'));resize();upd();
// تسجيل عامل الخدمة: يحفظ التطبيق للعمل بلا إنترنت بعد أول فتح
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
