import type { GoogleAuthConfig } from "./auth-client";

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        callback(response: { credential?: string }): void;
        context?: "signin" | "signup" | "use";
        ux_mode?: "popup";
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with";
          shape: "rectangular";
          logo_alignment: "left";
          width: number;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

let googleLoading: Promise<void> | null = null;

function loadGoogleIdentity(): Promise<void> {
  if (window.google !== undefined) return Promise.resolve();
  if (googleLoading !== null) return googleLoading;
  googleLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing !== null) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("google identity unavailable")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("google identity unavailable")), { once: true });
    document.head.append(script);
  });
  return googleLoading;
}

export async function renderGoogleIdentityButton(
  parent: HTMLElement,
  config: GoogleAuthConfig,
  onCredential: (credential: string) => void,
): Promise<boolean> {
  try {
    await loadGoogleIdentity();
  } catch {
    return false;
  }
  if (window.google === undefined) return false;
  parent.replaceChildren();
  window.google.accounts.id.initialize({
    client_id: config.clientId,
    nonce: config.nonce,
    context: "use",
    ux_mode: "popup",
    callback: (response) => onCredential(response.credential ?? ""),
  });
  window.google.accounts.id.renderButton(parent, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.max(240, Math.min(400, Math.floor(parent.getBoundingClientRect().width || 320))),
  });
  return true;
}
