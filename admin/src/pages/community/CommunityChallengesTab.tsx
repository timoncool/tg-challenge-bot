import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Skeleton,
  Drawer,
  Badge,
  SimpleGrid,
  Alert,
  NumberInput,
} from "@mantine/core";
import {
  IconRefresh,
  IconBolt,
  IconCalendar,
  IconCrown,
  IconTrophy,
  IconPhoto,
  IconClock,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";

type ChallengeType = "daily" | "weekly" | "monthly";

interface Challenge {
  id: number;
  type: ChallengeType;
  topic: string;
  topicFull: string;
  status: "active" | "finished";
  startedAt: number;
  endsAt: number;
  topicThreadId: number;
  announcementMessageId: number;
}

interface ChallengesResp {
  current: { type: ChallengeType; challenge: Challenge | null }[];
  history: { type: ChallengeType; challengeId: number; submissionCount: number }[];
}

interface Submission {
  messageId: number;
  userId: number;
  username?: string;
  score: number;
  timestamp: number;
  reactions: Record<string, number>;
  uniqueVoters: number;
}

const META: Record<ChallengeType, { icon: typeof IconBolt; color: string; label: string }> = {
  daily:   { icon: IconBolt,     color: "var(--amber)",  label: "Daily" },
  weekly:  { icon: IconCalendar, color: "var(--accent)", label: "Weekly" },
  monthly: { icon: IconCrown,    color: "var(--orange)", label: "Monthly" },
};

function fmt(ts: number) {
  return new Date(ts).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CommunityChallengesTab({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState<{ type: ChallengeType; id: number } | null>(null);

  const q = useQuery({
    queryKey: ["community-challenges", chatId],
    queryFn: () => api.get<ChallengesResp>(`/api/communities/${chatId}/challenges`),
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} style={{ fontSize: 17 }}>Текущие челленджи</Text>
        <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => q.refetch()}>
          Обновить
        </Button>
      </Group>

      {q.isLoading && <Skeleton h={120} />}
      {q.data && (
        <SimpleGrid cols={3} spacing="md">
          {(["daily", "weekly", "monthly"] as const).map((t) => {
            const cur = q.data!.current.find((c) => c.type === t)?.challenge;
            const meta = META[t];
            const Icon = meta.icon;
            return (
              <Box key={t} className="glass" style={{ padding: 16 }}>
                <Group gap={8} mb={8}>
                  <Icon size={16} color={meta.color} />
                  <Text size="13px" fw={500} c={meta.color}>{meta.label}</Text>
                  {cur && (
                    <Badge size="xs" color={cur.status === "active" ? "green" : "gray"} variant="light">
                      {cur.status}
                    </Badge>
                  )}
                </Group>
                {cur ? (
                  <Stack gap={6}>
                    <Text size="13px" lineClamp={2} style={{ minHeight: 36, lineHeight: 1.35 }}>{cur.topic}</Text>
                    <Text size="11px" c="dimmed" className="mono">
                      id {cur.id} · до {fmt(cur.endsAt)}
                    </Text>
                    {cur.status === "active" && (
                      <ExtendDeadline chatId={chatId} type={t} challenge={cur} qc={qc} />
                    )}
                    <Button
                      size="compact-xs"
                      variant="default"
                      onClick={() => setDrawerOpen({ type: t, id: cur.id })}
                    >
                      Работы →
                    </Button>
                  </Stack>
                ) : (
                  <Text size="11px" c="var(--fg-faint)">нет данных</Text>
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      <Box>
        <Text fw={600} style={{ fontSize: 15 }} mb={8}>История</Text>
        {q.isLoading && <Skeleton h={200} />}
        {q.data && q.data.history.length === 0 && (
          <Text c="dimmed" size="sm">История пуста (вся в TTL уже истекла или челленджей ещё не было)</Text>
        )}
        <Box className="glass" style={{ overflow: "hidden" }}>
          <Stack gap={0}>
            {q.data?.history.map((h, i) => {
              const meta = META[h.type];
              const Icon = meta.icon;
              return (
                <Group
                  key={i}
                  justify="space-between"
                  style={{
                    padding: "10px 14px",
                    borderBottom: i < q.data!.history.length - 1 ? "1px solid var(--border)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setDrawerOpen({ type: h.type, id: h.challengeId })}
                >
                  <Group gap={10}>
                    <Icon size={14} color={meta.color} />
                    <Text size="13px" fw={500} c={meta.color}>{meta.label}</Text>
                    <Text size="11px" c="dimmed" className="mono">id {h.challengeId}</Text>
                  </Group>
                  <Group gap={20}>
                    <Group gap={4}>
                      <IconPhoto size={12} color="var(--fg-faint)" />
                      <Text size="11px" className="mono tnum">{h.submissionCount}</Text>
                    </Group>
                    <Text size="11px" c="var(--accent-bright)">подробнее →</Text>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </Box>
      </Box>

      <SubmissionsDrawer
        chatId={chatId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(null)}
        qc={qc}
      />
    </Stack>
  );
}

function ExtendDeadline({ chatId, type, qc }: {
  chatId: number; type: ChallengeType; challenge: Challenge; qc: ReturnType<typeof useQueryClient>;
}) {
  const [hours, setHours] = useState(24);

  const extend = useMutation({
    mutationFn: () => api.patch(`/api/communities/${chatId}/challenges/${type}/extend`, { hours }),
    onSuccess: () => {
      notifications.show({ message: `Продлено на +${hours}ч`, color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-challenges", chatId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  return (
    <Group gap={4}>
      <NumberInput value={hours} onChange={(v) => setHours(Number(v) || 1)} min={1} max={168} size="xs" w={70} hideControls />
      <Button
        size="compact-xs"
        variant="default"
        leftSection={<IconClock size={12} />}
        loading={extend.isPending}
        onClick={() => extend.mutate()}
      >
        +ч
      </Button>
    </Group>
  );
}

function SubmissionsDrawer({
  chatId, open, onClose,
}: {
  chatId: number;
  open: { type: ChallengeType; id: number } | null;
  onClose: () => void;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const q = useQuery({
    queryKey: ["submissions", chatId, open?.type, open?.id],
    queryFn: () => api.get<{ submissions: Submission[] }>(
      `/api/communities/${chatId}/challenges/${open!.type}/${open!.id}/submissions`
    ),
    enabled: !!open,
  });

  return (
    <Drawer
      opened={!!open}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        open && (
          <Text fw={600} className="mono">
            {open.type} #{open.id}
          </Text>
        )
      }
    >
      {q.isLoading && <Skeleton h={400} />}
      {q.data?.submissions.length === 0 && (
        <Alert color="violet" variant="light" icon={<IconAlertTriangle size={14} />}>
          <Text size="sm">Нет работ в этом челлендже (или данные TTL'нули)</Text>
        </Alert>
      )}
      <Stack gap={6}>
        {q.data?.submissions.map((s, i) => (
          <Box key={s.messageId} className="glass" style={{ padding: 14 }}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Group gap={8}>
                  {i === 0 && q.data!.submissions[0].score > 0 && <IconTrophy size={14} color="var(--accent)" />}
                  <Text size="13px" fw={500}>
                    @{s.username ?? `user${s.userId}`}
                  </Text>
                  <Text size="10px" c="dimmed" className="mono">msg {s.messageId}</Text>
                </Group>
                <Text size="11px" c="dimmed">{fmt(s.timestamp)}</Text>
              </Stack>
              <Group gap={14}>
                <Stack gap={0} align="flex-end">
                  <Text size="9px" c="var(--fg-faint)" className="mono">SCORE</Text>
                  <Text size="20px" fw={600} className="tnum" c="var(--accent-bright)">{s.score}</Text>
                </Stack>
                <Stack gap={0} align="flex-end">
                  <Text size="9px" c="var(--fg-faint)" className="mono">VOTERS</Text>
                  <Text size="14px" className="tnum">{s.uniqueVoters}</Text>
                </Stack>
              </Group>
            </Group>
          </Box>
        ))}
      </Stack>
    </Drawer>
  );
}
