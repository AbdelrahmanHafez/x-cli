import { formatTweet, formatThreadPretty, formatThreadJson } from "./format.js";
import type { TweetThread, Tweet } from "./api.js";

const createMockTweet = (overrides: Partial<Tweet> = {}): Tweet => ({
  id: "123456789",
  text: "Hello world!",
  createdAt: new Date().toUTCString(),
  author: {
    id: "987654321",
    name: "Test User",
    username: "testuser",
    profileImageUrl: "https://example.com/avatar.jpg"
  },
  metrics: {
    likes: 10,
    retweets: 5,
    replies: 2,
    quotes: 1,
    views: 100,
    bookmarks: 3
  },
  isReply: false,
  ...overrides
});

const createMockThread = (overrides: Partial<TweetThread> = {}): TweetThread => ({
  mainTweet: createMockTweet(),
  parentTweets: [],
  replies: [],
  ...overrides
});

describe("format", () => {
  describe("formatThreadJson", () => {
    it("should return valid JSON string when color is disabled", () => {
      const thread = createMockThread();
      const result = formatThreadJson(thread, { color: false });

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should include mainTweet in output", () => {
      const thread = createMockThread();
      const result = JSON.parse(formatThreadJson(thread, { color: false }));

      expect(result.mainTweet).toBeDefined();
      expect(result.mainTweet.id).toBe("123456789");
    });

    it("should include replies in output", () => {
      const thread = createMockThread({
        replies: [
          createMockTweet({ id: "reply1", text: "Nice!" }),
          createMockTweet({ id: "reply2", text: "Great post!" })
        ]
      });
      const result = JSON.parse(formatThreadJson(thread, { color: false }));

      expect(result.replies).toHaveLength(2);
      expect(result.replies[0].id).toBe("reply1");
    });

    it("should include parentTweets in output", () => {
      const thread = createMockThread({
        parentTweets: [createMockTweet({ id: "parent1" })]
      });
      const result = JSON.parse(formatThreadJson(thread, { color: false }));

      expect(result.parentTweets).toHaveLength(1);
    });

    it("should format with indentation", () => {
      const thread = createMockThread();
      const result = formatThreadJson(thread, { color: false });

      expect(result).toContain("\n");
      expect(result).toContain("  ");
    });

    it("should add color codes when color is enabled", () => {
      const thread = createMockThread();
      const result = formatThreadJson(thread, { color: true });

      expect(result).toContain("\x1b["); // ANSI escape code
    });

    it("should not add color codes when color is disabled", () => {
      const thread = createMockThread();
      const result = formatThreadJson(thread, { color: false });

      expect(result).not.toContain("\x1b[");
    });
  });

  describe("formatThreadPretty", () => {
    it("should include author name and username", () => {
      const thread = createMockThread();
      const result = formatThreadPretty(thread);

      expect(result).toContain("Test User");
      expect(result).toContain("@testuser");
    });

    it("should include tweet text", () => {
      const thread = createMockThread({
        mainTweet: createMockTweet({ text: "This is my tweet content" })
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("This is my tweet content");
    });

    it("should show metrics", () => {
      const thread = createMockThread({
        mainTweet: createMockTweet({
          metrics: {
            likes: 42,
            retweets: 10,
            replies: 5,
            quotes: 2,
            views: 1000,
            bookmarks: 1
          }
        })
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("42 likes");
      expect(result).toContain("10 retweets");
      expect(result).toContain("5 replies");
    });

    it("should format large numbers with K suffix", () => {
      const thread = createMockThread({
        mainTweet: createMockTweet({
          metrics: {
            likes: 1500,
            retweets: 0,
            replies: 0,
            quotes: 0,
            views: 10000,
            bookmarks: 0
          }
        })
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("1.5K likes");
      expect(result).toContain("10K views");
    });

    it("should show replies section when replies exist", () => {
      const thread = createMockThread({
        replies: [createMockTweet({ id: "reply1", text: "Great post!" })]
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("Replies (1)");
      expect(result).toContain("Great post!");
    });

    it("should show parent tweets section when parents exist", () => {
      const thread = createMockThread({
        parentTweets: [createMockTweet({ id: "parent1", text: "Original tweet" })]
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("Parent tweets");
      expect(result).toContain("Original tweet");
    });

    it("should not show replies section when no replies", () => {
      const thread = createMockThread({ replies: [] });
      const result = formatThreadPretty(thread);

      expect(result).not.toContain("Replies");
    });

    it("should handle multiline tweet text", () => {
      const thread = createMockThread({
        mainTweet: createMockTweet({ text: "Line 1\nLine 2\nLine 3" })
      });
      const result = formatThreadPretty(thread);

      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
      expect(result).toContain("Line 3");
    });
  });

  describe("formatTweet", () => {
    it("should include author name and username", () => {
      const tweet = createMockTweet();
      const result = formatTweet(tweet);

      expect(result).toContain("Test User");
      expect(result).toContain("@testuser");
    });

    it("should include tweet text", () => {
      const tweet = createMockTweet({ text: "This is a test tweet." });
      const result = formatTweet(tweet);

      expect(result).toContain("This is a test tweet.");
    });

    it("should show metrics", () => {
      const tweet = createMockTweet({
        metrics: {
          likes: 42,
          retweets: 10,
          replies: 5,
          quotes: 2,
          views: 1000,
          bookmarks: 1
        }
      });
      const result = formatTweet(tweet);

      expect(result).toContain("5 replies");
      expect(result).toContain("10 retweets");
      expect(result).toContain("42 likes");
      expect(result).toContain("1K views");
    });

    it("should apply indentation", () => {
      const tweet = createMockTweet({ text: "Line 1\nLine 2" });
      const result = formatTweet(tweet, "  ");
      const lines = result.split("\n");

      expect(lines.every(line => line.startsWith("  "))).toBe(true);
    });

    it("should hide metrics with zero values", () => {
      const tweet = createMockTweet({
        metrics: {
          likes: 10,
          retweets: 0,
          replies: 0,
          quotes: 0,
          views: 20,
          bookmarks: 0
        }
      });
      const result = formatTweet(tweet);

      expect(result).toContain("10 likes");
      expect(result).toContain("20 views");
      expect(result).not.toContain("retweets");
      expect(result).not.toContain("replies");
    });
  });
});
