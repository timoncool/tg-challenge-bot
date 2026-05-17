import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Stack, Group, Text, Button, Skeleton, Textarea, ActionIcon, Alert,
  TextInput, Tabs, Code,
} from "@mantine/core";
import { IconPlus, IconTrash, IconCheck, IconRestore, IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { api } from "@/api/client";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "@/components/PageHeader";

interface Resp {
  defaults: Record<string, unknown>;
  override: Record<string, unknown>;
  effective: Record<string, unknown>;
}

export function MessagesPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["bot-messages"],
    queryFn: () => api.get<Resp>("/api/messages"),
  });
  const [draft, setDraft] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (q.data && !draft) setDraft({ ...q.data.effective });
  }, [q.data, draft]);

  const saveM = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.put("/api/messages", d),
    onSuccess: () => {
      notifications.show({ message: "Сохранено. Бот применит на следующем запросе.", color: "violet" });
      qc.invalidateQueries({ queryKey: ["bot-messages"] });
    },
    onError: (e) => notifications.show({ message: (e as Error).message, color: "red" }),
  });

  const resetM = useMutation({
    mutationFn: () => api.delete("/api/messages"),
    onSuccess: () => {
      notifications.show({ message: "Override сброшен — бот использует дефолты", color: "violet" });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["bot-messages"] });
    },
  });

  if (q.isLoading || !draft) return <Box style={{padding:48}}><Skeleton h={500} /></Box>;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(q.data?.effective);

  function resetField(key: string) {
    setDraft({ ...draft, [key]: (q.data!.defaults as any)[key] });
  }

  return (
    <Box style={{ padding: "40px 48px 120px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        crumb="CONTROL ROOM / 06 / BOT MESSAGES"
        title="Что бот пишет в чате"
        emphasis="в чате"
        subtitle="Все сообщения — реакции на работы, анонсы челленджей, реплики победителю, /help. Если меняешь — сохраняется в KV, бот сразу подхватит. Если очищаешь — бот использует дефолт из кода."
      />

      <Alert color="violet" variant="light" icon={<IconAlertTriangle size={14} />} mb="lg" radius="md">
        <Text size="13px">
          В шаблонах поддерживаются плейсхолдеры в формате <Code>{"{name}"}</Code>: например <Code>{"{username}"}</Code>, <Code>{"{score}"}</Code>, <Code>{"{topic}"}</Code>, <Code>{"{endDate}"}</Code>, <Code>{"{title}"}</Code>, <Code>{"{voteLine}"}</Code>, <Code>{"{phrase}"}</Code>, <Code>{"{dailySched}"}</Code> и т.п. HTML-разметка (<Code>&lt;b&gt;</Code> <Code>&lt;i&gt;</Code>) работает.
        </Text>
      </Alert>

      <Tabs defaultValue="reactions" variant="default" mb="md">
        <Tabs.List>
          <Tabs.Tab value="reactions">Реакции на работу</Tabs.Tab>
          <Tabs.Tab value="winners">Победители</Tabs.Tab>
          <Tabs.Tab value="announcement">Анонс новой темы</Tabs.Tab>
          <Tabs.Tab value="misc">Прочее</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reactions" pt="lg">
          <ArrayEditor
            title="Реакции при принятии работы"
            hint="Бот выбирает случайную при каждом принятии. Кладёт фразу + (текущий/максимум)."
            value={draft.submissionReactions}
            onChange={(v) => setDraft({ ...draft, submissionReactions: v })}
            onReset={() => resetField("submissionReactions")}
          />
        </Tabs.Panel>

        <Tabs.Panel value="winners" pt="lg">
          <Stack gap="md">
            <ArrayEditor
              title="Реплики Mr Challenger при объявлении победителя"
              hint="Случайная подставляется в шаблоны winnerAnnouncementTemplate и winnerAnnouncementFullTemplate."
              value={draft.winnerPhrases}
              onChange={(v) => setDraft({ ...draft, winnerPhrases: v })}
              onReset={() => resetField("winnerPhrases")}
            />
            <TemplateField
              title="Шаблон объявления победителя (в треде челленджа)"
              hint="Плейсхолдеры: {username}, {score}, {phrase}"
              value={draft.winnerAnnouncementTemplate}
              onChange={(v) => setDraft({ ...draft, winnerAnnouncementTemplate: v })}
              onReset={() => resetField("winnerAnnouncementTemplate")}
            />
            <TemplateField
              title="Шаблон объявления победителя (в треде «Победители»)"
              hint="Плейсхолдеры: {username}, {score}, {topic}, {phrase}"
              value={draft.winnerAnnouncementFullTemplate}
              onChange={(v) => setDraft({ ...draft, winnerAnnouncementFullTemplate: v })}
              onReset={() => resetField("winnerAnnouncementFullTemplate")}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="announcement" pt="lg">
          <Stack gap="md">
            <TemplateField
              title="Шаблон анонса новой темы"
              hint="Бот публикует после закрытия poll или при /run_*. Плейсхолдеры: {title}, {voteLine}, {topic}, {endDate}"
              value={draft.challengeAnnouncementTemplate}
              onChange={(v) => setDraft({ ...draft, challengeAnnouncementTemplate: v })}
              onReset={() => resetField("challengeAnnouncementTemplate")}
            />

            <Box className="glass" style={{padding: 20}}>
              <Text fw={600} mb={6} size="13px">Заголовки в анонсе по типам</Text>
              {(["daily","weekly","monthly"] as const).map((k) => (
                <Group key={k} gap="sm" align="center" mt={6}>
                  <Code style={{minWidth: 80}}>{k}</Code>
                  <TextInput
                    value={draft.challengeAnnouncementTitles?.[k] ?? ""}
                    onChange={(e) => setDraft({
                      ...draft,
                      challengeAnnouncementTitles: { ...draft.challengeAnnouncementTitles, [k]: e.currentTarget.value }
                    })}
                    style={{flex:1}}
                  />
                </Group>
              ))}
            </Box>

            <TemplateField
              title="Вопрос в poll"
              hint="Заголовок голосования"
              value={draft.pollQuestion}
              onChange={(v) => setDraft({ ...draft, pollQuestion: v })}
              onReset={() => resetField("pollQuestion")}
              minRows={1}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="misc" pt="lg">
          <Stack gap="md">
            <TemplateField
              title="Когда никто не прислал работ"
              hint="Шлётся при finish если submissions=0"
              value={draft.noSubmissions}
              onChange={(v) => setDraft({ ...draft, noSubmissions: v })}
              onReset={() => resetField("noSubmissions")}
              minRows={2}
            />
            <TemplateField
              title="Лимит работ достигнут"
              hint="Плейсхолдеры: {current}, {max}, {workWord}, {maxWord}"
              value={draft.submissionLimitReached}
              onChange={(v) => setDraft({ ...draft, submissionLimitReached: v })}
              onReset={() => resetField("submissionLimitReached")}
              minRows={2}
            />
            <TemplateField
              title="Заголовок лидерборда"
              hint="Плейсхолдер: {label} (по дням/за неделю/за месяц)"
              value={draft.leaderboardTitle}
              onChange={(v) => setDraft({ ...draft, leaderboardTitle: v })}
              onReset={() => resetField("leaderboardTitle")}
              minRows={1}
            />
            <TemplateField
              title="/help сообщение"
              hint="Плейсхолдеры: {dailySched}, {weeklySched}, {monthlySched}"
              value={draft.helpMessage}
              onChange={(v) => setDraft({ ...draft, helpMessage: v })}
              onReset={() => resetField("helpMessage")}
              minRows={10}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Sticky bar */}
      {(isDirty || true) && (
        <Box style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15,15,22,0.92)",
          backdropFilter: "blur(28px)",
          border: "1px solid var(--border-bright)",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.6)",
          zIndex: 50,
        }}>
          {isDirty && <span className="dot violet" />}
          <Text size="13px">{isDirty ? "Есть несохранённые изменения" : "Всё сохранено"}</Text>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconRestore size={12} />}
            onClick={() => { if (confirm("Сбросить override — бот вернётся к дефолтам?")) resetM.mutate(); }}
            loading={resetM.isPending}
          >
            Reset к дефолтам
          </Button>
          <Button
            size="xs"
            className="btn-primary"
            leftSection={<IconCheck size={14} />}
            loading={saveM.isPending}
            disabled={!isDirty}
            onClick={() => saveM.mutate(draft)}
          >
            Сохранить
          </Button>
        </Box>
      )}
    </Box>
  );
}

