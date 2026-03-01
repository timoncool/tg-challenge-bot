// ============================================
// TG CHALLENGE BOT - Multi-Community Version
// Поддержка до 10 сообществ в одном воркере
// ============================================

// Эмодзи-исключение (негативная реакция)
const EXCLUDED_EMOJI = "🌚";

// Максимальное количество сообществ
const MAX_COMMUNITIES = 10;

// Лимиты работ на пользователя по типам челленджей
const SUBMISSION_LIMITS = {
  daily: 1,
  weekly: 3,
  monthly: 5,
};

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
// HTML FORMATTING (Telegram parse_mode: HTML)
// ============================================

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Strip HTML tags (for polls which don't support HTML)
function stripHtml(text) {
  if (!text) return "";
  return String(text).replace(/<[^>]*>/g, "");
}

const fmt = {
  b: (text) => `<b>${escapeHtml(text)}</b>`,
  i: (text) => `<i>${escapeHtml(text)}</i>`,
  u: (text) => `<u>${escapeHtml(text)}</u>`,
  s: (text) => `<s>${escapeHtml(text)}</s>`,
  code: (text) => `<code>${escapeHtml(text)}</code>`,
  pre: (text) => `<pre>${escapeHtml(text)}</pre>`,
  link: (text, url) => `<a href="${url}">${escapeHtml(text)}</a>`,
  spoiler: (text) => `<tg-spoiler>${escapeHtml(text)}</tg-spoiler>`,
  blockquote: (text) => `<blockquote>${escapeHtml(text)}</blockquote>`,
};

// ============================================
// ЛОКАЛИЗАЦИЯ
// ============================================

const ru = {
  challengeTypes: {
    daily: "⚡ Челлендж дня",
    weekly: "🎯 Челлендж недели",
    monthly: "👑 Челлендж месяца",
  },
  pollQuestion: (type) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    const emoji = { daily: "⚡", weekly: "🎯", monthly: "👑" };
    return `${emoji[type]} Голосование за тему ${labels[type]} челленджа`;
  },
  // HTML formatted challenge announcement
  challengeAnnouncement: (type, topic, startDate, endDate, voteCount = 0) => {
    const labels = {
      daily: "ЧЕЛЛЕНДЖ ДНЯ",
      weekly: "ЧЕЛЛЕНДЖ НЕДЕЛИ",
      monthly: "ЧЕЛЛЕНДЖ МЕСЯЦА",
    };
    const emoji = { daily: "⚡", weekly: "🎯", monthly: "👑" };
    const voteLine = voteCount > 0 ? ` <i>(${voteCount} голосов)</i>` : "";

    return `${emoji[type]} <b>${labels[type]}</b>
${startDate} — ${endDate}${voteLine}

💎 <b>ЗАДАНИЕ:</b>
${topic}

📸 Отправьте изображение в эту тему
🏆 Лучшая работа — по реакциям
🌚 Не учитывается

<i>/stats · /leaderboard · /current</i>`;
  },
  // Winner announcement for winners topic
  winnerAnnouncementFull: (username, score, type, topic) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };

    return `🏆 <b>Победитель ${labels[type]} челленджа</b>

${escapeHtml(username)} — <b>${score}</b> реакций

<i>${stripHtml(topic)}</i>`;
  },
  winnerAnnouncement: (username, score, type) => {
    const labels = {
      daily: "дневного",
      weekly: "недельного",
      monthly: "месячного",
    };
    return `🏆 <b>Победитель ${labels[type]} челленджа</b>

${escapeHtml(username)} — <b>${score}</b> реакций

<i>Поздравляем!</i> 🎉`;
  },
  noSubmissions: "😔 <i>В этом челлендже не было участников.</i>",
  submissionLimitReached: (current, max) => {
    const workWord = pluralize(current, "работу", "работы", "работ");
    const maxWord = pluralize(max, "работа", "работы", "работ");
    return `⚠️ Вы уже отправили <b>${current}</b> ${workWord} в этот челлендж (максимум <b>${max}</b> ${maxWord})`;
  },
  workAccepted: (current, max) => {
    if (max === 1) return "✅ <b>Работа принята!</b>";
    return `✅ <b>Работа принята</b> (${current}/${max})`;
  },
  leaderboardTitle: (type) => {
    const labels = {
      daily: "дневных",
      weekly: "недельных",
      monthly: "месячных",
    };
    return `🏆 <b>Топ-10 победителей ${labels[type]} челленджей</b>`;
  },
  helpMessage: (schedule) => {
    const fmtSched = formatSchedule(schedule);
    return `<b>Бот для нейро-арт челленджей</b>

<b>Как участвовать:</b>
1. Дождитесь объявления темы
2. Отправьте изображение в тему челленджа
3. Ставьте реакции работам других
4. Побеждает работа с наибольшим числом реакций

<b>Расписание:</b>
• Дневные — ${fmtSched.daily}
• Недельные — ${fmtSched.weekly}
• Месячные — ${fmtSched.monthly}

<b>Команды:</b>
/current — активные челленджи
/stats — ваша статистика
/leaderboard — топ победителей
/suggest — предложить тему

<i>Реакция 🌚 не учитывается</i>`;
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

// Удалить сообщество (with cascading delete of all community data)
async function removeCommunity(storage, chatId) {
  const communities = await getCommunities(storage);

  if (!communities[String(chatId)]) {
    return { success: false, error: "Сообщество не найдено" };
  }

  // First, delete all community-related data from KV
  const cascadeResult = await storage.deleteAllCommunityData(chatId);
  console.log(`Community ${chatId} cascade delete result:`, cascadeResult);

  // Check if cascade delete succeeded before removing from list
  if (!cascadeResult.success) {
    console.error(`Community ${chatId} cascade delete failed, not removing from list`);
    return {
      success: false,
      error: "Не удалось удалить все данные сообщества",
      deletedKeys: cascadeResult.deleted || 0,
      failedKeys: cascadeResult.failed || 0,
    };
  }

  // Then remove from communities list
  delete communities[String(chatId)];
  await storage.set("communities:list", communities);

  return { success: true, deletedKeys: cascadeResult.deleted || 0 };
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

  async sendHtml(chatId, text, options = {}) {
    return this.sendMessage(chatId, text, { ...options, parse_mode: "HTML" });
  }

  async sendPoll(chatId, question, options, params = {}) {
    // Strip HTML tags (polls don't support HTML) and truncate to 100 chars
    options = options.map((opt) => {
      const clean = stripHtml(opt);
      if (clean.length > 100) {
        return clean.substring(0, 97) + "...";
      }
      return clean;
    });

    return this.request("sendPoll", {
      chat_id: chatId,
      question,
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

// TTL Constants (in seconds)
const TTL = {
  SUBMISSIONS: 60 * 24 * 3600,      // 60 days - for annual stats calculation
  REACTIONS: 60 * 24 * 3600,        // 60 days
  CHALLENGES: 90 * 24 * 3600,       // 90 days - keep finished challenges for history
  SUGGESTIONS: 7 * 24 * 3600,       // 7 days
  ACTIVE_TOPICS: 31 * 24 * 3600,    // 31 days fallback
  POLLS: 7 * 24 * 3600,             // 7 days - polls are temporary, deleted after use
  WEBHOOK_DEDUP: 3600,              // 1 hour
};

class Storage {
  constructor(kv) {
    this.kv = kv;
  }

  // Get with error handling
  async get(key, options = {}) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const data = await this.kv.get(key, "json");
        return data;
      } catch (error) {
        console.error(`KV get error (attempt ${attempt + 1}/${maxRetries}):`, { key, error: error.message });
        if (attempt === maxRetries - 1) throw error;
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }

  // Set with optional TTL and error handling
  async set(key, value, options = {}) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const kvOptions = {};
        if (options.expirationTtl) {
          kvOptions.expirationTtl = options.expirationTtl;
        }
        await this.kv.put(key, JSON.stringify(value), kvOptions);
        return;
      } catch (error) {
        console.error(`KV set error (attempt ${attempt + 1}/${maxRetries}):`, { key, error: error.message });
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        if (attempt === maxRetries - 1) {
          throw error; // Always throw on last attempt
        }
        // Wait longer for rate limits
        const delay = isRateLimit ? Math.pow(2, attempt) * 500 : Math.pow(2, attempt) * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  async delete(key) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.kv.delete(key);
        return;
      } catch (error) {
        console.error(`KV delete error (attempt ${attempt + 1}/${maxRetries}):`, { key, error: error.message });
        if (attempt === maxRetries - 1) throw error;
        // Wait longer for rate limits
        const isRateLimit = error.message?.includes('429') || error.status === 429;
        const delay = isRateLimit ? Math.pow(2, attempt) * 500 : Math.pow(2, attempt) * 100;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // List keys with prefix (for cascading delete) - with retries
  async list(options = {}) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.kv.list(options);
      } catch (error) {
        console.error(`KV list error (attempt ${attempt + 1}/${maxRetries}):`, { options, error: error.message });
        if (attempt === maxRetries - 1) {
          // Return empty but mark as incomplete so caller knows it failed
          return { keys: [], list_complete: false, error: error.message };
        }
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
  }

  // Helper to build community-prefixed key
  _key(chatId, ...parts) {
    return `community:${chatId}:${parts.join(":")}`;
  }

  // Challenge (per-community) - with TTL for finished challenges
  async getChallenge(chatId, type) {
    return this.get(this._key(chatId, "challenge", type));
  }

  async saveChallenge(chatId, challenge) {
    // Apply TTL only when challenge is finished, active challenges stay indefinitely
    const options = challenge.status === 'finished' ? { expirationTtl: TTL.CHALLENGES } : {};
    await this.set(this._key(chatId, "challenge", challenge.type), challenge, options);
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
    // Polls have TTL as fallback cleanup (they're explicitly deleted when used)
    await this.set(this._key(chatId, "poll", poll.type), poll, { expirationTtl: TTL.POLLS });
  }

  async deletePoll(chatId, type) {
    await this.delete(this._key(chatId, "poll", type));
  }

  // Submissions (per-community) - with TTL for automatic cleanup
  async getSubmissions(chatId, type, challengeId) {
    return (await this.get(this._key(chatId, "submissions", type, challengeId))) || [];
  }

  async addSubmission(chatId, type, challengeId, submission, customLimit = null) {
    const submissions = await this.getSubmissions(chatId, type, challengeId);
    // Check for duplicate message
    if (submissions.some((s) => s.messageId === submission.messageId)) {
      return { success: false, reason: "duplicate" };
    }
    // Count user's submissions and check limit
    const userSubmissions = submissions.filter((s) => s.userId === submission.userId);
    const limit = customLimit ?? SUBMISSION_LIMITS[type] ?? 1;
    if (userSubmissions.length >= limit) {
      return { success: false, reason: "limit", current: userSubmissions.length, max: limit };
    }
    submissions.push(submission);
    // Save with TTL for automatic cleanup
    await this.set(this._key(chatId, "submissions", type, challengeId), submissions, { expirationTtl: TTL.SUBMISSIONS });

    // Track participation in leaderboard (first submission per challenge counts as 1 participation)
    if (userSubmissions.length === 0) {
      await this.addParticipation(chatId, type, submission.userId, submission.username);
    }

    return { success: true, current: userSubmissions.length + 1, max: limit };
  }

  async updateSubmissionScore(chatId, type, challengeId, messageId, score) {
    const submissions = await this.getSubmissions(chatId, type, challengeId);
    const submission = submissions.find((s) => s.messageId === messageId);
    if (submission) {
      submission.score = score;
      await this.set(this._key(chatId, "submissions", type, challengeId), submissions, { expirationTtl: TTL.SUBMISSIONS });
    }
  }

  // Leaderboard (per-community) - stores wins AND participations for annual stats
  async getLeaderboard(chatId, type) {
    const map = (await this.get(this._key(chatId, "leaderboard", type))) || {};
    // Sort by wins descending, then by participations descending
    return Object.values(map).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.participations || 0) - (a.participations || 0);
    });
  }

  // Add participation (called on first submission to a challenge)
  async addParticipation(chatId, type, userId, username) {
    const map = (await this.get(this._key(chatId, "leaderboard", type))) || {};
    const key = String(userId);
    if (!map[key]) {
      // Backward compatible: initialize with wins=0, participations=0
      map[key] = { userId, username, wins: 0, participations: 0 };
    }
    // Ensure participations field exists (backward compatibility)
    if (typeof map[key].participations !== 'number') {
      map[key].participations = 0;
    }
    map[key].participations += 1;
    map[key].lastParticipation = Date.now();
    if (username) map[key].username = username;
    // Leaderboard is permanent - no TTL
    await this.set(this._key(chatId, "leaderboard", type), map);
  }

  async addWin(chatId, type, userId, username) {
    const map = (await this.get(this._key(chatId, "leaderboard", type))) || {};
    const key = String(userId);
    if (!map[key]) {
      map[key] = { userId, username, wins: 0, participations: 0 };
    }
    // Ensure fields exist with correct types (backward compatibility)
    if (typeof map[key].wins !== 'number') {
      map[key].wins = 0;
    }
    if (typeof map[key].participations !== 'number') {
      map[key].participations = 0;
    }
    map[key].wins += 1;
    map[key].lastWin = Date.now();
    if (username) map[key].username = username;
    await this.set(this._key(chatId, "leaderboard", type), map);
  }

  async getUserStats(chatId, type, userId) {
    const leaderboard = await this.getLeaderboard(chatId, type);
    const index = leaderboard.findIndex((e) => e.userId === userId);
    if (index === -1) return { wins: 0, participations: 0, rank: leaderboard.length + 1 };
    const entry = leaderboard[index];
    return {
      wins: entry.wins,
      participations: entry.participations || 0,  // backward compatibility
      rank: index + 1
    };
  }

  // Active topics (per-community) - with TTL as fallback cleanup
  async getActiveTopics(chatId) {
    return (await this.get(this._key(chatId, "active_topics"))) || {};
  }

  async setActiveTopics(chatId, topics) {
    await this.set(this._key(chatId, "active_topics"), topics, { expirationTtl: TTL.ACTIVE_TOPICS });
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
    // Храним последние 50 тем для исключения повторов
    await this.set(this._key(chatId, "theme_history", type), history.slice(0, 100));
  }

  // Массовое добавление тем (все варианты опроса)
  async addThemesToHistory(chatId, type, themes) {
    const history = await this.getThemeHistory(chatId, type);
    const lowerHistory = history.map(t => t.toLowerCase());
    const newThemes = themes.filter(t => !lowerHistory.includes(t.toLowerCase()));
    history.unshift(...newThemes);
    await this.set(this._key(chatId, "theme_history", type), history.slice(0, 100));
  }

  // Content mode (per-community)
  async getContentMode(chatId) {
    return (await this.get(this._key(chatId, "settings", "content_mode"))) || DEFAULT_CONTENT_MODE;
  }

  async setContentMode(chatId, mode) {
    await this.set(this._key(chatId, "settings", "content_mode"), mode);
  }

  // Reactions (per-community) - with TTL for automatic cleanup
  async getReactions(chatId, challengeType, challengeId, messageId) {
    return (await this.get(this._key(chatId, "reactions", challengeType, challengeId, messageId))) || {};
  }

  async setReactions(chatId, challengeType, challengeId, messageId, reactionsMap) {
    await this.set(this._key(chatId, "reactions", challengeType, challengeId, messageId), reactionsMap, { expirationTtl: TTL.REACTIONS });
  }

  // ============================================
  // SUGGESTIONS (предложения тем от пользователей)
  // ============================================

  // Получить все предложения для типа челленджа
  async getSuggestions(chatId, type) {
    return (await this.get(this._key(chatId, "suggestions", type))) || [];
  }

  // Добавить новое предложение - with TTL for automatic cleanup
  async addSuggestion(chatId, type, suggestion) {
    const suggestions = await this.getSuggestions(chatId, type);
    suggestions.push(suggestion);
    await this.set(this._key(chatId, "suggestions", type), suggestions, { expirationTtl: TTL.SUGGESTIONS });
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

    await this.set(this._key(chatId, "suggestions", type), suggestions, { expirationTtl: TTL.SUGGESTIONS });
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

  // Лимиты работ на пользователя (per-community, per-type)
  async getSubmissionLimits(chatId) {
    const limits = await this.get(this._key(chatId, "settings", "submission_limits"));
    return {
      daily: limits?.daily ?? SUBMISSION_LIMITS.daily,
      weekly: limits?.weekly ?? SUBMISSION_LIMITS.weekly,
      monthly: limits?.monthly ?? SUBMISSION_LIMITS.monthly,
    };
  }

  async setSubmissionLimit(chatId, type, limit) {
    const current = await this.getSubmissionLimits(chatId);
    current[type] = limit;
    await this.set(this._key(chatId, "settings", "submission_limits"), current);
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

  // Accept links setting (per-community) - wrapper for consistent access
  async getAcceptLinks(chatId) {
    return (await this.get(this._key(chatId, "settings", "accept_links"))) ?? false;
  }

  async setAcceptLinks(chatId, value) {
    await this.set(this._key(chatId, "settings", "accept_links"), value);
  }

  // ============================================
  // CASCADING DELETE (for community removal)
  // ============================================

  // Delete all data for a community - called when community is unregistered
  async deleteAllCommunityData(chatId) {
    const prefix = `community:${chatId}:`;
    let deleted = 0;
    let failed = 0;
    let cursor = undefined;
    let listError = null;

    try {
      // Iterate through all keys with prefix and delete them
      do {
        const result = await this.list({ prefix, cursor });

        // Check if list operation failed
        if (result.error) {
          listError = result.error;
          console.error(`List operation failed for community ${chatId}:`, listError);
          break;
        }

        for (const key of result.keys) {
          try {
            await this.kv.delete(key.name);
            deleted++;
          } catch (e) {
            console.error(`Failed to delete key ${key.name}:`, e.message);
            failed++;
          }
        }
        cursor = result.list_complete ? undefined : result.cursor;
      } while (cursor);

      const success = !listError && failed === 0;
      console.log(`Cascading delete for community ${chatId}: deleted=${deleted}, failed=${failed}, listError=${listError}`);
      return { success, deleted, failed, listError };
    } catch (error) {
      console.error(`Cascading delete error for community ${chatId}:`, error.message);
      return { success: false, error: error.message, deleted, failed };
    }
  }
}

// ============================================
// AI SERVICE (multi-provider: gemini / openai-compatible)
// ============================================

function getAiConfig(env) {
  return {
    provider: env.AI_PROVIDER,
    apiUrl: env.AI_API_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  };
}

async function generateThemes(aiConfig, type, language = "ru", previousThemes = [], contentMode = "vanilla") {
  const { provider, apiUrl, apiKey, model } = aiConfig;
  const typeNames = { daily: "ДНЕВНОГО", weekly: "НЕДЕЛЬНОГО", monthly: "МЕСЯЧНОГО" };
  const typeName = typeNames[type] || "ДНЕВНОГО";

  // Corpus примеров для каждого режима
  const corpus = {
    vanilla: [
      "Сейлор Мун", "Дама с собачкой", "Велма Динкли (Scooby-Doo)", "Три сестры", "Свободная. Цвет: чёрный",
      "Пастух и пастушка", "только проснулась", "Статуя Свободы", "яблоневый сад", "Африка", "12 месяцев",
      "Валькирия", "Богини", "очень длинные волосы", "На'ви (Avatar)", "медсестра (винтаж)", "Дриада",
      "кошатница", "с подарком", "альбиносы", "веснушки", "с букетом", "будущие мамы", "на рыбалке",
      "в балетной пачке", "наездница", "репетитор", "Спящая красавица", "на закате", "среди цветов",
      "Галадриэль (LoTR)", "овощи и фрукты", "в городском парке", "Холи - праздник красок", "близняшки",
      "среди берёз", "косы и косички", "Мардж Симпсон", "с книгой", "Ромео и Джульетта", "Зубная фея",
      "сладости", "Лея Органа (ЗВ)", "труженицы", "в очках", "кадр из ч/б фильма", "морячка", "в музее",
      "домик в деревне", "джинсовая одежда", "чаепитие", "царевна", "знаменитые блондинки", "знаменитые брюнетки",
      "на велосипеде", "Татьяна Ларина", "мороженое", "волшебный источник", "первый снег",
      "Акварель, Юбка, Библиотека", "в рубашке", "на мосту", "бабочки", "у камина", "белые розы",
      "стюардесса", "селянка с яблоками", "девушка с мандаринами", "Хозяюшка", "в модной куртке",
      "прогулка вдвоем", "летнее кафе", "Пастушка", "водопад", "urban photo", "мама Дяди Фёдора",
      "кабинет врача", "день студента", "индейцы америки", "балерина", "актриса", "археолог", "подснежники",
      "теннис", "весенний букет", "переезд", "Барби", "счастливая", "француженка", "Lollipop", "Top model",
      "печеньки", "коктейль", "телескоп", "в пижаме на работе", "яйца", "невеста", "одуванчик", "верхом",
      "химик", "первый день лета", "солнечный зайчик", "Фа Мулан", "урожай", "олимпийская грация",
      "славянская богиня", "алые паруса", "голубоглазая", "лебедь", "вышивка", "проводница", "светофор",
      "физкультура", "яблоки", "бантики", "радуга", "йога", "губы", "туфельки", "парикмахер", "дельфин",
      "журавли", "княгиня", "бургер", "смайлик", "сомелье", "сбор грибов", "русские сказки", "дракон",
      "море", "улыбка", "лилии", "Гжель", "цирк", "балерина", "рынок", "мягкая игрушка"
    ],
    medium: [
      "сбежавшая невеста", "Призрак старого замка", "Американский оборотень в Москве", "Хэллоуин",
      "персонажи фэнтези", "Кордицепс (мутанты)", "рай, ад, противостояние", "радиационная опасность",
      "Обитатели сумасшедшего дома", "японская гравюра", "sci-fi, анабиоз", "идет ночью одна",
      "играющая с огнём", "в заброшенном доме", "Марсианка", "Эйприл О'Нил (TMNT)", "Сияние",
      "Большой Бада Бум", "метель и стужа", "долина роз", "Невеста Франкенштейна", "киллер",
      "зимние скульптуры", "Человек-амфибия", "долина смерти", "Средневековый Киберпанк",
      "Гермиона Грейнджер", "зимняя сказка", "Снегурочка и дракон", "алхимия", "Падший ангел",
      "Похищенная пришельцами", "Техноведьма (steampunk)", "Повелительница тьмы", "Космическая Амазонка",
      "в сеттинге постапокалипсиса", "катастрофа", "необитаемый остров", "в стиле милитари", "дикарка",
      "фарфоровая кукла", "Индия", "Лара Крофт", "Лепреконша", "свет и тьма", "Скандинавия. Руны",
      "Рыжая Соня", "крысолюди", "шаолиньское кунг-фу", "цыганка", "прогулка по Луне",
      "истребительница вампиров", "космохоррор", "ржавчина", "мутанты", "Женщина-кошка",
      "татуировка дракона", "при свечах", "инопланетные миры", "гоблины", "Героини ВОВ", "шаманка",
      "в Матрице", "Полёт Маргариты", "вуду", "Дикий Ангел", "космические пираты", "Славянское фэнтези",
      "сильный ветер", "Яутжа (Predator)", "кроваво-красный", "воскрешение", "в паутине",
      "Планета обезьян", "паника", "туман", "страшная русалка", "изобретательница", "первый контакт",
      "Оракул", "киберпанк фея", "Дверь в лето", "Невесты Дракулы", "старая ведьма", "ледниковый период",
      "мистический подвал", "осколки", "чародейка", "тролль", "шахматы", "принцесса в доспехах",
      "руины древнего города", "нашествие", "рептилоиды", "Ван Хельсинг (женская версия)",
      "злая Красная Шапочка", "пекло", "портал", "гаргулья", "Харли Квинн", "звездопад", "медиум",
      "Wednesday Addams", "магический идол", "лучница", "Бесы", "сестра Бене Гессерит", "Колизей",
      "маяк и вино", "Унесённые призраками", "Вакханалия", "хоббиты", "на краю света",
      "принцесса и колдун", "монастырь, sci-fi", "фэнтези таверна", "Дроу, тёмные эльфы",
      "Садако Ямамура", "Женщина-олень", "Культ Дагона", "богатырши", "Зорро", "Трисс Меригольд",
      "Рэмбо (женская версия)", "Зубастики", "Тринити (The Matrix)", "монголочки", "Claire Redfield",
      "Звонок", "Снежная королева", "Джинкс/Jinx", "Маления (Elden Ring)", "Вампир", "Berserk",
      "Valhalla", "Принцесса Мононоке"
    ],
    nsfw: [
      "в купе поезда", "пояс верности", "Мокрые майки", "наложницы", "секс-кукла-робот",
      "инкубы и суккубы", "натурщица в студии", "еда и нагота", "красная комната", "латекс",
      "Я такая пьяная...", "бронелифчик", "в бане/сауне", "шибари", "шубы и меха", "голая вечеринка",
      "пляжная полиция", "автостопщица", "огромная грудь", "женская тюрьма", "невольничий рынок",
      "креативный пирсинг", "культуристка", "ахегао", "мисс гибкость", "буйство красок", "в борделе",
      "эротика из 90-ых", "вебкам модель", "выпускной", "постер к фильму 18+", "Лилит", "поцелуй",
      "блудница", "микро бикини", "доминатрикс", "необычная кровать", "в военной форме", "невесомость",
      "эротика ренессанса", "футуристический корсет", "вид снизу", "дама под вуалью",
      "с папиком в клубешнике", "беременность, sci-fi", "предложение руки и сердца",
      "Kitana (Mortal Kombat)", "кибер горничная", "Эдем, падшие", "Rayne (BloodRayne)",
      "В ночь на пляже", "на плоту", "Гоночные королевы", "золото и бархат", "Завтрак в постель",
      "Ёлки. Тёлки. Озеро", "В легинсах", "Полненькие девушки", "кибер руки", "в мехах", "На дне",
      "в ванне с пеной", "чернокнижница", "На сеновале", "Грустный понедельник", "бильярд", "Госпожа",
      "между двумя мирами", "Шоколад", "Нищенка", "Прикосновения", "Личный секретарь", "Ночная бабочка",
      "Царица подводного мира", "Стриптиз", "Похмелье", "Запретный плод", "Барбарелла", "Блины",
      "Бондаж", "Девушки с большими пушками", "Стейк", "Сантехник", "Рабыня", "BDSM", "After party",
      "Оргазм", "Под каблуком", "Холостяк", "Дальнобойщица", "Бюстгальтер", "Чудачка", "Milf",
      "Ночной дожор", "Осенняя хандра", "Бездомная", "Баня", "Заложница", "Босс",
      "в сеттинге Blade Runner", "кожа и металл", "этюд втроем", "яблоневый сад (ню)", "Индия (эротика)",
      "фарфоровая кукла (nsfw)", "дикарка (ню)", "латекс (sci-fi)", "костюм зайки", "у окна (ню)",
      "глюки (сюрреализм)", "склеп (готика)", "Hula Girl", "микро бикини", "кудрявые (ню)"
    ]
  };

  // ИЗОЛИРОВАННАЯ ЛОГИКА ДЛЯ КАЖДОГО РЕЖИМА
  let selectedCorpus = [];
  let specificInstruction = "";

  if (contentMode === "vanilla") {
    selectedCorpus = corpus.vanilla;
    specificInstruction = `ТОЛЬКО SFW (БЕЗОПАСНО): Красота, уют, природа, сказки, персонажи Disney/Ghibli/Sailor Moon.
СТРОГИЙ ЗАПРЕТ: Никакой эротики, наготы, фетишей, мрака, крови или насилия. Темы должны быть светлыми и вдохновляющими.`;
  } else if (contentMode === "medium") {
    selectedCorpus = [...corpus.vanilla, ...corpus.medium];
    specificInstruction = `МИКС КРАСОТЫ И ДРАМЫ: Поп-культура, культовые персонажи кино и игр (Лара Крофт, Матрица, Черепашки-ниндзя). Нуар, триллер, крутые герои, интрига.
БЕЗ ПОРНО: Допускается мрачность и дерзость, но без открытой эротики и фетишей.`;
  } else if (contentMode === "nsfw") {
    selectedCorpus = corpus.nsfw;
    specificInstruction = `ТОЛЬКО NSFW (18+): Жесткая эротика, фетиши (латекс, шибари, бондаж), сексуальные ситуации, акцент на обнаженном теле и материалах.
ПРАВИЛО: Тема должна быть провокационной, смелой и сексуальной.`;
  }

  const history = previousThemes.length > 0 ? `\nИсключить (уже использованы): ${previousThemes.join(", ")}` : "";

  const prompt = `Ты — креативный директор арт-сообщества. Твоя задача: родить 6 мощных тем для ${typeName} челленджа.
Режим: ${contentMode.toUpperCase()}.

ПРАВИЛА ТЕКУЩЕГО РЕЖИМА:
${specificInstruction}

═══════════════════════════════════════════
СТРОГОЕ ПРАВИЛО РАЗНООБРАЗИЯ ТИПОВ ТЕМ:
Из 6 тем ОБЯЗАТЕЛЬНО должны быть разные ТИПЫ. НЕ БОЛЬШЕ 2 тем одного типа!

ТИПЫ ТЕМ (каждый тип должен быть представлен):

1. ПЕРСОНАЖ (конкретное имя из кино/игр/аниме/литературы) — МАКСИМУМ 1-2 штуки!
   Примеры: Лара Крофт, Тринити, Wednesday Addams, Сейлор Мун, Харли Квинн

2. СИТУАЦИЯ/МОМЕНТ (что происходит, действие, состояние) — минимум 1
   Примеры: только проснулась, сбежавшая невеста, играющая с огнём, переезд, первый контакт

3. МЕСТО/ПЕЙЗАЖ/ЛОКАЦИЯ (где происходит, окружение) — минимум 1
   Примеры: яблоневый сад, в заброшенном доме, фэнтези таверна, на краю света, море, руины древнего города

4. СТИЛЬ/ЭСТЕТИКА/МЭШАП (художественное направление, сочетание стилей) — минимум 1
   Примеры: Средневековый Киберпанк, японская гравюра, кадр из ч/б фильма, Гжель, Славянское фэнтези

5. МАТЕРИАЛ/ТЕКСТУРА/ОБЪЕКТ (акцент на предмете, материале, детали) — по желанию
   Примеры: латекс, ржавчина, золото и бархат, бабочки, мягкая игрушка, осколки

6. ТИПАЖ/ОБРАЗ (профессия, архетип, НЕ конкретное имя) — по желанию
   Примеры: балерина, шаманка, киллер, археолог, дикарка, чародейка, богатырши
═══════════════════════════════════════════

ЗАПРЕЩЕНО: давать 3+ персонажей с конкретными именами! Разнообразие типов — главный приоритет.

ФОРМАТ: короткие темы как в примерах — от одного слова до фразы.

БАЗА ПРИМЕРОВ (стиль, наглость, длина — используй для вдохновения, НЕ копируй):
${selectedCorpus.join(", ")}
${history}

ОТВЕТЬ ТОЛЬКО JSON МАССИВОМ СТРОК:
["тема 1", "тема 2", "тема 3", "тема 4", "тема 5", "тема 6"]`;

  try {
    console.log("AI API запрос...", { provider, model, type, contentMode, hasApiKey: !!apiKey });

    let response, text;

    if (provider === "openai") {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Ты — креативный директор русскоязычного арт-сообщества. Отвечай ТОЛЬКО на русском языке. Формат: валидный JSON массив строк на русском." },
            { role: "user", content: prompt },
          ],
          temperature: 0.95,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API ошибка:", { status: response.status, body: errorText });
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      text = data.choices?.[0]?.message?.content || "";
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    } else {
      const url = apiUrl;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
            responseMimeType: "application/json",
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API ошибка:", { status: response.status, body: errorText });
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      // Gemini 2.5+ может вернуть thinking в parts[0], текст в последнем part
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = "";
      for (const part of parts) {
        if (part.text && !part.thought) text = part.text;
      }
    }

    console.log("AI API статус:", response.status);

    if (!text) {
      throw new Error("API пустой ответ");
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error(`Не удалось распарсить: ${text.substring(0, 200)}`);
      }
    }

    let themes = Array.isArray(parsed) ? parsed : Object.values(parsed).find(v => Array.isArray(v));
    if (!themes || themes.length < 6) {
      throw new Error(`Нужно 6 тем, получено: ${themes ? themes.length : 0}`);
    }

    const validThemes = themes.slice(0, 6).map(t =>
      typeof t === "string" ? t.trim() : (t.topic || t.theme || t.text || t.content || String(t))
    );
    console.log("AI темы:", validThemes);
    return validThemes;

  } catch (e) {
    console.error("AI ошибка:", { message: e.message, stack: e.stack });
    throw e;
  }
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
      await tg.sendHtml(chatId, ru.helpMessage(schedule), {
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
        await tg.sendHtml(chatId, `✅ <b>Сообщество зарегистрировано!</b>

📛 <b>Название:</b> ${escapeHtml(name)}
🆔 <b>ID:</b> <code>${chatId}</code>
📊 Всего: ${result.count}/${MAX_COMMUNITIES}

<b>Теперь настройте топики:</b>
<code>/set_daily</code> — дневные челленджи
<code>/set_weekly</code> — недельные
<code>/set_monthly</code> — месячные
<code>/set_winners</code> — победители`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        await tg.sendHtml(chatId, `❌ <b>Ошибка:</b> ${escapeHtml(result.error)}`, {
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
        await tg.sendHtml(chatId, `📭 <i>Нет зарегистрированных сообществ.</i>\n\n<i>Используйте</i> <code>/register_community</code>`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        let msg = `📋 <b>СООБЩЕСТВА</b> (${list.length}/${MAX_COMMUNITIES})\n\n`;
        for (const c of list) {
          const isCurrent = c.chatId === chatId ? " ← <i>текущее</i>" : "";
          msg += `• <b>${escapeHtml(c.name)}</b>${isCurrent}\n  ID: <code>${c.chatId}</code>\n`;
        }
        await tg.sendHtml(chatId, msg, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Удалить сообщество: /unregister_community
    if (command === "/unregister_community" && isAdmin) {
      const result = await removeCommunity(storage, chatId);
      if (result.success) {
        await tg.sendHtml(chatId, `✅ <b>Сообщество удалено из бота.</b>`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        await tg.sendHtml(chatId, `❌ <b>Ошибка:</b> ${escapeHtml(result.error)}`, {
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
        await tg.sendHtml(chatId, `⚠️ <i>Сообщество не зарегистрировано.</i>\n\n<i>Используйте</i> <code>/register_community</code>`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Get topic ID - для настройки
    if (command === "/topic_id" && isAdmin) {
      const topicInfo = threadId
        ? `🆔 <b>ID темы:</b> <code>${threadId}</code>\n\n<b>Команды:</b>\n<code>/set_daily</code> · <code>/set_weekly</code> · <code>/set_monthly</code> · <code>/set_winners</code>`
        : "⚠️ <i>Это общий чат. Напиши команду внутри темы форума.</i>";
      await tg.sendHtml(chatId, topicInfo, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Set topic commands (per-community)
    if (command === "/set_daily" && isAdmin) {
      if (!threadId) {
        await tg.sendHtml(chatId, "⚠️ <i>Напиши команду внутри темы форума</i>", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.daily = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendHtml(chatId, `✅ <b>Тема для дневных челленджей установлена</b>`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_weekly" && isAdmin) {
      if (!threadId) {
        await tg.sendHtml(chatId, "⚠️ <i>Напиши команду внутри темы форума</i>", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.weekly = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendHtml(chatId, `✅ <b>Тема для недельных челленджей установлена</b>`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_monthly" && isAdmin) {
      if (!threadId) {
        await tg.sendHtml(chatId, "⚠️ <i>Напиши команду внутри темы форума</i>", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.monthly = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendHtml(chatId, `✅ <b>Тема для месячных челленджей установлена</b>`, {
        message_thread_id: threadId,
      });
      return;
    }

    if (command === "/set_winners" && isAdmin) {
      if (!threadId) {
        await tg.sendHtml(chatId, "⚠️ <i>Напиши команду внутри темы форума</i>", { message_thread_id: undefined });
        return;
      }
      const topics = config.topics || {};
      topics.winners = threadId;
      await setCommunityTopics(storage, chatId, topics);
      await tg.sendHtml(chatId, `✅ <b>Тема для победителей установлена</b>`, {
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
        await tg.sendHtml(
          chatId,
          `🎨 <b>РЕЖИМЫ КОНТЕНТА</b>

📍 Текущий: ${CONTENT_MODES[currentMode].name}

<b>Доступные режимы:</b>
${modesList}

<i>Использование:</i> <code>/set_content_mode режим</code>
<i>Пример:</i> <code>/set_content_mode medium</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setContentMode(chatId, mode);
      const modeInfo = CONTENT_MODES[mode];
      await tg.sendHtml(
        chatId,
        `✅ <b>Режим контента изменён</b>\n\n${modeInfo.name}\n<i>${modeInfo.description}</i>`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Toggle accepting link previews as submissions: /set_accept_links on|off
    if (command === "/set_accept_links" && isAdmin) {
      const args = text.trim().split(/\s+/).slice(1);
      const value = args[0]?.toLowerCase();

      const currentValue = await storage.getAcceptLinks(chatId);

      if (!value || !["on", "off", "1", "0", "true", "false"].includes(value)) {
        const status = currentValue ? "ВКЛ" : "ВЫКЛ";
        await tg.sendHtml(
          chatId,
          `🔗 <b>ПРИЁМ ССЫЛОК С ПРЕВЬЮ</b>

📍 Текущий статус: <b>${status}</b>

<i>Когда включено, сообщения со ссылками (с OpenGraph превью) принимаются как работы в челлендж.</i>

<i>Использование:</i> <code>/set_accept_links on|off</code>
<i>Пример:</i> <code>/set_accept_links on</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      const newValue = ["on", "1", "true"].includes(value);
      await storage.setAcceptLinks(chatId, newValue);

      await tg.sendHtml(
        chatId,
        `✅ <b>Приём ссылок с превью:</b> ${newValue ? "ВКЛЮЧЁН ✅" : "ВЫКЛЮЧЕН ❌"}`,
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
        await tg.sendHtml(
          chatId,
          `⭐ <b>МИНИМУМ РЕАКЦИЙ ДЛЯ ПРЕДЛОЖЕНИЙ ТЕМ</b>

📍 Текущее значение: <b>${currentValue}</b>

<i>Предложенная тема попадёт в опрос, если наберёт достаточно реакций до начала голосования.</i>

<i>Использование:</i> <code>/set_suggestion_reactions ЧИСЛО</code>
<i>Пример:</i> <code>/set_suggestion_reactions 5</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      if (value < 1 || value > 50) {
        await tg.sendHtml(
          chatId,
          "⚠️ <b>Ошибка:</b> значение должно быть от <b>1</b> до <b>50</b>",
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setMinSuggestionReactions(chatId, value);

      await tg.sendHtml(
        chatId,
        `✅ <b>Минимум реакций для предложений:</b> ${value}`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Очистка предложений тем
    const clearSuggestionsMatch = command.match(/^\/clear_suggestions(?:_(daily|weekly|monthly))?$/);
    if (clearSuggestionsMatch && isAdmin) {
      let type = clearSuggestionsMatch[1]; // daily|weekly|monthly или undefined для всех

      // Если тип не указан, пробуем определить по топику
      if (!type && threadId && config) {
        if (config.topics.daily === threadId) type = "daily";
        else if (config.topics.weekly === threadId) type = "weekly";
        else if (config.topics.monthly === threadId) type = "monthly";
      }

      const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };

      if (type) {
        // Очищаем конкретный тип
        const suggestions = await storage.getSuggestions(chatId, type);
        await storage.clearSuggestions(chatId, type);
        await tg.sendHtml(
          chatId,
          `🗑 Очищено <b>${suggestions.length}</b> предложений для ${typeNames[type]} челленджа.`,
          { message_thread_id: threadId || undefined }
        );
      } else {
        // Очищаем все типы
        let total = 0;
        for (const t of ["daily", "weekly", "monthly"]) {
          const suggestions = await storage.getSuggestions(chatId, t);
          total += suggestions.length;
          await storage.clearSuggestions(chatId, t);
        }
        await tg.sendHtml(
          chatId,
          `🗑 Очищено <b>${total}</b> предложений для всех типов челленджей.`,
          { message_thread_id: threadId || undefined }
        );
      }
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
          await tg.sendHtml(chatId, `⏰ <b>Расписание дневных челленджей</b>\n\n<i>Формат:</i> <code>/schedule_daily ЧАС</code>\n<i>Пример:</i> <code>/schedule_daily 17</code>`, {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.daily = { ...kvSchedule.daily, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        await tg.sendHtml(chatId, `✅ <b>Дневные челленджи:</b> ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "weekly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 0 || day > 6 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendHtml(chatId, `⏰ <b>Расписание недельных челленджей</b>\n\n<i>День:</i> 0=вс, 1=пн, ..., 6=сб\n<i>Формат:</i> <code>/schedule_weekly ДЕНЬ ЧАС</code>\n<i>Пример:</i> <code>/schedule_weekly 0 17</code>`, {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.weekly = { ...kvSchedule.weekly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
        await tg.sendHtml(chatId, `✅ <b>Недельные челленджи:</b> ${dayNames[day]} ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "monthly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 1 || day > 28 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendHtml(chatId, `⏰ <b>Расписание месячных челленджей</b>\n\n<i>День:</i> 1-28\n<i>Формат:</i> <code>/schedule_monthly ДЕНЬ ЧАС</code>\n<i>Пример:</i> <code>/schedule_monthly 1 17</code>`, {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.monthly = { ...kvSchedule.monthly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        await tg.sendHtml(chatId, `✅ <b>Месячные челленджи:</b> ${day}-го числа в ${hour}:00`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Submission limits: /set_limit_daily 3, /set_limit_weekly 5, /set_limit_monthly 7
    const limitMatch = command.match(/^\/set_limit_(daily|weekly|monthly)$/);
    if (limitMatch && isAdmin) {
      const type = limitMatch[1];
      const args = text.trim().split(/\s+/).slice(1);
      const limit = parseInt(args[0], 10);

      if (isNaN(limit) || limit < 1 || limit > 20) {
        const currentLimits = await storage.getSubmissionLimits(chatId);
        await tg.sendHtml(chatId, `<b>Лимиты работ на участника:</b>

• Дневной: ${currentLimits.daily}
• Недельный: ${currentLimits.weekly}
• Месячный: ${currentLimits.monthly}

<i>Формат: /set_limit_${type} ЧИСЛО (1-20)
Пример: /set_limit_${type} 3</i>`, {
          message_thread_id: threadId || undefined,
        });
        return;
      }

      await storage.setSubmissionLimit(chatId, type, limit);
      const typeNames = { daily: "дневных", weekly: "недельных", monthly: "месячных" };
      await tg.sendHtml(chatId, `✅ <b>Лимит для ${typeNames[type]} челленджей:</b> ${limit} работ`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    if (command === "/admin" && isAdmin) {
      const schedule = await getSchedule(storage, chatId);
      const fmt = formatSchedule(schedule);
      const currentMode = await storage.getContentMode(chatId);
      const modeInfo = CONTENT_MODES[currentMode];
      const acceptLinks = await storage.getAcceptLinks(chatId);
      const minSuggestionReactions = await storage.getMinSuggestionReactions(chatId);
      const submissionLimits = await storage.getSubmissionLimits(chatId);
      const communityName = config.name || `ID: ${chatId}`;
      await tg.sendHtml(
        chatId,
        `<b>АДМИН-ПАНЕЛЬ</b>
Сообщество: ${escapeHtml(communityName)}

<b>Опросы</b>
/poll_daily · /poll_weekly · /poll_monthly

<b>Запуск</b>
/run_daily · /run_weekly · /run_monthly

<b>Завершение</b>
/finish_daily · /finish_weekly · /finish_monthly

<b>Статистика</b>
/status · /cs_daily · /cs_weekly · /cs_monthly
/test_ai — проверить Gemini API

<b>Настройка тем</b>
/set_daily · /set_weekly · /set_monthly · /set_winners

<b>Режим контента:</b> ${modeInfo.name}
/set_content_mode — изменить

<b>Ссылки с превью:</b> ${acceptLinks ? "ВКЛ" : "ВЫКЛ"}
/set_accept_links — вкл/выкл

<b>Лимиты работ:</b> ${submissionLimits.daily}/${submissionLimits.weekly}/${submissionLimits.monthly}
/set_limit_daily · /set_limit_weekly · /set_limit_monthly

<b>Расписание:</b>
• Дневные: ${fmt.daily}
• Недельные: ${fmt.weekly}
• Месячные: ${fmt.monthly}
/schedule_daily · /schedule_weekly · /schedule_monthly

<b>Предложения тем:</b>
/clear_suggestions — очистить
/set_suggestion_reactions — мин. реакций (сейчас: ${minSuggestionReactions})

<b>Сообщества</b>
/register_community · /list_communities
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
        if (!c) return `${name}: <i>нет</i>`;
        if (c.status !== "active") return `${name}: <i>завершён</i>`;
        const endDateStr = new Date(c.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short" });
        return `${name}: до <b>${endDateStr}</b>\n   <i>${escapeHtml(c.topic)}</i>`;
      };

      const statusMsg = `📊 <b>СТАТУС</b>

<b>Опросы</b>
⚡ Дневной: ${pollDaily ? "✅" : "❌"}
🎯 Недельный: ${pollWeekly ? "✅" : "❌"}
👑 Месячный: ${pollMonthly ? "✅" : "❌"}

<b>Челленджи</b>
${formatChallenge(daily, "⚡ Дневной")}
${formatChallenge(weekly, "🎯 Недельный")}
${formatChallenge(monthly, "👑 Месячный")}`;

      await tg.sendHtml(chatId, statusMsg, { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Current challenge stats - /cs_daily, /cs_weekly, /cs_monthly (per-community)
    const csMatch = command.match(/^\/cs_(daily|weekly|monthly)$/);
    if (csMatch && isAdmin) {
      const type = csMatch[1];
      const challenge = await storage.getChallenge(chatId, type);
      const typeNames = { daily: "Дневной", weekly: "Недельный", monthly: "Месячный" };

      if (!challenge || challenge.status !== "active") {
        await tg.sendHtml(chatId, `${typeNames[type]} челлендж\n\n<i>Нет активного</i> 😴`, {
          message_thread_id: threadId || undefined,
        });
        return;
      }

      const submissions = await storage.getSubmissions(chatId, type, challenge.id);
      const endDateStr = new Date(challenge.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

      if (submissions.length === 0) {
        await tg.sendHtml(chatId, `<b>${typeNames[type]} челлендж</b>\n\n🎯 <b>Тема:</b> ${escapeHtml(challenge.topic)}\n⏰ <b>До:</b> ${endDateStr}\n\n<i>Пока нет работ</i> 😴`, {
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
        `${i + 1}. @${escapeHtml(s.username || String(s.userId))} — <b>${s.score}</b>`
      ).join("\n");

      await tg.sendHtml(chatId, `<b>${typeNames[type]} челлендж</b>\n\n🎯 <b>Тема:</b> ${escapeHtml(challenge.topic)}\n⏰ <b>До:</b> ${endDateStr}\n👥 <b>Участников:</b> ${submissions.length}\n\n${list}`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Admin: Test Gemini API - тестирует боевой промпт для 6 тем
    if (command === "/test_ai" && isAdmin) {
      const aiCfg = getAiConfig(env);
      await tg.sendHtml(chatId, `🔄 <i>Проверяю AI (${aiCfg.provider}/${aiCfg.model})...</i>`, { message_thread_id: threadId || undefined });
      try {
        const contentMode = await storage.getContentMode(chatId);
        const themes = await generateThemes(aiCfg, "daily", "ru", [], contentMode);

        let msg = `✅ <b>${aiCfg.provider}/${aiCfg.model}</b> (режим: <i>${contentMode}</i>)\n\n`;
        themes.forEach((theme, i) => {
          msg += `${i + 1}. ${theme}\n\n`;
        });

        await tg.sendHtml(chatId, msg.substring(0, 4000), { message_thread_id: threadId || undefined });
      } catch (e) {
        await tg.sendHtml(chatId, `❌ <b>Ошибка:</b> ${escapeHtml(e.message)}`, { message_thread_id: threadId || undefined });
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
      const totalWins = daily.wins + weekly.wins + monthly.wins;
      const totalParticipations = (daily.participations || 0) + (weekly.participations || 0) + (monthly.participations || 0);

      const winsWord = pluralize(totalWins, "победа", "победы", "побед");
      const partWord = pluralize(totalParticipations, "участие", "участия", "участий");

      // Format: wins/participations for each type
      const formatStat = (s) => `${s.wins}/${s.participations || 0}`;

      await tg.sendHtml(
        chatId,
        `📊 <b>Ваша статистика</b>\n\n🏆 Побед: <b>${totalWins}</b> ${winsWord}\n🎨 Участий: <b>${totalParticipations}</b> ${partWord}\n\n⚡ Дневные: <b>${formatStat(daily)}</b> (#${daily.rank})\n🎯 Недельные: <b>${formatStat(weekly)}</b> (#${weekly.rank})\n👑 Месячные: <b>${formatStat(monthly)}</b> (#${monthly.rank})\n\n<i>Формат: побед/участий</i>`,
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

      // Detect type from argument or topic
      let type = typeMap[args[1]?.toLowerCase()];
      if (!type && threadId && config) {
        if (config.topics.daily === threadId) type = "daily";
        else if (config.topics.weekly === threadId) type = "weekly";
        else if (config.topics.monthly === threadId) type = "monthly";
      }
      if (!type) type = "daily";

      const leaderboard = await storage.getLeaderboard(chatId, type);
      if (leaderboard.length === 0) {
        await tg.sendHtml(
          chatId,
          `📭 <i>Рейтинг ${ru.challengeTypes[type]} пока пуст</i>`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      let msg = ru.leaderboardTitle(type) + `\n\n`;
      leaderboard.slice(0, 10).forEach((e, i) => {
        const medal = medals[i] || `${i + 1}.`;
        const username = escapeHtml(e.username || `User ${e.userId}`);
        const participations = e.participations || 0;
        // Show wins/participations format
        msg += `${medal} ${username} — <b>${e.wins}</b>/${participations}\n`;
      });
      msg += `\n<i>Формат: побед/участий</i>`;

      // Show user's position if not in top 10
      const userId = message.from?.id;
      if (userId) {
        const userIndex = leaderboard.findIndex((e) => e.userId === userId);
        if (userIndex >= 10) {
          const userEntry = leaderboard[userIndex];
          msg += `\n<i>Ваше место: #${userIndex + 1} (${userEntry.wins}/${userEntry.participations || 0})</i>`;
        }
      }

      await tg.sendHtml(chatId, msg, {
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
        // Use topicFull for HTML formatting, fallback to topic
        return `${ru.challengeTypes[type]} (до ${endDateStr})\n${c.topicFull || c.topic}`;
      };

      await tg.sendHtml(
        chatId,
        `🎨 <b>Активные челленджи</b>\n\n${format(daily, "daily")}\n\n${format(weekly, "weekly")}\n\n${format(monthly, "monthly")}`,
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
        await tg.sendHtml(
          chatId,
          `❓ Укажите тип челленджа:\n<code>/suggest_daily</code>, <code>/suggest_weekly</code> или <code>/suggest_monthly</code>\n\nИли используйте <code>/suggest</code> в теме нужного челленджа.`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      // Парсинг текста предложения: всё после команды
      const textAfterCommand = text.replace(/^\/suggest(?:_\w+)?\s*@?\w*\s*/i, "").trim();

      if (!textAfterCommand) {
        const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
        const minReactionsHelp = await storage.getMinSuggestionReactions(chatId);
        await tg.sendHtml(
          chatId,
          `💡 <b>Предложите тему</b> для ${typeNames[type]} челленджа\n\n<b>Пример:</b>\n<code>/suggest Ребёнок Чебурашки и Крокодила Гены на прогулке</code>\n\nЕсли тема наберёт <b>${minReactionsHelp}+</b> реакций, она попадёт в опрос! 🎯`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      // Просто текст темы, без разделения
      const themeText = textAfterCommand;

      // Валидация длины
      if (themeText.length < 5) {
        await tg.sendHtml(
          chatId,
          "⚠️ Слишком короткое предложение.",
          { message_thread_id: threadId || undefined, reply_to_message_id: message.message_id },
        );
        return;
      }

      if (themeText.length > 500) {
        await tg.sendHtml(
          chatId,
          "⚠️ Слишком длинное предложение (макс. 500 символов).",
          { message_thread_id: threadId || undefined, reply_to_message_id: message.message_id },
        );
        return;
      }

      // Rate limiting: не чаще 1 предложения в минуту от одного пользователя
      const allSuggestions = await storage.getSuggestions(chatId, type);
      const userId = message.from?.id;
      const userLastSuggestion = allSuggestions
        .filter((s) => s.userId === userId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

      if (userLastSuggestion && Date.now() - (userLastSuggestion.createdAt || 0) < 60000) {
        const waitSec = Math.ceil((60000 - (Date.now() - userLastSuggestion.createdAt)) / 1000);
        await tg.sendHtml(
          chatId,
          `⏳ Подождите ${waitSec} сек. перед следующим предложением.`,
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

      const suggestionMsg = await tg.sendHtml(
        chatId,
        `💡 <b>ПРЕДЛОЖЕНИЕ ТЕМЫ</b> (${typeNames[type]})

${escapeHtml(themeText)}

<i>Автор: ${escapeHtml(authorName)}</i>

👍 Поставь реакцию на этот пост — тема попадёт в опрос (нужно <b>${minReactions}+</b>)`,
        { message_thread_id: threadId || undefined },
      );

      // Сохраняем предложение
      const suggestion = {
        id: suggestionId,
        messageId: suggestionMsg.message_id,
        userId: message.from?.id,
        username: message.from?.username || message.from?.first_name,
        theme: themeText,
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
        console.error("Could not delete suggest command:", e.message);
      }

      console.log(`Suggestion created: community=${chatId}, type=${type}, id=${suggestionId}, theme="${themeText}"`);
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
        await tg.sendHtml(
          chatId,
          "❓ Укажите тип: <code>/suggestions_daily</code>, <code>/suggestions_weekly</code>, <code>/suggestions_monthly</code>",
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const suggestions = await storage.getSuggestions(chatId, type);
      const typeNames = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
      const minReactionsList = await storage.getMinSuggestionReactions(chatId);

      if (suggestions.length === 0) {
        await tg.sendHtml(
          chatId,
          `📭 Нет предложений для ${typeNames[type]} челленджа.\n\n<b>Предложите тему:</b> <code>/suggest_${type} Название | Описание</code>`,
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
        const themePreview = (s.theme || s.title || "").substring(0, 50) + ((s.theme || s.title || "").length > 50 ? "..." : "");
        msg += `${status} ${escapeHtml(themePreview)} — ${s.reactionCount || 0} реакций\n   ${escapeHtml(authorName)}\n\n`;
      }

      msg += `Для участия в голосовании нужно <b>${minReactionsList}+</b> реакций.`;

      await tg.sendHtml(chatId, msg, { message_thread_id: threadId || undefined });
      return;
    }

    // Photo submission (includes photos, image documents, and links with previews)
    const hasPhoto = message.photo && message.photo.length > 0;
    const hasImageDocument = message.document?.mime_type?.startsWith("image/");
    // Check for link with preview (OpenGraph images)
    const hasLinkPreview = message.entities?.some(e => e.type === "url") &&
                          (message.link_preview_options || message.web_page);

    // Check community setting for accepting link previews
    const acceptLinks = await storage.getAcceptLinks(chatId);
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
        await tg.sendHtml(
          chatId,
          "😴 <i>Сейчас нет активного челленджа в этой теме</i>",
          {
            message_thread_id: threadId || undefined,
            reply_to_message_id: message.message_id,
          },
        );
        return;
      }

      if (Date.now() > challenge.endsAt) {
        await tg.sendHtml(
          chatId,
          "⏰ <i>Время челленджа истекло</i>",
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

      // Get submission limit for this community and type
      const limits = await storage.getSubmissionLimits(chatId);
      const limit = limits[challengeType];

      // Try to add submission (handles duplicates and limits)
      const result = await storage.addSubmission(chatId, challengeType, challenge.id, {
        messageId: message.message_id,
        userId: message.from?.id,
        username: message.from?.username || message.from?.first_name,
        score: 0,
        timestamp: Date.now(),
      }, limit);

      if (!result.success) {
        if (result.reason === "limit") {
          await tg.sendHtml(
            chatId,
            ru.submissionLimitReached(result.current, result.max),
            {
              message_thread_id: threadId || undefined,
              reply_to_message_id: message.message_id,
            },
          );
        }
        // For duplicates, silently ignore
        return;
      }

      // Confirmation message
      await tg.sendHtml(chatId, ru.workAccepted(result.current, result.max), {
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
      actor_chat_id: reaction.actor_chat?.id,
      new_reaction: reaction.new_reaction,
      old_reaction: reaction.old_reaction,
    }));

    // Check if this community is registered
    if (!await hasAccessToChat(env, storage, chatId)) {
      console.log("Reaction ignored: community not registered", { chatId });
      return;
    }

    // Support both user reactions and channel/anonymous admin reactions (actor_chat)
    const voterId = reaction.user?.id || reaction.actor_chat?.id;
    if (!voterId) {
      console.log("Reaction ignored: no user_id or actor_chat_id", { chatId, messageId: reaction.message_id });
      return;
    }

    // ============================================
    // ПРОВЕРКА: это реакция на предложение темы?
    // ============================================
    const suggestionResult = await storage.findSuggestionByMessageId(chatId, reaction.message_id);
    if (suggestionResult) {
      const { suggestion, type } = suggestionResult;

      // Игнорируем самореакции (автор не может голосовать за своё предложение)
      if (voterId === suggestion.userId) {
        console.log("Suggestion reaction ignored: self-reaction", { voterId, messageId: reaction.message_id });
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
      const updated = await storage.updateSuggestionReactions(chatId, type, reaction.message_id, voterId, hasValidReaction);

      if (updated) {
        console.log(`Suggestion reaction: community=${chatId}, type=${type}, msg=${reaction.message_id}, voter=${voterId}, valid=${hasValidReaction}, totalReactions=${updated.reactionCount}`);
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

    // Ignore self-reactions (user/channel reacting to their own post)
    if (submission && voterId === submission.userId) {
      console.log("Reaction ignored: self-reaction", { voterId, messageId: reaction.message_id });
      return;
    }

    // Use storage methods for consistent TTL and key handling
    const reactionsMap = await storage.getReactions(chatId, challengeType, challenge.id, reaction.message_id);
    reactionsMap[String(voterId)] = userScore;  // Convert voterId to string for consistency
    await storage.setReactions(chatId, challengeType, challenge.id, reaction.message_id, reactionsMap);

    // Calculate total score from all voters
    const totalScore = Object.values(reactionsMap).reduce((sum, s) => sum + s, 0);

    await storage.updateSubmissionScore(
      chatId,
      challengeType,
      challenge.id,
      reaction.message_id,
      totalScore,
    );

    console.log(`Reaction scored: community=${chatId}, type=${challengeType}, msg=${reaction.message_id}, voter=${voterId}, userScore=${userScore}, totalScore=${totalScore}`);
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
    const contentMode = await storage.getContentMode(chatId);

    // ============================================
    // ДОБАВЛЯЕМ ОДОБРЕННЫЕ ПРЕДЛОЖЕНИЯ ПОЛЬЗОВАТЕЛЕЙ
    // ============================================
    const minReactionsPoll = await storage.getMinSuggestionReactions(chatId);
    const approvedSuggestions = await storage.getApprovedSuggestions(chatId, type, minReactionsPoll);

    // Берём темы из предложений
    const suggestionThemes = approvedSuggestions.map((s) => s.theme || s.title || s.description);

    // Генерируем AI-темы (меньше, если есть предложения от пользователей)
    const aiThemeCount = Math.max(2, 6 - suggestionThemes.length);
    let aiThemes = [];

    if (aiThemeCount >= 2) {
      aiThemes = await generateThemes(getAiConfig(env), type, "ru", previousThemes, contentMode);
      // Ограничиваем количество AI-тем
      aiThemes = aiThemes.slice(0, aiThemeCount);
    }

    // Объединяем: сначала предложения пользователей, потом AI-темы
    const allThemes = [...suggestionThemes, ...aiThemes].slice(0, 6);

    // Для poll используем темы напрямую (или short для обратной совместимости со старыми данными)
    const pollOptions = allThemes.map((t) => {
      // Обратная совместимость: если тема в старом формате "short | full", берём short
      const parsed = parseTheme(t);
      return parsed.short;
    });

    // Validate: need at least 2 options for poll
    if (pollOptions.length < 2) {
      console.error(`generatePoll: not enough themes for ${type}, community=${chatId}`);
      return;
    }

    // Отправляем poll напрямую (темы теперь короткие и влезают)
    const poll = await tg.sendPoll(
      chatId,
      ru.pollQuestion(type),
      pollOptions,
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

    // Сохраняем ВСЕ варианты опроса в историю, чтобы они не повторялись в будущих опросах
    await storage.addThemesToHistory(chatId, type, pollOptions);

    // Очищаем ВСЕ предложения после создания опроса
    // (не только одобренные, чтобы пользователи могли предложить новые темы в следующем цикле)
    await storage.clearSuggestions(chatId, type);

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
      await tg.sendHtml(chatId, ru.noSubmissions, {
        message_thread_id: challenge.topicThreadId || undefined,
      });
    } else {
      // Filter to keep only the best submission per user
      // If a user has multiple submissions with same score, keep the earlier one
      const bestSubmissionPerUser = {};
      for (const s of submissions) {
        const best = bestSubmissionPerUser[s.userId];
        if (
          !best ||
          s.score > best.score ||
          (s.score === best.score && (s.timestamp || 0) < (best.timestamp || 0))
        ) {
          bestSubmissionPerUser[s.userId] = s;
        }
      }
      const uniqueSubmissions = Object.values(bestSubmissionPerUser);

      // Find max score and all winners with that score
      const maxScore = Math.max(...uniqueSubmissions.map((s) => s.score));
      const winners = uniqueSubmissions.filter((s) => s.score === maxScore);

      // Format winner names
      const winnerNames = winners
        .map((w) => (w.username ? `@${w.username}` : `Участник #${w.userId}`))
        .join(", ");

      await tg.sendHtml(
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
            await tg.sendHtml(
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
        // Handle truncated options (100 char limit) and HTML stripping
        const matchingFull = poll.options.find((o) => {
          // Strip HTML because poll options are displayed without HTML tags
          const short = stripHtml(parseTheme(o).short);
          if (short === winnerShort) return true;
          // If winnerShort ends with "...", compare prefix
          if (winnerShort.endsWith("...")) {
            return short.startsWith(winnerShort.slice(0, -3));
          }
          return false;
        });
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
    const announcement = await tg.sendHtml(
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
      startedAt,
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
          await env.CHALLENGE_KV.put(dedupKey, "1", { expirationTtl: TTL.WEBHOOK_DEDUP });
        }

        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        // Handlers determine community dynamically from update
        if (update.message) {
          await handleMessage(update, env, tg, storage);
        } else if (update.message_reaction) {
          await handleReaction(update, env, storage);
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
