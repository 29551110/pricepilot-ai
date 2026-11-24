(() => {
  const host = document.querySelector(".main");
  if (!host || document.getElementById("advisorCard")) return;
  const style = document.createElement("style");
  style.textContent = `
    .advisor-card{margin-top:20px;background:#fff;border:1px solid #e4e9e3;border-radius:14px;padding:20px 22px;box-shadow:0 12px 32px #233f3010}
    .advisor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:15px}
    .advisor-head h2{font:700 16px Manrope,sans-serif;margin:0 0 5px;color:#17251f}
    .advisor-head p{font-size:11px;line-height:1.5;color:#728078;margin:0;max-width:600px}
    .advisor-form{display:grid;grid-template-columns:1fr 1fr;gap:11px}
    .advisor-form label{display:block;color:#546259;font-size:11px;font-weight:600;margin-bottom:5px}
    .advisor-form input,.advisor-form textarea{width:100%;border:1px solid #e1e7e1;border-radius:8px;background:#fff;padding:10px 11px;color:#24352c;font:12px 'DM Sans',sans-serif;outline:none}
    .advisor-form input:focus,.advisor-form textarea:focus{border-color:#61a17b;box-shadow:0 0 0 3px #1e704f14}
    .advisor-question{grid-column:1/-1}.advisor-form textarea{min-height:80px;resize:vertical;line-height:1.5}
    .advisor-actions{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .advisor-research{display:flex!important;align-items:center;gap:7px;margin:0!important;color:#66746b!important;font-size:10px!important;font-weight:500!important}
    .advisor-research input{width:auto!important;accent-color:#1e704f}
    .advisor-submit{border:0;border-radius:8px;background:#173d30;color:#fff;font-size:11px;font-weight:700;padding:11px 15px;cursor:pointer}
    .advisor-submit:disabled{opacity:.6;cursor:wait}
    .advisor-status{font-size:10px;color:#728078;line-height:1.5;margin:10px 0 0;min-height:15px}
    .advisor-answer{display:none;margin-top:12px;padding:14px 15px;border-radius:9px;background:#f4f8f4;color:#34483b;font-size:12px;line-height:1.65;white-space:pre-wrap}
    .advisor-sources{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
    .advisor-sources a{color:#286345;font-size:10px;font-weight:600}
    @media(max-width:560px){.advisor-card{padding:17px 16px}.advisor-form{grid-template-columns:1fr}.advisor-question,.advisor-actions{grid-column:1}.advisor-actions{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
  const card = document.createElement("section"); card.className = "advisor-card"; card.id = "advisorCard";
  card.innerHTML = `
    <div class="advisor-head"><div><h2>AI product advisor</h2><p>Get guidance on products, pricing, competitors and material costs. Add your location for regional context.</p></div></div>
    <div class="advisor-form">
      <div><label for="advisorRegion">Region or city</label><input id="advisorRegion" maxlength="120" placeholder="e.g. Stellenbosch, South Africa"></div>
      <div><label for="advisorProduct">Product</label><input id="advisorProduct" maxlength="120" placeholder="Uses your product name"></div>
      <div class="advisor-question"><label for="advisorQuestion">What would you like advice on?</label><textarea id="advisorQuestion" maxlength="1200" placeholder="For example: What competitors sell similar products near me, and what are the typical prices?"></textarea></div>
      <div class="advisor-actions"><label class="advisor-research"><input id="advisorResearch" type="checkbox"> Research current prices online (may cost more per question)</label><button class="advisor-submit" id="advisorAsk" type="button">Ask the advisor →</button></div>
    </div>
    <p class="advisor-status" id="advisorStatus" role="status" aria-live="polite">The advisor service is not connected yet.</p><div class="advisor-answer" id="advisorAnswer"></div>
  `;
  const footer = host.querySelector(".footer-note"); if (footer) host.insertBefore(card, footer); else host.appendChild(card);
  const setStatus = text => { document.getElementById("advisorStatus").textContent = text; };
  document.getElementById("advisorProduct").value = document.getElementById("product")?.value || "";
  document.getElementById("product")?.addEventListener("input", event => { const product = document.getElementById("advisorProduct"); if (!product.dataset.edited) product.value = event.target.value; });
  document.getElementById("advisorProduct").addEventListener("input", event => { event.target.dataset.edited = "true"; });
  document.getElementById("advisorAsk").addEventListener("click", async () => {
    const endpoint = window.PRICEPILOT_ADVISOR_API || "";
    if (!endpoint) { setStatus("The advisor service is not connected yet. Its Cloudflare address will be added after deployment."); return; }
    const question = document.getElementById("advisorQuestion").value.trim(); if (!question) { setStatus("Enter a question first."); return; }
    const button = document.getElementById("advisorAsk"), answerBox = document.getElementById("advisorAnswer"); button.disabled = true; answerBox.style.display = "none"; setStatus("Thinking…");
    const prices = Object.fromEntries(["materials","labour","packaging","shipping","marketing","other","comp1","comp2","comp3","margin","volume"].map(id => [id, document.getElementById(id)?.value || ""]));
    try {
      const result = await fetch(endpoint, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question,region:document.getElementById("advisorRegion").value.trim(),product:document.getElementById("advisorProduct").value.trim(),research:document.getElementById("advisorResearch").checked,prices})});
      const data = await result.json(); if (!result.ok) throw new Error(data.error || "The advisor could not answer right now.");
      answerBox.textContent = data.answer || "No answer was returned."; const citations = Array.isArray(data.citations) ? data.citations : [];
      if (citations.length) { const sources = document.createElement("div"); sources.className = "advisor-sources"; citations.forEach(source => { if (!/^https:\/\//i.test(source.url || "")) return; const link = document.createElement("a"); link.href=source.url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent=source.title||source.url; sources.appendChild(link); }); answerBox.appendChild(sources); }
      answerBox.style.display = "block"; setStatus(data.researched ? "Research complete. Check the linked sources and dates before using a price." : "General guidance. Turn on current online research when you need up-to-date local prices.");
    } catch (error) { setStatus(error.message || "Could not reach the advisor. Please try again."); } finally { button.disabled = false; }
  });
})();
