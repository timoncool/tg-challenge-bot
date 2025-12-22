# TG Challenge Bot

Telegram бот для проведения творческих челленджей с голосованием через реакции.

## Деплой

**ВАЖНО:** После любых изменений в коде (`src/`) нужно пересобрать `worker.js`:

```bash
npm install
npm run build
```

Затем скопировать содержимое `worker.js` в Cloudflare Workers.

## Структура

```
src/
├── index.ts           # Entry point + bot setup
├── types.ts           # TypeScript типы
├── localization.ts    # Локализация (RU/EN)
├── handlers/
│   ├── commands.ts    # /start, /help, /stats, /leaderboard, /current
│   ├── reactions.ts   # Подсчёт реакций
│   └── submissions.ts # Регистрация работ
├── services/
│   ├── storage.ts     # Cloudflare KV
│   └── ai.ts          # Gemini API для генерации тем
└── cron/
    └── challenges.ts  # Lifecycle челленджей
```

## Конфигурация

В `wrangler.toml`:
- `CHAT_ID` - ID группы
- `TOPIC_*` - ID форум-топиков
- `BOT_TOKEN` - токен бота (secret)
- `GEMINI_API_KEY` - API ключ Gemini (secret)
