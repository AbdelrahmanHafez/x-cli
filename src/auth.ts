import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AuthConfig {
  authToken: string;
  csrfToken: string;
}

const CONFIG_DIR = join(homedir(), ".config", "x-cli");
const COOKIES_FILE = join(CONFIG_DIR, "cookies.txt");

export async function getAuth(): Promise<AuthConfig> {
  if (!existsSync(COOKIES_FILE)) {
    throw new Error(
      `Cookie file not found at ${COOKIES_FILE}\n\n` +
        "To authenticate, create this file with your X cookies:\n" +
        "  mkdir -p ~/.config/x-cli\n" +
        "  echo \"auth_token=YOUR_AUTH_TOKEN\" > ~/.config/x-cli/cookies.txt\n" +
        "  echo \"ct0=YOUR_CT0_TOKEN\" >> ~/.config/x-cli/cookies.txt\n\n" +
        "To get these values:\n" +
        "  1. Open x.com in your browser\n" +
        "  2. Open DevTools > Application > Cookies\n" +
        "  3. Copy the values for \"auth_token\" and \"ct0\""
    );
  }

  const content = await readFile(COOKIES_FILE, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const cookies: Record<string, string> = {};
  for (const line of lines) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      cookies[key.trim()] = valueParts.join("=").trim();
    }
  }

  if (!cookies.auth_token) {
    throw new Error(`Missing "auth_token" in ${COOKIES_FILE}`);
  }
  if (!cookies.ct0) {
    throw new Error(`Missing "ct0" in ${COOKIES_FILE}`);
  }

  return {
    authToken: cookies.auth_token,
    csrfToken: cookies.ct0,
  };
}

export function buildCookieHeader(auth: AuthConfig): string {
  return `auth_token=${auth.authToken}; ct0=${auth.csrfToken}`;
}
