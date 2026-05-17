import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Skeleton,
  SegmentedControl,
  Switch,
  NumberInput,
  Select,
  SimpleGrid,
  Alert,
  Tabs,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCheck,
  IconAlertTriangle,
  IconCalendar,
  IconBolt,
  IconCrown,
  IconHash,
  IconSettings,
  IconHistory,
  IconTrophy,
  IconBulb,
  IconBookmark,
  IconRobot,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";
import { CommunityChallengesTab } from "./community/CommunityChallengesTab";
import { CommunityLeaderboardTab } from "./community/CommunityLeaderboardTab";
import { CommunitySuggestionsTab } from "./community/CommunitySuggestionsTab";
import { CommunityThemeHistoryTab } from "./community/CommunityThemeHistoryTab";
import { CommunityAiTab } from "./community/CommunityAiTab";

interface Settings {
  community: { chatId: number; name: string; addedAt: number };
  topics: { daily: number; weekly: number; monthly: number; winners: number };
  schedule: {
    daily:   { pollHour?: number; pollMinute?: number; challengeHour: number; challengeMinute?: number };
    weekly:  { pollDay?: number; pollHour?: number; pollMinute?: number; challengeDay: number; challengeHour: number; challengeMinute?: number };
    monthly: { pollDay?: number; pollHour?: number; pollMinute?: number; challengeDay: number; challengeHour: number; challengeMinute?: number };
  };
  contentMode: "vanilla" | "medium" | "nsfw";
  acceptLinks: boolean;
  minSuggestionReactions: number;
  submissionLimits: { daily: number; weekly: number; monthly: number };
}


const DAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export function CommunityPage() {
  const { chatId: chatIdParam } = useParams();
  const chatId = parseInt(chatIdParam ?? "0", 10);
  const nav = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["community-settings", chatId],
    queryFn: () => api.get<Settings>(`/api/communities/${chatId}/settings`),
    enabled: !!chatId,
  });

  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => { if (q.data && !draft) setDraft(q.data); }, [q.data, draft]);

  const saveM = useMutation({
    mutationFn: (payload: Partial<Settings>) =>
      api.patch<{ ok: true }>(`/api/communities/${chatId}/settings`, payload),
    onSuccess: () => {
      notifications.show({ message: "Сохранено", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-settings", chatId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  if (q.isLoading || !draft) {
    return (
      <Box style={{ padding: 48 }}>
        <Skeleton h={32} w={300} mb="md" />
        <Skeleton h={400} />
      </Box>
    );
  }

  if (q.error) {
    return (
      <Box style={{ padding: 48 }}>
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} radius="md">
          {(q.error as Error).message}
        </Alert>
      </Box>
    );
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(q.data);

  function save() {
    if (!draft) return;
    saveM.mutate({
      contentMode: draft.contentMode,
      acceptLinks: draft.acceptLinks,
      minSuggestionReactions: draft.minSuggestionReactions,
      submissionLimits: draft.submissionLimits,
      schedule: {
        daily: {
          challengeHour:   draft.schedule.daily.challengeHour,
          challengeMinute: draft.schedule.daily.challengeMinute ?? 0,
          pollHour:        draft.schedule.daily.pollHour,
          pollMinute:      draft.schedule.daily.pollMinute ?? 0,
        },
        weekly: {
          challengeDay:    draft.schedule.weekly.challengeDay,
          challengeHour:   draft.schedule.weekly.challengeHour,
          challengeMinute: draft.schedule.weekly.challengeMinute ?? 0,
          pollDay:         draft.schedule.weekly.pollDay,
          pollHour:        draft.schedule.weekly.pollHour,
          pollMinute:      draft.schedule.weekly.pollMinute ?? 0,
        },
        monthly: {
          challengeDay:    draft.schedule.monthly.challengeDay,
          challengeHour:   draft.schedule.monthly.challengeHour,
          challengeMinute: draft.schedule.monthly.challengeMinute ?? 0,
          pollDay:         draft.schedule.monthly.pollDay,
          pollHour:        draft.schedule.monthly.pollHour,
          pollMinute:      draft.schedule.monthly.pollMinute ?? 0,
        },
      },
    });
  }

  return (
    <Box style={{ padding: "40px 48px 120px", maxWidth: 1100, margin: "0 auto" }}>
      <Group gap="xs" mb="lg">
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => nav("/")}
        >
          К дашборду
        </Button>
      </Group>

      <Group justify="space-between" align="flex-end" mb="xl">
        <Stack gap={6}>
          <Text size="12px" c="var(--fg-dim)" fw={500}>Сообщество</Text>
          <Text fw={600} style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {draft.community.name}
          </Text>
          <Text size="11px" c="var(--fg-faint)" className="mono">
            chat_id {draft.community.chatId}
          </Text>
        </Stack>
      </Group>

      <Tabs defaultValue="settings" variant="default" mb="lg">
        <Tabs.List>
          <Tabs.Tab value="settings"     leftSection={<IconSettings size={14} />}>Настройки</Tabs.Tab>
          <Tabs.Tab value="challenges"   leftSection={<IconHistory size={14} />}>Челленджи</Tabs.Tab>
          <Tabs.Tab value="leaderboard"  leftSection={<IconTrophy size={14} />}>Лидерборд</Tabs.Tab>
          <Tabs.Tab value="suggestions"  leftSection={<IconBulb size={14} />}>Предложения</Tabs.Tab>
          <Tabs.Tab value="themes"       leftSection={<IconBookmark size={14} />}>История тем</Tabs.Tab>
          <Tabs.Tab value="ai"           leftSection={<IconRobot size={14} />}>AI</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="challenges" pt="lg">
          <CommunityChallengesTab chatId={chatId} />
        </Tabs.Panel>
        <Tabs.Panel value="leaderboard" pt="lg">
          <CommunityLeaderboardTab chatId={chatId} />
        </Tabs.Panel>
        <Tabs.Panel value="suggestions" pt="lg">
          <CommunitySuggestionsTab chatId={chatId} />
        </Tabs.Panel>
        <Tabs.Panel value="themes" pt="lg">
          <CommunityThemeHistoryTab chatId={chatId} />
        </Tabs.Panel>
        <Tabs.Panel value="ai" pt="lg">
          <CommunityAiTab chatId={chatId} />
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="lg">
          <Stack gap="lg">
        {/* Content mode */}
        <Section title="Режим контента" hint="Что AI генерирует в темах для голосования">
          <SegmentedControl
            fullWidth
            color="violet"
            value={draft.contentMode}
            onChange={(v) => setDraft({ ...draft, contentMode: v as Settings["contentMode"] })}
            data={[
              { value: "vanilla", label: "🍦  Vanilla — SFW" },
              { value: "medium",  label: "🔥  Medium — поп-культура, нуар" },
              { value: "nsfw",    label: "🌙  NSFW — 18+" },
            ]}
            styles={{ root: { background: "var(--bg-2)" } }}
          />
        </Section>

        {/* Schedule */}
        <Section
          title="Расписание"
          hint="Все часы в UTC (МСК − 3). Бот сам закрывает старый и стартует новый одной операцией в challengeHour."
        >
          <SimpleGrid cols={3} spacing="md">
            <ScheduleCard
              icon={<IconBolt size={16} />}
              title="Daily"
              color="var(--amber)"
              hint="каждый день"
              children={
                <Stack gap="xs">
                  <Group grow>
                    <HourMinute
                      label="Опрос"
                      hour={draft.schedule.daily.pollHour}
                      minute={draft.schedule.daily.pollMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, daily: { ...draft.schedule.daily, pollHour: h, pollMinute: mi } },
                      })}
                    />
                    <HourMinute
                      label="Старт"
                      hour={draft.schedule.daily.challengeHour}
                      minute={draft.schedule.daily.challengeMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, daily: { ...draft.schedule.daily, challengeHour: h, challengeMinute: mi } },
                      })}
                    />
                  </Group>
                </Stack>
              }
            />
            <ScheduleCard
              icon={<IconCalendar size={16} />}
              title="Weekly"
              color="var(--accent)"
              hint="раз в неделю"
              children={
                <Stack gap="xs">
                  <Group grow>
                    <Select
                      label="День опроса"
                      value={String(draft.schedule.weekly.pollDay ?? "")}
                      onChange={(v) => v != null && setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, weekly: { ...draft.schedule.weekly, pollDay: parseInt(v, 10) } },
                      })}
                      data={DAYS.map((d, i) => ({ value: String(i), label: d }))}
                      allowDeselect={false}
                    />
                    <Select
                      label="День старта"
                      value={String(draft.schedule.weekly.challengeDay)}
                      onChange={(v) => v && setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, weekly: { ...draft.schedule.weekly, challengeDay: parseInt(v, 10) } },
                      })}
                      data={DAYS.map((d, i) => ({ value: String(i), label: d }))}
                      allowDeselect={false}
                    />
                  </Group>
                  <Group grow>
                    <HourMinute
                      label="Опрос"
                      hour={draft.schedule.weekly.pollHour}
                      minute={draft.schedule.weekly.pollMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, weekly: { ...draft.schedule.weekly, pollHour: h, pollMinute: mi } },
                      })}
                    />
                    <HourMinute
                      label="Старт"
                      hour={draft.schedule.weekly.challengeHour}
                      minute={draft.schedule.weekly.challengeMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, weekly: { ...draft.schedule.weekly, challengeHour: h, challengeMinute: mi } },
                      })}
                    />
                  </Group>
                </Stack>
              }
            />
            <ScheduleCard
              icon={<IconCrown size={16} />}
              title="Monthly"
              color="var(--orange)"
              hint="раз в месяц"
              children={
                <Stack gap="xs">
                  <Group grow>
                    <NumberInput
                      label="День опроса"
                      value={draft.schedule.monthly.pollDay ?? ""}
                      onChange={(v) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, monthly: { ...draft.schedule.monthly, pollDay: Number(v) || 1 } },
                      })}
                      min={1}
                      max={28}
                    />
                    <NumberInput
                      label="День старта"
                      value={draft.schedule.monthly.challengeDay}
                      onChange={(v) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, monthly: { ...draft.schedule.monthly, challengeDay: Number(v) || 1 } },
                      })}
                      min={1}
                      max={28}
                    />
                  </Group>
                  <Group grow>
                    <HourMinute
                      label="Опрос"
                      hour={draft.schedule.monthly.pollHour}
                      minute={draft.schedule.monthly.pollMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, monthly: { ...draft.schedule.monthly, pollHour: h, pollMinute: mi } },
                      })}
                    />
                    <HourMinute
                      label="Старт"
                      hour={draft.schedule.monthly.challengeHour}
                      minute={draft.schedule.monthly.challengeMinute}
                      onChange={(h, mi) => setDraft({
                        ...draft,
                        schedule: { ...draft.schedule, monthly: { ...draft.schedule.monthly, challengeHour: h, challengeMinute: mi } },
                      })}
                    />
                  </Group>
                </Stack>
              }
            />
          </SimpleGrid>
        </Section>

        {/* Submission limits */}
        <Section title="Лимиты работ" hint="Сколько работ один участник может прислать в челлендж">
          <SimpleGrid cols={3} spacing="md">
            <NumberInput
              label="Daily"
              value={draft.submissionLimits.daily}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  submissionLimits: { ...draft.submissionLimits, daily: Number(v) || 1 },
                })
              }
              min={1}
              max={20}
            />
            <NumberInput
              label="Weekly"
              value={draft.submissionLimits.weekly}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  submissionLimits: { ...draft.submissionLimits, weekly: Number(v) || 1 },
                })
              }
              min={1}
              max={20}
            />
            <NumberInput
              label="Monthly"
              value={draft.submissionLimits.monthly}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  submissionLimits: { ...draft.submissionLimits, monthly: Number(v) || 1 },
                })
              }
              min={1}
              max={20}
            />
          </SimpleGrid>
        </Section>

        {/* Suggestions + links */}
        <Section title="Прочее">
          <SimpleGrid cols={2} spacing="md">
            <NumberInput
              label="Минимум реакций для предложения темы"
              description="Сколько 👍 нужно собрать предложенной теме чтобы попасть в опрос"
              value={draft.minSuggestionReactions}
              onChange={(v) =>
                setDraft({ ...draft, minSuggestionReactions: Number(v) || 3 })
              }
              min={1}
              max={50}
            />
            <Box>
              <Text size="xs" mb={4}>Принимать ссылки с превью как работы</Text>
              <Switch
                checked={draft.acceptLinks}
                onChange={(e) => setDraft({ ...draft, acceptLinks: e.currentTarget.checked })}
                label={draft.acceptLinks ? "Включено" : "Выключено"}
                color="violet"
              />
            </Box>
          </SimpleGrid>
        </Section>

        {/* Topics — readonly */}
        <Section
          title="Топики форума"
          hint="Только просмотр. Задаются командой /set_daily /set_weekly /set_monthly /set_winners внутри нужного треда в Telegram"
        >
          <SimpleGrid cols={4} spacing="md">
            <TopicChip label="Daily"   id={draft.topics.daily}   icon={<IconBolt size={14} />} color="var(--amber)" />
            <TopicChip label="Weekly"  id={draft.topics.weekly}  icon={<IconCalendar size={14} />} color="var(--accent)" />
            <TopicChip label="Monthly" id={draft.topics.monthly} icon={<IconCrown size={14} />} color="var(--orange)" />
            <TopicChip label="Winners" id={draft.topics.winners} icon={<IconCrown size={14} />} color="var(--green)" />
          </SimpleGrid>
        </Section>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Sticky save bar */}
      {isDirty && (
        <Box
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 15, 22, 0.92)",
            backdropFilter: "blur(28px)",
            border: "1px solid var(--border-bright)",
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.6)",
            zIndex: 50,
          }}
        >
          <span className="dot violet" />
          <Text size="13px">Есть несохранённые изменения</Text>
          <Button
            variant="default"
            size="xs"
            onClick={() => setDraft(q.data!)}
          >
            Отменить
          </Button>
          <Button
            size="xs"
            className="btn-primary"
            leftSection={<IconCheck size={14} />}
            loading={saveM.isPending}
            onClick={save}
          >
            Сохранить
          </Button>
        </Box>
      )}
    </Box>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Box className="glass" style={{ padding: 24 }}>
      <Stack gap={6} mb="md">
        <Text fw={600} style={{ fontSize: 15, letterSpacing: "-0.01em" }}>{title}</Text>
        {hint && <Text size="12px" c="dimmed">{hint}</Text>}
      </Stack>
      {children}
    </Box>
  );
}

