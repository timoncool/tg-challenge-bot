// ============================================
// TG CHALLENGE BOT - Single File Version
// Просто скопируй этот код в Cloudflare Dashboard
// ============================================

// Эмодзи-исключение (негативная реакция)
const EXCLUDED_EMOJI = "🌚";

// Russian pluralization helper
function pluralize(n, one, few, many) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// ============================================
// ЛОКАЛИЗАЦИЯ
// ============================================

const ru = {
  challengeTypes: {
    daily: "Челлендж дня",
    weekly: "Челлендж недели",
    monthly: "Челлендж месяца",
  },
  pollQuestion: (type) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    return `🗳️ Голосуем за тему ${labels[type]} челленджа!`;
  },
  challengeAnnouncement: (type, topic, endTime) => {
    const labels = {
      daily: "🎯 ЧЕЛЛЕНДЖ ДНЯ",
      weekly: "🎯 ЧЕЛЛЕНДЖ НЕДЕЛИ",
      monthly: "🎯 ЧЕЛЛЕНДЖ МЕСЯЦА",
    };
    return `${labels[type]}

🎨 Тема: ${topic}

⏰ До: ${endTime}

📸 Для участия — просто отправьте изображение в эту тему!
❤️ Ставьте реакции понравившимся работам
🌚 Реакция «луна» не учитывается

Удачи! 🍀`;
  },
  winnerAnnouncement: (username, score, type) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    return `🏆 ПОБЕДИТЕЛЬ ${labels[type].toUpperCase()} ЧЕЛЛЕНДЖА!

👤 ${username}
⭐ Набрано реакций: ${score}

Поздравляем! 🎉`;
  },
  noSubmissions: "😔 К сожалению, в этом челлендже никто не участвовал.",
  leaderboardTitle: (type) => {
    const labels = {
      daily: "дневных",
      weekly: "недельных",
      monthly: "месячных",
    };
    return `🏆 ТОП-10 победителей ${labels[type]} челленджей:`;
  },
  helpMessage: `🤖 Бот для нейро-арт челленджей

📋 Как участвовать:
1. Дождитесь объявления темы челленджа
2. Отправьте изображение в соответствующую тему
3. Бот подтвердит получение работы ✅
4. Ставьте реакции работам других участников
5. Побеждает работа с наибольшим числом реакций

⏰ Расписание:
• Дневные: каждый день в 17:00
• Недельные: каждое воскресенье в 17:00
• Месячные: 1-го числа в 17:00

⚠️ Реакция 🌚 не учитывается

📊 Команды:
/current — текущие активные челленджи
/stats — ваша статистика побед
/leaderboard [daily|weekly|monthly] — топ победителей
/help — эта справка`,
};

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

function getConfig(env) {
  return {
    chatId: parseInt(env.CHAT_ID, 10) || 0,
    topics: {
      daily: parseInt(env.TOPIC_DAILY, 10) || 0,
      weekly: parseInt(env.TOPIC_WEEKLY, 10) || 0,
      monthly: parseInt(env.TOPIC_MONTHLY, 10) || 0,
      winners: parseInt(env.TOPIC_WINNERS, 10) || 0,
    },
    timezoneOffset: parseInt(env.TIMEZONE_OFFSET, 10) || 0,
    language: env.BOT_LANGUAGE || "ru",
  };
}

// ============================================
// TELEGRAM API
// ============================================

class TelegramAPI {
  constructor(token) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async request(method, params = {}, retries = 3) {
    let lastError;
    let rateLimitRetries = 0;
    const MAX_RATE_LIMIT_RETRIES = 3;
    const MAX_RETRY_AFTER = 30; // Max 30 seconds wait

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!data.ok) {
          const errorCode = data.error_code;
          const description = data.description || "Telegram API error";

          // Don't retry client errors (400-499 except 429)
          if (errorCode >= 400 && errorCode < 500 && errorCode !== 429) {
            console.error(`Telegram API error: ${method}`, {
              code: errorCode,
              description,
            });
            throw new Error(`[${errorCode}] ${description}`);
          }

          // Rate limited - wait and retry (with limit!)
          if (errorCode === 429) {
            rateLimitRetries++;
            if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
              throw new Error(`Rate limited too many times: ${description}`);
            }
            const retryAfter = Math.min(
              data.parameters?.retry_after || 1,
              MAX_RETRY_AFTER,
            );
            console.warn(
              `Rate limited (${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES}), waiting ${retryAfter}s...`,
            );
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            attempt--; // Don't count against main retries, but count against rate limit retries
            continue;
          }

