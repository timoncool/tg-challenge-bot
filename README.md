<div align="center">

# TG Challenge Bot

**AI-антиспам бот для Telegram — челленджи с генерацией тем на Cloudflare Workers, бесплатный serverless.**

[![Stars](https://img.shields.io/github/stars/timoncool/tg-challenge-bot?style=flat-square)](https://github.com/timoncool/tg-challenge-bot/stargazers)
[![License](https://img.shields.io/github/license/timoncool/tg-challenge-bot?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/timoncool/tg-challenge-bot?style=flat-square)](https://github.com/timoncool/tg-challenge-bot/commits)

![Preview](assets/preview.png)

</div>

## ✨ Возможности

- 🏘️ **Мульти-сообщества**: один бот обслуживает до 10 групп
- 📅 **Три типа челленджей**: ежедневные, еженедельные, ежемесячные
- 🗳️ **Голосование за темы**: AI генерирует варианты, участники выбирают
- 🎨 **Простое участие**: просто отправьте картинку в тему челленджа
- 🔗 **Ссылки с превью**: опционально принимает ссылки как работы
- ⭐ **Подсчёт реакций**: автоматический подсчёт (🌚 не учитывается)
- 🏆 **Лидерборд**: рейтинг победителей (отдельный для каждой группы)
- 🚫 **Анти-плагиат**: пересланные изображения не принимаются
- 🧠 **Умный AI**: не повторяет темы (помнит последние 50)
- 💡 **Предложение тем**: участники могут предлагать свои темы
- 🎭 **Режимы контента**: vanilla / medium / nsfw
- ☁️ **Serverless**: работает на Cloudflare Workers (бесплатно!)
- 🎛️ **Веб-админка** (опционально, в [`admin/`](admin/)) — управление AI/расписанием/текстами без перезаливки кода

---

## 🎛️ Веб-админка

В папке [`admin/`](admin/) лежит готовая Cloudflare Pages админка к боту: смена AI-движка на лету, редактирование расписаний и текстов, лог запросов и затрат, KV explorer.

[![Admin Dashboard](admin/docs/screenshots/01-dashboard.png)](admin/README.md)

| | |
|---|---|
| **AI Engine** — токены и presets в одном месте | **AI Test** — 6 тем за секунду, видно цену |
| [![](admin/docs/screenshots/02-ai-engine.png)](admin/README.md) | [![](admin/docs/screenshots/03-ai-test.png)](admin/README.md) |
| **AI Stats** — затраты по дням / моделям | **Prompts** — инструкции и корпус референсов |
| [![](admin/docs/screenshots/04-ai-stats.png)](admin/README.md) | [![](admin/docs/screenshots/05-prompts.png)](admin/README.md) |

Подробная инструкция, архитектура, KV-схема и установка → **[`admin/README.md`](admin/README.md)**.

---

## 📋 Требования

- Telegram-группа с включёнными **темами (Topics)**
- Аккаунт [Cloudflare](https://cloudflare.com) (бесплатный)
- API-ключ [Google AI Studio](https://aistudio.google.com/apikey) (бесплатный)

---

## 🚀 Быстрая установка

### Шаг 1: Создайте бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/newbot` → введите имя → введите username
3. **Скопируйте токен** (например: `1234567890:ABCdefGHI...`)
4. `/mybots` → выберите бота → **Bot Settings** → **Group Privacy** → **Turn off**

### Шаг 2: Получите API-ключ Google AI

1. Откройте [Google AI Studio](https://aistudio.google.com/apikey)
2. **Create API Key** → скопируйте

### Шаг 3: Создайте Worker в Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create Worker**
2. Дайте имя (например: `challenge-bot`) → **Deploy**
3. **Edit Code** → вставьте код из `worker.js` → **Deploy**

### Шаг 4: Создайте KV хранилище

1. **Workers & Pages** → **KV** → **Create namespace**
2. Имя: `CHALLENGE_KV` → **Add**
3. Привяжите к Worker: **Settings** → **Bindings** → **Add** → **KV Namespace**
   - Variable name: `CHALLENGE_KV`

### Шаг 5: Добавьте секреты

**Settings** → **Variables and Secrets** → **Add** (тип: **Encrypt**):

| Имя | Значение | Обязательно |
|-----|----------|-------------|
| `BOT_TOKEN` | Токен от BotFather | ✅ Да |
| `AI_PROVIDER` | `gemini` (или `openrouter` / `openai`) | ✅ Да |
| `AI_API_URL` | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` — `{model}` бот подставит сам | ✅ Да |
| `AI_API_KEY` | API-ключ Google AI Studio | ✅ Да |
| `AI_MODEL` | Модель, например `gemini-2.5-flash` | ✅ Да |
| `ADMIN_SECRET` | Любой пароль для HTTP API (без него `/setup` и `/admin/*` закрыты) | ✅ Да |
| `WEBHOOK_SECRET` | Секрет для проверки webhook (любая строка) | ⬜ Нет |
| `OWNER_CHAT_ID` | Ваш Telegram ID: бот пишет вам в личку о сбоях, а `/register_community` доступна только вам | ⬜ Нет |

> 💡 Если ставишь админку — там в секции `TOKENS` можно сохранить OpenRouter ключ и через UI переключить движок на Claude / GPT / Llama / любую модель из 350+ без перезаливки воркера. См. [`admin/`](admin/).

> 💡 `WEBHOOK_SECRET` повышает безопасность, проверяя что запросы приходят именно от Telegram.

> 💡 Для личных сообщений о сбоях напишите боту `/start` в личке — иначе Telegram не даст ему написать первым.

### Шаг 6: Настройте расписание

**Вариант A: Cron Triggers (Cloudflare)**

**Settings** → **Triggers** → **Cron Triggers**:

```
* * * * *     — каждую минуту (проверяет расписание всех групп)
```

Время задаётся с точностью до минуты. Пропущенный тик бот догоняет в течение 55 минут, неудачный запуск сам повторяет каждые 10 минут до 6 часов.

**Вариант B: Отложенные сообщения Telegram (проще!)**

Telegram поддерживает отложенные сообщения с повтором. Вместо Cron можно использовать сам Telegram как планировщик:

1. Напишите команду в группе (например `/poll_daily`)
2. Не отправляйте сразу — нажмите и удерживайте кнопку отправки
3. Выберите **"Запланировать сообщение"**
4. Установите время и **"Повторять: Ежедневно"**

Telegram будет автоматически отправлять команду по расписанию.

### Шаг 7: Активируйте webhook

```bash
curl -H "Authorization: Bearer ВАШ_ADMIN_SECRET" \
     https://ваш-worker.workers.dev/setup
```

Без заголовка `/setup` отвечает 401. После обновления кода регистрация вебхука подтягивается сама при первом же сообщении.

Ответ при успехе:
```json
{"success": true, "webhook": "https://ваш-worker.workers.dev/webhook"}
```

### Шаг 8: Добавьте бота в группы

1. Добавьте бота в группу как **администратора**
2. Дайте права: удалять сообщения, закреплять, управлять темами
3. Напишите в группе: `/register_community`
4. Настройте топики — напишите в каждой теме:
   - `/set_daily` — в теме дневных челленджей
   - `/set_weekly` — в теме недельных
   - `/set_monthly` — в теме месячных
   - `/set_winners` — в теме победителей

### 🎉 Готово!

Повторите шаг 8 для каждой группы (до 10).

---

## 📱 Команды бота

### Для участников

| Команда | Описание |
|---------|----------|
| `/start`, `/help` | Справка по участию |
| `/stats` | Ваша статистика побед |
| `/leaderboard` | Топ-10 победителей |
| `/current` | Текущие активные челленджи |
| `/suggest Название \| Описание` | Предложить тему для челленджа |
| `/suggestions` | Список предложенных тем |

### Управление сообществами

| Команда | Описание |
|---------|----------|
| `/register_community` | Зарегистрировать группу |
| `/list_communities` | Список всех групп бота |
| `/unregister_community` | Удалить группу из бота |

Если задан `OWNER_CHAT_ID`, эти команды выполняет только владелец бота, иначе — любой админ группы.

### Настройка топиков

| Команда | Описание |
|---------|----------|
| `/topic_id` | Показать ID текущей темы |
| `/set_daily` | Назначить тему для дневных челленджей |
| `/set_weekly` | Назначить тему для недельных |
| `/set_monthly` | Назначить тему для месячных |
| `/set_winners` | Назначить тему для победителей |

### Настройки сообщества

| Команда | Описание |
|---------|----------|
| `/set_content_mode` | Режим контента: vanilla/medium/nsfw |
| `/set_accept_links on/off` | Принимать ссылки с превью как работы |
| `/set_suggestion_reactions N` | Минимум реакций для предложения (по умолчанию 3) |
| `/schedule_daily ЧАС` | Время дневных челленджей (UTC) |
| `/schedule_weekly ДЕНЬ ЧАС` | Время недельных (0=вс, 6=сб) |
| `/schedule_monthly ДЕНЬ ЧАС` | Время месячных |

### Управление челленджами

| Команда | Описание |
|---------|----------|
| `/admin` | Админ-панель со всеми командами |
| `/poll_daily` | Создать опрос дневного челленджа |
| `/poll_weekly` | Создать опрос недельного |
| `/poll_monthly` | Создать опрос месячного |
| `/run_daily` | Запустить дневной челлендж |
| `/run_weekly` | Запустить недельный |
| `/run_monthly` | Запустить месячный |
| `/finish_daily` | Завершить дневной |
| `/finish_weekly` | Завершить недельный |
| `/finish_monthly` | Завершить месячный |
| `/status` | Статус всех челленджей |
| `/cs_daily` | Статистика дневного челленджа |
| `/cs_weekly` | Статистика недельного |
| `/cs_monthly` | Статистика месячного |
| `/test_ai` | Проверить работу AI (Gemini / OpenRouter) |

---

## 🔧 Как это работает

### Цикл челленджа:

1. **Генерация** — AI создаёт темы, бот публикует опрос
2. **Голосование** — участники выбирают тему
3. **Старт** — опрос закрывается, объявляется тема-победитель
4. **Участие** — любое изображение в топике = участие
5. **Реакции** — участники оценивают работы (🌚 не считается)
6. **Итоги** — объявление победителя, пересылка в "Победители"

### Предложение тем:

Участники могут предлагать свои темы для челленджей:

1. **Предложение** — `/suggest Название | Описание`
2. **Голосование** — другие участники ставят реакции на понравившиеся предложения
3. **Одобрение** — темы с достаточным числом реакций попадают в следующий опрос
4. **Интеграция** — предложенные темы объединяются с AI-темами в опросе

Минимум реакций настраивается для каждой группы отдельно командой `/set_suggestion_reactions`.

### Мульти-сообщества:

- Каждая группа полностью изолирована
- Свои челленджи, лидерборды, настройки
- Один бот, один Worker, одна база KV
- Лимит: 10 групп

---

## 🌐 HTTP API

Все запросы требуют заголовок: `Authorization: Bearer {ADMIN_SECRET}`

### Эндпоинты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `GET` | `/` или `/health` | Проверка работоспособности |
| `GET` | `/setup` | Настройка webhook |
| `GET` | `/info` | Информация о всех сообществах |
| `GET` | `/admin/status` | Список всех сообществ |
| `GET` | `/admin/status?chat_id=ID` | Статус конкретного сообщества |
| `POST` | `/admin/poll/{type}?chat_id=ID` | Создать опрос (type: daily/weekly/monthly) |
| `POST` | `/admin/cancel-poll/{type}?chat_id=ID` | Закрыть и снять открытый опрос |
| `POST` | `/admin/start/{type}?chat_id=ID` | Запустить челлендж |
| `POST` | `/admin/finish/{type}?chat_id=ID` | Завершить челлендж |

Кроме `/` и `/health`. При ошибке ответ `500` с причиной в поле `error`.

### Примеры curl

**Проверка работоспособности:**

```bash
curl https://ваш-worker.workers.dev/health
```

**Получить статус всех сообществ:**

```bash
curl -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     https://ваш-worker.workers.dev/admin/status
```

**Получить статус конкретного сообщества:**

```bash
curl -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     "https://ваш-worker.workers.dev/admin/status?chat_id=<CHAT_ID>"
```

**Создать опрос дневного челленджа:**

```bash
curl -X POST \
     -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     "https://ваш-worker.workers.dev/admin/poll/daily?chat_id=<CHAT_ID>"
```

**Запустить челлендж (закрыть опрос):**

```bash
curl -X POST \
     -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     "https://ваш-worker.workers.dev/admin/start/daily?chat_id=<CHAT_ID>"
```

**Завершить челлендж (подвести итоги):**

```bash
curl -X POST \
     -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     "https://ваш-worker.workers.dev/admin/finish/daily?chat_id=<CHAT_ID>"
```

**Получить информацию о сообществах:**

```bash
curl -H "Authorization: Bearer ВАШ_СЕКРЕТ" \
     https://ваш-worker.workers.dev/info
```

### Пример ответа `/admin/status?chat_id=...`

```json
{
  "chatId": <CHAT_ID>,
  "challenges": {
    "daily": {
      "id": 20250115123,
      "type": "daily",
      "topic": "Киберпанк-город",
      "status": "active",
      "startedAt": 1736935200000,
      "endsAt": 1737021600000,
      "topicThreadId": 123
    },
    "weekly": null,
    "monthly": null
  },
  "polls": {
    "daily": false,
    "weekly": true,
    "monthly": false
  },
  "activeTopics": { "123": "daily" }
}
```

---

## ❓ FAQ

### Бот не отвечает
1. Проверьте, что бот — администратор группы
2. Перерегистрируйте webhook: `/setup` с заголовком `Authorization: Bearer ADMIN_SECRET` (шаг 7)
3. Проверьте логи в Cloudflare Dashboard → Workers → Logs

### Как добавить новую группу?
Добавьте бота в группу → `/register_community` → настройте топики

### Как удалить группу?
В группе: `/unregister_community`

### Как получить ID топика?
Напишите `/topic_id` в нужной теме.

### Как получить ID группы (chat_id)?
Напишите `/register_community` — бот покажет ID группы.

### Как изменить время челленджей?
Через команды в группе:
- `/schedule_daily 17` — дневные в 17:00 UTC
- `/schedule_weekly 0 17` — недельные: воскресенье 17:00
- `/schedule_monthly 1 17` — месячные: 1-го числа в 17:00

### Сколько это стоит?
**$0** для небольших групп:
- Cloudflare Workers: 100K запросов/день бесплатно
- KV: 100K чтений и 1 000 записей в день бесплатно. Каждое сообщение и реакция в группе — запись, поэтому живым группам нужен Workers Paid ($5/мес)
- Google AI: бесплатный tier достаточен

---

## 📁 Файлы

| Файл | Описание |
|------|----------|
| `worker.js` | Чистый ванильный код — разверните и настройте под своё сообщество |
| `worker-mr-challenger.js` | Тот же бот с персонажем Mr. Challenger — основной файл, из него собирается `worker.js` |
| `template/texts.js` | Нейтральные тексты для `worker.js` (`node scripts/build-template.mjs`) |
| `tests/` | Регрессия: `node --test "tests/*.test.mjs"` |

---

## 📄 Лицензия

MIT — используйте свободно!

---

## 🙏 Благодарности

- [Cloudflare Workers](https://workers.cloudflare.com/) — бесплатный serverless
- [Google AI Studio](https://aistudio.google.com/) — Gemini, генерация тем
- [OpenRouter](https://openrouter.ai/) — доступ к 350+ моделям одним токеном (опционально, через админку)

---

## Авторы

- **Nerual Dreming** — [Telegram](https://t.me/nerual_dreming) | [neuro-cartel.com](https://neuro-cartel.com) | [ArtGeneration.me](https://artgeneration.me)

## Другие проекты [@timoncool](https://github.com/timoncool)

| Проект | Описание |
|--------|----------|
| [telegram-api-mcp](https://github.com/timoncool/telegram-api-mcp) | Telegram Bot API как MCP-сервер |
| [Bulka](https://github.com/timoncool/Bulka) | Платформа лайв-кодинга музыки |
| [ACE-Step Studio](https://github.com/timoncool/ACE-Step-Studio) | AI-студия музыки — песни, вокал, каверы, клипы |
| [VideoSOS](https://github.com/timoncool/videosos) | AI-видеопродакшн в браузере |
| [GitLife](https://github.com/timoncool/gitlife) | Жизнь в неделях — интерактивный календарь |

## Поддержать автора

Я создаю опенсорс софт и занимаюсь исследованиями в области ИИ. Большая часть всего, что я делаю, находится в открытом доступе. Ваши пожертвования позволяют мне создавать и исследовать больше, не отвлекаясь на поиск еды для продолжения существования =)

**[Все способы поддержки](https://github.com/timoncool/ACE-Step-Studio/blob/master/DONATE.md)** | **[dalink.to/nerual_dreming](https://dalink.to/nerual_dreming)** | **[boosty.to/neuro_art](https://boosty.to/neuro_art)**

- **BTC:** `1E7dHL22RpyhJGVpcvKdbyZgksSYkYeEBC`
- **ETH (ERC20):** `0xb5db65adf478983186d4897ba92fe2c25c594a0c`
- **USDT (TRC20):** `TQST9Lp2TjK6FiVkn4fwfGUee7NmkxEE7C`


## Star History

<a href="https://github.com/timoncool/tg-challenge-bot/stargazers">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="docs/stars-dark.svg" />
   <source media="(prefers-color-scheme: light)" srcset="docs/stars-light.svg" />
   <img alt="Star History Chart" src="docs/stars-light.svg" />
 </picture>
</a>

