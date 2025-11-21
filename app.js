export default {
  async fetch(request, env) {
    try {
      const { messages } = await request.json();

      const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages,
      });

      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.toString() }),
        { status: 500 }
      );
    }
  },
};