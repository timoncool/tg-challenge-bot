// ============================================
// Localization for TG Challenge Bot
// ============================================

import type { ChallengeType, Localization } from "./types";

export const ru: Localization = {
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
    const labels: Record<ChallengeType, string> = {
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
    const labels: Record<ChallengeType, string> = {
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

  statsMessage: (wins, rank) =>
    `📊 Ваша статистика:\n\n🏆 Побед: ${wins}\n📍 Место в рейтинге: ${rank}`,

  leaderboardTitle: (type) => {
    const labels: Record<ChallengeType, string> = {
      daily: "дневных",
      weekly: "недельных",
      monthly: "месячных",
    };
    return `🏆 ТОП-10 победителей ${labels[type]} челленджей:`;
  },

  helpMessage: `🤖 Бот для челленджей

📋 Как участвовать:
1. Дождитесь объявления темы
2. Отправьте изображение в тему челленджа
3. Ставьте реакции работам других участников
4. Побеждает работа с наибольшим числом реакций

⚠️ Реакция 🌚 не учитывается (используйте её для работ не по теме)

📊 Команды:
/stats — ваша статистика
/leaderboard — топ победителей
/current — текущие челленджи
/help — эта справка`,
};

export const en: Localization = {
  challengeTypes: {
    daily: "Daily Challenge",
    weekly: "Weekly Challenge",
    monthly: "Monthly Challenge",
  },

  pollQuestion: (type) => `🗳️ Vote for the ${type} challenge theme!`,

  challengeAnnouncement: (type, topic, endTime) => {
    const labels: Record<ChallengeType, string> = {
      daily: "🎯 DAILY CHALLENGE",
      weekly: "🎯 WEEKLY CHALLENGE",
      monthly: "🎯 MONTHLY CHALLENGE",
    };
    return `${labels[type]}

🎨 Theme: ${topic}

⏰ Until: ${endTime}

📸 To participate — just send an image to this topic!
❤️ React to submissions you like
🌚 Moon reaction doesn't count

Good luck! 🍀`;
  },

  winnerAnnouncement: (username, score, type) =>
    `🏆 ${type.toUpperCase()} CHALLENGE WINNER!

👤 ${username}
⭐ Reactions: ${score}

Congratulations! 🎉`,

  noSubmissions: "😔 Unfortunately, no one participated in this challenge.",

  statsMessage: (wins, rank) =>
    `📊 Your stats:\n\n🏆 Wins: ${wins}\n📍 Rank: ${rank}`,

  leaderboardTitle: (type) => `🏆 TOP-10 ${type} challenge winners:`,

  helpMessage: `🤖 Challenge Bot

📋 How to participate:
1. Wait for the theme announcement
2. Send an image to the challenge topic
3. React to other participants' work
4. The entry with most reactions wins

⚠️ 🌚 reaction doesn't count (use it for off-topic submissions)

📊 Commands:
/stats — your statistics
/leaderboard — top winners
/current — active challenges
/help — this help message`,
};

export function getLocalization(lang: string): Localization {
  return lang === "en" ? en : ru;
}
