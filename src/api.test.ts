import { getHomeTimeline, findCursor, extractTweetId, parseHomeTimelineResponse } from "./api.js";
import { AuthConfig } from "./auth";
import { jest } from "@jest/globals";

// Helper to create a mock Response object
function mockResponse(data: any, ok: boolean = true, status: number = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe("api", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    // Spy on global.fetch
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    // Restore the original implementation
    fetchSpy.mockRestore();
  });


  describe("getHomeTimeline", () => {
    const mockAuth: AuthConfig = {
      authToken: "test-auth-token",
      csrfToken: "test-csrf-token",
    };

    it("should fetch and parse the home timeline", async () => {
      const apiResponse = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [{
                type: "TimelineAddEntries",
                entries: [{
                  entryId: "tweet-123",
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          __typename: "Tweet",
                          rest_id: "123",
                          legacy: { full_text: "Test tweet" },
                          core: { user_results: { result: { legacy: {} } } },
                          views: {},
                        },
                      },
                    },
                  },
                }],
              }],
            },
          },
        },
      };
      fetchSpy.mockResolvedValue(mockResponse(apiResponse));

      const result = await getHomeTimeline(mockAuth);
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].text).toBe("Test tweet");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if the API request fails", async () => {
      fetchSpy.mockResolvedValue(mockResponse("Internal Server Error", false, 500));

      await expect(getHomeTimeline(mockAuth)).rejects.toThrow(
        'HomeTimeline failed (500): "Internal Server Error"'
      );
    });

    it("should throw an error if the API returns errors", async () => {
      const errorResponse = {
        errors: [{ message: "Test API error" }],
      };
      fetchSpy.mockResolvedValue(mockResponse(errorResponse));

      await expect(getHomeTimeline(mockAuth)).rejects.toThrow(
        'API returned errors: [{"message":"Test API error"}]'
      );
    });
  });

  describe("parseHomeTimelineResponse", () => {
    it("should parse a typical home timeline response", () => {
      const data = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [
                {
                  type: "TimelineAddEntries",
                  entries: [
                    {
                      entryId: "tweet-123",
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: "Tweet",
                              rest_id: "123",
                              legacy: {
                                full_text: "Hello world",
                                created_at: "now",
                                favorite_count: 1,
                                retweet_count: 2,
                                reply_count: 3,
                                quote_count: 4,
                                bookmark_count: 5,
                              },
                              core: {
                                user_results: {
                                  result: {
                                    rest_id: "u1",
                                    legacy: {
                                      name: "Test User",
                                      screen_name: "testuser",
                                    },
                                  },
                                },
                              },
                              views: {
                                count: "100",
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      const result = parseHomeTimelineResponse(data);
      expect(result.tweets).toHaveLength(1);
      expect(result.tweets[0].id).toBe("123");
      expect(result.tweets[0].text).toBe("Hello world");
      expect(result.cursor).toBeUndefined();
    });

    it("should handle an empty response", () => {
      const data = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [],
            },
          },
        },
      };

      const result = parseHomeTimelineResponse(data);
      expect(result.tweets).toHaveLength(0);
      expect(result.cursor).toBeUndefined();
    });
  });

  describe("findCursor", () => {
    it("should find cursor in entry.content.value", () => {
      const entries = [{ content: { value: "long-cursor-123" } }];
      expect(findCursor(entries)).toBe("long-cursor-123");
    });

    it("should find cursor in entry.content.itemContent.value", () => {
      const entries = [{ content: { itemContent: { value: "long-cursor-abc" } } }];
      expect(findCursor(entries)).toBe("long-cursor-abc");
    });

    it("should find cursor in entry.content.cursorType and entry.content.value", () => {
      const entries = [{ content: { cursorType: "Bottom", value: "long-cursor-xyz" } }];
      expect(findCursor(entries)).toBe("long-cursor-xyz");
    });

    it("should return undefined if no cursor is found", () => {
      const entries = [{ content: { item: "no-cursor" } }];
      expect(findCursor(entries)).toBeUndefined();
    });

    it("should return undefined for empty entries", () => {
      expect(findCursor([])).toBeUndefined();
    });
  });

  describe("extractTweetId", () => {
    it("should extract tweet ID from x.com URL", () => {
      const url = "https://x.com/user/status/1234567890";
      expect(extractTweetId(url)).toBe("1234567890");
    });

    it("should extract tweet ID from twitter.com URL", () => {
      const url = "https://twitter.com/user/status/9876543210";
      expect(extractTweetId(url)).toBe("9876543210");
    });

    it("should extract tweet ID from URL with query params", () => {
      const url = "https://x.com/user/status/1234567890?s=20";
      expect(extractTweetId(url)).toBe("1234567890");
    });

    it("should return raw tweet ID if numeric string provided", () => {
      expect(extractTweetId("1234567890")).toBe("1234567890");
    });

    it("should handle long tweet IDs", () => {
      const longId = "2003093331522535458";
      expect(extractTweetId(longId)).toBe(longId);
    });

    it("should throw error for invalid URL", () => {
      expect(() => extractTweetId("https://example.com/something")).toThrow(
        "Invalid tweet ID or URL"
      );
    });

    it("should throw error for non-numeric non-URL input", () => {
      expect(() => extractTweetId("not-a-tweet")).toThrow(
        "Invalid tweet ID or URL"
      );
    });

    it("should throw error for empty string", () => {
      expect(() => extractTweetId("")).toThrow("Invalid tweet ID or URL");
    });

    it("should handle URL with www prefix", () => {
      const url = "https://www.x.com/user/status/1234567890";
      expect(extractTweetId(url)).toBe("1234567890");
    });
  });
});
