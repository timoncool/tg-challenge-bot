import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  TextInput,
  Button,
  Skeleton,
  ScrollArea,
  Alert,
  ActionIcon,
  Anchor,
} from "@mantine/core";
import { PageHeader } from "@/components/PageHeader";
import {
  IconSearch,
  IconRefresh,
  IconDownload,
  IconEye,
  IconTrash,
  IconAlertTriangle,
  IconFolder,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";

interface KeysResp {
  keys: { name: string; expiration: number | null; metadata: unknown }[];
  cursor: string | null;
  list_complete: boolean;
}

const KNOWN_PREFIXES = [
  { prefix: "communities:list",      label: "Реестр комьюнити" },
  { prefix: "community:",            label: "Все per-community ключи" },
  { prefix: "settings:ai:",          label: "AI настройки (global, presets, prompts)" },
  { prefix: "cache:",                label: "Кэши (openrouter каталог)" },
  { prefix: "alerts:",               label: "Алерты" },
  { prefix: "webhook:processed:",    label: "Webhook dedup (TTL 1ч)" },
  { prefix: "",                      label: "Всё (медленно)" },
];

export function KvExplorerPage() {
  const qc = useQueryClient();
  const [prefix, setPrefix] = useState("communities:list");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["kv", "keys", prefix],
    queryFn: () => api.get<KeysResp>(`/api/kv/keys?prefix=${encodeURIComponent(prefix)}&limit=200`),
  });

  const valueQ = useQuery({
    queryKey: ["kv", "value", selectedKey],
    queryFn: () => api.get<{ key: string; value: unknown; type: "json" | "text" | "missing" }>(`/api/kv/value?key=${encodeURIComponent(selectedKey!)}`),
    enabled: !!selectedKey,
  });

  async function delKey(key: string) {
    if (!confirm(`Удалить ключ ${key} из KV? Действие необратимо (но есть бэкапы).`)) return;
    try {
      await api.delete(`/api/kv/value?key=${encodeURIComponent(key)}`);
      notifications.show({ message: `Удалён: ${key}`, color: "violet" });
      qc.invalidateQueries({ queryKey: ["kv"] });
      if (selectedKey === key) setSelectedKey(null);
    } catch (e) {
      notifications.show({ message: (e as Error).message, color: "red" });
    }
  }

  return (
    <Box style={{ padding: "40px 48px 80px", maxWidth: 1400, margin: "0 auto" }}>
      <PageHeader
        crumb="CONTROL ROOM / 10 / KV EXPLORER"
        title="Сырой просмотр Cloudflare KV"
        emphasis="Cloudflare KV"
        subtitle="Поиск по префиксу, просмотр значения как JSON, удаление. Та же база что использует бот. Перед удалением проверь что есть бэкап."
      />

      <Group gap="xs" mb="md" wrap="wrap">
        {KNOWN_PREFIXES.map((p) => (
          <Button
            key={p.prefix}
            size="xs"
            variant={prefix === p.prefix ? "filled" : "default"}
            color={prefix === p.prefix ? "violet" : undefined}
            leftSection={<IconFolder size={12} />}
            onClick={() => setPrefix(p.prefix)}
          >
            {p.prefix || "all"}
          </Button>
        ))}
      </Group>

      <Group gap="xs" mb="md" wrap="nowrap">
        <TextInput
          placeholder="prefix (например community:-1003561666354:)"
          value={prefix}
          onChange={(e) => setPrefix(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          style={{ flex: 1 }}
          styles={{ input: { fontFamily: "var(--font-mono)" } }}
        />
        <Button
          variant="default"
          leftSection={<IconRefresh size={14} />}
          loading={listQ.isFetching}
          onClick={() => qc.invalidateQueries({ queryKey: ["kv", "keys"] })}
        >
          Обновить
        </Button>
        <Anchor
          component="button"
          size="xs"
          c="var(--accent-bright)"
          onClick={async () => {
            // Export visible keys to JSON
            if (!listQ.data) return;
            const out: Record<string, unknown> = {};
            for (const k of listQ.data.keys) {
              const v = await api.get<{ key: string; value: unknown }>(`/api/kv/value?key=${encodeURIComponent(k.name)}`);
              out[k.name] = v.value;
            }
            const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `kv-export-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Group gap={3}><IconDownload size={12} /> JSON</Group>
        </Anchor>
      </Group>

      <Box style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 16 }}>
        {/* Key list */}
        <Box className="glass" style={{ overflow: "hidden" }}>
          <Group justify="space-between" p="md" style={{ borderBottom: "1px solid var(--border)" }}>
            <Text size="13px" fw={500}>Ключи</Text>
            <Text size="11px" c="dimmed" className="mono">
              {listQ.data?.keys.length ?? 0}
              {listQ.data && !listQ.data.list_complete && " +more"}
            </Text>
          </Group>
          <ScrollArea h={600}>
            {listQ.isLoading && (
              <Stack p="md" gap={6}>
                {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} h={28} />)}
              </Stack>
            )}
            {listQ.error && (
              <Alert m="md" color="red" variant="light" icon={<IconAlertTriangle size={14} />}>
                {(listQ.error as Error).message}
              </Alert>
            )}
            {listQ.data?.keys.length === 0 && (
              <Text c="dimmed" size="sm" p="md">Нет ключей по этому префиксу</Text>
            )}
            <Stack gap={0}>
              {listQ.data?.keys.map((k) => {
                const active = k.name === selectedKey;
                return (
                  <Group
                    key={k.name}
                    onClick={() => setSelectedKey(k.name)}
                    style={{
                      padding: "8px 12px",
                      borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                      background: active ? "var(--accent-soft)" : undefined,
                      cursor: "pointer",
                      gap: 8,
                    }}
                  >
                    <Text size="11px" className="mono" style={{ flex: 1, wordBreak: "break-all" }}>
                      {k.name}
                    </Text>
                    {k.expiration && (
                      <Text size="9px" c="amber" className="mono">
                        TTL {Math.max(0, Math.round((k.expiration * 1000 - Date.now()) / 3600000))}h
                      </Text>
                    )}
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); void delKey(k.name); }}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
        </Box>

        {/* Value pane */}
        <Box className="glass" style={{ minHeight: 600, padding: 20 }}>
          {!selectedKey && (
            <Stack align="center" justify="center" h="100%" gap={6}>
              <IconEye size={32} stroke={1.5} color="var(--fg-faint)" />
              <Text c="var(--fg-faint)" size="sm">Выбери ключ слева</Text>
            </Stack>
          )}
          {selectedKey && (
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="11px" className="mono" style={{ wordBreak: "break-all" }}>
                  {selectedKey}
                </Text>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={12} />}
                  onClick={() => void delKey(selectedKey)}
                >
                  delete
                </Button>
              </Group>

              {valueQ.isLoading && <Skeleton h={300} />}
              {valueQ.data?.type === "missing" && (
                <Text c="var(--fg-faint)">ключ не существует или истёк TTL</Text>
              )}
              {valueQ.data && valueQ.data.type !== "missing" && (
                <Box
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    maxHeight: 580,
                    overflow: "auto",
                  }}
                >
                  {valueQ.data.type === "json"
                    ? JSON.stringify(valueQ.data.value, null, 2)
                    : String(valueQ.data.value)}
                </Box>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
