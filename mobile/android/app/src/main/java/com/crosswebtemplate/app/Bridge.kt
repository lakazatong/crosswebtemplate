package com.crosswebtemplate.app

import android.webkit.JavascriptInterface

class Bridge {

    @JavascriptInterface
    fun bridge_increment(input: String): String {
        return nativeIncrement(input)
    }

    private external fun nativeIncrement(input: String): String

    companion object {
        init {
            System.loadLibrary("core")
        }
    }
}
