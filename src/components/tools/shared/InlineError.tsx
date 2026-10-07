import type { ComponentChildren } from "preact";

export interface InlineErrorProps {
  message?: string | null;
  children?: ComponentChildren;
}

export function InlineError({ message, children }: InlineErrorProps) {
  const content = message ?? children;
  if (content === null || content === undefined || content === "") return null;
  return <p class="error" role="alert" tabIndex={-1} data-tool-error>{content}</p>;
}
