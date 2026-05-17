import { ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Stack,
  Group,
  Text,
  UnstyledButton,
  ActionIcon,
  Tooltip,
  Box,
} from "@mantine/core";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconRobot,
  IconFlask2,
  IconBrain,
  IconDatabase,
  IconLogout,
  IconClock,
  IconAlertTriangle,
  IconChartBar,
  IconMessage,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "./BrandMark";

interface Props {
  children: ReactNode;
}

const NAV = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard },
  { to: "/triggers", label: "Триггеры", icon: IconClock },
  { to: "/ai-settings", label: "AI Engine", icon: IconRobot },
  { to: "/ai-test", label: "AI Test", icon: IconFlask2 },
  { to: "/stats", label: "AI Stats", icon: IconChartBar },
  { to: "/prompts", label: "Промпты", icon: IconBrain },
  { to: "/messages", label: "Сообщения бота", icon: IconMessage },
  { to: "/alerts", label: "Алерты", icon: IconAlertTriangle },
  { to: "/audit", label: "Audit", icon: IconShieldCheck },
  { to: "/kv", label: "KV Explorer", icon: IconDatabase },
];

export function AppShell({ children }: Props) {
  const nav = useNavigate();
  const loc = useLocation();
  const { logout } = useAuth();

  return (
    <MantineAppShell navbar={{ width: 240, breakpoint: "sm" }} padding={0}>
      <MantineAppShell.Navbar p={0}>
        <Stack justify="space-between" h="100%" gap={0}>
          <div>
            {/* Brand */}
            <Group p="md" gap={12} align="center">
              <BrandMark size={34} />
              <Stack gap={0}>
                <Text
                  fw={700}
                  size="sm"
                  style={{
                    letterSpacing: "-0.015em",
                    lineHeight: 1.05,
                    background: "linear-gradient(95deg, #fff 0%, #c7b7ff 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Challenger
                </Text>
                <Text
                  size="9px"
                  c="var(--fg-faint)"
                  className="mono"
                  style={{ letterSpacing: "0.18em", lineHeight: 1.4 }}
                >
                  CONTROL ROOM
                </Text>
              </Stack>
            </Group>

            {/* Nav */}
            <Stack gap={2} px="xs" pt="sm">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active =
                  loc.pathname === item.to ||
                  (item.to !== "/" && loc.pathname.startsWith(item.to));
                return (
                  <UnstyledButton
                    key={item.to}
                    onClick={() => nav(item.to)}
                    style={{
                      display: "block",
                      padding: "9px 12px",
                      borderRadius: 8,
                      background: active ? "var(--accent-soft)" : "transparent",
                      transition: "background 0.15s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-1)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    {active && (
                      <Box
                        style={{
                          position: "absolute",
                          left: -8,
                          top: "30%",
                          bottom: "30%",
                          width: 3,
                          background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-bright) 100%)",
                          borderRadius: 2,
                          boxShadow: "0 0 12px var(--accent-glow)",
                        }}
                      />
                    )}
                    <Group gap={10} wrap="nowrap">
                      <Icon
                        size={16}
                        stroke={1.7}
                        color={active ? "var(--accent-bright)" : "var(--fg-dim)"}
                      />
                      <Text
                        size="13px"
                        fw={active ? 500 : 400}
                        c={active ? "var(--fg)" : "var(--fg-dim)"}
                      >
                        {item.label}
                      </Text>
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </div>

          {/* Footer */}
          <Box>
            <div className="hair" />
            <Group justify="space-between" p="md" gap="xs">
              <Group gap={6}>
                <span className="dot green" />
                <Text size="11px" c="dimmed">live · v{__APP_VERSION__}</Text>
              </Group>
              <Tooltip label="Sign out" position="right" withArrow>
                <ActionIcon
                  variant="default"
                  size="md"
                  radius="md"
                  onClick={() => void logout()}
                  style={{ border: "1px solid var(--border)", background: "var(--bg-1)" }}
                >
                  <IconLogout size={14} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        </Stack>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
