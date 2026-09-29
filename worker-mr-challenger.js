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

// Output cap for theme generation; override per engine with maxTokens in the AI config.
const AI_MAX_TOKENS = 5000;

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

// ============================================
// MESSAGES OVERRIDE (settings:messages KV) — управляется из админки
// ============================================
// Cached per isolate for 60 s: an edit in the admin panel reaches the chat within a minute.
let __MSG_CACHE = { at: 0, data: null };
async function loadMessages(kv) {
  if (__MSG_CACHE.data && Date.now() - __MSG_CACHE.at < 60_000) return __MSG_CACHE.data;
  try {
    const o = (await kv.get("settings:messages", "json")) || {};
    __MSG_CACHE = { at: Date.now(), data: o };
    return o;
  } catch (e) {
    console.error("loadMessages failed:", e.message);
    return {};
  }
}
// helper — substitute {placeholders}
function tpl(str, vars) {
  if (typeof str !== "string") return "";
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

// ============================================
// DEFAULT TEXTS — everything the bot writes in the chat that the admin panel can override
// (settings:messages, same keys). The public template worker.js is this file with the block
// below replaced by template/texts.js: `node scripts/build-template.mjs`.
// ============================================
// <texts>
const DEFAULT_TEXTS = {
  // Реплики Mr. Challenger при принятии работы (случайная)
  submissionReactions: [
    "✅ <b>Принято.</b> Выглядит стильно. 🍷",
    "🎯 О, <i>интересная работа</i>. Засчитано.",
    "👁️ Вижу. <b>Ты в деле.</b>",
    "📸 Отличный кадр. <i>Добавил в список.</i>",
    "✨ Достойно. <b>Участвуешь.</b>",
    "✅ Принято. <i>Ждем оценки остальных.</i>",
    "💾 Сохранил. <b>Выглядит качественно.</b>",
    "🎯 Есть контакт. <i>Работа в игре.</i>",
    "👌 Хорошо вышло. <b>Записано.</b>",
  ],
  // Реплики Mr. Challenger победителю (случайная, {phrase})
  winnerPhrases: [
    "Отличное исполнение. 🎩",
    "Заслуженно. Браво. 👏",
    "Мастерская работа.",
    "Сообщество выбрало. Я согласен.",
    "Впечатляет. Так держать.",
    "Класс. Жду в следующем раунде.",
    "Чистая победа. 🏆",
    "Талант виден. Уважаю.",
    "Сильно. Очень сильно.",
    "Вот это уровень. 🔥",
  ],
  challengeTypeTitles: {
    daily: "⚡ Челлендж дня",
    weekly: "🎩 Челлендж недели",
    monthly: "👑 Челлендж месяца",
  },
  pollQuestion: "Время выбора. Какую тему возьмем в работу?",
  challengeAnnouncementTitles: {
    daily: "⚡ ЧЕЛЛЕНДЖ ДНЯ",
    weekly: "🎩 ЧЕЛЛЕНДЖ НЕДЕЛИ",
    monthly: "👑 ЧЕЛЛЕНДЖ МЕСЯЦА",
  },
  // {title} {voteLine} {topic} {startDate} {endDate}
  challengeAnnouncementTemplate: "<b>{title}</b>\n\nТема выбрана{voteLine}.\nПрием работ открыт до {endDate}.\n\n💎 <b>ЗАДАНИЕ:</b>\n{topic}\n\nЖду ваши работы в этом треде.\nЦеним стиль, идею и качество исполнения.\n\n<i>/stats · /leaderboard · /current</i>",
  // {username} {score} {votes} {phrase}
  winnerAnnouncementTemplate: "🥂 <b>ПОБЕДИТЕЛЬ</b>\n\n{username} забирает этот раунд.\nРезультат: <b>{votes}</b>.\n\n{phrase}",
  // {username} {score} {votes} {topic} {phrase}
  winnerAnnouncementFullTemplate: "🏆 <b>ЛУЧШАЯ РАБОТА</b>\n\nАвтор: {username}\nОценка сообщества: <b>{score}</b> ✨\n\n<i>Тема была: {topic}</i>\n{phrase}",
  noSubmissions: "🤔 <i>Тишина? Жаль. Надеюсь, вы копите силы для следующего раза.</i>",
  noVotes: "🤷 <i>Работы есть, а голосов нет. В этот раз без победителя.</i>",
  // {current} {max} {workWord} {maxWord}
  submissionLimitReached: "⚠️ Уже <b>{current}</b> {workWord} в игре. Максимум — <b>{max}</b> {maxWord}. Терпение.",
  // {label}
  leaderboardTitle: "📜 <b>Рейтинг лучших авторов ({label})</b>",
  leaderboardLabels: {
    daily: "по дням",
    weekly: "за неделю",
    monthly: "за месяц",
  },
  // {dailySched} {weeklySched} {monthlySched}
  helpMessage: "<b>Приветствую. Я Mr. Challenger.</b>\nКурирую творческие соревнования в этом чате.\n\n<b>Как это работает:</b>\n1. Выбираем тему\n2. Вы публикуете работы\n3. Сообщество выбирает лучших реакциями\n\n<b>Расписание:</b>\n• Дневные — {dailySched}\n• Недельные — {weeklySched}\n• Месячные — {monthlySched}\n\n<b>Команды:</b>\n/current — статус челленджей\n/stats — ваша статистика\n/leaderboard — рейтинг победителей\n/suggest — предложить тему\n\n<i>Удачи в челленджах. 🍷</i>",
};
// </texts>

// ============================================
// MESSAGE HELPERS — override from KV (settings:messages) or DEFAULT_TEXTS
// ============================================
function pickText(override, key) {
  return override && Object.prototype.hasOwnProperty.call(override, key) ? override[key] : DEFAULT_TEXTS[key];
}
function pickRandom(override, key) {
  const own = pickText(override, key);
  const list = Array.isArray(own) && own.length ? own : DEFAULT_TEXTS[key];
  return list[Math.floor(Math.random() * list.length)];
}
function votesText(n) {
  return `${n} ${pluralize(n, "голос", "голоса", "голосов")}`;
}
function msgWorkAccepted(override, current, max) {
  const reaction = pickRandom(override, "submissionReactions");
  return max === 1 ? reaction : `${reaction} (${current}/${max})`;
}
function msgSubmissionLimit(override, current, max) {
  return tpl(pickText(override, "submissionLimitReached"), {
    current,
    max,
    workWord: pluralize(current, "работу", "работы", "работ"),
    maxWord: pluralize(max, "работа", "работы", "работ"),
  });
}
function msgNoSubmissions(override) {
  return pickText(override, "noSubmissions");
}
function msgNoVotes(override) {
  return pickText(override, "noVotes");
}
function msgChallengeTypeTitle(override, type) {
  return pickText(override, "challengeTypeTitles")?.[type] || DEFAULT_TEXTS.challengeTypeTitles[type] || type;
}
function msgWinnerAnnouncement(override, username, score) {
  return tpl(pickText(override, "winnerAnnouncementTemplate"), {
    username: escapeHtml(username), score, votes: votesText(score), phrase: pickRandom(override, "winnerPhrases"),
  });
}
function msgWinnerAnnouncementFull(override, username, score, topic) {
  return tpl(pickText(override, "winnerAnnouncementFullTemplate"), {
    username: escapeHtml(username), score, votes: votesText(score), topic: escapeHtml(topic),
    phrase: pickRandom(override, "winnerPhrases"),
  });
}
function msgChallengeAnnouncement(override, type, topic, startDate, endDate, voteCount) {
  const title = pickText(override, "challengeAnnouncementTitles")?.[type] || DEFAULT_TEXTS.challengeAnnouncementTitles[type];
  return tpl(pickText(override, "challengeAnnouncementTemplate"), {
    title,
    voteLine: voteCount > 0 ? ` (${votesText(voteCount)})` : "",
    topic: escapeHtml(topic),
    startDate,
    endDate,
  });
}
function msgPollQuestion(override) {
  return pickText(override, "pollQuestion");
}
function msgLeaderboardTitle(override, type) {
  const label = pickText(override, "leaderboardLabels")?.[type] || DEFAULT_TEXTS.leaderboardLabels[type] || type;
  return tpl(pickText(override, "leaderboardTitle"), { label });
}
function msgHelp(override, schedule) {
  const sched = formatSchedule(schedule);
  return tpl(pickText(override, "helpMessage"), {
    dailySched: sched.daily, weeklySched: sched.weekly, monthlySched: sched.monthly,
  });
}

// ============================================
// КОНФИГУРАЦИЯ (MULTI-COMMUNITY)
// ============================================

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
  if (communityConfig) return communityConfig;

  // Fallback на legacy env config
  const legacyConfig = getLegacyConfig(env);
  if (legacyConfig && legacyConfig.chatId === chatId) return legacyConfig;

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
    result.push(legacyConfig);
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
  const time = (s) => `${s.challengeHour}:${String(s.challengeMinute ?? 0).padStart(2, "0")} UTC`;

  const daily = `каждый день в ${time(schedule.daily)}`;
  const weekly = `${dayNames[schedule.weekly.challengeDay]} в ${time(schedule.weekly)}`;
  const monthly = `${schedule.monthly.challengeDay}-го числа в ${time(schedule.monthly)}`;

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

        let data;
        try {
          data = await response.json();
        } catch {
          // An HTML error page from a proxy in front of Telegram: transient, retried below.
          throw new Error(`HTTP ${response.status}: not a Telegram API response`);
        }

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
        // Client errors are final; network and server errors are retried.
        if (e.message?.startsWith("[4")) {
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
    // Telegram limit is 4096. Cut at a line break: tags never span lines in these messages,
    // so the HTML stays well-formed and the message is not rejected as a whole.
    if (text.length > 4096) {
      console.warn(`Message too long (${text.length}), truncating`);
      const cut = text.lastIndexOf("\n", 4090);
      text = text.substring(0, cut > 0 ? cut : 4090) + "\n…";
    }
    // A deleted target (e.g. the winning work) must not make the whole message fail.
    const { reply_to_message_id: replyTo, ...rest } = options;
    if (replyTo) rest.reply_parameters = { message_id: replyTo, allow_sending_without_reply: true };
    return this.request("sendMessage", { chat_id: chatId, text, ...rest });
  }

  async sendHtml(chatId, text, options = {}) {
    return this.sendMessage(chatId, text, { ...options, parse_mode: "HTML" });
  }

  /** `options` are poll labels (see pollOptionLabel): plain text, unique, at most 100 characters. */
  async sendPoll(chatId, question, options, params = {}) {
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
      allowed_updates: WEBHOOK_ALLOWED_UPDATES,
      max_connections: WEBHOOK_MAX_CONNECTIONS,
    };
    if (secret) params.secret_token = secret;
    return this.request("setWebhook", params);
  }

  async getWebhookInfo() {
    return this.request("getWebhookInfo");
  }
}

// Telegram keeps allowed_updates and max_connections from the last setWebhook call.
const WEBHOOK_ALLOWED_UPDATES = ["message", "message_reaction", "poll"];
// One update at a time: handlers read-modify-write shared KV values (submissions, reactions,
// suggestions), and parallel deliveries would overwrite each other's writes.
const WEBHOOK_MAX_CONNECTIONS = 1;

/**
 * The secret Telegram sends with every update: WEBHOOK_SECRET, or one derived from BOT_TOKEN
 * when it is not set — without a secret anyone who finds the URL can post updates "from" an admin.
 */