function ScheduleCard({ icon, title, color, hint, children }: {
  icon: React.ReactNode; title: string; color: string; hint: string; children: React.ReactNode;
}) {
  return (
    <Box
      style={{
        padding: 16,
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <Group gap={8} mb={4}>
        <Box style={{
          width: 26, height: 26, borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${color}33`,
          display: "grid", placeItems: "center", color,
        }}>
          {icon}
        </Box>
        <Stack gap={0}>
          <Text size="13px" fw={500} c={color}>{title}</Text>
          <Text size="10px" c="dimmed">{hint}</Text>
        </Stack>
      </Group>
      <Box mt="sm">{children}</Box>
    </Box>
  );
}

function HourMinute({
  label,
  hour,
  minute,
  onChange,
}: {
  label: string;
  hour: number | undefined;
  minute: number | undefined;
  onChange: (hour: number, minute: number) => void;
}) {
  const h = hour ?? 0;
  const m = minute ?? 0;
  return (
    <Box>
      <Text size="11px" c="dimmed" mb={4}>{label} (UTC)</Text>
      <Group gap={6} wrap="nowrap" align="center">
        <NumberInput
          value={h}
          onChange={(v) => {
            const n = Number(v);
            if (Number.isFinite(n)) onChange(Math.max(0, Math.min(23, Math.trunc(n))), m);
          }}
          min={0}
          max={23}
          clampBehavior="strict"
          hideControls
          styles={{ input: { textAlign: "center", fontVariantNumeric: "tabular-nums" } }}
          size="xs"
          w={56}
        />
        <Text c="dimmed" fw={600}>:</Text>
        <NumberInput
          value={m}
          onChange={(v) => {
            const n = Number(v);
            if (Number.isFinite(n)) onChange(h, Math.max(0, Math.min(59, Math.trunc(n))));
          }}
          min={0}
          max={59}
          clampBehavior="strict"
          hideControls
          styles={{ input: { textAlign: "center", fontVariantNumeric: "tabular-nums" } }}
          size="xs"
          w={56}
        />
      </Group>
    </Box>
  );
}

function TopicChip({ label, id, icon, color }: { label: string; id: number; icon: React.ReactNode; color: string }) {
  return (
    <Box style={{
      padding: 12,
      background: "var(--bg-1)",
      border: `1px solid ${id ? color + "33" : "var(--border)"}`,
      borderRadius: 8,
    }}>
      <Group gap={6} mb={4}>
        <span style={{ color }}>{icon}</span>
        <Text size="11px" fw={500}>{label}</Text>
      </Group>
      {id ? (
        <Group gap={4}>
          <IconHash size={11} color="var(--fg-faint)" />
          <Text size="13px" className="mono tnum" fw={500}>{id}</Text>
        </Group>
      ) : (
        <Text size="11px" c="var(--fg-faint)">не задан</Text>
      )}
    </Box>
  );
}
