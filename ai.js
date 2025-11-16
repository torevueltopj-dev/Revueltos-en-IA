addEventListener('fetch', event => { event.respondWith(handle(event.request)) });

const GEMINI_API_KEY = /* Agrega tu secreto en Cloudflare */;
const DEEPSEK_KEY = /* Agrega tu secreto en Cloudflare */;

async function handle(request){
  const url = new URL(request.url);
  if(url.pathname.startsWith('/api/search')) return await handleSearch(request);
  if(url.pathname.startsWith('/api/llm')) return await handleLLM(request);
  return new Response('Revueltos en IA - Worker', {status:200});
}

// Buscador Gemini DeepResearch
async function handleSearch(request){
  try{
    const body = await request.json();
    const query = body.text;
    const res = await fetch("https://api.gemini.com/v1/deepsearch",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${GEMINI_API_KEY}`,"Content-Type":"application/json" },
      body: JSON.stringify({ query, limit:10 })
    });
    const data = await res.json();
    const items = (data.results||[])
      .filter(r=>/(\.org|\.gov|\.un\.org)/i.test(r.url))
      .map(r=>({ title:r.title,url:r.url,domain:(new URL(r.url)).hostname,date:r.date,summary:r.snippet }));
    return json({ type:"search", items });
  }catch(e){ return json({error:e.message},500); }
}

// Análisis / IA Deepsek
async function handleLLM(request){
  try{
    const body = await request.json();
    const { mode, text, committee, delegation } = body;
    let prompt="", output="";
    if(mode==="interpelar"){
      prompt=`Analiza críticamente este discurso de forma MUN en tercera persona: "${text}" Delegación: ${delegation}`;
    }else if(mode==="corregir"){
      prompt=`Corrige este discurso respetando estructura MUN (introducción global, desarrollo nacional, conclusión internacional): "${text}" Delegación: ${delegation}, Comisión: ${committee}`;
    }else if(mode==="desglose"){
      prompt=`Genera preguntas investigativas para el tópico: "${text}" Delegación: ${delegation}`;
    }else if(mode==="posicion"){
      prompt=`Evalúa y corrige este documento de posición (500-800 palabras, con bibliografía oficial): "${text}" Delegación: ${delegation}, Comisión: ${committee}`;
    }else{
      return json({error:"Modo no soportado"},400);
    }
    output = await callDeepsek(prompt);
    return json({ type:"text", output });
  }catch(e){ return json({error:e.message},500); }
}

// Llamada a Deepsek
async function callDeepsek(prompt){
  const res = await fetch("https://api.deepsek.com/v1/analyze",{
    method:"POST",
    headers:{"Authorization":`Bearer ${DEEPSEK_KEY}`,"Content-Type":"application/json"},
    body: JSON.stringify({ prompt })
  });
  if(!res.ok){ const t=await res.text(); throw new Error("Deepsek error: "+t);}
  const js = await res.json();
  return js.output || "";
}

function json(obj,status=200){return new Response(JSON.stringify(obj,null,2),{status,headers:{"Content-Type":"application/json"}});}