async function webhookSecret(env) {
  if (env.WEBHOOK_SECRET) return env.WEBHOOK_SECRET;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.BOT_TOKEN}:webhook`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Once per isolate each: the registration compared with the wanted config, and the
// re-registration after an update that came without the secret.
const webhookSync = { checked: false, resecured: false };

/**
 * A redeploy does not touch the webhook registration; bring it in line. `resecure` re-registers
 * unconditionally: an update without the secret means the registration predates it, and Telegram
 * redelivers the refused update with the header afterwards.
 */
async function ensureWebhookConfig(tg, secret, { resecure = false } = {}) {
  const flag = resecure ? "resecured" : "checked";
  if (webhookSync[flag]) return;
  webhookSync[flag] = true;
  try {
    const info = await tg.getWebhookInfo();
    if (!info?.url) return;
    const allowed = info.allowed_updates || [];
    const upToDate = info.max_connections === WEBHOOK_MAX_CONNECTIONS
      && WEBHOOK_ALLOWED_UPDATES.every((u) => allowed.includes(u));
    if (upToDate && !resecure) return;
    await tg.setWebhook(info.url, secret);
    console.log("Webhook re-registered:", { allowed_updates: WEBHOOK_ALLOWED_UPDATES, max_connections: WEBHOOK_MAX_CONNECTIONS, resecure });
  } catch (e) {
    webhookSync[flag] = false;
    console.error("ensureWebhookConfig failed:", e.message);
  }
}

let botUsername = null;

/** With privacy mode off the bot also sees `/command@other_bot`; those are not ours. */
async function isAddressedToUs(tg, addressee) {
  if (!botUsername) {
    try {
      botUsername = (await tg.request("getMe")).username || "";
    } catch (e) {
      console.error("getMe failed, treating the command as ours:", e.message);
      return true;
    }
  }
  return addressee.toLowerCase() === botUsername.toLowerCase();
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
  ALERTS: 90 * 24 * 3600,           // 90 days - bot alert log shown in the admin panel
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

  // YYYYMMDD + 3 random digits. Submissions and reactions are keyed by this id, so a second
  // challenge of the same type on the same day must not land on an id that already has data.
  async getNextChallengeId(chatId, type) {
    const now = new Date();
    const datePrefix = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = datePrefix * 1000 + Math.floor(Math.random() * 1000);
      if ((await this.getSubmissions(chatId, type, id)).length === 0) return id;
    }
    throw new Error(`no free ${type} challenge id for ${datePrefix}`);
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

  // Telegram `poll` updates carry only the poll id — this maps it back to the community.
  async indexPoll(pollId, chatId, type) {
    await this.set(`poll_index:${pollId}`, { chatId, type }, { expirationTtl: TTL.POLLS });
  }

  async getPollRef(pollId) {
    return this.get(`poll_index:${pollId}`);
  }

  // Live vote counts, shown by the admin dashboard.
  async setPollVotes(chatId, type, votes) {
    await this.set(this._key(chatId, "poll_votes", type), votes, { expirationTtl: TTL.POLLS });
  }

  // Cron slots already fired for this community: { "poll:daily": <slot ms>, … }
  async getCronState(chatId) {
    return this.get(this._key(chatId, "cron_state"));
  }

  async setCronState(chatId, slots) {
    await this.set(this._key(chatId, "cron_state"), slots);
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

  // The last 50 themes are sent to the AI as "do not repeat".
  async addThemesToHistory(chatId, type, themes) {
    const history = (await this.getThemeHistory(chatId, type)).filter((t) => typeof t === "string");
    const lowerHistory = history.map((t) => t.toLowerCase());
    const newThemes = themes.filter((t) => !lowerHistory.includes(t.toLowerCase()));
    history.unshift(...newThemes);
    await this.set(this._key(chatId, "theme_history", type), history.slice(0, 50));
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

// Env AI config (AI_PROVIDER, AI_API_URL, AI_API_KEY, AI_MODEL) — last resort after KV.
function getAiConfigFromEnv(env) {
  return {
    provider: env.AI_PROVIDER,
    apiUrl: env.AI_API_URL,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
  };
}

// Запись AI-попытки в:
//   1) community:{chatId}:ai_history       — last 50, TTL 7d (детальный лог per-community)
//   2) ai:history:global                   — last 200, TTL 30d (общий лог всех вызовов)
//   3) stats:ai:daily:YYYY-MM-DD           — агрегат за день (counts/cost/duration по провайдеру)
async function logAiAttempt(kv, chatId, entry) {
  const stamped = { ts: Date.now(), ...entry, chatId: chatId ?? null };
  try {
    // per-community
    if (chatId) {
      const key = `community:${chatId}:ai_history`;
      const cur = (await kv.get(key, "json")) || [];
      cur.unshift(stamped);
      await kv.put(key, JSON.stringify(cur.slice(0, 50)), { expirationTtl: 7 * 24 * 3600 });
    }
    // global
    const gkey = "ai:history:global";
    const g = (await kv.get(gkey, "json")) || [];
    g.unshift(stamped);
    await kv.put(gkey, JSON.stringify(g.slice(0, 200)), { expirationTtl: 30 * 24 * 3600 });
    // daily aggregate
    const day = new Date().toISOString().slice(0, 10);
    const skey = `stats:ai:daily:${day}`;
    const s = (await kv.get(skey, "json")) || {
      day, totals: { calls: 0, success: 0, fail: 0, totalDurationMs: 0, totalCostUsd: 0, totalTokens: 0 },
      byProvider: {}, byModel: {},
    };
    s.totals.calls++;
    s.totals[entry.success ? "success" : "fail"]++;
    s.totals.totalDurationMs += entry.durationMs || 0;
    if (typeof entry.cost_usd === "number") s.totals.totalCostUsd += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.totals.totalTokens += entry.total_tokens;
    const pkey = entry.provider || "?";
    s.byProvider[pkey] = s.byProvider[pkey] || { calls: 0, cost: 0, tokens: 0 };
    s.byProvider[pkey].calls++;
    if (typeof entry.cost_usd === "number") s.byProvider[pkey].cost += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.byProvider[pkey].tokens += entry.total_tokens;
    const mkey = `${entry.provider || "?"}/${entry.model || "?"}`;
    s.byModel[mkey] = s.byModel[mkey] || { calls: 0, cost: 0, tokens: 0 };
    s.byModel[mkey].calls++;
    if (typeof entry.cost_usd === "number") s.byModel[mkey].cost += entry.cost_usd;
    if (typeof entry.total_tokens === "number") s.byModel[mkey].tokens += entry.total_tokens;
    await kv.put(skey, JSON.stringify(s), { expirationTtl: 90 * 24 * 3600 });
  } catch (e) {
    console.error("logAiAttempt failed:", e.message);
  }
}

// Обёртка над generateThemes с логированием в KV.
async function generateThemesLogged(aiConfig, type, previousThemes, contentMode, kv, chatId) {
  const startedAt = Date.now();
  try {
    const themes = await generateThemes(aiConfig, type, previousThemes, contentMode, await loadPromptOverrides(kv));
    const usage = themes._usage || {};
    await logAiAttempt(kv, chatId, {
      provider: aiConfig.provider, model: aiConfig.model, resolvedModel: usage.resolvedModel ?? null,
      source: aiConfig.source,
      type, contentMode, durationMs: Date.now() - startedAt,
      success: true, themesCount: Array.isArray(themes) ? themes.length : 0,
      prompt_tokens: usage.prompt_tokens ?? null,
      completion_tokens: usage.completion_tokens ?? null,
      total_tokens: usage.total_tokens ?? null,
      cost_usd: usage.cost_usd ?? null,
    });
    return themes;
  } catch (e) {
    await logAiAttempt(kv, chatId, {
      provider: aiConfig.provider, model: aiConfig.model, source: aiConfig.source,
      type, contentMode, durationMs: Date.now() - startedAt,
      success: false, error: String(e.message || e).slice(0, 300),
    });
    throw e;
  }
}

// Эффективный AI-конфиг для конкретной комьюнити:
//   community override (community:{chatId}:settings:ai) > global (settings:ai:global) > env (legacy)
// Управляется из админки tg-challenge-bot-admin без redeploy воркера.
async function loadEffectiveAiConfig(env, kv, chatId = null) {
  // A stored config missing a field is skipped, and the skip is named in `source`,
  // which the AI log and the admin's AI Stats show.
  const skipped = [];
  const tryConfig = async (key, label) => {
    try {
      const cfg = await kv.get(key, "json");
      if (!cfg) return null;
      const missing = AI_CONFIG_FIELDS.filter((f) => !cfg[f]);
      if (missing.length === 0) return cfg;
      console.warn(`loadEffectiveAiConfig: ${key} is incomplete (missing: ${missing.join(",")})`);
      skipped.push(`${label}: нет ${missing.join(", ")}`);
    } catch (e) {
      console.error(`loadEffectiveAiConfig: kv.get(${key}) failed:`, e.message);
      skipped.push(`${label}: ${e.message}`);
    }
    return null;
  };
  const pick = (cfg, source) => ({
    provider: cfg.provider, apiUrl: cfg.apiUrl, apiKey: cfg.apiKey,
    model: cfg.model, temperature: cfg.temperature, maxTokens: cfg.maxTokens,
    referer: cfg.referer, title: cfg.title,
    source: skipped.length ? `${source} (пропущен ${skipped.join("; ")})` : source,
  });

  if (chatId) {
    const own = await tryConfig(`community:${chatId}:settings:ai`, "конфиг сообщества");
    if (own) return pick(own, "kv:community");
  }
  const global_ = await tryConfig("settings:ai:global", "global-конфиг");
  if (global_) return pick(global_, "kv:global");
  return pick(getAiConfigFromEnv(env), "env");
}

const AI_CONFIG_FIELDS = ["provider", "apiUrl", "apiKey", "model"];

// Built-in theme prompts. The admin panel ("Промпты") can override any part via
// settings:ai:prompts = { template, modes: { vanilla|medium|nsfw: { instruction, corpus } } }.
// Template placeholders: {TYPE} {MODE} {INSTRUCTION} {SAMPLE} {HISTORY}.
const THEME_TYPE_NAMES = { daily: "ДНЕВНОГО", weekly: "НЕДЕЛЬНОГО", monthly: "МЕСЯЧНОГО" };
const PROMPT_SAMPLE_SIZE = 20;

const BUILTIN_CORPUS = {
  vanilla: [
    // Персонажи
    "Сейлор Мун", "Велма Динкли (Scooby-Doo)", "Спящая красавица", "Галадриэль (LoTR)",
    "Мардж Симпсон", "Лея Органа (ЗВ)", "Татьяна Ларина", "Фа Мулан", "Барби",
    "На'ви (Avatar)", "Дриада", "Ромео и Джульетта", "Зубная фея", "мама Дяди Фёдора",
    "Рапунцель", "Мэри Поппинс", "Алиса в стране чудес", "Белоснежка", "Покахонтас",
    "Тоторо и девочка", "Кики (Ведьмина служба доставки)", "Наруто (женская версия)",
    // Ситуации/моменты
    "только проснулась", "с подарком", "на рыбалке", "с букетом", "будущие мамы",
    "переезд", "первый снег", "урожай", "сбор грибов", "на велосипеде",
    "танец под дождём", "запуск воздушных змеев", "плетение венков", "прогулка с собакой",
    "примерка шляпок", "завтрак на террасе", "запуск фонариков в небо", "рисование на пленэре",
    "сбор ягод", "катание на коньках", "утренняя пробежка", "письмо от руки",
    "ожидание весны", "кормление лебедей", "танцы босиком", "прыжок в воду",
    "уроки музыки", "фотосессия", "первый день лета", "генеральная уборка",
    "читает на подоконнике", "качается на качелях", "поёт в душе", "собирает пазл",
    // Места/пейзажи/локации
    "яблоневый сад", "в городском парке", "домик в деревне", "водопад", "море",
    "среди берёз", "на мосту", "летнее кафе", "в музее", "на закате",
    "оранжерея", "маяк на скале", "крыша многоэтажки", "японский сад", "старый чердак",
    "набережная", "горное озеро", "лавандовое поле", "зимний парк", "ботанический сад",
    "крыльцо старого дома", "мансарда", "тропинка в лесу", "песчаный берег",
    "качели во дворе", "винтажная карусель", "вагон поезда", "книжная лавка",
    "старая беседка", "рыночная площадь", "лесная поляна", "причал",
    // Стили/эстетика
    "кадр из ч/б фильма", "Гжель", "urban photo", "Акварель", "импрессионизм",
    "арт-нуво", "ретро 60-х", "пастельные тона", "поп-арт", "витражи",
    "фреска", "мозаика", "графика тушью", "минимализм", "сказочная иллюстрация",
    "силуэт на закате", "пинап 50-х", "советский плакат", "лубок",
    // Материалы/текстуры/объекты
    "бабочки", "белые розы", "лилии", "одуванчик", "подснежники", "мягкая игрушка",
    "кружево", "перья павлина", "стеклянные шары", "зеркала", "нитки и клубки",
    "ракушки", "янтарь", "сухоцветы", "воздушные шары", "бумажные фонарики",
    "жемчуг", "шёлк", "фарфоровые чашки", "старые ключи", "свечи", "ленты в волосах",
    "мыльные пузыри", "акварельные краски", "перо и чернила", "калейдоскоп",
    // Типажи/образы
    "балерина", "актриса", "археолог", "морячка", "стюардесса", "химик",
    "наездница", "Пастушка", "княгиня", "царевна", "сомелье", "проводница",
    "садовница", "пианистка", "фотограф", "библиотекарь", "цветочница",
    "кондитер", "ткачиха", "гончар", "скрипачка", "лесничая", "почтальон",
    "художница", "медсестра (винтаж)", "парикмахер", "француженка",
    // Прочее
    "Африка", "Холи - праздник красок", "близняшки", "веснушки", "очень длинные волосы",
    "альбиносы", "косы и косички", "в очках", "голубоглазая", "джинсовая одежда",
    "в рубашке", "в балетной пачке", "радуга", "йога", "теннис", "физкультура",
    "русские сказки", "дракон", "лебедь", "дельфин", "журавли", "12 месяцев",
    "алые паруса", "Статуя Свободы", "вышивка", "олимпийская грация", "индейцы Америки",
    // Дополнительные
    "варенье", "глинтвейн", "открытка", "ветряная мельница", "облака",
    "гамак", "снежинки", "утренний туман", "осенние листья", "черешня",
    "пруд с кувшинками", "старое пианино", "песочные часы"
  ],
  medium: [
    // Персонажи
    "Эйприл О'Нил (TMNT)", "Невеста Франкенштейна", "Гермиона Грейнджер",
    "Лара Крофт", "Рыжая Соня", "Женщина-кошка", "Харли Квинн", "Wednesday Addams",
    "Трисс Меригольд", "Тринити (The Matrix)", "Claire Redfield", "Джинкс/Jinx",
    "Маления (Elden Ring)", "Принцесса Мононоке", "Ван Хельсинг (женская версия)",
    "Садако Ямамура", "Зорро", "Яутжа (Predator)", "Йеннифэр (Ведьмак)",
    "Элой (Horizon)", "Сара Коннор", "Фуриоса (Mad Max)", "Баффи",
    "Мотоко Кусанаги (Ghost in the Shell)", "Рей (Star Wars)", "Бэла Димитреску",
    "Сэлин (Underworld)", "Эовин (LoTR)", "Электра", "Гамора",
    // Ситуации/моменты
    "сбежавшая невеста", "играющая с огнём", "идет ночью одна", "катастрофа",
    "похищенная пришельцами", "воскрешение", "первый контакт", "паника",
    "последний рубеж", "побег из крепости", "засада в переулке", "охота на ведьм",
    "ритуал пробуждения", "кораблекрушение", "дуэль на мечах", "ночная погоня",
    "предательство союзника", "блуждание в лабиринте", "пробуждение древнего зла",
    "осада замка", "бой в метро", "казнь на рассвете", "тайная встреча",
    "жертвоприношение", "перемирие", "допрос пленника", "побег из матрицы",
    "прыжок веры", "танец с мёртвыми", "вызов демона", "прощальный поцелуй",
    // Места/пейзажи/локации
    "в заброшенном доме", "необитаемый остров", "долина смерти", "руины древнего города",
    "Колизей", "на краю света", "фэнтези таверна", "Индия", "прогулка по Луне",
    "подземный бункер", "затопленный город", "лаборатория безумного учёного",
    "тронный зал", "ледяная пещера", "кладбище кораблей", "заброшенная станция метро",
    "вершина вулкана", "тёмный лес", "замок на скале", "подводный храм",
    "Чернобыль", "мёртвый город", "крепость в горах", "болота", "катакомбы",
    "арена", "заброшенный цирк", "плавучий рынок", "маяк в шторм",
    "пустыня из костей", "башня мага", "мост между мирами",
    // Стили/эстетика/мэшапы
    "Средневековый Киберпанк", "японская гравюра", "Славянское фэнтези",
    "Техноведьма (steampunk)", "sci-fi, анабиоз", "в стиле милитари",
    "нуар", "готика", "тёмное барокко", "биомеханика Гигера", "дарк фэнтези",
    "ретрофутуризм", "мрачный реализм", "wuxia", "мифопанк", "атомпанк",
    "викторианский хоррор", "славянский хоррор", "азиатская готика", "тёмный арт-деко",
    "кибернуар", "солярпанк", "некромантический барокко",
    // Материалы/текстуры/объекты
    "ржавчина", "осколки", "кроваво-красный", "магический идол", "в паутине",
    "ржавые цепи", "битое стекло", "чёрный дым", "магма", "чёрный лёд",
    "пепел", "шипы и колючки", "чешуя дракона", "кованое железо", "обсидиан",
    "руны на камне", "светящийся мох", "жидкий металл", "кристаллы тьмы",
    // Типажи/образы
    "киллер", "шаманка", "чародейка", "богатырши", "лучница", "дикарка",
    "принцесса в доспехах", "Космическая Амазонка", "Повелительница тьмы",
    "некромантка", "наёмница", "контрабандистка", "пророчица", "берсерк",
    "следопыт", "инквизитор", "алхимичка", "странница", "механик боевых машин",
    "капитан пиратов", "охотница за головами", "мастер ядов", "полководец",
    "ведьма леса", "клинок в ночи", "хранительница маяка",
    // Прочее
    "Хэллоуин", "рай, ад, противостояние", "свет и тьма", "Скандинавия. Руны",
    "космохоррор", "вуду", "Культ Дагона", "Вакханалия", "алхимия",
    "Полёт Маргариты", "Невесты Дракулы", "Планета обезьян", "Звонок",
    "Бесы", "Сияние", "Berserk", "Valhalla", "Унесённые призраками",
    "зимняя сказка", "Снегурочка и дракон", "Падший ангел", "монастырь, sci-fi",
    "звездопад", "Дверь в лето", "портал", "нашествие", "ледниковый период",
    "проклятый артефакт", "охотник и добыча", "вечная мерзлота", "песчаная буря",
    "чёрная луна", "кровавый рассвет", "эхо войны", "последний поезд",
    "сумеречная зона", "обряд инициации"
  ],
  nsfw: [
    // Персонажи
    "Kitana (Mortal Kombat)", "Rayne (BloodRayne)", "Барбарелла", "Лилит",
    "Bayonetta", "Quiet (Metal Gear)", "Мистик (X-Men)", "Poison Ivy",
    "Тифа Локхарт", "2B (NieR)", "Widowmaker (Overwatch)", "Лара Крофт (эротика)",
    // Ситуации/моменты
    "только вышла из душа", "Я такая пьяная...", "Завтрак в постель", "поцелуй",
    "Прикосновения", "Похмелье", "предложение руки и сердца", "After party",
    "Грустный понедельник", "Осенняя хандра", "пробуждение в чужой постели",
    "тайное свидание", "случайная встреча в лифте", "последний танец",
    "утро после вечеринки", "опоздала на работу", "застряла в лифте",
    "подглядывание", "примерка белья", "ночной заплыв", "спор на раздевание",
    // Места/локации
    "в купе поезда", "красная комната", "в бане/сауне", "в борделе",
    "В ночь на пляже", "на плоту", "На сеновале", "На дне",
    "в ванне с пеной", "между двумя мирами", "Эдем",
    "гримёрка стриптиз-клуба", "номер в мотеле", "яхта", "крыша небоскрёба ночью",
    "горячий источник", "будуар", "закулисье кабаре", "подиум",
    // Стили/эстетика
    "эротика ренессанса", "эротика из 90-ых", "постер к фильму 18+",
    "в сеттинге Blade Runner", "глюки (сюрреализм)", "склеп (готика)",
    "пинап классический", "хентай арт", "эротический нуар", "будуарная фотография",
    "эротический киберпанк", "гламур 80-х", "эротический арт-деко",
    "тёмная эротика", "ню в стиле Хельмута Ньютона",
    // Материалы/объекты/фетиш
    "латекс", "шибари", "шубы и меха", "кожа и металл", "золото и бархат",
    "бронелифчик", "микро бикини", "футуристический корсет", "пояс верности",
    "В легинсах", "в мехах", "костюм зайки", "Бюстгальтер",
    "чулки и подвязки", "прозрачный шёлк", "мокрая ткань", "цепи и ошейник",
    "кружевная маска", "боди из страз", "виниловый плащ", "перья и стразы",
    "корсет и шпильки", "тату и пирсинг",
    // Типажи/образы
    "доминатрикс", "Госпожа", "Ночная бабочка", "Личный секретарь", "Босс",
    "Дальнобойщица", "Сантехник", "Рабыня", "Чудачка", "Нищенка",
    "кибер горничная", "чернокнижница", "Гоночные королевы", "культуристка",
    "вебкам модель", "танцовщица бурлеска", "femme fatale", "гейша",
    "амазонка", "наложница султана", "куртизанка", "цирковая акробатка",
    // Прочее
    "наложницы", "секс-кукла-робот", "инкубы и суккубы", "еда и нагота",
    "голая вечеринка", "невольничий рынок", "огромная грудь", "женская тюрьма",
    "ахегао", "мисс гибкость", "Бондаж", "BDSM", "Стриптиз",
    "Мокрые майки", "Оргазм", "Под каблуком", "Запретный плод",
    "Стейк", "Шоколад", "Блины", "Milf", "Hula Girl",
    "этюд втроем", "буйство красок", "Полненькие девушки", "кибер руки",
    "Девушки с большими пушками", "натурщица в студии", "Баня", "бильярд",
    "Царица подводного мира", "Бездомная", "Заложница", "Ночной дожор",
    "Холостяк", "выпускной", "креативный пирсинг", "невесомость",
    "беременность, sci-fi", "пляжная полиция", "автостопщица", "дама под вуалью",
    // Дополнительные ситуации
    "соблазнение", "массаж с маслом", "медовый месяц", "грязные танцы",
    "ролевые игры", "тантрический ритуал", "утренний секс", "романтическая ванна вдвоём",
    "skinny dipping", "игра в бутылочку", "секс по телефону", "первый раз",
    // Дополнительные локации
    "задняя комната клуба", "раздевалка", "лимузин", "фотостудия",
    "бассейн ночью", "пентхаус", "капитанская каюта", "чердак старого дома",
    "тёмная аллея", "гарем", "ледяной дворец (эротика)", "оазис в пустыне",
    // Дополнительные стили
    "ретро порно 70-х", "софткор", "гламурное ню", "эротика барокко",
    "японский бондаж", "фетиш-фото", "эротический сюрреализм", "тёмный гламур",
    // Дополнительные объекты/фетиш
    "кнут и наручники", "масло для тела", "шпильки 15 см", "кожаный харнесс",
    "неоновое бельё", "прозрачный дождевик", "боди-арт", "маска и перчатки",
    "резиновое платье", "бусы на теле", "повязка на глаза",
    // Дополнительные типажи
    "медсестра (эротика)", "учительница (строгая)", "стюардесса (откровенная)",
    "тренер по йоге", "массажистка", "байкерша", "ведьма (эротика)",
    "пиратка", "вампирша", "суккуб", "жрица наслаждений"
  ]
};

const BUILTIN_PROMPTS = {
  template: `Ты — креативный директор арт-сообщества. Твоя задача: родить 6 мощных тем для {TYPE} челленджа.
