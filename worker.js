// ============================================
// TG CHALLENGE BOT - Multi-Community Version
// Поддержка до 10 сообществ в одном воркере
// ============================================

// Эмодзи-исключение (негативная реакция)
const EXCLUDED_EMOJI = "🌚";

// Максимальное количество сообществ
const MAX_COMMUNITIES = 10;

// Режимы контента для генерации тем
const CONTENT_MODES = {
  vanilla: { name: "🍦 Vanilla", description: "Безопасный контент для всех возрастов" },
  medium: { name: "🔥 Medium", description: "Взрослые темы без откровенного контента (16+)" },
  nsfw: { name: "🌙 Mature", description: "Художественная эротика для сообществ 21+" },
};
const DEFAULT_CONTENT_MODE = "vanilla";

// Минимум реакций для принятия предложения темы (по умолчанию)
const DEFAULT_MIN_SUGGESTION_REACTIONS = 3;

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
    return `Голосование за тему ${labels[type]} челленджа`;
  },
  challengeAnnouncement: (type, topic, startDate, endDate, voteCount = 0) => {
    const labels = {
      daily: "ЧЕЛЛЕНДЖ ДНЯ",
      weekly: "ЧЕЛЛЕНДЖ НЕДЕЛИ",
      monthly: "ЧЕЛЛЕНДЖ МЕСЯЦА",
    };
    const voteLine = voteCount > 0 ? ` (${voteCount} голосов)` : "";
    return `${labels[type]}
${startDate} — ${endDate}

Тема: ${topic}${voteLine}

Отправьте изображение в эту тему для участия.
Лучшая работа определяется по реакциям.
Реакция 🌚 не учитывается`;
  },
  // Extended winner announcement with full prompt for winners topic
  winnerAnnouncementFull: (username, score, type, topicFull) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    // Parse "Title | Description" format
    const parts = topicFull.split("|").map((s) => s.trim());
    const title = parts[0] || topicFull;
    const description = parts[1] || "";

    return `🏆 Победитель ${labels[type]} челленджа

${username} — ${score} реакций

${title}${description ? `\n📝 ${description}` : ""}`;
  },
  winnerAnnouncement: (username, score, type) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    return `🏆 Победитель ${labels[type]} челленджа

${username} — ${score} реакций

Поздравляем!`;
  },
  noSubmissions: "В этом челлендже не было участников.",
  leaderboardTitle: (type) => {
    const labels = {
      daily: "дневных",
      weekly: "недельных",
      monthly: "месячных",
    };
    return `Топ-10 победителей ${labels[type]} челленджей`;
  },
  helpMessage: (schedule) => {
    const fmt = formatSchedule(schedule);
    return `Бот для нейро-арт челленджей

Как участвовать:
1. Дождитесь объявления темы
2. Отправьте изображение в тему челленджа
3. Ставьте реакции работам других участников
4. Побеждает работа с наибольшим числом реакций

Расписание:
• Дневные — ${fmt.daily}
• Недельные — ${fmt.weekly}
• Месячные — ${fmt.monthly}

Реакция 🌚 не учитывается

Команды:
/current — активные челленджи
/stats — ваша статистика
/leaderboard — топ победителей
/suggest — предложить тему
/suggestions — список предложений`;
  },
};

// ============================================
// КОНФИГУРАЦИЯ (MULTI-COMMUNITY)
// ============================================

// Глобальные настройки из env (не привязаны к сообществу)
function getGlobalConfig(env) {
  return {
    timezoneOffset: parseInt(env.TIMEZONE_OFFSET, 10) || 0,
    language: env.BOT_LANGUAGE || "ru",
  };
}

// ============================================
// УПРАВЛЕНИЕ СООБЩЕСТВАМИ
// ============================================

// Получить список всех зарегистрированных сообществ
async function getCommunities(storage) {
  return (await storage.get("communities:list")) || {};
}

// Проверить, зарегистрировано ли сообщество
async function isCommunityRegistered(storage, chatId) {
  const communities = await getCommunities(storage);
  return !!communities[String(chatId)];
}

// Добавить сообщество
async function addCommunity(storage, chatId, name = null) {
  const communities = await getCommunities(storage);
  const count = Object.keys(communities).length;

  if (count >= MAX_COMMUNITIES) {
    return { success: false, error: `Достигнут лимит сообществ (${MAX_COMMUNITIES})` };
  }

  if (communities[String(chatId)]) {
    return { success: false, error: "Сообщество уже зарегистрировано" };
  }

  communities[String(chatId)] = {
    chatId: chatId,
    name: name || `Community ${chatId}`,
    addedAt: Date.now(),
  };

  await storage.set("communities:list", communities);
  return { success: true, count: count + 1 };
}

// Удалить сообщество
async function removeCommunity(storage, chatId) {
  const communities = await getCommunities(storage);

  if (!communities[String(chatId)]) {
    return { success: false, error: "Сообщество не найдено" };
  }

  delete communities[String(chatId)];
  await storage.set("communities:list", communities);
  return { success: true };
}

// Получить конфиг для конкретного сообщества
async function getCommunityConfig(storage, chatId) {
  const communities = await getCommunities(storage);
  const community = communities[String(chatId)];

  if (!community) {
    return null;
  }

  // Загружаем настройки топиков для этого сообщества
  const topics = (await storage.get(`community:${chatId}:settings:topics`)) || {
    daily: 0,
    weekly: 0,
    monthly: 0,
    winners: 0,
  };

  return {
    chatId: chatId,
    name: community.name,
    topics: topics,
  };
}

// Обновить настройки топиков для сообщества
async function setCommunityTopics(storage, chatId, topics) {
  await storage.set(`community:${chatId}:settings:topics`, topics);
}

// Legacy: получить конфиг из env (для обратной совместимости)
function getLegacyConfig(env) {
  const chatId = parseInt(env.CHAT_ID, 10) || 0;
  if (!chatId) return null;

  return {
    chatId: chatId,
    topics: {
      daily: parseInt(env.TOPIC_DAILY, 10) || 0,
      weekly: parseInt(env.TOPIC_WEEKLY, 10) || 0,
      monthly: parseInt(env.TOPIC_MONTHLY, 10) || 0,
      winners: parseInt(env.TOPIC_WINNERS, 10) || 0,
    },
  };
}

// Получить конфиг для сообщества (с fallback на legacy env)
async function getConfigForChat(env, storage, chatId) {
  // Сначала пробуем KV
  const communityConfig = await getCommunityConfig(storage, chatId);
  if (communityConfig) {
    return {
      ...getGlobalConfig(env),
      ...communityConfig,
    };
  }

  // Fallback на legacy env config
  const legacyConfig = getLegacyConfig(env);
  if (legacyConfig && legacyConfig.chatId === chatId) {
    return {
      ...getGlobalConfig(env),
      ...legacyConfig,
    };
  }

  return null;
}

// Проверить доступ к сообществу (зарегистрировано или legacy)
async function hasAccessToChat(env, storage, chatId) {
  // Проверяем KV
  if (await isCommunityRegistered(storage, chatId)) {
    return true;
  }

  // Проверяем legacy env
  const legacyConfig = getLegacyConfig(env);
  if (legacyConfig && legacyConfig.chatId === chatId) {
    return true;
  }

  return false;
}

// Получить все активные сообщества (для cron)
async function getAllActiveCommunities(env, storage) {
  const result = [];

  // Добавляем из KV
  const communities = await getCommunities(storage);
  for (const chatId of Object.keys(communities)) {
    const config = await getConfigForChat(env, storage, parseInt(chatId, 10));
    if (config) {
      result.push(config);
    }
  }

  // Добавляем legacy если не дублируется
  const legacyConfig = getLegacyConfig(env);
  if (legacyConfig && legacyConfig.chatId && !communities[String(legacyConfig.chatId)]) {
    result.push({
      ...getGlobalConfig(env),
      ...legacyConfig,
    });
  }

  return result;
}

// Default schedule settings
const defaultSchedule = {
  daily: { pollHour: 5, challengeHour: 17 },
  weekly: { pollDay: 6, pollHour: 10, challengeDay: 0, challengeHour: 17 }, // Sat/Sun
  monthly: { pollDay: 28, pollHour: 10, challengeDay: 1, challengeHour: 17 },
};

// Get schedule from KV or defaults (per-community)
async function getSchedule(storage, chatId = null) {
  const key = chatId ? `community:${chatId}:settings:schedule` : "settings:schedule";
  const kvSchedule = await storage.get(key);
  return {
    daily: { ...defaultSchedule.daily, ...kvSchedule?.daily },
    weekly: { ...defaultSchedule.weekly, ...kvSchedule?.weekly },
    monthly: { ...defaultSchedule.monthly, ...kvSchedule?.monthly },
  };
}

// Set schedule for community
async function setSchedule(storage, chatId, schedule) {
  const key = chatId ? `community:${chatId}:settings:schedule` : "settings:schedule";
  await storage.set(key, schedule);
}

