import { registerPlugin } from '@capacitor/core';

const SaveFile = registerPlugin('SaveFile');
const PrintPdf = registerPlugin('PrintPdf');

/* Native Android export using the system "Save to" document picker. */
(() => {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  async function toBase64(blob) {
    if (!(blob instanceof Blob)) throw new TypeError('محتوى الملف ليس Blob صالحًا');
    if (blob.size <= 0) throw new Error('ملف التصدير فارغ؛ أُوقف الحفظ');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length !== blob.size || bytes.length === 0) {
      throw new Error('تعذّرت قراءة محتوى الملف كاملًا');
    }

    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const encoded = btoa(binary);
    if (!encoded.length) throw new Error('فشل ترميز الملف قبل الحفظ');
    return { encoded, byteLength: bytes.length };
  }

  async function exportNative(name, blob, opts) {
    try {
      if (!name || !String(name).trim()) throw new Error('اسم الملف غير صالح');
      const isPng = /\.png$/i.test(String(name));
      // بدون «;charset=…»: الجزء الإضافي لا يصلح لـ setType في نافذة المستندات
      const mimeType = isPng ? 'image/png' : String(blob.type || 'application/octet-stream').split(';')[0].trim();
      if (isPng) {
        const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        const expected = [137, 80, 78, 71, 13, 10, 26, 10];
        if (signature.length !== 8 || !expected.every((v, i) => signature[i] === v)) {
          throw new Error('محتوى PNG غير صالح قبل الحفظ');
        }
        name = String(name).replace(/\.(?:jpg|jpeg)$/i, '.png');
      }
      const payload = await toBase64(blob);
      const auto = !!(opts && opts.auto);
      // حفظ تلقائي: يكتب مباشرة في Download/MelkiCAD بلا نافذة اختيار ولا مغادرة التطبيق، وبالاسم نفسه
      const result = await (auto ? SaveFile.saveAuto : SaveFile.save).call(SaveFile, {
        name,
        mimeType,
        data: payload.encoded,
        expectedSize: payload.byteLength
      });
      if (result?.cancelled) return 'no';
      if (result?.bytesWritten !== payload.byteLength) {
        throw new Error('عدد البايتات المحفوظة لا يطابق حجم الملف الأصلي');
      }
      if (auto) window.lastSavedWhere = result?.where || 'Download/MelkiCAD';
      return 'ok';
    } catch (error) {
      console.error('MelkiCAD native save failed:', error);
      if (typeof window.toast === 'function') window.toast(error?.message || 'تعذّر حفظ الملف');
      return 'err';
    }
  }

  window.saveFile = (name, content, opts) =>
    exportNative(name, new Blob([content], { type: 'application/json;charset=utf-8' }), opts);

  window.saveBlob = (name, blob, opts) => exportNative(name, blob, opts);

  /* طباعة PDF عبر نافذة الطباعة في النظام (PrintPdfPlugin). تُرجع 'ok' عند فتح النافذة و'err' عند الفشل.
     لا يُعرف من هنا إن أتمّ المستخدم الطباعة أم ألغاها داخل نافذة النظام. */
  window.printPdfNative = async (name, blob, opts = {}) => {
    try {
      const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head) !== '%PDF-') throw new Error('الملف ليس PDF صالحًا؛ أُوقفت الطباعة');
      const payload = await toBase64(blob);
      const result = await PrintPdf.print({
        name: String(name || 'MelkiCAD.pdf'),
        data: payload.encoded,
        expectedSize: payload.byteLength,
        paper: opts.paper === 'A3' ? 'A3' : 'A4',
        landscape: !!opts.landscape
      });
      return result?.started ? 'ok' : 'err';
    } catch (error) {
      console.error('MelkiCAD native print failed:', error);
      if (typeof window.toast === 'function') window.toast(error?.message || 'تعذّرت الطباعة');
      return 'err';
    }
  };
})();