Режим: {MODE}.

ПРАВИЛА ТЕКУЩЕГО РЕЖИМА:
{INSTRUCTION}

═══════════════════════════════════════════
СТРОГОЕ ПРАВИЛО РАЗНООБРАЗИЯ ТИПОВ ТЕМ:
Из 6 тем ОБЯЗАТЕЛЬНО должны быть разные ТИПЫ. НЕ БОЛЬШЕ 2 тем одного типа!

ТИПЫ ТЕМ (каждый тип должен быть представлен, примеры бери из БАЗЫ ПРИМЕРОВ ниже):

1. ПЕРСОНАЖ (конкретное имя из кино/игр/аниме/литературы) — МАКСИМУМ 1-2 штуки!
2. СИТУАЦИЯ/МОМЕНТ (что происходит, действие, состояние) — минимум 1
3. МЕСТО/ПЕЙЗАЖ/ЛОКАЦИЯ (где происходит, окружение) — минимум 1
4. СТИЛЬ/ЭСТЕТИКА/МЭШАП (художественное направление, сочетание стилей) — минимум 1
5. МАТЕРИАЛ/ТЕКСТУРА/ОБЪЕКТ (акцент на предмете, материале, детали) — по желанию
6. ТИПАЖ/ОБРАЗ (профессия, архетип, НЕ конкретное имя) — по желанию
═══════════════════════════════════════════

ЗАПРЕЩЕНО: давать 3+ персонажей с конкретными именами! Разнообразие типов — главный приоритет.

ФОРМАТ: короткие темы как в примерах — от одного слова до фразы.

БАЗА ПРИМЕРОВ (стиль, наглость, длина — используй для вдохновения, НЕ копируй):
{SAMPLE}
{HISTORY}
ОТВЕТЬ ТОЛЬКО JSON МАССИВОМ СТРОК:
["тема 1", "тема 2", "тема 3", "тема 4", "тема 5", "тема 6"]`,
  modes: {
    vanilla: {
      instruction: `ТОЛЬКО SFW (БЕЗОПАСНО): Красота, уют, природа, сказки, светлые персонажи.
СТРОГИЙ ЗАПРЕТ: Никакой эротики, наготы, фетишей, мрака, крови или насилия. Темы должны быть светлыми и вдохновляющими.`,
      corpus: BUILTIN_CORPUS.vanilla,
    },
    medium: {
      instruction: `МИКС КРАСОТЫ И ДРАМЫ: Поп-культура, культовые персонажи кино и игр. Нуар, триллер, крутые герои, интрига.
БЕЗ ПОРНО: Допускается мрачность и дерзость, но без открытой эротики и фетишей.`,
      corpus: [...BUILTIN_CORPUS.vanilla, ...BUILTIN_CORPUS.medium],
    },
    nsfw: {
      instruction: `ТОЛЬКО NSFW (18+): Художественная эротика, фетиши, сексуальные ситуации, акцент на обнаженном теле и материалах.
