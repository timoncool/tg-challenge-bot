import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Skeleton,
  Alert,
  SimpleGrid,
} from "@mantine/core";
import {
  IconRefresh,
  IconAlertTriangle,
  IconBolt,
  IconCalendar,
  IconCrown,
  IconUsers,
  IconPhoto,
  IconTrophy,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";
import type {
  ChallengeType,
  CommunityDashboard,
  DashboardResponse,
} from "@/api/types";

const TYPE_META: Record<ChallengeType, { label: string; color: string; icon: typeof IconBolt; gradient: string }> = {
  daily:   { label: "Daily",   color: "var(--amber)",  icon: IconBolt,     gradient: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.02))" },
  weekly:  { label: "Weekly",  color: "var(--accent)", icon: IconCalendar, gradient: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.02))" },
  monthly: { label: "Monthly", color: "var(--orange)", icon: IconCrown,    gradient: "linear-gradient(135deg, rgba(251,146,60,0.18), rgba(251,146,60,0.02))" },
};

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "просрочено";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DashboardPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardResponse>("/api/dashboard"),
    refetchInterval: 30_000,
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const totals = q.data?.communities.reduce(
    (a, c) => {
      for (const t of ["daily", "weekly", "monthly"] as const) {
        const pt = c.perType[t];
        if (pt.state === "active") a.activeRuns++;
        if (pt.state === "poll-open") a.openPolls++;
        if (pt.state === "stale") a.staleRuns++;
        a.participants += pt.participants ?? 0;
        a.submissions += pt.submissionsCount ?? 0;
      }
      return a;
    },
    { activeRuns: 0, openPolls: 0, staleRuns: 0, participants: 0, submissions: 0 }
  );

  return (
    <Box style={{ padding: "40px 48px 80px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Top bar */}
      <Group justify="space-between" align="flex-end" mb="xl" className="fade-in">
        <PageHeader
          crumb="CONTROL ROOM / 01 / DASHBOARD"
          title="Что у тебя сейчас в эфире"
          emphasis="в эфире"
          subtitle={q.data
            ? `${new Date(q.data.serverTime).toLocaleString("ru-RU")} · UTC · обновляется каждые 30с`
            : "загрузка…"}
        />
        <Group gap="xs">
          {q.isFetching && <span className="dot amber" />}
          <Button
            variant="default"
            size="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void q.refetch()}
            style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
          >
            Обновить
          </Button>
        </Group>
      </Group>

      {/* KPI cards */}
      {totals && (
        <SimpleGrid cols={5} spacing="md" mb="xl" className="fade-in">
          <KpiCard label="Активных" value={totals.activeRuns} accent="violet" hint="Запущено" />
          <KpiCard label="Опросов" value={totals.openPolls}   accent="amber" hint="Голосование" />
          <KpiCard label="Просрочено" value={totals.staleRuns} accent={totals.staleRuns > 0 ? "red" : "muted"} hint="Требуют finish" />
          <KpiCard label="Участников" value={totals.participants} accent="mint" hint="За активные" />
          <KpiCard label="Работ"     value={totals.submissions}  accent="muted" hint="Всего отправлено" />
        </SimpleGrid>
      )}

      {q.isLoading && (
        <Stack gap="md">
          {[0, 1, 2].map((i) => <Skeleton key={i} h={280} radius={14} />)}
        </Stack>
      )}

      {q.error && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} radius="md">
          {(q.error as Error).message}
        </Alert>
      )}

      <Stack gap="lg">
        {q.data?.communities.map((c, idx) => (
          <Box key={c.community.chatId} className="fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
            <CommunityCard c={c} qc={qc} />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: "violet" | "amber" | "mint" | "red" | "muted";
  hint: string;
}) {
  const color =
    accent === "violet" ? "var(--accent-bright)" :
    accent === "amber"  ? "var(--amber)" :
    accent === "mint"   ? "var(--mint)" :
    accent === "red"    ? "var(--red)" :
    "var(--fg)";

  const glow =
    accent === "violet" ? "rgba(139, 92, 246, 0.15)" :
    accent === "amber"  ? "rgba(251, 191, 36, 0.12)" :
    accent === "mint"   ? "rgba(45, 212, 191, 0.12)" :
    accent === "red"    ? "rgba(248, 113, 113, 0.15)" :
    "transparent";

  return (
    <Box
      className="glass lift"
      style={{
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <Stack gap={4} style={{ position: "relative" }}>
        <Text size="11px" c="var(--fg-dim)" fw={500} style={{ letterSpacing: "0.02em" }}>
          {label}
        </Text>
        <Text fw={600} style={{ fontSize: 32, lineHeight: 1, letterSpacing: "-0.02em", color, fontFeatureSettings: '"tnum"' }}>
          {value}
        </Text>
        <Text size="10px" c="var(--fg-faint)">
          {hint}
        </Text>
      </Stack>
    </Box>
  );
}

function CommunityCard({ c, qc }: { c: CommunityDashboard; qc: ReturnType<typeof useQueryClient> }) {
  const nav = useNavigate();
  const healthDot = c.health === "healthy" ? "green" : c.health === "warning" ? "amber" : "red";
  const healthText = c.health === "healthy" ? "healthy" : c.health === "warning" ? "warning" : "broken";
  const healthClass = healthDot === "green" ? "green" : healthDot === "amber" ? "amber" : "red";

  return (
    <Box className="glass" style={{ overflow: "hidden" }}>
      {/* header */}
      <Box style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
        <Group justify="space-between" align="flex-end">
          <Stack gap={6}>
            <Group gap={10} align="baseline">
              <Text
                fw={600}
                style={{ fontSize: 17, letterSpacing: "-0.015em", cursor: "pointer" }}
                onClick={() => nav(`/community/${c.community.chatId}`)}
              >
                {c.community.name}
              </Text>
              <Text size="11px" c="var(--fg-faint)" className="mono">
                {c.community.chatId}
              </Text>
              <Button
                size="compact-xs"
                variant="subtle"
                color="violet"
                onClick={() => nav(`/community/${c.community.chatId}`)}
              >
                настройки →
              </Button>
            </Group>
            {c.warnings.length > 0 && (
              <Stack gap={2}>
                {c.warnings.map((w, i) => (
                  <Group key={i} gap={6}>
                    <IconAlertTriangle size={12} color="var(--amber)" />
                    <Text size="12px" c="var(--amber)">{w}</Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Stack>
          <span className={`pill ${healthClass}`}>
            <span className={`dot ${healthDot}`} />
            {healthText}
          </span>
        </Group>
      </Box>

      {/* 3 types */}
      <SimpleGrid cols={3} spacing={0}>
        {(Object.keys(TYPE_META) as ChallengeType[]).map((t, idx) => (
          <TypeCell
            key={t}
            type={t}
            data={c.perType[t]}
            chatId={c.community.chatId}
            border={idx < 2}
            qc={qc}
          />
        ))}
      </SimpleGrid>

      {/* footer meta */}
      <Group
        style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--border)",
          gap: 28,
          flexWrap: "wrap",
          background: "var(--bg-1)",
        }}
      >
        <MetaItem label="Mode" value={c.contentMode} />
        <MetaItem label="Links" value={c.acceptLinks ? "on" : "off"} muted={!c.acceptLinks} />
        <MetaItem label="Limits" value={`${c.submissionLimits.daily}/${c.submissionLimits.weekly}/${c.submissionLimits.monthly}`} mono />
        <MetaItem
          label="Suggestions"
          value={
            <>
              <span style={{ color: c.pendingSuggestions.ready > 0 ? "var(--green)" : "var(--fg-faint)" }}>
                {c.pendingSuggestions.ready}
              </span>
              <span style={{ color: "var(--fg-faint)" }}> ready · </span>
              <span style={{ color: "var(--fg-dim)" }}>{c.pendingSuggestions.waiting}</span>
              <span style={{ color: "var(--fg-faint)" }}> wait</span>
            </>
          }
        />
        <Box style={{ flex: 1 }} />
        <MetaItem label="AI" value={c.aiConfigName} mono />
      </Group>
    </Box>
  );
}

function MetaItem({
  label,
  value,
  muted,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <Group gap={6}>
      <Text size="11px" c="var(--fg-faint)">{label}</Text>
      <Text size="12px" c={muted ? "var(--fg-faint)" : "var(--fg)"} className={mono ? "mono" : undefined} fw={500}>
        {value}
      </Text>
    </Group>
  );
}

function TypeCell({
  type,
  data,
  chatId,
  border,
  qc,
}: {
  type: ChallengeType;
  data: CommunityDashboard["perType"][ChallengeType];
  chatId: number;
  border: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;

  return (
    <Box
      style={{
        padding: "20px 24px",
        borderRight: border ? "1px solid var(--border)" : undefined,
        minHeight: 220,
        position: "relative",
        overflow: "hidden",
        background: meta.gradient,
      }}
    >
      <Group justify="space-between" align="flex-start" mb={16}>
        <Group gap={10} align="center">
          <Box
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${meta.color}33`,
              display: "grid", placeItems: "center",
            }}
          >
            <Icon size={16} stroke={1.7} color={meta.color} />
          </Box>
          <Text size="13px" fw={500} c={meta.color}>{meta.label}</Text>
        </Group>
        <StateTag state={data.state} />
      </Group>

      <StateBody type={type} data={data} chatId={chatId} qc={qc} />
    </Box>
  );
}

function StateTag({ state }: { state: CommunityDashboard["perType"][ChallengeType]["state"] }) {
  const map: Record<typeof state, { label: string; pillClass: string; dot: string }> = {
    active: { label: "active",    pillClass: "green",  dot: "green" },
    "poll-open": { label: "poll", pillClass: "accent", dot: "violet" },
    idle:   { label: "idle",      pillClass: "",       dot: "muted" },
    stale:  { label: "stale",     pillClass: "red",    dot: "red" },
  };
  const m = map[state];
  return (
    <span className={`pill ${m.pillClass}`}>
      <span className={`dot ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StateBody({
  type,
  data,
  chatId,
  qc,
}: {
  type: ChallengeType;
  data: CommunityDashboard["perType"][ChallengeType];
  chatId: number;
  qc: ReturnType<typeof useQueryClient>;
}) {
  if (data.state === "active" && data.challenge) {
    const remaining = data.challenge.endsAt - Date.now();
    return (
      <Stack gap={14}>
        <Text size="sm" fw={500} lineClamp={2} style={{ minHeight: 40, lineHeight: 1.4 }}>
          {data.challenge.topic}
        </Text>
        <Group gap={20} wrap="wrap">
          <Stat icon={<IconRefresh size={12} stroke={1.7} />} label="Осталось" value={fmtRemaining(remaining)} />
          <Stat icon={<IconUsers size={12} stroke={1.7} />}   label="Авторов"  value={String(data.participants ?? 0)} />
          <Stat icon={<IconPhoto size={12} stroke={1.7} />}   label="Работ"    value={String(data.submissionsCount ?? 0)} />
          {data.lead && (
            <Stat
              icon={<IconTrophy size={12} stroke={1.7} />}
              label="Лидер"
              value={
                <>
                  @{data.lead.username ?? data.lead.userId}{" "}
                  <span style={{ color: "var(--accent-bright)", fontWeight: 600 }}>{data.lead.score}</span>
                </>
              }
            />
          )}
        </Group>
        <Group gap={6} mt={4}>
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => void triggerAction(chatId, "finish", type, qc)}
          >
            Завершить
          </Button>
        </Group>
      </Stack>
    );
  }

  if (data.state === "poll-open" && data.poll) {
    const total = data.pollVotes?.total ?? 0;
    const opts = (data.pollVotes?.options ?? data.poll.options.map((o) => ({ text: o, votes: 0 })))
      .slice()
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3);
    return (
      <Stack gap={12}>
        <Group gap={20}>
          <Stat label="Голосов" value={String(total)} />
          <Stat label="Опций"   value={String(data.poll.options.length)} />
        </Group>
        <Stack gap={6}>
          {opts.map((o, i) => {
            const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
            return (
              <Box key={i} style={{ position: "relative", padding: "6px 0" }}>
                <Box
                  style={{
                    position: "absolute", inset: 0,
                    width: `${pct}%`,
                    background: "var(--accent-soft)",
                    borderLeft: "2px solid var(--accent)",
                    borderRadius: 4,
                  }}
                />
                <Group justify="space-between" gap="xs" style={{ position: "relative", padding: "0 10px" }}>
                  <Text size="12px" lineClamp={1} style={{ flex: 1 }}>{o.text}</Text>
                  <Text size="12px" className="mono tnum" c="var(--accent-bright)" fw={500}>
                    {o.votes}
                  </Text>
                </Group>
              </Box>
            );
          })}
        </Stack>
        <Group gap={6} mt={4}>
          <Button size="compact-xs" className="btn-primary" onClick={() => void triggerAction(chatId, "start", type, qc)}>
            Force start
          </Button>
          <Button size="compact-xs" variant="subtle" color="red" onClick={() => void triggerAction(chatId, "cancel-poll", type, qc)}>
            Cancel
          </Button>
        </Group>
      </Stack>
    );
  }

  if (data.state === "stale" && data.challenge) {
    return (
      <Stack gap={10}>
        <Text size="sm" fw={500} lineClamp={2}>{data.challenge.topic}</Text>
        <Text size="11px" c="var(--red)">просрочен с {fmtDate(data.challenge.endsAt)}</Text>
        <Button size="compact-xs" color="red" onClick={() => void triggerAction(chatId, "finish", type, qc)}>
          Завершить срочно
        </Button>
      </Stack>
    );
  }

  // idle
  return (
    <Stack gap={12}>
      <Group gap={20} wrap="wrap">
        <Stat label="Next poll"      value={data.nextPollAt ? fmtDate(data.nextPollAt) : "—"} />
        <Stat label="Next challenge" value={data.nextChallengeAt ? fmtDate(data.nextChallengeAt) : "—"} />
      </Group>
      <Group gap={6} mt={4}>
        <Button size="compact-xs" variant="default" onClick={() => void triggerAction(chatId, "poll", type, qc)}>
          Force poll
        </Button>
      </Group>
    </Stack>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Group gap={4}>
        {icon && <span style={{ color: "var(--fg-faint)" }}>{icon}</span>}
        <Text size="10px" c="var(--fg-faint)" fw={500} style={{ letterSpacing: "0.01em" }}>{label}</Text>
      </Group>
      <Text size="13px" fw={500} className="tnum">{value}</Text>
    </Stack>
  );
}

async function triggerAction(chatId: number, action: string, type: ChallengeType, qc?: ReturnType<typeof useQueryClient>) {
  const label = action === "poll" ? "опрос"
    : action === "start" ? "старт челленджа"
    : action === "finish" ? "завершение"
    : action === "cancel-poll" ? "отмена опроса"
    : action;

  const id = notifications.show({
    loading: true,
    title: `${label}: ${type}`,
    message: "посылаю запрос боту…",
    autoClose: false,
    withCloseButton: false,
  });

  try {
    await api.post(`/api/communities/${chatId}/trigger`, { action, type });
    notifications.update({
      id,
      loading: false,
      color: "green",
      title: "Готово",
      message: `${label} → ${type} выполнен`,
      autoClose: 4000,
      withCloseButton: true,
    });
    qc?.invalidateQueries({ queryKey: ["dashboard"] });
  } catch (e) {
    const msg = e instanceof ApiError && e.status === 503
      ? "Нужно настроить BOT_ADMIN_SECRET в Pages env (Settings → Environment)"
      : (e as Error).message;
    notifications.update({
      id,
      loading: false,
      color: "red",
      title: "Ошибка",
      message: msg,
      autoClose: 8000,
      withCloseButton: true,
    });
  }
}
