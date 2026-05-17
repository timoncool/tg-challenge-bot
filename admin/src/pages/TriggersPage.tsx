import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Alert,
  Skeleton,
  ActionIcon,
  TextInput,
  Code,
  SimpleGrid,
} from "@mantine/core";
import {
  IconClock,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconBolt,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import { notifications } from "@mantine/notifications";

interface Schedule { cron: string; created_on?: string; modified_on?: string; }
interface CronResp { worker: string; schedules: Schedule[]; }

const PRESETS: { label: string; cron: string; desc: string }[] = [
  { cron: "0 * * * *",      label: "Каждый час",     desc: "Рекомендуется — бот сам решает по per-community schedule" },
  { cron: "*/30 * * * *",   label: "Каждые 30 мин",  desc: "Чаще проверять, реакция быстрее на ручные правки" },
  { cron: "0 */6 * * *",    label: "Каждые 6 часов", desc: "Реже — для тестов" },
  { cron: "0 0 * * *",      label: "Раз в сутки",    desc: "Только daily в полночь UTC — для минимум активности" },
];

export function TriggersPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Schedule[] | null>(null);

  const q = useQuery({
    queryKey: ["cron-triggers"],
    queryFn: () => api.get<CronResp>("/api/cron/triggers"),
  });

  useEffect(() => { if (q.data && !draft) setDraft(q.data.schedules); }, [q.data, draft]);

  const saveM = useMutation({
    mutationFn: (schedules: Schedule[]) =>
      api.put<{ ok: true }>("/api/cron/triggers", { schedules }),
    onSuccess: () => {
      notifications.show({ message: "Cron triggers обновлены", color: "violet" });
      qc.invalidateQueries({ queryKey: ["cron-triggers"] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  return (
    <Box style={{ padding: "40px 48px 120px", maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        crumb="CONTROL ROOM / 07 / CRON TRIGGERS"
        title="Внутренний планировщик"
        emphasis="планировщик"
        subtitle="Cloudflare Workers Cron на воркере бота. Заменяет ручные scheduled-сообщения в Telegram. Когда триггер срабатывает, бот сам перебирает все комьюнити и сравнивает текущий час с per-community schedule."
      />

      {q.isLoading && <Skeleton h={200} />}

      {q.error && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} radius="md">
          <Text size="sm">{(q.error as Error).message}</Text>
          <Text size="xs" c="dimmed" mt={4}>
            Для этой страницы нужны CF API credentials в Pages env:
            <br />
            <Code>CF_ACCOUNT_ID</Code>, <Code>CF_API_TOKEN</Code> (или <Code>CF_AUTH_EMAIL</Code>+<Code>CF_AUTH_KEY</Code>)
          </Text>
        </Alert>
      )}

      {draft && (
        <Stack gap="lg">
          <Box className="glass" style={{ padding: 24 }}>
            <Group justify="space-between" align="flex-start" mb="md">
              <Stack gap={2}>
                <Text fw={600} style={{ fontSize: 15 }}>Активные триггеры</Text>
                <Text size="12px" c="dimmed">Worker: <Code>{q.data?.worker}</Code></Text>
              </Stack>
              <Button
                size="xs"
                variant="default"
                leftSection={<IconPlus size={14} />}
                onClick={() => setDraft([...draft, { cron: "0 * * * *" }])}
              >
                Добавить
              </Button>
            </Group>

            {draft.length === 0 && (
              <Alert color="amber" variant="light" radius="md" icon={<IconAlertTriangle size={14} />}>
                <Text size="sm">
                  Нет cron triggers. Бот не будет автоматически создавать опросы/челленджи.
                  Добавь хотя бы <Code>0 * * * *</Code> (раз в час).
                </Text>
              </Alert>
            )}

            <Stack gap={8}>
              {draft.map((s, i) => (
                <Group key={i} gap={8} wrap="nowrap" align="center"
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                >
                  <IconClock size={14} color="var(--accent)" />
                  <TextInput
                    value={s.cron}
                    onChange={(e) => {
                      const next = [...draft];
                      next[i] = { ...next[i], cron: e.currentTarget.value };
                      setDraft(next);
                    }}
                    placeholder="0 * * * *"
                    style={{ flex: 1 }}
                    styles={{ input: { fontFamily: "var(--font-mono)", background: "transparent", border: "none" } }}
                    size="sm"
                  />
                  <Text size="11px" c="var(--fg-faint)" className="mono" style={{ minWidth: 100 }}>
                    {humanize(s.cron)}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => setDraft(draft.filter((_, idx) => idx !== i))}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                size="xs"
                onClick={() => setDraft(q.data?.schedules ?? [])}
                disabled={JSON.stringify(draft) === JSON.stringify(q.data?.schedules)}
              >
                Отменить
              </Button>
              <Button
                size="xs"
                className="btn-primary"
                leftSection={<IconCheck size={14} />}
                onClick={() => saveM.mutate(draft)}
                loading={saveM.isPending}
                disabled={JSON.stringify(draft) === JSON.stringify(q.data?.schedules)}
              >
                Сохранить и применить
              </Button>
            </Group>
          </Box>

          {/* Presets */}
          <Box>
            <Text size="11px" c="var(--fg-dim)" fw={500} mb={8}>Быстрые варианты</Text>
            <SimpleGrid cols={2} spacing="sm">
              {PRESETS.map((p) => (
                <Box
                  key={p.cron}
                  className="glass lift"
                  style={{ padding: 14, cursor: "pointer" }}
                  onClick={() => setDraft([{ cron: p.cron }])}
                >
                  <Group gap={8} mb={2}>
                    <IconBolt size={12} color="var(--accent-bright)" />
                    <Text size="13px" fw={500}>{p.label}</Text>
                  </Group>
                  <Text size="11px" className="mono" c="var(--accent-bright)">{p.cron}</Text>
                  <Text size="11px" c="dimmed" mt={4}>{p.desc}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>

          <Alert color="violet" variant="light" radius="md">
            <Text size="sm" fw={500} mb={4}>Как перевести с Telegram scheduled messages</Text>
            <Stack gap={2}>
              <Text size="12px">1. Сохрани здесь <Code>0 * * * *</Code> (или сразу один из пресетов выше)</Text>
              <Text size="12px">2. Зайди в Telegram → каждая твоя group → найди scheduled-сообщения с автоповтором → удали</Text>
              <Text size="12px">3. Готово — бот будет сам срабатывать каждый час по cron'у Cloudflare</Text>
            </Stack>
          </Alert>
        </Stack>
      )}
    </Box>
  );
}

function humanize(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "";
  const [m, h, dom, mo, dow] = parts;
  if (m === "0" && h === "*" && dom === "*" && mo === "*" && dow === "*") return "каждый час";
  if (m === "*/30" && h === "*") return "каждые 30 мин";
  if (m === "0" && h === "0" && dom === "*") return "ежедневно в 00:00 UTC";
  if (m === "0" && h.startsWith("*/")) return `каждые ${h.slice(2)} ч`;
  return cron;
}
