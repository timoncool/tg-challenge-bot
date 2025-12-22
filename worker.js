// ============================================
// TG CHALLENGE BOT - Single File Version
// Просто скопируй этот код в Cloudflare Dashboard
// ============================================

// Эмодзи-исключение (негативная реакция)
const EXCLUDED_EMOJI = "🌚";

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
    const labels = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
    return `🗳️ Голосуем за тему ${labels[type]} челленджа!`;
  },
  challengeAnnouncement: (type, topic, endTime) => {
    const labels = { daily: "🎯 ЧЕЛЛЕНДЖ ДНЯ", weekly: "🎯 ЧЕЛЛЕНДЖ НЕДЕЛИ", monthly: "🎯 ЧЕЛЛЕНДЖ МЕСЯЦА" };
    return `${labels[type]}

🎨 Тема: ${topic}

⏰ До: ${endTime}

📸 Для участия — просто отправьте изображение в эту тему!
❤️ Ставьте реакции понравившимся работам
🌚 Реакция «луна» не учитывается

Удачи! 🍀`;
  },
  winnerAnnouncement: (username, score, type) => {
    const labels = { daily: "дневного", weekly: "недельного", monthly: "месячного" };
    return `🏆 ПОБЕДИТЕЛЬ ${labels[type].toUpperCase()} ЧЕЛЛЕНДЖА!

👤 ${username}
⭐ Набрано реакций: ${score}

Поздравляем! 🎉`;
  },
  noSubmissions: "😔 К сожалению, в этом челлендже никто не участвовал.",
  leaderboardTitle: (type) => {
    const labels = { daily: "дневных", weekly: "недельных", monthly: "месячных" };
    return `🏆 ТОП-10 победителей ${labels[type]} челленджей:`;
  },
  helpMessage: `🤖 Бот для челленджей

📋 Как участвовать:
1. Дождитесь объявления темы
2. Отправьте изображение в тему челленджа
3. Ставьте реакции работам других участников
4. Побеждает работа с наибольшим числом реакций

⚠️ Реакция 🌚 не учитывается

📊 Команды:
/stats — ваша статистика
/leaderboard — топ победителей
/current — текущие челленджи
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

  async request(method, params = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error(`Telegram API error: ${method}`, data);
      throw new Error(data.description || "Telegram API error");
    }
    return data.result;
  }

  async sendMessage(chatId, text, options = {}) {
    return this.request("sendMessage", { chat_id: chatId, text, ...options });
  }

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

  async setWebhook(url) {
    return this.request("setWebhook", {
      url,
      allowed_updates: ["message", "message_reaction", "message_reaction_count", "poll", "poll_answer"],
    });
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
  const complexity = {
    daily: "простые, забавные, можно сделать за 5-10 минут",
    weekly: "интересные, требующие креатива",
    monthly: "сложные, амбициозные, настоящий вызов",
  };

  const prompt = `Ты помогаешь сообществу нейро-арт генерации.
Придумай 4 уникальных темы для ${type === "daily" ? "ежедневного" : type === "weekly" ? "еженедельного" : "ежемесячного"} челленджа.
Сложность: ${complexity[type]}.
Темы должны быть КОНКРЕТНЫМИ и вдохновляющими для AI-арта.
Ответь ТОЛЬКО списком из 4 тем, по одной на строку, без нумерации.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 500 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const themes = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 5).slice(0, 4);

    if (themes.length >= 4) return themes;
  } catch (e) {
    console.error("AI error:", e);
  }

  // Fallback themes
  const fallbacks = {
    daily: ["Уютная кофейня в дождливый день", "Космический кот-путешественник", "Волшебный лес с светящимися грибами", "Ретро-футуристический город"],
    weekly: ["Подводный мир глазами рыбы", "Заброшенная космическая станция", "Сюрреалистичный натюрморт", "Киберпанк-версия сказки"],
    monthly: ["Эпическая битва стихий", "Параллельная вселенная", "Симбиоз природы и технологий", "Мир глазами ИИ"],
  };
  return fallbacks[type];
}

// ============================================
// HANDLERS
// ============================================

