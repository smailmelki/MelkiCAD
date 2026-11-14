package com.smailmelki.melkicad;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {
    /* احتفظ بالبايتات داخل الإضافة قبل فتح منتقي الملفات؛ لا نعيد قراءة Base64
       من PluginCall بعد عودة المستخدم من تطبيق منتقي الملفات. */
    private final Map<PluginCall, byte[]> pendingData = new ConcurrentHashMap<>();

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

        pendingData.put(call, bytes);

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType == null || mimeType.isEmpty()
                ? "application/octet-stream" : mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, name);

        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        byte[] bytes = pendingData.remove(call);

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
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

        try {
            int written;
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("تعذّر فتح الملف للكتابة");
                output.write(bytes);
                output.flush();
                written = bytes.length;
            }

            if (written != bytes.length) {
                call.reject("لم تُكتب جميع بيانات الملف");
                return;
            }

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("uri", uri.toString());
            response.put("bytesWritten", written);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("فشل حفظ الملف: " + error.getMessage(), error);
        }
    }
}
