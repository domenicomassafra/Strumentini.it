/** Rendering helpers for the favourites page; HTML content is escaped at its source. */
export interface IndexedTool {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly route: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly tone: number;
}

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/gu, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character] ?? character);

export function relative(at: string): string {
  const date = new Date(at);
  const then = date.getTime();
  if (!Number.isFinite(then)) return "";
  const now = Date.now();
  if (then > now) {
    const remaining = then - now;
    if (remaining < 60_000) return "tra meno di un minuto";
    const minutes = Math.ceil(remaining / 60_000);
    if (minutes < 60) return `tra ${minutes} ${minutes === 1 ? "minuto" : "minuti"}`;
    const hours = Math.ceil(remaining / 3_600_000);
    if (hours < 24) return `tra ${hours} ${hours === 1 ? "ora" : "ore"}`;
    const days = Math.ceil(remaining / 86_400_000);
    return `tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
  }

  // Calendar days in local time, unaffected by daylight-saving transitions.
  const calendarDay = (value: Date): number => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86_400_000;
  const days = calendarDay(new Date(now)) - calendarDay(date);
  if (days === 1) return `ieri alle ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  if (days > 1) {
    if (days < 7) return `${days} giorni fa`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks} ${weeks === 1 ? "settimana" : "settimane"} fa`;
    return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }

  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minuti"} fa`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
}

export function card(tool: IndexedTool, action: string, extra = "", reason = "", removable = false): string {
  return `<li class="tool-card" style="--tile-tone: var(--tone-${tool.tone})">`
    + `<div class="tool-card-top"><h3 class="tool-card-name"><a href="${escapeHtml(tool.route)}">${escapeHtml(tool.name)}</a></h3>${extra}</div>`
    + `<p class="tool-card-summary">${escapeHtml(tool.summary)}</p>`
    + (reason === "" ? "" : `<p class="area-suggestion-why">${escapeHtml(reason)}</p>`)
    + `<div class="tool-card-foot"><span class="tool-card-category">${escapeHtml(tool.categoryLabel)}</span>`
    + (removable ? `<button class="area-action" type="button" data-membership-toggle="${escapeHtml(tool.id)}" data-installed="true" aria-pressed="true" aria-label="Rimuovi dai tuoi strumenti">Rimuovi</button>` : "")
    + `<a class="area-action" href="${escapeHtml(tool.route)}">${escapeHtml(action)} <span aria-hidden="true">→</span></a></div></li>`;
}
