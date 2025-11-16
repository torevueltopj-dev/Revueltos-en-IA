import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Variables de entorno
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;

// 1️⃣ Buscador con Gemini
app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send("Falta query");

  const resp = await fetch("https://api.gemini.com/deepsearch", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GEMINI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });
  const data = await resp.json();
  res.json(data);
});

// 2️⃣ Interpelación estilo MUN
app.post("/interpelate", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).send("Falta texto");

  const resp = await fetch("https://api.deepsek.com/analyze", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, mode: "interpelation" })
  });
  const data = await resp.json();
  res.json(data);
});

// 3️⃣ Corrección de discursos
app.post("/correct-speech", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).send("Falta texto");

  const resp = await fetch("https://api.deepsek.com/analyze", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, mode: "speech_correction" })
  });
  const data = await resp.json();
  res.json(data);
});

// 4️⃣ Desglose de tópicos
app.post("/topic-breakdown", async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).send("Falta tópico");

  const resp = await fetch("https://api.deepsek.com/analyze", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ topic, mode: "topic_breakdown" })
  });
  const data = await resp.json();
  res.json(data);
});

// 5️⃣ Corrección de documentos de posición
app.post("/correct-position", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).send("Falta texto");

  const resp = await fetch("https://api.deepsek.com/analyze", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text, mode: "position_correction" })
  });
  const data = await resp.json();
  res.json(data);
});

// Servidor
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
