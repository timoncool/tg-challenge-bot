import { Container, Stack, Title, Text, Card, Code } from "@mantine/core";

interface Props {
  title: string;
  description?: string;
  todoItems?: string[];
}

export function PlaceholderPage({ title, description, todoItems = [] }: Props) {
  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={1}>{title}</Title>
        {description && <Text c="dimmed">{description}</Text>}
        <Card padding="lg">
          <Stack gap="sm">
            <Text size="sm" fw={600} c="violet.4">
              Будет в следующих фазах
            </Text>
            {todoItems.map((t, i) => (
              <Text size="sm" key={i}>• {t}</Text>
            ))}
            <Text size="xs" c="dimmed" mt="sm">
              См. спек: <Code>D:/Projects/TEMP/superpowers/tg-challenge-bot/2026-05-17-admin-and-bot-refactor-design.md</Code>
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
