package com.ejemplo.alfred

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val inference by lazy { LlamaInference(this) }
    private val appLauncher by lazy { AppLauncher(this) }
    private val scope = CoroutineScope(Dispatchers.Main + Job())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Configurar WebView
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            addJavascriptInterface(WebAppInterface(), "Android")
            loadUrl("file:///android_asset/web/index.html")
        }
        setContentView(webView)

        // Cargar modelo en segundo plano
        scope.launch(Dispatchers.IO) {
            inference.cargarModelo()
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun sendMessageToAI(mensaje: String): String {
            // Ejecutar inferencia y devolver respuesta
            return runBlocking(Dispatchers.IO) {
                inference.generarRespuesta(mensaje)
            }
        }

        @JavascriptInterface
        fun buscarEnWeb(query: String): String {
            if (!isOnline()) return "SIN_CONEXION"
            return runBlocking(Dispatchers.IO) {
                WebSearch.buscar(query)
            }
        }

        @JavascriptInterface
        fun abrirApp(nombreApp: String): Boolean {
            return appLauncher.abrirApp(nombreApp)
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val capabilities = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    override fun onDestroy() {
        super.onDestroy()
        inference.liberar()
        scope.cancel()
    }
}
