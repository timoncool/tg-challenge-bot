import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Group, Text, Button, Skeleton, Alert, Modal, Select, TextInput, PasswordInput, Anchor } from "@mantine/core";
import { IconCheck, IconTrash, IconInfoCircle, IconExternalLink, IconArrowsExchange } from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";
import { OpenRouterCatalogModal } from "@/components/OpenRouterCatalogModal";
import { buildOpenRouterGroups, ensureSelectedInGroups, type OrModel } from "@/lib/openrouter-groups";

interface AiCfg {
  id?: string; name: string; provider: "openrouter" | "gemini";
  apiUrl: string; apiKey: string; model: string;
  temperature?: number; referer?: string; title?: string;
}

interface Resp { override: AiCfg | null; source: "community" | "inherits-global"; }

export function CommunityAiTab({ chatId }: { chatId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<AiCfg> | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const q = useQuery({
    queryKey: ["community-ai", chatId],
    queryFn: () => api.get<Resp>(`/api/communities/${chatId}/ai`),
  });

  const presetsQ = useQuery({
    queryKey: ["ai", "presets"],
    queryFn: () => api.get<{ presets: AiCfg[] }>("/api/ai/presets"),
  });

  const catalogQ = useQuery({
    queryKey: ["openrouter", "models"],
    queryFn: () => api.get<{ models: OrModel[] }>("/api/ai/openrouter-catalog"),
    staleTime: 24 * 3600 * 1000,
  });

  const saveM = useMutation({
    mutationFn: (cfg: Partial<AiCfg>) => api.put(`/api/communities/${chatId}/ai`, cfg),
    onSuccess: () => {
      notifications.show({ message: "Override установлен", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-ai", chatId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const delM = useMutation({
    mutationFn: () => api.delete(`/api/communities/${chatId}/ai`),
    onSuccess: () => {
      notifications.show({ message: "Override снят — комьюнити наследует global", color: "violet" });
      qc.invalidateQueries({ queryKey: ["community-ai", chatId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (q.isLoading) return <Skeleton h={200} />;

  const override = q.data?.override;
  const isInheriting = q.data?.source === "inherits-global";

  return (
    <Stack gap="lg">
      <Alert color="violet" variant="light" icon={<IconInfoCircle size={16} />} radius="md">
        <Text size="sm" fw={500}>Per-community AI override</Text>
        <Text size="12px" c="dimmed" mt={4}>
          Если задан — бот при генерации тем для этой группы использует этот AI.
          Если не задан — используется global движок (страница «AI Engine»).
        </Text>
      </Alert>

      <Box className="glass" style={{ padding: 20 }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text size="11px" c="var(--fg-dim)" fw={500}>Текущий движок для этой группы:</Text>
            {override ? (
              <Stack gap={2}>
                <Group gap={8}>
                  <Text fw={600}>{override.name}</Text>
                  <span className="pill accent">community override</span>
                </Group>
                <Text size="12px" c="dimmed" className="mono">
                  {override.provider} · {override.model} · {override.apiKey}
                </Text>
              </Stack>
            ) : (
              <Stack gap={2}>
                <Group gap={8}>
                  <Text fw={600}>наследует global</Text>
                  <span className="pill mint">inherits</span>
                </Group>
                <Text size="12px" c="dimmed">Бот использует тот AI, что на странице «AI Engine»</Text>
              </Stack>
            )}
          </Stack>
          <Group gap="xs">
            {!isInheriting && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={12} />}
                onClick={() => delM.mutate()}
              >
                Снять override
              </Button>
            )}
            <Button
              size="xs"
              variant="default"
              leftSection={<IconArrowsExchange size={12} />}
              onClick={() => setEditing(override ?? {
                provider: "openrouter",
                apiUrl: "https://openrouter.ai/api/v1/chat/completions",
                apiKey: "",
                model: "",
                temperature: 0.95,
                name: "OpenRouter (per-community)",
                referer: "https://tg-challenge-bot-admin.pages.dev",
                title: "tg-challenge-bot",
              })}
            >
              {override ? "Изменить" : "Установить override"}
            </Button>
          </Group>
        </Group>
      </Box>

      {(presetsQ.data?.presets.length ?? 0) > 0 && (
        <Box>
          <Text size="11px" c="dimmed" mb={6}>или быстро поставить один из пресетов:</Text>
          <Group gap="xs" wrap="wrap">
            {presetsQ.data!.presets.map((p) => (
              <Button
                key={p.id}
                size="xs"
                variant="default"
                onClick={() => setEditing({ ...p, apiKey: "__UNCHANGED__" })}
              >
                {p.name}
              </Button>
            ))}
          </Group>
        </Box>
      )}

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        size="lg"
        title={<Text fw={600}>Override для этой группы</Text>}
        radius="md"
      >
        {editing && (
          <Stack gap="md">
            <TextInput
              label="Название"
              value={editing.name ?? ""}
              onChange={(e) => setEditing({ ...editing, name: e.currentTarget.value })}
            />
            <Group grow>
              <Select
                label="Provider"
                value={editing.provider}
                onChange={(v) => v && setEditing({
                  ...editing,
                  provider: v as "openrouter" | "gemini",
                  apiUrl: v === "openrouter"
                    ? "https://openrouter.ai/api/v1/chat/completions"
                    : "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                })}
                data={[{value:"openrouter",label:"OpenRouter"},{value:"gemini",label:"Gemini"}]}
                allowDeselect={false}
              />
            </Group>
            <TextInput
              label="API URL"
              value={editing.apiUrl ?? ""}
              onChange={(e) => setEditing({ ...editing, apiUrl: e.currentTarget.value })}
              styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12 } }}
            />
            <PasswordInput
              label={
                <Group gap={6}>
                  <span>API Key</span>
                  {editing.provider === "openrouter" && (
                    <Anchor href="https://openrouter.ai/keys" target="_blank" size="xs" c="var(--accent-bright)">
                      <Group gap={3}>взять <IconExternalLink size={11} /></Group>
                    </Anchor>
                  )}
                </Group>
              }
              value={editing.apiKey === "__UNCHANGED__" ? "" : editing.apiKey ?? ""}
              onChange={(e) => setEditing({ ...editing, apiKey: e.currentTarget.value })}
              placeholder={editing.apiKey === "__UNCHANGED__" ? "•••• (текущий)" : ""}
            />
            <Box>
              <Text size="xs" mb={4}>Model</Text>
              <Group gap={6} wrap="nowrap">
                {editing.provider === "openrouter" ? (
                  <Select
                    value={editing.model || null}
                    onChange={(v) => setEditing({ ...editing, model: v ?? "" })}
                    data={ensureSelectedInGroups(buildOpenRouterGroups(catalogQ.data?.models ?? []), editing.model)}
                    placeholder={catalogQ.isLoading ? "загружаю каталог…" : "ищи модель"}
                    searchable
                    limit={500}
                    nothingFoundMessage="не найдено"
                    styles={{ input: { fontFamily: "var(--font-mono)" } }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <TextInput
                    value={editing.model ?? ""}
                    onChange={(e) => setEditing({ ...editing, model: e.currentTarget.value })}
                    placeholder="gemini-2.5-flash"
                    styles={{ input: { fontFamily: "var(--font-mono)" } }}
                    style={{ flex: 1 }}
                  />
                )}
                {editing.provider === "openrouter" && (
                  <Button variant="default" size="sm" onClick={() => setCatalogOpen(true)}>
                    Каталог ↗
                  </Button>
                )}
              </Group>
            </Box>

            <Group justify="flex-end" mt="sm">
              <Button
                className="btn-primary"
                leftSection={<IconCheck size={14} />}
                loading={saveM.isPending}
                onClick={() => saveM.mutate({
                  ...editing,
                  apiKey: editing.apiKey && editing.apiKey.length > 0 ? editing.apiKey : "__UNCHANGED__",
                  name: editing.name && editing.name.trim() ? editing.name : `${editing.provider}/${editing.model}`,
                })}
                disabled={!editing.provider || !editing.apiUrl || !editing.model}
              >
                Применить
              </Button>
            </Group>
          </Stack>
        )}
        <OpenRouterCatalogModal
          opened={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          selected={editing?.model}
          onSelect={(id) => editing && setEditing({ ...editing, model: id })}
        />
      </Modal>
    </Stack>
  );
}
