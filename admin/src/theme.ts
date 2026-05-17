import { createTheme, MantineColorsTuple, rem } from "@mantine/core";

// Electric violet brand (Linear-ish)
const violet: MantineColorsTuple = [
  "#f5f3ff",
  "#ede9fe",
  "#ddd6fe",
  "#c4b5fd",
  "#a78bfa",
  "#8b5cf6",
  "#7c3aed",
  "#6d28d9",
  "#5b21b6",
  "#4c1d95",
];

export const theme = createTheme({
  primaryColor: "violet",
  primaryShade: 5,
  colors: { violet },
  defaultRadius: "md",
  fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  fontFamilyMonospace: '"Geist Mono", "JetBrains Mono", "SF Mono", Menlo, monospace',
  headings: {
    fontFamily: 'Geist, -apple-system, sans-serif',
    fontWeight: "600",
    sizes: {
      h1: { fontSize: rem(28), lineHeight: "1.15" },
      h2: { fontSize: rem(20), lineHeight: "1.2" },
      h3: { fontSize: rem(16), lineHeight: "1.3" },
    },
  },
  components: {
    Button:        { defaultProps: { size: "sm", radius: "md" } },
    TextInput:     { defaultProps: { size: "sm", radius: "md" } },
    PasswordInput: { defaultProps: { size: "sm", radius: "md" } },
    Select:        { defaultProps: { size: "sm", radius: "md" } },
    Modal:         { defaultProps: { centered: true, radius: "lg" } },
    Card:          { defaultProps: { radius: "lg", withBorder: true, padding: "xl" } },
  },
});