ПРАВИЛО: Тема должна быть провокационной, смелой и сексуальной.`,
      corpus: BUILTIN_CORPUS.nsfw,
    },
  },
};

async function loadPromptOverrides(kv) {
  try {
    return await kv.get("settings:ai:prompts", "json");
  } catch (e) {
    console.error("loadPromptOverrides failed, using built-in prompts:", e.message);
    return null;
  }
}

/** Built-in prompts with every valid field of the admin override applied on top. */
function resolvePrompts(overrides) {
  const out = {
    template: BUILTIN_PROMPTS.template,
    modes: Object.fromEntries(Object.entries(BUILTIN_PROMPTS.modes).map(([k, v]) => [k, { ...v }])),
  };
  if (!overrides || typeof overrides !== "object") return out;
  if (typeof overrides.template === "string" && overrides.template.trim()) out.template = overrides.template;
  for (const mode of Object.keys(out.modes)) {
    const m = overrides.modes?.[mode];
    if (!m) continue;
    if (typeof m.instruction === "string" && m.instruction.trim()) out.modes[mode].instruction = m.instruction;
    const corpus = Array.isArray(m.corpus) ? m.corpus.filter((x) => typeof x === "string" && x.trim()) : [];
    if (corpus.length) out.modes[mode].corpus = corpus;
  }
  return out;
}

function sampleOf(items, n) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function buildThemesPrompt(type, contentMode, previousThemes = [], overrides = null) {
  const prompts = resolvePrompts(overrides);
  const mode = prompts.modes[contentMode] ? contentMode : DEFAULT_CONTENT_MODE;
  const history = previousThemes.length > 0 ? `\n═══════════════════════════════════════════
ЗАПРЕЩЕНО ПОВТОРЯТЬ! ЭТИ ТЕМЫ УЖЕ ИСПОЛЬЗОВАЛИСЬ, НЕ БЕРИ ИХ И НЕ ДЕЛАЙ ПОХОЖИЕ:
${previousThemes.join(", ")}
═══════════════════════════════════════════` : "";
  const values = {
    TYPE: THEME_TYPE_NAMES[type] || THEME_TYPE_NAMES.daily,
    MODE: mode.toUpperCase(),
    INSTRUCTION: prompts.modes[mode].instruction,
    SAMPLE: sampleOf(prompts.modes[mode].corpus, PROMPT_SAMPLE_SIZE).join(", "),
    HISTORY: history,
  };
  // One pass over the template only: placeholders inside the instruction, corpus or history stay
  // literal, and a function replacer keeps `$&`-style patterns in edited text from expanding.
  return prompts.template.replace(/\{(TYPE|MODE|INSTRUCTION|SAMPLE|HISTORY)\}/g, (_, key) => values[key]);
}

// Providers the bot can call: "gemini" → Google Generative Language API,
// the rest → OpenAI-compatible chat completions.
const OPENAI_COMPATIBLE_PROVIDERS = ["openai", "openrouter", "custom"];

/** The engine is not configured: retrying the same config cannot help. */
class AiConfigError extends Error {}

// aiConfig: { provider, apiUrl, apiKey, model, temperature?, maxTokens?, referer?, title? }
async function generateThemes(aiConfig, type, previousThemes = [], contentMode = DEFAULT_CONTENT_MODE, promptOverrides = null) {
  const { provider, apiKey, model } = aiConfig;
  const missing = AI_CONFIG_FIELDS.filter((f) => !aiConfig[f]);
  if (missing.length) throw new AiConfigError(`AI не настроен: нет ${missing.join(", ")}`);
  if (provider !== "gemini" && !OPENAI_COMPATIBLE_PROVIDERS.includes(provider)) {
    throw new AiConfigError(`AI не настроен: неизвестный provider "${provider}"`);
  }
  // The admin panel stores Gemini's URL with a {model} placeholder.
  const apiUrl = aiConfig.apiUrl.replace(/\{model\}/gi, () => model);

  const prompt = buildThemesPrompt(type, contentMode, previousThemes, promptOverrides);

  try {
    console.log("AI API запрос...", { provider, model, type, contentMode, hasApiKey: !!apiKey });

    let response, text, _debugRaw, _usage, finishReason = null, resolvedModel = null;

    if (provider !== "gemini") {
      // OpenAI-compatible (OpenAI / OpenRouter / GLM / Groq / etc.)
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
      if (provider === "openrouter") {
        if (aiConfig.referer) headers["HTTP-Referer"] = aiConfig.referer;
        if (aiConfig.title)   headers["X-Title"] = aiConfig.title;
      }
      const reqBody = {
        model,
        messages: [
          { role: "system", content: "Ты — креативный директор русскоязычного арт-сообщества. Отвечай ТОЛЬКО на русском языке. Формат: валидный JSON массив строк на русском." },
          { role: "user", content: prompt },
        ],
      };
      // Temperature only when set explicitly — GPT-5/o3-class models reject a default.
      if (typeof aiConfig.temperature === "number") reqBody.temperature = aiConfig.temperature;
      // Thinking models spend completion tokens on reasoning (measured 423..2159 per answer);
      // an explicit cap also keeps OpenRouter from reserving the model's 65536-token maximum.
      reqBody.max_tokens = aiConfig.maxTokens ?? AI_MAX_TOKENS;
      // OpenRouter reports usage.cost only when asked.
      if (provider === "openrouter") reqBody.usage = { include: true };
      response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API ошибка:", { status: response.status, body: errorText });
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      _debugRaw = data;
      resolvedModel = data.model || null;
      finishReason = data.choices?.[0]?.finish_reason || null;
      text = data.choices?.[0]?.message?.content || "";
      // Убираем markdown обёртку если есть
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      // Capture usage for stats (OpenAI-compat shape)
      if (data.usage) {
        _usage = {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          // OpenRouter sometimes returns cost in data.usage.cost or in data.usage.total_cost
          cost_usd: typeof data.usage.cost === "number" ? data.usage.cost
                  : typeof data.usage.total_cost === "number" ? data.usage.total_cost
                  : null,
        };
      }

    } else {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: typeof aiConfig.temperature === "number" ? aiConfig.temperature : 1.0,
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
      _debugRaw = data;
      resolvedModel = data.modelVersion || null;
      finishReason = data.candidates?.[0]?.finishReason || null;
      // Thinking models put their reasoning in `thought` parts; the answer may span several parts.
      const parts = data.candidates?.[0]?.content?.parts || [];
      text = parts.filter((part) => part.text && !part.thought).map((part) => part.text).join("");
      // Gemini usage
      if (data.usageMetadata) {
        _usage = {
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount,
          cost_usd: null, // Gemini free tier — no cost in response
        };
      }
    }

    console.log("AI API статус:", response.status);

    if (!text) {
      const raw = JSON.stringify(_debugRaw ?? null) ?? "null";
      throw new Error(`API пустой ответ (finish_reason: ${finishReason ?? "нет"}). Raw: ${raw.substring(0, 300)}`);
    }

    // Парсим JSON
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

    const validThemes = themesFromAnswer(parsed);
    if (validThemes.length < POLL_OPTIONS_COUNT) {
      throw new Error(`Нужно ${POLL_OPTIONS_COUNT} тем, получено: ${validThemes.length}`);
    }
    validThemes.length = POLL_OPTIONS_COUNT;
    console.log("AI темы:", validThemes);
    // Non-enumerable so callers keep treating the result as a plain array.
    Object.defineProperty(validThemes, "_usage", { value: { ...(_usage || {}), resolvedModel }, enumerable: false });
    return validThemes;

  } catch (e) {
    console.error("AI ошибка:", { message: e.message, stack: e.stack });
    throw e;
  }
}

/** Non-empty theme strings from the parsed answer: a JSON array, or an object holding one. */
function themesFromAnswer(parsed) {
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === "object" ? Object.values(parsed).find((v) => Array.isArray(v)) : null) || [];
  return list
    .map((t) => (t && typeof t === "object" ? t.topic ?? t.theme ?? t.text ?? t.content ?? "" : t ?? ""))
    .map((t) => String(t).trim())
    .filter(Boolean);
}

/** A theme as a poll option shows it: the short part, no HTML, at most 100 characters (Telegram's limit). */
function pollOptionLabel(theme) {
  const clean = stripHtml(parseTheme(theme).short).trim();
  return clean.length > 100 ? `${clean.substring(0, 97)}...` : clean;
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

    // "/cmd@bot args" or "/cmd\nargs": the command is the first word without the @bot suffix.
    const [commandWord, addressee] = (text.trim().split(/\s+/)[0] || "").split("@");
    const command = commandWord.toLowerCase();
    if (command.startsWith("/") && addressee && !(await isAddressedToUs(tg, addressee))) return;

    const config = await getConfigForChat(env, storage, chatId);
    const hasAccess = config !== null;

    // Commands (работают везде)
    if (command === "/start" || command === "/help") {
      const schedule = config ? await getSchedule(storage, chatId) : await getSchedule(storage);
      const msgOverride = await loadMessages(env.CHALLENGE_KV);
      await tg.sendHtml(chatId, msgHelp(msgOverride, schedule), {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Rights are looked up only when a command needs them — not for every photo in the chat.
    let adminCache;
    const isAdmin = async () => {
      if (adminCache === undefined) {
        adminCache = message.from?.id ? await tg.isUserAdmin(chatId, message.from.id) : false;
      }
      return adminCache;
    };
    // Registering, listing and removing communities is for the bot owner, not any chat admin:
    // otherwise anyone can add the bot to their group and run it on the owner's AI budget.
    const isOwner = async () => {
      const owner = await getOwnerChatId(env, storage);
      return owner !== null ? message.from?.id === owner : isAdmin();
    };

    // ============================================
    // BOT OWNER: управление сообществами
    // ============================================

    // Регистрация сообщества: /register_community [название]
    if (command === "/register_community" && await isOwner()) {
      const args = text.trim().split(/\s+/).slice(1);
      const name = args.join(" ") || message.chat.title || `Community ${chatId}`;

      const result = await addCommunity(storage, chatId, name);
      if (result.success) {
        await tg.sendHtml(chatId, `✅ <b>Сообщество зарегистрировано.</b> Принято.\n\n<b>Название:</b> ${escapeHtml(name)}\n<b>ID:</b> <code>${chatId}</code>\n<b>Всего сообществ:</b> ${result.count}/${MAX_COMMUNITIES}\n\n<b>Настройте топики:</b>\n<code>/set_daily</code> — дневные\n<code>/set_weekly</code> — недельные\n<code>/set_monthly</code> — месячные\n<code>/set_winners</code> — победители`, {
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
    if (command === "/list_communities" && await isOwner()) {
      const communities = await getCommunities(storage);
      const list = Object.values(communities);

      if (list.length === 0) {
        await tg.sendHtml(chatId, `📭 Нет зарегистрированных сообществ.\n\n<code>/register_community</code> — добавить`, {
          message_thread_id: threadId || undefined,
        });
      } else {
        let msg = `📋 <b>СООБЩЕСТВА</b> (${list.length}/${MAX_COMMUNITIES})\n\n`;
        for (const c of list) {
          const isCurrent = c.chatId === chatId ? " ← <i>текущее</i>" : "";
          msg += `• <b>${escapeHtml(c.name)}</b>${isCurrent}\n  <code>${c.chatId}</code>\n`;
        }
        await tg.sendHtml(chatId, msg, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Удалить сообщество: /unregister_community
    if (command === "/unregister_community" && await isOwner()) {
      const result = await removeCommunity(storage, chatId);
      if (result.success) {
        await tg.sendHtml(chatId, `✅ <b>Сообщество удалено.</b> Готово.`, {
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
      if (command.startsWith("/") && await isAdmin()) {
        await tg.sendHtml(chatId, `⚠️ <i>Сообщество не зарегистрировано.</i>\n\n<code>/register_community</code> — добавить`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Get topic ID - для настройки
    if (command === "/topic_id" && await isAdmin()) {
      const topicInfo = threadId
        ? `🔢 <b>ID темы:</b> <code>${threadId}</code>\n\n<b>Команды:</b>\n<code>/set_daily</code> · <code>/set_weekly</code> · <code>/set_monthly</code> · <code>/set_winners</code>`
        : "⚠️ <i>Это общий чат. Напиши команду внутри темы форума.</i>";
      await tg.sendHtml(chatId, topicInfo, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Topic binding: /set_daily, /set_weekly, /set_monthly, /set_winners (per-community)
    const setTopicMatch = command.match(/^\/set_(daily|weekly|monthly|winners)$/);
    if (setTopicMatch && await isAdmin()) {
      if (!threadId) {
        await tg.sendHtml(chatId, "⚠️ <i>Напиши команду внутри темы форума</i>", { message_thread_id: undefined });
        return;
      }
      const slot = setTopicMatch[1];
      const topics = { ...(config.topics || {}), [slot]: threadId };
      await setCommunityTopics(storage, chatId, topics);
      const confirmations = {
        daily: "✅ <b>Дневные челленджи — здесь.</b> Принято.",
        weekly: "✅ <b>Недельные челленджи — здесь.</b> Записано.",
        monthly: "✅ <b>Месячные челленджи — здесь.</b> Понял.",
        winners: "✅ <b>Победители будут объявляться здесь.</b> Готово.",
      };
      await tg.sendHtml(chatId, confirmations[slot], { message_thread_id: threadId });
      return;
    }

    // Content mode configuration: /set_content_mode vanilla|medium|nsfw (per-community)
    if (command === "/set_content_mode" && await isAdmin()) {
      const args = text.trim().split(/\s+/).slice(1);
      const mode = args[0]?.toLowerCase();

      if (!mode || !CONTENT_MODES[mode]) {
        const modesList = Object.entries(CONTENT_MODES)
          .map(([key, val]) => `• ${key} — ${val.name}: ${val.description}`)
          .join("\n");
        const currentMode = await storage.getContentMode(chatId);
        await tg.sendHtml(
          chatId,
          `🎭 <b>РЕЖИМЫ КОНТЕНТА</b>

