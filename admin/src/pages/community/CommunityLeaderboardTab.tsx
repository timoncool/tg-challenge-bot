import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Stack, Group, Text, SegmentedControl, Skeleton, TextInput } from "@mantine/core";
import { IconSearch, IconTrophy } from "@tabler/icons-react";
import { api } from "@/api/client";

interface Entry { userId: number; username?: string; wins: number; participations: number; lastWin?: number; }
interface Resp {
  perType: { type: "daily" | "weekly" | "monthly"; entries: Entry[] }[];
  aggregated: Entry[];
}

export function CommunityLeaderboardTab({ chatId }: { chatId: number }) {
  const [type, setType] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["community-leaderboard", chatId, type],
    queryFn: () => api.get<Resp>(`/api/communities/${chatId}/leaderboard?type=${type}`),
  });

  const list = type === "all" ? q.data?.aggregated ?? [] : q.data?.perType.find((p) => p.type === type)?.entries ?? [];
  const filtered = list.filter((e) => !search || (e.username ?? "").toLowerCase().includes(search.toLowerCase()) || String(e.userId).includes(search));

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v as any)}
          data={[
            { value: "all",     label: "Все" },
            { value: "daily",   label: "Daily" },
            { value: "weekly",  label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
          color="violet"
        />
        <TextInput
          placeholder="поиск по нику"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          w={260}
        />
      </Group>

      {q.isLoading && <Skeleton h={400} />}
      {q.data && filtered.length === 0 && (
        <Text c="dimmed" size="sm">Пусто</Text>
      )}

      <Box className="glass" style={{ overflow: "hidden" }}>
        <Stack gap={0}>
          {filtered.map((e, i) => {
            const isPodium = i < 3;
            const medalColor = ["#ffd700", "#c0c0c0", "#cd7f32"][i] ?? "var(--fg-faint)";
            return (
              <Group
                key={e.userId}
                justify="space-between"
                style={{
                  padding: "10px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : undefined,
                  background: isPodium ? "rgba(255,255,255,0.02)" : undefined,
                }}
              >
                <Group gap={12}>
                  <Text
                    className="mono tnum"
                    fw={isPodium ? 600 : 400}
                    style={{ fontSize: 14, color: isPodium ? medalColor : "var(--fg-faint)", width: 28 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                  {isPodium && <IconTrophy size={14} color={medalColor} />}
                  <Text size="14px" fw={500}>@{e.username ?? `user${e.userId}`}</Text>
                </Group>
                <Group gap={24}>
                  <Stack gap={0} align="flex-end">
                    <Text size="9px" c="var(--fg-faint)" className="mono">WINS</Text>
                    <Text size="14px" className="tnum" fw={500} c="var(--accent-bright)">{e.wins}</Text>
                  </Stack>
                  <Stack gap={0} align="flex-end">
                    <Text size="9px" c="var(--fg-faint)" className="mono">PARTS</Text>
                    <Text size="14px" className="tnum">{e.participations}</Text>
                  </Stack>
                </Group>
              </Group>
            );
          })}
        </Stack>
      </Box>
    </Stack>
  );
}
