# Changelog

## v0.2.0 — 2026-05-17

Большая итерация. Bot worker трогался только дважды (всё backwards-compatible, KV-схема не меняется).

### Расписание

- **Per-community schedule с минутной точностью.** `pollHour/pollMinute/pollDay` и `challengeHour/challengeMinute/challengeDay` теперь полностью редактируются в Community → Настройки. UI: 3 карточки (Daily/Weekly/Monthly), внутри каждой два `HH:MM` поля (Опрос / Старт) + селекторы дня для Weekly/Monthly. Подсказка пересчитывается: «UTC (МСК − 3). Бот сам закрывает старый и стартует новый одной операцией в challengeHour».
- **Бот** при cron-tick матчит точную минуту (`m === pollMinute`) — раньше захардкоженный `pollHourBefore = 12`, окно ±30 секунд.
- **Cron сменён на `* * * * *`** (раз в минуту) чтобы ловить минутную точность. Heartbeat в `cron:last_run` пишется каждый tick.

### AI / TOKENS

- **Новая секция `00 TOKENS`** на странице `AI Engine`. Один раз сохранил OpenRouter / Gemini ключ — все presets и global этого провайдера подхватывают токен автоматически. Раньше каждый preset/global хранил свой apiKey, и при создании нового приходилось вставлять заново.
- **Авто-миграция** при первом GET `/api/ai/tokens` импортирует токены из существующих presets/global, чтобы UI сразу показал «сохранён».
- **TEST кнопка** для каждого токена: `/auth/key` для OpenRouter (показывает label / usage), `/models` для Gemini.
- **EDIT modal упрощён**: убраны поля `Name`, `API URL`, `API Key`, `Temperature`. Теперь только `Provider` (Select) + `Model`. URL и токен подставляются по дефолту по провайдеру; имя авто-генерится как `provider/model` (при смене модели имя всегда обновляется, раньше «прилипало»).
- **Grouped Select моделей OpenRouter**: 4 категории — 🚀 Frontier ($5+/1M токенов prompt), 💼 Standard, 💸 Budget, 🆓 Free. Внутри tier — премиум сверху. В label рендерится цена `$prompt/$compl/M` и контекст (`128K` / `1M`). Поиск работает через все группы. Используется в AI Test, AI Engine EDIT, Community AI override.
- **Cost USD в AI Test и AI Stats** для OpenRouter. Раньше показывался `$0`, потому что бот и admin не просили `usage: { include: true }`. Теперь просят и в `usage.cost` приходит реальная стоимость запроса.
- **AI Test пишет в Stats**. Раньше логировался только бот (`generateThemesLogged`). Сейчас `/api/ai/test` тоже добавляет запись в `ai:history:global` и `stats:ai:daily:*` с `source: "admin-test"` — статистика в одном месте.
- **Temperature не отправляется если не задана**. Модели GPT-5 / o1 / o3 / Gemini Pro 3 валят запросы с дефолтным `temperature: 0.95`. Теперь и бот, и admin test отправляют параметр только когда `typeof cfg.temperature === "number"`.

### Prompts

- **COPY ALL** — копирует весь корпус режима в clipboard как `\n`-separated текст (для редактирования в любимом редакторе).
- **BULK EDIT** — модалка с textarea, paste обратно → дубликаты и пустые строки убираются автоматически.

### Дизайн

- **Унифицированный `<PageHeader>`** на всех 10 страницах: `CONTROL ROOM / NN / SECTION` crumb + serif заголовок (44px) + accent emphasis + subtitle. Раньше каждая страница рисовала свой header в произвольном стиле.
- **Новый brand mark**: monogram «C» с прорезанной молнией в правом проёме буквы. Gradient violet → deep purple → mint, мягкий drop-shadow, inner highlight. Тот же SVG в `<BrandMark>` компоненте и в `favicon.svg`. Заголовок «Challenger» в sidebar — gradient text, подзаголовок «CONTROL ROOM» mono uppercase letterspaced.

### Backend

- **Apiurl автодефолты** по провайдеру в global и presets. Юзер больше не вставляет URL руками.
- **Apikey resolution**: explicit → previous (для PUT) → shared `secrets:ai:tokens[provider]`. Раньше для new config требовался explicit, для PUT — sentinel `__UNCHANGED__`.
- **Name всегда auto = `provider/model`**. Раньше старое имя `OpenRouter (Claude Sonnet 4.5)` оставалось после смены модели на qwen.

### Безопасность

- Один разовый migration endpoint `/admin/export-keys` (читал env.GEMINI_API_KEY через ADMIN_SECRET) **удалён из бота** после успешной миграции в `secrets:ai:tokens`.
- Соответствующий admin proxy `/api/ai/import-from-bot` тоже удалён.

### Чиновки

- `v0.0.1` → `v0.2.0`. Версия теперь подтягивается из `package.json` через Vite `__APP_VERSION__` define (в трёх местах: sidebar footer, LoginPage footer).

---

## v0.1.0 — 2026-05-17 (первичный релиз)

- Базовая админка: Dashboard, Triggers, AI Engine, AI Test, AI Stats, Prompts, Messages, Audit, KV Explorer.
- Per-community Settings/Challenges/Leaderboard/Suggestions/Themes/AI tabs.
- HMAC HttpOnly cookie auth.
- Append-only audit log с reverse-timestamp prefix.
- KV backup script для prod + test namespaces.
