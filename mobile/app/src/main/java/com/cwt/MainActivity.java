package com.cwt;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;

public class MainActivity extends Activity {

    static {
        System.loadLibrary("core");
    }

    public native String increment(String input);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView web = new WebView(this);
        setContentView(web);

        web.getSettings().setJavaScriptEnabled(true);

        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String increment(String input) {
                return MainActivity.this.increment(input);
            }
        }, "bridge");

        web.loadUrl("file:///android_asset/index.html");
    }
}
