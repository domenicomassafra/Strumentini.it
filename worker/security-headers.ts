import securityHeaderPolicy from "../public/_headers";

// Cloudflare applies public/_headers to assets, but not Worker-generated API responses.
const SECURITY_HEADERS = new Headers();
for (const line of securityHeaderPolicy.split("\n")) {
  const header = /^\s+([^:]+):\s*(.+)$/u.exec(line);
  if (header !== null) SECURITY_HEADERS.set(header[1]!, header[2]!);
}

export function secureApiResponse(response: Response): Response {
  for (const [name, value] of SECURITY_HEADERS) response.headers.set(name, value);
  return response;
}