async function handleMessage(update, env, config, tg, storage) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const text = message.text || "";
  const threadId = message.message_thread_id || 0;

  // Commands
  if (text.startsWith("/start") || text.startsWith("/help")) {
    await tg.sendMessage(chatId, ru.helpMessage, { message_thread_id: threadId || undefined });
    return;
  }

  if (text.startsWith("/stats")) {
    const userId = message.from?.id;
    if (!userId) return;

    const daily = await storage.getUserStats("daily", userId);
    const weekly = await storage.getUserStats("weekly", userId);
    const monthly = await storage.getUserStats("monthly", userId);
    const total = daily.wins + weekly.wins + monthly.wins;

    await tg.sendMessage(
      chatId,
      `📊 Ваша статистика:\n\n🏆 Всего побед: ${total}\n\n📅 Дневные: ${daily.wins} (место #${daily.rank})\n📆 Недельные: ${weekly.wins} (место #${weekly.rank})\n📆 Месячные: ${monthly.wins} (место #${monthly.rank})`,
      { message_thread_id: threadId || undefined }
    );
    return;
  }

  if (text.startsWith("/leaderboard")) {
    const leaderboard = await storage.getLeaderboard("daily");
    if (leaderboard.length === 0) {
      await tg.sendMessage(chatId, "🏆 Рейтинг пока пуст!", { message_thread_id: threadId || undefined });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    let msg = ru.leaderboardTitle("daily") + "\n\n";
    leaderboard.slice(0, 10).forEach((e, i) => {
      const medal = medals[i] || `${i + 1}.`;
      msg += `${medal} ${e.username || `User ${e.userId}`} — ${e.wins} 🏆\n`;
    });

    await tg.sendMessage(chatId, msg, { message_thread_id: threadId || undefined });
    return;
  }

  if (text.startsWith("/current")) {
    const daily = await storage.getChallenge("daily");
    const weekly = await storage.getChallenge("weekly");
    const monthly = await storage.getChallenge("monthly");

    const format = (c, type) => {
      if (!c || c.status !== "active") return `${ru.challengeTypes[type]}: Нет активного`;
      const hours = Math.max(0, Math.floor((c.endsAt - Date.now()) / 3600000));
      return `${ru.challengeTypes[type]}:\n   🎨 "${c.topic}"\n   ⏰ Осталось: ${hours} ч.`;
    };

    await tg.sendMessage(
      chatId,
      `📋 Текущие челленджи:\n\n${format(daily, "daily")}\n\n${format(weekly, "weekly")}\n\n${format(monthly, "monthly")}`,
      { message_thread_id: threadId || undefined }
    );
    return;
  }

  // Photo submission
  if ((message.photo && message.photo.length > 0) || message.document?.mime_type?.startsWith("image/")) {
    if (chatId !== config.chatId) return;

    const challengeType = await storage.isActiveTopic(threadId);
    if (!challengeType) return;

    const challenge = await storage.getChallenge(challengeType);
    if (!challenge || challenge.status !== "active") return;
    if (Date.now() > challenge.endsAt) return;

    await storage.addSubmission(challengeType, challenge.id, {
      messageId: message.message_id,
      userId: message.from?.id,
      username: message.from?.username || message.from?.first_name,
      score: 0,
      timestamp: Date.now(),
    });

    console.log(`Submission: user=${message.from?.id}, msg=${message.message_id}`);
  }
}

async function handleReactionCount(update, env, config, storage) {
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

  for (const type of ["daily", "weekly", "monthly"]) {
    const challenge = await storage.getChallenge(type);
    if (challenge?.status === "active") {
      await storage.updateSubmissionScore(type, challenge.id, reaction.message_id, score);
    }
  }
}

// ============================================
// CRON JOBS
// ============================================

async function generatePoll(env, config, tg, storage, type) {
  const existing = await storage.getPoll(type);
  if (existing) return;

  const topicId = config.topics[type];
  const themes = await generateThemes(env.GEMINI_API_KEY, type);

  const poll = await tg.sendPoll(config.chatId, ru.pollQuestion(type), themes, {
    message_thread_id: topicId || undefined,
    is_anonymous: false,
    allows_multiple_answers: false,
  });

  await storage.savePoll({
    type,
    pollId: poll.poll.id,
    messageId: poll.message_id,
    options: themes,
    createdAt: Date.now(),
    topicThreadId: topicId,
  });

  console.log(`Poll created: ${type}`);
}

