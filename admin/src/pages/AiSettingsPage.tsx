import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Select,
  TextInput,
  PasswordInput,
  Alert,
  Modal,
  Skeleton,
  Anchor,
} from "@mantine/core";
import {
  IconPlus,
  IconBolt,
  IconCircleCheckFilled,
  IconExternalLink,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import type { AiConfig, AiProvider } from "@/api/types";
import { notifications } from "@mantine/notifications";
import { OpenRouterCatalogModal } from "@/components/OpenRouterCatalogModal";
import { buildOpenRouterGroups, ensureSelectedInGroups, type OrModel } from "@/lib/openrouter-groups";

// Только два провайдера. URL — точные endpoints, не модели.
const PROVIDER_DEFAULTS: Record<AiProvider, { apiUrl: string; supportsJsonMode: boolean }> = {
  gemini:     { apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", supportsJsonMode: true },
  openrouter: { apiUrl: "https://openrouter.ai/api/v1/chat/completions", supportsJsonMode: true },
};

const SENTINEL = "__UNCHANGED__";

export function AiSettingsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<AiConfig> | null>(null);
  const [saveAs, setSaveAs] = useState<"global" | "preset" | null>(null);

  const globalQ = useQuery({
    queryKey: ["ai", "global"],
    queryFn: () => api.get<{ source: string; config: AiConfig | null; hint?: string }>("/api/ai/global"),
  });

  const presetsQ = useQuery({
    queryKey: ["ai", "presets"],
    queryFn: () => api.get<{ presets: AiConfig[] }>("/api/ai/presets"),
  });

  const setGlobal = useMutation({
    mutationFn: (cfg: Partial<AiConfig>) => api.put<{ ok: true; config: AiConfig }>("/api/ai/global", cfg),
    onSuccess: () => {
      notifications.show({ message: "Global AI обновлён", color: "yellow" });
      qc.invalidateQueries({ queryKey: ["ai"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
      setSaveAs(null);
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const addPreset = useMutation({
    mutationFn: (cfg: Partial<AiConfig>) => api.post<{ ok: true }>("/api/ai/presets", cfg),
    onSuccess: () => {
      notifications.show({ message: "Preset сохранён", color: "yellow" });
      qc.invalidateQueries({ queryKey: ["ai", "presets"] });
      setEditing(null);
      setSaveAs(null);
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const delPreset = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/api/ai/presets?id=${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "presets"] }),
  });

  function openNew(provider: AiProvider, name: string) {
    setEditing({
      provider,
      apiUrl: PROVIDER_DEFAULTS[provider].apiUrl,
      apiKey: "",
      model: "",
      name,
      temperature: 0.95,
      supportsJsonMode: PROVIDER_DEFAULTS[provider].supportsJsonMode,
    });
    setSaveAs("preset");
  }

  function openEdit(cfg: AiConfig) {
    setEditing({ ...cfg, apiKey: SENTINEL });
    setSaveAs("global");
  }

  return (
    <Box style={{ padding: "32px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap={4} mb="lg">
        <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.18em" }}>
          CONTROL ROOM / 02 / AI ENGINE
        </Text>
        <Text
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 44,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Подключи <em style={{ color: "var(--accent)" }}>любой движок</em>.
        </Text>
        <Text size="sm" c="dimmed" mt={6}>
          Сохрани токен один раз — бот переключится без redeploy. Сейчас работает Gemini из env воркера.
        </Text>
      </Stack>

      {/* TOKENS — shared per-provider keys, used by every preset/global that doesn't override */}
      <SectionHeader num="00" label="TOKENS" hint="один раз сохрани — все пресеты и global этого провайдера подхватят" />
      <TokensSection />

      {/* GLOBAL */}
      <SectionHeader num="01" label="GLOBAL ENGINE" hint="используется ботом для всех групп по умолчанию" />
      {globalQ.isLoading && <Skeleton h={140} mb="lg" />}
      {globalQ.data && (
        <Box
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-1)",
            padding: 20,
            marginBottom: 32,
            position: "relative",
          }}
        >
          {globalQ.data.config ? (
            <Group justify="space-between" align="flex-start">
              <Stack gap={6}>
                <Group gap={10} align="baseline">
                  <span className="dot green" />
                  <Text fw={600} size="lg">{globalQ.data.config.name}</Text>
                  <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.12em" }}>
                    KV
                  </Text>
                </Group>
                <Group gap={24}>
                  <Field label="PROVIDER" value={globalQ.data.config.provider} />
                  <Field label="MODEL"    value={globalQ.data.config.model} mono />
                  <Field label="API_KEY"  value={globalQ.data.config.apiKey} mono />
                  <Field label="TEMP"     value={String(globalQ.data.config.temperature ?? 0.95)} mono />
                </Group>
              </Stack>
              <Button variant="default" size="xs" onClick={() => openEdit(globalQ.data!.config!)}>
                EDIT
              </Button>
            </Group>
          ) : (
            <Stack gap={10}>
              <Group gap={10}>
                <span className="dot amber" />
                <Text fw={600}>Bot reads AI from env (legacy)</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {globalQ.data.hint}
              </Text>
              <Group gap="sm" mt={6}>
                <Button
                  size="xs"
                  className="btn-primary"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => openNew("gemini", "Gemini (current)")}
                >
                  Сохранить Gemini как global
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconBolt size={14} />}
                  onClick={() => openNew("openrouter", "OpenRouter")}
                >
                  Добавить OpenRouter
                </Button>
              </Group>
            </Stack>
          )}
        </Box>
      )}

      {/* PRESETS */}
      <SectionHeader
        num="02"
        label="PRESETS"
        hint="сохранённые конфиги для быстрого переключения"
        right={
          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconPlus size={12} />}
              onClick={() => openNew("openrouter", "OpenRouter")}
            >
              + OPENROUTER
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              leftSection={<IconPlus size={12} />}
              onClick={() => openNew("gemini", "Gemini")}
            >
              + GEMINI
            </Button>
          </Group>
        }
      />

      {presetsQ.isLoading && <Skeleton h={60} />}
      {presetsQ.data?.presets.length === 0 && (
        <Text c="dimmed" size="sm">
          Пока нет пресетов. Добавь Gemini или OpenRouter сверху.
        </Text>
      )}
      <Stack gap={1}>
        {presetsQ.data?.presets.map((p) => (
          <Group
            key={p.id}
            justify="space-between"
            style={{
              padding: "14px 18px",
              border: "1px solid var(--border)",
              background: "var(--bg-1)",
              borderBottomWidth: 1,
            }}
          >
            <Group gap={16} align="center">
              <ProviderBadge p={p.provider} />
              <Stack gap={2}>
                <Text fw={500} size="sm">{p.name}</Text>
                <Text size="11px" c="dimmed" className="mono">
                  {p.model} · {p.apiKey}
                </Text>
              </Stack>
            </Group>
            <Group gap={4}>
              <Button
                size="compact-xs"
                className="btn-primary"
                leftSection={<IconCircleCheckFilled size={12} />}
                onClick={() => setGlobal.mutate({ ...p, apiKey: SENTINEL })}
                loading={setGlobal.isPending}
              >
                SET GLOBAL
              </Button>
              <Button
                size="compact-xs"
                variant="default"
                onClick={() => openEdit(p)}
              >
                EDIT
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={12} />}
                onClick={() => delPreset.mutate(p.id)}
              >
                DEL
              </Button>
            </Group>
          </Group>
        ))}
      </Stack>

      {/* EDIT MODAL */}
      <Modal
        opened={editing !== null}
        onClose={() => { setEditing(null); setSaveAs(null); }}
        size="lg"
        title={
          <Text fw={600} className="mono" style={{ letterSpacing: "0.06em" }}>
            {saveAs === "global" ? "EDIT GLOBAL" : "NEW PRESET"}
          </Text>
        }
        radius="sm"
      >
        {editing && (
          <ConfigForm
            value={editing}
            onChange={setEditing}
            onSave={(c) => {
              // Empty apiKey means "keep stored" → send SENTINEL so backend preserves previous.
              // New configs without any key still surface backend's "apiKey is required" error.
              const payload: Partial<AiConfig> = {
                ...c,
                apiKey: c.apiKey && c.apiKey.length > 0 ? c.apiKey : SENTINEL,
                // Auto-derive name from provider/model — UI no longer asks for it.
                name: c.name && c.name.trim() ? c.name : `${c.provider}/${c.model}`,
              };
              if (saveAs === "global") setGlobal.mutate(payload);
              else addPreset.mutate(payload);
            }}
            saving={setGlobal.isPending || addPreset.isPending}
          />
        )}
      </Modal>
    </Box>
  );
}

function TokensSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["ai", "tokens"],
    queryFn: () => api.get<{ openrouter: { hasToken: boolean; masked: string }; gemini: { hasToken: boolean; masked: string } }>("/api/ai/tokens"),
  });
  const saveM = useMutation({
    mutationFn: (b: { openrouter?: string; gemini?: string }) => api.put<{ ok: true }>("/api/ai/tokens", b),
    onSuccess: () => {
      notifications.show({ message: "Токены сохранены", color: "yellow" });
      qc.invalidateQueries({ queryKey: ["ai", "tokens"] });
      setOr(""); setGem("");
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });
  const [or, setOr] = useState("");
  const [gem, setGem] = useState("");
  const [orTest, setOrTest] = useState<string | null>(null);
  const [gemTest, setGemTest] = useState<string | null>(null);
  async function test(provider: "openrouter" | "gemini", inline?: string) {
    const setter = provider === "openrouter" ? setOrTest : setGemTest;
    setter("…");
    try {
      const r = await fetch("/api/ai/tokens-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, token: inline || undefined }),
      });
      const j = await r.json();
      if (j.ok) {
        setter(`✓ ${j.elapsedMs}ms${j.label ? ` · ${j.label}` : ""}${j.usage ? ` · used $${j.usage}` : ""}`);
      } else {
        setter(`✗ ${j.error ?? "fail"}`);
      }
    } catch (e) {
      setter(`✗ ${(e as Error).message}`);
    }
  }
  return (
    <Box mb="lg" style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 16, background: "var(--bg-1)" }}>
      <Stack gap="md">
        <TokenRow
          provider="OpenRouter"
          link={{ href: "https://openrouter.ai/keys", text: "взять на openrouter.ai/keys" }}
          stored={q.data?.openrouter}
          value={or}
          onChange={setOr}
          onTest={() => test("openrouter", or)}
          testResult={orTest}
        />
        <TokenRow
          provider="Google Gemini"
          link={{ href: "https://aistudio.google.com/apikey", text: "взять в Google AI Studio" }}
          stored={q.data?.gemini}
          value={gem}
          onChange={setGem}
          onTest={() => test("gemini", gem)}
          testResult={gemTest}
        />
        <Group justify="flex-end">
          <Button
            className="btn-primary"
            size="xs"
            leftSection={<IconCheck size={14} />}
            disabled={!or && !gem}
            loading={saveM.isPending}
            onClick={() => saveM.mutate({ openrouter: or || undefined, gemini: gem || undefined })}
          >
            СОХРАНИТЬ ТОКЕНЫ
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}

