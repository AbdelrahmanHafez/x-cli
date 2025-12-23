import { buildCookieHeader } from "./auth.js";

describe("auth", () => {
  describe("buildCookieHeader", () => {
    it("should build cookie header from auth config", () => {
      const auth = {
        authToken: "test-auth-token",
        csrfToken: "test-csrf-token"
      };

      const result = buildCookieHeader(auth);

      expect(result).toBe("auth_token=test-auth-token; ct0=test-csrf-token");
    });

    it("should handle tokens with special characters", () => {
      const auth = {
        authToken: "abc123def456",
        csrfToken: "xyz789uvw012"
      };

      const result = buildCookieHeader(auth);

      expect(result).toBe("auth_token=abc123def456; ct0=xyz789uvw012");
    });
  });
});
