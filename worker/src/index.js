const ORIGIN = "https://29551110.github.io";
const CORS = {"access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin"};
const json = (data, status = 200, origin = ORIGIN) => new Response(JSON.stringify(data), {status, headers: {...CORS, "access-control-allow-origin": origin, "content-type": "application/json; charset=utf-8"}});
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
export default { async fetch(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [ORIGIN, clean(env.VERCEL_APP_ORIGIN, 255)].filter(Boolean);
  if (!allowedOrigins.includes(origin)) return json({error: "This site is not allowed to use the advisor."}, 403);
  const respond = (data, status = 200) => json(data, status, origin);
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: {...CORS, "access-control-allow-origin": origin}});
  if (request.method !== "POST" || new URL(request.url).pathname !== "/api/advisor") return respond({error: "Not found."}, 404);
  if (!env.OPENAI_API_KEY) return respond({error: "The advisor is not configured yet."}, 503);
  if (Number(request.headers.get("content-length") || 0) > 12000) return respond({error: "That question is too long."}, 413);
  let input; try { input = await request.json(); } catch { return respond({error: "Please send a valid question."}, 400); }
  const question = clean(input?.question, 1200), product = clean(input?.product, 120), region = clean(input?.region, 120), research = input?.research === true;
  if (!question) return respond({error: "Enter a question first."}, 400);
  const prices = {};
  for (const key of ["materials","labour","packaging","shipping","marketing","other","comp1","comp2","comp3","margin","volume"]) { const value = Number(input?.prices?.[key]); if (Number.isFinite(value) && value >= 0 && value < 1e9) prices[key] = value; }
  const instructions = "You are PricePilot AI, a practical product and pricing advisor for small businesses and student ventures. Be concise and clear about uncertainty. Never invent local prices, supplier quotes, or regional averages. If evidence is thin, say so and suggest how to validate it. " + (research ? "Use current web sources for local prices, distinguish listings from averages, state dates, and cite sources." : "Answer from general knowledge and supplied inputs; say when a current local fact needs checking.");
  const prompt = "Product: " + (product || "not specified") + "\nRegion: " + (region || "not specified") + "\nPricing inputs in ZAR: " + JSON.stringify(prices) + "\nQuestion: " + question;
  const payload = {model: research ? (env.OPENAI_RESEARCH_MODEL || "gpt-6.2-astra") : (env.OPENAI_MODEL || "gpt-6-luna"), instructions, input: prompt, max_output_tokens: 550, ...(research ? {tools: [{type: "web_search"}]} : {})};
  let upstream;
  try { upstream = await fetch("https://api.openai.com/v1/responses", {method: "POST", headers: {authorization: "Bearer " + env.OPENAI_API_KEY, "content-type": "application/json"}, body: JSON.stringify(payload)}); }
  catch { return respond({error: "Could not connect to the advisor. Please try again."}, 502); }
  if (!upstream.ok) return respond({error: upstream.status === 429 ? "The advisor is busy. Try again shortly." : "The advisor could not complete that request."}, upstream.status === 429 ? 429 : 502);
  const result = await upstream.json(), answer = clean(result.output_text, 10000), citations = new Map();
  for (const item of result.output || []) for (const part of item.content || []) for (const citation of part.annotations || []) if (citation.type === "url_citation" && citation.url?.startsWith("https://")) citations.set(citation.url, {title: clean(citation.title, 180) || citation.url, url: citation.url});
  if (!answer) return respond({error: "The advisor returned an empty answer. Please try again."}, 502);
  return respond({answer, citations: research ? [...citations.values()].slice(0, 8) : [], researched: research});
}};
