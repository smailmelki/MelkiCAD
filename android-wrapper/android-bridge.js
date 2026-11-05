import { registerPlugin } from '@capacitor/core';

const SaveFile = registerPlugin('SaveFile');

/* Native Android export using the system "Save to" document picker. */
(() => {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  async function toBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  async function exportNative(name, blob) {
    try {
      const result = await SaveFile.save({
        name,
        mimeType: blob.type || 'application/octet-stream',
        data: await toBase64(blob)
      });
      return result?.cancelled ? 'no' : 'ok';
    } catch (error) {
      console.error('MelkiCAD native save failed:', error);
      if (typeof window.toast === 'function') window.toast('تعذّر حفظ الملف');
      return 'err';
    }
  }

  window.saveFile = (name, content) =>
    exportNative(name, new Blob([content], { type: 'application/json;charset=utf-8' }));

  window.saveBlob = (name, blob) => exportNative(name, blob);
})();