function TokenRow({
  provider, link, stored, value, onChange, onTest, testResult,
}: {
  provider: string;
  link: { href: string; text: string };
  stored?: { hasToken: boolean; masked: string };
  value: string;
  onChange: (v: string) => void;
  onTest: () => void;
  testResult: string | null;
}) {
  return (
    <Box>
      <Group justify="space-between" mb={6}>
        <Group gap={8}>
          <Text size="xs" fw={500}>{provider}</Text>
          {stored?.hasToken && (
            <Text size="11px" c="var(--green)" className="mono">сохранён · {stored.masked}</Text>
          )}
          {!stored?.hasToken && (
            <Text size="11px" c="var(--amber)" className="mono">не задан</Text>
          )}
        </Group>
        <Anchor href={link.href} target="_blank" size="11px" c="var(--accent)">
          {link.text} <IconExternalLink size={10} />
        </Anchor>
      </Group>
      <Group gap={6} wrap="nowrap">
        <PasswordInput
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder={stored?.hasToken ? "оставь пустым — текущий сохранится" : "вставь новый токен"}
          style={{ flex: 1 }}
        />
        <Button
          variant="default"
          size="sm"
          onClick={onTest}
          disabled={!value && !stored?.hasToken}
        >
          TEST
        </Button>
      </Group>
      {testResult && (
        <Text
          size="11px"
          mt={4}
          className="mono"
          c={testResult.startsWith("✓") ? "var(--green)" : testResult === "…" ? "dimmed" : "var(--red)"}
        >
          {testResult}
        </Text>
      )}
    </Box>
  );
}

