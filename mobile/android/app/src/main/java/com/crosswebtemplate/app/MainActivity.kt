package com.crosswebtemplate.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        } else {
            WebView.setWebContentsDebuggingEnabled(false)
        }

        val webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true

        webView.addJavascriptInterface(Bridge(), "AndroidBridge")
        webView.webViewClient = WebViewClient()

        if (BuildConfig.DEBUG) {
            webView.webChromeClient = object : android.webkit.WebChromeClient() {
                override fun onConsoleMessage(msg: android.webkit.ConsoleMessage): Boolean {
                    android.util.Log.i("WebConsole", "${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})")
                    return true
                }
            }
        }
        webView.loadUrl("file:///android_asset/index.html")
    }
}
