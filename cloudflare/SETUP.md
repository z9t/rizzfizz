# Personal AI Gateway

A Cloudflare Worker at `ai.<yourdomain>` that:

- Authenticates callers with bearer tokens you issue, one per friend.
- Proxies to upstream LLM providers via Cloudflare AI Gateway (optional caching, logs, fallback) or straight to an OpenAI-compatible box you trust.
- Hides your home IP from every upstream.
- Lets you revoke a friend's access without rotating the upstream API key.

## One-time setup

1. Install Wrangler.

   ```sh
   npm install -g wrangler
   wrangler login
   ```

2. Copy the config template and fill in your values.

   ```sh
   cp cloudflare/wrangler.toml.example cloudflare/wrangler.toml
   # edit: CF_ACCOUNT_ID, the route pattern
   ```

3. Create the AI Gateway. Either click through the dashboard (AI → AI Gateway → Create) or:

   ```sh
   export CF_API_TOKEN=...     # token with "AI Gateway: Edit"
   export CF_ACCOUNT_ID=...
   ./cloudflare/create-gateway.sh
   ```

4. Push secrets from the `cloudflare/` directory.

   ```sh
   cd cloudflare
   wrangler secret put ALLOWED_KEYS   # comma-separated bearer keys you've issued
   wrangler secret put OPENAI_KEY     # your real upstream key
   ```

5. Deploy.

   ```sh
   wrangler deploy
   ```

   Wrangler creates the DNS record for the custom domain automatically.

## Try it

```sh
curl https://ai.yourdomain.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_PERSONAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"hello"}]
  }'
```

Upstream sees only Cloudflare's IP. The request shows up in the AI Gateway dashboard.

## Adding more backends

Edit `worker.js`. Each backend is one entry in `CONFIG.backends`:

```js
backends: {
  openai:    { mode: "gateway", provider: "openai",    upstreamKeySecret: "OPENAI_KEY" },
  anthropic: { mode: "gateway", provider: "anthropic", upstreamKeySecret: "ANTHROPIC_KEY" },
  groq:      { mode: "gateway", provider: "groq",      upstreamKeySecret: "GROQ_KEY" },
  friend:    { mode: "direct",  baseURL: "https://llm.friend.example", upstreamKeySecret: "FRIEND_KEY" },
}
```

Push any new secret, redeploy:

```sh
wrangler secret put ANTHROPIC_KEY
wrangler deploy
```

Callers reach each backend at `/<backend>/...`:

```
https://ai.yourdomain.com/openai/v1/chat/completions
https://ai.yourdomain.com/anthropic/v1/messages
https://ai.yourdomain.com/friend/v1/chat/completions
```

## Modes

- `gateway` — request flows through Cloudflare AI Gateway. Adds ~5-15 ms but gives you the dashboard, caching, logs, rate limits, and fallback. Use this by default.
- `direct` — Worker proxies straight to `baseURL`. Adds ~1-5 ms. Use for upstreams you don't want CF caching or logging (e.g. your friend's box).

Both modes hide your home IP from the upstream.

## Lending access to a friend

`ALLOWED_KEYS` is one secret containing a comma-separated list of valid bearer keys. To lend access, append a new random string and reset the secret:

```sh
# generate a key, then:
echo "$(wrangler secret get ALLOWED_KEYS),friend-$(openssl rand -hex 16)" \
  | wrangler secret put ALLOWED_KEYS
```

Give the friend just their string. When they're done, push `ALLOWED_KEYS` again without it. Your real `OPENAI_KEY` never leaves the Worker.

## Cost control (when it starts getting expensive)

In the AI Gateway dashboard or via `create-gateway.sh`:

- Set `CF_CACHE_TTL=3600` (or any number) — identical prompts inside that window return from cache for free. Big savings on repeated work.
- Set `CF_RATE_LIMIT` and `CF_RATE_INTERVAL` — hard cap requests per window across all callers.

For per-caller caps, the Worker can be extended to keep a counter in Workers KV keyed by bearer key. Tell me when you want that and I'll add it.

## Latency

Going `you → Worker → upstream` vs. `you → upstream` adds one round trip to the nearest Cloudflare POP. On a home connection that's typically 5-20 ms, which is invisible next to LLM inference (seconds). AI Gateway adds another ~5-15 ms in `gateway` mode.
