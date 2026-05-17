// Group + label OpenRouter models for Mantine Select dropdown.
// Backend (functions/api/ai/openrouter-catalog.ts) gives us normalized
// prompt_price / completion_price in $/1M tokens already.
//
// Tiers chosen by typical mental model rather than provider:
//   🚀 Frontier — premium ($5+/1M prompt). Claude Opus, GPT-5, Gemini 2.5 Pro, o3, etc.
//   💼 Standard — production-grade paid ($0.1 – $5)
//   💸 Budget   — cheap paid (< $0.1)
//   🆓 Free     — both prompt & completion priced at 0

export interface OrModel {
  id: string;
  name?: string;
  group?: string;
  prompt_price?: number | null;
  completion_price?: number | null;
  context_length?: number | null;
  free?: boolean;
}

export interface GroupedItem {
  group: string;
  items: { value: string; label: string }[];
}

function fmtPrice(p: number | null | undefined): string {
  if (p == null) return "?";
  if (p === 0) return "0";
  if (p < 0.01) return p.toFixed(3);
  if (p < 1) return p.toFixed(2);
  if (p < 10) return p.toFixed(1);
  return Math.round(p).toString();
}

function fmtCtx(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function buildLabel(m: OrModel): string {
  const ctx = fmtCtx(m.context_length);
  if (m.free) return ctx ? `${m.id}   · ${ctx}` : m.id;
  const p = fmtPrice(m.prompt_price);
  const c = fmtPrice(m.completion_price);
  return ctx ? `${m.id}   · $${p}/$${c}/M · ${ctx}` : `${m.id}   · $${p}/$${c}/M`;
}

function tier(m: OrModel): "frontier" | "standard" | "budget" | "free" {
  if (m.free) return "free";
  const p = m.prompt_price ?? 0;
  if (p >= 5) return "frontier";
  if (p >= 0.1) return "standard";
  return "budget";
}

export function buildOpenRouterGroups(models: OrModel[]): GroupedItem[] {
  const groups: Record<string, OrModel[]> = { frontier: [], standard: [], budget: [], free: [] };
  for (const m of models) groups[tier(m)].push(m);

  // Inside each tier: paid sorted by prompt price desc (premium first),
  // free sorted alphabetically (price is identical zero).
  const cmpPaid = (a: OrModel, b: OrModel) => (b.prompt_price ?? 0) - (a.prompt_price ?? 0) || a.id.localeCompare(b.id);
  const cmpFree = (a: OrModel, b: OrModel) => a.id.localeCompare(b.id);
  groups.frontier.sort(cmpPaid);
  groups.standard.sort(cmpPaid);
  groups.budget.sort(cmpPaid);
  groups.free.sort(cmpFree);

  const out: GroupedItem[] = [];
  if (groups.frontier.length) out.push({ group: `🚀 Frontier · ${groups.frontier.length}`, items: groups.frontier.map((m) => ({ value: m.id, label: buildLabel(m) })) });
  if (groups.standard.length) out.push({ group: `💼 Standard · ${groups.standard.length}`, items: groups.standard.map((m) => ({ value: m.id, label: buildLabel(m) })) });
  if (groups.budget.length)   out.push({ group: `💸 Budget · ${groups.budget.length}`,   items: groups.budget.map((m)   => ({ value: m.id, label: buildLabel(m) })) });
  if (groups.free.length)     out.push({ group: `🆓 Free · ${groups.free.length}`,       items: groups.free.map((m)     => ({ value: m.id, label: buildLabel(m) })) });
  return out;
}

// Ensures currently-selected model id is present even if catalog hasn't loaded
// or the model was removed from OpenRouter.
export function ensureSelectedInGroups(groups: GroupedItem[], modelId: string | null | undefined): GroupedItem[] {
  if (!modelId) return groups;
  const has = groups.some((g) => g.items.some((i) => i.value === modelId));
  if (has) return groups;
  return [{ group: "⌫ Текущая", items: [{ value: modelId, label: modelId }] }, ...groups];
}
