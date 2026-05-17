import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Group, Text, Button, Skeleton, Badge, SegmentedControl, Alert } from "@mantine/core";
import { IconCheck, IconTrash, IconBulb } from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";

interface Suggestion {
  id: string;
  messageId: number;
  userId: number;
  username?: string;
  theme: string;
  createdAt: number;
  reactionCount: number;
}

interface Resp {
  minRequired: number;
  perType: { type: "daily" | "weekly" | "monthly"; min: number; suggestions: Suggestion[] }[];
}

export function CommunitySuggestionsTab({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"all" | "daily" | "weekly" | "monthly">("all");

  const q = useQuery({
    queryKey: ["community-suggestions", chatId],
    queryFn: () => api.get<Resp>(`/api/communities/${chatId}/suggestions?type=all`),
  });

  const approveM = useMutation({
    mutationFn: ({ id, t }: { id: string; t: "daily"|"weekly"|"monthly" }) =>
      api.patch(`/api/communities/${chatId}/suggestions`, { id, type: t, action: "approve" }),
    onSuccess: () => {
      notifications.show({ message: "Одобрено", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-suggestions", chatId] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const delM = useMutation({
    mutationFn: ({ id, t }: { id: string; t: "daily"|"weekly"|"monthly" }) =>
      api.delete(`/api/communities/${chatId}/suggestions?type=${t}&id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      notifications.show({ message: "Удалено", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-suggestions", chatId] });
    },
  });

  const clearAllM = useMutation({
    mutationFn: () => api.delete(`/api/communities/${chatId}/suggestions`),
    onSuccess: () => {
      notifications.show({ message: "Очищено", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-suggestions", chatId] });
    },
  });

  if (q.isLoading) return <Skeleton h={400} />;
  if (!q.data) return null;

  const filtered = type === "all" ? q.data.perType : q.data.perType.filter((p) => p.type === type);

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
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
        <Group gap="xs">
          <Text size="11px" c="dimmed">Минимум реакций для попадания в опрос:</Text>
          <Badge color="amber" variant="light">{q.data.minRequired}</Badge>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={12} />}
            onClick={() => { if (confirm("Очистить все предложения?")) clearAllM.mutate(); }}
          >
            Очистить все
          </Button>
        </Group>
      </Group>

      {filtered.every((p) => p.suggestions.length === 0) && (
        <Alert color="violet" variant="light" icon={<IconBulb size={14} />}>
          <Text size="sm">Нет предложений тем</Text>
        </Alert>
      )}

      <Stack gap="md">
        {filtered.map((p) => p.suggestions.length > 0 && (
          <Box key={p.type}>
            <Text size="11px" className="mono" c="dimmed" mb={6} style={{ letterSpacing: "0.12em" }}>
              {p.type.toUpperCase()} · {p.suggestions.length}
            </Text>
            <Box className="glass" style={{ overflow: "hidden" }}>
              {p.suggestions.map((s, i) => {
                const ready = (s.reactionCount ?? 0) >= q.data.minRequired;
                return (
                  <Group
                    key={s.id}
                    justify="space-between"
                    align="flex-start"
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < p.suggestions.length - 1 ? "1px solid var(--border)" : undefined,
                      gap: 12,
                    }}
                  >
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text size="13px">{s.theme}</Text>
                      <Group gap={8}>
                        <Text size="10px" c="dimmed">@{s.username ?? `user${s.userId}`}</Text>
                        <Text size="10px" c="dimmed">·</Text>
                        <Text size="10px" c="dimmed">{new Date(s.createdAt).toLocaleString("ru-RU")}</Text>
                      </Group>
                    </Stack>
                    <Group gap={10}>
                      <Badge color={ready ? "green" : "gray"} variant="light">
                        {s.reactionCount ?? 0} / {q.data.minRequired}
                      </Badge>
                      {!ready && (
                        <Button
                          size="compact-xs"
                          className="btn-primary"
                          leftSection={<IconCheck size={12} />}
                          onClick={() => approveM.mutate({ id: s.id, t: p.type })}
                          loading={approveM.isPending}
                        >
                          одобрить
                        </Button>
                      )}
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={12} />}
                        onClick={() => delM.mutate({ id: s.id, t: p.type })}
                      >
                        удалить
                      </Button>
                    </Group>
                  </Group>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
