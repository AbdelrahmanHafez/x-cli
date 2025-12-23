import { type StoredAuth } from "./storage.js";

export interface AuthConfig {
  authToken: string;
  csrfToken: string;
  userId?: string;
  username?: string;
}

export function buildCookieHeader(auth: AuthConfig | StoredAuth): string {
  return `auth_token=${auth.authToken}; ct0=${auth.csrfToken}`;
}
