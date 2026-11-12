/* ==================================================================
 * 23-main.js
 * نقطة البدء: مراقبة تغيّر الحجم، تهيئة التخزين ثم تحميل المشاريع وأول رسم، وتسجيل عامل الخدمة. يجب
 * أن يكون آخر ملف يُحمَّل.
 *
 * يعرّف: 
 * يعتمد على: 00-storage.js، 01-core.js، 05-persistence.js، 09-render.js، 22-toolbar.js
 * ================================================================== */

new ResizeObserver(resize).observe($('main'));resize();
// نص اللوحة يُرسم على canvas فلا يتحدّث وحده عند اكتمال تحميل الخط: أعد الرسم حينها
if(document.fonts&&document.fonts.load)document.fonts.load('400 14px "IBM Plex Sans Arabic"').then(()=>draw(),()=>{});
// التخزين غير متزامن (IndexedDB): نحمّل المشاريع بعد جاهزيته ثم نرسم. save() لا تكتب قبل ذلك.
Store.init().then(()=>{load();upd();draw()}).catch(e=>{console.error(e);toast('تعذّر تحميل المشاريع')});
// تسجيل عامل الخدمة: يحفظ التطبيق للعمل بلا إنترنت بعد أول فتح
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
