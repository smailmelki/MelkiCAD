# MelkiCAD

تطبيق عربي (RTL) لرسم مخططات الغرف والمنازل يعمل في المتصفح كـ PWA بلا إنترنت، مع غلاف Android عبر Capacitor.
JavaScript خالص بلا مكتبات ولا خطوة بناء.

## البنية

```
src/                 كل ما يُنشر (index.html، sw.js، manifest، css/، js/)
  js/01…23-*.js      ملفات بنطاق عام واحد، الترتيب في index.html مهم (خريطة الملفات في أعلاه)
android-wrapper/     غلاف Capacitor (الجسر android-bridge.js يحوّل التصدير إلى مشاركة أندرويد)
tools/check.js       فحص سلامة بلا اعتماديات (يعمل تلقائيًا قبل كل نشر)
tools/smoke.js       اختبار دخان في متصفح حقيقي (اختياري، playwright)
.github/workflows/   deploy-pages.yml (النشر) و android-apk.yml (بناء APK تجريبي)
```

## التشغيل محليًا

```bash
python3 -m http.server 8000 -d src      # ثم افتح http://localhost:8000
node tools/check.js                     # فحص السلامة
```

## النشر

الدفع إلى `main` مع تغيير في `src/` يشغّل `deploy-pages.yml`: يفحص ثم ينشر `src/` إلى فرع `gh-pages`.
فعّل Pages من إعدادات المستودع على فرع `gh-pages`.

## APK لأندرويد

شغّل `android-apk.yml` (Actions ← Run workflow) **بعد** أول نشر ناجح، فهو يضمّن نسخة `gh-pages` داخل التطبيق.
الناتج في Artifacts باسم `MelkiCAD-Android-APK` (نسخة debug للتجربة؛ التوزيع العام يحتاج بناء release موقّعًا).

## عند تعديل الكود

- أضفت ملف JS جديدًا؟ سجّله في `index.html` **وفي** قائمة `CORE` داخل `sw.js`. `tools/check.js` يفشل إن نسيت.
- غيّرت أي ملف في `src/`؟ ارفع رقم `VER` في `sw.js` ليتحدّث الكاش عند المستخدمين.
- أي نص قد يأتي من ملف مستورد (أسماء طبقات/مشاريع) ويدخل `innerHTML` يجب أن يمرّ عبر `esc()` (معرّفة في `01-core.js`).
