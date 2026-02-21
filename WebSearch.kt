package com.ejemplo.alfred

import java.net.URL
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

object WebSearch {

    // Cambia por tu API key si usas otro servicio
    private const val API_KEY = "TU_CLAVE_DE_SERPAPI"
    private const val ENGINE = "google"

    fun buscar(query: String): String {
        return try {
            // Ejemplo con SerpAPI (necesita clave)
            val url = "https://serpapi.com/search.json?q=${query.replace(" ", "+")}&api_key=$API_KEY&engine=$ENGINE"
            val response = URL(url).readText()
            // Parsear respuesta JSON para extraer snippet (simplificado)
            if (response.contains("\"answer_box\"")) {
                // extraer respuesta rápida...
                "Resultado: $response"
            } else {
                "No se encontraron resultados."
            }
        } catch (e: Exception) {
            "Error en búsqueda: ${e.message}"
        }
    }
}
