import { useState } from "react";
import {
  Box,
  PasswordInput,
  Button,
  Stack,
  Text,
  Group,
  Alert,
} from "@mantine/core";
import { IconAlertTriangle, IconArrowRight } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/api/client";

export function LoginPage() {
  const { login } = useAuth();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await login(secret.trim());
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 401 ? "ADMIN_SECRET не совпадает" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Box style={{ width: 420, maxWidth: "100%" }}>
        {/* Brand */}
        <Group gap={12} mb="xl" align="flex-start">
          <div
            style={{
              width: 36,
              height: 36,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 3,
              marginTop: 4,
            }}
          >
            <div style={{ background: "var(--accent)" }} />
            <div style={{ background: "var(--fg-mute)" }} />
            <div style={{ background: "var(--fg-mute)" }} />
            <div style={{ background: "var(--accent)" }} />
          </div>
          <Stack gap={0}>
            <Text
              fw={700}
              size="lg"
              style={{ letterSpacing: "0.04em", lineHeight: 1.1 }}
            >
              CHALLENGER
            </Text>
            <Text
              size="11px"
              c="dimmed"
              className="mono"
              style={{ letterSpacing: "0.16em" }}
            >
              CONTROL ROOM / 01 / SIGN IN
            </Text>
          </Stack>
        </Group>

        <Text
          fw={500}
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          Один секрет, <em style={{ color: "var(--accent)" }}>один доступ</em>.
        </Text>
        <Text c="dimmed" size="sm" mb="xl">
          ADMIN_SECRET бота — он же ключ к этой админке. Сессия живёт 7 дней.
        </Text>

        {err && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertTriangle size={14} />}
            mb="md"
            radius="sm"
            styles={{ root: { background: "var(--red-soft)", border: "1px solid rgba(248,113,113,0.25)" } }}
          >
            {err}
          </Alert>
        )}

        <Stack gap="sm">
          <PasswordInput
            placeholder="••••••••••••••••••••••••"
            value={secret}
            onChange={(e) => setSecret(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && secret.trim() && !busy) void submit();
            }}
            autoFocus
            size="md"
            styles={{ input: { fontSize: 14 } }}
          />

          <Button
            fullWidth
            size="md"
            loading={busy}
            disabled={!secret.trim()}
            onClick={() => void submit()}
            rightSection={<IconArrowRight size={16} />}
            className="btn-primary"
          >
            ВОЙТИ
          </Button>
        </Stack>

        <Group justify="space-between" mt="xl">
          <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.12em" }}>
            HTTPS · HMAC · HTTPONLY
          </Text>
          <Text size="10px" c="var(--fg-faint)" className="mono" style={{ letterSpacing: "0.12em" }}>
            v{__APP_VERSION__}
          </Text>
        </Group>
      </Box>
    </Box>
  );
}