async function finishChallenge(env, config, tg, storage, type) {
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
    const winnerName = winner.username ? `@${winner.username}` : `User #${winner.userId}`;

    await tg.sendMessage(config.chatId, ru.winnerAnnouncement(winnerName, winner.score, type), {
      message_thread_id: challenge.topicThreadId || undefined,
      reply_to_message_id: winner.messageId,
    });

    if (config.topics.winners) {
      try {
        await tg.forwardMessage(config.chatId, config.chatId, winner.messageId, {
          message_thread_id: config.topics.winners,
        });
        await tg.sendMessage(
          config.chatId,
          `🏆 Победитель ${ru.challengeTypes[type]} #${challenge.id}\n👤 ${winnerName}\n🎨 Тема: "${challenge.topic}"\n⭐ Реакций: ${winner.score}`,
          { message_thread_id: config.topics.winners }
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
}

async function startChallenge(env, config, tg, storage, type) {
  await finishChallenge(env, config, tg, storage, type);

  const poll = await storage.getPoll(type);
  let theme = "Свободная тема";

  if (poll) {
    try {
      const stopped = await tg.stopPoll(config.chatId, poll.messageId);
      let maxVotes = 0;
      for (const opt of stopped.options) {
        if (opt.voter_count > maxVotes) {
          maxVotes = opt.voter_count;
          theme = opt.text;
        }
      }
    } catch (e) {
      theme = poll.options[0];
    }
    await storage.deletePoll(type);
  }

  const topicId = config.topics[type];
  const durations = { daily: 86400000, weekly: 604800000, monthly: 2419200000 };
  const endsAt = Date.now() + durations[type];

  const endDate = new Date(endsAt);
  const endTimeStr = endDate.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  const challengeId = await storage.getNextChallengeId(type);

  const announcement = await tg.sendMessage(config.chatId, ru.challengeAnnouncement(type, theme, endTimeStr), {
    message_thread_id: topicId || undefined,
  });

  await storage.saveChallenge({
    id: challengeId,
    type,
    topic: theme,
    status: "active",
    startedAt: Date.now(),
    endsAt,
    topicThreadId: topicId,
    announcementMessageId: announcement.message_id,
  });

  const activeTopics = await storage.getActiveTopics();
  activeTopics[topicId] = type;
  await storage.setActiveTopics(activeTopics);

  console.log(`Challenge started: ${type} #${challengeId} - "${theme}"`);
}

async function handleCron(env, config, tg, storage, cron) {
  const [, hour, day, , weekday] = cron.split(" ");
  const h = parseInt(hour, 10);
  const d = parseInt(day, 10);
  const w = parseInt(weekday, 10);

  console.log(`Cron: ${cron}`);

  // Daily
  if (h === 5 && day === "*" && weekday === "*") {
    await generatePoll(env, config, tg, storage, "daily");
  } else if (h === 17 && day === "*" && weekday === "*") {
    await startChallenge(env, config, tg, storage, "daily");
  }
  // Weekly
  else if (h === 10 && w === 6) {
    await generatePoll(env, config, tg, storage, "weekly");
  } else if (h === 17 && w === 0) {
    await startChallenge(env, config, tg, storage, "weekly");
  }
  // Monthly
  else if (h === 10 && d === 28) {
    await generatePoll(env, config, tg, storage, "monthly");
  } else if (h === 17 && d === 1) {
    await startChallenge(env, config, tg, storage, "monthly");
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
      return new Response(JSON.stringify({ status: "ok", bot: "TG Challenge Bot" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Setup webhook
    if (url.pathname === "/setup") {
      const tg = new TelegramAPI(env.BOT_TOKEN);
      const webhookUrl = `${url.origin}/webhook`;
      await tg.setWebhook(webhookUrl);
      return new Response(JSON.stringify({ success: true, webhook: webhookUrl }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Info
    if (url.pathname === "/info") {
      const config = getConfig(env);
      return new Response(JSON.stringify({
        configured: !!env.BOT_TOKEN,
        chat_id: config.chatId,
        topics: config.topics,
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Webhook
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const update = await request.json();
        const config = getConfig(env);
        const tg = new TelegramAPI(env.BOT_TOKEN);
        const storage = new Storage(env.CHALLENGE_KV);

        if (update.message) {
          await handleMessage(update, env, config, tg, storage);
        } else if (update.message_reaction_count) {
          await handleReactionCount(update, env, config, storage);
        }
      } catch (e) {
        console.error("Webhook error:", e);
      }

      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env) {
    if (!env.BOT_TOKEN || !env.CHAT_ID) return;

    const config = getConfig(env);
    const tg = new TelegramAPI(env.BOT_TOKEN);
    const storage = new Storage(env.CHALLENGE_KV);

    await handleCron(env, config, tg, storage, event.cron);
  },
};
