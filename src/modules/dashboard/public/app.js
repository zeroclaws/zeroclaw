(() => {
  'use strict';

  const NINE_ROUTER_PATH = '/provider/9router';
  const LEGACY_NINE_ROUTER_PATH = '/9router';
  const routes = [
    ['/', 'Overview', 'status'], ['/provider', 'PROVIDER', 'provider'], [NINE_ROUTER_PATH, '9Router', '9r'], ['/chat', 'Chat', 'chat'],
    ['/channel', 'Telegram', 'tg'], ['/runtime', 'Runtime', 'power'], ['/logs', 'Logs', 'tail'],
    ['/doctor', 'Doctor', 'check'], ['/tools', 'Tools', 'toggle'], ['/review', 'Review', 'warn'],
    ['/settings', 'Settings', 'gear']
  ];
  const tokenKey = 'zeroclaw.token';
  const state = { token: sessionStorage.getItem(tokenKey) || '', status: null, config: null, doctor: null, logs: '', credentialHealth: null, chatMessages: [], chatUsage: null, fallbackModalOpen: false, fallbackReason: '', modelModalOpen: false, customApiOpen: false, providerModels: [], providerModelsLoaded: false, providerModelsLoading: false, providerModelsSource: '', nineRouterSearch: '', nineRouterShowAllApikey: false };
  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
    });
    children.forEach((child) => node.append(child && child.nodeType ? child : document.createTextNode(String(child))));
    return node;
  }
  const json = (v) => JSON.stringify(v, null, 2);
  const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);


  const NINE_ROUTER_DEFAULT = {
    endpoint: 'http://localhost:20128/v1',
    dashboard: 'http://localhost:20128/dashboard',
    repo: 'https://github.com/decolua/9router',
    docs: 'https://9router.com',
    installCommand: 'npm install -g 9router && 9router',
    apiKeyRef: 'env:NINE_ROUTER_API_KEY',
    model: 'kr/claude-sonnet-4.5'
  };
  const NINE_ROUTER_PROVIDER_DATA = {"free":[{"id":"kiro","alias":"kr","name":"Kiro AI","color":"#FF6B35","textIcon":"KR","noAuth":false,"deprecated":true,"website":"https://kiro.dev","notice":"","serviceKinds":["llm"]},{"id":"gemini-cli","alias":"gc","name":"Gemini CLI","color":"#4285F4","textIcon":"GC","noAuth":false,"deprecated":true,"website":"https://github.com/google-gemini/gemini-cli","notice":"","serviceKinds":["llm"]},{"id":"qoder","alias":"qd","name":"Qoder","color":"#EC4899","textIcon":"QD","noAuth":false,"deprecated":true,"website":"https://qoder.com","notice":"","serviceKinds":["llm"]},{"id":"opencode","alias":"oc","name":"OpenCode Free","color":"#E87040","textIcon":"OC","noAuth":true,"deprecated":false,"website":"","notice":"","serviceKinds":["llm"]}],"freeTier":[{"id":"openrouter","alias":"openrouter","name":"OpenRouter","color":"#F97316","textIcon":"OR","noAuth":false,"deprecated":false,"website":"https://openrouter.ai","notice":"Free tier: 27+ free models, no credit card needed, 200 req/day. After $10 credit: 1,000 req/day.","serviceKinds":["llm","embedding","tts","imageToText"]},{"id":"nvidia","alias":"nvidia","name":"NVIDIA NIM","color":"#76B900","textIcon":"NV","noAuth":false,"deprecated":false,"website":"https://developer.nvidia.com/nim","notice":"Free access for NVIDIA Developer Program members (prototyping & testing).","serviceKinds":["llm","tts","embedding"]},{"id":"ollama","alias":"ollama","name":"Ollama Cloud","color":"#ffffffff","textIcon":"OL","noAuth":false,"deprecated":false,"website":"https://ollama.com","notice":"Free tier: light usage, 1 cloud model at a time (limits reset every 5h & 7d). Pro $20/mo · Max $100/mo.","serviceKinds":["llm"]},{"id":"vertex","alias":"vx","name":"Vertex AI","color":"#4285F4","textIcon":"VX","noAuth":false,"deprecated":false,"website":"https://cloud.google.com/vertex-ai","notice":"New Google Cloud accounts get $300 free credits. Requires GCP project + Service Account with Vertex AI API enabled.","serviceKinds":["llm"]},{"id":"gemini","alias":"gemini","name":"Gemini","color":"#4285F4","textIcon":"GE","noAuth":false,"deprecated":false,"website":"https://ai.google.dev","notice":"","serviceKinds":["llm","embedding","image","imageToText","webSearch","tts","stt"]},{"id":"cloudflare-ai","alias":"cf","name":"Cloudflare","color":"#F38020","textIcon":"CF","noAuth":false,"deprecated":false,"website":"https://developers.cloudflare.com/workers-ai/","notice":"Workers AI free tier. Requires a Cloudflare API token and Account ID.","serviceKinds":["llm","image"]},{"id":"byteplus","alias":"bpm","name":"BytePlus ModelArk","color":"#2563EB","textIcon":"BP","noAuth":false,"deprecated":false,"website":"https://console.byteplus.com/ark","notice":"Free credits for new accounts. Access to Seed 2.0, Kimi K2 Thinking, GLM 4.7, GPT-OSS-120B models.","serviceKinds":["llm"]}],"oauth":[{"id":"claude","alias":"cc","name":"Claude Code","color":"#D97757","textIcon":"CC","noAuth":false,"deprecated":true,"website":"https://claude.ai","notice":"","serviceKinds":["llm"]},{"id":"antigravity","alias":"ag","name":"Antigravity","color":"#F59E0B","textIcon":"AG","noAuth":false,"deprecated":true,"website":"https://antigravity.google","notice":"","serviceKinds":["llm"]},{"id":"codex","alias":"cx","name":"OpenAI Codex","color":"#3B82F6","textIcon":"CX","noAuth":false,"deprecated":true,"website":"https://chatgpt.com/codex","notice":"","serviceKinds":["llm","image"]},{"id":"github","alias":"gh","name":"GitHub Copilot","color":"#333333","textIcon":"GH","noAuth":false,"deprecated":true,"website":"https://github.com/features/copilot","notice":"","serviceKinds":["llm","embedding"]},{"id":"cursor","alias":"cu","name":"Cursor IDE","color":"#00D4AA","textIcon":"CU","noAuth":false,"deprecated":false,"website":"https://cursor.com","notice":"","serviceKinds":["llm"]},{"id":"xai","alias":"xai","name":"xAI (Grok)","color":"#1DA1F2","textIcon":"XA","noAuth":false,"deprecated":false,"website":"https://x.ai","notice":"","serviceKinds":["llm","imageToText","webSearch","image"]},{"id":"kilocode","alias":"kc","name":"Kilo Code","color":"#FF6B35","textIcon":"KC","noAuth":false,"deprecated":false,"website":"https://kilocode.ai","notice":"","serviceKinds":["llm"]},{"id":"cline","alias":"cl","name":"Cline","color":"#5B9BD5","textIcon":"CL","noAuth":false,"deprecated":false,"website":"https://cline.bot","notice":"","serviceKinds":["llm"]}],"apikey":[{"id":"glm","alias":"glm","name":"GLM Coding","color":"#2563EB","textIcon":"GL","noAuth":false,"deprecated":false,"website":"https://open.bigmodel.cn","notice":"","serviceKinds":["llm"]},{"id":"glm-cn","alias":"glm-cn","name":"GLM (China)","color":"#DC2626","textIcon":"GC","noAuth":false,"deprecated":false,"website":"https://open.bigmodel.cn","notice":"","serviceKinds":["llm"]},{"id":"kimi","alias":"kimi","name":"Kimi","color":"#1E3A8A","textIcon":"KM","noAuth":false,"deprecated":false,"website":"https://kimi.moonshot.cn","notice":"","serviceKinds":["llm","webSearch"]},{"id":"minimax","alias":"minimax","name":"Minimax Coding","color":"#7C3AED","textIcon":"MM","noAuth":false,"deprecated":false,"website":"https://www.minimaxi.com","notice":"","serviceKinds":["llm","image","imageToText","webSearch","tts"]},{"id":"minimax-cn","alias":"minimax-cn","name":"Minimax (China)","color":"#DC2626","textIcon":"MC","noAuth":false,"deprecated":false,"website":"https://www.minimaxi.com","notice":"","serviceKinds":["llm","tts"]},{"id":"alicode","alias":"alicode","name":"Alibaba","color":"#FF6A00","textIcon":"ALi","noAuth":false,"deprecated":false,"website":"https://bailian.console.aliyun.com","notice":"","serviceKinds":["llm"]},{"id":"alicode-intl","alias":"alicode-intl","name":"Alibaba Intl","color":"#FF6A00","textIcon":"ALi","noAuth":false,"deprecated":false,"website":"https://modelstudio.console.alibabacloud.com","notice":"","serviceKinds":["llm"]},{"id":"xiaomi-mimo","alias":"mimo","name":"Xiaomi MiMo","color":"#FF6900","textIcon":"XM","noAuth":false,"deprecated":false,"website":"https://xiaomimimo.com","notice":"","serviceKinds":["llm"]},{"id":"xiaomi-tokenplan","alias":"xmtp","name":"Xiaomi MiMo (Token Plan)","color":"#FF6700","textIcon":"XT","noAuth":false,"deprecated":false,"website":"https://mimo.xiaomi.com","notice":"Xiaomi MiMo Token Plan subscription (API key starts with tp-). Token Plan keys are cluster-specific — select the region matching your subscription.","serviceKinds":["llm"]},{"id":"volcengine-ark","alias":"ark","name":"Volcengine Ark","color":"#1677FF","textIcon":"ARK","noAuth":false,"deprecated":false,"website":"https://ark.cn-beijing.volces.com","notice":"","serviceKinds":["llm"]},{"id":"openai","alias":"openai","name":"OpenAI","color":"#10A37F","textIcon":"OA","noAuth":false,"deprecated":false,"website":"https://platform.openai.com","notice":"","serviceKinds":["llm","embedding","tts","stt","image","imageToText","webSearch"]},{"id":"vercel-ai-gateway","alias":"vercel","name":"Vercel AI Gateway","color":"#111827","textIcon":"VG","noAuth":false,"deprecated":false,"website":"https://vercel.com/ai-gateway","notice":"Unified OpenAI-compatible endpoint from Vercel. Use your AI Gateway API key, then pick models with provider/model IDs like anthropic/claude-sonnet-4.6 or openai/gpt-5.4.","serviceKinds":["llm"]},{"id":"anthropic","alias":"anthropic","name":"Anthropic","color":"#D97757","textIcon":"AN","noAuth":false,"deprecated":false,"website":"https://console.anthropic.com","notice":"","serviceKinds":["llm","imageToText"]},{"id":"opencode-go","alias":"ocg","name":"OpenCode Go","color":"#E87040","textIcon":"OC","noAuth":false,"deprecated":false,"website":"https://opencode.ai/auth","notice":"OpenCode Go subscription: $5/mo (then $10/mo). Access to Kimi, GLM, Qwen, MiMo, MiniMax models.","serviceKinds":["llm"]},{"id":"azure","alias":"azure","name":"Azure OpenAI","color":"#0078D4","textIcon":"AZ","noAuth":false,"deprecated":false,"website":"https://azure.microsoft.com/en-us/products/ai-services/openai-service","notice":"","serviceKinds":["llm"]},{"id":"deepseek","alias":"ds","name":"DeepSeek","color":"#4D6BFE","textIcon":"DS","noAuth":false,"deprecated":false,"website":"https://deepseek.com","notice":"","serviceKinds":["llm"]},{"id":"commandcode","alias":"cmc","name":"Command Code","color":"#000000","textIcon":"CC","noAuth":false,"deprecated":false,"website":"https://commandcode.ai","notice":"Use your CommandCode CLI API key (starts with user_...) from ~/.commandcode/auth.json or commandcode.ai/studio.","serviceKinds":["llm"]},{"id":"groq","alias":"groq","name":"Groq","color":"#F55036","textIcon":"GQ","noAuth":false,"deprecated":false,"website":"https://groq.com","notice":"","serviceKinds":["llm","imageToText","stt"]},{"id":"xai","alias":"xai","name":"xAI (Grok)","color":"#1DA1F2","textIcon":"XA","noAuth":false,"deprecated":false,"website":"https://x.ai","notice":"","serviceKinds":["llm","imageToText","webSearch","image"]},{"id":"mistral","alias":"mistral","name":"Mistral","color":"#FF7000","textIcon":"MI","noAuth":false,"deprecated":false,"website":"https://mistral.ai","notice":"","serviceKinds":["llm","imageToText","embedding"]},{"id":"perplexity","alias":"pplx","name":"Perplexity","color":"#20808D","textIcon":"PP","noAuth":false,"deprecated":false,"website":"https://www.perplexity.ai","notice":"","serviceKinds":["llm","webSearch"]},{"id":"together","alias":"together","name":"Together AI","color":"#0F6FFF","textIcon":"TG","noAuth":false,"deprecated":false,"website":"https://www.together.ai","notice":"","serviceKinds":["llm","embedding"]},{"id":"fireworks","alias":"fireworks","name":"Fireworks AI","color":"#7B2EF2","textIcon":"FW","noAuth":false,"deprecated":false,"website":"https://fireworks.ai","notice":"","serviceKinds":["llm","embedding"]},{"id":"cerebras","alias":"cerebras","name":"Cerebras","color":"#FF4F00","textIcon":"CB","noAuth":false,"deprecated":false,"website":"https://www.cerebras.ai","notice":"","serviceKinds":["llm"]},{"id":"cohere","alias":"cohere","name":"Cohere","color":"#39594D","textIcon":"CO","noAuth":false,"deprecated":false,"website":"https://cohere.com","notice":"","serviceKinds":["llm"]},{"id":"nebius","alias":"nebius","name":"Nebius AI","color":"#6C5CE7","textIcon":"NB","noAuth":false,"deprecated":false,"website":"https://nebius.com","notice":"","serviceKinds":["llm","embedding"]},{"id":"siliconflow","alias":"siliconflow","name":"SiliconFlow","color":"#5B6EF5","textIcon":"SF","noAuth":false,"deprecated":false,"website":"https://cloud.siliconflow.com","notice":"","serviceKinds":["llm"]},{"id":"hyperbolic","alias":"hyp","name":"Hyperbolic","color":"#00D4FF","textIcon":"HY","noAuth":false,"deprecated":false,"website":"https://hyperbolic.xyz","notice":"","serviceKinds":["llm","tts"]},{"id":"deepgram","alias":"dg","name":"Deepgram","color":"#13EF93","textIcon":"DG","noAuth":false,"deprecated":false,"website":"https://deepgram.com","notice":"$200 free credit on signup (no card required). Aura-1: $0.015/1k chars, Aura-2: $0.030/1k chars (Pay-As-You-Go).","serviceKinds":["stt","imageToText","tts"]},{"id":"assemblyai","alias":"aai","name":"AssemblyAI","color":"#0062FF","textIcon":"AA","noAuth":false,"deprecated":false,"website":"https://assemblyai.com","notice":"","serviceKinds":["stt"]},{"id":"nanobanana","alias":"nb","name":"NanoBanana API","color":"#FFD700","textIcon":"🍌","noAuth":false,"deprecated":false,"website":"https://nanobananaapi.ai","notice":"3rd-party proxy for Google Nano Banana (Gemini 2.5/3 Flash Image). For official, use Gemini provider.","serviceKinds":["image"]},{"id":"elevenlabs","alias":"el","name":"ElevenLabs","color":"#6C47FF","textIcon":"EL","noAuth":false,"deprecated":false,"website":"https://elevenlabs.io","notice":"","serviceKinds":["tts"]},{"id":"local-device","alias":"local-device","name":"Local Device","color":"#64748B","textIcon":"LD","noAuth":true,"deprecated":false,"website":"","notice":"","serviceKinds":["tts"]},{"id":"google-tts","alias":"google-tts","name":"Google TTS","color":"#4285F4","textIcon":"GT","noAuth":true,"deprecated":false,"website":"","notice":"","serviceKinds":["tts"]},{"id":"edge-tts","alias":"edge-tts","name":"Edge TTS","color":"#0078D4","textIcon":"ET","noAuth":true,"deprecated":false,"website":"","notice":"","serviceKinds":["tts"]},{"id":"inworld","alias":"inworld","name":"Inworld TTS","color":"#FF6B6B","textIcon":"IW","noAuth":false,"deprecated":false,"website":"https://inworld.ai","notice":"Free tier: 40 minutes/month TTS. Paid: TTS-1.5 Mini $0.01/min ($15/1M chars), TTS-1.5 Max $0.025/min ($30/1M chars). 270+ voices, 15 languages.","serviceKinds":["tts"]},{"id":"voyage-ai","alias":"voyage","name":"Voyage AI","color":"#0EA5E9","textIcon":"VG","noAuth":false,"deprecated":false,"website":"https://www.voyageai.com","notice":"","serviceKinds":["embedding"]},{"id":"sdwebui","alias":"sdwebui","name":"SD WebUI","color":"#FF7043","textIcon":"SD","noAuth":false,"deprecated":false,"website":"https://github.com/AUTOMATIC1111/stable-diffusion-webui","notice":"","serviceKinds":["image"]},{"id":"comfyui","alias":"comfyui","name":"ComfyUI","color":"#4CAF50","textIcon":"CF","noAuth":false,"deprecated":false,"website":"https://github.com/comfyanonymous/ComfyUI","notice":"","serviceKinds":["image"]},{"id":"huggingface","alias":"hf","name":"HuggingFace","color":"#FFD21E","textIcon":"HF","noAuth":false,"deprecated":false,"website":"https://huggingface.co","notice":"","serviceKinds":["image","imageToText","tts","stt"]},{"id":"blackbox","alias":"bb","name":"Blackbox AI","color":"#5B5FEF","textIcon":"BB","noAuth":false,"deprecated":false,"website":"https://blackbox.ai","notice":"","serviceKinds":["llm"]},{"id":"chutes","alias":"ch","name":"Chutes AI","color":"#ffffffff","textIcon":"CH","noAuth":false,"deprecated":false,"website":"https://chutes.ai","notice":"","serviceKinds":["llm"]},{"id":"ollama-local","alias":"ollama-local","name":"Ollama Local","color":"#ffffffff","textIcon":"OL","noAuth":false,"deprecated":false,"website":"https://ollama.com","notice":"","serviceKinds":["llm"]},{"id":"vertex-partner","alias":"vxp","name":"Vertex Partner","color":"#34A853","textIcon":"VP","noAuth":false,"deprecated":false,"website":"https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-partner-models","notice":"","serviceKinds":["llm"]},{"id":"tavily","alias":"tavily","name":"Tavily","color":"#5B21B6","textIcon":"TV","noAuth":false,"deprecated":false,"website":"https://tavily.com","notice":"","serviceKinds":["webSearch","webFetch"]},{"id":"brave-search","alias":"brave","name":"Brave Search","color":"#FB542B","textIcon":"BR","noAuth":false,"deprecated":false,"website":"https://brave.com/search/api","notice":"","serviceKinds":["webSearch"]},{"id":"serper","alias":"serper","name":"Serper","color":"#4F46E5","textIcon":"SP","noAuth":false,"deprecated":false,"website":"https://serper.dev","notice":"","serviceKinds":["webSearch"]},{"id":"exa","alias":"exa","name":"Exa","color":"#2563EB","textIcon":"EX","noAuth":false,"deprecated":false,"website":"https://exa.ai","notice":"","serviceKinds":["webSearch","webFetch"]},{"id":"searxng","alias":"searxng","name":"SearXNG","color":"#3B82F6","textIcon":"SX","noAuth":true,"deprecated":false,"website":"https://docs.searxng.org","notice":"","serviceKinds":["webSearch"]},{"id":"google-pse","alias":"gpse","name":"Google PSE","color":"#4285F4","textIcon":"GP","noAuth":false,"deprecated":false,"website":"https://programmablesearchengine.google.com","notice":"","serviceKinds":["webSearch"]},{"id":"linkup","alias":"linkup","name":"Linkup","color":"#0EA5E9","textIcon":"LK","noAuth":false,"deprecated":false,"website":"https://linkup.so","notice":"","serviceKinds":["webSearch"]},{"id":"searchapi","alias":"searchapi","name":"SearchAPI","color":"#0EA5A4","textIcon":"SA","noAuth":false,"deprecated":false,"website":"https://www.searchapi.io","notice":"","serviceKinds":["webSearch"]},{"id":"youcom","alias":"youcom","name":"You.com Search","color":"#7C3AED","textIcon":"YC","noAuth":false,"deprecated":false,"website":"https://you.com","notice":"","serviceKinds":["webSearch"]},{"id":"firecrawl","alias":"firecrawl","name":"Firecrawl","color":"#F59E0B","textIcon":"FC","noAuth":false,"deprecated":false,"website":"https://firecrawl.dev","notice":"","serviceKinds":["webFetch"]},{"id":"fal-ai","alias":"fal","name":"Fal.ai","color":"#2563EB","textIcon":"FL","noAuth":false,"deprecated":false,"website":"https://fal.ai","notice":"","serviceKinds":["image"]},{"id":"stability-ai","alias":"stability","name":"Stability AI","color":"#8B5CF6","textIcon":"SA","noAuth":false,"deprecated":false,"website":"https://stability.ai","notice":"","serviceKinds":["image"]},{"id":"black-forest-labs","alias":"bfl","name":"Black Forest Labs","color":"#111827","textIcon":"BF","noAuth":false,"deprecated":false,"website":"https://blackforestlabs.ai","notice":"","serviceKinds":["image"]},{"id":"recraft","alias":"recraft","name":"Recraft","color":"#EC4899","textIcon":"RC","noAuth":false,"deprecated":false,"website":"https://recraft.ai","notice":"","serviceKinds":["image"]},{"id":"topaz","alias":"topaz","name":"Topaz","color":"#059669","textIcon":"TP","noAuth":false,"deprecated":false,"website":"https://topazlabs.com","notice":"","serviceKinds":["image"]},{"id":"runwayml","alias":"runway","name":"Runway ML","color":"#000000","textIcon":"RW","noAuth":false,"deprecated":false,"website":"https://runwayml.com","notice":"","serviceKinds":["image","video"]},{"id":"aws-polly","alias":"polly","name":"AWS Polly","color":"#FF9900","textIcon":"PL","noAuth":false,"deprecated":false,"website":"https://aws.amazon.com/polly/","notice":"Use AWS Secret Access Key as API key; set providerSpecificData.accessKeyId and optional region.","serviceKinds":["tts"]},{"id":"jina-ai","alias":"jina","name":"Jina AI","color":"#2563EB","textIcon":"JA","noAuth":false,"deprecated":false,"website":"https://jina.ai","notice":"10M free tokens on signup (non-commercial), no credit card required.","serviceKinds":["embedding"]},{"id":"jina-reader","alias":"jina","name":"Jina Reader","color":"#000000","textIcon":"JR","noAuth":false,"deprecated":false,"website":"https://jina.ai/reader","notice":"","serviceKinds":["webFetch"]}]};
  const NINE_ROUTER_CLI_TOOLS = [
    { id: 'claude', name: 'Claude Code', color: '#D97757', description: 'Anthropic Claude Code CLI via 9Router', model: 'cc/claude-sonnet-4-6', command: 'export ANTHROPIC_BASE_URL="http://localhost:20128/v1"\nexport ANTHROPIC_AUTH_TOKEN="$NINE_ROUTER_API_KEY"\nclaude --model "sonnet"' },
    { id: 'codex', name: 'OpenAI Codex CLI / App', color: '#10A37F', description: 'OpenAI-compatible Codex setup', model: 'cx/gpt-5.5-xhigh', command: 'export OPENAI_BASE_URL="http://localhost:20128/v1"\nexport OPENAI_API_KEY="$NINE_ROUTER_API_KEY"\ncodex -m "cx/gpt-5.5-xhigh"' },
    { id: 'openclaw', name: 'OpenClaw', color: '#FF6B35', description: 'Point OpenClaw-compatible agents at local 9Router', model: 'kr/claude-sonnet-4.5', command: 'OPENAI_BASE_URL=http://127.0.0.1:20128/v1 OPENAI_API_KEY=$NINE_ROUTER_API_KEY openclaw' },
    { id: 'opencode', name: 'OpenCode', color: '#E87040', description: 'OpenCode AI Terminal Assistant', model: 'oc/auto', command: 'export OPENAI_BASE_URL="http://localhost:20128/v1"\nexport OPENAI_API_KEY="$NINE_ROUTER_API_KEY"\nopencode run --model "oc/auto"' },
    { id: 'cursor', name: 'Cursor', color: '#000000', description: 'Cursor settings → Models → OpenAI API', model: 'kr/claude-sonnet-4.5', command: 'Base URL: http://localhost:20128/v1\nAPI Key: $NINE_ROUTER_API_KEY\nModel: kr/claude-sonnet-4.5' },
    { id: 'cline', name: 'Cline', color: '#5B9BD5', description: 'Use 9Router as OpenAI-compatible provider', model: 'openrouter/auto', command: 'Provider: OpenAI Compatible\nBase URL: http://localhost:20128/v1\nAPI Key: $NINE_ROUTER_API_KEY' },
    { id: 'continue', name: 'Continue', color: '#7C3AED', description: 'Continue config model entry', model: 'openai/gpt-4o-mini', command: '{\n  "provider": "openai",\n  "apiBase": "http://localhost:20128/v1",\n  "apiKey": "$NINE_ROUTER_API_KEY",\n  "model": "openai/gpt-4o-mini"\n}' },
    { id: 'amp', name: 'Amp CLI', color: '#F97316', description: 'Sourcegraph Amp with model aliases', model: 'g25p', command: 'export OPENAI_BASE_URL="http://localhost:20128/v1"\nexport OPENAI_API_KEY="$NINE_ROUTER_API_KEY"\namp --model "g25p"' }
  ];
  const NINE_ROUTER_SKILLS = [
    { id: '9router', name: '9Router (Entry)', endpoint: '', icon: 'hub', description: 'Setup + index of all capabilities. Start here for base URL, auth, model discovery, and every skill.' },
    { id: '9router-chat', name: 'Chat', endpoint: '/v1/chat/completions', icon: 'chat', description: 'Chat / code-gen via OpenAI or Anthropic format with streaming.' },
    { id: '9router-image', name: 'Image Generation', endpoint: '/v1/images/generations', icon: 'image', description: 'Text-to-image via DALL-E, Imagen, FLUX, MiniMax, SDWebUI…' },
    { id: '9router-tts', name: 'Text-to-Speech', endpoint: '/v1/audio/speech', icon: 'voice', description: 'OpenAI / ElevenLabs / Edge / Google / Deepgram voices.' },
    { id: '9router-stt', name: 'Speech-to-Text', endpoint: '/v1/audio/transcriptions', icon: 'mic', description: 'Transcribe audio via OpenAI Whisper, Groq, Gemini, Deepgram, AssemblyAI…' },
    { id: '9router-embeddings', name: 'Embeddings', endpoint: '/v1/embeddings', icon: 'vec', description: 'Vectors for RAG / semantic search via OpenAI, Gemini, Mistral…' },
    { id: '9router-web-search', name: 'Web Search', endpoint: '/v1/search', icon: 'find', description: 'Tavily / Exa / Brave / Serper / SearXNG / Google PSE / You.com.' },
    { id: '9router-web-fetch', name: 'Web Fetch', endpoint: '/v1/web/fetch', icon: 'url', description: 'URL → markdown / text / HTML via Firecrawl, Jina, Tavily, Exa.' }
  ];

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let body = text;
    try { body = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!res.ok) throw new Error((body && (body.message || body.error)) || `HTTP ${res.status}`);
    return body;
  }

  function flash(message, bad = false) {
    const n = $('notice');
    n.textContent = message;
    n.hidden = false;
    n.setAttribute('role', bad ? 'alert' : 'status');
    n.setAttribute('aria-live', bad ? 'assertive' : 'polite');
    n.style.borderColor = bad ? 'rgba(255,95,117,.65)' : 'rgba(0,255,157,.45)';
  }

  function normalizedPath(path) { return path === LEGACY_NINE_ROUTER_PATH ? NINE_ROUTER_PATH : path; }
  function isNineRouterPath(path = location.pathname) { return normalizedPath(path) === NINE_ROUTER_PATH; }
  function rememberReturnAndLogin() { sessionStorage.setItem('zeroclaw.login.returnTo', location.pathname); go('/login'); }
  function go(path) { history.pushState(null, '', normalizedPath(path)); render(); }
  function redactedRef(ref) { return ref ? ref.replace(/^(env:|oauth:|secret:)(.).+$/, '$1$2••••') : 'Belum dipilih'; }
  function isTrustedOAuthMessage(event) {
    if (!event.data || event.data.type !== 'zeroclaw-oauth-connected') return false;
    if (event.origin === location.origin) return true;
    try {
      const origin = new URL(event.origin);
      return origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
    } catch (_) { return false; }
  }
  function consumeOAuthReturnMarker() {
    const params = new URLSearchParams(location.search);
    const connected = params.get('oauth') === 'connected';
    if (!connected) return false;
    params.delete('oauth');
    const next = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
    history.replaceState(null, '', next);
    return true;
  }
  function friendlyCredentialStatus() {
    const h = state.credentialHealth;
    if (!h) return { label: 'Not checked yet', tone: 'warn', detail: 'Use Check connection to confirm the saved provider credential is ready for chat.' };
    if (h.ok || h.status === 'connected' || h.status === 'ok' || h.connected) { const account = h.email || h.chatgptAccountId || ''; return { label: account ? `Connected: ${account}` : 'Connected', tone: 'ok', detail: h.chatgptPlanType ? `${h.message || 'Your provider connection is ready.'} Plan: ${h.chatgptPlanType}` : (h.message || 'Your provider connection is ready. The saved credential remains on the server.') }; }
    if (h.status === 'missing') return { label: 'Reconnect needed', tone: 'bad', detail: h.message || 'No saved provider credential was found. Reconnect OpenAI OAuth to use chat.' };
    if (h.status === 'invalid' || h.mode === 'credential-error') return { label: 'Reconnect needed', tone: 'bad', detail: h.message || 'The saved credential is expired or no longer accepted. Clear it, then reconnect OpenAI OAuth.' };
    return { label: 'Needs attention', tone: 'warn', detail: h.message || 'The connection could not be confirmed. Try checking again or reconnect OpenAI OAuth.' };
  }

  function setAuth() {
    const authed = Boolean(state.token);
    const nineRouter = isNineRouterPath();
    $('authState').textContent = authed ? 'Login aktif' : 'Belum login';
    $('authHint').textContent = authed ? 'Bearer token aktif sesi ini.' : 'Masuk untuk akses API lokal.';
    document.querySelector('.dot')?.classList.toggle('on', authed);
    $('logoutBtn').hidden = !authed || nineRouter;
    $('refreshBtn').hidden = !authed || nineRouter;
    $('menuBtn').hidden = !authed || nineRouter;
    $('sidebar').hidden = !authed && !nineRouter;
    $('shell').classList.toggle('auth-shell', !authed && !nineRouter);
    $('shell').classList.toggle('nine-router-shell', nineRouter);
    setSidebarOpen(false);
  }

  function setSidebarOpen(open) {
    $('shell').classList.toggle('nav-open', open);
    $('menuBtn').setAttribute('aria-expanded', String(open));
    document.querySelectorAll('.nine-sidebar-toggle').forEach((button) => button.setAttribute('aria-expanded', String(open)));
  }

  function toggleSidebar() { setSidebarOpen(!$('shell').classList.contains('nav-open')); }

  function renderNav() {
    const nav = $('nav'); nav.replaceChildren();
    routes.forEach(([path, label, badge]) => {
      const a = el('a', { href: path, class: location.pathname === path ? 'active' : '', 'aria-current': location.pathname === path ? 'page' : null }, [label, el('small', { text: badge })]);
      a.addEventListener('click', (e) => { e.preventDefault(); setSidebarOpen(false); go(path); });
      nav.append(a);
    });
  }

  async function loadBase() {
    if (!state.token) return;
    try {
      const [status, config] = await Promise.all([api('/api/status'), api('/api/config')]);
      state.status = status; state.config = config;
    } catch (err) { flash(`Gagal load: ${err.message}`, true); }
  }

  function card(name, body, cls = 'span-4') { return el('section', { class: `card ${cls}` }, [el('h3', { text: name }), body]); }
  function pre(obj, cls = 'logbox') { return el('pre', { class: cls, text: typeof obj === 'string' ? obj : json(obj || {}) }); }

  function input(label, id, value = '', attrs = {}) {
    return el('div', {}, [el('label', { for: id, text: label }), el(attrs.textarea ? 'textarea' : 'input', { id, name: id, value, ...attrs })]);
  }

  const views = {
    '/': () => el('div', { class: 'grid' }, [
      card('Status', el('div', { class: 'metric', text: state.status?.running ? 'RUNNING' : 'LOCAL' })),
      card('Provider', el('p', { class: 'muted', text: state.config?.provider?.type || 'Provider belum dikonfigurasi' })),
      card('Channel', el('p', { class: 'muted', text: state.config?.channel?.type || 'Telegram private chat belum aktif' })),
      card('Konfigurasi mentah', pre(state.config), 'span-8'),
      card('Aksi awal', el('div', { class: 'row' }, [el('button', { class: 'primary', onclick: init, text: 'Init workspace' }), el('a', { class: 'ghost', href: '/provider', text: 'Setup provider' })]), 'span-4')
    ]),
    '/provider': () => providerView(),
    [NINE_ROUTER_PATH]: () => nineRouterView(),
    '/chat': () => chatView(),
    '/channel': () => channelView(),
    '/runtime': () => el('div', { class: 'grid' }, [card('Runtime controls', el('div', { class: 'row' }, ['start','stop','restart'].map(a => el('button', { class: a === 'stop' ? 'danger ghost' : 'primary', onclick: () => runtime(a), text: title(a) }))), 'span-6'), card('Status API', pre(state.status), 'span-6')]),
    '/logs': () => el('div', { class: 'grid' }, [card('Logs viewer', el('div', { class: 'stack' }, [el('button', { class: 'primary', onclick: loadLogs, text: 'Ambil logs' }), pre(state.logs || 'Placeholder logs. Klik Ambil logs untuk GET /api/logs.')]), 'span-12')]),
    '/doctor': () => el('div', { class: 'grid' }, [card('Local doctor checks', el('div', { class: 'stack' }, [el('button', { class: 'primary', onclick: loadDoctor, text: 'Jalankan doctor' }), pre(state.doctor || 'Belum dijalankan.')]), 'span-12')]),
    '/tools': () => toolsView(),
    '/review': () => el('div', { class: 'grid' }, [card('Final summary', pre({ routes: routes.map(r => r[0]), auth: 'POST /api/login, sessionStorage bearer token', warnings: ['Password 123456 hanya bootstrap lokal', 'Ganti credential env sebelum produksi', 'Logs/doctor tergantung backend API'] }), 'span-12')]),
    '/settings': () => settingsView()
  };


  async function copyText(value, label = 'Text') {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const t = el('textarea', { value, 'aria-hidden': 'true' });
        t.style.position = 'fixed'; t.style.opacity = '0'; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
      }
      flash(`${label} copied.`);
    } catch (_) {
      flash(`Could not copy ${label.toLowerCase()}.`, true);
    }
  }

  function nineRouterProviderCounts() {
    return Object.fromEntries(Object.entries(NINE_ROUTER_PROVIDER_DATA).map(([key, value]) => [key, value.length]));
  }

  function nineRouterConnectionStatus() {
    if (!state.token) return { label: 'Dashboard preview mode', tone: 'warn', detail: '9Router opens without the Zeroclaw password. Login is only needed when saving Zeroclaw provider settings.' };
    const provider = state.config?.provider || {};
    const baseUrl = provider.baseUrl || '';
    const credentialRef = provider.credentialRef || '';
    const localNineRouter = /https?:\/\/(localhost|127\.0\.0\.1):20128\/v1\/?$/i.test(baseUrl) || /NINE_ROUTER/i.test(credentialRef);
    if (localNineRouter) return { label: 'Connected to local 9Router', tone: 'ok', detail: `${baseUrl || NINE_ROUTER_DEFAULT.endpoint} · ${provider.model || NINE_ROUTER_DEFAULT.model}` };
    if (baseUrl) return { label: 'Provider is configured elsewhere', tone: 'warn', detail: `${provider.type || 'openai'} · ${baseUrl}` };
    return { label: 'Not connected to 9Router yet', tone: 'warn', detail: 'Run 9Router locally, create an API key, then save the 9Router endpoint below.' };
  }

  function nineRouterMatches(provider, query) {
    if (!query) return true;
    const haystack = [provider.name, provider.id, provider.alias, provider.notice, ...(provider.serviceKinds || [])].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function nineRouterEntries(kind) {
    const query = (state.nineRouterSearch || '').trim().toLowerCase();
    return (NINE_ROUTER_PROVIDER_DATA[kind] || []).filter((provider) => nineRouterMatches(provider, query));
  }

  function nineRouterColor(provider) {
    return /^#[0-9a-f]{6}$/i.test(provider.color || '') ? provider.color : '#00ff9d';
  }

  function nineRouterView() {
    if (location.pathname === LEGACY_NINE_ROUTER_PATH) history.replaceState(null, '', NINE_ROUTER_PATH);
    const counts = nineRouterProviderCounts();
    const totalProviders = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const status = nineRouterConnectionStatus();
    const provider = state.config?.provider || {};
    const freeEntries = nineRouterEntries('free');
    const freeTierEntries = nineRouterEntries('freeTier');
    const oauthEntries = nineRouterEntries('oauth');
    const apikeyEntries = nineRouterEntries('apikey');
    const searching = Boolean((state.nineRouterSearch || '').trim());
    const visibleApikeyEntries = searching || state.nineRouterShowAllApikey ? apikeyEntries : apikeyEntries.slice(0, 16);
    const hiddenApikeyCount = Math.max(0, apikeyEntries.length - visibleApikeyEntries.length);
    const hasAnyResult = freeEntries.length || freeTierEntries.length || oauthEntries.length || apikeyEntries.length;
    const hero = el('section', { class: 'nine-hero span-12', 'aria-labelledby': 'nineRouterTitle' }, [
      el('div', { class: 'nine-hero-copy' }, [
        el('p', { class: 'provider-kicker', text: 'LOCAL AI ROUTER' }),
        el('h2', { id: 'nineRouterTitle', text: '9Router' }),
        el('p', { class: 'muted', text: 'A Zeroclaw page shaped after decolua/9router: endpoint setup, provider catalog, CLI tool guides, and skills links in one place.' }),
        el('div', { class: 'nine-hero-actions' }, [
          state.token ? el('button', { class: 'primary', type: 'button', onclick: connectNineRouterDefault, text: 'Save local 9Router provider' }) : el('button', { class: 'primary', type: 'button', onclick: rememberReturnAndLogin, text: 'Login to save Zeroclaw provider' }),
          el('button', { class: 'ghost', type: 'button', onclick: () => copyText(NINE_ROUTER_DEFAULT.installCommand, 'Install command'), text: 'Copy install command' }),
          el('a', { class: 'ghost', href: NINE_ROUTER_DEFAULT.repo, target: '_blank', rel: 'noreferrer', text: 'GitHub' })
        ])
      ]),
      el('div', { class: 'nine-hero-panel' }, [
        el('span', { class: `status-dot ${status.tone}`, 'aria-hidden': 'true' }),
        el('strong', { text: status.label }),
        el('small', { text: status.detail }),
        el('dl', { class: 'nine-mini-metrics' }, [
          el('dt', { text: 'Providers' }), el('dd', { text: String(totalProviders) }),
          el('dt', { text: 'Endpoint' }), el('dd', { text: NINE_ROUTER_DEFAULT.endpoint }),
          el('dt', { text: 'Default model' }), el('dd', { text: provider.model || NINE_ROUTER_DEFAULT.model })
        ])
      ])
    ]);

    const endpointCard = nineRouterEndpointCard();
    const connectCard = nineRouterConnectCard(status);
    const dashboardMap = nineRouterDashboardMap(counts);
    const searchCard = nineRouterSearchCard(totalProviders, hasAnyResult);
    const providerGroups = [
      nineRouterProviderGroup('Custom Providers (OpenAI/Anthropic Compatible)', 'Add any OpenAI-compatible or Anthropic-compatible endpoint, then route it through one 9Router base URL.', [
        { id: 'openai-compatible', alias: 'oai', name: 'OpenAI Compatible', color: '#10A37F', textIcon: 'OA', serviceKinds: ['llm', 'embedding', 'image'], notice: 'Add any /v1/chat/completions compatible provider.' },
        { id: 'anthropic-compatible', alias: 'ant', name: 'Anthropic Compatible', color: '#D97757', textIcon: 'AN', serviceKinds: ['llm', 'imageToText'], notice: 'Add Claude/Anthropic compatible routes.' }
      ], 'compatible'),
      oauthEntries.length ? nineRouterProviderGroup('OAuth Providers', 'Subscription/OAuth-backed providers from the upstream 9Router catalog.', oauthEntries, 'oauth') : null,
      (freeEntries.length || freeTierEntries.length) ? nineRouterProviderGroup('Free Tier Providers', 'No-auth and free-tier options surfaced by 9Router.', [...freeEntries, ...freeTierEntries], 'free') : null,
      apikeyEntries.length ? nineRouterProviderGroup('API Key Providers', 'Fixed provider catalog for API-key, media, search, and local providers.', visibleApikeyEntries, 'apikey', hiddenApikeyCount ? el('button', { class: 'ghost nine-show-all', type: 'button', onclick: () => { state.nineRouterShowAllApikey = true; render(); }, text: `Show all ${apikeyEntries.length} API key providers` }) : null) : null
    ].filter(Boolean);

    const sidebarToggle = el('button', { class: 'nine-sidebar-toggle', type: 'button', onclick: toggleSidebar, 'aria-controls': 'sidebar', 'aria-expanded': $('shell').classList.contains('nav-open') ? 'true' : 'false', 'aria-label': 'Open sidebar menu', text: '☰' });
    const children = [sidebarToggle, hero, endpointCard, connectCard, dashboardMap, searchCard];
    if (!hasAnyResult) children.push(el('section', { class: 'card nine-empty span-12' }, [el('h3', { text: 'No providers match your search' }), el('p', { class: 'muted', text: 'Try searching provider names, aliases, or service kinds like llm, tts, image, webSearch.' })]));
    children.push(...providerGroups, nineRouterCliTools(), nineRouterSkills());
    if (state.modelModalOpen) children.push(modelPickerModal());
    if (state.customApiOpen || state.fallbackModalOpen) children.push(fallbackModal());
    return el('div', { class: 'grid nine-router-page' }, children);
  }

  function nineRouterEndpointCard() {
    const curlSnippet = `curl ${NINE_ROUTER_DEFAULT.endpoint}/chat/completions \\\n  -H "Authorization: Bearer $NINE_ROUTER_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${NINE_ROUTER_DEFAULT.model}","messages":[{"role":"user","content":"hello"}]}'`;
    const envSnippet = `export OPENAI_BASE_URL="${NINE_ROUTER_DEFAULT.endpoint}"\nexport OPENAI_API_KEY="$NINE_ROUTER_API_KEY"\nexport OPENAI_MODEL="${NINE_ROUTER_DEFAULT.model}"`;
    return el('section', { class: 'card nine-endpoint-card span-7', 'aria-labelledby': 'nineEndpointTitle' }, [
      el('p', { class: 'provider-kicker', text: 'ENDPOINT' }),
      el('h3', { id: 'nineEndpointTitle', text: 'OpenAI-compatible API' }),
      el('p', { class: 'muted', text: 'Upstream 9Router runs a dashboard at /dashboard and an OpenAI-compatible API at /v1. Zeroclaw can point its Provider config at that local /v1 endpoint.' }),
      nineRouterCodeRow('Base URL', NINE_ROUTER_DEFAULT.endpoint),
      nineRouterCodeRow('Dashboard', NINE_ROUTER_DEFAULT.dashboard),
      el('div', { class: 'nine-code-grid' }, [
        el('div', {}, [el('strong', { text: 'Environment' }), pre(envSnippet, 'nine-code')]),
        el('div', {}, [el('strong', { text: 'Test request' }), pre(curlSnippet, 'nine-code')])
      ])
    ]);
  }

  function nineRouterConnectCard(status) {
    const provider = state.config?.provider || {};
    const isAuthed = Boolean(state.token);
    const form = el('form', { class: 'card stack nine-connect-card span-5', 'aria-labelledby': 'nineConnectTitle' }, [
      el('p', { class: 'provider-kicker', text: 'ZEROCLAW CONNECTION' }),
      el('h3', { id: 'nineConnectTitle', text: 'Connect Zeroclaw to 9Router' }),
      el('div', { class: `health-badge ${status.tone}` }, [el('span', { text: status.label }), el('small', { text: isAuthed ? redactedRef(provider.credentialRef) : 'Public 9Router page' })]),
      input('9Router base URL', 'nineBaseUrl', /20128\/v1/i.test(provider.baseUrl || '') ? provider.baseUrl : NINE_ROUTER_DEFAULT.endpoint),
      input('Model alias', 'nineModel', provider.model || NINE_ROUTER_DEFAULT.model),
      input('API key credential ref', 'nineCredentialRef', /NINE_ROUTER/i.test(provider.credentialRef || '') ? provider.credentialRef : NINE_ROUTER_DEFAULT.apiKeyRef),
      el('div', { class: 'provider-actions' }, [
        isAuthed ? el('button', { class: 'primary', type: 'submit', text: 'Save 9Router provider' }) : el('button', { class: 'primary', type: 'button', onclick: rememberReturnAndLogin, text: 'Login to save provider' }),
        el('button', { class: 'ghost', type: 'button', onclick: isAuthed ? checkProviderConnection : rememberReturnAndLogin, text: isAuthed ? 'Check connection' : 'Login to check connection' }),
        el('button', { class: 'ghost', type: 'button', onclick: () => copyText('export NINE_ROUTER_API_KEY="paste-your-9router-key"', 'API key env line'), text: 'Copy API key env line' })
      ]),
      el('p', { class: 'secret-note', text: isAuthed ? 'This saves only a credential reference (env:NINE_ROUTER_API_KEY). API keys stay server-side or in your environment.' : 'You can view the full 9Router dashboard without a password. Saving Zeroclaw config still requires the local dashboard login.' })
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.token) { rememberReturnAndLogin(); return; }
      const fd = new FormData(form);
      await save('/api/config/provider', { preset: 'custom', type: 'openai', baseUrl: fd.get('nineBaseUrl'), model: fd.get('nineModel'), credentialRef: fd.get('nineCredentialRef'), requestMode: 'chat-completions' });
    });
    return form;
  }

  async function connectNineRouterDefault() {
    await save('/api/config/provider', { preset: 'custom', type: 'openai', baseUrl: NINE_ROUTER_DEFAULT.endpoint, model: NINE_ROUTER_DEFAULT.model, credentialRef: NINE_ROUTER_DEFAULT.apiKeyRef, requestMode: 'chat-completions' });
  }

  function nineRouterCodeRow(label, value) {
    return el('div', { class: 'nine-code-row' }, [
      el('span', { text: label }),
      el('code', { text: value }),
      el('button', { class: 'ghost', type: 'button', onclick: () => copyText(value, label), text: 'Copy' })
    ]);
  }

  function nineRouterDashboardMap(counts) {
    const items = [
      ['Endpoint', 'api', 'Base URL, API keys, tunnel/Tailscale, token saver'],
      ['Providers', 'dns', `${counts.oauth + counts.free + counts.freeTier + counts.apikey} upstream provider definitions`],
      ['Combos', 'layers', 'Fallback and round-robin model combos'],
      ['Usage / Quota', 'chart', 'Request tracking, quota monitoring, provider stats'],
      ['MITM', 'proxy', 'IDE/app interception for supported tools'],
      ['CLI Tools', 'term', 'Claude Code, Codex, OpenClaw, Cursor, Cline, Continue, Amp']
    ];
    return el('section', { class: 'nine-dashboard-map span-12' }, [
      el('div', { class: 'provider-section-title', text: '9Router Dashboard Map' }),
      el('div', { class: 'nine-feature-grid' }, items.map(([titleText, icon, desc]) => el('article', { class: 'nine-feature-card' }, [
        el('span', { class: 'nine-feature-icon', text: icon }),
        el('strong', { text: titleText }),
        el('small', { text: desc })
      ])))
    ]);
  }

  function nineRouterSearchCard(totalProviders, hasAnyResult) {
    const search = el('input', { id: 'nineRouterSearch', class: 'nine-search', value: state.nineRouterSearch || '', placeholder: 'Search providers…', 'aria-label': 'Search 9Router providers' });
    search.addEventListener('input', (e) => {
      state.nineRouterSearch = e.target.value;
      if (!state.nineRouterSearch.trim()) state.nineRouterShowAllApikey = false;
      render();
      setTimeout(() => { const node = $('nineRouterSearch'); if (node) { node.focus(); node.setSelectionRange(node.value.length, node.value.length); } }, 0);
    });
    return el('section', { class: 'card nine-search-card span-12' }, [
      el('div', {}, [el('p', { class: 'provider-kicker', text: 'PROVIDERS' }), el('h3', { text: 'Provider catalog' }), el('p', { class: 'muted', text: `${totalProviders} providers copied from the upstream 9Router catalog categories. ${hasAnyResult ? 'Search by name, alias, or capability.' : 'No result for this query.'}` })]),
      search
    ]);
  }

  function nineRouterProviderGroup(titleText, description, entries, type, after = null) {
    const section = el('section', { class: 'nine-section span-12' }, [
      el('div', { class: 'nine-section-head' }, [
        el('div', {}, [el('h3', { text: `${titleText} (${entries.length})` }), el('p', { class: 'muted', text: description })]),
        el('span', { class: `nine-badge ${type}`, text: type === 'apikey' ? 'API Key' : title(type) })
      ]),
      el('div', { class: 'nine-provider-list' }, entries.map((provider) => nineRouterProviderCard(provider, type)))
    ]);
    if (after) section.append(after);
    return section;
  }

  function nineRouterProviderCard(provider, type) {
    const tone = provider.noAuth ? 'ready' : provider.deprecated ? 'risk' : type;
    return el('article', { class: `nine-provider-card ${provider.deprecated ? 'deprecated' : ''}` }, [
      el('div', { class: 'nine-provider-head' }, [
        el('span', { class: 'nine-provider-logo', style: `--provider-color:${nineRouterColor(provider)}` }, [el('span', { text: provider.textIcon || provider.alias?.slice(0, 2).toUpperCase() || provider.id.slice(0, 2).toUpperCase() })]),
        el('div', { class: 'nine-provider-title' }, [el('h4', { text: provider.name }), el('small', { text: `${provider.alias || provider.id} · ${provider.id}` })]),
        el('span', { class: `nine-status ${tone}`, text: provider.noAuth ? 'Ready' : provider.deprecated ? 'Risk' : (type === 'apikey' ? 'API Key' : title(type)) })
      ]),
      el('div', { class: 'nine-tags' }, (provider.serviceKinds || ['llm']).slice(0, 4).map((kind) => el('span', { text: kind }))),
      provider.notice ? el('p', { class: 'nine-provider-note', text: provider.notice }) : el('span', { hidden: true }),
      el('div', { class: 'nine-provider-foot' }, [
        provider.website ? el('a', { href: provider.website, target: '_blank', rel: 'noreferrer', text: 'Website' }) : el('span', { text: 'Local/config provider' }),
        el('button', { class: 'ghost', type: 'button', onclick: () => copyText(`${provider.alias || provider.id}/`, `${provider.name} alias`), text: 'Copy alias' })
      ])
    ]);
  }

  function nineRouterCliTools() {
    return el('section', { class: 'nine-section span-12' }, [
      el('div', { class: 'nine-section-head' }, [
        el('div', {}, [el('h3', { text: 'CLI Tools' }), el('p', { class: 'muted', text: 'Upstream 9Router ships setup guides for agent CLIs and IDE assistants. Copy a starter command, then swap model/key as needed.' })]),
        el('span', { class: 'nine-badge compatible', text: `${NINE_ROUTER_CLI_TOOLS.length} tools` })
      ]),
      el('div', { class: 'nine-cli-grid' }, NINE_ROUTER_CLI_TOOLS.map((tool) => el('article', { class: 'nine-cli-card' }, [
        el('div', { class: 'nine-provider-head' }, [
          el('span', { class: 'nine-provider-logo', style: `--provider-color:${tool.color}` }, [el('span', { text: tool.id.slice(0, 2).toUpperCase() })]),
          el('div', { class: 'nine-provider-title' }, [el('h4', { text: tool.name }), el('small', { text: tool.description })])
        ]),
        nineRouterCodeRow('Model', tool.model),
        pre(tool.command, 'nine-code'),
        el('button', { class: 'ghost', type: 'button', onclick: () => copyText(tool.command, `${tool.name} command`), text: 'Copy setup' })
      ])))
    ]);
  }

  function nineRouterSkills() {
    const rawBase = 'https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills';
    return el('section', { class: 'nine-section span-12' }, [
      el('div', { class: 'nine-section-head' }, [
        el('div', {}, [el('h3', { text: 'Skills' }), el('p', { class: 'muted', text: 'Copy skill URLs for agents that support skill-style instructions.' })]),
        el('button', { class: 'ghost', type: 'button', onclick: () => copyText(`${rawBase}/9router/SKILL.md`, '9Router entry skill URL'), text: 'Copy entry skill' })
      ]),
      el('div', { class: 'nine-skill-list' }, NINE_ROUTER_SKILLS.map((skill) => {
        const url = `${rawBase}/${skill.id}/SKILL.md`;
        return el('article', { class: skill.id === '9router' ? 'nine-skill-row entry' : 'nine-skill-row' }, [
          el('span', { class: 'nine-feature-icon', text: skill.icon }),
          el('div', {}, [el('strong', { text: skill.name }), el('p', { class: 'muted', text: skill.description }), skill.endpoint ? el('code', { text: skill.endpoint }) : el('small', { text: 'Start here' })]),
          el('button', { class: 'ghost', type: 'button', onclick: () => copyText(url, `${skill.name} skill URL`), text: 'Copy link' })
        ]);
      }))
    ]);
  }


  function providerView() {
    const status = friendlyCredentialStatus();
    const provider = state.config?.provider || {};
    const shouldShowFallback = state.credentialHealth && hasFallbackSignal(state.credentialHealth);
    if (shouldShowFallback && !state.fallbackModalOpen) {
      state.fallbackModalOpen = true;
      state.fallbackReason = fallbackMessage(state.credentialHealth);
    }
    const hero = el('section', { class: 'provider-hero span-12', 'aria-labelledby': 'providerHeroTitle' }, [
      el('div', {}, [
        el('p', { class: 'provider-kicker', text: 'OPENAI-COMPATIBLE SETUP' }),
        el('h2', { id: 'providerHeroTitle', class: 'provider-main-title', text: 'PROVIDER' }),
        el('p', { class: 'muted', text: 'Connect OpenAI with OAuth when available, or keep a Custom API fallback ready for OpenAI-compatible endpoints.' })
      ]),
      el('div', { class: 'provider-status', role: 'status', 'aria-live': 'polite' }, [
        el('span', { class: `status-dot ${status.tone}`, 'aria-hidden': 'true' }),
        el('strong', { text: status.label }),
        el('small', { text: state.credentialHealth?.email || state.credentialHealth?.chatgptAccountId || redactedRef(provider.credentialRef) })
      ])
    ]);
    const sectionOne = el('div', { class: 'provider-section span-12' }, [el('h3', { class: 'provider-section-title', text: 'OpenAI Template' })]);
    const templateCard = el('section', { class: 'card provider-card span-4', 'aria-labelledby': 'templateTitle' }, [
      el('div', { class: 'template-mark', 'aria-hidden': 'true', text: 'AI' }),
      el('h3', { id: 'templateTitle', text: 'OpenAI template' }),
      el('p', { class: 'muted', text: 'Recommended defaults for OpenAI-compatible chat: provider type openai, OAuth credential storage, and a modern default model.' }),
      el('dl', { class: 'template-list' }, [
        el('dt', { text: 'Provider' }), el('dd', { text: provider.type || 'openai' }),
        el('dt', { text: 'Model' }), el('dd', { text: provider.model || 'gpt-4o-mini' }),
        el('dt', { text: 'Credential' }), el('dd', { text: redactedRef(provider.credentialRef || 'oauth:openai') })
      ])
    ]);
    const sectionTwo = el('div', { class: 'provider-section span-12' }, [el('h3', { class: 'provider-section-title', text: 'Connect OAuth OpenAI' })]);
    const oauthCard = el('section', { class: 'card provider-card span-8', 'aria-labelledby': 'oauthTitle' }, [
      el('h3', { id: 'oauthTitle', text: 'Connect OAuth OpenAI' }),
      el('p', { class: 'muted', text: 'Primary flow: generate an OpenAI OAuth link and continue directly to OpenAI. Custom API popup only appears when OAuth cannot be accepted automatically.' }),
      el('div', { class: 'provider-actions' }, [
        el('button', { class: 'primary', onclick: reconnectOpenAI, text: 'Connect OpenAI OAuth' }),
        el('button', { class: 'ghost', onclick: checkProviderConnection, text: 'Check connection' }),
        el('button', { class: 'ghost', onclick: openCustomApiFallback, text: 'Use Custom API instead' })
      ]),
      el('p', { class: 'secret-note', text: 'Tokens remain server-side. This page never displays OAuth tokens or API keys.' })
    ]);
    const healthCard = el('section', { class: 'card provider-card span-4 credential-health', 'aria-labelledby': 'healthTitle' }, [
      el('h3', { id: 'healthTitle', text: 'Credential health' }),
      el('div', { class: `health-badge ${status.tone}`, role: 'status', 'aria-live': 'polite' }, [el('span', { text: status.label }), el('small', { text: state.credentialHealth?.email || state.credentialHealth?.chatgptAccountId || redactedRef(provider.credentialRef) })]),
      el('p', { class: 'muted', text: status.detail }),
      state.credentialHealth?.expiresAt ? el('p', { class: 'secret-note', text: `Token expires: ${new Date(state.credentialHealth.expiresAt).toLocaleString()}` }) : el('span', { hidden: true }),
      el('button', { class: 'ghost danger', onclick: clearSavedCredential, text: 'Clear saved credential' })
    ]);
    const modelCard = el('section', { class: 'card provider-card span-12 model-default-card', 'aria-labelledby': 'defaultModelTitle' }, [
      el('div', { class: 'model-default-head' }, [
        el('div', {}, [
          el('p', { class: 'provider-kicker', text: 'DEFAULT MODEL' }),
          el('h3', { id: 'defaultModelTitle', text: provider.model || 'gpt-4o-mini' }),
          el('p', { class: 'muted', text: state.providerModelsLoaded ? `${state.providerModels.length || 1} available model(s) imported (${state.providerModelsSource || 'provider/config'}).` : 'Available models auto-import when this Provider page opens.' })
        ]),
        el('button', { class: 'primary', type: 'button', onclick: openModelPicker, text: state.providerModelsLoading ? 'Importing models…' : 'Choose default model' })
      ]),
      el('div', { class: 'model-chip-row', role: 'list', 'aria-label': 'Available provider models' }, (state.providerModels.length ? state.providerModels.slice(0, 8) : [provider.model || 'gpt-4o-mini']).map((model) => el('button', { class: model === provider.model ? 'model-chip active' : 'model-chip', type: 'button', onclick: () => chooseModel(model), text: model }))),
      state.providerModels.length > 8 ? el('button', { class: 'ghost', type: 'button', onclick: openModelPicker, text: `Show all ${state.providerModels.length} models` }) : el('span', { hidden: true })
    ]);
    const sectionThree = el('div', { class: 'provider-section span-12 provider-manual-section' }, [
      el('h3', { class: 'provider-section-title', text: 'Custom API' }),
      el('p', { class: 'muted', text: 'Manual fallback is optional. Use it only if OpenAI OAuth cannot connect or you want an OpenAI-compatible gateway.' }),
      el('button', { class: 'ghost', onclick: openCustomApiFallback, text: 'Open Custom API fallback' })
    ]);
    const children = [hero, sectionOne, templateCard, sectionTwo, oauthCard, healthCard, modelCard, sectionThree];
    if (state.modelModalOpen) children.push(modelPickerModal());
    if (state.customApiOpen || state.fallbackModalOpen) children.push(fallbackModal());
    return el('div', { class: 'grid provider-grid' }, children);
  }

  function modelField(value) {
    return el('div', { class: 'model-field' }, [
      el('label', { for: 'model', text: 'Default model' }),
      el('div', { class: 'model-picker-row' }, [
        el('input', { id: 'model', name: 'model', value, readonly: true, 'aria-describedby': 'modelHint' }),
        el('button', { class: 'ghost', type: 'button', onclick: openModelPicker, text: state.providerModelsLoading ? 'Importing…' : 'Choose model' })
      ]),
      el('small', { id: 'modelHint', class: 'muted', text: state.providerModelsLoaded ? `${state.providerModels.length || 1} model(s) available. Auto-import runs when opening Provider.` : 'Models auto-import when you open Provider.' })
    ]);
  }

  function customApiForm(cls = 'span-12') {
    const provider = state.config?.provider || {};
    const form = el('form', { class: `card stack custom-api-card ${cls}`, 'aria-labelledby': 'customApiTitle' }, [
      el('div', { class: 'section-heading' }, [
        el('p', { class: 'provider-kicker', text: 'MANUAL FALLBACK' }),
        el('h2', { id: 'customApiTitle', text: 'Custom API' }),
        el('p', { class: 'muted', text: 'Use this fallback for OpenAI-compatible gateways or when OAuth is not available. Save a base URL, API key reference, and default model.' })
      ]),
      el('div', { class: 'form-grid provider-form-grid' }, [
        input('Provider type', 'type', provider.type || 'openai'),
        input('Base URL', 'baseUrl', provider.baseUrl || 'https://api.openai.com/v1'),
        modelField(provider.model || 'gpt-4o-mini'),
        input('API key / credential ref', 'credentialRef', provider.credentialRef || 'env:OPENAI_API_KEY')
      ]),
      el('button', { class: 'primary', type: 'submit', text: 'Save Custom API fallback' })
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      await save('/api/config/provider', { preset: 'custom', type: fd.get('type'), baseUrl: fd.get('baseUrl'), model: fd.get('model'), credentialRef: fd.get('credentialRef') });
      state.fallbackModalOpen = false;
      state.customApiOpen = false;
    });
    return form;
  }

  async function loadProviderModels(force = false) {
    if (!state.token || state.providerModelsLoading || (state.providerModelsLoaded && !force)) return;
    state.providerModelsLoading = true;
    try {
      const r = await api('/api/provider/models');
      const current = state.config?.provider?.model || 'gpt-4o-mini';
      state.providerModels = Array.from(new Set([...(Array.isArray(r.models) ? r.models : []), current].filter(Boolean))).sort();
      state.providerModelsSource = r.source || 'provider';
      state.providerModelsLoaded = true;
      if (r.message) flash(r.message, r.source === 'configured');
    } catch (e) {
      const current = state.config?.provider?.model || 'gpt-4o-mini';
      state.providerModels = [current];
      state.providerModelsLoaded = true;
      flash(`Model import failed: ${e.message}`, true);
    } finally {
      state.providerModelsLoading = false;
    }
  }

  async function openModelPicker() {
    state.modelModalOpen = true;
    await loadProviderModels(true);
    render();
  }

  async function chooseModel(model) {
    await api('/api/provider/default-model', { method: 'POST', body: JSON.stringify({ model }) });
    state.modelModalOpen = false;
    await loadBase();
    state.providerModels = Array.from(new Set([model, ...state.providerModels]));
    flash(`Default model set to ${model}.`);
    render();
  }

  function modelPickerModal() {
    const close = () => { state.modelModalOpen = false; render(); };
    const models = state.providerModels.length ? state.providerModels : [state.config?.provider?.model || 'gpt-4o-mini'];
    const modal = el('div', { class: 'modal-backdrop', role: 'presentation' }, [
      el('section', { class: 'modal-card model-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modelPickerTitle' }, [
        el('button', { class: 'modal-close ghost', type: 'button', onclick: close, 'aria-label': 'Close model picker', text: '×' }),
        el('p', { class: 'provider-kicker', text: 'AVAILABLE MODELS' }),
        el('h2', { id: 'modelPickerTitle', text: 'Choose default model' }),
        el('p', { class: 'muted', text: state.providerModelsLoading ? 'Importing models from provider…' : 'Models are imported automatically when you open Provider. Pick one for chat/default config.' }),
        el('div', { class: 'model-list' }, models.map((model) => el('button', { class: model === state.config?.provider?.model ? 'primary model-choice' : 'ghost model-choice', type: 'button', onclick: () => chooseModel(model), text: model }))),
        el('button', { class: 'ghost', type: 'button', onclick: async () => { await loadProviderModels(true); render(); }, text: 'Re-import models' })
      ])
    ]);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    setTimeout(() => modal.querySelector('.model-choice')?.focus(), 0);
    return modal;
  }

  function hasFallbackSignal(body) {
    if (!body || typeof body !== 'object') return false;
    return Boolean(body.fallbackRequired || body.fallback === true || body.requiresFallback || body.oauthFallbackRequired || body.mode === 'fallback-required' || body.status === 'fallback-required');
  }

  function openCustomApiFallback() {
    state.customApiOpen = true;
    state.fallbackReason = 'Manual Custom API fallback. OAuth is still the recommended OpenAI connection.';
    render();
  }

  function fallbackMessage(body) {
    return (body && (body.message || body.reason || body.detail)) || 'OAuth cannot directly connect in this backend response. Use Custom API fallback to save an OpenAI-compatible base URL, API key reference, and model.';
  }

  function fallbackModal() {
    const close = () => { state.fallbackModalOpen = false; state.customApiOpen = false; render(); };
    const modal = el('div', { class: 'modal-backdrop', role: 'presentation' }, [
      el('section', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fallbackTitle', 'aria-describedby': 'fallbackDesc' }, [
        el('button', { class: 'modal-close ghost', type: 'button', onclick: close, 'aria-label': 'Close Custom API fallback dialog', text: '×' }),
        el('p', { class: 'provider-kicker', text: state.fallbackModalOpen ? 'FALLBACK REQUIRED' : 'MANUAL FALLBACK' }),
        el('h2', { id: 'fallbackTitle', text: state.fallbackModalOpen ? 'Use Custom API fallback' : 'Custom API fallback' }),
        el('p', { id: 'fallbackDesc', class: 'muted', text: state.fallbackReason || 'OAuth is not directly available. Add OpenAI-compatible connection details below.' }),
        customApiForm('modal-form')
      ])
    ]);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    setTimeout(() => modal.querySelector('input')?.focus(), 0);
    return modal;
  }

  function chatView() {
    const usage = state.chatUsage || {};
    const usageTotal = usage.totalTokens ?? usage.total ?? 0;
    const usageDetail = state.chatUsage ? `${usageTotal} total · ${usage.inputTokens ?? usage.input ?? 0} in · ${usage.outputTokens ?? usage.output ?? 0} out` : 'No model usage in this session yet';
    const chat = el('section', { class: 'card stack span-12' }, [
      el('h2', { text: 'Chat test' }),
      el('div', { class: 'usage-bar', role: 'status', 'aria-live': 'polite' }, [
        el('strong', { text: 'Token usage' }), el('span', { text: usageDetail })
      ]),
      el('div', { class: 'chat-box', id: 'chatBox', 'aria-live': 'polite' }, state.chatMessages.length ? state.chatMessages.map(messageBubble) : [messageBubble({ role: 'assistant', content: 'Send a short test message to confirm chat is working. If the provider needs attention, I will show a simple reconnect button here.' })]),
      el('form', { class: 'chat-form' }, [el('input', { name: 'message', placeholder: 'Write a test message…', 'aria-label': 'Chat message' }), el('button', { class: 'primary', type: 'submit', text: 'Send' })])
    ]);
    chat.querySelector('form').addEventListener('submit', sendChat);
    return el('div', { class: 'grid' }, [chat]);
  }

  function channelView() {
    const channel = formView('Telegram Private Chat', '/api/config/channel', [
      input('Channel type', 'type', 'telegram'), input('Bot token ref', 'botTokenRef', state.config?.channel?.botTokenRef || 'env:TELEGRAM_BOT_TOKEN'),
      input('Private chat ID', 'chatId', state.config?.channel?.chatId || '')
    ], (fd) => ({ type: fd.get('type'), botTokenRef: fd.get('botTokenRef'), chatId: fd.get('chatId') }), 'Gunakan chat pribadi untuk kontrol lokal.');
    return channel;
  }

  function messageBubble(msg) {
    const children = [el('p', { text: msg.content })];
    if (msg.cta) children.push(el('button', { class: 'primary', onclick: () => go('/provider'), text: msg.cta, 'aria-label': 'Open Provider settings to reconnect credential' }));
    return el('div', { class: `message ${msg.role === 'user' ? 'user' : 'assistant'}` }, children);
  }

  function formView(heading, endpoint, fields, mapper, hint) {
    const form = el('form', { class: 'card stack span-12' }, [el('h2', { text: heading }), el('p', { class: 'muted', text: hint }), el('div', { class: 'form-grid' }, fields), el('button', { class: 'primary', type: 'submit', text: 'Simpan' })]);
    form.addEventListener('submit', async (e) => { e.preventDefault(); await save(endpoint, mapper(new FormData(form))); });
    return el('div', { class: 'grid' }, [form]);
  }

  function settingsView() {
    const chat = state.config?.chat || { enabled: true, systemPrompt: '', historyLimit: 20 };
    const chatForm = el('form', { class: 'stack' }, [
      el('label', { class: 'toggle-item' }, [el('span', { text: 'Enable chat endpoint' }), el('input', { class: 'switch', type: 'checkbox', name: 'enabled', checked: chat.enabled !== false })]),
      input('System prompt / agent guidance', 'systemPrompt', chat.systemPrompt || '', { textarea: true, placeholder: 'Optional. If empty, backend uses Zeroclaw default agent guidance.' }),
      input('History limit', 'historyLimit', String(chat.historyLimit || 20), { type: 'number', min: '1', max: '100' }),
      el('p', { class: 'muted', text: 'Saved server-side. The backend owns the system prompt; user chat messages cannot override it with a system role.' }),
      el('button', { class: 'primary', type: 'submit', text: 'Save chat guidance' })
    ]);
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(chatForm);
      await save('/api/settings/chat', { enabled: fd.get('enabled') === 'on', systemPrompt: fd.get('systemPrompt')?.toString() || '', historyLimit: Number(fd.get('historyLimit') || 20) });
    });
    return el('div', { class: 'grid' }, [
      card('Dashboard password', el('div', { class: 'stack' }, [
        el('p', { class: 'muted', text: 'Use POST /api/settings/password or set ZEROCLAW_DASHBOARD_PASSWORD before starting the dashboard to replace the local bootstrap password.' })
      ]), 'span-6'),
      card('Chat system prompt', chatForm, 'span-6')
    ]);
  }

  function toolsView() {
    const tools = state.config?.tools || { shell: false, browser: true, files: true, network: false };
    const list = el('div', { class: 'toggle-list' });
    Object.entries(tools).forEach(([name, enabled]) => list.append(el('label', { class: 'toggle-item' }, [el('span', { text: name }), el('input', { class: 'switch', type: 'checkbox', name, checked: enabled })])));
    const form = el('form', { class: 'card stack span-12' }, [el('h2', { text: 'Tool toggles' }), list, el('button', { class: 'primary', type: 'submit', text: 'Simpan toggles' })]);
    form.addEventListener('submit', async (e) => { e.preventDefault(); const payload = {}; new FormData(form).forEach((_, k) => payload[k] = true); Object.keys(tools).forEach(k => payload[k] = Boolean(payload[k])); await save('/api/config/tools', payload); });
    return el('div', { class: 'grid' }, [form]);
  }


  async function checkProviderConnection() {
    try { state.credentialHealth = await api('/api/provider/credential-health'); if (hasFallbackSignal(state.credentialHealth)) { state.fallbackModalOpen = true; state.fallbackReason = fallbackMessage(state.credentialHealth); } await loadProviderModels(true); flash('Connection check complete.'); }
    catch (e) { state.credentialHealth = { status: 'unknown', message: 'Credential health endpoint is not available yet. Saved settings are still visible here.' }; flash('Credential health endpoint not available.', true); }
    render();
  }
  async function clearSavedCredential() {
    if (!confirm('Clear the saved provider credential? Chat will stop working until you reconnect OpenAI OAuth. Tokens stay server-side and are never displayed.')) return;
    try { await api('/api/provider/credential-clear', { method: 'POST', body: '{}' }); state.credentialHealth = { status: 'missing', message: 'Saved credential cleared. Reconnect OpenAI OAuth to chat again.' }; flash('Saved credential cleared. Reconnect OpenAI OAuth to chat again.'); }
    catch (e) { state.credentialHealth = { status: 'unknown', message: 'Clear credential endpoint is not available yet, so nothing was changed.' }; flash('Backend clear endpoint belum tersedia; credential tidak diubah.', true); }
    render();
  }
  async function reconnectOpenAI() {
    try {
      const r = await api('/api/provider/oauth-url', { method: 'POST', body: JSON.stringify({ provider: 'openai' }) });
      if (hasFallbackSignal(r)) { state.fallbackModalOpen = true; state.fallbackReason = fallbackMessage(r); render(); return; }
      const oauthTarget = r.connectUrl || r.url || r.oauthUrl || r.authorizationUrl;
      if (oauthTarget) { sessionStorage.setItem('zeroclaw.oauth.returning', '1'); location.href = oauthTarget; }
      else { state.fallbackModalOpen = true; state.fallbackReason = 'OAuth URL is not available from the backend yet. Use Custom API fallback instead.'; render(); flash('OAuth URL belum tersedia; fallback Custom API dibuka.', true); }
    }
    catch (e) { state.fallbackModalOpen = true; state.fallbackReason = 'OpenAI OAuth is not available in this backend yet. Use Custom API fallback instead.'; render(); flash('OpenAI OAuth unavailable; Custom API fallback opened.', true); }
  }
  async function sendChat(e) {
    e.preventDefault();
    const form = e.target; const text = new FormData(form).get('message')?.toString().trim(); if (!text) return;
    state.chatMessages.push({ role: 'user', content: text }); form.reset(); render();
    try {
      const history = state.chatMessages.slice(0, -1).filter((msg) => ['user', 'assistant'].includes(msg.role) && msg.content && !msg.cta).slice(-((state.config?.chat?.historyLimit || 20) * 2));
      const r = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text, messages: history }) });
      state.chatUsage = r.usage || state.chatUsage;
      if (r.mode === 'credential-error') {
        state.credentialHealth = r.credential || { status: 'invalid' };
        state.chatMessages.push({ role: 'assistant', content: r.reply || 'I need a fresh provider connection before I can chat. Please reconnect OpenAI OAuth, then try again.', cta: 'Open Provider settings' });
      } else {
        state.chatMessages.push({ role: 'assistant', content: r.reply || r.message || r.response || 'Chat response received.' });
      }
    } catch (err) {
      if (String(err.message).includes('credential')) state.chatMessages.push({ role: 'assistant', content: 'I need a fresh provider connection before I can chat. Please reconnect OpenAI OAuth, then try again.', cta: 'Open Provider settings' });
      else state.chatMessages.push({ role: 'assistant', content: 'Chat is not available right now. Please try again after checking the provider connection.' });
    }
    render();
  }

  async function save(endpoint, payload) { try { await api(endpoint, { method: 'POST', body: JSON.stringify(payload) }); flash('Tersimpan.'); await loadBase(); render(); } catch (e) { flash(e.message, true); } }
  async function init() { await save('/api/init', {}); }
  async function runtime(action) { try { state.status = await api(`/api/runtime/${action}`, { method: 'POST', body: '{}' }); flash(`Runtime ${action} OK.`); render(); } catch (e) { flash(e.message, true); } }
  async function loadDoctor() { try { state.doctor = await api('/api/doctor'); render(); } catch(e) { flash(e.message, true); } }
  async function loadLogs() { try { const r = await api('/api/logs'); state.logs = typeof r === 'string' ? r : json(r); render(); } catch(e) { flash(e.message, true); } }

  function renderLogin() {
    $('pageTitle').textContent = 'Masuk Zeroclaw';
    $('routeEyebrow').textContent = '/login';
    $('notice').hidden = true;
    $('view').replaceChildren($('loginTemplate').content.cloneNode(true));
    const form = $('loginForm');
    const status = $('loginStatus');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = 'Membuka sesi lokal…';
      try {
        const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: new FormData(form).get('password') }) });
        state.token = res.token || res.accessToken || res.session?.token || '';
        if (!state.token) throw new Error('Token tidak ditemukan di respons login.');
        sessionStorage.setItem(tokenKey, state.token);
        const returnTo = normalizedPath(sessionStorage.getItem('zeroclaw.login.returnTo') || '/');
        sessionStorage.removeItem('zeroclaw.login.returnTo');
        history.pushState(null, '', views[returnTo] ? returnTo : '/');
        await loadBase();
        render();
        flash('Login berhasil.');
      } catch (err) {
        status.textContent = err.message;
        status.setAttribute('role', 'alert');
        form.querySelector('#password')?.focus();
      } finally {
        button.disabled = false;
      }
    });
  }

  async function render() {
    if (location.pathname === LEGACY_NINE_ROUTER_PATH) history.replaceState(null, '', NINE_ROUTER_PATH);
    const path = normalizedPath(location.pathname);
    const nineRouter = isNineRouterPath(path);
    if (path === '/login') { setAuth(); renderNav(); return renderLogin(); }
    if (!state.token && !nineRouter) { history.replaceState(null, '', '/login'); setAuth(); renderNav(); return renderLogin(); }
    if (state.token && (sessionStorage.getItem('zeroclaw.oauth.returning') === '1' || consumeOAuthReturnMarker())) {
      sessionStorage.removeItem('zeroclaw.oauth.returning');
      try { await loadBase(); state.credentialHealth = await api('/api/provider/credential-health'); await loadProviderModels(true); flash('OpenAI OAuth status refreshed. Models imported.'); } catch (_) {}
    }
    if (!views[path]) { history.replaceState(null, '', '/'); return render(); }
    if (state.token && (path === '/provider' || nineRouter)) await loadProviderModels();
    setAuth(); renderNav(); $('routeEyebrow').textContent = path; $('pageTitle').textContent = routes.find(r => r[0] === path)?.[1] || 'Overview';
    $('view').replaceChildren(views[path]());
  }

  $('menuBtn').addEventListener('click', toggleSidebar);
  $('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem(tokenKey); state.token = ''; history.pushState(null, '', '/login'); render(); });
  $('refreshBtn').addEventListener('click', async () => { await loadBase(); render(); flash('Data diperbarui.'); });
  addEventListener('message', async (event) => {
    if (!isTrustedOAuthMessage(event)) return;
    await loadBase();
    await checkProviderConnection();
    await loadProviderModels(true);
    render();
    flash('OpenAI connected. Models imported.');
  });
  addEventListener('popstate', render);
  loadBase().then(render);
})();