function SectionHeader({ num, label, hint, right }: { num: string; label: string; hint: string; right?: React.ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" mb={10} mt="sm">
      <Group gap={10} align="baseline">
        <Text size="11px" c="var(--accent)" className="mono" fw={700}>
          {num}
        </Text>
        <Text size="11px" className="mono" fw={700} style={{ letterSpacing: "0.16em" }}>
          {label}
        </Text>
        <Text size="11px" c="dimmed">— {hint}</Text>
      </Group>
      {right}
    </Group>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack gap={2}>
      <Text size="9px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.14em" }}>{label}</Text>
      <Text size="13px" className={mono ? "mono" : undefined}>{value}</Text>
    </Stack>
  );
}

function ProviderBadge({ p }: { p: string }) {
  const color =
    p === "openrouter" ? "var(--violet)" :
    p === "gemini" ? "var(--green)" :
    p === "openai" ? "var(--accent)" :
    "var(--fg-dim)";
  return (
    <Box
      style={{
        padding: "3px 8px",
        background: "var(--bg-2)",
        border: `1px solid ${color}`,
        color,
        fontSize: 10,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.12em",
        fontWeight: 600,
      }}
    >
      {p.toUpperCase()}
    </Box>
  );
}

function ConfigForm({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: Partial<AiConfig>;
  onChange: (v: Partial<AiConfig>) => void;
  onSave: (v: Partial<AiConfig>) => void;
  saving: boolean;
}) {
  const isOpenRouter = value.provider === "openrouter";
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogQ = useQuery({
    queryKey: ["openrouter", "models"],
    queryFn: () => api.get<{ models: OrModel[] }>("/api/ai/openrouter-catalog"),
    enabled: isOpenRouter,
    staleTime: 24 * 3600 * 1000,
  });

  return (
    <Stack gap="md">
      <Select
        label="Provider"
        value={value.provider}
        data={[
          { value: "openrouter", label: "OpenRouter" },
          { value: "gemini", label: "Google Gemini" },
        ]}
        onChange={(v) => {
          if (!v) return;
          const provider = v as AiProvider;
          onChange({
            ...value,
            provider,
            apiUrl: PROVIDER_DEFAULTS[provider].apiUrl,
          });
        }}
        allowDeselect={false}
      />

      {isOpenRouter && (
        <Box>
          <Text size="xs" mb={4}>Model</Text>
          <Group gap={6} wrap="nowrap">
            <Select
              value={value.model || null}
              onChange={(v) => onChange({ ...value, model: v ?? "" })}
              data={ensureSelectedInGroups(buildOpenRouterGroups(catalogQ.data?.models ?? []), value.model)}
              placeholder={catalogQ.isLoading ? "загружаю каталог…" : "ищи модель"}
              searchable
              limit={500}
              nothingFoundMessage="не найдено"
              styles={{ input: { fontFamily: "var(--font-mono)" } }}
              style={{ flex: 1 }}
            />
            <Button variant="default" size="sm" onClick={() => setCatalogOpen(true)}>
              CATALOG ↗
            </Button>
          </Group>
          <OpenRouterCatalogModal
            opened={catalogOpen}
            onClose={() => setCatalogOpen(false)}
            selected={value.model}
            onSelect={(id) => onChange({ ...value, model: id })}
          />
        </Box>
      )}

      {!isOpenRouter && (
        <TextInput
          label="Model"
          value={value.model ?? ""}
          onChange={(e) => onChange({ ...value, model: e.currentTarget.value })}
          placeholder="название модели"
          styles={{ input: { fontFamily: "var(--font-mono)" } }}
        />
      )}

      {isOpenRouter && (
        <Alert
          color="violet"
          variant="light"
          radius="sm"
          icon={<IconAlertTriangle size={14} />}
          styles={{ root: { background: "var(--violet-soft)", border: "1px solid rgba(167,139,250,0.25)" } }}
        >
          <Text size="xs">
            OpenRouter — один токен, любая модель. Каталог обновляется раз в сутки. Цены в каталоге для справки.
          </Text>
        </Alert>
      )}

      <Group justify="flex-end" mt="sm">
        <Button
          className="btn-primary"
          loading={saving}
          leftSection={<IconCheck size={14} />}
          disabled={!value.provider || !value.apiUrl || !value.model}
          onClick={() => onSave(value)}
        >
          СОХРАНИТЬ
        </Button>
      </Group>
    </Stack>
  );
}

