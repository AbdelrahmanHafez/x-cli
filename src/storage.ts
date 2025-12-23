import { readFile, writeFile, unlink, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface StoredAuth {
  authToken: string;
  csrfToken: string;
  userId?: string;
  username?: string;
  createdAt?: number;
}

const CONFIG_DIR = join(homedir(), ".config", "x-cli");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");
const OLD_COOKIES_FILE = join(CONFIG_DIR, "cookies.txt");

export async function loadAuth(): Promise<StoredAuth | null> {
  try {
    const content = await readFile(AUTH_FILE, "utf-8");
    return JSON.parse(content) as StoredAuth;
  } catch {
    // Try migrating from old cookies.txt format
    return await migrateFromCookiesFile();
  }
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(auth, null, 2));
}

export async function clearAuth(): Promise<void> {
  try {
    await unlink(AUTH_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

async function migrateFromCookiesFile(): Promise<StoredAuth | null> {
  try {
    const content = await readFile(OLD_COOKIES_FILE, "utf-8");
    const cookies: Record<string, string> = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        cookies[key] = value;
      }
    }

    if (!cookies.auth_token || !cookies.ct0) {
      return null;
    }

    const auth: StoredAuth = {
      authToken: cookies.auth_token,
      csrfToken: cookies.ct0,
      createdAt: Date.now(),
    };

    // Save to new format
    await saveAuth(auth);

    // Rename old file to prevent re-migration
    try {
      await rename(OLD_COOKIES_FILE, `${OLD_COOKIES_FILE}.migrated`);
    } catch {
      // Ignore rename errors
    }

    return auth;
  } catch {
    return null;
  }
}
