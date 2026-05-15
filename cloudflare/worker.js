// Personal AI gateway Worker.
//
// Fronts one or more upstream LLM APIs behind a single domain you control,
// hides your home IP, and lets you hand out per-friend bearer keys you can
// revoke without rotating the real upstream credentials.
//
// Call shape:
//   POST https://ai.<yourdomain>/<backend>/v1/chat/completions
//   Authorization: Bearer <personal-key-you-issued>
//
// To add a backend: append to CONFIG.backends and `wrangler secret put` the
// upstream key. To revoke a caller: rewrite the ALLOWED_KEYS secret without
// their string and redeploy.

const CONFIG = {
  backends: {
    openai: {
      mode: "gateway",
      provider: "openai",
      upstreamKeySecret: "OPENAI_KEY",
    },

    // anthropic: {
    //   mode: "gateway",
    //   provider: "anthropic",
    //   upstreamKeySecret: "ANTHROPIC_KEY",
    // },
    //
    // groq: {
    //   mode: "gateway",
    //   provider: "groq",
    //   upstreamKeySecret: "GROQ_KEY",
    // },
    //
    // friend: {
    //   mode: "direct",
    //   baseURL: "https://llm.friend.example",
    //   upstreamKeySecret: "FRIEND_KEY",
    // },
  },
};

export default {
  async fetch(request, env) {
    const presented = (request.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    const allowed = (env.ALLOWED_KEYS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (!presented || !allowed.includes(presented)) {
      return new Response("unauthorized\n", { status: 401 });
    }

    const url = new URL(request.url);
    const [backendName, ...rest] = url.pathname.replace(/^\/+/, "").split("/");
    const backend = CONFIG.backends[backendName];
    if (!backend) {
      return new Response(`unknown backend: ${backendName}\n`, { status: 404 });
    }
    const upstreamPath = "/" + rest.join("/");

    let upstreamURL;
    if (backend.mode === "gateway") {
      upstreamURL = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY}/${backend.provider}${upstreamPath}${url.search}`;
    } else if (backend.mode === "direct") {
      upstreamURL = `${backend.baseURL}${upstreamPath}${url.search}`;
    } else {
      return new Response(`bad backend mode: ${backend.mode}\n`, { status: 500 });
    }

    const headers = new Headers(request.headers);
    const upstreamKey = env[backend.upstreamKeySecret];
    if (upstreamKey) {
      headers.set("Authorization", `Bearer ${upstreamKey}`);
    } else {
      headers.delete("Authorization");
    }
    headers.delete("host");
    headers.delete("cf-connecting-ip");

    return fetch(upstreamURL, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    });
  },
};
