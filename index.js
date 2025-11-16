export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1️⃣ Buscador con Gemini
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");
      if (!query) return new Response("Falta query", { status: 400 });

      const resp = await fetch("https://api.gemini.com/deepsearch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GEMINI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    // 2️⃣ Interpelación estilo MUN
    if (url.pathname === "/interpelate" && request.method === "POST") {
      const { text } = await request.json();
      if (!text) return new Response("Falta texto", { status: 400 });

      const resp = await fetch("https://api.deepsek.com/analyze", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text, mode: "interpelation" })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    // 3️⃣ Corrección de discursos
    if (url.pathname === "/correct-speech" && request.method === "POST") {
      const { text } = await request.json();
      if (!text) return new Response("Falta texto", { status: 400 });

      const resp = await fetch("https://api.deepsek.com/analyze", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text, mode: "speech_correction" })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    // 4️⃣ Desglose de tópicos
    if (url.pathname === "/topic-breakdown" && request.method === "POST") {
      const { topic } = await request.json();
      if (!topic) return new Response("Falta tópico", { status: 400 });

      const resp = await fetch("https://api.deepsek.com/analyze", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic, mode: "topic_breakdown" })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    // 5️⃣ Corrección de documentos de posición
    if (url.pathname === "/correct-position" && request.method === "POST") {
      const { text } = await request.json();
      if (!text) return new Response("Falta texto", { status: 400 });

      const resp = await fetch("https://api.deepsek.com/analyze", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.DEEPSEEK_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text, mode: "position_correction" })
      });
      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Ruta no encontrada", { status: 404 });
  }
}
