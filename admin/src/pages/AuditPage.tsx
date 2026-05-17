import { useQuery } from "@tanstack/react-query";
import { Box, Stack, Group, Text, Skeleton, Badge, Code, Alert } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { api } from "@/api/client";
import { PageHeader } from "@/components/PageHeader";

interface AuditEvent {
  ts: number;
  ip: string;
  ua: string;
  method: string;
  path: string;
  status: number;
  chatId?: number;
  action?: string;
}

export function AuditPage() {
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get<{ count: number; truncated: boolean; events: AuditEvent[] }>("/api/audit?limit=200"),
    refetchInterval: 30_000,
  });

  return (
    <Box style={{ padding: "40px 48px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <Group justify="space-between" align="flex-end" mb="lg">
        <PageHeader
          crumb="CONTROL ROOM / 08 / AUDIT"
          title="Лог действий в админке"
          emphasis="в админке"
          subtitle="Каждый POST/PUT/PATCH/DELETE через /api/* пишется отдельным KV-ключом (TTL 90 дней). Append-only — нет race conditions при concurrent admin актах."
        />
        <Group gap="xs">
          {q.isFetching && <Badge variant="dot" color="violet">обновляю</Badge>}
        </Group>
      </Group>

      {q.isLoading && <Skeleton h={400} />}

      {q.data && q.data.events.length === 0 && (
        <Alert color="violet" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="sm">Пока нет событий. Сделай что-нибудь в админке — появится здесь.</Text>
        </Alert>
      )}

      <Stack gap={0}>
        {q.data?.events.map((e, i) => (
          <Group
            key={i}
            justify="space-between"
            align="center"
            wrap="nowrap"
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              background: i % 2 === 0 ? "transparent" : "var(--bg-1)",
            }}
          >
            <Group gap={10} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Text size="11px" className="mono" c="dimmed" style={{ minWidth: 150 }}>
                {new Date(e.ts).toLocaleString("ru-RU")}
              </Text>
              <Badge
                size="xs"
                variant="light"
                color={e.method === "DELETE" ? "red" : e.method === "POST" ? "violet" : e.method === "PUT" ? "amber" : "green"}
              >
                {e.method}
              </Badge>
              <Code style={{ fontSize: 11, background: "var(--bg-2)", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                {e.path}
              </Code>
              {e.chatId !== undefined && (
                <Badge size="xs" variant="default">chat {e.chatId}</Badge>
              )}
            </Group>
            <Group gap={10}>
              <Badge size="xs" variant="light" color={e.status >= 400 ? "red" : e.status >= 300 ? "amber" : "green"}>
                {e.status}
              </Badge>
              <Text size="10px" c="var(--fg-faint)" className="mono">{e.ip || "—"}</Text>
            </Group>
          </Group>
        ))}
      </Stack>

      {q.data?.truncated && (
        <Text c="dimmed" size="11px" mt="sm" ta="center">
          Показаны последние {q.data.events.length}. Старые — по prefix `audit:event:` в KV Explorer.
        </Text>
      )}
    </Box>
  );
}
