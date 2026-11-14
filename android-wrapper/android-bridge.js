import { registerPlugin } from '@capacitor/core';

const SaveFile = registerPlugin('SaveFile');

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

  async function exportNative(name, blob) {
    try {
      if (!name || !String(name).trim()) throw new Error('اسم الملف غير صالح');
      const payload = await toBase64(blob);
      const result = await SaveFile.save({
        name,
        mimeType: blob.type || 'application/octet-stream',
        data: payload.encoded,
        expectedSize: payload.byteLength
      });
      if (result?.cancelled) return 'no';
      if (result?.bytesWritten !== payload.byteLength) {
        throw new Error('عدد البايتات المحفوظة لا يطابق حجم الملف الأصلي');
      }
      return 'ok';
    } catch (error) {
      console.error('MelkiCAD native save failed:', error);
      if (typeof window.toast === 'function') window.toast(error?.message || 'تعذّر حفظ الملف');
      return 'err';
    }
  }

  window.saveFile = (name, content) =>
    exportNative(name, new Blob([content], { type: 'application/json;charset=utf-8' }));

  window.saveBlob = (name, blob) => exportNative(name, blob);
})();
