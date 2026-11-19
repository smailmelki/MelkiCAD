package com.smailmelki.melkicad;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/* طباعة PDF جاهز عبر خدمة الطباعة في أندرويد (PrintManager): تظهر نافذة النظام لاختيار الطابعة أو «حفظ كملف PDF». */
@CapacitorPlugin(name = "PrintPdf")
public class PrintPdfPlugin extends Plugin {

    private static boolean hasPdfSignature(byte[] d) {
        return d != null && d.length > 8 && d[0] == '%' && d[1] == 'P' && d[2] == 'D' && d[3] == 'F' && d[4] == '-';
    }

    private static class PdfAdapter extends PrintDocumentAdapter {
        private final byte[] bytes;
        private final String name;

        PdfAdapter(byte[] bytes, String name) {
            this.bytes = bytes;
            this.name = name;
        }

        @Override
        public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                             CancellationSignal cancellationSignal, LayoutResultCallback callback, Bundle extras) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(name)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(1)
                    .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                            CancellationSignal cancellationSignal, WriteResultCallback callback) {
            if (cancellationSignal.isCanceled()) {
                callback.onWriteCancelled();
                return;
            }
            try (OutputStream out = new FileOutputStream(destination.getFileDescriptor())) {
                out.write(bytes);
                out.flush();
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (IOException error) {
                callback.onWriteFailed(error.getMessage());
            }
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "MelkiCAD.pdf");
        String encoded = call.getString("data");
        Integer expectedSize = call.getInt("expectedSize");
        String paper = call.getString("paper", "A4");
        boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));

        if (encoded == null || encoded.isEmpty()) {
            call.reject("محتوى الطباعة غير موجود");
            return;
        }
        final byte[] bytes;
        try {
            bytes = Base64.decode(encoded, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("بيانات الطباعة غير صالحة", error);
            return;
        }
        if (bytes.length == 0 || (expectedSize != null && expectedSize != bytes.length)) {
            call.reject("حجم الملف المستلم غير مطابق للمحتوى الأصلي");
            return;
        }
        if (!hasPdfSignature(bytes)) {
            call.reject("المحتوى ليس ملف PDF صالحًا؛ أُوقفت الطباعة");
            return;
        }

        final String jobName = name.replaceAll("(?i)\\.pdf$", "");
        PrintAttributes.MediaSize size = "A3".equalsIgnoreCase(paper)
                ? PrintAttributes.MediaSize.ISO_A3 : PrintAttributes.MediaSize.ISO_A4;
        if (landscape) size = size.asLandscape();
        final PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(size)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (pm == null) {
                    call.reject("خدمة الطباعة غير متاحة على هذا الجهاز");
                    return;
                }
                pm.print(jobName, new PdfAdapter(bytes, jobName), attrs);
                JSObject response = new JSObject();
                response.put("started", true);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("تعذّر فتح نافذة الطباعة: " + error.getMessage(), error);
            }
        });
    }
}
