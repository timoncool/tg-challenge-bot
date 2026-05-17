import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Select,
  TextInput,
  PasswordInput,
  Slider,
  Alert,
  Skeleton,
  Anchor,
} from "@mantine/core";
import {
  IconBolt,
  IconAlertTriangle,
  IconCircleCheckFilled,
  IconCircleX,
  IconExternalLink,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import type { AiConfig, AiProvider } from "@/api/types";
import { buildOpenRouterGroups, ensureSelectedInGroups } from "@/lib/openrouter-groups";

interface OrModel {
  id: string;
  name: string;
  prompt_price?: number | null;
  completion_price?: number | null;
  context_length?: number | null;
  free?: boolean;
}

const PROVIDER_DEFAULTS: Record<AiProvider, string> = {
  gemini:     "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

interface TestResult {
  mode: "vanilla" | "medium" | "nsfw";
  ok: boolean;
  themes: string[];
  rawText: string;
  durationMs: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_cost?: number } | null;
  error: string | null;
}

const MODE_META = {
  vanilla: { label: "VANILLA",  color: "var(--green)",  emoji: "🍦", desc: "SFW, безопасный контент" },
  medium:  { label: "MEDIUM",   color: "var(--accent)", emoji: "🔥", desc: "поп-культура, нуар, без эротики" },
  nsfw:    { label: "NSFW",     color: "var(--red)",    emoji: "🌙", desc: "18+, жёсткая эротика" },
} as const;

export function AiTestPage() {
  const [provider, setProvider] = useState<AiProvider>("openrouter");
  const [apiUrl, setApiUrl] = useState(PROVIDER_DEFAULTS.openrouter);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.95);
  const [type, setType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [useGlobal, setUseGlobal] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);

  const presetsQ = useQuery({
    queryKey: ["ai", "presets"],
    queryFn: () => api.get<{ presets: AiConfig[] }>("/api/ai/presets"),
  });

  const globalQ = useQuery({
    queryKey: ["ai", "global"],
    queryFn: () => api.get<{ source: string; config: AiConfig | null }>("/api/ai/global"),
  });

  // Auto-select default config on first load — admin already configured the
  // engine elsewhere; user shouldn't need to retype anything just to test.
  // Preference order: Effective Global > first preset > custom.
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoSelected) return;
    if (globalQ.data && globalQ.data.config) {
      setUseGlobal(true);
      setPresetId(null);
      setAutoSelected(true);
    } else if (presetsQ.data && presetsQ.data.presets.length > 0) {
      const p = presetsQ.data.presets[0];
      setProvider(p.provider as AiProvider);
      setApiUrl(p.apiUrl);
      setApiKey("");
      setModel(p.model);
      setTemperature(p.temperature ?? 0.95);
      setUseGlobal(false);
      setPresetId(p.id);
      setAutoSelected(true);
    }
  }, [globalQ.data, presetsQ.data, autoSelected]);

  const catalogQ = useQuery({
    queryKey: ["openrouter", "models"],
    queryFn: () => api.get<{ models: OrModel[] }>("/api/ai/openrouter-catalog"),
    enabled: provider === "openrouter",
    staleTime: 24 * 3600 * 1000,
  });

  const [lastModes, setLastModes] = useState<("vanilla" | "medium" | "nsfw")[]>([]);
  const testM = useMutation({
    mutationFn: (modes: ("vanilla" | "medium" | "nsfw")[]) => {
      setLastModes(modes);
      const body: Record<string, unknown> = { type, modes };
      if (useGlobal) {
        body.useGlobal = true;
      } else if (presetId) {
        body.usePresetId = presetId;
      } else {
        body.config = {
          provider, apiUrl, apiKey, model, temperature,
          referer: "https://tg-challenge-bot-admin.pages.dev",
          title: "tg-challenge-bot-admin",
        };
      }
      return api.post<{ ok: boolean; type: string; config: any; results: TestResult[] }>(
        "/api/ai/test", body
      );
    },
  });

  function loadFromPreset(id: string) {
    const p = presetsQ.data?.presets.find((x) => x.id === id);
    if (!p) return;
    setProvider(p.provider);
    setApiUrl(p.apiUrl);
    setApiKey(""); // we'll send via usePresetId; show empty in UI
    setModel(p.model);
    setTemperature(p.temperature ?? 0.95);
    setUseGlobal(false);
    setPresetId(id);
  }

  function resetToCustom() {
    setPresetId(null);
    setUseGlobal(false);
    setApiKey("");
    setModel("");
  }

  return (
    <Box style={{ padding: "32px 40px 80px", maxWidth: 1400, margin: "0 auto" }}>
      <Group justify="space-between" align="flex-end" mb="lg">
        <Stack gap={4}>
          <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.18em" }}>
            CONTROL ROOM / 03 / AI TEST
          </Text>
          <Text fw={600} style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Тест AI движка
          </Text>
          <Text size="sm" c="dimmed">
            Выбираешь модель — жмёшь режим — получаешь 6 тем, время, стоимость.
          </Text>
        </Stack>
        <Anchor
          href="https://openrouter.ai/keys"
          target="_blank"
          size="xs"
          c="var(--accent)"
        >
          <Group gap={4} wrap="nowrap">
            <IconExternalLink size={12} />
            <Text size="xs" inherit>openrouter.ai/keys</Text>
          </Group>
        </Anchor>
      </Group>

      {/* Config bar */}
      <Box style={{ border: "1px solid var(--border)", background: "var(--bg-1)", padding: 20, marginBottom: 24 }}>
        <Group gap="md" align="flex-end" wrap="wrap">
          <Box style={{ minWidth: 240 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>FROM PRESET</Text>
            <Select
              placeholder="custom config"
              value={useGlobal ? "__global__" : presetId}
              data={[
                { value: "__global__", label: "Effective Global" },
                ...(presetsQ.data?.presets.map((p) => ({ value: p.id, label: p.name })) ?? []),
              ]}
              onChange={(v) => {
                if (!v) { resetToCustom(); return; }
                if (v === "__global__") { setUseGlobal(true); setPresetId(null); }
                else loadFromPreset(v);
              }}
              clearable
              size="xs"
            />
          </Box>

          <Box style={{ width: 140 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>PROVIDER</Text>
            <Select
              value={provider}
              onChange={(v) => {
                if (!v) return;
                setProvider(v as AiProvider);
                setApiUrl(PROVIDER_DEFAULTS[v as AiProvider]);
                setUseGlobal(false);
                setPresetId(null);
              }}
              data={[
                { value: "openrouter", label: "OpenRouter" },
                { value: "gemini", label: "Gemini" },
              ]}
              allowDeselect={false}
              size="xs"
              disabled={useGlobal || !!presetId}
            />
          </Box>

          <Box style={{ flex: 1, minWidth: 260 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>
              MODEL
              {provider === "openrouter" && (
                <Anchor href="https://openrouter.ai/models" target="_blank" size="9px" c="dimmed" ml={6}>
                  каталог ↗
                </Anchor>
              )}
            </Text>
            {provider === "openrouter" ? (
              <Select
                placeholder={catalogQ.isLoading ? "загружаю каталог…" : "ищи модель"}
                value={model || null}
                onChange={(v) => setModel(v ?? "")}
                data={ensureSelectedInGroups(buildOpenRouterGroups(catalogQ.data?.models ?? []), model)}
                searchable
                limit={500}
                nothingFoundMessage="не найдено"
                size="xs"
                disabled={useGlobal}
                styles={{ input: { fontFamily: "var(--font-mono)" } }}
              />
            ) : (
              <TextInput
                value={model}
                onChange={(e) => setModel(e.currentTarget.value)}
                placeholder="название модели"
                size="xs"
                disabled={useGlobal || !!presetId}
                styles={{ input: { fontFamily: "var(--font-mono)" } }}
              />
            )}
          </Box>

          <Box style={{ width: 100 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>
              TYPE
            </Text>
            <Select
              value={type}
              onChange={(v) => v && setType(v as any)}
              data={[
                { value: "daily", label: "daily" },
                { value: "weekly", label: "weekly" },
                { value: "monthly", label: "monthly" },
              ]}
              allowDeselect={false}
              size="xs"
            />
          </Box>

          <Box style={{ width: 140 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>
              TEMP <span style={{ color: "var(--fg)" }}>{temperature.toFixed(2)}</span>
            </Text>
            <Slider
              value={temperature}
              onChange={setTemperature}
              min={0}
              max={2}
              step={0.05}
              color="yellow"
              label={null}
              disabled={useGlobal}
              size="sm"
            />
          </Box>
        </Group>

        <Group mt="md" align="flex-end" wrap="nowrap">
          <Box style={{ flex: 1 }}>
            <Text size="9px" c="var(--fg-faint)" className="mono" mb={4} style={{ letterSpacing: "0.14em" }}>
              API KEY {(useGlobal || presetId) && <span style={{ color: "var(--accent)" }}>← из {useGlobal ? "global" : "preset"}</span>}
            </Text>
            <PasswordInput
              value={apiKey}
              onChange={(e) => setApiKey(e.currentTarget.value)}
              placeholder={useGlobal || presetId ? "•••• используется сохранённый" : "вставь токен"}
              disabled={useGlobal || !!presetId}
              styles={{ input: { fontFamily: "var(--font-mono)" } }}
              size="sm"
            />
          </Box>
        </Group>

        <Group mt="md" gap="xs" justify="flex-end">
          <Text size="10px" c="var(--fg-faint)" className="mono" mr="auto" style={{ letterSpacing: "0.14em" }}>
            TEST →
          </Text>
          <Button
            variant="default"
            size="xs"
            leftSection={<span>🍦</span>}
            onClick={() => testM.mutate(["vanilla"])}
            loading={testM.isPending && lastModes.length === 1 && lastModes[0] === "vanilla"}
            disabled={testM.isPending || (!useGlobal && !presetId && (!apiKey || !model || !apiUrl))}
          >
            VANILLA
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<span>🔥</span>}
            onClick={() => testM.mutate(["medium"])}
            loading={testM.isPending && lastModes.length === 1 && lastModes[0] === "medium"}
            disabled={testM.isPending || (!useGlobal && !presetId && (!apiKey || !model || !apiUrl))}
          >
            MEDIUM
          </Button>
          <Button
            variant="default"
            size="xs"
            leftSection={<span>🌙</span>}
            onClick={() => testM.mutate(["nsfw"])}
            loading={testM.isPending && lastModes.length === 1 && lastModes[0] === "nsfw"}
            disabled={testM.isPending || (!useGlobal && !presetId && (!apiKey || !model || !apiUrl))}
          >
            NSFW
          </Button>
          <Button
            className="btn-primary"
            size="xs"
            leftSection={<IconBolt size={14} />}
            onClick={() => testM.mutate(["vanilla", "medium", "nsfw"])}
            loading={testM.isPending && lastModes.length === 3}
            disabled={testM.isPending || (!useGlobal && !presetId && (!apiKey || !model || !apiUrl))}
          >
            ALL 3
          </Button>
        </Group>

      </Box>

      {/* Results: 3 columns */}
      <Box style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {(["vanilla", "medium", "nsfw"] as const).map((mode) => {
          const meta = MODE_META[mode];
          const result = testM.data?.results.find((r) => r.mode === mode);
          const loading = testM.isPending && (lastModes.includes(mode));
          const hasResult = !!result;

          return (
            <Box
              key={mode}
              style={{
                padding: 20,
                background: "var(--bg-1)",
                border: `1px solid ${hasResult && result.ok ? meta.color : "var(--border)"}`,
                borderRadius: 6,
                minHeight: 380,
                position: "relative",
                overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              {/* corner glow */}
              <Box
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${meta.color}22 0%, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />

              <Group justify="space-between" align="flex-start" mb={14} style={{ position: "relative" }}>
                <Group gap={10} align="center">
                  <Text style={{ fontSize: 26, lineHeight: 1 }}>{meta.emoji}</Text>
                  <Stack gap={0}>
                    <Text size="12px" className="mono" fw={700} style={{ letterSpacing: "0.14em", color: meta.color }}>
                      {meta.label}
                    </Text>
                    <Text size="10px" c="dimmed">{meta.desc}</Text>
                  </Stack>
                </Group>
                {hasResult && (result.ok ? (
                  <IconCircleCheckFilled size={18} color="var(--green)" />
                ) : (
                  <IconCircleX size={18} color="var(--red)" />
                ))}
              </Group>

              {loading && (
                <Stack gap={8} mt="sm">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Group key={i} gap={8} wrap="nowrap" align="center">
                      <Skeleton circle h={14} w={14} />
                      <Skeleton h={14} w={`${60 + Math.random() * 30}%`} radius="sm" />
                    </Group>
                  ))}
                </Stack>
              )}

              {!loading && !hasResult && (
                <Stack gap={8} mt="sm">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Group key={i} gap={8} wrap="nowrap" align="center" style={{ opacity: 0.25 }}>
                      <Text size="11px" className="mono tnum" c="var(--fg-faint)" w={20}>
                        {String(i + 1).padStart(2, "0")}
                      </Text>
                      <Box style={{
                        flex: 1, height: 12, background: "var(--bg-2)", borderRadius: 3,
                        width: `${50 + ((i * 31) % 45)}%`,
                      }} />
                    </Group>
                  ))}
                  <Text size="10px" c="var(--fg-faint)" mt="sm" className="mono" style={{ letterSpacing: "0.12em" }}>
                    ↑ READY · НАЖМИ {meta.label} ИЛИ ALL 3
                  </Text>
                </Stack>
              )}

              {hasResult && (
                <Stack gap={10}>
                  {result.error && (
                    <Alert color="red" variant="light" radius="sm" icon={<IconAlertTriangle size={14} />}>
                      <Text size="11px">{result.error}</Text>
                    </Alert>
                  )}

                  {result.themes.length > 0 && (
                    <Stack gap={6}>
                      {result.themes.map((t, i) => (
                        <Group key={i} gap={10} wrap="nowrap" align="flex-start">
                          <Text size="11px" className="mono tnum" c="var(--fg-faint)" w={20} style={{ paddingTop: 1 }}>
                            {String(i + 1).padStart(2, "0")}
                          </Text>
                          <Text size="13px" style={{ flex: 1, lineHeight: 1.4 }}>{t}</Text>
                        </Group>
                      ))}
                    </Stack>
                  )}

                  <Box style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />

                  <Group gap={20}>
                    <Stat label="TIME" value={`${(result.durationMs / 1000).toFixed(2)}s`} />
                    {result.usage?.completion_tokens && (
                      <Stat label="TOK" value={String(result.usage.completion_tokens)} />
                    )}
                    {result.usage?.total_cost !== undefined && result.usage?.total_cost !== null && (
                      <Stat label="COST" value={`$${Number(result.usage.total_cost).toFixed(4)}`} />
                    )}
                  </Group>
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>

      {testM.error && (
        <Alert mt="md" color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
          {(testM.error as Error).message}
        </Alert>
      )}
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="9px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.14em" }}>{label}</Text>
      <Text size="13px" className="mono tnum" fw={500}>{value}</Text>
    </Stack>
  );
}
