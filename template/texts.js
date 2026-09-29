const DEFAULT_TEXTS = {
  // Ответ на принятую работу (случайный из списка)
  submissionReactions: [
    "✅ <b>Работа принята!</b>",
  ],
  // Фраза победителю (случайная, {phrase})
  winnerPhrases: [
    "Поздравляем! 🎉",
  ],
  challengeTypeTitles: {
    daily: "⚡ Челлендж дня",
    weekly: "🎯 Челлендж недели",
    monthly: "👑 Челлендж месяца",
  },
  pollQuestion: "Голосование за тему следующего челленджа",
  challengeAnnouncementTitles: {
    daily: "⚡ ЧЕЛЛЕНДЖ ДНЯ",
    weekly: "🎯 ЧЕЛЛЕНДЖ НЕДЕЛИ",
    monthly: "👑 ЧЕЛЛЕНДЖ МЕСЯЦА",
  },
  // {title} {voteLine} {topic} {startDate} {endDate}
  challengeAnnouncementTemplate: "<b>{title}</b>\n{startDate} — {endDate}{voteLine}\n\n💎 <b>ЗАДАНИЕ:</b>\n{topic}\n\n📸 Отправьте изображение в эту тему\n🏆 Лучшая работа — по реакциям\n🌚 Не учитывается\n\n<i>/stats · /leaderboard · /current</i>",
  // {username} {score} {votes} {phrase}
  winnerAnnouncementTemplate: "🏆 <b>Победитель челленджа</b>\n\n{username} — <b>{votes}</b>\n\n<i>{phrase}</i>",
  // {username} {score} {votes} {topic} {phrase}
  winnerAnnouncementFullTemplate: "🏆 <b>Победитель челленджа</b>\n\n{username} — <b>{votes}</b>\n\n<i>{topic}</i>",
  noSubmissions: "😔 <i>В этом челлендже не было участников.</i>",
  noVotes: "🤷 <i>Работы есть, но ни одна не набрала реакций — победителя нет.</i>",
  // {current} {max} {workWord} {maxWord}
  submissionLimitReached: "⚠️ Вы уже отправили <b>{current}</b> {workWord} в этот челлендж (максимум <b>{max}</b> {maxWord})",
  // {label}
  leaderboardTitle: "🏆 <b>Топ-10 победителей {label} челленджей</b>",
  leaderboardLabels: {
    daily: "дневных",
    weekly: "недельных",
    monthly: "месячных",
  },
  // {dailySched} {weeklySched} {monthlySched}
  helpMessage: "<b>Бот для арт-челленджей</b>\n\n<b>Как участвовать:</b>\n1. Дождитесь объявления темы\n2. Отправьте изображение в тему челленджа\n3. Ставьте реакции работам других\n4. Побеждает работа с наибольшим числом реакций\n\n<b>Расписание:</b>\n• Дневные — {dailySched}\n• Недельные — {weeklySched}\n• Месячные — {monthlySched}\n\n<b>Команды:</b>\n/current — активные челленджи\n/stats — ваша статистика\n/leaderboard — топ победителей\n/suggest — предложить тему\n\n<i>Реакция 🌚 не учитывается</i>",
};
