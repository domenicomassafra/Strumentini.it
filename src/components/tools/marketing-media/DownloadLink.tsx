import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

export interface DownloadLinkProps {
  readonly blob: Blob;
  readonly filename: string;
  readonly className?: string;
  readonly children: ComponentChildren;
}

/**
 * A real download link over an object URL, so the produced file can be saved,
 * opened, or middle-clicked like any other download in the product. The URL is
 * revoked as soon as the component goes away, and the blob never leaves the
 * device.
 */
export function DownloadLink({ blob, filename, className = "button primary", children }: DownloadLinkProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!(blob instanceof Blob) || blob.size === 0) return;
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  if (url === "") return <p role="status" class="file-note">Preparazione del file locale…</p>;
  return <a class={className} href={url} download={filename}>{children}</a>;
}