function ArrayEditor({ title, hint, value, onChange, onReset }: {
  title: string; hint: string; value: string[]; onChange: (v: string[]) => void; onReset: () => void;
}) {
  return (
    <Box className="glass" style={{ padding: 20 }}>
      <Group justify="space-between" mb={6}>
        <Stack gap={2}>
          <Text fw={600} size="14px">{title}</Text>
          <Text size="11px" c="dimmed">{hint}</Text>
        </Stack>
        <Group gap={6}>
          <Button size="compact-xs" variant="default" leftSection={<IconRefresh size={12} />} onClick={onReset}>
            Default
          </Button>
          <Button size="compact-xs" variant="default" leftSection={<IconPlus size={12} />}
            onClick={() => onChange([...(value || []), ""])}
          >
            Добавить
          </Button>
        </Group>
      </Group>
      <Stack gap={4} mt="sm">
        {(value || []).map((line, i) => (
          <Group key={i} gap={6} wrap="nowrap" align="flex-start">
            <Text size="11px" c="var(--fg-faint)" className="mono tnum" w={22} style={{paddingTop:8}}>
              {String(i+1).padStart(2,"0")}
            </Text>
            <Textarea
              value={line}
              onChange={(e) => { const next = [...value]; next[i] = e.currentTarget.value; onChange(next); }}
              autosize
              minRows={1}
              style={{flex:1}}
              styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12 } }}
            />
            <ActionIcon variant="subtle" color="red" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}

function TemplateField({ title, hint, value, onChange, onReset, minRows = 4 }: {
  title: string; hint: string; value: string; onChange: (v: string) => void; onReset: () => void; minRows?: number;
}) {
  return (
    <Box className="glass" style={{ padding: 20 }}>
      <Group justify="space-between" mb={6}>
        <Stack gap={2}>
          <Text fw={600} size="14px">{title}</Text>
          <Text size="11px" c="dimmed">{hint}</Text>
        </Stack>
        <Button size="compact-xs" variant="default" leftSection={<IconRefresh size={12} />} onClick={onReset}>
          Default
        </Button>
      </Group>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        autosize
        minRows={minRows}
        styles={{ input: { fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 } }}
        mt="sm"
      />
    </Box>
  );
}
