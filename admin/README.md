<div align="center">

# Challenger — Admin Panel

**Веб-админка для [tg-challenge-bot](https://github.com/timoncool/tg-challenge-bot) — управление AI, расписанием и текстами бота без перезаливки кода.**

![Dashboard](docs/screenshots/01-dashboard.png)

</div>

Один Cloudflare Pages деплой к тому же KV что использует воркер бота. Никакого HTTP-моста, никакой репликации — любая правка из админки видна боту при следующем cron-tick'е. Стек: Vite + React 19 + Mantine 9, бэк — Pages Functions (TypeScript), auth — HMAC HttpOnly cookie.

---

## Возможности

- **Dashboard** — все группы в эфире, активные челленджи, опросы, лидеры, stale-челленджи подсвечены.
- **AI Engine** — общие OpenRouter / Gemini токены в секции `TOKENS`, presets для быстрого переключения, hot-swap движка без redeploy бота.
- **AI Test** — модель + режим → 6 тем, время, токены, реальная цена в USD за 1 клик.
- **AI Stats** — затраты по дням / провайдерам / моделям, history последних 50 вызовов (admin-тесты тоже логируются).
- **Триггеры** — Cloudflare cron-расписание воркера бота напрямую, с минутной точностью.
- **Промпты** — instruction + corpus референсов для vanilla / medium / nsfw, `COPY ALL` и `BULK EDIT` для массовой правки.
- **Сообщения бота** — все реплики (на работы, анонсы, победителю, /help) редактируются из KV.
- **Community page** — per-community табы: Настройки, Челленджи, Лидерборд, Предложения, История тем, AI-override.
- **Audit** — append-only лог каждого `POST/PUT/PATCH /api/*` (TTL 90 дней).
- **KV Explorer** — поиск по префиксу, просмотр JSON, безопасное удаление с `?confirm=YES_I_KNOW`.

## Скриншоты

| | |
|---|---|
| **AI Engine** — TOKENS, global, presets | **AI Test** — модель, режим, цена |
| ![](docs/screenshots/02-ai-engine.png) | ![](docs/screenshots/03-ai-test.png) |
| **AI Stats** — затраты по дням / моделям | **Prompts** — инструкции и корпус |
| ![](docs/screenshots/04-ai-stats.png) | ![](docs/screenshots/05-prompts.png) |
| **Messages** — реплики бота из KV | |
| ![](docs/screenshots/06-messages.png) | |

## Архитектура

```
┌───────────────────── Cloudflare Pages ─────────────────────┐
│                                                            │
│   SPA  (Vite + React + Mantine)                            │
│     │                                                      │
│     ▼                                                      │
│   Pages Functions   ◀───  HMAC HttpOnly cookie auth        │
│     │                                                      │
│     │  direct KV binding                                   │
│     ▼                                                      │
│   ┌──────────────┐       ┌────────────────────────────┐    │
│   │ CHALLENGE_KV │ ◀──── │ tg-challenge-bot worker    │    │
│   │ (один на двоих)      │ ../worker-mr-challenger.js │    │
│   └──────────────┘       └────────────────────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Никаких внешних БД. Никакого HTTP-моста между админкой и ботом. Любая запись в KV из админки видна боту при следующем cron-tick или сообщении.

## Стек

- Vite 8, React 19, Mantine 9, TanStack Query 5, React Router 7
- Cloudflare Pages Functions (TypeScript)
- HMAC HttpOnly cookie (7 дней), `ADMIN_SECRET` в форме входа
- Без `wrangler.toml` — деплой через `wrangler pages deploy` с env-vars

## Структура

```
admin/
├── src/
│   ├── pages/                       # роуты
│   ├── components/
│   │   ├── AppShell.tsx             # sidebar + main
│   │   ├── BrandMark.tsx            # SVG monogram (= favicon)
│   │   ├── PageHeader.tsx           # унифицированный header страниц
│   │   └── OpenRouterCatalogModal.tsx
│   ├── lib/openrouter-groups.ts     # категоризация моделей в Select по цене
│   ├── api/                         # тонкий fetch-клиент
│   └── hooks/useAuth.ts
├── functions/                       # Pages Functions = бэкенд
│   ├── _lib/                        # auth, audit, guards, storage
│   └── api/
│       ├── auth/                    # login, me, logout
│       ├── ai/                      # global, presets, tokens, tokens-test, test, prompts, openrouter-catalog
│       ├── communities/[chatId]/    # settings, challenges, leaderboard, suggestions, ai, ai-history, trigger, …
│       ├── cron/triggers.ts         # cron на воркере бота
│       ├── kv/                      # explorer (keys + value)
│       ├── stats/ai.ts              # агрегаты затрат
│       ├── audit.ts                 # лог админ-действий
│       ├── messages.ts              # тексты бота
│       └── dashboard.ts             # сводка для главной
├── scripts/
│   ├── pages-setup.mjs              # одноразовый setup CF Pages + KV bindings
│   ├── pages-deploy.mjs             # CF REST для assets-only (не для full deploy)
│   ├── kv-backup.mjs                # JSON-дамп KV
│   └── kv-restore.mjs               # обратно
├── public/favicon.svg
├── index.html
├── package.json
└── .env.example
```

## Установка

### 1. Зависимости

```bash
cd admin
npm install
```

### 2. `.env.local`

```bash
cp .env.example .env.local
```

```
CF_ACCOUNT_ID=…                         # CF Dashboard → My Profile
CF_AUTH_EMAIL=you@example.com
CF_AUTH_KEY=…                           # Global API Key
CF_WORKER=tg-challenge-bot              # имя воркера бота
CF_KV_BINDING=CHALLENGE_KV

PAGES_PROJECT_NAME=tg-challenge-bot-admin
PAGES_ADMIN_SECRET=…                    # секрет на вход в админку (любая длинная строка)
PAGES_AUTH_HMAC_KEY=…                   # ключ подписи cookie (любая длинная hex)
PAGES_BOT_WORKER_URL=https://tg-challenge-bot.<subdomain>.workers.dev
PAGES_BOT_ADMIN_SECRET=…                # совпадает с env.ADMIN_SECRET у бота
```

### 3. Setup CF Pages + binding (разовая операция)

```bash
npm run pages:setup
```

Скрипт:
1. Резолвит `CHALLENGE_KV` namespace по worker bindings бота
2. Создаёт CF Pages project `tg-challenge-bot-admin`
3. Прокидывает в production + preview env: KV binding и все секреты выше

### 4. Деплой

```bash
npm run build
CLOUDFLARE_EMAIL=$CF_AUTH_EMAIL \
CLOUDFLARE_API_KEY=$CF_AUTH_KEY \
CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID \
npx wrangler@latest pages deploy dist \
  --project-name=$PAGES_PROJECT_NAME \
  --commit-dirty=true
```

Деплой только через `wrangler` потому что он собирает `functions/*.ts` в `_worker.js` через esbuild. Свой `scripts/pages-deploy.mjs` остался для assets-only — без functions он деплоит SPA без бэка и фронт крашится на пустых API-ответах.

После деплоя — публичный URL `https://<project>.pages.dev`, логин по `PAGES_ADMIN_SECRET`.

## Локальная разработка

```bash
npm run dev          # vite, /api/* проксируется на твой prod
npm run build        # tsc + vite build
npm run typecheck    # tsc -b --noEmit
npm run kv:backup    # JSON-дамп KV в admin/backups/kv-<env>-<ts>.json
npm run kv:restore   # обратная заливка из дампа
```

`backups/` лежит в `.gitignore` — дампы остаются локально как страховка перед опасными редеплоями бота.

## KV-схема

Админка не меняет существующие ключи бота, **только дополняет** опциональными:

| Ключ | Что |
|---|---|
| `secrets:ai:tokens` | `{openrouter, gemini}` — общие токены |
| `settings:ai:global` | текущий AI-движок для всех групп |
| `settings:ai:presets` | сохранённые пресеты для быстрого переключения |
| `settings:ai:prompts` | оверрайды instruction / corpus для vanilla/medium/nsfw |
| `community:{chatId}:settings:ai` | per-community override движка |
| `community:{chatId}:ai_history` | последние 50 AI-вызовов (TTL 7д) |
| `ai:history:global` | последние 200 AI-вызовов (TTL 30д) |
| `stats:ai:daily:YYYY-MM-DD` | агрегат запросов / токенов / $ за день (TTL 90д) |
| `bot:messages:override` | оверрайд реплик бота |
| `audit:event:<reverseTs>-<rand>` | append-only лог админ-действий (TTL 90д) |
| `cron:last_run` | heartbeat от cron-trigger бота |

Всё что не в таблице — ключи бота. Админка их читает, бэкапит, но структурно не трогает.

## Auth и безопасность

- `POST /api/auth/login {secret}` → проверяет HMAC от `PAGES_ADMIN_SECRET`, ставит `Set-Cookie: ch_session=<sig>.<exp>; HttpOnly; Secure; SameSite=Strict`. Cookie живёт 7 дней; rotate — меняешь `PAGES_AUTH_HMAC_KEY`.
- Любой `/api/*` (кроме `/login` и `/health`) — middleware constant-time сверяет cookie.
- Секреты только в `.env.local` (gitignored) и в CF Pages env (зашифрованы CF).
- IDOR-guard `requireCommunity` на per-chatId endpoints: нельзя дёрнуть `/api/communities/-1111/trigger` если такой community нет в реестре.
- Sensitive ключи (`apiKey`, токены) маскируются на GET — раскрываются только при PUT с явным новым значением.
- Деструктивные операции (DELETE global config, DELETE all suggestions) требуют `?confirm=YES_I_KNOW`.
- Audit log append-only с reverse-timestamp prefix — нет race conditions при concurrent admin actions.

## Лицензия

MIT.
