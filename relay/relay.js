/**
 * Panda VPN — order form relay (Cloudflare Worker).
 *
 * The site never talks to Telegram directly: anything shipped to the browser
 * (including a bot token) can be read by any visitor. The form posts here and
 * this Worker forwards the request to Telegram, so the token stays on the
 * server side.
 *
 * Secrets (set in the Cloudflare dashboard → Worker → Settings →
 * Variables and secrets, or with `wrangler secret put`; never commit them):
 *   TELEGRAM_BOT_TOKEN — bot token from @BotFather
 *   TELEGRAM_CHAT_ID   — chat(s) that receive orders; several ids are
 *                        separated by commas (e.g. owner and manager)
 *
 * Plain variables (wrangler.toml, not secret):
 *   ALLOWED_ORIGINS — comma-separated list of site origins allowed to post
 */

const MAX_BODY_BYTES = 4096;

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://panda-vpn.online")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Strip control characters and cap the length so the form cannot be used to
// flood the chat with junk. No Telegram markup is used, so nothing is parsed.
function clean(value, limit = 200) {
  return String(value ?? "")
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, " ")
    .trim()
    .slice(0, limit);
}

// TELEGRAM_CHAT_ID may hold several chats separated by commas,
// e.g. "7405005534,123456789" — every chat gets its own copy.
function chatIds(env) {
  return String(env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function sendToChat(env, chatId, text) {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    }
  );

  if (!response.ok) {
    // Never echo Telegram's response body: an error message could contain
    // part of the token.
    throw new Error(`Telegram API responded ${response.status}`);
  }
}

// Sends to every chat in parallel. The request counts as delivered if at
// least one chat received it, so one blocked recipient does not lose it.
async function sendToTelegram(env, text) {
  const ids = chatIds(env);
  const results = await Promise.allSettled(ids.map((id) => sendToChat(env, id, text)));
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed.push(ids[i]);
      console.error(`chat ${ids[i]} delivery failed:`, r.reason?.message);
    }
  });
  if (failed.length === ids.length) {
    throw new Error("no chat received the message");
  }
}

export default {
  async fetch(request, env) {
    const origins = allowedOrigins(env);
    const origin = request.headers.get("Origin");
    const corsOrigin = origin && origins.includes(origin) ? origin : origins[0];
    const cors = corsHeaders(corsOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    // Only accept requests from our own site.
    if (origin && !origins.includes(origin)) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID secrets are not set");
      return new Response("Not Configured", { status: 503, headers: cors });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413, headers: cors });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return new Response("Bad Request", { status: 400, headers: cors });
    }

    // Honeypot: a hidden field a human never fills in.
    if (clean(data._gotcha)) {
      return Response.json({ ok: true }, { headers: cors });
    }

    const fields = {
      name: clean(data.name, 100),
      telegram: clean(data.telegram, 80),
      plan: clean(data.plan, 80),
      device: clean(data.device, 80),
      message: clean(data.message, 1500),
    };

    if (!fields.name || !fields.telegram) {
      return new Response("Bad Request", { status: 400, headers: cors });
    }

    const lines = [
      "🆕 Новая заявка VPN — panda-vpn.online",
      "",
      `👤 Имя: ${fields.name}`,
      `📱 Telegram: ${fields.telegram}`,
      `💳 Тариф: ${fields.plan || "—"}`,
      `📲 Устройство: ${fields.device || "—"}`,
    ];
    if (fields.message) lines.push(`💬 Комментарий: ${fields.message}`);
    const text = lines.join("\n");

    try {
      await sendToTelegram(env, text);
    } catch (err) {
      console.error("telegram delivery failed:", err.message);
      return new Response("Upstream Error", { status: 502, headers: cors });
    }

    return Response.json({ ok: true }, { headers: cors });
  },
};
