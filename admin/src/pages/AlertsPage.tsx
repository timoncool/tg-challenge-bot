import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Group, Text, Button, Skeleton, Alert, Badge } from "@mantine/core";
import { IconRefresh, IconTrash, IconAlertTriangle, IconInfoCircle, IconBug } from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "@/components/PageHeader";

interface AlertItem {
  ts: number;
  severity: "error" | "warn" | "info";
  component: string;
  message: string;
  context?: unknown;
}

export function AlertsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["alerts", "log"],
    queryFn: () => api.get<{ count: number; alerts: AlertItem[] }>("/api/alerts/log"),
    refetchInterval: 30_000,
  });

  async function clearAll() {
    if (!confirm("Очистить весь лог алертов?")) return;
    await api.delete("/api/alerts/log");
    notifications.show({ message: "Лог очищен", color: "violet" });
    qc.invalidateQueries({ queryKey: ["alerts"] });
  }

  return (
    <Box style={{ padding: "40px 48px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <Group justify="space-between" align="flex-end" mb="lg">
        <PageHeader
          crumb="CONTROL ROOM / 09 / ALERTS"
          title="Лог ошибок и предупреждений бота"
          emphasis="ошибок и предупреждений"
          subtitle="Сюда бот будет писать после рефакторинга. Сейчас может быть пусто."
        />
        <Group gap="xs">
          <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => q.refetch()}>
            Обновить
          </Button>
          <Button variant="subtle" color="red" size="xs" leftSection={<IconTrash size={14} />} onClick={() => void clearAll()}>
            Очистить
          </Button>
        </Group>
      </Group>

      {q.isLoading && <Skeleton h={300} />}
      {q.data && q.data.alerts.length === 0 && (
        <Alert color="violet" variant="light" radius="md" icon={<IconInfoCircle size={16} />}>
          <Text size="sm">Нет алертов. Бот ещё не писал в лог (или всё хорошо).</Text>
        </Alert>
      )}
      <Stack gap={6}>
        {q.data?.alerts.map((a, i) => {
          const color = a.severity === "error" ? "red" : a.severity === "warn" ? "amber" : "violet";
          const Icon = a.severity === "error" ? IconBug : a.severity === "warn" ? IconAlertTriangle : IconInfoCircle;
          return (
            <Box key={i} className="glass" style={{ padding: 14, borderLeft: `2px solid var(--${color})` }}>
              <Group gap={10} align="flex-start" wrap="nowrap">
                <Icon size={16} color={`var(--${color})`} style={{ marginTop: 2 }} />
                <Stack gap={4} style={{ flex: 1 }}>
                  <Group gap={8}>
                    <Badge size="xs" color={color} variant="light">{a.severity}</Badge>
                    <Text size="11px" c="dimmed" className="mono">{a.component}</Text>
                    <Text size="11px" c="dimmed" className="mono">{new Date(a.ts).toLocaleString("ru-RU")}</Text>
                  </Group>
                  <Text size="13px">{a.message}</Text>
                  {a.context !== undefined && a.context !== null && (
                    <Box
                      style={{
                        background: "var(--bg)",
                        padding: 8,
                        borderRadius: 4,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        maxHeight: 200,
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(a.context, null, 2)}
                    </Box>
                  )}
                </Stack>
              </Group>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
