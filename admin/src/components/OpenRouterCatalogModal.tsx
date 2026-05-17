import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  Button,
  Box,
  Skeleton,
  Badge,
  ScrollArea,
  Tooltip,
} from "@mantine/core";
import { IconSearch, IconRefresh, IconCheck } from "@tabler/icons-react";
import { api } from "@/api/client";

export interface OrModel {
  id: string;
  name: string;
  group: string;
  modality: string;
  context_length: number | null;
  prompt_price: number | null;
  completion_price: number | null;
  free: boolean;
  description: string;
}

interface CatalogResp {
  source: "cache" | "fresh";
  cachedAt: number;
  count: number;
  models: OrModel[];
  groups: { group: string; count: number }[];
}

interface Props {
  opened: boolean;
  onClose: () => void;
  selected?: string;
  onSelect: (id: string) => void;
}

export function OpenRouterCatalogModal({ opened, onClose, selected, onSelect }: Props) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["openrouter", "models"],
    queryFn: () => api.get<CatalogResp>("/api/ai/openrouter-catalog"),
    enabled: opened,
    staleTime: 24 * 3600 * 1000,
  });

  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | "all">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [modality, setModality] = useState<"all" | "text" | "multimodal">("all");

  useEffect(() => {
    if (opened) {
      setSearch("");
    }
  }, [opened]);

  const filtered = useMemo(() => {
    const list = q.data?.models ?? [];
    return list.filter((m) => {
      if (activeGroup !== "all" && m.group !== activeGroup) return false;
      if (freeOnly && !m.free) return false;
      if (modality !== "all" && m.modality !== modality) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.id.toLowerCase().includes(s) && !m.name.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [q.data?.models, search, activeGroup, freeOnly, modality]);

  function refreshCatalog() {
    fetch("/api/ai/openrouter-catalog?refresh=1", { credentials: "include" })
      .then(() => qc.invalidateQueries({ queryKey: ["openrouter", "models"] }));
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="80%"
      withCloseButton
      title={
        <Group gap={12}>
          <Text fw={600} className="mono" style={{ letterSpacing: "0.06em" }}>
            OPENROUTER CATALOG
          </Text>
          {q.data && (
            <Text size="11px" c="dimmed" className="mono">
              {q.data.count} моделей · {q.data.source} ·{" "}
              {new Date(q.data.cachedAt).toLocaleString("ru-RU")}
            </Text>
          )}
        </Group>
      }
      radius="sm"
      styles={{ body: { padding: 0 }, content: { background: "var(--bg-1)" } }}
    >
      <Box style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: 600 }}>
        {/* Sidebar: groups */}
        <Box
          style={{
            borderRight: "1px solid var(--border)",
            background: "var(--bg)",
            padding: 12,
          }}
        >
          <Text
            size="10px"
            c="var(--fg-faint)"
            className="mono"
            mb={8}
            style={{ letterSpacing: "0.14em" }}
          >
            PROVIDERS
          </Text>
          <ScrollArea h={560}>
            <Stack gap={2}>
              <GroupItem
                label="ALL"
                count={q.data?.count ?? 0}
                active={activeGroup === "all"}
                onClick={() => setActiveGroup("all")}
              />
              {q.data?.groups.map((g) => (
                <GroupItem
                  key={g.group}
                  label={g.group}
                  count={g.count}
                  active={activeGroup === g.group}
                  onClick={() => setActiveGroup(g.group)}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Box>

        {/* Main */}
        <Box style={{ display: "flex", flexDirection: "column", minHeight: 600 }}>
          {/* Top bar */}
          <Box style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="поиск по id или названию"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                style={{ flex: 1 }}
                size="xs"
              />
              <Button.Group>
                <Button
                  size="xs"
                  variant={modality === "all" ? "filled" : "default"}
                  color={modality === "all" ? "yellow" : undefined}
                  styles={modality === "all" ? { root: { color: "var(--bg)" } } : undefined}
                  onClick={() => setModality("all")}
                >
                  ALL
                </Button>
                <Button
                  size="xs"
                  variant={modality === "text" ? "filled" : "default"}
                  color={modality === "text" ? "yellow" : undefined}
                  styles={modality === "text" ? { root: { color: "var(--bg)" } } : undefined}
                  onClick={() => setModality("text")}
                >
                  TEXT
                </Button>
                <Button
                  size="xs"
                  variant={modality === "multimodal" ? "filled" : "default"}
                  color={modality === "multimodal" ? "yellow" : undefined}
                  styles={modality === "multimodal" ? { root: { color: "var(--bg)" } } : undefined}
                  onClick={() => setModality("multimodal")}
                >
                  MULTIMODAL
                </Button>
              </Button.Group>
              <Button
                size="xs"
                variant={freeOnly ? "filled" : "default"}
                color={freeOnly ? "green" : undefined}
                onClick={() => setFreeOnly((v) => !v)}
              >
                FREE
              </Button>
              <Tooltip label="Обновить каталог из OpenRouter">
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconRefresh size={14} />}
                  loading={q.isFetching}
                  onClick={refreshCatalog}
                >
                  REFRESH
                </Button>
              </Tooltip>
            </Group>
            <Text size="10px" c="dimmed" mt={6} className="mono">
              {filtered.length} / {q.data?.count ?? 0}
            </Text>
          </Box>

          {/* List */}
          <ScrollArea h={530}>
            {q.isLoading && (
              <Stack gap={4} p="sm">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={48} />)}
              </Stack>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <Text c="dimmed" size="sm" ta="center" mt="xl">
                Не нашлось моделей под фильтры
              </Text>
            )}
            <Stack gap={0}>
              {filtered.map((m) => (
                <ModelRow
                  key={m.id}
                  m={m}
                  selected={m.id === selected}
                  onSelect={() => { onSelect(m.id); onClose(); }}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Box>
      </Box>
    </Modal>
  );
}

function GroupItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      style={{
        padding: "6px 10px",
        cursor: "pointer",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        background: active ? "var(--bg-2)" : "transparent",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "background 0.1s",
      }}
    >
      <Text
        size="11px"
        className="mono"
        c={active ? "var(--fg)" : "var(--fg-dim)"}
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </Text>
      <Text size="10px" c="var(--fg-faint)" className="mono tnum">
        {count}
      </Text>
    </Box>
  );
}

function ModelRow({
  m,
  selected,
  onSelect,
}: {
  m: OrModel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      onClick={onSelect}
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: selected ? "var(--accent-soft)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "var(--bg-2)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      <Group justify="space-between" gap="md" wrap="nowrap">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap={8} align="baseline" wrap="nowrap">
            {selected && <IconCheck size={14} color="var(--accent)" />}
            <Text size="13px" fw={500} className="mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {m.id}
            </Text>
            {m.modality !== "text" && (
              <Badge size="xs" color="violet" variant="light" radius="sm">
                {m.modality}
              </Badge>
            )}
            {m.free && (
              <Badge size="xs" color="green" variant="light" radius="sm">
                FREE
              </Badge>
            )}
          </Group>
          {m.name !== m.id && (
            <Text size="11px" c="dimmed" lineClamp={1}>{m.name}</Text>
          )}
        </Box>
        <Group gap={20} wrap="nowrap">
          {m.context_length && (
            <Stack gap={0} align="flex-end">
              <Text size="9px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.1em" }}>CTX</Text>
              <Text size="11px" className="mono tnum">{fmtCtx(m.context_length)}</Text>
            </Stack>
          )}
          {m.prompt_price !== null && (
            <Stack gap={0} align="flex-end">
              <Text size="9px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.1em" }}>IN /1M</Text>
              <Text size="11px" className="mono tnum">{fmtPrice(m.prompt_price)}</Text>
            </Stack>
          )}
          {m.completion_price !== null && (
            <Stack gap={0} align="flex-end">
              <Text size="9px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.1em" }}>OUT/1M</Text>
              <Text size="11px" className="mono tnum">{fmtPrice(m.completion_price)}</Text>
            </Stack>
          )}
        </Group>
      </Group>
    </Box>
  );
}

function fmtPrice(p: number): string {
  if (p === 0) return "free";
  if (p < 0.01) return `$${p.toFixed(4)}`;
  if (p < 1) return `$${p.toFixed(3)}`;
  return `$${p.toFixed(2)}`;
}

function fmtCtx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}
