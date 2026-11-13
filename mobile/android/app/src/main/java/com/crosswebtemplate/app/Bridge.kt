package com.crosswebtemplate.app

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

class Bridge(private val webView: WebView) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var workerCount = 0

    fun start() {
        workerCount = nativeStart()
    }

    fun stop() {
        nativeStop()
    }

    fun notifyJobDone(jobId: Long) {
        mainHandler.post {
            webView.evaluateJavascript("window.__cwtBridge?.onJobDone($jobId);", null)
        }
    }

    @JavascriptInterface
    fun bridge_get_registry(unused: String): String {
        val registry = JSONArray(nativeGetRegistry().toList())
        return JSONObject()
            .put("registry", registry)
            .put("worker_count", workerCount)
            .toString()
    }

    @JavascriptInterface
    fun bridge_get_export(name: String): String {
        return nativeGetExport(name).toString()
    }

    @JavascriptInterface
    fun bridge_enqueue(input: String): String {
        val request = JSONObject(input)
        val fnId = request.getInt("fn_id")
        val serializedInput = if (request.has("input")) request.getString("input") else null
        val jobId = nativeEnqueue(fnId, serializedInput)

        if (jobId == NO_JOB) {
            return JSONObject().put("error", "No free job slots").toString()
        }

        return JSONObject().put("job_id", jobId).toString()
    }

    @JavascriptInterface
    fun bridge_take_output(input: String): String {
        val jobId = JSONObject(input).getLong("job_id")
        return nativeTakeOutput(jobId)
    }

    private external fun nativeStart(): Int
    private external fun nativeStop()
    private external fun nativeGetRegistry(): Array<String>
    private external fun nativeGetExport(name: String): Long
    private external fun nativeEnqueue(fnId: Int, input: String?): Long
    private external fun nativeTakeOutput(jobId: Long): String

    companion object {
        private const val NO_JOB = 0xFFFFFFFFL

        init {
            System.loadLibrary("core")
        }
    }
}
