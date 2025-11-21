const CF_API = "XMlGnGeBcIYw5eIOYTVLzj3fnokKGHUUMCGRSphR";
const ACCOUNT_ID = "a370555054f1580d97cbd0c7cc1f1b26";
const MODEL = "@cf/meta/llama-3-8b-instruct";

async function runModel(message) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Eres un asistente experto en MUN que responde con claridad, precisión diplomática y formato profesional.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    }
  );

  const data = await response.json();
  return data.result?.response || "Hubo un error.";
}

// UI
const chat = document.getElementById("chat");
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.innerText = text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage("Tú: " + text, "user");
  userInput.value = "";

  addMessage("MUN AI está escribiendo...", "ai");

  const response = await runModel(text);

  // Remove "escribiendo"
  chat.removeChild(chat.lastChild);

  addMessage("MUN AI: " + response, "ai");
});
