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
  const then = new Date(at).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minuto" : "minuti"} fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    const day = new Date(then);
    return `ieri alle ${day.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} ${weeks === 1 ? "settimana" : "settimane"} fa`;
  return new Date(then).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
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