          throw new Error(description);
        }

        return data.result;
      } catch (e) {
        lastError = e;
        // Don't retry non-network errors
        if (e instanceof SyntaxError || e.message?.startsWith("[4")) {
          throw e;
        }
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `Telegram API retry ${attempt + 1}/${retries} for ${method}`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    console.error(
      `Telegram API failed after ${retries} attempts: ${method}`,
      lastError,
    );
    throw lastError;
  }

  async sendMessage(chatId, text, options = {}) {
    // Truncate if too long (Telegram limit 4096)
    if (text.length > 4096) {
      console.warn(`Message too long (${text.length}), truncating`);
      text = text.substring(0, 4093) + "...";
    }
    return this.request("sendMessage", { chat_id: chatId, text, ...options });
  }

  async sendPoll(chatId, question, options, params = {}) {
    // Validate poll options (max 10, each max 100 bytes)
    if (options.length > 10) {
      console.warn(
        `Too many poll options (${options.length}), truncating to 10`,
      );
      options = options.slice(0, 10);
    }
    options = options.map((opt) => {
      if (new TextEncoder().encode(opt).length > 100) {
        let truncated = opt;
        while (new TextEncoder().encode(truncated).length > 97) {
          truncated = truncated.slice(0, -1);
        }
        return truncated + "...";
      }
      return opt;
    });

    return this.request("sendPoll", {
      chat_id: chatId,
      question: question.substring(0, 300),
      options,
      ...params,
    });
  }

  async stopPoll(chatId, messageId) {
    return this.request("stopPoll", { chat_id: chatId, message_id: messageId });
  }

  async forwardMessage(chatId, fromChatId, messageId, options = {}) {
    return this.request("forwardMessage", {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options,
    });
  }

  async getChatMember(chatId, userId) {
    return this.request("getChatMember", { chat_id: chatId, user_id: userId });
  }

  async isUserAdmin(chatId, userId) {
    try {
      const member = await this.getChatMember(chatId, userId);
      return member.status === "creator" || member.status === "administrator";
    } catch {
      return false;
    }
  }

  async setWebhook(url, secret = null) {
    const params = {
      url,
      allowed_updates: [
        "message",
        "message_reaction",
        "message_reaction_count",
        "poll",
        "poll_answer",
      ],
    };
    if (secret) params.secret_token = secret;
    return this.request("setWebhook", params);
  }
}

// ============================================
// KV STORAGE
// ============================================

class Storage {
  constructor(kv) {
    this.kv = kv;
  }

  async get(key) {
    const data = await this.kv.get(key, "json");
    return data;
  }

  async set(key, value) {
    await this.kv.put(key, JSON.stringify(value));
  }

  async delete(key) {
    await this.kv.delete(key);
  }

  // Challenge
  async getChallenge(type) {
    return this.get(`challenge:${type}`);
  }

  async saveChallenge(challenge) {
    await this.set(`challenge:${challenge.type}`, challenge);
  }

  async getNextChallengeId(type) {
    const key = `challenge:${type}:counter`;
    const current = await this.kv.get(key);
    const next = (parseInt(current || "0", 10) || 0) + 1;
    await this.kv.put(key, String(next));
    return next;
  }

  // Poll
  async getPoll(type) {
    return this.get(`poll:${type}`);
  }

  async savePoll(poll) {
    await this.set(`poll:${poll.type}`, poll);
  }

  async deletePoll(type) {
    await this.delete(`poll:${type}`);
  }

  // Submissions
  async getSubmissions(type, challengeId) {
    return (await this.get(`submissions:${type}:${challengeId}`)) || [];
  }

  async addSubmission(type, challengeId, submission) {
    const submissions = await this.getSubmissions(type, challengeId);
    if (submissions.some((s) => s.messageId === submission.messageId)) return;
    submissions.push(submission);
    await this.set(`submissions:${type}:${challengeId}`, submissions);
  }

  async updateSubmissionScore(type, challengeId, messageId, score) {
    const submissions = await this.getSubmissions(type, challengeId);
    const submission = submissions.find((s) => s.messageId === messageId);
    if (submission) {
      submission.score = score;
      await this.set(`submissions:${type}:${challengeId}`, submissions);
    }
  }

  // Leaderboard
  async getLeaderboard(type) {
    const map = (await this.get(`leaderboard:${type}`)) || {};
    return Object.values(map).sort((a, b) => b.wins - a.wins);
  }

  async addWin(type, userId, username) {
    const map = (await this.get(`leaderboard:${type}`)) || {};
    const key = String(userId);
    if (!map[key]) {
      map[key] = { userId, username, wins: 0 };
    }
    map[key].wins += 1;
    map[key].lastWin = Date.now();
    if (username) map[key].username = username;
    await this.set(`leaderboard:${type}`, map);
  }

  async getUserStats(type, userId) {
    const leaderboard = await this.getLeaderboard(type);
    const index = leaderboard.findIndex((e) => e.userId === userId);
    if (index === -1) return { wins: 0, rank: leaderboard.length + 1 };
    return { wins: leaderboard[index].wins, rank: index + 1 };
  }

  // Active topics
  async getActiveTopics() {
    return (await this.get("active_topics")) || {};
  }

  async setActiveTopics(topics) {
    await this.set("active_topics", topics);
  }

  async isActiveTopic(threadId) {
    const topics = await this.getActiveTopics();
    return topics[threadId] || null;
  }
}

// ============================================
// AI SERVICE (Gemini)
// ============================================

