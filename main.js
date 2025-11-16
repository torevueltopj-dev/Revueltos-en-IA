// main.js - Conecta frontend con Worker
// Actualiza API_BASE con tu URL de Worker desplegado con Wrangler

const API_BASE = "https://revueltos-ia.YOUR_ACCOUNT.workers.dev"

// Ejemplo: buscar en Gemini
async function buscar(query) {
  const res = await fetch(`${API_BASE}?action=search&q=${encodeURIComponent(query)}`)
  const data = await res.json()
  console.log(data)
  return data
}

// Ejemplo: análisis con Deepsek
async function analizar(text) {
  const res = await fetch(`${API_BASE}?action=analysis&text=${encodeURIComponent(text)}`)
  const data = await res.json()
  console.log(data)
  return data
}
