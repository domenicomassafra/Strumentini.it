import type { ComponentChildren } from "preact";

export interface ToolSurfaceProps {
  /** Form, controls, and the primary action. */
  children: ComponentChildren;
  /** The gutter. Pass the `aside` here and the column keeps its fixed x-offset. */
  gutter: ComponentChildren;
  className?: string;
}

/**
 * The two-column tool frame: inputs on the left, the running gutter on the
 * right at a fixed width. Every tool surface uses this, which is what makes
 * the gutter land at the same x-offset on all 200 tools.
 */
export function ToolSurface({ children, gutter, className = "" }: ToolSurfaceProps) {
  const classes = ["tool-surface", className].filter(Boolean).join(" ");
  return (
    <div class={classes}>
      <div class="tool-surface-main">{children}</div>
      {gutter}
    </div>
  );
}
