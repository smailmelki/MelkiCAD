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

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String encodedData = call.getString("data");

        if (name == null || name.trim().isEmpty() || encodedData == null) {
            call.reject("اسم الملف أو محتواه غير موجود");
            return;
        }

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

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }

        Uri uri = result.getData().getData();
        String encodedData = call.getString("data");
        if (uri == null || encodedData == null) {
            call.reject("تعذّر الوصول إلى الملف المحدد");
            return;
        }

        try {
            byte[] bytes = Base64.decode(encodedData, Base64.DEFAULT);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("تعذّر فتح الملف للكتابة");
                output.write(bytes);
                output.flush();
            }

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("uri", uri.toString());
            call.resolve(response);
        } catch (Exception error) {
            call.reject("فشل حفظ الملف: " + error.getMessage(), error);
        }
    }
}
