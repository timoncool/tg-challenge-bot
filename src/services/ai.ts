// ============================================
// AI Service for Challenge Theme Generation
// Uses Google Gemini 3 Flash API (Dec 2025)
// ============================================

import type { ChallengeType } from "../types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Note: Using gemini-2.0-flash as gemini-3-flash may require different endpoint
// Update to gemini-3-flash when available in stable API

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

export class AIService {
  constructor(private apiKey: string) {}

  async generateThemes(
    type: ChallengeType,
    language: "ru" | "en" = "ru",
    previousThemes: string[] = []
  ): Promise<string[]> {
    const complexity = {
      daily: language === "ru"
        ? "простые, забавные, можно сделать за 5-10 минут генерации"
        : "simple, fun, can be done in 5-10 minutes of generation",
      weekly: language === "ru"
        ? "интересные, требующие креатива и экспериментов со стилями"
        : "interesting, requiring creativity and style experimentation",
      monthly: language === "ru"
        ? "сложные, амбициозные, настоящий вызов для мастерства"
        : "complex, ambitious, a real challenge for mastery",
    };

    // Build exclusion list from previous themes
    const exclusionNote = previousThemes.length > 0
      ? language === "ru"
        ? `\n\nВАЖНО: НЕ предлагай темы похожие на эти (уже использованные):\n${previousThemes.map((t, i) => `- ${t}`).join("\n")}`
        : `\n\nIMPORTANT: DO NOT suggest themes similar to these (already used):\n${previousThemes.map((t, i) => `- ${t}`).join("\n")}`
      : "";

    const prompt = language === "ru"
      ? `Ты помогаешь сообществу нейро-арт генерации (Midjourney, Stable Diffusion, DALL-E, Flux и т.д.).

Придумай 4 уникальных темы для ${type === "daily" ? "ежедневного" : type === "weekly" ? "еженедельного" : "ежемесячного"} челленджа.

Сложность: ${complexity[type]}.

Требования:
- Темы должны быть КОНКРЕТНЫМИ (не "природа", а "Заброшенный маяк на закате в стиле Хаяо Миядзаки")
- Вдохновляющими для AI-арта
- Разнообразными по стилям и сюжетам
- На русском языке
- Без нумерации и пояснений${exclusionNote}

Ответь ТОЛЬКО списком из 4 тем, по одной на строку.`
      : `You help an AI art generation community (Midjourney, Stable Diffusion, DALL-E, Flux, etc.).

Create 4 unique themes for a ${type} challenge.

Difficulty: ${complexity[type]}.

Requirements:
- Themes must be SPECIFIC (not "nature" but "Abandoned lighthouse at sunset in Hayao Miyazaki style")
- Inspiring for AI art
- Diverse in styles and subjects
- In English
- No numbering or explanations${exclusionNote}

Reply with ONLY a list of 4 themes, one per line.`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 500,
          },
        }),
      });

      if (!response.ok) {
        console.error(`Gemini API error: ${response.status}`);
        return this.getFallbackThemes(type, language);
      }

      const data: GeminiResponse = await response.json();

      if (data.error) {
        console.error(`Gemini error: ${data.error.message}`);
        return this.getFallbackThemes(type, language);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const themes = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 5 && !line.match(/^\d+[\.\)]/))
        .slice(0, 4);

      if (themes.length < 4) {
        return this.getFallbackThemes(type, language);
      }

      return themes;
    } catch (error) {
      console.error("AI generation failed:", error);
      return this.getFallbackThemes(type, language);
    }
  }

  private getFallbackThemes(
    type: ChallengeType,
    language: "ru" | "en"
  ): string[] {
    const fallbacks = {
      ru: {
        daily: [
          "Уютная кофейня в дождливый день",
          "Космический кот-путешественник",
          "Волшебный лес с светящимися грибами",
          "Ретро-футуристический город",
        ],
        weekly: [
          "Подводный мир глазами рыбы",
          "Заброшенная космическая станция",
          "Сюрреалистичный натюрморт с часами",
          "Киберпанк-версия сказки",
        ],
        monthly: [
          "Эпическая битва стихий",
          "Параллельная вселенная, где всё наоборот",
          "Симбиоз природы и технологий будущего",
          "Мир глазами искусственного интеллекта",
        ],
      },
      en: {
        daily: [
          "Cozy coffee shop on a rainy day",
          "Space traveling cat",
          "Magical forest with glowing mushrooms",
          "Retro-futuristic city",
        ],
        weekly: [
          "Underwater world through a fish's eyes",
          "Abandoned space station",
          "Surrealistic still life with clocks",
          "Cyberpunk fairy tale version",
        ],
        monthly: [
          "Epic battle of elements",
          "Parallel universe where everything is opposite",
          "Symbiosis of nature and future technology",
          "World through the eyes of AI",
        ],
      },
    };

    return fallbacks[language][type];
  }
}
