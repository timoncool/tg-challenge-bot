import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Group, Text, Button, Skeleton, Badge, SegmentedControl, Alert } from "@mantine/core";
import { IconTrash, IconAlertTriangle } from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";

interface Resp {
  perType: { type: "daily" | "weekly" | "monthly"; themes: string[] }[];
}

export function CommunityThemeHistoryTab({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"all" | "daily" | "weekly" | "monthly">("all");

  const q = useQuery({
    queryKey: ["theme-history", chatId, type],
    queryFn: () => api.get<Resp>(`/api/communities/${chatId}/theme-history?type=${type}`),
  });

  const clearM = useMutation({
    mutationFn: (t?: string) => api.delete(`/api/communities/${chatId}/theme-history${t ? `?type=${t}` : ""}`),
    onSuccess: () => {
      notifications.show({ message: "История очищена — AI снова сможет предложить эти темы", color: "violet" });
      qc.invalidateQueries({ queryKey: ["theme-history", chatId] });
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl
          value={type}
          onChange={(v) => setType(v as any)}
          data={[
            { value: "all", label: "Все" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
          color="violet"
        />
        <Button
          variant="subtle"
          color="red"
          size="xs"
          leftSection={<IconTrash size={12} />}
          onClick={() => { if (confirm("Очистить историю тем? AI снова сможет предложить эти темы.")) clearM.mutate(type === "all" ? undefined : type); }}
        >
          Очистить
        </Button>
      </Group>

      <Alert color="violet" variant="light" icon={<IconAlertTriangle size={14} />}>
        <Text size="sm">
          Бот помнит последние 50-100 тем чтобы AI не повторял в опросах. Если AI стал генерить слабые темы — очистить историю.
        </Text>
      </Alert>

      {q.isLoading && <Skeleton h={300} />}

      <Stack gap="md">
        {q.data?.perType.map((p) => p.themes.length > 0 && (
          <Box key={p.type}>
            <Group gap={8} mb={6}>
              <Text size="11px" className="mono" c="dimmed" style={{ letterSpacing: "0.12em" }}>{p.type.toUpperCase()}</Text>
              <Badge size="xs" variant="light" color="violet">{p.themes.length}</Badge>
            </Group>
            <Box className="glass" style={{ padding: 14 }}>
              <Group gap={6} wrap="wrap">
                {p.themes.map((t, i) => (
                  <Box
                    key={i}
                    style={{
                      padding: "4px 10px",
                      background: "var(--bg-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      fontSize: 12,
                    }}
                  >
                    {t}
                  </Box>
                ))}
              </Group>
            </Box>
          </Box>
        ))}
        {q.data?.perType.every((p) => p.themes.length === 0) && (
          <Text c="dimmed" size="sm">История пуста</Text>
        )}
      </Stack>
    </Stack>
  );
}
