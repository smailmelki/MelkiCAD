/* Native Android file export bridge. */
(() => {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  const plugins = cap.Plugins || {};
  const filesystem = plugins.Filesystem;
  const share = plugins.Share;
  if (!filesystem || !share) return;

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
      const file = await filesystem.writeFile({
        path: name,
        data: await toBase64(blob),
        directory: 'CACHE',
        recursive: true
      });
      await share.share({
        title: name,
        text: 'ملف صادر من MelkiCAD',
        url: file.uri,
        dialogTitle: 'حفظ أو مشاركة الملف'
      });
      return 'ok';
    } catch (error) {
      console.error('MelkiCAD native export failed:', error);
      if (typeof window.toast === 'function') window.toast('تعذّر تجهيز الملف للمشاركة');
      return 'err';
    }
  }

  window.saveFile = (name, content) =>
    exportNative(name, new Blob([content], { type: 'application/json;charset=utf-8' }));

  window.saveBlob = (name, blob) => exportNative(name, blob);
})();
