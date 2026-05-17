import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Group,
  Text,
  Button,
  Tabs,
  Textarea,
  TagsInput,
  Alert,
  Skeleton,
  Code,
  Modal,
} from "@mantine/core";
import {
  IconCheck,
  IconAlertTriangle,
  IconRestore,
  IconEye,
  IconCopy,
  IconClipboard,
} from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";

interface ModeBlock {
  instruction: string;
  corpus: string[];
}

interface PromptsConfig {
  template: string;
  modes: { vanilla: ModeBlock; medium: ModeBlock; nsfw: ModeBlock };
}

const MODE_META = {
  vanilla: { color: "var(--green)",  emoji: "🍦", label: "VANILLA" },
  medium:  { color: "var(--accent)", emoji: "🔥", label: "MEDIUM" },
  nsfw:    { color: "var(--red)",    emoji: "🌙", label: "NSFW" },
} as const;

export function PromptsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"vanilla" | "medium" | "nsfw" | "template">("vanilla");
  const [draft, setDraft] = useState<PromptsConfig | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const promptsQ = useQuery({
    queryKey: ["ai", "prompts"],
    queryFn: () => api.get<{ source: "kv" | "default"; prompts: PromptsConfig }>("/api/ai/prompts"),
  });

  useEffect(() => {
    if (promptsQ.data && !draft) setDraft(promptsQ.data.prompts);
  }, [promptsQ.data, draft]);

  const saveM = useMutation({
    mutationFn: (cfg: PromptsConfig) => api.put<{ ok: true }>("/api/ai/prompts", cfg),
    onSuccess: () => {
      notifications.show({ message: "Промпты сохранены", color: "yellow" });
      qc.invalidateQueries({ queryKey: ["ai", "prompts"] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const resetM = useMutation({
    mutationFn: () => api.delete<{ ok: true }>("/api/ai/prompts"),
    onSuccess: () => {
      notifications.show({ message: "Сброшено на дефолты", color: "yellow" });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["ai", "prompts"] });
    },
  });

  if (promptsQ.isLoading || !draft) {
    return (
      <Box style={{ padding: 40 }}>
        <Skeleton h={400} />
      </Box>
    );
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(promptsQ.data?.prompts);

  function previewRendered() {
    const mode = tab === "template" ? "vanilla" : tab;
    const m = draft!.modes[mode];
    const sample = m.corpus.slice().sort(() => Math.random() - 0.5).slice(0, 20);
    const rendered = draft!.template
      .replace(/\{TYPE\}/g, "ДНЕВНОГО")
      .replace(/\{MODE\}/g, mode.toUpperCase())
      .replace(/\{INSTRUCTION\}/g, m.instruction)
      .replace(/\{SAMPLE\}/g, sample.join(", "))
      .replace(/\{HISTORY\}/g, "");
    setPreviewSrc(rendered);
  }

  return (
    <Box style={{ padding: "32px 40px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap={4} mb="lg">
        <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.18em" }}>
          CONTROL ROOM / 04 / PROMPTS & CORPUS
        </Text>
        <Text style={{ fontFamily: "var(--font-serif)", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}>
          Что AI видит <em style={{ color: "var(--accent)" }}>в голове</em>.
        </Text>
        <Text size="sm" c="dimmed" mt={6}>
          Инструкции для каждого режима, корпус референсов (20 случайных идёт в промпт), шаблон сборки.
          Источник: <Code style={{ background: "var(--bg-2)" }}>{promptsQ.data?.source}</Code>
        </Text>
      </Stack>

      <Tabs value={tab} onChange={(v) => v && setTab(v as any)} variant="default" mb="md">
        <Tabs.List>
          {(["vanilla", "medium", "nsfw"] as const).map((m) => (
            <Tabs.Tab
              key={m}
              value={m}
              leftSection={<span>{MODE_META[m].emoji}</span>}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.12em",
                fontWeight: 600,
                color: tab === m ? MODE_META[m].color : undefined,
              }}
            >
              {MODE_META[m].label}
              <Text component="span" size="10px" c="dimmed" ml={6}>
                {draft.modes[m].corpus.length}
              </Text>
            </Tabs.Tab>
          ))}
          <Tabs.Tab
            value="template"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 600,
              marginLeft: "auto",
            }}
          >
            TEMPLATE
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* MODE TAB */}
      {(tab === "vanilla" || tab === "medium" || tab === "nsfw") && (
        <Stack gap="lg">
          <Box>
            <SectionLabel num="01" label="INSTRUCTION" hint="вставится в {INSTRUCTION} шаблона" />
            <Textarea
              value={draft.modes[tab].instruction}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  modes: {
                    ...draft.modes,
                    [tab]: { ...draft.modes[tab], instruction: e.currentTarget.value },
                  },
                })
              }
              minRows={4}
              autosize
              styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 } }}
            />
          </Box>

          <Box>
            <Group justify="space-between" align="baseline" mb={8}>
              <SectionLabel
                num="02"
                label="CORPUS"
                hint={`${draft.modes[tab].corpus.length} референсов · 20 случайных идут в каждый запрос`}
                noMargin
              />
              <Group gap={6}>
                <Button
                  variant="default"
                  size="compact-xs"
                  leftSection={<IconCopy size={12} />}
                  onClick={async () => {
                    const text = draft.modes[tab as "vanilla" | "medium" | "nsfw"].corpus.join("\n");
                    try {
                      await navigator.clipboard.writeText(text);
                      notifications.show({ message: `Скопировано ${draft.modes[tab as "vanilla" | "medium" | "nsfw"].corpus.length} строк`, color: "yellow" });
                    } catch {
                      notifications.show({ message: "Clipboard недоступен — открой BULK EDIT и скопируй вручную", color: "red" });
                    }
                  }}
                >
                  COPY ALL
                </Button>
                <Button
                  variant="default"
                  size="compact-xs"
                  leftSection={<IconClipboard size={12} />}
                  onClick={() => {
                    setBulkText(draft.modes[tab as "vanilla" | "medium" | "nsfw"].corpus.join("\n"));
                    setBulkOpen(true);
                  }}
                >
                  BULK EDIT
                </Button>
              </Group>
            </Group>
            <TagsInput
              value={draft.modes[tab].corpus}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  modes: { ...draft.modes, [tab]: { ...draft.modes[tab], corpus: v } },
                })
              }
              placeholder="добавь референс и Enter"
              clearable
              splitChars={[",", "\n", "\t"]}
              styles={{
                input: { minHeight: 200, alignContent: "flex-start", padding: 8 },
                pill: { fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg-2)", color: "var(--fg)" },
              }}
            />
          </Box>
        </Stack>
      )}

      {/* TEMPLATE TAB */}
      {tab === "template" && (
        <Stack gap="md">
          <Alert color="yellow" variant="light" radius="sm" icon={<IconAlertTriangle size={14} />}>
            <Text size="xs">
              Доступные плейсхолдеры:{" "}
              <Code style={{ background: "var(--bg-2)" }}>{"{TYPE}"}</Code>{" "}
              <Code style={{ background: "var(--bg-2)" }}>{"{MODE}"}</Code>{" "}
              <Code style={{ background: "var(--bg-2)" }}>{"{INSTRUCTION}"}</Code>{" "}
              <Code style={{ background: "var(--bg-2)" }}>{"{SAMPLE}"}</Code>{" "}
              <Code style={{ background: "var(--bg-2)" }}>{"{HISTORY}"}</Code>
            </Text>
          </Alert>
          <Textarea
            value={draft.template}
            onChange={(e) => setDraft({ ...draft, template: e.currentTarget.value })}
            minRows={20}
            autosize
            styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 } }}
          />
        </Stack>
      )}

      {/* ACTIONS */}
      <Group justify="space-between" mt="xl" pt="md" style={{ borderTop: "1px solid var(--border)" }}>
        <Group gap={6}>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconRestore size={14} />}
            onClick={() => resetM.mutate()}
            loading={resetM.isPending}
          >
            RESET TO DEFAULT
          </Button>
        </Group>
        <Group gap={6}>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconEye size={14} />}
            onClick={previewRendered}
          >
            PREVIEW RENDERED
          </Button>
          <Button
            className="btn-primary"
            size="xs"
            leftSection={<IconCheck size={14} />}
            onClick={() => draft && saveM.mutate(draft)}
            loading={saveM.isPending}
            disabled={!isDirty}
          >
            SAVE {isDirty && <span style={{ marginLeft: 6, color: "var(--bg)" }}>●</span>}
          </Button>
        </Group>
      </Group>

      <Modal
        opened={bulkOpen}
        onClose={() => setBulkOpen(false)}
        size="xl"
        title={
          <Text fw={600} className="mono" style={{ letterSpacing: "0.06em" }}>
            BULK EDIT CORPUS — {tab === "template" ? "" : tab.toUpperCase()}
          </Text>
        }
        radius="sm"
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Одна строка = один референс. Пустые строки и дубликаты убираются автоматически.
            После «APPLY» нажми SAVE на странице чтобы залить в KV.
          </Text>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.currentTarget.value)}
            autosize
            minRows={20}
            maxRows={30}
            styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 } }}
          />
          <Group justify="space-between">
            <Text size="11px" c="dimmed" className="mono">
              {bulkText.split("\n").map((s) => s.trim()).filter(Boolean).length} непустых строк
            </Text>
            <Group gap={6}>
              <Button variant="default" size="xs" onClick={() => setBulkOpen(false)}>
                Отмена
              </Button>
              <Button
                className="btn-primary"
                size="xs"
                leftSection={<IconCheck size={14} />}
                onClick={() => {
                  if (tab === "template" || !draft) return;
                  const list = Array.from(new Set(
                    bulkText.split("\n").map((s) => s.trim()).filter(Boolean)
                  ));
                  setDraft({
                    ...draft,
                    modes: { ...draft.modes, [tab]: { ...draft.modes[tab], corpus: list } },
                  });
                  setBulkOpen(false);
                  notifications.show({ message: `Applied ${list.length} строк (не забудь SAVE)`, color: "yellow" });
                }}
              >
                APPLY
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={previewSrc !== null}
        onClose={() => setPreviewSrc(null)}
        size="xl"
        title={
          <Text fw={600} className="mono" style={{ letterSpacing: "0.06em" }}>
            RENDERED PROMPT — {tab === "template" ? "VANILLA SAMPLE" : tab.toUpperCase()}
          </Text>
        }
        radius="sm"
      >
        <Box
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            padding: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            maxHeight: "70vh",
            overflow: "auto",
          }}
        >
          {previewSrc}
        </Box>
      </Modal>
    </Box>
  );
}

function SectionLabel({ num, label, hint, noMargin }: { num: string; label: string; hint: string; noMargin?: boolean }) {
  return (
    <Group gap={10} align="baseline" mb={noMargin ? 0 : 8}>
      <Text size="11px" c="var(--accent)" className="mono" fw={700}>{num}</Text>
      <Text size="11px" className="mono" fw={700} style={{ letterSpacing: "0.16em" }}>{label}</Text>
      <Text size="11px" c="dimmed">— {hint}</Text>
    </Group>
  );
}
