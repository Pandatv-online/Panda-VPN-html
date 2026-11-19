# pandavpn-relay

Cloudflare Worker behind the order form on panda-vpn.online (contact.html). The form in
`assets/js/form-telegram.js` posts `{name, telegram, plan, device, message}` as JSON to
`https://pandavpn-relay.pandatv-eu.workers.dev`; the Worker forwards the
request to Telegram. The bot token lives only in Cloudflare.

## Deploy

Deployed automatically by Cloudflare Workers Builds on every push to `main`
(root directory `/relay`). Manual deploy:

```sh
cd relay
npx wrangler deploy
```

## Secrets

Set once in the Cloudflare dashboard → Workers & Pages → `pandavpn-relay`
→ Settings → Variables and secrets → Add → **Secret**:

- `TELEGRAM_BOT_TOKEN` — token from @BotFather
- `TELEGRAM_CHAT_ID` — chat that receives the requests; several chats are
  separated by commas, e.g. `7405005534,123456789` (each person sends `/start` to the
  bot from that chat first)

Or from a terminal: `npx wrangler secret put TELEGRAM_BOT_TOKEN`.

Until both secrets are set the Worker answers `503 Not Configured`.

## Responses

| Status | Meaning |
|---|---|
| 200 `{ok:true}` | sent to Telegram |
| 400 | invalid JSON or empty name or telegram |
| 403 | request from a site not listed in `ALLOWED_ORIGINS` |
| 413 | body larger than 4 KB |
| 502 | Telegram rejected the message (check the token / chat id, `wrangler tail`) |
| 503 | secrets not set |
