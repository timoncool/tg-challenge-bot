# Правила для Claude

## Деплой на Cloudflare Workers

### ЗАПРЕЩЕНО:
- **НИКОГДА не создавать wrangler.toml / wrangler-test.toml** — деплой через toml затирает все secrets и bindings (BOT_TOKEN, API ключи и т.д.)
- **НИКОГДА не трогать bindings, secrets, env переменные** — они уже настроены на Cloudflare

### Доступы

Все креды лежат в `D:\Projects\TEMP\tg-challenge-bot-admin\.env.local`.

> ⚠️ Глобальный ключ (`X-Auth-Email` + `X-Auth-Key`, он же `CF_AUTH_KEY`) **ПРОТУХ** —
> отдаёт `Authentication error` (code 10000). Авторизация только через
> `Authorization: Bearer $CF_API_TOKEN`.

### Как деплоить ТОЛЬКО код:

Сначала прогнать регрессию — тесты без зависимостей, гоняют настоящий `scheduled`-хендлер на фейковой KV:

```bash
node --test "tests/*.test.mjs"
```

Затем PUT через API с `keep_bindings` — он сохраняет все существующие секреты и переменные:

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}" -H "Authorization: Bearer {CF_API_TOKEN}" -F 'metadata={"main_module":"worker-mr-challenger.js","compatibility_date":"2024-01-01","keep_bindings":["kv_namespace","secret_text","plain_text","secret_key"]};type=application/json' -F 'worker-mr-challenger.js=@worker-mr-challenger.js;type=application/javascript+module'
```

После деплоя проверить, что биндинги на месте (должно быть 10) и cron цел (`* * * * *`):

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}/settings" -H "Authorization: Bearer {CF_API_TOKEN}"
```

Живые логи (cron бьёт каждую минуту, видно реальный `scheduledTime`):

```bash
npx wrangler tail tg-challenge-bot --format json
```

Скачать задеплоенный код для сверки — эндпоинт `content/v2`, отдаёт multipart
(`/content` с токеном не работает, 10405):

```bash
curl -s "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}/content/v2" -H "Authorization: Bearer {CF_API_TOKEN}"
```

### Файлы:
- **`worker-mr-challenger.js`** — ОСНОВНОЙ РАБОЧИЙ ФАЙЛ, деплоится на все воркеры
- **`worker.js`** — образец/шаблон, НЕ деплоить
- **`tests/`** — регрессия на цикл «опрос → челлендж» и на слоты расписания

### Воркеры:
- **Продакшн**: `tg-challenge-bot` — файл `worker-mr-challenger.js`
- **Тест**: `tg-test-challange-bot` — файл `worker-mr-challenger.js`

### Account ID: `e3391acd7ec261a0d13d20956a7b3668`

## Грабли Cloudflare, на которых бот уже вставал

Инцидент 22–25.08.2026 — подробности в `tests/poll-lifecycle.test.mjs` и `tests/cron-slots.test.mjs`.

1. **`kv.delete()` может молча не сработать** — вызов успешен, ключ остаётся.
   Нельзя писать логику вида «ключ есть → выходим», если ключ снимается только удалением:
   один потерянный delete вешает цикл навсегда. Считать запись устаревшей по `createdAt`.
2. **Cron — best effort.** `event.scheduledTime` не выровнен по минуте (наблюдались
   `02:06:16` и `02:23:58` на одном `* * * * *`), тик может вообще не прийти.
   Матчить расписание по `h === H && m === M` нельзя — теряется событие на весь день.
   Слоты резолвятся в точный timestamp, отметка отработанного — в `community:{id}:cron_state`.

## Админка

Живой исходник — `D:\Projects\TEMP\tg-challenge-bot-admin` (в `admin/` копия репозитория).
Пароль на вход — `PAGES_ADMIN_SECRET` из её `.env.local`.

```bash
npm run build && npx wrangler pages deploy dist --project-name=tg-challenge-bot-admin --commit-dirty=true
```

Деплоить только через `wrangler` — он собирает `functions/*.ts` в `_worker.js`.
Свой `scripts/pages-deploy.mjs` заливает assets без бэка, фронт после него падает.
