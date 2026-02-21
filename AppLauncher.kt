package com.ejemplo.alfred

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

class AppLauncher(private val context: Context) {

    // Mapa de nombres comunes a package names
    private val appMap = mapOf(
        "youtube" to "com.google.android.youtube",
        "chrome" to "com.android.chrome",
        "ajustes" to "com.android.settings",
        "cámara" to "com.android.camera2",
        "whatsapp" to "com.whatsapp"
        // añade las que necesites
    )

    fun abrirApp(nombre: String): Boolean {
        val packageName = appMap[nombre.lowercase()] ?: return false
        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        return if (intent != null) {
            context.startActivity(intent)
            true
        } else {
            false
        }
    }
}
