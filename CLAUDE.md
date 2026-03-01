# Правила для Claude

## Деплой на Cloudflare Workers

### ЗАПРЕЩЕНО:
- **НИКОГДА не создавать wrangler.toml / wrangler-test.toml** — деплой через toml затирает все secrets и bindings (BOT_TOKEN, API ключи и т.д.)
- **НИКОГДА не трогать bindings, secrets, env переменные** — они уже настроены на Cloudflare

### Как деплоить ТОЛЬКО код:
```bash
# Через API с keep_bindings — сохраняет все существующие секреты и переменные
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}" \
  -H "X-Auth-Email: {EMAIL}" \
  -H "X-Auth-Key: {API_KEY}" \
  -F 'metadata={"main_module":"worker-mr-challenger.js","compatibility_date":"2024-01-01","keep_bindings":["kv_namespace","secret_text","plain_text","secret_key"]};type=application/json' \
  -F 'worker-mr-challenger.js=@worker-mr-challenger.js;type=application/javascript+module'
```

### Воркеры:
- **Продакшн**: `tg-challenge-bot` — файл `worker-mr-challenger.js`
- **Тест**: `tg-test-challange-bot` — файл `worker-mr-challenger.js`

### Account ID: `e3391acd7ec261a0d13d20956a7b3668`