📍 Сейчас: ${(CONTENT_MODES[currentMode] || CONTENT_MODES[DEFAULT_CONTENT_MODE]).name}

<b>Доступные варианты:</b>
${modesList}

<i>Формат:</i> <code>/set_content_mode режим</code>
<i>Пример:</i> <code>/set_content_mode medium</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setContentMode(chatId, mode);
      const modeInfo = CONTENT_MODES[mode];
      await tg.sendHtml(
        chatId,
        `✅ <b>Режим изменён:</b> ${modeInfo.name}\n\n<i>${modeInfo.description}</i>`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Toggle accepting link previews as submissions: /set_accept_links on|off
    if (command === "/set_accept_links" && await isAdmin()) {
      const args = text.trim().split(/\s+/).slice(1);
      const value = args[0]?.toLowerCase();

      const currentValue = await storage.getAcceptLinks(chatId);

      if (!value || !["on", "off", "1", "0", "true", "false"].includes(value)) {
        const status = currentValue ? "ВКЛ" : "ВЫКЛ";
        await tg.sendHtml(
          chatId,
          `🔗 <b>ПРИЁМ ССЫЛОК</b>

📍 Статус: <b>${status}</b>

<i>Когда включено, ссылки с превью принимаются как работы.</i>

<i>Формат:</i> <code>/set_accept_links on|off</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      const newValue = ["on", "1", "true"].includes(value);
      await storage.setAcceptLinks(chatId, newValue);

      await tg.sendHtml(
        chatId,
        `✅ <b>Ссылки:</b> ${newValue ? "принимаются ✅" : "отключены ❌"}`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Настройка минимума реакций для предложений
    if (command === "/set_suggestion_reactions" && await isAdmin()) {
      const args = text.trim().split(/\s+/).slice(1);
      const value = parseInt(args[0], 10);

      const currentValue = await storage.getMinSuggestionReactions(chatId);

      if (isNaN(value) || !args[0]) {
        await tg.sendHtml(
          chatId,
          `⭐ <b>РЕАКЦИИ ДЛЯ ПРЕДЛОЖЕНИЙ</b>

📍 Сейчас: <b>${currentValue}</b>

<i>Предложенная тема попадёт в опрос при достаточном количестве реакций.</i>

<i>Формат:</i> <code>/set_suggestion_reactions ЧИСЛО</code>`,
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      if (value < 1 || value > 50) {
        await tg.sendHtml(
          chatId,
          "⚠️ <b>Ошибка:</b> от <b>1</b> до <b>50</b>. Не больше, не меньше.",
          { message_thread_id: threadId || undefined }
        );
        return;
      }

      await storage.setMinSuggestionReactions(chatId, value);

      await tg.sendHtml(
        chatId,
        `✅ <b>Минимум реакций:</b> ${value}. Записано.`,
        { message_thread_id: threadId || undefined }
      );
      return;
    }

    // Очистка предложений тем
    const clearSuggestionsMatch = command.match(/^\/clear_suggestions(?:_(daily|weekly|monthly))?$/);
    if (clearSuggestionsMatch && await isAdmin()) {
      let type = clearSuggestionsMatch[1]; // daily|weekly|monthly или undefined для всех

      // Если тип не указан, пробуем определить по топику
      if (!type && threadId && config) {
        const topics = config.topics || {};
        if (topics.daily === threadId) type = "daily";
        else if (topics.weekly === threadId) type = "weekly";
        else if (topics.monthly === threadId) type = "monthly";
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
          `🗑 Очищено <b>${total}</b> предложений для всех типов.`,
          { message_thread_id: threadId || undefined }
        );
      }
      return;
    }

    // Schedule configuration: /schedule_daily 17, /schedule_weekly 0 17 (day hour), /schedule_monthly 1 17 (per-community)
    const scheduleMatch = command.match(/^\/schedule_(daily|weekly|monthly)$/);
    if (scheduleMatch && await isAdmin()) {
      const type = scheduleMatch[1];
      const args = text.trim().split(/\s+/).slice(1).map(n => parseInt(n, 10));
      const kvSchedule = (await storage.get(`community:${chatId}:settings:schedule`)) || {};

      if (type === "daily") {
        const hour = args[0];
        if (isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendHtml(chatId, "📝 <b>Формат:</b> <code>/schedule_daily ЧАС</code> (0-23)\n<b>Пример:</b> <code>/schedule_daily 17</code>", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.daily = { ...kvSchedule.daily, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        const sched = formatSchedule(await getSchedule(storage, chatId));
        await tg.sendHtml(chatId, `✅ <b>Дневные челленджи:</b> ${sched.daily}. Записано.`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "weekly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 0 || day > 6 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendHtml(chatId, "📝 <b>Формат:</b> <code>/schedule_weekly ДЕНЬ ЧАС</code>\n<i>День: 0=вс, 1=пн, ..., 6=сб</i>\n<b>Пример:</b> <code>/schedule_weekly 0 17</code>", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.weekly = { ...kvSchedule.weekly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        const sched = formatSchedule(await getSchedule(storage, chatId));
        await tg.sendHtml(chatId, `✅ <b>Недельные челленджи:</b> ${sched.weekly}. Понял.`, {
          message_thread_id: threadId || undefined,
        });
      } else if (type === "monthly") {
        const [day, hour] = args;
        if (isNaN(day) || day < 1 || day > 28 || isNaN(hour) || hour < 0 || hour > 23) {
          await tg.sendHtml(chatId, "📝 <b>Формат:</b> <code>/schedule_monthly ДЕНЬ ЧАС</code>\n<i>День: 1-28</i>\n<b>Пример:</b> <code>/schedule_monthly 1 17</code>", {
            message_thread_id: threadId || undefined,
          });
          return;
        }
        kvSchedule.monthly = { ...kvSchedule.monthly, challengeDay: day, challengeHour: hour };
        await setSchedule(storage, chatId, kvSchedule);
        const sched = formatSchedule(await getSchedule(storage, chatId));
        await tg.sendHtml(chatId, `✅ <b>Месячные челленджи:</b> ${sched.monthly}. Готово.`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Submission limits: /set_limit_daily 3, /set_limit_weekly 5, /set_limit_monthly 7
    const limitMatch = command.match(/^\/set_limit_(daily|weekly|monthly)$/);
    if (limitMatch && await isAdmin()) {
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
      await tg.sendHtml(chatId, `✅ <b>Лимит для ${typeNames[type]} челленджей:</b> ${limit} работ. Принято.`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    if (command === "/admin" && await isAdmin()) {
      const schedule = await getSchedule(storage, chatId);
      const sched = formatSchedule(schedule);
      const currentMode = await storage.getContentMode(chatId);
      const modeInfo = CONTENT_MODES[currentMode] || CONTENT_MODES[DEFAULT_CONTENT_MODE];
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
/test_ai — проверить AI-движок

<b>Настройка тем</b>
/set_daily · /set_weekly · /set_monthly · /set_winners

<b>Режим контента:</b> ${modeInfo.name}
/set_content_mode — изменить

<b>Ссылки с превью:</b> ${acceptLinks ? "ВКЛ" : "ВЫКЛ"}
/set_accept_links — вкл/выкл

<b>Лимиты работ:</b> ${submissionLimits.daily}/${submissionLimits.weekly}/${submissionLimits.monthly}
/set_limit_daily · /set_limit_weekly · /set_limit_monthly

<b>Расписание:</b>
• Дневные: ${sched.daily}
• Недельные: ${sched.weekly}
• Месячные: ${sched.monthly}
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

    // Manual lifecycle: /poll_*, /run_*, /finish_* (per-community). Success is visible in the thread.
    const lifecycleMatch = command.match(/^\/(poll|run|finish)_(daily|weekly|monthly)$/);
    if (lifecycleMatch && await isAdmin()) {
      const [, action, type] = lifecycleMatch;
      try {
        await LIFECYCLE_ACTIONS[action === "run" ? "start" : action](env, chatId, config, tg, storage, type);
      } catch (e) {
        await tg.sendHtml(chatId, `❌ <b>Не получилось:</b> ${command}\n${escapeHtml(e.message)}`, {
          message_thread_id: threadId || undefined,
        });
      }
      return;
    }

    // Admin: Status (per-community)
    if (command === "/status" && await isAdmin()) {
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
        const endDateStr = new Date(c.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
        return `${name}: до ${endDateStr}\n   ${escapeHtml(c.topic)}`;
      };

      const statusMsg = `📊 <b>СТАТУС</b>

<b>Опросы</b>
• Дневной: ${pollDaily ? "✅" : "❌"}
• Недельный: ${pollWeekly ? "✅" : "❌"}
• Месячный: ${pollMonthly ? "✅" : "❌"}

<b>Челленджи</b>
${formatChallenge(daily, "Дневной")}
${formatChallenge(weekly, "Недельный")}
${formatChallenge(monthly, "Месячный")}`;

      await tg.sendHtml(chatId, statusMsg, { message_thread_id: threadId || undefined });
      return;
    }

    // Admin: Current challenge stats - /cs_daily, /cs_weekly, /cs_monthly (per-community)
    const csMatch = command.match(/^\/cs_(daily|weekly|monthly)$/);
    if (csMatch && await isAdmin()) {
      const type = csMatch[1];
      const challenge = await storage.getChallenge(chatId, type);
      const typeNames = { daily: "Дневной", weekly: "Недельный", monthly: "Месячный" };

      if (!challenge || challenge.status !== "active") {
        await tg.sendHtml(chatId, `📋 <b>${typeNames[type]} челлендж</b>\n\n<i>Нет активного</i>`, {
          message_thread_id: threadId || undefined,
        });
        return;
      }

      const submissions = await storage.getSubmissions(chatId, type, challenge.id);
      const endDateStr = new Date(challenge.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";

      if (submissions.length === 0) {
        await tg.sendHtml(chatId, `📋 <b>${typeNames[type]} челлендж</b>\n\n<b>Тема:</b> ${escapeHtml(challenge.topic)}\n<b>До:</b> ${endDateStr}\n\n<i>Пока нет работ</i>`, {
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
        `${i + 1}. ${escapeHtml(displayName(s))} — <b>${s.score}</b>`
      ).join("\n");

      await tg.sendHtml(chatId, `📋 <b>${typeNames[type]} челлендж</b>\n\n<b>Тема:</b> ${escapeHtml(challenge.topic)}\n<b>До:</b> ${endDateStr}\n<b>Участников:</b> ${submissions.length}\n\n${list}`, {
        message_thread_id: threadId || undefined,
      });
      return;
    }

    // Admin: Test AI - тестирует боевой промпт для 6 тем
    if (command === "/test_ai" && await isAdmin()) {
      const aiCfg = await loadEffectiveAiConfig(env, env.CHALLENGE_KV, chatId);
      const engine = escapeHtml(`${aiCfg.provider}/${aiCfg.model}`);
      const source = escapeHtml(aiCfg.source);
      await tg.sendHtml(chatId, `🔄 <i>Проверяю AI (${engine}, source: ${source})...</i>`, { message_thread_id: threadId || undefined });
      try {
        const contentMode = await storage.getContentMode(chatId);
        const themes = await generateThemes(aiCfg, "daily", [], contentMode, await loadPromptOverrides(env.CHALLENGE_KV));

        let msg = `✅ <b>${engine}</b> (режим: <i>${escapeHtml(contentMode)}</i>, source: ${source})\n\n`;
        themes.forEach((theme, i) => {
          msg += `${i + 1}. ${escapeHtml(theme)}\n\n`;
        });

        await tg.sendHtml(chatId, msg, { message_thread_id: threadId || undefined });
      } catch (e) {
        await tg.sendHtml(chatId, `❌ <b>Ошибка:</b> ${escapeHtml(e.message)}`, { message_thread_id: threadId || undefined });
      }
      return;
    }

    // User commands (per-community)
    if (command === "/stats") {
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
        `📈 <b>Ваша статистика</b>\n\n🏆 Побед: <b>${totalWins}</b> ${winsWord}\n🎨 Участий: <b>${totalParticipations}</b> ${partWord}\n\n🌅 Дневные: <b>${formatStat(daily)}</b> (#${daily.rank})\n📅 Недельные: <b>${formatStat(weekly)}</b> (#${weekly.rank})\n📆 Месячные: <b>${formatStat(monthly)}</b> (#${monthly.rank})\n\n<i>Формат: побед/участий</i>`,
        { message_thread_id: threadId || undefined },
      );
      return;
    }

    if (command === "/leaderboard") {
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
          `📭 <i>Рейтинг «${escapeHtml(msgChallengeTypeTitle(await loadMessages(env.CHALLENGE_KV), type))}» пока пуст</i>`,
          { message_thread_id: threadId || undefined },
        );
        return;
      }

      const medals = ["🥇", "🥈", "🥉"];
      let msg = msgLeaderboardTitle(await loadMessages(env.CHALLENGE_KV), type) + `\n\n`;
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

    if (command === "/current") {
      // Parallel KV reads for better performance (per-community)
      const [daily, weekly, monthly] = await Promise.all([
        storage.getChallenge(chatId, "daily"),
        storage.getChallenge(chatId, "weekly"),
        storage.getChallenge(chatId, "monthly"),
      ]);

      const msgOverride = await loadMessages(env.CHALLENGE_KV);
      const format = (c, type) => {
        const title = escapeHtml(msgChallengeTypeTitle(msgOverride, type));
        if (!c || c.status !== "active") return `${title}: <i>нет</i>`;
        const endDateStr = new Date(c.endsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
        return `<b>${title}</b> (до ${endDateStr})\n${escapeHtml(c.topicFull || c.topic)}`;
      };

      await tg.sendHtml(
        chatId,
        `🎯 <b>Активные челленджи</b>\n\n${format(daily, "daily")}\n\n${format(weekly, "weekly")}\n\n${format(monthly, "monthly")}`,
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
      const textAfterCommand = text.replace(/^\/suggest(?:_(?:daily|weekly|monthly))?(?:@\w+)?\s*/i, "").trim();

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
        tgUsername: message.from?.username || null,
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

      console.log(`Suggestion created: community=${chatId}, type=${type}, id=${suggestionId}`);
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
        const count = s.reactionCount || 0;
        const status = count >= minReactionsList ? "✅" : "⏳";
        const theme = s.theme || s.title || "";
        const themePreview = theme.length > 50 ? `${theme.substring(0, 50)}...` : theme;
        msg += `${status} ${escapeHtml(themePreview)} — ${count} ${pluralize(count, "реакция", "реакции", "реакций")}\n   ${escapeHtml(displayName(s) || "Аноним")}\n\n`;
      }

      msg += `Для участия в голосовании нужно <b>${minReactionsList}+</b> реакций.`;

      await tg.sendHtml(chatId, msg, { message_thread_id: threadId || undefined });
      return;
    }

    // Photo submission (includes photos, image documents, and links with previews)
    const hasPhoto = message.photo && message.photo.length > 0;
    const hasImageDocument = message.document?.mime_type?.startsWith("image/");
    // A link with its preview shown. Telegram sends link_preview_options only when the author
    // changed them, so its absence means the default preview, not "no preview".
    const hasLinkPreview = message.entities?.some((e) => e.type === "url" || e.type === "text_link") &&
                          !message.link_preview_options?.is_disabled;

    // The community setting is read only for messages it can affect, not for every chat line.
    const isValidSubmission = hasPhoto || hasImageDocument || (hasLinkPreview && await storage.getAcceptLinks(chatId));

    if (isValidSubmission) {
      const challengeType = await storage.isActiveTopic(chatId, threadId);
      if (!challengeType) {
        // Not a challenge topic - silently ignore
        return;
      }

      const challenge = await storage.getChallenge(chatId, challengeType);
      if (!challenge || challenge.status !== "active") {
        await tg.sendHtml(
          chatId,
          "⚠️ <i>Сейчас нет активного челленджа в этой теме</i>",
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
        tgUsername: message.from?.username || null,
        score: 0,
        timestamp: Date.now(),
      }, limit);

      if (!result.success) {
        if (result.reason === "limit") {
          await tg.sendHtml(
            chatId,
            msgSubmissionLimit(await loadMessages(env.CHALLENGE_KV), result.current, result.max),
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
      await tg.sendHtml(chatId, msgWorkAccepted(await loadMessages(env.CHALLENGE_KV), result.current, result.max), {
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


/** Any reaction except the excluded emoji counts as a vote. */
function hasCountableReaction(reactions) {
  return (reactions || []).some((r) =>
    (r.type === "emoji" && r.emoji !== EXCLUDED_EMOJI) || r.type === "custom_emoji" || r.type === "paid");
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

      const hasValidReaction = hasCountableReaction(reaction.new_reaction);
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

    // One vote per user however many reactions they put (Premium allows several).
    const userScore = hasCountableReaction(reaction.new_reaction) ? 1 : 0;

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

// Live vote counts of a bot poll (Telegram sends `poll` updates for polls the bot created).
async function handlePollUpdate(poll, storage) {
  try {
    const ref = await storage.getPollRef(poll.id);
    if (!ref) return;
    // The closing update of a replaced poll must not overwrite the counts of the poll now open.
    if ((await storage.getPoll(ref.chatId, ref.type))?.pollId !== poll.id) return;
    await storage.setPollVotes(ref.chatId, ref.type, {
      total: poll.total_voter_count,
      options: poll.options.map((o) => ({ text: o.text, votes: o.voter_count })),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("handlePollUpdate error:", e.message);
  }
}

// ============================================
// CRON JOBS
// ============================================

// The theme parser requires exactly this many AI themes; polls hold the same number of options.
const POLL_OPTIONS_COUNT = 6;

// A poll lives for one cycle: created at the poll slot, consumed at the challenge slot.
// A poll still in KV at the next poll slot is a leftover whose delete did not stick
// (KV deletes can be lost); anything younger than this is the same tick delivered twice.
const POLL_FRESH_WINDOW_MS = 10 * 60 * 1000;

// Cloudflare cron is best-effort: scheduledTime drifts inside the minute and ticks get dropped.
// A slot fires once at its exact instant, or late within CRON_CATCHUP_MS. A failed slot is
// retried every CRON_RETRY_INTERVAL_MS until CRON_RETRY_MS after the slot.
const CRON_CATCHUP_MS = 55 * 60 * 1000;
const CRON_RETRY_MS = 6 * 3600 * 1000;
const CRON_RETRY_INTERVAL_MS = 10 * 60 * 1000;

const CHALLENGE_TYPES = ["daily", "weekly", "monthly"];

// Challenge length when the schedule has no challenge slot for the type.
const FALLBACK_CHALLENGE_MS = {
  daily: 24 * 3600 * 1000,
  weekly: 7 * 24 * 3600 * 1000,
  monthly: 28 * 24 * 3600 * 1000,
};

const SLOT_LABELS = {
  "poll:daily": "дневной опрос",
  "poll:weekly": "недельный опрос",
  "poll:monthly": "месячный опрос",
  "challenge:daily": "дневной челлендж",
  "challenge:weekly": "недельный челлендж",
  "challenge:monthly": "месячный челлендж",
};

// Append to alerts:log, rendered by the admin panel under "Алерты".
async function logAlert(storage, severity, component, message, context = undefined) {
  try {
    const log = (await storage.get("alerts:log")) || [];
    log.unshift({ ts: Date.now(), severity, component, message, context });
    await storage.set("alerts:log", log.slice(0, 100), { expirationTtl: TTL.ALERTS });
  } catch (e) {
    console.error("logAlert failed:", e.message);
  }
}

/** Bot owner's Telegram id: KV overrides env so it can be changed without a redeploy. */
async function getOwnerChatId(env, storage) {
  try {
    const fromKv = await storage.get("settings:owner_chat_id");
    const id = parseInt(fromKv ?? env.OWNER_CHAT_ID, 10);
    return Number.isFinite(id) ? id : null;
  } catch (e) {
    console.error("getOwnerChatId failed:", e.message);
    return null;
  }
}

/** Plain-text DM to the owner. Never throws — reporting must not break the run. */
async function notifyOwner(env, tg, storage, text) {
  const owner = await getOwnerChatId(env, storage);
  if (owner === null) return;
  try {
    await tg.sendHtml(owner, `<b>Челлендж-бот</b>\n\n${escapeHtml(text)}`);
  } catch (e) {
    console.error("notifyOwner failed:", e.message);
  }
}

async function reportFailure(env, tg, storage, component, message, context) {
  await logAlert(storage, "error", component, message, context);
  await notifyOwner(env, tg, storage, `❗ ${message}`);
}

/**
 * The schedule instant of a poll or challenge slot: { day?, hour, minute }.
 * Missing poll fields fall back to legacy defaults derived from the challenge slot.
 */
function slotAt(schedule, type, action) {
  const s = schedule[type] || {};
  // Anything but an integer (a hand-edited "17", null) leaves the slot unscheduled.
  const int = (v) => (Number.isInteger(v) ? v : undefined);
  if (action === "challenge") {
    return { day: int(s.challengeDay), hour: int(s.challengeHour), minute: int(s.challengeMinute) ?? 0 };
  }
  const minute = int(s.pollMinute) ?? 0;
  const challengeHour = int(s.challengeHour);
  const challengeDay = int(s.challengeDay);
  if (type === "daily") {
    return { hour: int(s.pollHour) ?? (challengeHour === undefined ? undefined : (challengeHour + 12) % 24), minute };
  }
  if (type === "weekly") {
    const day = int(s.pollDay) ?? (challengeDay === undefined ? undefined : (challengeDay + 6) % 7);
    return { day, hour: int(s.pollHour), minute };
  }
  const day = int(s.pollDay) ?? (challengeDay === undefined ? undefined : challengeDay === 1 ? 28 : challengeDay - 3);
  return { day, hour: int(s.pollHour), minute };
}

/** Most recent occurrence of a slot at or before `now` (UTC). Monthly days are 1..28. */
function lastSlotOccurrence(now, kind, { day, hour, minute }) {
  const H = Number.isInteger(hour) ? hour : 0;
  const M = Number.isInteger(minute) ? minute : 0;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const at = new Date(Date.UTC(y, mo, now.getUTCDate(), H, M, 0, 0));

  if (kind === "daily") {
    if (at > now) at.setUTCDate(at.getUTCDate() - 1);
    return at.getTime();
  }
  if (kind === "weekly") {
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() - (day ?? 0) + 7) % 7));
    if (at > now) at.setUTCDate(at.getUTCDate() - 7);
    return at.getTime();
  }
  const dom = Math.min(Math.max(day ?? 1, 1), 28);
  const month = new Date(Date.UTC(y, mo, dom, H, M, 0, 0));
  return month > now ? Date.UTC(y, mo - 1, dom, H, M, 0, 0) : month.getTime();
}

/** First occurrence of a slot strictly after `after`. */
function nextSlotOccurrence(after, kind, at) {
  const next = new Date(lastSlotOccurrence(after, kind, at));
  if (kind === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (kind === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next.getTime();
}

/** A challenge runs until the next scheduled start of its type — no gap, no overlap. */
function challengeEndsAt(schedule, type, startedAt) {
  const at = slotAt(schedule, type, "challenge");
  if (!Number.isInteger(at.hour)) return startedAt + FALLBACK_CHALLENGE_MS[type];
  return nextSlotOccurrence(new Date(startedAt), type, at);
}

/**
 * Name to show for a submission or leaderboard entry. `tgUsername` holds the real
 * Telegram username; older records only have `username`, which may be a first name.
 */
function displayName(entry) {
  if (!entry) return "";
  if (entry.tgUsername) return `@${entry.tgUsername}`;
  if ("tgUsername" in entry) return entry.username || `Участник #${entry.userId}`;
  const u = entry.username;
  if (u && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u)) return `@${u}`;
  return u || `Участник #${entry.userId}`;
}

/** Close a poll we abandon so it does not stay open and pinned in the chat. */
async function retirePoll(tg, storage, chatId, type, poll) {
  if (poll?.messageId) {
    try {
      await tg.stopPoll(chatId, poll.messageId);
    } catch (e) {
      console.error(`retirePoll: stopPoll ${type} failed:`, e.message);
    }
    try {
      await tg.unpinChatMessage(chatId, poll.messageId);
    } catch (e) {
      console.error(`retirePoll: unpin ${type} failed:`, e.message);
    }
  }
  await storage.deletePoll(chatId, type);
}

async function deleteMessageLogged(tg, chatId, messageId, what) {
  try {
    await tg.request("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch (e) {
    console.error(`could not delete ${what}:`, e.message);
  }
}

/** Post the poll for the next challenge. Resolves when a poll is live, throws with the reason otherwise. */
async function generatePoll(env, chatId, config, tg, storage, type) {
  let sent = null;
  let pollOptions;
  let historyThemes;
  let suggestions;
  let aiCount = 0;
  try {
    const existing = await storage.getPoll(chatId, type);
    if (existing) {
      const age = Date.now() - (existing.createdAt ?? 0);
      // A future createdAt is a corrupt record, not a fresh poll.
      if (age >= 0 && age < POLL_FRESH_WINDOW_MS) return;
      console.warn(`generatePoll: retiring stale ${type} poll (age ${Math.round(age / 60000)}m), community=${chatId}`);
      await logAlert(
        storage, "warn", "generatePoll",
        `Найден зависший ${SLOT_LABELS[`poll:${type}`]} (возраст ${Math.round(age / 3600000)} ч) — закрыт, опрос пересоздан`,
        { chatId, type, createdAt: existing.createdAt, messageId: existing.messageId },
      );
      await retirePoll(tg, storage, chatId, type, existing);
    }

    const previousThemes = await storage.getThemeHistory(chatId, type);
    const contentMode = await storage.getContentMode(chatId);
    const minReactions = await storage.getMinSuggestionReactions(chatId);
    suggestions = (await storage.getApprovedSuggestions(chatId, type, minReactions))
      .filter((s) => s.theme || s.title || s.description)
      .slice(0, POLL_OPTIONS_COUNT);
    const suggestionThemes = suggestions.map((s) => s.theme || s.title || s.description);

    let aiThemes = [];
    const aiSlots = POLL_OPTIONS_COUNT - suggestionThemes.length;
    if (aiSlots > 0) {
      const aiConfig = await loadEffectiveAiConfig(env, env.CHALLENGE_KV, chatId);
      aiThemes = (await generateThemesLogged(aiConfig, type, previousThemes, contentMode, env.CHALLENGE_KV, chatId))
        .slice(0, aiSlots);
    }
    // Stored options keep the full "short | full" strings; the poll shows their labels, which
    // must be unique — Telegram rejects a poll with two equal options.
    const seen = new Set();
    const allThemes = [...suggestionThemes, ...aiThemes].filter((t) => {
      const label = pollOptionLabel(t).toLowerCase();
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    aiCount = aiThemes.length;
    pollOptions = allThemes.map(pollOptionLabel);
    historyThemes = allThemes.map((t) => parseTheme(t).short);
    if (pollOptions.length < 2) {
      throw new Error(`для опроса нужно минимум 2 темы, есть ${pollOptions.length}`);
    }

    const topicId = config.topics[type];
    sent = await tg.sendPoll(chatId, msgPollQuestion(await loadMessages(env.CHALLENGE_KV)), pollOptions, {
      message_thread_id: topicId || undefined,
      is_anonymous: false,
      allows_multiple_answers: false,
    });
    await storage.savePoll(chatId, {
      type,
      pollId: sent.poll.id,
      messageId: sent.message_id,
      options: allThemes,
      createdAt: Date.now(),
      topicThreadId: topicId,
      suggestionIds: suggestions.map((s) => s.id),
    });
  } catch (e) {
    console.error(`generatePoll error (${type}):`, { error: e.message, stack: e.stack });
    // Posted but not recorded: take it back so the retry does not leave two polls in the thread.
    if (sent) await deleteMessageLogged(tg, chatId, sent.message_id, `unrecorded ${type} poll`);
    throw e;
  }

  // The poll is live from here on: failures below must not make the slot post it again.
  try {
    await tg.pinChatMessage(chatId, sent.message_id);
  } catch (e) {
    console.error("Failed to pin poll:", e.message);
  }
  try {
    await storage.indexPoll(sent.poll.id, chatId, type);
    await storage.setPollVotes(chatId, type, {
      total: 0,
      options: pollOptions.map((text) => ({ text, votes: 0 })),
      updatedAt: Date.now(),
    });
    // Every option goes to history so future polls do not repeat it.
    await storage.addThemesToHistory(chatId, type, historyThemes);
    // All suggestions are cleared, not only the used ones: the next cycle starts fresh.
    await storage.clearSuggestions(chatId, type);
  } catch (e) {
    console.error(`generatePoll: bookkeeping after publish failed (${type}):`, e.message);
    await logAlert(storage, "warn", "generatePoll", `Опрос опубликован, но история тем не обновилась: ${e.message}`, { chatId, type });
  }
  console.log(`Poll created: community=${chatId}, type=${type}, userSuggestions=${suggestions.length}, aiThemes=${aiCount}`);
}

/**
 * Close the poll and resolve its winning option to the stored theme.
 * Nobody voted → a random option. The poll is unpinned and removed either way.
 */
async function takePollWinner(tg, storage, chatId, type, poll) {
  let theme = null;
  let voteCount = 0;
  try {
    const stopped = await tg.stopPoll(chatId, poll.messageId);
    let winnerText = "";
    for (const opt of stopped.options) {
      if (opt.voter_count > voteCount) {
        voteCount = opt.voter_count;
        winnerText = opt.text;
      }
    }
    if (winnerText) {
      const full = poll.options.find((o) => pollOptionLabel(o) === winnerText);
      theme = full ? { short: parseTheme(full).short, full } : { short: winnerText, full: winnerText };
    } else if (poll.options?.length) {
      const pick = poll.options[Math.floor(Math.random() * poll.options.length)];
      theme = { short: parseTheme(pick).short, full: pick };
    }
  } catch (e) {
    console.error("Poll stop error:", e.message);
    // Network and server errors: keep the poll, the slot retries and reads the votes then.
    if (!e.message?.startsWith("[4")) throw e;
    const pollLabel = SLOT_LABELS[`poll:${type}`];
    // "already closed" = consumed by an earlier run whose delete was lost: its options are spent.
    if (/already\s+been\s+closed|poll\s+has\s+already/i.test(e.message)) {
      await logAlert(
        storage, "warn", "startChallenge",
        `${pollLabel} уже был закрыт (зависший опрос) — тема взята у AI, опрос удалён`,
        { chatId, type, pollCreatedAt: poll.createdAt },
      );
    } else if (poll.options?.length) {
      // Telegram refuses for good (message deleted, rights lost): the votes are unreadable.
      theme = { short: parseTheme(poll.options[0]).short, full: poll.options[0] };
      await logAlert(
        storage, "warn", "startChallenge",
        `${pollLabel}: голоса не прочитать (${e.message}) — взята первая тема опроса`,
        { chatId, type, messageId: poll.messageId },
      );
    }
  }
  try {
    await tg.unpinChatMessage(chatId, poll.messageId);
  } catch (e) {
    console.error("Failed to unpin poll:", e.message);
  }
  await storage.deletePoll(chatId, type);
  // A lost delete is caught again by generatePoll's staleness check; one retry here is cheap.
  if (await storage.getPoll(chatId, type)) await storage.deletePoll(chatId, type);
  return { theme, voteCount };
}

/** A theme straight from AI when there is no usable poll: community engine first, then the global one. */
async function emergencyTheme(env, storage, chatId, type) {
  const contentMode = await storage.getContentMode(chatId);
  const previousThemes = await storage.getThemeHistory(chatId, type);
  const own = await loadEffectiveAiConfig(env, env.CHALLENGE_KV, chatId);
  const chain = [own];
  if (own.source === "kv:community") {
    const global_ = await loadEffectiveAiConfig(env, env.CHALLENGE_KV, null);
    if (global_.source !== own.source) chain.push(global_);
  }

  let lastError = null;
  for (const aiCfg of chain) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const themes = await generateThemesLogged(aiCfg, type, previousThemes, contentMode, env.CHALLENGE_KV, chatId);
        console.warn(`startChallenge: no usable ${type} poll, emergency AI theme (${aiCfg.source}, try ${attempt})`);
        return { short: parseTheme(themes[0]).short, full: themes[0] };
      } catch (e) {
        lastError = e;
        console.error(`emergency AI try ${attempt} on ${aiCfg.source} failed:`, e.message);
        if (e instanceof AiConfigError) break;
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }
  throw new Error(`нет опроса, а AI не дал тему: ${lastError.message}`);
}

/** Per user keep the best work; an equal score keeps the earlier one. */
function bestSubmissionPerUser(submissions) {
  const best = {};
  for (const s of submissions) {
    const cur = best[s.userId];
    if (!cur || s.score > cur.score || (s.score === cur.score && (s.timestamp || 0) < (cur.timestamp || 0))) {
      best[s.userId] = s;
    }
  }
  return Object.values(best);
}

function communityLabel(config, chatId) {
  return config?.name ? `«${config.name}»` : `чат ${chatId}`;
}

/**
 * Close the active challenge: record the result, then announce it. Throws only when the result
 * could not be recorded — the challenge then stays active and nothing replaces it. Messages
 * Telegram refuses (edited template with broken HTML, deleted topic) are reported to the owner
 * and do not undo the result.
 */
async function finishChallenge(env, chatId, config, tg, storage, type) {
  const challenge = await storage.getChallenge(chatId, type);
  if (!challenge || challenge.status !== "active") return;

  const submissions = await storage.getSubmissions(chatId, type, challenge.id);
  // Per-message reaction maps are the source of truth; the score in the array is a cache.
  await Promise.all(submissions.map(async (s) => {
    const reactions = await storage.getReactions(chatId, type, challenge.id, s.messageId);
    if (Object.keys(reactions).length) {
      s.score = Object.values(reactions).reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
  }));
  const contenders = bestSubmissionPerUser(submissions);
  const maxScore = contenders.length ? Math.max(...contenders.map((s) => s.score || 0)) : 0;
  const winners = maxScore > 0 ? contenders.filter((s) => (s.score || 0) === maxScore) : [];

  challenge.status = "finished";
  await storage.saveChallenge(chatId, challenge);

  const problems = [];
  const attempt = async (what, fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(`finishChallenge (${type}): ${what} failed:`, e.message);
      problems.push(`${what}: ${e.message}`);
    }
  };
  for (const winner of winners) {
    await attempt("запись победы", () => storage.addWin(chatId, type, winner.userId, winner.username));
  }
  await attempt("закрытие приёма работ", async () => {
    const activeTopics = await storage.getActiveTopics(chatId);
    delete activeTopics[challenge.topicThreadId];
    await storage.setActiveTopics(chatId, activeTopics);
  });
  if (challenge.announcementMessageId) {
    try {
      await tg.unpinChatMessage(chatId, challenge.announcementMessageId);
    } catch (e) {
      console.error("Failed to unpin announcement:", e.message);
    }
  }

  const msgOverride = await loadMessages(env.CHALLENGE_KV);
  const thread = { message_thread_id: challenge.topicThreadId || undefined };
  if (submissions.length === 0) {
    await attempt("сообщение об итогах", () => tg.sendHtml(chatId, msgNoSubmissions(msgOverride), thread));
  } else if (winners.length === 0) {
    await attempt("сообщение об итогах", () => tg.sendHtml(chatId, msgNoVotes(msgOverride), thread));
  } else {
    await attempt("объявление победителя", () => tg.sendHtml(
      chatId,
      msgWinnerAnnouncement(msgOverride, winners.map(displayName).join(", "), maxScore),
      { ...thread, reply_to_message_id: winners[0].messageId },
    ));
    if (config.topics.winners) {
      for (const winner of winners) {
        await attempt("пересылка в тему победителей", async () => {
          await tg.forwardMessage(chatId, chatId, winner.messageId, { message_thread_id: config.topics.winners });
          await tg.sendHtml(
            chatId,
            msgWinnerAnnouncementFull(msgOverride, displayName(winner), winner.score, challenge.topicFull || challenge.topic),
            { message_thread_id: config.topics.winners },
          );
        });
      }
    }
  }

  if (problems.length) {
    const what = SLOT_LABELS[`challenge:${type}`];
    await reportFailure(
      env, tg, storage, `finish:${type}`,
      `${what[0].toUpperCase()}${what.slice(1)} — ${communityLabel(config, chatId)}: итоги подведены, но не всё прошло.\n${problems.join("\n")}`,
      { chatId, type, challengeId: challenge.id },
    );
  }
}

/** "30 сент., 17:00 UTC" */
function formatChallengeDate(ms) {
  const text = new Date(ms).toLocaleString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
  return `${text} UTC`;
}

/**
 * Close the previous challenge and start the next one with the poll winner, or an AI theme when
 * there is no usable poll. Resolves when the new challenge is live, throws with the reason otherwise.
 */
async function startChallenge(env, chatId, config, tg, storage, type, startedAt = Date.now()) {
  await finishChallenge(env, chatId, config, tg, storage, type);

  let announcement = null;
  let challenge;
  try {
    let theme = null;
    let voteCount = 0;
    const poll = await storage.getPoll(chatId, type);
    if (poll) ({ theme, voteCount } = await takePollWinner(tg, storage, chatId, type, poll));
    if (!theme) theme = await emergencyTheme(env, storage, chatId, type);

    const schedule = await getSchedule(storage, chatId);
    const topicId = config.topics[type];
    const endsAt = challengeEndsAt(schedule, type, startedAt);

    announcement = await tg.sendHtml(
      chatId,
      msgChallengeAnnouncement(
        await loadMessages(env.CHALLENGE_KV), type, theme.full,
        formatChallengeDate(startedAt), formatChallengeDate(endsAt), voteCount,
      ),
      { message_thread_id: topicId || undefined },
    );

    challenge = {
      id: await storage.getNextChallengeId(chatId, type),
      type,
      topic: theme.short,
      topicFull: theme.full,
      status: "active",
      startedAt,
      endsAt,
      topicThreadId: topicId,
      announcementMessageId: announcement.message_id,
    };
    await storage.saveChallenge(chatId, challenge);
  } catch (e) {
    console.error(`startChallenge error (${type}):`, { error: e.message, stack: e.stack });
    // Announced but not recorded: take it back so the retry does not announce twice.
    if (announcement) await deleteMessageLogged(tg, chatId, announcement.message_id, `unrecorded ${type} announcement`);
    throw e;
  }

  // The challenge is live from here on: failures below must not make the slot start it again.
  try {
    await tg.pinChatMessage(chatId, announcement.message_id);
  } catch (e) {
    console.error("Failed to pin announcement:", e.message);
  }
  try {
    const activeTopics = await storage.getActiveTopics(chatId);
    activeTopics[challenge.topicThreadId] = type;
    await storage.setActiveTopics(chatId, activeTopics);
    await storage.addThemesToHistory(chatId, type, [challenge.topic]);
  } catch (e) {
    console.error(`startChallenge: bookkeeping after start failed (${type}):`, e.message);
    await logAlert(
      storage, "error", "startChallenge",
      `Челлендж запущен, но тема треда не отмечена активной — работы могут не приниматься: ${e.message}`,
      { chatId, type, challengeId: challenge.id },
    );
  }
  console.log(`Challenge started: community=${chatId}, ${type} #${challenge.id} - "${challenge.topic}"`);
}

const SLOT_ACTIONS = { poll: generatePoll, challenge: startChallenge };

/** Manual actions: chat commands and the admin panel's buttons. */
const LIFECYCLE_ACTIONS = {
  async poll(env, chatId, config, tg, storage, type) {
    const existing = await storage.getPoll(chatId, type);
    if (existing) await retirePoll(tg, storage, chatId, type, existing);
    await generatePoll(env, chatId, config, tg, storage, type);
  },
  async "cancel-poll"(env, chatId, config, tg, storage, type) {
    const existing = await storage.getPoll(chatId, type);
    if (existing) await retirePoll(tg, storage, chatId, type, existing);
  },
  start: (env, chatId, config, tg, storage, type) => startChallenge(env, chatId, config, tg, storage, type),
  finish: finishChallenge,
};

/**
 * Run a slot's action once per slot occurrence. The attempt is recorded before acting, so the
 * same minute delivered twice runs it once; only success completes the slot, a failure retries.
 */
async function runSlot(env, tg, storage, chatId, config, state, type, action, occurrence, nowMs) {
  const slotKey = `${action}:${type}`;
  const failKey = `${slotKey}!`;
  const waitKey = `${slotKey}~`;
  if (nowMs < occurrence || state.slots[slotKey] === occurrence) return;

  const failed = state.slots[failKey]?.at === occurrence ? state.slots[failKey] : null;
  const waiting = state.slots[waitKey]?.at === occurrence ? state.slots[waitKey] : null;
  const due = waiting ? waiting.until : occurrence;
  const lateBy = nowMs - due;
  if (lateBy < 0) return;
  if (failed) {
    if (lateBy > CRON_RETRY_MS || nowMs - (failed.last ?? 0) < CRON_RETRY_INTERVAL_MS) return;
  } else if (lateBy > CRON_CATCHUP_MS) {
    return;
  }

  const done = () => {
    state.slots[slotKey] = occurrence;
    delete state.slots[failKey];
    delete state.slots[waitKey];
    state.dirty = true;
  };
  if (state.bootstrap) {
    // First tick after a deploy adopts what is already due instead of re-running it.
    done();
    return;
  }

  if (action === "challenge") {
    const current = await storage.getChallenge(chatId, type);
    if (current?.status === "active") {
      // Started at or after this slot (a /run while the slot kept failing): it is this slot's challenge.
      if (current.startedAt >= occurrence) {
        done();
        return;
      }
      // Extended in the admin panel: the next start waits for the announced end.
      if (current.endsAt > nowMs) {
        state.slots[waitKey] = { at: occurrence, until: current.endsAt };
        state.dirty = true;
        return;
      }
    }
  } else {
    const poll = await storage.getPoll(chatId, type);
    // Posted at or after this slot (a /poll while the slot kept failing).
    if (poll && poll.createdAt >= occurrence && poll.createdAt <= nowMs + 60_000) {
      done();
      return;
    }
  }

  const tries = (failed ? failed.tries : 0) + 1;
  state.slots[failKey] = { at: occurrence, tries, last: nowMs };
  state.dirty = true;
  await storage.setCronState(chatId, state.slots);

  if (lateBy > 90_000) {
    console.warn(`cron: ${slotKey} for community=${chatId} ran ${Math.round(lateBy / 60000)}m late (попытка ${tries})`);
  }

  let error = null;
  try {
    await SLOT_ACTIONS[action](env, chatId, config, tg, storage, type, nowMs);
  } catch (e) {
    error = e;
  }
  const what = SLOT_LABELS[slotKey];
  const where = communityLabel(config, chatId);

  if (!error) {
    done();
    try {
      // Now, not at the end of the tick: an invocation that dies later must not run the slot again.
      await storage.setCronState(chatId, state.slots);
    } catch (e) {
      console.error(`cron: could not record ${slotKey} as done:`, e.message);
    }
    if (failed) {
      await logAlert(storage, "info", slotKey, `${what} — ${where}: запустился с попытки ${tries}`, { chatId, slot: slotKey, occurrence, tries });
      await notifyOwner(env, tg, storage, `✅ Восстановилось: ${what} — ${where} запустился с попытки ${tries}.`);
    }
    return;
  }

  const reason = String(error.message || error).slice(0, 300);
  const giveUp = lateBy + CRON_RETRY_INTERVAL_MS > CRON_RETRY_MS;
  await reportFailure(
    env, tg, storage, slotKey,
    `Не удалось запустить ${what} — ${where}.\nПричина: ${reason}\n`
      + (giveUp ? `Попыток: ${tries}, все неудачные. Цикл пропущен, нужна проверка.` : `Попытка ${tries}, повтор через 10 минут.`),
    { chatId, community: config?.name ?? null, slot: slotKey, occurrence, tries, error: reason },
  );
}

async function handleCronForCommunity(env, chatId, config, tg, storage, now) {
  const schedule = await getSchedule(storage, chatId);
  const stored = await storage.getCronState(chatId);
  const state = { slots: stored || {}, bootstrap: !stored, dirty: false };
  const nowMs = now.getTime();

  for (const type of CHALLENGE_TYPES) {
    for (const action of ["poll", "challenge"]) {
      const at = slotAt(schedule, type, action);
      if (!Number.isInteger(at.hour)) continue;
      await runSlot(env, tg, storage, chatId, config, state, type, action, lastSlotOccurrence(now, type, at), nowMs);
    }
  }

  // Persist even when nothing ran on the bootstrap tick, or the next due slot
  // would be adopted (skipped) instead of run.
  if (state.dirty || state.bootstrap) await storage.setCronState(chatId, state.slots);
}

async function handleCron(env, tg, storage, scheduledTime) {
  try {
    const now = scheduledTime ? new Date(scheduledTime) : new Date();
    console.log(`Cron fired: ${now.toISOString()}`);

    const communityConfigs = await getAllActiveCommunities(env, storage);
    if (communityConfigs.length === 0) {
      console.log("Cron: no active communities");
      return;
    }
    console.log(`Cron: processing ${communityConfigs.length} communities`);

    for (const config of communityConfigs) {
      if (!config.chatId) continue;
      try {
        await handleCronForCommunity(env, config.chatId, config, tg, storage, now);
      } catch (e) {
        console.error(`Cron error for community ${config.chatId}:`, { error: e.message, stack: e.stack });
      }
    }
  } catch (e) {
    console.error("handleCron error:", { error: e.message, stack: e.stack });
  }
}

// ============================================
// MAIN HANDLER
// ============================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Admin HTTP endpoints require `Authorization: Bearer ADMIN_SECRET`; no secret configured = closed. */
function isAuthorizedAdmin(request, env) {
  return Boolean(env.ADMIN_SECRET) && request.headers.get("Authorization") === `Bearer ${env.ADMIN_SECRET}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({ status: "ok", bot: "TG Challenge Bot", version: "2.5.0" });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      const tg = new TelegramAPI(env.BOT_TOKEN);
      const secret = await webhookSecret(env);
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
        await ensureWebhookConfig(tg, secret, { resecure: true });
        return new Response("Forbidden", { status: 403 });
      }
      try {
        const update = await request.json();

        // Telegram re-delivers an update it did not get a 200 for; process each once. The marker
        // is bookkeeping only: when KV cannot store it, the update is still processed.
        if (update.update_id) {
          const dedupKey = `webhook:processed:${update.update_id}`;
          try {
            if (await env.CHALLENGE_KV.get(dedupKey)) {
              console.log(`Skipping duplicate update ${update.update_id}`);
              return new Response("OK");
            }
            await env.CHALLENGE_KV.put(dedupKey, "1", { expirationTtl: TTL.WEBHOOK_DEDUP });
          } catch (e) {
            console.error(`webhook dedup unavailable for ${update.update_id}:`, e.message);
          }
        }

        const storage = new Storage(env.CHALLENGE_KV);
        await ensureWebhookConfig(tg, secret);
        if (update.message) {
          await handleMessage(update, env, tg, storage);
        } else if (update.message_reaction) {
          await handleReaction(update, env, storage);
        } else if (update.poll) {
          await handlePollUpdate(update.poll, storage);
        }
      } catch (e) {
        console.error("Webhook error:", { error: e.message, stack: e.stack });
      }
      return new Response("OK");
    }

    if (url.pathname !== "/setup" && url.pathname !== "/info" && !url.pathname.startsWith("/admin/")) {
      return new Response("Not found", { status: 404 });
    }
    if (!isAuthorizedAdmin(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    try {
      const storage = new Storage(env.CHALLENGE_KV);

      if (url.pathname === "/setup") {
        if (!env.BOT_TOKEN) return jsonResponse({ error: "BOT_TOKEN not configured" }, 500);
        const webhookUrl = `${url.origin}/webhook`;
        await new TelegramAPI(env.BOT_TOKEN).setWebhook(webhookUrl, await webhookSecret(env));
        return jsonResponse({ success: true, webhook: webhookUrl });
      }

      if (url.pathname === "/info" || (url.pathname === "/admin/status" && !url.searchParams.get("chat_id"))) {
        const communities = await getAllActiveCommunities(env, storage);
        return jsonResponse({
          configured: !!env.BOT_TOKEN,
          maxCommunities: MAX_COMMUNITIES,
          totalCommunities: communities.length,
          communities: await getCommunities(storage),
          legacyChatId: env.CHAT_ID ? parseInt(env.CHAT_ID, 10) : null,
        });
      }

      if (url.pathname === "/admin/status") {
        const chatId = parseInt(url.searchParams.get("chat_id"), 10);
        const [challenges, polls, activeTopics] = await Promise.all([
          Promise.all(CHALLENGE_TYPES.map((t) => storage.getChallenge(chatId, t))),
          Promise.all(CHALLENGE_TYPES.map((t) => storage.getPoll(chatId, t))),
          storage.getActiveTopics(chatId),
        ]);
        return jsonResponse({
          chatId,
          challenges: Object.fromEntries(CHALLENGE_TYPES.map((t, i) => [t, challenges[i]])),
          polls: Object.fromEntries(CHALLENGE_TYPES.map((t, i) => [t, !!polls[i]])),
          activeTopics,
        });
      }

      if (url.pathname === "/admin/delete-message" && request.method === "POST") {
        const chatId = parseInt(url.searchParams.get("chat_id"), 10);
        const messageId = parseInt(url.searchParams.get("message_id"), 10);
        if (!Number.isFinite(chatId) || !Number.isFinite(messageId)) {
          return jsonResponse({ error: "chat_id + message_id required" }, 400);
        }
        await new TelegramAPI(env.BOT_TOKEN).request("deleteMessage", { chat_id: chatId, message_id: messageId });
        return jsonResponse({ ok: true, chat_id: chatId, message_id: messageId });
      }

      // POST /admin/{poll|cancel-poll|start|finish}/{daily|weekly|monthly}?chat_id=…
      const lifecycle = url.pathname.match(/^\/admin\/(poll|cancel-poll|start|finish)\/(daily|weekly|monthly)$/);
      if (lifecycle && request.method === "POST") {
        const [, action, type] = lifecycle;
        const chatId = parseInt(url.searchParams.get("chat_id"), 10);
        if (!Number.isFinite(chatId)) return jsonResponse({ error: "Missing chat_id parameter" }, 400);
        const config = await getConfigForChat(env, storage, chatId);
        if (!config) return jsonResponse({ error: "Community not registered" }, 404);

        try {
          await LIFECYCLE_ACTIONS[action](env, chatId, config, new TelegramAPI(env.BOT_TOKEN), storage, type);
        } catch (e) {
          return jsonResponse({ success: false, action, type, chatId, error: e.message }, 500);
        }
        return jsonResponse({ success: true, action, type, chatId });
      }

      return new Response("Not found", { status: 404 });
    } catch (e) {
      console.error(`Admin endpoint error (${url.pathname}):`, { error: e.message, stack: e.stack });
      return jsonResponse({ error: e.message }, 500);
    }
  },

  async scheduled(event, env) {
    try {
      if (!env.BOT_TOKEN) {
        console.error("Scheduled job skipped: missing BOT_TOKEN");
        return;
      }

      const tg = new TelegramAPI(env.BOT_TOKEN);
      const storage = new Storage(env.CHALLENGE_KV);

      // scheduledTime, not Date.now(): the tick can fire a second before its minute.
      await handleCron(env, tg, storage, event.scheduledTime);
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
