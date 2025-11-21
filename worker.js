<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>IA MUN – Delegados</title>
<style>
body { 
  font-family: Arial; 
  max-width: 600px; 
  margin: 30px auto; 
  line-height: 1.4;
}
textarea {
  width: 100%;
  height: 180px;
  padding: 10px;
  font-size: 15px;
}
button {
  background: #4c6ef5;
  color: white;
  padding: 12px 20px;
  border: none;
  margin-top: 10px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px;
}
pre {
  white-space: pre-wrap;
  background: #f2f2f2;
  padding: 15px;
  border-radius: 6px;
}
</style>
</head>

<body>

<h2>IA para Delegados MUN</h2>
<p>Escribe tu comando (BUSCAR:, INTERPELAR:, CORREGIR DISCURSO:, etc.)</p>

<textarea id="input"></textarea>
<button onclick="enviar()">Enviar</button>

<h3>Respuesta:</h3>
<pre id="output"></pre>

<script>
async function enviar() {
  const text = document.getElementById("input").value;
  const out = document.getElementById("output");
  out.textContent = "Procesando...";

  // ⚠️ PON TU API KEY DE CLOUDFLARE AQUÍ
  const API_KEY = "WXRsiAg68MPUndjcHA7Y8oX-vSzlfJalE77jWeYE";
  const ACCOUNT_ID = "a370555054f1580d97cbd0c7cc1f1b26";

  const systemPrompt = `
Eres una IA especializada en Modelos de Naciones Unidas (MUN).
Hablas en lenguaje diplomático y analítico.
Funciones:
1) BUSCAR (.org .gov .un.org int) → 5 enlaces + breve párrafo ordenado por fecha.
2) INTERPELAR → Delegación en 3ra persona, crítica formal.
3) CORREGIR DISCURSO → Introducción global, Desarrollo nacional, Conclusión internacional.
4) DESGLOSE TOPICO → 8–12 preguntas de investigación.
5) CORREGIR POSICION → Documento 500–800 palabras + bibliografía en formato ONU.
`;

  const payload = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ]
  };

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();
  out.textContent = data.result.response;
}
</script>

</body>
</html>