async function generateThemes(apiKey, type, language = "ru") {
  // Format: "Короткое название | Полное описание"
  // Short name for poll (2-3 words), full description for announcement
  const prompts = {
    daily: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕДНЕВНОГО челленджа. Это лёгкие, весёлые темы на 5-15 минут генерации.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. КОРОТКОЕ НАЗВАНИЕ (2-3 слова) — для голосования в опросе
  2. ПОЛНОЕ ОПИСАНИЕ (1 предложение) — для объявления челленджа
- Тема должна вдохновлять на ВИЗУАЛЬНЫЙ образ, который можно представить
- Разнообразие стилей: реализм, фэнтези, абстракция, юмор, sci-fi, природа
- Темы НЕ должны требовать сложных композиций
- Избегай: политики, религии, насилия, NSFW
- Язык: русский
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Короткое название | Полное описание
</format>

<examples>
Кот-астронавт | Пушистый кот в скафандре чинит космический корабль среди звёзд
Кофе Ван Гога | Дымящаяся чашка кофе на террасе с видом на горы в экспрессивном стиле Ван Гога
Грибной лес | Волшебный ночной лес со светящимися грибами и мягким туманом
Толстый супергерой | Упитанный кот в развевающемся плаще супергероя на крыше небоскрёба
Ретро-будущее | Город в стиле ретрофутуризма 60-х с летающими машинами и неоновыми вывесками
Подводный закат | Коралловый риф в лучах заходящего солнца, пробивающихся сквозь воду
</examples>`,

    weekly: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕНЕДЕЛЬНОГО челленджа. Это темы средней сложности, требующие экспериментов со стилями, композицией и деталями.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. КОРОТКОЕ НАЗВАНИЕ (2-3 слова) — для голосования в опросе
  2. ПОЛНОЕ ОПИСАНИЕ (1-2 предложения) — для объявления челленджа
- Тема должна мотивировать на СЕРИЮ попыток и эксперименты
- Разнообразие: сюжетные, атмосферные, стилизованные, концептуальные темы
- Можно включать сложные сцены, несколько персонажей, необычные ракурсы
- Избегай: политики, религии, насилия, NSFW
- Язык: русский
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Короткое название | Полное описание
</format>

<examples>
Забытый парк | Заброшенный парк аттракционов, медленно поглощаемый дикой природой — ржавые карусели обвиты плющом
Цифровой распад | Портрет человека, чьё лицо распадается на пиксели, превращающиеся в стаю бабочек
Ар-деко под водой | Затонувший город в стиле ар-деко, освещённый только биолюминесцентными существами
Встреча эпох | Момент встречи средневекового рыцаря и киберпанк-самурая на перекрёстке времён
Сны робота | Что видит во сне андроид — сюрреалистичный внутренний мир искусственного разума
Последний день | Обычный городской пейзаж в последние мгновения перед чем-то невероятным
</examples>`,

    monthly: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕМЕСЯЧНОГО челленджа. Это АМБИЦИОЗНЫЕ темы, настоящий вызов мастерству — сложные концепции, нестандартные идеи, темы которые заставляют думать и экспериментировать неделями.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. КОРОТКОЕ НАЗВАНИЕ (2-3 слова) — для голосования в опросе
  2. ПОЛНОЕ ОПИСАНИЕ (2-3 предложения) — для объявления челленджа, раскрывающее глубину концепции
- Тема должна быть ГЛУБОКОЙ — философской, концептуальной или технически сложной
- Тема должна допускать МНОЖЕСТВО интерпретаций
- Приветствуются: метафоры, парадоксы, смешение несовместимого
- Это должна быть тема для портфолио
- Избегай: политики, религии, насилия, NSFW
- Язык: русский
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Короткое название | Полное описание
</format>

<examples>
Последний сон ИИ | Что видит искусственный интеллект в последние миллисекунды перед отключением? Визуализация угасающего цифрового сознания — фрагменты данных, образы из обучения, страх или покой?
Город памяти | Метрополис, построенный из человеческих воспоминаний. Каждое здание — чья-то история, каждая улица — чья-то жизнь. Светлые районы счастья и тёмные кварталы травм.
Видимая музыка | Как выглядит симфония, если её можно увидеть? Визуализация музыкального произведения — от первых нот до финального аккорда — в одном изображении.
Эволюция красоты | Один и тот же объект глазами разных эпох человечества. Как менялось восприятие красоты от пещерных людей до нас и далее в будущее.
Изнанка реальности | Что находится за пределами видимого мира? Момент, когда реальность даёт трещину и сквозь неё проглядывает нечто иное — код? хаос? истина?
Эмпатия машины | Момент, когда робот впервые испытывает эмоцию. Что это за эмоция? Как она выглядит изнутри механического существа?
</examples>`,
  };

  const prompt = prompts[type];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 500 },
        }),
      },
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Parse lines in format "Short | Full"
    const themes = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("|") && l.length > 5)
      .slice(0, 6);

    if (themes.length >= 6) return themes;
  } catch (e) {
    console.error("AI error:", e);
  }

  // Fallback themes in format "Short | Full"
  const fallbacks = {
    daily: [
      "Кот-астронавт | Пушистый кот в скафандре чинит космический корабль среди звёзд",
      "Кофе Ван Гога | Дымящаяся чашка кофе на террасе с видом на горы в экспрессивном стиле Ван Гога",
      "Грибной лес | Волшебный ночной лес со светящимися грибами и мягким туманом",
      "Толстый супергерой | Упитанный кот в развевающемся плаще супергероя на крыше небоскрёба",
      "Ретро-будущее | Город в стиле ретрофутуризма 60-х с летающими машинами и неоновыми вывесками",
      "Подводный закат | Коралловый риф в лучах заходящего солнца, пробивающихся сквозь воду",
    ],
    weekly: [
      "Забытый парк | Заброшенный парк аттракционов, медленно поглощаемый дикой природой",
      "Цифровой распад | Портрет человека, чьё лицо распадается на пиксели и бабочки",
      "Ар-деко под водой | Затонувший город в стиле ар-деко, освещённый биолюминесценцией",
      "Встреча эпох | Момент встречи средневекового рыцаря и киберпанк-самурая",
      "Сны робота | Сюрреалистичный внутренний мир искусственного разума",
      "Последний день | Обычный городской пейзаж в последние мгновения перед чем-то невероятным",
    ],
    monthly: [
      "Последний сон ИИ | Что видит искусственный интеллект в последние миллисекунды перед отключением",
      "Город памяти | Метрополис, построенный из человеческих воспоминаний — каждое здание чья-то история",
      "Видимая музыка | Как выглядит симфония, если её можно увидеть — от первых нот до финального аккорда",
      "Эволюция красоты | Один объект глазами разных эпох — от пещерных людей до далёкого будущего",
      "Изнанка реальности | Момент, когда реальность даёт трещину и сквозь неё проглядывает нечто иное",
      "Эмпатия машины | Момент, когда робот впервые испытывает эмоцию",
    ],
  };
  return fallbacks[type];
}

// Helper to parse theme format "Short | Full"
function parseTheme(themeStr) {
  if (!themeStr || typeof themeStr !== "string") {
    return { short: "Свободная тема", full: "Свободная тема" };
  }
  const parts = themeStr.split("|").map((s) => s.trim());
  return {
    short: parts[0] || themeStr,
    full: parts[1] || parts[0] || themeStr,
  };
}

// ============================================
// HANDLERS
// ============================================

async function handleMessage(update, env, config, tg, storage) {
  try {
    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = message.text || "";
    const threadId = message.message_thread_id || 0;

    // Убираем @username из команды (в группах Telegram добавляет его)
    const command = text.split("@")[0].split(" ")[0].toLowerCase();

    // Commands
    if (command === "/start" || command === "/help") {
      await tg.sendMessage(chatId, ru.helpMessage, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // ============================================
    // ADMIN COMMANDS (только для админов группы)
    // ============================================
    const isAdmin = config.chatId && message.from?.id
      ? await tg.isUserAdmin(config.chatId, message.from.id)
      : false;

    if (command === "/admin" && isAdmin) {
      await tg.sendMessage(
        chatId,
        `🔧 АДМИН-ПАНЕЛЬ

📊 Опросы:
/poll_daily — создать опрос дня
/poll_weekly — создать опрос недели
/poll_monthly — создать опрос месяца

🚀 Запуск челленджей:
/run_daily — запустить дневной
/run_weekly — запустить недельный
/run_monthly — запустить месячный

🏁 Завершение:
/finish_daily — завершить дневной
/finish_weekly — завершить недельный
/finish_monthly — завершить месячный

📈 Статус:
/status — текущее состояние всех челленджей
/cs — статистика текущих челленджей (работы + баллы)
/test_ai — проверить работу Gemini API`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Admin: Create polls
    if (command === "/poll_daily" && isAdmin) {
      await storage.deletePoll("daily");
      await generatePoll(env, config, tg, storage, "daily");
      await tg.sendMessage(chatId, "✅ Опрос дня создан!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/poll_weekly" && isAdmin) {
      await storage.deletePoll("weekly");
      await generatePoll(env, config, tg, storage, "weekly");
      await tg.sendMessage(chatId, "✅ Опрос недели создан!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/poll_monthly" && isAdmin) {
      await storage.deletePoll("monthly");
      await generatePoll(env, config, tg, storage, "monthly");
      await tg.sendMessage(chatId, "✅ Опрос месяца создан!", { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Start challenges
    if (command === "/run_daily" && isAdmin) {
      await startChallenge(env, config, tg, storage, "daily");
      await tg.sendMessage(chatId, "✅ Дневной челлендж запущен!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/run_weekly" && isAdmin) {
      await startChallenge(env, config, tg, storage, "weekly");
      await tg.sendMessage(chatId, "✅ Недельный челлендж запущен!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/run_monthly" && isAdmin) {
      await startChallenge(env, config, tg, storage, "monthly");
      await tg.sendMessage(chatId, "✅ Месячный челлендж запущен!", { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Finish challenges
    if (command === "/finish_daily" && isAdmin) {
      await finishChallenge(env, config, tg, storage, "daily");
      await tg.sendMessage(chatId, "✅ Дневной челлендж завершён!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/finish_weekly" && isAdmin) {
      await finishChallenge(env, config, tg, storage, "weekly");
      await tg.sendMessage(chatId, "✅ Недельный челлендж завершён!", { message_thread_id: threadId || undefined });
      return;
    }
    if (command === "/finish_monthly" && isAdmin) {
      await finishChallenge(env, config, tg, storage, "monthly");
      await tg.sendMessage(chatId, "✅ Месячный челлендж завершён!", { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Status
    if (command === "/status" && isAdmin) {
      const [daily, weekly, monthly, pollDaily, pollWeekly, pollMonthly] = await Promise.all([
        storage.getChallenge("daily"),
        storage.getChallenge("weekly"),
        storage.getChallenge("monthly"),
        storage.getPoll("daily"),
        storage.getPoll("weekly"),
        storage.getPoll("monthly"),
      ]);

      const formatChallenge = (c, name) => {
        if (!c) return `${name}: ❌ нет`;
        const status = c.status === "active" ? "🟢 активен" : "⚪ завершён";
        const hours = c.status === "active" ? Math.max(0, Math.floor((c.endsAt - Date.now()) / 3600000)) : 0;
        return `${name}: ${status}\n   Тема: "${c.topic}"\n   ${c.status === "active" ? `Осталось: ${hours}ч` : ""}`;
      };

      const statusMsg = `📊 СТАТУС СИСТЕМЫ

🗳️ Опросы:
• Дневной: ${pollDaily ? "✅ есть" : "❌ нет"}
• Недельный: ${pollWeekly ? "✅ есть" : "❌ нет"}
• Месячный: ${pollMonthly ? "✅ есть" : "❌ нет"}

🎯 Челленджи:
${formatChallenge(daily, "• Дневной")}
${formatChallenge(weekly, "• Недельный")}
${formatChallenge(monthly, "• Месячный")}`;

      await tg.sendMessage(chatId, statusMsg, { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Current challenge stats
    if ((command === "/challenge_stats" || command === "/cs") && isAdmin) {
      const [daily, weekly, monthly] = await Promise.all([
        storage.getChallenge("daily"),
        storage.getChallenge("weekly"),
        storage.getChallenge("monthly"),
      ]);

      const formatStats = async (challenge, name) => {
        if (!challenge || challenge.status !== "active") {
          return `${name}: нет активного`;
        }
        const submissions = await storage.getSubmissions(challenge.type, challenge.id);
        if (submissions.length === 0) {
          return `${name}: 0 работ`;
        }
        const sorted = [...submissions].sort((a, b) => b.score - a.score);
        const top = sorted.slice(0, 5).map((s, i) =>
          `   ${i + 1}. @${s.username || s.userId} — ${s.score} ❤️`
        ).join("\n");
        return `${name}: ${submissions.length} работ\n${top}`;
      };

      const [dailyStats, weeklyStats, monthlyStats] = await Promise.all([
        formatStats(daily, "🌅 Дневной"),
        formatStats(weekly, "📅 Недельный"),
        formatStats(monthly, "📆 Месячный"),
      ]);

      await tg.sendMessage(chatId, `📊 СТАТИСТИКА ЧЕЛЛЕНДЖЕЙ\n\n${dailyStats}\n\n${weeklyStats}\n\n${monthlyStats}`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Admin: Test Gemini API
    if (command === "/test_ai" && isAdmin) {
      await tg.sendMessage(chatId, "⏳ Тестирую Gemini API...", { message_thread_id: threadId || undefined });
      try {
        const themes = await generateThemes(env.GEMINI_API_KEY, "daily");
        const isGenerated = themes[0] !== "Кот-астронавт | Пушистый кот в скафандре чинит космический корабль среди звёзд";
        const status = isGenerated ? "✅ AI работает!" : "⚠️ Используются заглушки (AI не ответил)";
        const themesPreview = themes.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join("\n");
        await tg.sendMessage(chatId, `${status}\n\nПримеры тем:\n${themesPreview}`, { message_thread_id: threadId || undefined });
      } catch (e) {
        await tg.sendMessage(chatId, `❌ Ошибка AI: ${e.message}`, { message_thread_id: threadId || undefined });
      }
      return;
    }

    if (text.startsWith("/stats")) {
      const userId = message.from?.id;
      if (!userId) return;

      // Parallel KV reads for better performance
      const [daily, weekly, monthly] = await Promise.all([
        storage.getUserStats("daily", userId),
        storage.getUserStats("weekly", userId),
        storage.getUserStats("monthly", userId),
      ]);
      const total = daily.wins + weekly.wins + monthly.wins;

      const winsWord = pluralize(total, "победа", "победы", "побед");
      await tg.sendMessage(
        chatId,
        `📊 Ваша статистика:\n\n🏆 Всего ${winsWord}: ${total}\n\n📅 Дневные: ${daily.wins} (место #${daily.rank})\n📆 Недельные: ${weekly.wins} (место #${weekly.rank})\n📆 Месячные: ${monthly.wins} (место #${monthly.rank})`,
        { message_thread_id: threadId || undefined },
      );
      return;
    }

    if (text.startsWith("/leaderboard")) {
      // Parse type: /leaderboard weekly, /leaderboard monthly, etc.
      const args = text.trim().split(/\s+/);
      const typeMap = {
        daily: "daily",
        weekly: "weekly",
        monthly: "monthly",
        дневной: "daily",
        недельный: "weekly",
        месячный: "monthly",
        день: "daily",
        неделя: "weekly",
        месяц: "monthly",
      };
      const type = typeMap[args[1]?.toLowerCase()] || "daily";

      const leaderboard = await storage.getLeaderboard(type);
      if (leaderboard.length === 0) {
        await tg.sendMessage(
          chatId,
          `🏆 Рейтинг ${ru.challengeTypes[type]} пока пуст!\n\nУчаствуйте в челленджах и станьте первым победителем! ⭐`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      let msg =
        ru.leaderboardTitle(type) +
        `\n📊 Всего участников: ${leaderboard.length}\n\n`;
      leaderboard.slice(0, 10).forEach((e, i) => {
        const medal = medals[i] || `${i + 1}.`;
        msg += `${medal} ${e.username || `User ${e.userId}`} — ${e.wins} 🏆\n`;
      });

      // Show user's position if not in top 10
      const userId = message.from?.id;
      if (userId) {
        const userIndex = leaderboard.findIndex((e) => e.userId === userId);
        if (userIndex >= 10) {
          msg += `\n📍 Ваше место: #${userIndex + 1} — ${leaderboard[userIndex].wins} 🏆`;
        }
      }

      msg += `\n\n💡 /leaderboard [daily|weekly|monthly]`;

      await tg.sendMessage(chatId, msg, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    if (text.startsWith("/current")) {
      // Parallel KV reads for better performance
      const [daily, weekly, monthly] = await Promise.all([
        storage.getChallenge("daily"),
        storage.getChallenge("weekly"),
        storage.getChallenge("monthly"),
      ]);

      const format = (c, type) => {
        if (!c || c.status !== "active")
          return `${ru.challengeTypes[type]}: Нет активного челленджа`;
        const hours = Math.max(
          0,
          Math.floor((c.endsAt - Date.now()) / 3600000),
        );
        const hoursWord = pluralize(hours, "час", "часа", "часов");
        return `${ru.challengeTypes[type]}:\n   🎨 "${c.topic}"\n   ⏰ Осталось: ${hours} ${hoursWord}`;
      };

      await tg.sendMessage(
        chatId,
        `📋 Текущие челленджи:\n\n${format(daily, "daily")}\n\n${format(weekly, "weekly")}\n\n${format(monthly, "monthly")}`,
        { message_thread_id: threadId || undefined },
      );
      return;
    }

    // Photo submission
    if (
      (message.photo && message.photo.length > 0) ||
      message.document?.mime_type?.startsWith("image/")
    ) {
      if (chatId !== config.chatId) return;

      const challengeType = await storage.isActiveTopic(threadId);
      if (!challengeType) {
        // Not a challenge topic - silently ignore
        return;
      }

      const challenge = await storage.getChallenge(challengeType);
      if (!challenge || challenge.status !== "active") {
        await tg.sendMessage(
          chatId,
          "⚠️ Сейчас нет активного челленджа в этой теме.",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      if (Date.now() > challenge.endsAt) {
        await tg.sendMessage(
          chatId,
          "⏰ Время челленджа истекло! Дождитесь следующего.",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      // Check for duplicate
      const submissions = await storage.getSubmissions(
        challengeType,
        challenge.id,
      );
      if (submissions.some((s) => s.userId === message.from?.id)) {
        await tg.sendMessage(
          chatId,
          "⚠️ Вы уже отправили работу в этот челлендж!",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      await storage.addSubmission(challengeType, challenge.id, {
        messageId: message.message_id,
        userId: message.from?.id,
        username: message.from?.username || message.from?.first_name,
        score: 0,
        timestamp: Date.now(),
      });

      // Confirmation message
      await tg.sendMessage(chatId, "✅ Ваша работа принята! Удачи! 🍀", {
        message_thread_id: threadId || undefined,
        reply_to_message_id: message.message_id,
      });

      console.log(
        `Submission: user=${message.from?.id}, msg=${message.message_id}`,
      );
    }
  } catch (e) {
    console.error("handleMessage error:", { error: e.message, stack: e.stack });
  }
}

async function handleReactionCount(update, env, config, storage) {
  try {
    const reaction = update.message_reaction_count;
    if (!reaction) return;
    if (reaction.chat.id !== config.chatId) return;

    let score = 0;
    for (const r of reaction.reactions) {
      if (r.type.type === "emoji" && r.type.emoji !== EXCLUDED_EMOJI) {
        score += r.total_count;
      } else if (r.type.type === "custom_emoji" || r.type.type === "paid") {
        score += r.total_count;
      }
    }

    // FIX: Only update score for the challenge that owns this message
    // Use thread ID to determine which challenge type this belongs to
    const threadId = reaction.message_thread_id;
    const challengeType = await storage.isActiveTopic(threadId);

    if (challengeType) {
      const challenge = await storage.getChallenge(challengeType);
      if (challenge?.status === "active" && Date.now() < challenge.endsAt) {
        await storage.updateSubmissionScore(
          challengeType,
          challenge.id,
          reaction.message_id,
          score,
        );
      }
    }
  } catch (e) {
    console.error("handleReactionCount error:", {
      error: e.message,
      stack: e.stack,
    });
  }
}

// Handle individual reaction updates (when reaction authors are visible)
async function handleReaction(update, env, config, storage) {
  try {
    const reaction = update.message_reaction;
    if (!reaction) return;
    if (reaction.chat.id !== config.chatId) return;

    const threadId = reaction.message_thread_id;
    const challengeType = await storage.isActiveTopic(threadId);

    if (!challengeType) return;

    const challenge = await storage.getChallenge(challengeType);
    if (!challenge?.status === "active" || Date.now() >= challenge.endsAt) return;

    // Count valid reactions in new_reaction
    let userScore = 0;
    for (const r of reaction.new_reaction || []) {
      if (r.type === "emoji" && r.emoji !== EXCLUDED_EMOJI) {
        userScore += 1;
      } else if (r.type === "custom_emoji" || r.type === "paid") {
        userScore += 1;
      }
    }

    // Store this user's reaction count for this message
    const userId = reaction.user?.id;
    if (!userId) return;

    const reactionsKey = `reactions:${challengeType}:${challenge.id}:${reaction.message_id}`;
    const reactionsMap = (await storage.get(reactionsKey)) || {};
    reactionsMap[userId] = userScore;
    await storage.set(reactionsKey, reactionsMap);

    // Calculate total score from all users
    const totalScore = Object.values(reactionsMap).reduce((sum, s) => sum + s, 0);

    await storage.updateSubmissionScore(
      challengeType,
      challenge.id,
      reaction.message_id,
      totalScore,
    );

    console.log(`Reaction update: msg=${reaction.message_id}, user=${userId}, score=${totalScore}`);
  } catch (e) {
    console.error("handleReaction error:", {
      error: e.message,
      stack: e.stack,
    });
  }
}

// ============================================
// CRON JOBS
// ============================================

async function generatePoll(env, config, tg, storage, type) {
  try {
    const existing = await storage.getPoll(type);
    if (existing) return;

    const topicId = config.topics[type];
    const themesRaw = await generateThemes(env.GEMINI_API_KEY, type);

    // Extract short names for poll, keep full strings for storage
    const shortNames = themesRaw.map((t) => parseTheme(t).short);

    // Validate: need at least 2 options for poll
    if (shortNames.length < 2) {
      console.error(`generatePoll: not enough themes for ${type}`);
      return;
    }

    const poll = await tg.sendPoll(
      config.chatId,
      ru.pollQuestion(type),
      shortNames,
      {
        message_thread_id: topicId || undefined,
        is_anonymous: false,
        allows_multiple_answers: false,
      },
    );

    await storage.savePoll({
      type,
      pollId: poll.poll.id,
      messageId: poll.message_id,
      options: themesRaw, // Store full "short | full" strings
      createdAt: Date.now(),
      topicThreadId: topicId,
    });

    console.log(`Poll created: ${type}`);
  } catch (e) {
    console.error(`generatePoll error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function finishChallenge(env, config, tg, storage, type) {
  try {
    const challenge = await storage.getChallenge(type);
    if (!challenge || challenge.status !== "active") return;

    const submissions = await storage.getSubmissions(type, challenge.id);

    if (submissions.length === 0) {
      await tg.sendMessage(config.chatId, ru.noSubmissions, {
        message_thread_id: challenge.topicThreadId || undefined,
      });
    } else {
      const sorted = [...submissions].sort((a, b) => b.score - a.score);
      const winner = sorted[0];
      const winnerName = winner.username
        ? `@${winner.username}`
        : `Участник #${winner.userId}`;

      await tg.sendMessage(
        config.chatId,
        ru.winnerAnnouncement(winnerName, winner.score, type),
        {
          message_thread_id: challenge.topicThreadId || undefined,
          reply_to_message_id: winner.messageId,
        },
      );

      if (config.topics.winners) {
        try {
          await tg.forwardMessage(
            config.chatId,
            config.chatId,
            winner.messageId,
            {
              message_thread_id: config.topics.winners,
            },
          );
          await tg.sendMessage(
            config.chatId,
            `🏆 Победитель ${ru.challengeTypes[type]} #${challenge.id}\n👤 ${winnerName}\n🎨 Тема: "${challenge.topic}"\n⭐ Реакций: ${winner.score}`,
            { message_thread_id: config.topics.winners },
          );
        } catch (e) {
          console.error("Forward error:", e);
        }
      }

      await storage.addWin(type, winner.userId, winner.username);
    }

    challenge.status = "finished";
    await storage.saveChallenge(challenge);

    const activeTopics = await storage.getActiveTopics();
    delete activeTopics[challenge.topicThreadId];
    await storage.setActiveTopics(activeTopics);
  } catch (e) {
    console.error(`finishChallenge error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function startChallenge(env, config, tg, storage, type) {
  try {
    await finishChallenge(env, config, tg, storage, type);

    const poll = await storage.getPoll(type);
    let shortTheme = "Свободная тема";
    let fullTheme =
      "Свободная тема — создайте что угодно, дайте волю фантазии!";

    if (poll) {
      try {
        const stopped = await tg.stopPoll(config.chatId, poll.messageId);
        let maxVotes = 0;
        let winnerShort = "";

        // Find winner by short name (that's what's in poll options)
        for (const opt of stopped.options) {
          if (opt.voter_count > maxVotes) {
            maxVotes = opt.voter_count;
            winnerShort = opt.text;
          }
        }

        // Find matching full theme from stored options
        const matchingFull = poll.options.find(
          (o) => parseTheme(o).short === winnerShort,
        );
        if (matchingFull) {
          const parsed = parseTheme(matchingFull);
          shortTheme = parsed.short;
          fullTheme = parsed.full;
        } else if (winnerShort) {
          shortTheme = winnerShort;
          fullTheme = winnerShort;
        }
      } catch (e) {
        console.error("Poll stop error:", e);
        // Fallback to first option (with safety check)
        if (poll.options && poll.options.length > 0) {
          const parsed = parseTheme(poll.options[0]);
          shortTheme = parsed.short;
          fullTheme = parsed.full;
        }
      }
      await storage.deletePoll(type);
    }

    const topicId = config.topics[type];
    const MS_PER_HOUR = 3600000;
    const durations = {
      daily: 24 * MS_PER_HOUR,
      weekly: 7 * 24 * MS_PER_HOUR,
      monthly: 28 * 24 * MS_PER_HOUR,
    };
    const endsAt = Date.now() + durations[type];

    const endDate = new Date(endsAt);
    const endTimeStr = endDate.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const challengeId = await storage.getNextChallengeId(type);

    // Use full description in announcement
    const announcement = await tg.sendMessage(
      config.chatId,
      ru.challengeAnnouncement(type, fullTheme, endTimeStr),
      {
        message_thread_id: topicId || undefined,
      },
    );

    // Store short theme for leaderboard/stats display
    await storage.saveChallenge({
      id: challengeId,
      type,
      topic: shortTheme,
      topicFull: fullTheme,
      status: "active",
      startedAt: Date.now(),
      endsAt,
      topicThreadId: topicId,
      announcementMessageId: announcement.message_id,
    });

    const activeTopics = await storage.getActiveTopics();
    activeTopics[topicId] = type;
    await storage.setActiveTopics(activeTopics);

    console.log(`Challenge started: ${type} #${challengeId} - "${shortTheme}"`);
  } catch (e) {
    console.error(`startChallenge error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function handleCron(env, config, tg, storage, cron) {
  try {
    const [, hour, day, , weekday] = cron.split(" ");
    const h = parseInt(hour, 10);
    const d = parseInt(day, 10);
    const w = parseInt(weekday, 10);

    console.log(`Cron: ${cron}`);

    // Daily: poll at 05:00, challenge at 17:00
    if (h === 5 && day === "*" && weekday === "*") {
      await generatePoll(env, config, tg, storage, "daily");
    } else if (h === 17 && day === "*" && weekday === "*") {
      await startChallenge(env, config, tg, storage, "daily");
    }
    // Weekly: poll Saturday 10:00, challenge Sunday 17:00
    else if (h === 10 && w === 6) {
      await generatePoll(env, config, tg, storage, "weekly");
    } else if (h === 17 && w === 0) {
      await startChallenge(env, config, tg, storage, "weekly");
    }
    // Monthly: poll 28th 10:00, challenge 1st 17:00
    else if (h === 10 && d === 28) {
      await generatePoll(env, config, tg, storage, "monthly");
    } else if (h === 17 && d === 1) {
      await startChallenge(env, config, tg, storage, "monthly");
    }
  } catch (e) {
    console.error("handleCron error:", {
      error: e.message,
      stack: e.stack,
      cron,
    });
  }
}

// ============================================
// MAIN HANDLER
// ============================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          bot: "TG Challenge Bot",
          version: "1.8.2",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Setup webhook (protected with ADMIN_SECRET)
    if (url.pathname === "/setup") {
      try {
        // Check authorization
        const authHeader = request.headers.get("Authorization");
        if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!env.BOT_TOKEN) {
          return new Response(
            JSON.stringify({ error: "BOT_TOKEN not configured" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const tg = new TelegramAPI(env.BOT_TOKEN);
        const webhookUrl = `${url.origin}/webhook`;
        await tg.setWebhook(webhookUrl, env.WEBHOOK_SECRET || null);

        return new Response(
          JSON.stringify({ success: true, webhook: webhookUrl }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        console.error("Setup error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ============================================
    // ADMIN ENDPOINTS (для тестирования)
    // ============================================

    // POST /admin/poll/daily|weekly|monthly - создать опрос
    if (url.pathname.startsWith("/admin/poll/") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const type = url.pathname.split("/").pop();
      if (!["daily", "weekly", "monthly"].includes(type)) {
        return new Response(JSON.stringify({ error: "Invalid type. Use: daily, weekly, monthly" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const config = getConfig(env);
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        // Delete existing poll if any
        await storage.deletePoll(type);
        await generatePoll(env, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "poll", type }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /admin/start/daily|weekly|monthly - запустить челлендж
    if (url.pathname.startsWith("/admin/start/") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const type = url.pathname.split("/").pop();
      if (!["daily", "weekly", "monthly"].includes(type)) {
        return new Response(JSON.stringify({ error: "Invalid type. Use: daily, weekly, monthly" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const config = getConfig(env);
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        await startChallenge(env, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "start", type }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /admin/finish/daily|weekly|monthly - завершить челлендж
    if (url.pathname.startsWith("/admin/finish/") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const type = url.pathname.split("/").pop();
      if (!["daily", "weekly", "monthly"].includes(type)) {
        return new Response(JSON.stringify({ error: "Invalid type. Use: daily, weekly, monthly" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const config = getConfig(env);
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        await finishChallenge(env, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "finish", type }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // GET /admin/status - посмотреть текущее состояние
    if (url.pathname === "/admin/status") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const storage = new Storage(env.CHALLENGE_KV);
        const [daily, weekly, monthly, pollDaily, pollWeekly, pollMonthly, activeTopics] = await Promise.all([
          storage.getChallenge("daily"),
          storage.getChallenge("weekly"),
          storage.getChallenge("monthly"),
          storage.getPoll("daily"),
          storage.getPoll("weekly"),
          storage.getPoll("monthly"),
          storage.getActiveTopics(),
        ]);

        return new Response(JSON.stringify({
          challenges: { daily, weekly, monthly },
          polls: { daily: !!pollDaily, weekly: !!pollWeekly, monthly: !!pollMonthly },
          activeTopics,
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Info (protected with ADMIN_SECRET)
    if (url.pathname === "/info") {
      try {
        const authHeader = request.headers.get("Authorization");
        if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const config = getConfig(env);
        return new Response(
          JSON.stringify({
            configured: !!env.BOT_TOKEN,
            chat_id: config.chatId,
            topics: config.topics,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (e) {
        console.error("Info error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Webhook
    if (url.pathname === "/webhook" && request.method === "POST") {
      // Verify webhook secret if configured
      if (env.WEBHOOK_SECRET) {
        const secretHeader = request.headers.get(
          "X-Telegram-Bot-Api-Secret-Token",
        );
        if (secretHeader !== env.WEBHOOK_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }
      }

      try {
        const update = await request.json();

        // Webhook deduplication - prevent processing duplicate updates
        if (update.update_id) {
          const dedupKey = `webhook:processed:${update.update_id}`;
          const alreadyProcessed = await env.CHALLENGE_KV.get(dedupKey);
          if (alreadyProcessed) {
            console.log(`Skipping duplicate update ${update.update_id}`);
            return new Response("OK");
          }
          // Mark as processed (TTL: 1 hour)
          await env.CHALLENGE_KV.put(dedupKey, "1", { expirationTtl: 3600 });
        }

        const config = getConfig(env);
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        if (update.message) {
          await handleMessage(update, env, config, tg, storage);
        } else if (update.message_reaction) {
          await handleReaction(update, env, config, storage);
        } else if (update.message_reaction_count) {
          await handleReactionCount(update, env, config, storage);
        }
      } catch (e) {
        console.error("Webhook error:", {
          error: e.message,
          stack: e.stack,
        });
      }

      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env) {
    try {
      if (!env.BOT_TOKEN || !env.CHAT_ID) {
        console.error("Scheduled job skipped: missing BOT_TOKEN or CHAT_ID");
        return;
      }

      const config = getConfig(env);
      const tg = new TelegramAPI(env.BOT_TOKEN);
      const storage = new Storage(env.CHALLENGE_KV);

      await handleCron(env, config, tg, storage, event.cron);
    } catch (e) {
      console.error("Scheduled job error:", {
        error: e.message,
        stack: e.stack,
        cron: event.cron,
        scheduledTime: event.scheduledTime,
      });
    }
  },
};
