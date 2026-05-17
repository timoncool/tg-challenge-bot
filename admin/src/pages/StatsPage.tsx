import { useQuery } from "@tanstack/react-query";
import { Box, Stack, Group, Text, SimpleGrid, Skeleton, Badge, ScrollArea } from "@mantine/core";
import { IconCash, IconCheck, IconX, IconHash, IconBolt } from "@tabler/icons-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";

interface DailyStats {
  day: string;
  totals?: { calls: number; success: number; fail: number; totalCostUsd: number; totalTokens: number };
  byProvider?: Record<string, { calls: number; cost: number; tokens: number }>;
  byModel?: Record<string, { calls: number; cost: number; tokens: number }>;
}

interface Resp {
  days: number;
  totals: { calls: number; success: number; fail: number; cost: number; tokens: number };
  daily: DailyStats[];
  recent: Array<{
    ts: number; chatId?: number | null; provider: string; model: string; source: string;
    type: string; contentMode: string; durationMs: number; success: boolean;
    themesCount?: number; prompt_tokens?: number; completion_tokens?: number; total_tokens?: number;
    cost_usd?: number; error?: string;
  }>;
}

export function StatsPage() {
  const q = useQuery({
    queryKey: ["stats", "ai"],
    queryFn: () => api.get<Resp>("/api/stats/ai?days=14"),
    refetchInterval: 60_000,
  });

  if (q.isLoading) return <Box style={{padding:48}}><Skeleton h={400} /></Box>;
  if (!q.data) return null;

  // top providers / models across all days
  const byProvider: Record<string, { calls: number; cost: number; tokens: number }> = {};
  const byModel: Record<string, { calls: number; cost: number; tokens: number }> = {};
  for (const d of q.data.daily) {
    for (const [k, v] of Object.entries(d.byProvider ?? {})) {
      byProvider[k] = byProvider[k] || { calls: 0, cost: 0, tokens: 0 };
      byProvider[k].calls += v.calls; byProvider[k].cost += v.cost; byProvider[k].tokens += v.tokens;
    }
    for (const [k, v] of Object.entries(d.byModel ?? {})) {
      byModel[k] = byModel[k] || { calls: 0, cost: 0, tokens: 0 };
      byModel[k].calls += v.calls; byModel[k].cost += v.cost; byModel[k].tokens += v.tokens;
    }
  }
  const maxCalls = Math.max(1, ...q.data.daily.map((d) => d.totals?.calls ?? 0));

  return (
    <Box style={{ padding: "40px 48px 80px", maxWidth: 1400, margin: "0 auto" }}>
      <PageHeader
        crumb="CONTROL ROOM / 05 / AI STATS"
        title="Лог запросов и затрат"
        emphasis="запросов и затрат"
        subtitle={`Последние ${q.data.days} дней. Cost — где провайдер возвращает (OpenRouter всегда, Gemini в free-tier — null).`}
      />

      {/* Totals */}
      <SimpleGrid cols={5} spacing="md" mb="xl">
        <KpiCard icon={<IconHash size={14} />} label="Запросов" value={String(q.data.totals.calls)} />
        <KpiCard icon={<IconCheck size={14} />} label="Успех" value={String(q.data.totals.success)} color="var(--green)" />
        <KpiCard icon={<IconX size={14} />} label="Провалов" value={String(q.data.totals.fail)} color={q.data.totals.fail>0 ? "var(--red)" : undefined} />
        <KpiCard icon={<IconBolt size={14} />} label="Токенов" value={q.data.totals.tokens.toLocaleString("ru-RU")} />
        <KpiCard icon={<IconCash size={14} />} label="Стоимость" value={`$${q.data.totals.cost.toFixed(4)}`} color="var(--accent-bright)" />
      </SimpleGrid>

      {/* Daily bars */}
      <Box className="glass" style={{ padding: 20, marginBottom: 24 }}>
        <Text fw={600} mb="md">По дням</Text>
        <Group gap={4} align="flex-end" h={140}>
          {q.data.daily.map((d) => {
            const h = Math.max(2, Math.round(((d.totals?.calls ?? 0) / maxCalls) * 120));
            const cost = d.totals?.totalCostUsd ?? 0;
            return (
              <Box key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <Text size="9px" c="dimmed" className="mono tnum">{d.totals?.calls ?? 0}</Text>
                <Box style={{
                  width: "100%",
                  height: h,
                  background: cost > 0
                    ? "linear-gradient(180deg, var(--accent-bright), var(--accent))"
                    : "var(--bg-3)",
                  borderRadius: 4,
                  transition: "height 0.3s",
                }} />
                <Text size="9px" c="var(--fg-faint)" className="mono">{d.day.slice(5)}</Text>
              </Box>
            );
          })}
        </Group>
      </Box>

      <SimpleGrid cols={2} spacing="md" mb="xl">
        <Box className="glass" style={{ padding: 20 }}>
          <Text fw={600} mb="md">По провайдерам</Text>
          {Object.entries(byProvider).length === 0 && <Text c="dimmed" size="sm">Нет данных</Text>}
          <Stack gap={6}>
            {Object.entries(byProvider).sort((a,b)=>b[1].calls-a[1].calls).map(([p, v]) => (
              <Group key={p} justify="space-between" style={{padding:"6px 0", borderBottom:"1px solid var(--border)"}}>
                <Badge variant="light" color={p==="openrouter"?"violet":p==="gemini"?"green":"gray"}>{p}</Badge>
                <Group gap={16}>
                  <Stat label="calls" value={v.calls} />
                  <Stat label="tokens" value={v.tokens.toLocaleString()} />
                  <Stat label="cost" value={`$${v.cost.toFixed(4)}`} />
                </Group>
              </Group>
            ))}
          </Stack>
        </Box>

        <Box className="glass" style={{ padding: 20 }}>
          <Text fw={600} mb="md">По моделям</Text>
          {Object.entries(byModel).length === 0 && <Text c="dimmed" size="sm">Нет данных</Text>}
          <Stack gap={6}>
            {Object.entries(byModel).sort((a,b)=>b[1].calls-a[1].calls).slice(0, 10).map(([m, v]) => (
              <Group key={m} justify="space-between" style={{padding:"6px 0", borderBottom:"1px solid var(--border)"}}>
                <Text size="12px" className="mono" style={{flex:1, wordBreak:"break-all"}}>{m}</Text>
                <Group gap={16}>
                  <Stat label="calls" value={v.calls} />
                  <Stat label="cost" value={`$${v.cost.toFixed(4)}`} />
                </Group>
              </Group>
            ))}
          </Stack>
        </Box>
      </SimpleGrid>

      {/* Recent */}
      <Box className="glass" style={{ padding: 20 }}>
        <Text fw={600} mb="md">Последние запросы</Text>
        {q.data.recent.length === 0 && <Text c="dimmed" size="sm">Нет данных</Text>}
        <ScrollArea h={400}>
          <Stack gap={0}>
            {q.data.recent.map((r, i) => (
              <Group key={i} justify="space-between" gap="md" style={{
                padding: "8px 0", borderBottom: "1px solid var(--border)",
              }}>
                <Stack gap={2} style={{flex:1}}>
                  <Group gap={6}>
                    {r.success ? <IconCheck size={12} color="var(--green)" /> : <IconX size={12} color="var(--red)" />}
                    <Text size="11px" className="mono">{new Date(r.ts).toLocaleTimeString("ru-RU")}</Text>
                    <Badge size="xs" variant="light" color={r.provider==="openrouter"?"violet":"green"}>{r.provider}</Badge>
                    <Text size="11px" className="mono" c="dimmed">{r.model}</Text>
                    <Badge size="xs" variant="default">{r.type}</Badge>
                    <Badge size="xs" variant="light" color="gray">{r.contentMode}</Badge>
                    {r.source && <Text size="9px" c="var(--fg-faint)" className="mono">src:{r.source}</Text>}
                  </Group>
                  {r.error && <Text size="11px" c="var(--red)">{r.error}</Text>}
                </Stack>
                <Group gap={14}>
                  {r.total_tokens != null && <Stat label="tok" value={r.total_tokens} />}
                  {r.cost_usd != null && <Stat label="$" value={`${r.cost_usd.toFixed(5)}`} />}
                  <Stat label="ms" value={r.durationMs} />
                </Group>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Box>
    </Box>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Box className="glass" style={{ padding: 16 }}>
      <Group gap={4} mb={4}><span style={{color:"var(--fg-faint)"}}>{icon}</span><Text size="10px" c="var(--fg-faint)" className="mono">{label.toUpperCase()}</Text></Group>
      <Text fw={600} style={{ fontSize: 22, lineHeight: 1, color: color ?? "var(--fg)", fontFeatureSettings: '"tnum"' }}>{value}</Text>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={0} align="flex-end">
      <Text size="9px" c="var(--fg-faint)" className="mono">{label}</Text>
      <Text size="11px" className="mono tnum">{value}</Text>
    </Stack>
  );
}
