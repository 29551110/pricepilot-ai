const ORIGIN = "https://29551110.github.io";
const CORS = {"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"86400",vary:"Origin"};
const json=(data,status=200,origin=ORIGIN)=>new Response(JSON.stringify(data),{status,headers:{...CORS,"access-control-allow-origin":origin,"content-type":"application/json; charset=utf-8"}});
const clean=(value,max)=>typeof value==="string"?value.trim().slice(0,max):"";
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"",allowedOrigins=[ORIGIN,clean(env.VERCEL_APP_ORIGIN,255)].filter(Boolean);
 if(!allowedOrigins.includes(origin))return json({error:"This site is not allowed to use the advisor."},403);
 const respond=(data,status=200)=>json(data,status,origin);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...CORS,"access-control-allow-origin":origin}});
 if(request.method!=="POST"||new URL(request.url).pathname!=="/api/advisor")return respond({error:"Not found."},404);
 if(!env.OPENAI_API_KEY)return respond({error:"The advisor is not configured yet."},503);
 if(Number(request.headers.get("content-length")||0)>12000)return respond({error:"That question is too long."},413);
 let input;try{input=await request.json()}catch{return respond({error:"Please send a valid request."},400)}
 const question=clean(input?.question,1200),product=clean(input?.product,120),region=clean(input?.region,120),research=input?.research===true;
 if(!question)return respond({error:"Pricing details are missing. Please try again."},400);
 const prices={};
 for(const key of ["materials","labour","packaging","shipping","marketing","other","comp1","comp2","comp3","margin","volume"]){const raw=input?.prices?.[key];if(raw===undefined||raw===null||raw==="")continue;const value=Number(raw);if(Number.isFinite(value)&&value>=0&&value<1e9)prices[key]=value}
 const costKeys=["materials","labour","packaging","shipping","marketing","other"],hasCost=costKeys.some(key=>prices[key]!==undefined);
 const productCost=Number.isFinite(Number(input?.productCost))&&input?.productCost!==undefined?Number(input.productCost):costKeys.reduce((sum,key)=>sum+(prices[key]||0),0);
 const competitors=["comp1","comp2","comp3"].map(key=>prices[key]).filter(value=>value!==undefined);
 const margin=prices.margin;
 const instructions="You are PricePilot AI, a practical product-pricing advisor for small businesses and student ventures. Return concise business advice in exactly five numbered sections using these headings: 1. Suggested selling price; 2. Explanation; 3. Key pricing risks; 4. Profitability assessment; 5. Recommended actions. Use South African rand (ZAR). Calculate a cost-based selling price from unit cost divided by (1 - desired gross margin as a decimal) when the margin is provided and below 100%. Compare it with supplied competitor prices where available. Explain estimated profit per unit and gross margin when the inputs allow. Never invent competitor prices, local averages, supplier quotes, or customer demand. Clearly identify assumptions and missing information. If current online research is not enabled, use only the provided inputs and general business guidance. "+(research?"Use current web sources for local prices, distinguish individual listings from market averages, state dates, and cite sources.":"Do not claim to have checked current market prices; say that they need validation when relevant.");
 const prompt=["Analyze this product for a pricing decision.","Product: "+(product||"not specified"),"Region: "+(region||"not provided"),"Unit cost per item (ZAR): "+(hasCost?productCost.toFixed(2):"not provided"),"Cost breakdown (ZAR): "+JSON.stringify(Object.fromEntries(costKeys.filter(key=>prices[key]!==undefined).map(key=>[key,prices[key]]))),"Competitor prices (ZAR): "+(competitors.length?JSON.stringify(competitors):"not provided"),"Desired gross margin: "+(margin===undefined?"not provided":margin+"%"),"Monthly sales volume: "+(prices.volume===undefined?"not provided":prices.volume),"Additional request: "+question].join(String.fromCharCode(10));
 const payload={model:research?(env.OPENAI_RESEARCH_MODEL||"gpt-6.2-astra"):(env.OPENAI_MODEL||"gpt-6-luna"),instructions,input:prompt,max_output_tokens:750,...(research?{tools:[{type:"web_search"}]}:{})};
 let upstream;try{upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:"Bearer "+env.OPENAI_API_KEY,"content-type":"application/json"},body:JSON.stringify(payload)})}catch{return respond({error:"Could not connect to the advisor. Please try again."},502)}
 if(!upstream.ok)return respond({error:upstream.status===429?"The advisor is busy. Try again shortly.":"The advisor could not complete that request."},upstream.status===429?429:502);
 const result=await upstream.json(),outputText=typeof result.output_text==="string"&&result.output_text.trim()?result.output_text:(result.output||[]).flatMap(item=>item.type==="message"?(item.content||[]):[]).filter(part=>part.type==="output_text"&&typeof part.text==="string").map(part=>part.text).join("\n");
 const answer=clean(outputText,10000),citations=new Map();
 for(const item of result.output||[])for(const part of item.content||[])for(const citation of part.annotations||[])if(citation.type==="url_citation"&&citation.url?.startsWith("https://"))citations.set(citation.url,{title:clean(citation.title,180)||citation.url,url:citation.url});
 if(!answer)return respond({error:"The advisor returned an empty answer. Please try again."},502);
 return respond({answer,citations:research?[...citations.values()].slice(0,8):[],researched:research});
}};
