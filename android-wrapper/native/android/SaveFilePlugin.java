package com.smailmelki.melkicad;

import android.app.Activity;
import android.content.Intent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {
    private final Map<PluginCall, byte[]> pendingData = new ConcurrentHashMap<>();

    private boolean hasPngSignature(byte[] data) {
        byte[] signature = new byte[] {(byte)137, 80, 78, 71, 13, 10, 26, 10};
        if (data == null || data.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if (data[i] != signature[i]) return false;
        }
        return true;
    }

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String encodedData = call.getString("data");
        Integer expectedSize = call.getInt("expectedSize");

        if (name == null || name.trim().isEmpty() || encodedData == null || encodedData.isEmpty()) {
            call.reject("اسم الملف أو محتواه غير موجود");
            return;
        }

        boolean isPng = name.toLowerCase(java.util.Locale.ROOT).endsWith(".png");
        if (isPng) {
            mimeType = "image/png";
            if (!name.toLowerCase(java.util.Locale.ROOT).endsWith(".png")) {
                name += ".png";
            }
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(encodedData, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("بيانات الملف المرسلة غير صالحة", error);
            return;
        }

        if (bytes.length == 0 || (expectedSize != null && expectedSize != bytes.length)) {
            call.reject("حجم الملف المستلم غير مطابق للمحتوى الأصلي");
            return;
        }
        if (isPng && !hasPngSignature(bytes)) {
            call.reject("محتوى PNG لا يحمل التوقيع الصحيح؛ أُوقف الحفظ");
            return;
        }

        pendingData.put(call, bytes);
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType == null || mimeType.isEmpty()
                    ? "application/octet-stream" : mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(call, intent, "saveResult");
        } catch (Exception error) {
            pendingData.remove(call);
            call.reject("تعذّر فتح نافذة اختيار مكان الحفظ: " + error.getMessage(), error);
        }
    }

    /**
     * حفظ تلقائي بلا نافذة اختيار: يكتب الملف مباشرة في Download/MelkiCAD بالاسم نفسه (ويستبدل ملفًا سابقًا بالاسم نفسه
     * أنشأه التطبيق). أندرويد 10+ عبر MediaStore بلا أذونات؛ الأقدم في مجلد التطبيق الخاص.
     */
    @PluginMethod
    public void saveAuto(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String encodedData = call.getString("data");
        Integer expectedSize = call.getInt("expectedSize");

        if (name == null || name.trim().isEmpty() || encodedData == null || encodedData.isEmpty()) {
            call.reject("اسم الملف أو محتواه غير موجود");
            return;
        }
        // أزل أي مسار من الاسم مع الإبقاء على اسمه كما هو
        name = name.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        if (name.isEmpty()) {
            call.reject("اسم الملف غير صالح");
            return;
        }
        if (mimeType == null || mimeType.isEmpty()) mimeType = "application/octet-stream";

        final byte[] bytes;
        try {
            bytes = Base64.decode(encodedData, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("بيانات الملف المرسلة غير صالحة", error);
            return;
        }
        if (bytes.length == 0 || (expectedSize != null && expectedSize != bytes.length)) {
            call.reject("حجم الملف المستلم غير مطابق للمحتوى الأصلي");
            return;
        }

        try {
            final String where;
            final String uriText;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                final String relPath = Environment.DIRECTORY_DOWNLOADS + "/MelkiCAD/";
                Uri existing = null;
                try (Cursor cursor = resolver.query(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        new String[] {MediaStore.MediaColumns._ID},
                        MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                        new String[] {name, relPath},
                        null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        existing = Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, String.valueOf(cursor.getLong(0)));
                    }
                }
                Uri uri = existing;
                if (uri == null) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, relPath);
                    uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                }
                if (uri == null) throw new IllegalStateException("تعذّر إنشاء الملف في مجلد التنزيلات");
                try (OutputStream output = resolver.openOutputStream(uri, "wt")) {
                    if (output == null) throw new IllegalStateException("تعذّر فتح الملف للكتابة");
                    output.write(bytes);
                    output.flush();
                }
                final byte[] saved;
                try (InputStream input = resolver.openInputStream(uri);
                     ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    if (input == null) throw new IllegalStateException("تعذّرت إعادة قراءة الملف للتحقق");
                    byte[] chunk = new byte[8192];
                    int count;
                    while ((count = input.read(chunk)) != -1) buffer.write(chunk, 0, count);
                    saved = buffer.toByteArray();
                }
                if (!Arrays.equals(bytes, saved)) {
                    call.reject("فشل التحقق من الملف بعد الحفظ: المحتوى المحفوظ لا يطابق الأصل");
                    return;
                }
                where = "Download/MelkiCAD";
                uriText = uri.toString();
            } else {
                File base = getContext().getExternalFilesDir(null);
                if (base == null) base = getContext().getFilesDir();
                File dir = new File(base, "MelkiCAD");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("تعذّر إنشاء مجلد الحفظ");
                File file = new File(dir, name);
                try (FileOutputStream output = new FileOutputStream(file, false)) {
                    output.write(bytes);
                    output.flush();
                }
                if (file.length() != bytes.length) {
                    call.reject("فشل التحقق من الملف بعد الحفظ: حجم الملف المحفوظ لا يطابق الأصل");
                    return;
                }
                where = "MelkiCAD";
                uriText = Uri.fromFile(file).toString();
            }

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("uri", uriText);
            response.put("where", where);
            response.put("bytesWritten", bytes.length);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("فشل حفظ الملف: " + (error.getMessage() == null ? "خطأ غير معروف" : error.getMessage()), error);
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        byte[] bytes = pendingData.remove(call);

        try {
            if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                JSObject response = new JSObject();
                response.put("cancelled", true);
                call.resolve(response);
                return;
            }

            Uri uri = result.getData().getData();
            if (uri == null || bytes == null || bytes.length == 0) {
                call.reject("تعذّر الوصول إلى محتوى الملف أو أنه فارغ");
                return;
            }

            boolean isPng = hasPngSignature(bytes);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("تعذّر فتح الملف للكتابة");
                output.write(bytes);
                output.flush();
            }

            final byte[] saved;
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("تعذّرت إعادة قراءة الملف للتحقق");
                byte[] chunk = new byte[8192];
                int count;
                while ((count = input.read(chunk)) != -1) buffer.write(chunk, 0, count);
                saved = buffer.toByteArray();
            }

            if (saved.length == 0 || !Arrays.equals(bytes, saved)) {
                call.reject("فشل التحقق من الملف بعد الحفظ: المحتوى المحفوظ لا يطابق الأصل");
                return;
            }
            if (isPng && !hasPngSignature(saved)) {
                call.reject("الملف المحفوظ ليس صورة PNG سليمة");
                return;
            }

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("uri", uri.toString());
            response.put("bytesWritten", saved.length);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("فشل حفظ الملف: " + (error.getMessage() == null ? "خطأ غير معروف" : error.getMessage()), error);
        }
    }
}
