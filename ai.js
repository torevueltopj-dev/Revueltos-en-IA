// ai.js - Worker para Revueltos en IA
// Llama a Gemini DeepResearch y Deepsek usando Secrets

const GEMINI_API_KEY = GEMINI_API_KEY;
const DEEPSEK_KEY = DEEPSEK_KEY;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // ejemplo: 'search', 'analysis'

    if (action === 'search') {
      const query = searchParams.get('q')
      const response = await searchGemini(query)
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (action === 'analysis') {
      const text = searchParams.get('text')
      const response = await analyzeDeepsek(text)
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Función que llama a Gemini DeepResearch
async function searchGemini(query) {
  const res = await fetch('https://api.gemini.com/deepsearch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })
  return await res.json()
}

// Función que llama a Deepsek para análisis
async function analyzeDeepsek(text) {
  const res = await fetch('https://api.deepsek.com/analyze', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEK_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  })
  return await res.json()
}