// Format schedule for display
function formatSchedule(schedule) {
  const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const formatHour = (h) => `${h}:00`;

  const daily = `каждый день в ${formatHour(schedule.daily.challengeHour)}`;
  const weekly = `${dayNames[schedule.weekly.challengeDay]} в ${formatHour(schedule.weekly.challengeHour)}`;
  const monthly = `${schedule.monthly.challengeDay}-го числа в ${formatHour(schedule.monthly.challengeHour)}`;

  return { daily, weekly, monthly };
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

  async pinChatMessage(chatId, messageId, disableNotification = true) {
    return this.request("pinChatMessage", {
      chat_id: chatId,
      message_id: messageId,
      disable_notification: disableNotification,
    });
  }

  async unpinChatMessage(chatId, messageId) {
    return this.request("unpinChatMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
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

  // Helper to build community-prefixed key
  _key(chatId, ...parts) {
    return `community:${chatId}:${parts.join(":")}`;
  }

  // Challenge (per-community)
  async getChallenge(chatId, type) {
    return this.get(this._key(chatId, "challenge", type));
  }

  async saveChallenge(chatId, challenge) {
    await this.set(this._key(chatId, "challenge", challenge.type), challenge);
  }

  async getNextChallengeId(chatId, type) {
    // Use timestamp-based ID to avoid race conditions
    // Format: YYYYMMDD + random suffix (chatId reserved for future per-community sequences)
    const now = new Date();
    const datePrefix = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const randomSuffix = Math.floor(Math.random() * 1000);
    return datePrefix * 1000 + randomSuffix;
  }

  // Poll (per-community)
  async getPoll(chatId, type) {
    return this.get(this._key(chatId, "poll", type));
  }

  async savePoll(chatId, poll) {
    await this.set(this._key(chatId, "poll", poll.type), poll);
  }

  async deletePoll(chatId, type) {
    await this.delete(this._key(chatId, "poll", type));
  }

  // Submissions (per-community)
  async getSubmissions(chatId, type, challengeId) {
    return (await this.get(this._key(chatId, "submissions", type, challengeId))) || [];
  }

  async addSubmission(chatId, type, challengeId, submission) {
    const submissions = await this.getSubmissions(chatId, type, challengeId);
    // Check both messageId (duplicate request) and userId (one submission per user)
    if (submissions.some((s) => s.messageId === submission.messageId || s.userId === submission.userId)) {
      return false; // Already exists
    }
    submissions.push(submission);
    await this.set(this._key(chatId, "submissions", type, challengeId), submissions);
    return true; // Successfully added
  }

  async updateSubmissionScore(chatId, type, challengeId, messageId, score) {
    const submissions = await this.getSubmissions(chatId, type, challengeId);
    const submission = submissions.find((s) => s.messageId === messageId);
    if (submission) {
      submission.score = score;
      await this.set(this._key(chatId, "submissions", type, challengeId), submissions);
    }
  }

  // Leaderboard (per-community)
  async getLeaderboard(chatId, type) {
    const map = (await this.get(this._key(chatId, "leaderboard", type))) || {};
    return Object.values(map).sort((a, b) => b.wins - a.wins);
  }

  async addWin(chatId, type, userId, username) {
    const map = (await this.get(this._key(chatId, "leaderboard", type))) || {};
    const key = String(userId);
    if (!map[key]) {
      map[key] = { userId, username, wins: 0 };
    }
    map[key].wins += 1;
    map[key].lastWin = Date.now();
    if (username) map[key].username = username;
    await this.set(this._key(chatId, "leaderboard", type), map);
  }

  async getUserStats(chatId, type, userId) {
    const leaderboard = await this.getLeaderboard(chatId, type);
    const index = leaderboard.findIndex((e) => e.userId === userId);
    if (index === -1) return { wins: 0, rank: leaderboard.length + 1 };
    return { wins: leaderboard[index].wins, rank: index + 1 };
  }

  // Active topics (per-community)
  async getActiveTopics(chatId) {
    return (await this.get(this._key(chatId, "active_topics"))) || {};
  }

  async setActiveTopics(chatId, topics) {
    await this.set(this._key(chatId, "active_topics"), topics);
  }

  async isActiveTopic(chatId, threadId) {
    const topics = await this.getActiveTopics(chatId);
    return topics[threadId] || null;
  }

  // Theme history (per-community, to avoid repetition)
  async getThemeHistory(chatId, type) {
    return (await this.get(this._key(chatId, "theme_history", type))) || [];
  }

  async addThemeToHistory(chatId, type, theme) {
    const history = await this.getThemeHistory(chatId, type);
    history.unshift(theme);
    // Keep only last 10 themes
    await this.set(this._key(chatId, "theme_history", type), history.slice(0, 10));
  }

  // Content mode (per-community)
  async getContentMode(chatId) {
    return (await this.get(this._key(chatId, "settings", "content_mode"))) || DEFAULT_CONTENT_MODE;
  }

  async setContentMode(chatId, mode) {
    await this.set(this._key(chatId, "settings", "content_mode"), mode);
  }

  // Reactions (per-community)
  async getReactions(chatId, challengeType, challengeId, messageId) {
    return (await this.get(this._key(chatId, "reactions", challengeType, challengeId, messageId))) || {};
  }

  async setReactions(chatId, challengeType, challengeId, messageId, reactionsMap) {
    await this.set(this._key(chatId, "reactions", challengeType, challengeId, messageId), reactionsMap);
  }

  // ============================================
  // SUGGESTIONS (предложения тем от пользователей)
  // ============================================

  // Получить все предложения для типа челленджа
  async getSuggestions(chatId, type) {
    return (await this.get(this._key(chatId, "suggestions", type))) || [];
  }

  // Добавить новое предложение
  async addSuggestion(chatId, type, suggestion) {
    const suggestions = await this.getSuggestions(chatId, type);
    // Один пользователь - одно предложение на текущий цикл
    if (suggestions.some((s) => s.userId === suggestion.userId)) {
      return { success: false, error: "already_suggested" };
    }
    suggestions.push(suggestion);
    await this.set(this._key(chatId, "suggestions", type), suggestions);
    return { success: true };
  }

  // Обновить реакции на предложение
  async updateSuggestionReactions(chatId, type, messageId, userId, hasReaction) {
    const suggestions = await this.getSuggestions(chatId, type);
    const suggestion = suggestions.find((s) => s.messageId === messageId);
    if (!suggestion) return null;

    // Инициализация если нет
    if (!suggestion.reactions) suggestion.reactions = {};

    // Обновляем реакцию пользователя
    if (hasReaction) {
      suggestion.reactions[String(userId)] = 1;
    } else {
      delete suggestion.reactions[String(userId)];
    }

    // Пересчет уникальных реакций
    suggestion.reactionCount = Object.keys(suggestion.reactions).length;

    await this.set(this._key(chatId, "suggestions", type), suggestions);
    return suggestion;
  }

  // Получить предложения с достаточным количеством реакций
  async getApprovedSuggestions(chatId, type, minReactions = 3) {
    const suggestions = await this.getSuggestions(chatId, type);
    return suggestions.filter((s) => (s.reactionCount || 0) >= minReactions);
  }

  // Очистить предложения после использования
  async clearSuggestions(chatId, type) {
    await this.delete(this._key(chatId, "suggestions", type));
  }

  // Минимум реакций для принятия предложения (per-community)
  async getMinSuggestionReactions(chatId) {
    const value = await this.get(this._key(chatId, "settings", "min_suggestion_reactions"));
    return value ?? DEFAULT_MIN_SUGGESTION_REACTIONS;
  }

  async setMinSuggestionReactions(chatId, count) {
    await this.set(this._key(chatId, "settings", "min_suggestion_reactions"), count);
  }

  // Найти предложение по messageId
  async findSuggestionByMessageId(chatId, messageId) {
    for (const type of ["daily", "weekly", "monthly"]) {
      const suggestions = await this.getSuggestions(chatId, type);
      const suggestion = suggestions.find((s) => s.messageId === messageId);
      if (suggestion) {
        return { suggestion, type };
      }
    }
    return null;
  }
}

// ============================================
// AI SERVICE (Gemini)
// ============================================

async function generateThemes(apiKey, type, language = "ru", previousThemes = [], contentMode = "vanilla") {
  // Format: "Короткое название | Полное описание"
  // Short name for poll (2-3 words), full description for announcement

  const previousThemesNote = previousThemes.length > 0
    ? `- НЕ повторяй эти темы (уже использованы): ${previousThemes.join(", ")}`
    : "";

  // ========== VANILLA MODE (safe for all ages) ==========
  const vanillaPrompts = {
    daily: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕДНЕВНОГО челленджа. Это лёгкие, весёлые темы на 5-15 минут генерации.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (3-4 предложения) — детали, атмосфера, настроение, что именно изобразить, какие элементы включить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- Тема должна вдохновлять на ВИЗУАЛЬНЫЙ образ
- ОБЯЗАТЕЛЬНО включай темы с отсылками к: фильмам, сериалам, аниме, играм, мемам, поп-культуре
- Разнообразие: реализм, фэнтези, абстракция, юмор, sci-fi, природа, киберпанк, Studio Ghibli, Marvel/DC
- Темы НЕ должны требовать сложных композиций
- Избегай: политики, религии, насилия, эротики
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 3-4 предложений
</format>

<examples_for_format_only>
ЭТО ПРИМЕРЫ ТОЛЬКО ДЛЯ ПОНИМАНИЯ ФОРМАТА И СТИЛЯ! НЕ КОПИРУЙ ИХ!
Придумай 6 ПОЛНОСТЬЮ НОВЫХ тем, комбинируя разные вселенные, жанры и идеи.

Дарт Вейдер готовит романтический ужин для Падме | Тёмный лорд ситхов на кухне в фартуке с надписью "Лучший повар Галактики". Свечи, красное вино и лазанья на столе. За окном звёздный разрушитель. Атмосфера уюта и лёгкой абсурдности.
Покемон Пикачу ведёт лекцию по электродинамике | Жёлтый покемон у доски с формулами в профессорских очках. Студенты — другие покемоны — записывают конспекты. Аудитория в стиле Гарварда. Молнии вместо указки.
Шрек открыл кофейню на своём болоте | Уютное кафе из брёвен посреди зелёного болота. Осёл-бариста готовит латте, Фиона украшает торты. Гости — сказочные персонажи. Меню написано на деревянной доске мелом.
</examples_for_format_only>`,

    weekly: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕНЕДЕЛЬНОГО челленджа. Это темы средней сложности, требующие экспериментов со стилями и деталями.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (3-4 предложения) — детали, атмосфера, настроение, стиль, что изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- ОБЯЗАТЕЛЬНО включай отсылки к: культовым фильмам, аниме, играм, сериалам, книгам
- Мэшапы и кроссоверы приветствуются: смешивай вселенные и жанры
- Разнообразие: сюжетные, атмосферные, стилизованные, концептуальные темы
- Избегай: политики, религии, насилия, эротики
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 3-4 предложений
</format>

<examples_for_format_only>
НЕ КОПИРУЙ примеры! Придумай НОВЫЕ темы, комбинируя другие вселенные и жанры.

Геральт из Ривии расследует дело о проклятии в неоновом Токио | Ведьмак в киберпанк-городе среди неоновых вывесок и летающих машин. Серебряный меч против корпоративных духов. Йеннифэр — хакер в чёрном кожаном плаще. Атмосфера Blade Runner встречает Ведьмака.
Саурон создаёт армию боевых дроидов в стиле Star Wars | Мордор превращается в гигантскую дроидную фабрику. Вместо орков — ряды дроидов с красными глазами. Око Саурона как голограмма над звездой смерти. Назгулы на TIE-истребителях.
Мир Пандоры в стиле аниме Studio Ghibli | Пушистые версии банши с добрыми глазами. Джейк Салли среди духов леса. Мягкие тёплые тона вместо неона. Тоторо мог бы там жить.
</examples_for_format_only>`,

    monthly: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников), которые создают арт с помощью Midjourney, Stable Diffusion, DALL-E, Flux и других AI-инструментов.
</role>

<task>
Придумай 6 тем для ЕЖЕМЕСЯЧНОГО челленджа. Это АМБИЦИОЗНЫЕ темы, настоящий вызов мастерству.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (4-5 предложений) — детали, философия, атмосфера, стиль, что изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- Тема должна быть ГЛУБОКОЙ — философской, концептуальной или технически сложной
- Приветствуются: метафоры, парадоксы, кроссоверы вселенных
- Можно использовать отсылки к культовым произведениям для создания глубоких концепций
- Это должна быть тема для портфолио
- Избегай: политики, религии, насилия, эротики
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 4-5 предложений
</format>

<examples_for_format_only>
НЕ ИСПОЛЬЗУЙ эти примеры! Создай ОРИГИНАЛЬНЫЕ концепции с другими персонажами и идеями.

Наши воспоминания — это глитчи в Матрице | Визуализация момента, когда персонаж осознаёт, что его детство — загруженная программа. Эстетика киберпанка встречает тёплые семейные фото. Пиксели распадаются на границе между "реальным" и "загруженным". Ностальгия, смешанная с ужасом осознания. Цветовая палитра: тёплые тона воспоминаний против холодного неона кода.
Финальный босс за минуту до битвы с героем | Трагический персонаж на вершине своего пути. Его история, мотивация, одиночество в пустом тронном зале. Эпическая атмосфера, но с оттенком меланхолии. Детали: трещины в доспехах, старые раны, портрет семьи на стене. Мы видим злодея, который когда-то был человеком.
Космическая одиссея в стиле Хаяо Миядзаки | Чёрные дыры как врата в мир духов. Научная фантастика через призму японской мифологии. Космонавты в скафандрах встречают духов леса среди звёзд. Тёплые тона и мягкие формы вместо холодного металла. Тоторо мог бы быть межгалактическим путешественником.
</examples_for_format_only>`,
  };

  // ========== MEDIUM MODE (mature themes, 16+) ==========
  const mediumPrompts = {
    daily: `<role>
Ты — креативный директор сообщества нейро-художников (2000+ участников). Аудитория — взрослые люди 16+.
</role>

<task>
Придумай 6 тем для ЕЖЕДНЕВНОГО челленджа. Лёгкие темы на 5-15 минут, но для взрослой аудитории.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (3-4 предложения) — детали, атмосфера, настроение, что именно изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- МОЖНО: мрачные темы, чёрный юмор, готика, хоррор-эстетика, драма, нуар
- МОЖНО: романтика, страсть, напряжение между персонажами (но без откровенности)
- ОБЯЗАТЕЛЬНО: отсылки к культовым фильмам, играм, аниме (в том числе взрослым)
- НЕЛЬЗЯ: эротика, обнажёнка, политика, религия
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Короткое название | Полное описание
</format>

<examples_for_format_only>
НЕ ПОВТОРЯЙ примеры! Придумай СВОИ темы в похожем духе, но с другими идеями.

Femme Fatale | Роковая женщина в стиле нуар 40-х — сигаретный дым, красная помада, опасный взгляд
Ганнибал готовит | Доктор Лектер за приготовлением изысканного ужина — элегантность и угроза в каждой детали
Вампирский Тиндер | Как выглядит профиль на сайте знакомств для бессмертных существ ночи
Похмелье Бога | Божество после эпической вечеринки на Олимпе — даже всемогущие иногда перебирают
Ведьма в метро | Современная ведьма по дороге на работу — чёрная кошка в сумке, зелье в термосе
Последнее свидание | Романтический ужин на крыше во время конца света — любовь сильнее апокалипсиса
</examples_for_format_only>`,

    weekly: `<role>
Ты — креативный директор сообщества нейро-художников. Аудитория 16+, любит глубокие и провокационные темы.
</role>

<task>
Придумай 6 тем для ЕЖЕНЕДЕЛЬНОГО челленджа. Темы средней сложности для взрослой аудитории.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (3-4 предложения) — детали, атмосфера, настроение, стиль, что изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- МОЖНО: психологический хоррор, мрачная эстетика, готика, триллер, драма
- МОЖНО: романтическое напряжение, страстные (но не откровенные) сцены, роковые красавицы/красавцы
- ПРИВЕТСТВУЮТСЯ: отсылки к культовым R-rated фильмам, взрослым аниме, мрачным играм
- НЕЛЬЗЯ: эротика, политика, религия
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 3-4 предложений
</format>

<examples_for_format_only>
Примеры для понимания стиля. СОЗДАЙ НОВЫЕ темы с другими персонажами и сюжетами!

Тайлер Дёрден создаёт свой Бойцовский клуб в мире нейро-арта | Первое правило — никому не рассказывать о клубе. Художники в подвале генерируют хаос и свободу. Мыло из корпоративных логотипов. Визуализация бунта против системы.
Ангелы и святые устроили вечеринку в казино Лас-Вегаса | Рай, который выглядит как греховный город. Ангелы-крупье раздают карты, святые у барной стойки. Неоновые нимбы мигают как рекламные вывески. Небесная вечеринка с земными пороками.
Элегантная убийца на светском приёме скрывает кровь на перчатках | Женщина в вечернем платье среди гостей. Никто не замечает красные пятна на белых перчатках. Хрустальная люстра, шампанское, идеальная улыбка. Смерть среди роскоши.
</examples_for_format_only>`,

    monthly: `<role>
Ты — креативный директор сообщества нейро-художников. Аудитория 16+ ценит глубокие, провокационные концепции.
</role>

<task>
Придумай 6 тем для ЕЖЕМЕСЯЧНОГО челленджа. АМБИЦИОЗНЫЕ темы для взрослой аудитории.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает идею, сразу понятно о чём тема
  2. ОПИСАНИЕ (4-5 предложений) — детали, философия, атмосфера, что изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает всю идею
- Тема должна быть ГЛУБОКОЙ, провокационной, философской
- МОЖНО: тёмные темы, экзистенциальный ужас, сложные эмоции, страсть и одержимость
- МОЖНО: красота в ужасном, романтизация тьмы, психологические глубины
- НЕЛЬЗЯ: откровенная эротика, политика, религия
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 4-5 предложений
</format>

<examples_for_format_only>
НЕ КОПИРУЙ! Это образцы формата. Придумай УНИКАЛЬНЫЕ провокационные концепции.

Семь смертных грехов стали обычными людьми в современном мегаполисе | Визуализация грехов как наших соседей и коллег. Гордыня листает лайки в инстаграме, похоть рекламирует парфюм, чревоугодие доставляет фастфуд. Они живут среди нас и выглядят респектабельно. Найди грех в зеркале.
Монстры заслуживают свадебных портретов и семейных фото | Традиционно уродливые создания показаны с нежностью и любовью. Элегантность ксеноморфа в смокинге, грация демона с букетом, оборотень нежно обнимает детей. Красота в тех, кого принято бояться.
Двое влюблённых как химические элементы создают красивый яд вместе | Токсичные отношения как формула. Порознь они стабильны, вместе — смертельная реакция. Красота взрыва, неизбежность катастрофы. Любовь как химический эксперимент с известным результатом.
</examples_for_format_only>`,
  };

  // ========== NSFW MODE (artistic erotica, 21+) ==========
  const nsfwPrompts = {
    daily: `<role>
Ты — арт-директор сообщества художников, создающих художественную эротику и пин-ап арт для аудитории 21+.
</role>

<task>
Придумай 6 тем для ЕЖЕДНЕВНОГО челленджа. Лёгкие, игривые темы на красивую эротику.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает образ или ситуацию
  2. ОПИСАНИЕ (3-4 предложения) — детали образа, атмосфера, что именно изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает идею
- Фокус на ЭСТЕТИКЕ, СОБЛАЗНЕ и красоте тела
- МИКСУЙ классику и современность: ню-арт, pin-up, гламур, будуар-фото
- МОЖНО: ролевые образы (медсестра, секретарша, горничная, учительница, стюардесса)
- МОЖНО: фетиш-эстетика (чулки, корсеты, кружевное бельё, латекс, каблуки)
- МОЖНО: соблазн, флирт, игривость, провокация, раздевание
- НЕЛЬЗЯ: политика, религия, жестокость
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 3-4 предложений
</format>

<examples_for_format_only>
НЕ КОПИРУЙ! Придумай НОВЫЕ образы и ситуации — другие профессии, фетиши, сценарии.

Соблазнительная медсестра готовится к ночному дежурству | Короткий халатик едва прикрывает кружевное бельё. Стетоскоп между пышных форм, чулки с подвязками под белой формой. Забота никогда не была такой привлекательной и опасной для сердца пациентов.
Красотка-механик в обтягивающем комбинезоне чинит ретро-автомобиль | Масляные разводы на загорелой коже, расстёгнутая молния. Она наклоняется под капот, демонстрируя идеальные изгибы. Гараж в стиле 50-х, pin-up эстетика в каждой детали.
Строгая секретарша остаётся в офисе после всех | Юбка-карандаш задралась выше положенного, блузка расстёгнута. Томный взгляд поверх очков, карандаш между губ. Корпоративная эротика за закрытыми дверями.
</examples_for_format_only>`,

    weekly: `<role>
Ты — арт-директор сообщества художников, создающих эротический арт для аудитории 21+.
</role>

<task>
Придумай 6 тем для ЕЖЕНЕДЕЛЬНОГО челленджа. Темы средней сложности, сочетающие эстетику и фантазию.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает сценарий или фантазию
  2. ОПИСАНИЕ (3-4 предложения) — детали сцены, атмосфера, что изобразить
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает идею
- Сочетай классическое искусство и современные фантазии
- МОЖНО: униформа и ролевые игры (медсёстры, стюардессы, полицейские, горничные)
- МОЖНО: лёгкий BDSM (бондаж лентами, наручники, ошейники, доминирование)
- МОЖНО: фетиш-эстетика (латекс, кожа, корсеты, чулки, каблуки)
- МОЖНО: эротические ситуации из кино, аниме, игр
- НЕЛЬЗЯ: политика, религия, жестокость
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 3-4 предложений
</format>

<examples_for_format_only>
Образцы формата — СОЗДАЙ ОРИГИНАЛЬНЫЕ темы! Комбинируй мифологию, фетиши и фантазии по-новому.

Фавн наслаждается послеполуденным отдыхом в окружении обнажённых нимф | Солнечный свет пробивается сквозь листву на переплетённые тела. Мифологические создания в моменте неги и чувственности. Томная атмосфера древнегреческих мифов — вино, виноград, ласки.
Секретаршу застали за непристойным занятием в кабинете босса | Растерянный взгляд, сбившаяся юбка, раскрытые документы на столе. Кто-то открыл дверь в самый неподходящий момент. Смесь смущения, страха и возбуждения на её лице.
Элегантная доминатрикс в корсете принимает покорность своего слуги | Она на троне, он у её ног. Ошейник, поводок, абсолютный контроль. Эстетика власти и подчинения в изысканном будуаре. BDSM как высокое искусство.
</examples_for_format_only>`,

    monthly: `<role>
Ты — арт-директор сообщества художников, создающих высокохудожественную эротику для аудитории 21+.
</role>

<task>
Придумай 6 тем для ЕЖЕМЕСЯЧНОГО челленджа. АМБИЦИОЗНЫЕ темы, сочетающие искусство и эротические фантазии.
</task>

<requirements>
- Каждая тема состоит из ДВУХ частей через разделитель " | ":
  1. ЗАГОЛОВОК (1 полное предложение) — полностью описывает концепцию или фантазию
  2. ОПИСАНИЕ (4-5 предложений) — детали, атмосфера, варианты интерпретации
- ЗАГОЛОВОК должен быть ПОЛНЫМ ПРЕДЛОЖЕНИЕМ — читатель сразу понимает идею
- Сочетай высокое искусство с популярными эротическими фантазиями
- МОЖНО: мифология и классика (Венера, нимфы, музы, одалиски)
- МОЖНО: современные фетиши художественно (офисные фантазии, униформа, BDSM-эстетика)
- МОЖНО: эротические интерпретации поп-культуры (аниме, кино, игры)
- Темы должны допускать разные интерпретации — от нежных до провокационных
- НЕЛЬЗЯ: политика, религия, жестокость
- Язык: русский
${previousThemesNote}
</requirements>

<format>
Выведи ТОЛЬКО 6 тем, каждая на новой строке в формате:
Заголовок-предложение | Описание из 4-5 предложений
</format>

<examples_for_format_only>
НЕ ПОВТОРЯЙ примеры! Создай УНИКАЛЬНЫЕ концепции — другие эпохи, фантазии, художественные референсы.

Боги Олимпа предаются страсти в своих божественных покоях | Интимные моменты древнегреческих богов. Зевс и его многочисленные возлюбленные, купание Афродиты, объятия Ареса и Афродиты. Классическая красота мраморных тел, божественная чувственность. Мифология встречает эротику высокого искусства.
Ночная смена в больнице скрывает больше, чем кажется пациентам | Эротика белого халата во всех проявлениях. Соблазнительные медсёстры в коротких халатах, пациентки в прозрачных сорочках, доктора за закрытыми дверями ординаторской. Стерильная белизна контрастирует со страстью. Фетиш униформы в медицинском сеттинге.
Закрытая академия хранит секреты запретных отношений | Эротические связи в учебном заведении. Строгие учительницы в очках и чулках, дерзкие студентки после занятий, библиотекарши в тёмных закоулках между стеллажами. Запретное знание, тайные встречи, иерархия и соблазн. Академическая эстетика встречает страсть.
</examples_for_format_only>`,
  };

  // Select prompts based on content mode
  const allPrompts = {
    vanilla: vanillaPrompts,
    medium: mediumPrompts,
    nsfw: nsfwPrompts,
  };

  const modePrompts = allPrompts[contentMode] || vanillaPrompts;
  const prompt = modePrompts[type];

  try {
    console.log("Gemini API request starting...", { type, hasApiKey: !!apiKey, keyLength: apiKey?.length });

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
          generationConfig: { temperature: 1.0, maxOutputTokens: 1000 },
        }),
      },
    );

    console.log("Gemini API response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error response:", { status: response.status, body: errorText });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Gemini API response data:", JSON.stringify(data).substring(0, 500));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.error("Gemini API empty response:", {
        hasCandiates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        error: data.error,
        promptFeedback: data.promptFeedback
      });
    }

    // Parse lines in format "Short | Full"
    const themes = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("|") && l.length > 5)
      .slice(0, 6);

    console.log("Gemini parsed themes:", themes.length);

    if (themes.length >= 6) return themes;

    console.warn("Gemini returned less than 6 themes, using fallback", { themesCount: themes.length });
  } catch (e) {
    console.error("Gemini AI error:", { message: e.message, stack: e.stack });
  }

  // Fallback themes in format "Short | Full" for each content mode
  const allFallbacks = {
    vanilla: {
      daily: [
        "Кафе Миядзаки | Уютная чайная в стиле Studio Ghibli, где духи-помощники разносят чай, а за окном мирно дремлет котобус",
        "Дарт Вейдер дома | Тёмный лорд ситхов в неожиданно домашней обстановке — возможно, он готовит ужин или смотрит сериалы",
        "Покемон-профессор | Ваш любимый покемон получил учёную степень и теперь преподаёт в университете. Какой предмет он ведёт?",
        "Шрек в космосе | Зелёный огр и его верный осёл покоряют галактику на болотном космическом корабле",
        "Baby Yoda на работе | Маленький Грогу героически справляется с типичным рабочим днём в офисе, используя Силу для кофе-брейков",
        "Котик Тарантино | Пушистый кот воссоздаёт культовую сцену из фильма Квентина Тарантино — драма, стиль, усы",
      ],
      weekly: [
        "Ведьмак в Токио | Геральт из Ривии расследует загадочное проклятие в неоновых джунглях ночного Токио — серебряный меч против неоновых вывесок",
        "Властелин Дроидов | Что если бы Саурон вместо колец создавал армию боевых дроидов? Мордор встречает эстетику Star Wars",
        "Аватар Миядзаки | Мир Пандоры переосмысленный в стиле Studio Ghibli — пушистые банши, Джейк среди лесных духов, магия вместо технологий",
        "Dark Souls уютный | Самые мрачные локации Dark Souls, но неожиданно тёплые и уютные — пледы на костях, какао у костра",
        "Офис Хогвартса | Обычный open-space офис, но все сотрудники — волшебники. Кофе варится Accio, отчёты летают сами",
        "Джокер на пенсии | Культовые злодеи комиксов на заслуженном отдыхе — садоводство, рыбалка, вязание в Аркхеме",
      ],
      monthly: [
        "Матрица памяти | Что если наши воспоминания — это глитчи в Матрице? Момент осознания, что твоё детство — загруженная программа. Киберпанк встречает семейный альбом.",
        "Последний босс | Финальный босс любой игры за минуту до битвы — не монстр, а трагический персонаж со своей историей, мотивацией и одиночеством на вершине",
        "Интерстеллар Гибли | Космическая одиссея в стиле Миядзаки. Чёрные дыры как врата в мир духов. Научная фантастика через призму японской мифологии и тёплого волшебства.",
        "Сны Бэтмена | Что снится человеку, который не спит? Подсознание Брюса Уэйна — сюрреалистичный мир, где его страхи и надежды обретают видимую форму",
        "Эволюция героя | Один культовый персонаж в 5 эпохах — от наскальных рисунков до неоновых голограмм будущего. Как меняется герой со временем?",
        "Гарри Поттер 2077 | Магический мир через 50 лет: волшебные палочки с USB, совы-дроны, Хогвартс-метавселенная. Традиции vs прогресс.",
      ],
    },
    medium: {
      daily: [
        "Femme Fatale | Роковая женщина в классическом стиле нуар 40-х — сигаретный дым, кроваво-красная помада, взгляд, от которого бегут мурашки",
        "Ганнибал готовит | Доктор Лектер за приготовлением изысканного ужина — элегантность высокой кухни и леденящая угроза в каждой детали",
        "Вампирский Тиндер | Как выглядит профиль на сайте знакомств для бессмертных существ ночи? Интересы: кровь, готика, лунный свет",
        "Похмелье Бога | Древнее божество после эпической вечеринки на Олимпе — даже всемогущие иногда перебирают с амброзией",
        "Ведьма в метро | Современная ведьма по дороге на корпоративную работу — чёрная кошка в сумке Prada, зелье в термосе Starbucks",
        "Последнее свидание | Романтический ужин на крыше небоскрёба во время конца света — любовь сильнее апокалипсиса, шампанское на фоне метеоритов",
      ],
      weekly: [
        "Бойцовский клуб арт | Первое правило клуба нейро-художников — никому не рассказывать о клубе. Визуализация хаоса, свободы и разрушения иллюзий в одном кадре",
        "Грешники рая | Если бы рай был похож на Лас-Вегас — ангелы-крупье за покерным столом, святые у барной стойки, неоновые нимбы и бесконечный джекпот",
        "Леди-убийца | Элегантная женщина в роскошном вечернем платье на светском приёме — никто не замечает кровь на её бархатных перчатках",
        "True Detective вайб | Атмосфера первого сезона во всей красе — жёлтый король, болота Луизианы, экзистенциальный ужас и бесконечная дорога в никуда",
        "Любовь и хаос | Двое влюблённых посреди разрушенного города — нежный поцелуй в эпицентре катастрофы, красота на руинах",
        "Сирены современности | Мифические сирены адаптировались к XXI веку — как они заманивают своих жертв в эпоху смартфонов и соцсетей?",
      ],
      monthly: [
        "Семь смертных | Визуализация смертных грехов как современных людей. Гордыня листает Instagram, похоть в рекламе, чревоугодие в фастфуде. Кто они сегодня и где обитают?",
        "Красота монстра | Традиционно уродливые создания, показанные с внутренней красотой — элегантность ксеноморфа, грация демона, нежность оборотня в момент болезненной трансформации",
        "Токсичная любовь | Визуализация разрушительных отношений как двух химических элементов. Вместе они создают яд, но порознь не могут существовать. Красивая, смертельная отрава.",
        "Ужин с демонами | Званый ужин, где каждый гость — персонификация внутреннего демона хозяина. Тревога разливает вино, депрессия скучает в углу, гнев яростно режет мясо",
        "Эстетика боли | Как медиа превращают трагедии в развлечение. Репортёры с камерами как стервятники над добычей. Наша коллективная одержимость чужой болью.",
        "Последний танец | Двое танцуют страстное танго на самом краю пропасти. Метафора отношений, где каждое движение может стать последним. Страсть, контроль, падение.",
      ],
    },
    nsfw: {
      daily: [
        "Медсестра мечты | Соблазнительная медсестра в коротком халатике — забота никогда не была такой привлекательной и опасной для сердца",
        "Секретарша босса | Строгая секретарша после рабочего дня — расстёгнутая блузка, юбка-карандаш, томный взгляд поверх очков",
        "Чулки и кофе | Утро в одних чулках и мужской рубашке — ленивая эротика пробуждения, солнце на коже",
        "Горничная отеля | Французская горничная с пёрышковой метёлкой — классика соблазна в кружевном фартуке и чулках",
        "Pin-up механик | Красотка в расстёгнутом комбинезоне чинит ретро-автомобиль — масло на коже, изгибы под капотом",
        "Фитнес-богиня | Спортивная красавица после тренировки — капли пота, спортивный топ, идеальные формы в зеркале зала",
      ],
      weekly: [
        "Госпожа и слуга | Элегантная доминатрикс в корсете и чулках, её покорный слуга на коленях — эстетика власти и подчинения",
        "Плохая секретарша | Секретарша, застигнутая за чем-то непристойным в кабинете босса — смущение, соблазн и последствия",
        "Стюардессы рейса | Экипаж ночного рейса после посадки в отеле — расстёгнутые блузки, усталость и интимность между коллегами",
        "Латекс и неон | Киберпанк-красавица в облегающем латексном костюме — неоновый свет играет на блестящей чёрной коже",
        "Будуар ведьмы | Колдунья готовит приворотное зелье в одном корсете — свечи, магия и опасная красота в каждом движении",
        "Учительница после уроков | Строгая учительница остаётся после занятий — указка, очки, расстёгнутая блузка и частный урок",
      ],
      monthly: [
        "Больничные фантазии | Эротика белого халата во всех проявлениях — медсёстры ночной смены, пациентки в палатах, доктора за закрытыми дверями. Стерильность и страсть.",
        "Академия соблазна | Эротические отношения в учебном заведении — строгие учительницы, дерзкие студентки, библиотекарши после закрытия. Запретное знание.",
        "История О | Визуализация классической BDSM-литературы. Элегантное подчинение, шёлковые ленты, кожаные ошейники. Эстетика власти и доверия в отношениях.",
        "Кабаре Мулен Руж | Эротика Парижа belle époque — канкан, перья, корсеты, куртизанки в будуарах. Декаданс, шампанское и продажная любовь как искусство.",
        "Олимп интимный | Боги Древней Греции в моменты страсти. Зевс и его возлюбленные, купание Афродиты, объятия Ареса. Классическая красота, божественная чувственность.",
        "Косплей без границ | Эротические версии культовых персонажей — аниме-девушки, супергероини, принцессы для взрослых. Детские фантазии выросли вместе с нами.",
      ],
    },
  };

  const fallbacks = allFallbacks[contentMode] || allFallbacks.vanilla;
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

async function handleMessage(update, env, tg, storage) {
  try {
    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const text = message.text || "";
    const threadId = message.message_thread_id || 0;

    // Убираем @username из команды (в группах Telegram добавляет его)
    const command = text.split("@")[0].split(" ")[0].toLowerCase();

    // Проверяем, есть ли доступ к этому чату
    const hasAccess = await hasAccessToChat(env, storage, chatId);
    const config = hasAccess ? await getConfigForChat(env, storage, chatId) : null;

    // Commands (работают везде)
    if (command === "/start" || command === "/help") {
      const schedule = config ? await getSchedule(storage, chatId) : await getSchedule(storage);
      await tg.sendMessage(chatId, ru.helpMessage(schedule), {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // ============================================
    // SUPER ADMIN: Управление сообществами
    // ============================================
    const isAdmin = message.from?.id
      ? await tg.isUserAdmin(chatId, message.from.id)
      : false;

    // Регистрация сообщества: /register_community [название]
    if (command === "/register_community" && isAdmin) {
      const args = text.trim().split(/\s+/).slice(1);
      const name = args.join(" ") || message.chat.title || `Community ${chatId}`;

      const result = await addCommunity(storage, chatId, name);
      if (result.success) {
        await tg.sendMessage(chatId, `✅ Сообщество зарегистрировано!\n\nНазвание: ${name}\nID: ${chatId}\nВсего сообществ: ${result.count}/${MAX_COMMUNITIES}\n\nТеперь настройте топики:\n/set_daily — тема дневных челленджей\n/set_weekly — тема недельных\n/set_monthly — тема месячных\n/set_winners — тема победителей`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        await tg.sendMessage(chatId, `❌ ${result.error}`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Список сообществ: /list_communities
    if (command === "/list_communities" && isAdmin) {
      const communities = await getCommunities(storage);
      const list = Object.values(communities);

      if (list.length === 0) {
        await tg.sendMessage(chatId, `Нет зарегистрированных сообществ.\n\nИспользуйте /register_community для регистрации.`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        let msg = `СООБЩЕСТВА (${list.length}/${MAX_COMMUNITIES})\n\n`;
        for (const c of list) {
          const isCurrent = c.chatId === chatId ? " ← текущее" : "";
          msg += `• ${c.name}${isCurrent}\n  ID: ${c.chatId}\n`;
        }
        await tg.sendMessage(chatId, msg, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Удалить сообщество: /unregister_community
    if (command === "/unregister_community" && isAdmin) {
      const result = await removeCommunity(storage, chatId);
      if (result.success) {
        await tg.sendMessage(chatId, `✅ Сообщество удалено из бота.`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        await tg.sendMessage(chatId, `❌ ${result.error}`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // ============================================
    // COMMUNITY ADMIN COMMANDS (только для зарегистрированных сообществ)
    // ============================================
    if (!hasAccess) {
      // Для незарегистрированных сообществ — предлагаем регистрацию
      if (command.startsWith("/") && isAdmin) {
        await tg.sendMessage(chatId, `Это сообщество не зарегистрировано.\n\nИспользуйте /register_community для регистрации.`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Get topic ID - для настройки
    if (command === "/topic_id" && isAdmin) {
      const topicInfo = threadId
        ? `ID темы: ${threadId}\n\nКоманды: /set_daily, /set_weekly, /set_monthly, /set_winners`
        : "Это общий чат. Напиши команду внутри темы форума.";
      await tg.sendMessage(chatId, topicInfo, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Set topic commands (per-community)
    if (command === "/set_daily" && isAdmin) {
      if (!threadId) {
        await tg.sendMessage(chatId, "Напиши команду внутри темы форума", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.daily = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendMessage(chatId, `Тема для дневных челленджей установлена`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_weekly" && isAdmin) {
      if (!threadId) {
        await tg.sendMessage(chatId, "Напиши команду внутри темы форума", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.weekly = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendMessage(chatId, `Тема для недельных челленджей установлена`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_monthly" && isAdmin) {
      if (!threadId) {
        await tg.sendMessage(chatId, "Напиши команду внутри темы форума", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.monthly = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendMessage(chatId, `Тема для месячных челленджей установлена`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_winners" && isAdmin) {
      if (!threadId) {
        await tg.sendMessage(chatId, "Напиши команду внутри темы форума", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.winners = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendMessage(chatId, `Тема для победителей установлена`, {
        message_thread_id: threadId,
      });
      return;
    }

    // Content mode configuration: /set_content_mode vanilla|medium|nsfw (per-community)
    if (command === "/set_content_mode" && isAdmin) {
      const args = text.trim().split(/\s+/).slice(1);
      const mode = args[0]?.toLowerCase();

      if (!mode || !CONTENT_MODES[mode]) {
        const modesList = Object.entries(CONTENT_MODES)
          .map(([key, val]) => `• ${key} — ${val.name}: ${val.description}`)
          .join("\n");
        const currentMode = await storage.getContentMode(chatId);
        await tg.sendMessage(
          chatId,
          `РЕЖИМЫ КОНТЕНТА

Текущий: ${CONTENT_MODES[currentMode].name}

Доступные режимы:
${modesList}

Использование: /set_content_mode <режим>
Пример: /set_content_mode medium`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setContentMode(chatId, mode);
      const modeInfo = CONTENT_MODES[mode];
      await tg.sendMessage(
        chatId,
        `Режим контента изменён на ${modeInfo.name}\n\n${modeInfo.description}`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Toggle accepting link previews as submissions: /set_accept_links on|off
    if (command === "/set_accept_links" && isAdmin) {
      const args = text.trim().split(/\s+/).slice(1);
      const value = args[0]?.toLowerCase();

      const currentValue = await storage.get(`community:${chatId}:settings:accept_links`);

      if (!value || !["on", "off", "1", "0", "true", "false"].includes(value)) {
        const status = currentValue ? "ВКЛ" : "ВЫКЛ";
        await tg.sendMessage(
          chatId,
          `ПРИЁМ ССЫЛОК С ПРЕВЬЮ

Текущий статус: ${status}

Когда включено, сообщения со ссылками (с OpenGraph превью) принимаются как работы в челлендж.

Использование: /set_accept_links on|off
Пример: /set_accept_links on`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      const newValue = ["on", "1", "true"].includes(value);
      await storage.set(`community:${chatId}:settings:accept_links`, newValue);

      await tg.sendMessage(
        chatId,
        `Приём ссылок с превью: ${newValue ? "ВКЛЮЧЁН" : "ВЫКЛЮЧЕН"}`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Настройка минимума реакций для предложений
    if (command === "/set_suggestion_reactions" && isAdmin) {
      const args = text.trim().split(/\s+/).slice(1);
      const value = parseInt(args[0], 10);

      const currentValue = await storage.getMinSuggestionReactions(chatId);

      if (isNaN(value) || !args[0]) {
        await tg.sendMessage(
          chatId,
          `МИНИМУМ РЕАКЦИЙ ДЛЯ ПРЕДЛОЖЕНИЙ ТЕМ

Текущее значение: ${currentValue}

Предложенная тема попадёт в опрос, если наберёт достаточно реакций до начала голосования.

Использование: /set_suggestion_reactions ЧИСЛО
Пример: /set_suggestion_reactions 5`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      if (value < 1 || value > 50) {
        await tg.sendMessage(
          chatId,
          "Значение должно быть от 1 до 50",
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setMinSuggestionReactions(chatId, value);

      await tg.sendMessage(
        chatId,
        `Минимум реакций для предложений: ${value}`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Schedule configuration: /schedule_daily 17, /schedule_weekly 0 17 (day hour), /schedule_monthly 1 17 (per-community)
    const scheduleMatch = command.match(/^\/schedule_(daily|weekly|monthly)$/);
    if (scheduleMatch && isAdmin) {
      const type = scheduleMatch[1];
      const args = text.trim().split(/\s+/).slice(1).map(n => parseInt(n, 10));
      const kvSchedule = (await storage.get(`community:${chatId}:settings:schedule`)) || {};

      if (type === "daily") {
        const hour = args[0];
        if (isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendMessage(chatId, "Формат: /schedule_daily ЧАС (0-23)\nПример: /schedule_daily 17", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.daily = { ...kvSchedule.daily, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        await tg.sendMessage(chatId, `Дневные челленджи: ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "weekly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 0 || day > 6 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendMessage(chatId, "Формат: /schedule_weekly ДЕНЬ ЧАС\nДень: 0=вс, 1=пн, ..., 6=сб\nПример: /schedule_weekly 0 17", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.weekly = { ...kvSchedule.weekly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
        await tg.sendMessage(chatId, `Недельные челленджи: ${dayNames[day]} ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "monthly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 1 || day > 28 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendMessage(chatId, "Формат: /schedule_monthly ДЕНЬ ЧАС\nДень: 1-28\nПример: /schedule_monthly 1 17", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.monthly = { ...kvSchedule.monthly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        await tg.sendMessage(chatId, `Месячные челленджи: ${day}-го числа в ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    if (command === "/admin" && isAdmin) {
      const schedule = await getSchedule(storage, chatId);
      const fmt = formatSchedule(schedule);
      const currentMode = await storage.getContentMode(chatId);
      const modeInfo = CONTENT_MODES[currentMode];
      const acceptLinks = await storage.get(`community:${chatId}:settings:accept_links`);
      const minSuggestionReactions = await storage.getMinSuggestionReactions(chatId);
      const communityName = config.name || `ID: ${chatId}`;
      await tg.sendMessage(
        chatId,
        `АДМИН-ПАНЕЛЬ
Сообщество: ${communityName}

Опросы
/poll_daily — создать опрос дня
/poll_weekly — создать опрос недели
/poll_monthly — создать опрос месяца

Запуск
/run_daily — запустить дневной
/run_weekly — запустить недельный
/run_monthly — запустить месячный

Завершение
/finish_daily — завершить дневной
/finish_weekly — завершить недельный
/finish_monthly — завершить месячный

Статистика
/status — состояние челленджей
/cs_daily, /cs_weekly, /cs_monthly
/test_ai — проверить Gemini API

Настройка тем
/set_daily, /set_weekly, /set_monthly, /set_winners

Режим контента: ${modeInfo.name}
/set_content_mode — изменить режим

Ссылки с превью: ${acceptLinks ? "ВКЛ" : "ВЫКЛ"}
/set_accept_links — вкл/выкл приём ссылок

Расписание (текущее)
• Дневные: ${fmt.daily}
• Недельные: ${fmt.weekly}
• Месячные: ${fmt.monthly}

/schedule_daily ЧАС
/schedule_weekly ДЕНЬ ЧАС
/schedule_monthly ДЕНЬ ЧАС

Предложения тем (для всех)
/suggest — предложить тему
/suggestions — список предложений
Мин. реакций: ${minSuggestionReactions}
/set_suggestion_reactions — изменить

Сообщества
/register_community — зарегистрировать
/list_communities — список
/unregister_community — удалить`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Admin: Create polls (no confirmation message - poll itself is visible)
    if (command === "/poll_daily" && isAdmin) {
      await storage.deletePoll(chatId, "daily");
      await generatePoll(env, chatId, config, tg, storage, "daily");
      return;
    }
    if (command === "/poll_weekly" && isAdmin) {
      await storage.deletePoll(chatId, "weekly");
      await generatePoll(env, chatId, config, tg, storage, "weekly");
      return;
    }
    if (command === "/poll_monthly" && isAdmin) {
      await storage.deletePoll(chatId, "monthly");
      await generatePoll(env, chatId, config, tg, storage, "monthly");
      return;
    }

    // Admin: Start challenges (announcement is pinned, no extra notification needed)
    if (command === "/run_daily" && isAdmin) {
      await startChallenge(env, chatId, config, tg, storage, "daily");
      return;
    }
    if (command === "/run_weekly" && isAdmin) {
      await startChallenge(env, chatId, config, tg, storage, "weekly");
      return;
    }
    if (command === "/run_monthly" && isAdmin) {
      await startChallenge(env, chatId, config, tg, storage, "monthly");
      return;
    }

    // Admin: Finish challenges (winner announcement is posted, no extra notification needed)
    if (command === "/finish_daily" && isAdmin) {
      await finishChallenge(env, chatId, config, tg, storage, "daily");
      return;
    }
    if (command === "/finish_weekly" && isAdmin) {
      await finishChallenge(env, chatId, config, tg, storage, "weekly");
      return;
    }
    if (command === "/finish_monthly" && isAdmin) {
      await finishChallenge(env, chatId, config, tg, storage, "monthly");
      return;
    }

    // Admin: Status (per-community)
    if (command === "/status" && isAdmin) {
      const [daily, weekly, monthly, pollDaily, pollWeekly, pollMonthly] = await Promise.all([
        storage.getChallenge(chatId, "daily"),
        storage.getChallenge(chatId, "weekly"),
        storage.getChallenge(chatId, "monthly"),
        storage.getPoll(chatId, "daily"),
        storage.getPoll(chatId, "weekly"),
        storage.getPoll(chatId, "monthly"),
      ]);

      const formatChallenge = (c, name) => {
        if (!c) return `${name}: нет`;
        if (c.status !== "active") return `${name}: завершён`;
        const endDateStr = new Date(c.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short" });
        return `${name}: до ${endDateStr}\n   ${c.topic}`;
      };

      const statusMsg = `СТАТУС

Опросы
Дневной: ${pollDaily ? "есть" : "нет"}
Недельный: ${pollWeekly ? "есть" : "нет"}
Месячный: ${pollMonthly ? "есть" : "нет"}

Челленджи
${formatChallenge(daily, "Дневной")}
${formatChallenge(weekly, "Недельный")}
${formatChallenge(monthly, "Месячный")}`;

      await tg.sendMessage(chatId, statusMsg, { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Current challenge stats - /cs_daily, /cs_weekly, /cs_monthly (per-community)
    const csMatch = command.match(/^\/cs_(daily|weekly|monthly)$/);
    if (csMatch && isAdmin) {
      const type = csMatch[1];
      const challenge = await storage.getChallenge(chatId, type);
      const typeNames = { daily: "Дневной", weekly: "Недельный", monthly: "Месячный" };

      if (!challenge || challenge.status !== "active") {
        await tg.sendMessage(chatId, `${typeNames[type]} челлендж\n\nНет активного`, {
          message_thread_id: threadId || undefined,
        });
        return;
      }

      const submissions = await storage.getSubmissions(chatId, type, challenge.id);
      const endDateStr = new Date(challenge.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

      if (submissions.length === 0) {
        await tg.sendMessage(chatId, `${typeNames[type]} челлендж\n\nТема: ${challenge.topic}\nДо: ${endDateStr}\n\nПока нет работ`, {
          message_thread_id: threadId || undefined,
        });
        return;
      }

      // Sort by score descending, then by timestamp ascending (earlier submission wins tie)
      const sorted = [...submissions].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
      const list = sorted.map((s, i) =>
        `${i + 1}. @${s.username || s.userId} — ${s.score}`
      ).join("\n");

      await tg.sendMessage(chatId, `${typeNames[type]} челлендж\n\nТема: ${challenge.topic}\nДо: ${endDateStr}\nУчастников: ${submissions.length}\n\n${list}`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Admin: Test Gemini API
    if (command === "/test_ai" && isAdmin) {
      await tg.sendMessage(chatId, "Тестирую Gemini API...", { message_thread_id: threadId || undefined });
      try {
        // Direct API call to see raw response
        const testPrompt = "Придумай 3 темы для арт-челленджа. Формат: Название | Описание";
        const apiKey = env.GEMINI_API_KEY;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: testPrompt }] }],
              generationConfig: { temperature: 1.0, maxOutputTokens: 300 },
            }),
          },
        );

        const status = response.status;
        const data = await response.json();

        let msg = `Gemini API (${status})\n\n`;

        if (data.error) {
          msg += `Ошибка: ${data.error.message || JSON.stringify(data.error)}`;
        } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          msg += text.substring(0, 500);
        } else {
          msg += `Пустой ответ: ${JSON.stringify(data).substring(0, 400)}`;
        }

        await tg.sendMessage(chatId, msg, { message_thread_id: threadId || undefined });
      } catch (e) {
        await tg.sendMessage(chatId, `Ошибка: ${e.message}`, { message_thread_id: threadId || undefined });
      }
      return;
    }

    // User commands (per-community)
    if (text.startsWith("/stats")) {
      const userId = message.from?.id;
      if (!userId) return;

      // Parallel KV reads for better performance
      const [daily, weekly, monthly] = await Promise.all([
        storage.getUserStats(chatId, "daily", userId),
        storage.getUserStats(chatId, "weekly", userId),
        storage.getUserStats(chatId, "monthly", userId),
      ]);
      const total = daily.wins + weekly.wins + monthly.wins;

      const winsWord = pluralize(total, "победа", "победы", "побед");
      await tg.sendMessage(
        chatId,
        `Ваша статистика\n\nВсего ${winsWord}: ${total}\n\nДневные: ${daily.wins} (#${daily.rank})\nНедельные: ${weekly.wins} (#${weekly.rank})\nМесячные: ${monthly.wins} (#${monthly.rank})`,
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

      const leaderboard = await storage.getLeaderboard(chatId, type);
      if (leaderboard.length === 0) {
        await tg.sendMessage(
          chatId,
          `Рейтинг ${ru.challengeTypes[type]} пока пуст`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const medals = ["1.", "2.", "3."];
      let msg = ru.leaderboardTitle(type) + `\n\n`;
      leaderboard.slice(0, 10).forEach((e, i) => {
        const medal = medals[i] || `${i + 1}.`;
        msg += `${medal} ${e.username || `User ${e.userId}`} — ${e.wins} побед\n`;
      });

      // Show user's position if not in top 10
      const userId = message.from?.id;
      if (userId) {
        const userIndex = leaderboard.findIndex((e) => e.userId === userId);
        if (userIndex >= 10) {
          msg += `\nВаше место: #${userIndex + 1}`;
        }
      }

      await tg.sendMessage(chatId, msg, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    if (text.startsWith("/current")) {
      // Parallel KV reads for better performance (per-community)
      const [daily, weekly, monthly] = await Promise.all([
        storage.getChallenge(chatId, "daily"),
        storage.getChallenge(chatId, "weekly"),
        storage.getChallenge(chatId, "monthly"),
      ]);

      const format = (c, type) => {
        if (!c || c.status !== "active")
          return `${ru.challengeTypes[type]}: нет`;
        const endDateStr = new Date(c.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short" });
        return `${ru.challengeTypes[type]} (до ${endDateStr})\n${c.topic}`;
      };

      await tg.sendMessage(
        chatId,
        `Активные челленджи\n\n${format(daily, "daily")}\n\n${format(weekly, "weekly")}\n\n${format(monthly, "monthly")}`,
        { message_thread_id: threadId || undefined },
      );
      return;
    }

    // ============================================
    // ПРЕДЛОЖЕНИЯ ТЕМ (доступно всем пользователям)
    // ============================================

    // Команда /suggest или /suggest_daily, /suggest_weekly, /suggest_monthly
    const suggestMatch = command.match(/^\/suggest(?:_(daily|weekly|monthly))?$/);
    if (suggestMatch) {
      // Определяем тип: из команды или из топика
      let type = suggestMatch[1]; // daily|weekly|monthly из команды

      if (!type && threadId && config) {
        // Определяем по топику
        if (config.topics.daily === threadId) type = "daily";
        else if (config.topics.weekly === threadId) type = "weekly";
        else if (config.topics.monthly === threadId) type = "monthly";
      }

      if (!type) {
        await tg.sendMessage(
          chatId,
          `Укажите тип челленджа:\n/suggest_daily, /suggest_weekly или /suggest_monthly\n\nИли используйте /suggest в теме нужного челленджа.`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      // Парсинг текста предложения: всё после команды
      const textAfterCommand = text.replace(/^\/suggest(?:_\w+)?\s*@?\w*\s*/i, "").trim();

      if (!textAfterCommand) {
        const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
        const minReactionsHelp = await storage.getMinSuggestionReactions(chatId);
        await tg.sendMessage(
          chatId,
          `💡 Предложите тему для ${typeNames[type]} челленджа\n\nФормат: /suggest Название | Описание\n\nПример:\n/suggest Котики в космосе | Милые котики покоряют галактику в стиле ретро-футуризма\n\nЕсли тема наберёт ${minReactionsHelp}+ реакций до начала голосования, она попадёт в следующий опрос!`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      // Парсинг: Название | Описание
      const parts = textAfterCommand.split("|").map((p) => p.trim());
      const title = parts[0];
      const description = parts[1] || parts[0];

      // Валидация названия
      if (!title || title.length < 3) {
        await tg.sendMessage(
          chatId,
          "Название слишком короткое. Минимум 3 символа.",
          { message_thread_id: threadId || undefined, reply_to_message_id: message.message_id },
        );
        return;
      }

      if (title.length > 50) {
        await tg.sendMessage(
          chatId,
          "Название слишком длинное. Максимум 50 символов.",
          { message_thread_id: threadId || undefined, reply_to_message_id: message.message_id },
        );
        return;
      }

      // Проверяем, не предлагал ли уже
      const suggestions = await storage.getSuggestions(chatId, type);
      if (suggestions.some((s) => s.userId === message.from?.id)) {
        await tg.sendMessage(
          chatId,
          "Вы уже предложили тему для этого цикла. Дождитесь следующего голосования.",
          { message_thread_id: threadId || undefined, reply_to_message_id: message.message_id },
        );
        return;
      }

      // Генерация ID
      const suggestionId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      // Получаем настройку минимума реакций для этого сообщества
      const minReactions = await storage.getMinSuggestionReactions(chatId);

      // Публикуем предложение как отдельное сообщение
      const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
      const authorName = message.from?.username ? `@${message.from.username}` : message.from?.first_name || "Аноним";

      // Формируем понятное описание
      const descriptionText = description !== title
        ? `📝 ${description}`
        : "⚠️ Описание не указано";

      const suggestionMsg = await tg.sendMessage(
        chatId,
        `💡 ПРЕДЛОЖЕНИЕ ТЕМЫ (${typeNames[type]})

🎯 ${title}

${descriptionText}

Автор: ${authorName}

👍 Поставьте реакцию, если хотите эту тему!
Нужно ${minReactions}+ реакций для включения в опрос.`,
        { message_thread_id: threadId || undefined },
      );

      // Сохраняем предложение
      const suggestion = {
        id: suggestionId,
        messageId: suggestionMsg.message_id,
        userId: message.from?.id,
        username: message.from?.username || message.from?.first_name,
        title: title,
        description: description,
        createdAt: Date.now(),
        threadId: threadId,
        reactions: {},
        reactionCount: 0,
      };

      await storage.addSuggestion(chatId, type, suggestion);

      // Удаляем оригинальную команду (опционально, чтобы не засорять чат)
      try {
        await tg.request("deleteMessage", { chat_id: chatId, message_id: message.message_id });
      } catch (e) {
        console.log("Could not delete suggest command:", e.message);
      }

      console.log(`Suggestion created: community=${chatId}, type=${type}, id=${suggestionId}, title="${title}"`);
      return;
    }

    // Команда /suggestions - список предложений
    const suggestionsMatch = command.match(/^\/suggestions(?:_(daily|weekly|monthly))?$/);
    if (suggestionsMatch) {
      let type = suggestionsMatch[1];

      if (!type && threadId && config) {
        if (config.topics.daily === threadId) type = "daily";
        else if (config.topics.weekly === threadId) type = "weekly";
        else if (config.topics.monthly === threadId) type = "monthly";
      }

      if (!type) {
        await tg.sendMessage(
          chatId,
          "Укажите тип: /suggestions_daily, /suggestions_weekly, /suggestions_monthly",
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const suggestions = await storage.getSuggestions(chatId, type);
      const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
      const minReactionsList = await storage.getMinSuggestionReactions(chatId);

      if (suggestions.length === 0) {
        await tg.sendMessage(
          chatId,
          `Нет предложений для ${typeNames[type]} челленджа.\n\nПредложите тему: /suggest_${type} Название | Описание`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      let msg = `💡 ПРЕДЛОЖЕНИЯ ДЛЯ ${typeNames[type].toUpperCase()} ЧЕЛЛЕНДЖА\n\n`;

      // Сортируем по количеству реакций (убывание)
      const sorted = [...suggestions].sort((a, b) => (b.reactionCount || 0) - (a.reactionCount || 0));

      for (const s of sorted) {
        const status = (s.reactionCount || 0) >= minReactionsList ? "✅" : "⏳";
        const authorName = s.username ? `@${s.username}` : "Аноним";
        msg += `${status} ${s.title} — ${s.reactionCount || 0} реакций\n   ${authorName}\n\n`;
      }

      msg += `Для участия в голосовании нужно ${minReactionsList}+ реакции.`;

      await tg.sendMessage(chatId, msg, { message_thread_id: threadId || undefined });
      return;
    }

    // Photo submission (includes photos, image documents, and links with previews)
    const hasPhoto = message.photo && message.photo.length > 0;
    const hasImageDocument = message.document?.mime_type?.startsWith("image/");
    // Check for link with preview (OpenGraph images)
    const hasLinkPreview = message.entities?.some(e => e.type === "url") &&
                          (message.link_preview_options || message.web_page);

    // Check community setting for accepting link previews
    const acceptLinks = await storage.get(`community:${chatId}:settings:accept_links`);
    const isValidSubmission = hasPhoto || hasImageDocument || (hasLinkPreview && acceptLinks);

    if (isValidSubmission) {
      // Check if this community is registered
      if (!await hasAccessToChat(env, storage, chatId)) return;

      const challengeType = await storage.isActiveTopic(chatId, threadId);
      if (!challengeType) {
        // Not a challenge topic - silently ignore
        return;
      }

      const challenge = await storage.getChallenge(chatId, challengeType);
      if (!challenge || challenge.status !== "active") {
        await tg.sendMessage(
          chatId,
          "Сейчас нет активного челленджа в этой теме",
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
          "Время челленджа истекло",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      // Check for forwarded messages (anti-plagiarism)
      if (message.forward_origin || message.forward_from || message.forward_date) {
        console.log(`Rejected forwarded submission: user=${message.from?.id}`);
        return; // Silently reject
      }

      // Check for duplicate
      const submissions = await storage.getSubmissions(
        chatId,
        challengeType,
        challenge.id,
      );
      if (submissions.some((s) => s.userId === message.from?.id)) {
        await tg.sendMessage(
          chatId,
          "Вы уже отправили работу в этот челлендж",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      await storage.addSubmission(chatId, challengeType, challenge.id, {
        messageId: message.message_id,
        userId: message.from?.id,
        username: message.from?.username || message.from?.first_name,
        score: 0,
        timestamp: Date.now(),
      });

      // Confirmation message
      await tg.sendMessage(chatId, "Работа принята", {
        message_thread_id: threadId || undefined,
        reply_to_message_id: message.message_id,
      });

      console.log(
        `Submission: community=${chatId}, user=${message.from?.id}, msg=${message.message_id}`,
      );
    }
  } catch (e) {
    console.error("handleMessage error:", { error: e.message, stack: e.stack });
  }
}

async function handleReactionCount(update, env, storage) {
  try {
    const reaction = update.message_reaction_count;
    if (!reaction) return;

    const chatId = reaction.chat.id;

    // Check if this community is registered
    if (!await hasAccessToChat(env, storage, chatId)) return;

    // Use thread ID to determine which challenge type this belongs to
    const threadId = reaction.message_thread_id;
    const challengeType = await storage.isActiveTopic(chatId, threadId);
    if (!challengeType) return;

    const challenge = await storage.getChallenge(chatId, challengeType);
    if (!challenge || challenge.status !== "active" || Date.now() >= challenge.endsAt) return;

    // Check if this message is actually a submission (avoid updating non-submissions)
    const submissions = await storage.getSubmissions(chatId, challengeType, challenge.id);
    const submission = submissions.find((s) => s.messageId === reaction.message_id);
    if (!submission) return; // Not a submission - ignore

    // Calculate score
    let score = 0;
    for (const r of reaction.reactions) {
      if (r.type.type === "emoji" && r.type.emoji !== EXCLUDED_EMOJI) {
        score += r.total_count;
      } else if (r.type.type === "custom_emoji" || r.type.type === "paid") {
        score += r.total_count;
      }
    }

    await storage.updateSubmissionScore(
      chatId,
      challengeType,
      challenge.id,
      reaction.message_id,
      score,
    );
  } catch (e) {
    console.error("handleReactionCount error:", {
      error: e.message,
      stack: e.stack,
    });
  }
}

// Handle individual reaction updates (when reaction authors are visible)
async function handleReaction(update, env, storage) {
  try {
    const reaction = update.message_reaction;
    if (!reaction) return;

    const chatId = reaction.chat.id;

    console.log("Reaction received:", JSON.stringify({
      chat_id: chatId,
      message_id: reaction.message_id,
      thread_id: reaction.message_thread_id,
      user_id: reaction.user?.id,
      new_reaction: reaction.new_reaction,
      old_reaction: reaction.old_reaction,
    }));

    // Check if this community is registered
    if (!await hasAccessToChat(env, storage, chatId)) {
      console.log("Reaction ignored: community not registered", { chatId });
      return;
    }

    const userId = reaction.user?.id;
    if (!userId) return;

    // ============================================
    // ПРОВЕРКА: это реакция на предложение темы?
    // ============================================
    const suggestionResult = await storage.findSuggestionByMessageId(chatId, reaction.message_id);
    if (suggestionResult) {
      const { suggestion, type } = suggestionResult;

      // Игнорируем самореакции (автор не может голосовать за своё предложение)
      if (userId === suggestion.userId) {
        console.log("Suggestion reaction ignored: self-reaction", { userId, messageId: reaction.message_id });
        return;
      }

      // Проверяем есть ли валидная реакция
      let hasValidReaction = false;
      for (const r of reaction.new_reaction || []) {
        if (r.type === "emoji" && r.emoji !== EXCLUDED_EMOJI) {
          hasValidReaction = true;
          break;
        } else if (r.type === "custom_emoji" || r.type === "paid") {
          hasValidReaction = true;
          break;
        }
      }

      // Обновляем реакции на предложение
      const updated = await storage.updateSuggestionReactions(chatId, type, reaction.message_id, userId, hasValidReaction);

      if (updated) {
        console.log(`Suggestion reaction: community=${chatId}, type=${type}, msg=${reaction.message_id}, user=${userId}, valid=${hasValidReaction}, totalReactions=${updated.reactionCount}`);
      }
      return;
    }

    // Find which challenge this message belongs to by checking all active challenges
    let challengeType = null;
    let challenge = null;
    let submission = null;

    for (const type of ["daily", "weekly", "monthly"]) {
      const ch = await storage.getChallenge(chatId, type);
      if (ch?.status === "active" && Date.now() < ch.endsAt) {
        // Check if this message is a submission in this challenge
        const submissions = await storage.getSubmissions(chatId, type, ch.id);
        const found = submissions.find(s => s.messageId === reaction.message_id);
        if (found) {
          challengeType = type;
          challenge = ch;
          submission = found;
          break;
        }
      }
    }

    if (!challengeType || !challenge) {
      console.log("Reaction ignored: message not found in any active challenge", { chatId, messageId: reaction.message_id });
      return;
    }

    // Count only ONE unique reaction per user (ignore Premium multi-reactions)
    // Check if user has at least one valid reaction
    let hasValidReaction = false;
    for (const r of reaction.new_reaction || []) {
      if (r.type === "emoji" && r.emoji !== EXCLUDED_EMOJI) {
        hasValidReaction = true;
        break;
      } else if (r.type === "custom_emoji" || r.type === "paid") {
        hasValidReaction = true;
        break;
      }
    }
    const userScore = hasValidReaction ? 1 : 0;

    // Ignore self-reactions (user reacting to their own post)
    if (submission && userId === submission.userId) {
      console.log("Reaction ignored: self-reaction", { userId, messageId: reaction.message_id });
      return;
    }

    const reactionsKey = `community:${chatId}:reactions:${challengeType}:${challenge.id}:${reaction.message_id}`;
    const reactionsMap = (await storage.get(reactionsKey)) || {};
    reactionsMap[userId] = userScore;
    await storage.set(reactionsKey, reactionsMap);

    // Calculate total score from all users
    const totalScore = Object.values(reactionsMap).reduce((sum, s) => sum + s, 0);

    await storage.updateSubmissionScore(
      chatId,
      challengeType,
      challenge.id,
      reaction.message_id,
      totalScore,
    );

    console.log(`Reaction scored: community=${chatId}, type=${challengeType}, msg=${reaction.message_id}, user=${userId}, userScore=${userScore}, totalScore=${totalScore}`);
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

async function generatePoll(env, chatId, config, tg, storage, type) {
  try {
    const existing = await storage.getPoll(chatId, type);
    if (existing) return;

    const topicId = config.topics[type];
    const previousThemes = await storage.getThemeHistory(chatId, type);
    const contentMode = (await storage.get(`community:${chatId}:settings:content_mode`)) || DEFAULT_CONTENT_MODE;

    // ============================================
    // ДОБАВЛЯЕМ ОДОБРЕННЫЕ ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ
    // ============================================
    const minReactionsPoll = await storage.getMinSuggestionReactions(chatId);
    const approvedSuggestions = await storage.getApprovedSuggestions(chatId, type, minReactionsPoll);

    // Формируем из предложений строки в формате "Название | Описание"
    const suggestionThemes = approvedSuggestions.map((s) => `${s.title} | ${s.description}`);

    // Генерируем AI-темы (меньше, если есть предложения от пользователей)
    const aiThemeCount = Math.max(2, 6 - suggestionThemes.length);
    let aiThemes = [];

    if (aiThemeCount >= 2) {
      aiThemes = await generateThemes(env.GEMINI_API_KEY, type, "ru", previousThemes, contentMode);
      // Ограничиваем количество AI-тем
      aiThemes = aiThemes.slice(0, aiThemeCount);
    }

    // Объединяем: сначала предложения пользователей, потом AI-темы
    const allThemes = [...suggestionThemes, ...aiThemes].slice(0, 6);

    // Extract short names for poll, keep full strings for storage
    const shortNames = allThemes.map((t) => parseTheme(t).short);

    // Validate: need at least 2 options for poll
    if (shortNames.length < 2) {
      console.error(`generatePoll: not enough themes for ${type}, community=${chatId}`);
      return;
    }

    // Отправляем сначала сообщение с ПОЛНЫМИ описаниями тем
    const typeLabels = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
    let descriptionsMsg = `📋 ОПИСАНИЯ ТЕМ ДЛЯ ${typeLabels[type].toUpperCase()} ЧЕЛЛЕНДЖА\n\n`;

    allThemes.forEach((themeStr, index) => {
      const { short, full } = parseTheme(themeStr);
      const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"][index] || `${index + 1}.`;
      descriptionsMsg += `${emoji} ${short}\n`;
      if (full !== short) {
        descriptionsMsg += `📝 ${full}\n`;
      }
      descriptionsMsg += "\n";
    });

    descriptionsMsg += "⬇️ Голосуйте в опросе ниже!";

    await tg.sendMessage(chatId, descriptionsMsg, {
      message_thread_id: topicId || undefined,
    });

    const poll = await tg.sendPoll(
      chatId,
      ru.pollQuestion(type),
      shortNames,
      {
        message_thread_id: topicId || undefined,
        is_anonymous: false,
        allows_multiple_answers: false,
      },
    );

    await storage.savePoll(chatId, {
      type,
      pollId: poll.poll.id,
      messageId: poll.message_id,
      options: allThemes, // Store full "short | full" strings
      createdAt: Date.now(),
      topicThreadId: topicId,
      // Запоминаем какие темы были из предложений пользователей
      suggestionIds: approvedSuggestions.map((s) => s.id),
    });

    // Pin the poll
    try {
      await tg.pinChatMessage(chatId, poll.message_id);
    } catch (e) {
      console.error("Failed to pin poll:", e.message);
    }

    // Очищаем использованные предложения
    if (approvedSuggestions.length > 0) {
      await storage.clearSuggestions(chatId, type);
    }

    console.log(`Poll created: community=${chatId}, type=${type}, userSuggestions=${suggestionThemes.length}, aiThemes=${aiThemes.length}`);
  } catch (e) {
    console.error(`generatePoll error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function finishChallenge(env, chatId, config, tg, storage, type) {
  try {
    const challenge = await storage.getChallenge(chatId, type);
    if (!challenge || challenge.status !== "active") return;

    // Unpin the announcement
    if (challenge.announcementMessageId) {
      try {
        await tg.unpinChatMessage(chatId, challenge.announcementMessageId);
      } catch (e) {
        console.error("Failed to unpin announcement:", e.message);
      }
    }

    const submissions = await storage.getSubmissions(chatId, type, challenge.id);

    if (submissions.length === 0) {
      await tg.sendMessage(chatId, ru.noSubmissions, {
        message_thread_id: challenge.topicThreadId || undefined,
      });
    } else {
      // Find max score and all winners with that score
      const maxScore = Math.max(...submissions.map((s) => s.score));
      const winners = submissions.filter((s) => s.score === maxScore);

      // Format winner names
      const winnerNames = winners
        .map((w) => (w.username ? `@${w.username}` : `Участник #${w.userId}`))
        .join(", ");

      await tg.sendMessage(
        chatId,
        ru.winnerAnnouncement(winnerNames, maxScore, type),
        {
          message_thread_id: challenge.topicThreadId || undefined,
          reply_to_message_id: winners[0].messageId,
        },
      );

      // Forward all winners to winners topic and add wins
      for (const winner of winners) {
        if (config.topics.winners) {
          try {
            await tg.forwardMessage(
              chatId,
              chatId,
              winner.messageId,
              {
                message_thread_id: config.topics.winners,
              },
            );
            const winnerName = winner.username
              ? `@${winner.username}`
              : `Участник #${winner.userId}`;
            await tg.sendMessage(
              chatId,
              ru.winnerAnnouncementFull(winnerName, winner.score, type, challenge.topicFull || challenge.topic),
              {
                message_thread_id: config.topics.winners,
              },
            );
          } catch (e) {
            console.error("Forward error:", e);
          }
        }

        await storage.addWin(chatId, type, winner.userId, winner.username);
      }
    }

    challenge.status = "finished";
    await storage.saveChallenge(chatId, challenge);

    const activeTopics = await storage.getActiveTopics(chatId);
    delete activeTopics[challenge.topicThreadId];
    await storage.setActiveTopics(chatId, activeTopics);
  } catch (e) {
    console.error(`finishChallenge error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function startChallenge(env, chatId, config, tg, storage, type) {
  try {
    await finishChallenge(env, chatId, config, tg, storage, type);

    const poll = await storage.getPoll(chatId, type);
    let shortTheme = "Свободная тема";
    let fullTheme =
      "Свободная тема — создайте что угодно, дайте волю фантазии!";
    let voteCount = 0;

    if (poll) {
      try {
        const stopped = await tg.stopPoll(chatId, poll.messageId);
        let maxVotes = 0;
        let winnerShort = "";

        // Find winner by short name (that's what's in poll options)
        for (const opt of stopped.options) {
          if (opt.voter_count > maxVotes) {
            maxVotes = opt.voter_count;
            winnerShort = opt.text;
          }
        }
        voteCount = maxVotes;

        // Unpin the poll
        try {
          await tg.unpinChatMessage(chatId, poll.messageId);
        } catch (e) {
          console.error("Failed to unpin poll:", e.message);
        }

        // Find matching full theme from stored options
        // Use startsWith because Telegram truncates poll options to ~100 chars
        const matchingFull = poll.options.find(
          (o) => {
            const short = parseTheme(o).short;
            return short === winnerShort || short.startsWith(winnerShort.replace(/\.{3}$/, ""));
          },
        );
        if (matchingFull) {
          const parsed = parseTheme(matchingFull);
          shortTheme = parsed.short;
          // Store the COMPLETE original string (title + description)
          fullTheme = matchingFull;
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
          // Store the COMPLETE original string (title + description)
          fullTheme = poll.options[0];
        }
      }
      await storage.deletePoll(chatId, type);
    }

    const topicId = config.topics[type];
    const MS_PER_HOUR = 3600000;
    const durations = {
      daily: 24 * MS_PER_HOUR,
      weekly: 7 * 24 * MS_PER_HOUR,
      monthly: 28 * 24 * MS_PER_HOUR,
    };
    const startedAt = Date.now();
    const endsAt = startedAt + durations[type];

    const dateFormat = { day: "numeric", month: "short" };
    const startDateStr = new Date(startedAt).toLocaleString("ru-RU", dateFormat);
    const endDateStr = new Date(endsAt).toLocaleString("ru-RU", dateFormat);

    const challengeId = await storage.getNextChallengeId(chatId, type);

    // Use full description in announcement with vote count
    const announcement = await tg.sendMessage(
      chatId,
      ru.challengeAnnouncement(type, fullTheme, startDateStr, endDateStr, voteCount),
      {
        message_thread_id: topicId || undefined,
      },
    );

    // Pin the announcement
    try {
      await tg.pinChatMessage(chatId, announcement.message_id);
    } catch (e) {
      console.error("Failed to pin announcement:", e.message);
    }

    // Store short theme for leaderboard/stats display
    await storage.saveChallenge(chatId, {
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

    const activeTopics = await storage.getActiveTopics(chatId);
    activeTopics[topicId] = type;
    await storage.setActiveTopics(chatId, activeTopics);

    // Save theme to history (to avoid repetition in future)
    await storage.addThemeToHistory(chatId, type, shortTheme);

    console.log(`Challenge started: community=${chatId}, ${type} #${challengeId} - "${shortTheme}" (${voteCount} votes)`);
  } catch (e) {
    console.error(`startChallenge error (${type}):`, {
      error: e.message,
      stack: e.stack,
    });
  }
}

async function handleCronForCommunity(env, chatId, config, tg, storage, h, d, w, day, weekday) {
  // Get schedule for this community
  const schedule = await getSchedule(storage, chatId);
  const pollHourBefore = 12; // Poll starts 12 hours before challenge

  // Daily challenge
  const dailyPollHour = (schedule.daily.challengeHour - pollHourBefore + 24) % 24;
  if (h === dailyPollHour && day === "*" && weekday === "*") {
    await generatePoll(env, chatId, config, tg, storage, "daily");
  } else if (h === schedule.daily.challengeHour && day === "*" && weekday === "*") {
    await startChallenge(env, chatId, config, tg, storage, "daily");
  }

  // Weekly challenge
  const weeklyPollDay = (schedule.weekly.challengeDay + 6) % 7; // Day before
  if (h === schedule.weekly.pollHour && w === weeklyPollDay) {
    await generatePoll(env, chatId, config, tg, storage, "weekly");
  } else if (h === schedule.weekly.challengeHour && w === schedule.weekly.challengeDay) {
    await startChallenge(env, chatId, config, tg, storage, "weekly");
  }

  // Monthly challenge
  const monthlyPollDay = schedule.monthly.challengeDay === 1 ? 28 : schedule.monthly.challengeDay - 3;
  if (h === schedule.monthly.pollHour && d === monthlyPollDay) {
    await generatePoll(env, chatId, config, tg, storage, "monthly");
  } else if (h === schedule.monthly.challengeHour && d === schedule.monthly.challengeDay) {
    await startChallenge(env, chatId, config, tg, storage, "monthly");
  }
}

async function handleCron(env, tg, storage, cron) {
  try {
    const [, hour, day, weekday] = cron.split(" ");
    const h = parseInt(hour, 10);
    const d = parseInt(day, 10);
    const w = parseInt(weekday, 10);

    console.log(`Cron: ${cron}`);

    // Get all active communities (returns array of config objects)
    const communityConfigs = await getAllActiveCommunities(env, storage);

    if (communityConfigs.length === 0) {
      console.log("Cron: no active communities");
      return;
    }

    console.log(`Cron: processing ${communityConfigs.length} communities`);

    // Process each community - configs already contain chatId
    for (const config of communityConfigs) {
      try {
        const chatId = config.chatId;
        if (!chatId) continue;

        await handleCronForCommunity(env, chatId, config, tg, storage, h, d, w, day, weekday);
      } catch (e) {
        console.error(`Cron error for community ${config.chatId}:`, {
          error: e.message,
          stack: e.stack,
        });
      }
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
          version: "2.4.0",
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
    // Формат: /admin/{action}/{type}?chat_id={chatId}
    // ============================================

    // POST /admin/poll/daily|weekly|monthly?chat_id=123 - создать опрос
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

      const chatIdParam = url.searchParams.get("chat_id");
      if (!chatIdParam) {
        return new Response(JSON.stringify({ error: "Missing chat_id parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const chatId = parseInt(chatIdParam, 10);

      try {
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);
        const config = await getConfigForChat(env, storage, chatId);

        if (!config) {
          return new Response(JSON.stringify({ error: "Community not registered" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Delete existing poll if any
        await storage.deletePoll(chatId, type);
        await generatePoll(env, chatId, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "poll", type, chatId }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /admin/start/daily|weekly|monthly?chat_id=123 - запустить челлендж
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

      const chatIdParam = url.searchParams.get("chat_id");
      if (!chatIdParam) {
        return new Response(JSON.stringify({ error: "Missing chat_id parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const chatId = parseInt(chatIdParam, 10);

      try {
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);
        const config = await getConfigForChat(env, storage, chatId);

        if (!config) {
          return new Response(JSON.stringify({ error: "Community not registered" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        await startChallenge(env, chatId, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "start", type, chatId }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST /admin/finish/daily|weekly|monthly?chat_id=123 - завершить челлендж
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

      const chatIdParam = url.searchParams.get("chat_id");
      if (!chatIdParam) {
        return new Response(JSON.stringify({ error: "Missing chat_id parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const chatId = parseInt(chatIdParam, 10);

      try {
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);
        const config = await getConfigForChat(env, storage, chatId);

        if (!config) {
          return new Response(JSON.stringify({ error: "Community not registered" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        await finishChallenge(env, chatId, config, tg, storage, type);

        return new Response(JSON.stringify({ success: true, action: "finish", type, chatId }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // GET /admin/status?chat_id=123 - посмотреть текущее состояние сообщества
    // GET /admin/status - список всех сообществ
    if (url.pathname === "/admin/status") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const chatIdParam = url.searchParams.get("chat_id");

      try {
        const storage = new Storage(env.CHALLENGE_KV);

        if (chatIdParam) {
          // Status for specific community
          const chatId = parseInt(chatIdParam, 10);
          const [daily, weekly, monthly, pollDaily, pollWeekly, pollMonthly, activeTopics] = await Promise.all([
            storage.getChallenge(chatId, "daily"),
            storage.getChallenge(chatId, "weekly"),
            storage.getChallenge(chatId, "monthly"),
            storage.getPoll(chatId, "daily"),
            storage.getPoll(chatId, "weekly"),
            storage.getPoll(chatId, "monthly"),
            storage.getActiveTopics(chatId),
          ]);

          return new Response(JSON.stringify({
            chatId,
            challenges: { daily, weekly, monthly },
            polls: { daily: !!pollDaily, weekly: !!pollWeekly, monthly: !!pollMonthly },
            activeTopics,
          }, null, 2), {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          // List all communities
          const communities = await getAllActiveCommunities(env, storage);
          const communitiesData = await getCommunities(storage);

          return new Response(JSON.stringify({
            totalCommunities: communities.length,
            maxCommunities: MAX_COMMUNITIES,
            communities: communitiesData,
          }, null, 2), {
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Info (protected with ADMIN_SECRET) - list all communities
    if (url.pathname === "/info") {
      try {
        const authHeader = request.headers.get("Authorization");
        if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const storage = new Storage(env.CHALLENGE_KV);
        const communities = await getAllActiveCommunities(env, storage);
        const communitiesData = await getCommunities(storage);

        return new Response(
          JSON.stringify({
            configured: !!env.BOT_TOKEN,
            version: "3.0.0-multi",
            maxCommunities: MAX_COMMUNITIES,
            totalCommunities: communities.length,
            communities: communitiesData,
            legacyChatId: env.CHAT_ID ? parseInt(env.CHAT_ID, 10) : null,
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

        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        // Handlers determine community dynamically from update
        if (update.message) {
          await handleMessage(update, env, tg, storage);
        } else if (update.message_reaction) {
          await handleReaction(update, env, storage);
        } else if (update.message_reaction_count) {
          await handleReactionCount(update, env, storage);
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
      if (!env.BOT_TOKEN) {
        console.error("Scheduled job skipped: missing BOT_TOKEN");
        return;
      }

      const tg = new TelegramAPI(env.BOT_TOKEN);
      const storage = new Storage(env.CHALLENGE_KV);

      // handleCron iterates over all registered communities
      await handleCron(env, tg, storage, event.cron);
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
