import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

// Унифицированный page header, образец — PromptsPage.
//   <CONTROL ROOM / 04 / PROMPTS & CORPUS>
//   Что AI видит <em>в голове</em>.
//   {subtitle}
//
// emphasis — слово или фраза, которая будет выделена цветом var(--accent).
// Должна быть подстрокой title, иначе просто пишется отдельным span'ом в конце.
export function PageHeader({
  crumb,
  title,
  emphasis,
  subtitle,
}: {
  crumb: string;                // "CONTROL ROOM / 01 / DASHBOARD"
  title: string;                // "Что у тебя сейчас в эфире"
  emphasis?: string;            // "в эфире" — рендерится italic + accent
  subtitle?: ReactNode;
}) {
  let head: ReactNode = title;
  if (emphasis && title.includes(emphasis)) {
    const i = title.indexOf(emphasis);
    head = (
      <>
        {title.slice(0, i)}
        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>{emphasis}</em>
        {title.slice(i + emphasis.length)}
      </>
    );
  }
  return (
    <Stack gap={4} mb="lg">
      <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.18em" }}>
        {crumb}
      </Text>
      <Text style={{ fontFamily: "var(--font-serif)", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {head}
      </Text>
      {subtitle && (
        <Text size="sm" c="dimmed" mt={6}>
          {subtitle}
        </Text>
      )}
    </Stack>
  );
}
