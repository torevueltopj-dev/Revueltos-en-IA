const API_BASE = "https://REPLACE_WITH_YOUR_WORKER_URL";

const el = id => document.getElementById(id);
const mode = el("mode");
const input = el("input");
const generate = el("generate");
const results = el("results");
const committee = el("committee");
const delegation = el("delegation");
const clearBtn = el("clear");

generate.onclick = async () => {
  const m = mode.value;
  const text = input.value.trim();
  if (!text) return alert("Pon tu pregunta o texto, mi hermano.");
  results.innerHTML = `<p class="result-card">Generando respuesta — aguanta un cachito...</p>`;
  try {
    const payload = { mode: m, committee: committee.value, delegation: delegation.value, text };
    const res = await fetch(`${API_BASE}/api/llm`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    renderResult(data);
  } catch (err) {
    results.innerHTML = `<div class="result-card">Error: ${err.message}</div>`;
  }
};

clearBtn.onclick = () => { input.value=""; results.innerHTML=""; };

function renderResult(data){
  results.innerHTML="";
  if(data.type==="search"){
    (data.items||[]).forEach(item=>{
      const div = document.createElement("div");
      div.className="result-card";
      div.innerHTML = `<div class="result-meta">${item.date||""} — ${item.domain}</div>
        <a href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <p style="margin-top:8px;color:#cde6ff">${escapeHtml(item.summary)}</p>`;
      results.appendChild(div);
    });
  } else {
    const div = document.createElement("div");
    div.className="result-card";
    div.innerHTML = `<pre style="white-space:pre-wrap;color:#cde6ff">${escapeHtml(data.output)}</pre>`;
    results.appendChild(div);
  }
}

function escapeHtml(str){return (str||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
