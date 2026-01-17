import { randomUUID } from "node:crypto";
import { AuthConfig, buildCookieHeader } from "./auth.js";
import { ClientTransaction, handleXMigration } from "x-client-transaction-id";
import { getGuestToken } from "./guest-token.js";

const TWEET_DETAIL_QUERY_ID = "_8aYOgEDz35BrBcBal1-_w";
const TWEET_BY_REST_ID_QUERY_ID = "aFvUsJm2c-oDkJV75blV6g";
const HOME_TIMELINE_QUERY_ID = "GP_SvUI4lAFrt6UyEnkAGA";
const HOME_LATEST_TIMELINE_QUERY_ID = "HN6oP_7h7HayqyYimz97Iw";

const BASE_URL = "https://x.com/i/api/graphql";  // For authenticated requests
const GUEST_BASE_URL = "https://api.x.com/graphql";  // For guest requests

// Cached transaction client for guest requests
let transactionClient: ClientTransaction | null = null;

// Public bearer token used by Twitter's web client
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
  post_ctas_fetch_enabled: true,
  responsive_web_grok_annotations_enabled: false,
};

const FIELD_TOGGLES = {
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
};

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    profileImageUrl: string;
  };
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views: number;
    bookmarks: number;
  };
  isReply: boolean;
  inReplyToTweetId?: string;
}

export interface TweetThread {
  mainTweet: Tweet;
  parentTweets: Tweet[];
  replies: Tweet[];
}

export interface HomeTimelineResult {

  tweets: Tweet[];
  cursor?: string; // For next page (if available)
}
export interface HomeLatestTimelineResult extends HomeTimelineResult {}

function extractTweetFromResult(result: any): Tweet | null {
  if (!result || result.__typename === "TweetTombstone") {
    return null;
  }

  const tweet = result.__typename === "TweetWithVisibilityResults"
    ? result.tweet
    : result;

  if (!tweet?.legacy || !tweet?.core?.user_results?.result) {
    return null;
  }

  const legacy = tweet.legacy;
  const user = tweet.core.user_results.result;
  const userLegacy = user.legacy || {};
  const userCore = user.core || {};

  return {
    id: tweet.rest_id,
    text: legacy.full_text,
    createdAt: legacy.created_at,
    author: {
      id: user.rest_id,
      name: userCore.name || userLegacy.name || "",
      username: userCore.screen_name || userLegacy.screen_name || "",
      profileImageUrl: user.avatar?.image_url || userLegacy.profile_image_url_https || "",
    },
    metrics: {
      likes: legacy.favorite_count || 0,
      retweets: legacy.retweet_count || 0,
      replies: legacy.reply_count || 0,
      quotes: legacy.quote_count || 0,
      views: parseInt(tweet.views?.count || "0", 10),
      bookmarks: legacy.bookmark_count || 0,
    },
    isReply: !!legacy.in_reply_to_status_id_str,
    inReplyToTweetId: legacy.in_reply_to_status_id_str,
  };
}

export async function getTweetDetail(
  tweetId: string,
  auth: AuthConfig
): Promise<TweetThread> {
  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: true,
    rankingMode: "Relevance",
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true,
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(FEATURES),
    fieldToggles: JSON.stringify(FIELD_TOGGLES),
  });

  const url = `${BASE_URL}/${TWEET_DETAIL_QUERY_ID}/TweetDetail?${params}`;

  // Generate a random UUID for this session
  const clientUuid = randomUUID();

  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: `Bearer ${BEARER_TOKEN}`,
      "content-type": "application/json",
      cookie: buildCookieHeader(auth),
      "x-csrf-token": auth.csrfToken,
      "x-client-uuid": clientUuid,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`API request failed (${response.status}): ${text}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const data = await response.json();

  // Check for errors in response
  if (data.errors) {
    throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
  }

  return parseTweetDetailResponse(data, tweetId);
}

function parseTweetDetailResponse(data: any, focalTweetId: string): TweetThread {
  const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions || [];
  const entries: any[] = [];

  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries" && instruction.entries) {
      entries.push(...instruction.entries);
    }
  }

  let mainTweet: Tweet | null = null;
  const parentTweets: Tweet[] = [];
  const replies: Tweet[] = [];
  let foundEmptyTweetResults = false;

  for (const entry of entries) {
    const entryId = entry.entryId || "";
    const content = entry.content;

    if (entryId.startsWith("tweet-")) {
      const tweetResult = content?.itemContent?.tweet_results?.result;

      // Check if tweet_results exists but is empty (auth issue)
      if (!tweetResult && content?.itemContent?.tweet_results &&
          Object.keys(content.itemContent.tweet_results).length === 0) {
        foundEmptyTweetResults = true;
      }

      const tweet = extractTweetFromResult(tweetResult);

      if (tweet) {
        if (tweet.id === focalTweetId) {
          mainTweet = tweet;
        } else if (mainTweet === null) {
          parentTweets.push(tweet);
        } else {
          replies.push(tweet);
        }
      }
    } else if (entryId.startsWith("conversationthread-")) {
      const items = content?.items || [];
      for (const item of items) {
        const tweetResult = item?.item?.itemContent?.tweet_results?.result;
        const tweet = extractTweetFromResult(tweetResult);
        if (tweet && tweet.id !== focalTweetId) {
          replies.push(tweet);
        }
      }
    }
  }

  if (!mainTweet) {
    if (foundEmptyTweetResults) {
      const error = new Error(
        "Authentication failed or expired. The API returned the tweet structure but without content.\n\n" +
        "Your auth cookies may be invalid or expired. Try:\n" +
        "1. Run 'x logout' then 'x login' to re-authenticate\n" +
        "2. Or manually update ~/.config/x-cli/auth.json with fresh cookies from your browser"
      ) as Error & { status: number };
      error.status = 401;
      throw error;
    }
    throw new Error("Could not find the requested tweet");
  }

  return {
    mainTweet,
    parentTweets,
    replies,
  };
}

export async function getHomeTimeline(
  auth: AuthConfig,
  opts?: {
    count?: number;
    cursor?: string;
    includePromotedContent?: boolean;
    withCommunity?: boolean;
  }
): Promise<HomeTimelineResult> {
  const variables = {
    count: opts?.count ?? 40,
    cursor: opts?.cursor, // Better not to send if undefined
    includePromotedContent: opts?.includePromotedContent ?? true,
    withCommunity: opts?.withCommunity ?? true,
  };

  // Delete cursor if it is undefined (the API may not like it)
  if (!variables.cursor) delete (variables as any).cursor;

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(FEATURES),
  });

  const url = `${BASE_URL}/${HOME_TIMELINE_QUERY_ID}/HomeTimeline?${params}`;

  const clientUuid = randomUUID();

  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "ja,en-US;q=0.7,en;q=0.3",
      authorization: `Bearer ${BEARER_TOKEN}`,
      "content-type": "application/json",
      cookie: buildCookieHeader(auth),
      "x-csrf-token": auth.csrfToken,
      "x-client-uuid": clientUuid,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
      "x-twitter-active-user": "no",
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/146.0",
      referer: "https://x.com/home",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`HomeTimeline failed (${response.status}): ${text}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
  }

  return parseHomeTimelineResponse(data, opts?.count);
}

export async function getHomeLatestTimeline(
  auth: AuthConfig,
  opts?: {
    count?: number;
    cursor?: string;
    enableRanking?: boolean;
    includePromotedContent?: boolean;
    requestContext?: string; // e.g. "launch"
    seenTweetIds?: string[];
  }
): Promise<HomeTimelineResult> {
  const variables: Record<string, any> = {
    count: opts?.count ?? 20,
    enableRanking: opts?.enableRanking ?? true,
    includePromotedContent: opts?.includePromotedContent ?? true,
    requestContext: opts?.requestContext ?? "launch",
    seenTweetIds: opts?.seenTweetIds ?? [],
    cursor: opts?.cursor,
  };

  // APIが嫌がるパラメータは送らない（HomeTimelineと同じ思想）
  if (!variables.cursor) delete variables.cursor;
  if (!variables.seenTweetIds || variables.seenTweetIds.length === 0) delete variables.seenTweetIds;

  const url = `${BASE_URL}/${HOME_LATEST_TIMELINE_QUERY_ID}/HomeLatestTimeline`;

  const clientUuid = randomUUID();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "ja,en-US;q=0.7,en;q=0.3",
      authorization: `Bearer ${BEARER_TOKEN}`,
      "content-type": "application/json",
      cookie: buildCookieHeader(auth),
      "x-csrf-token": auth.csrfToken,
      "x-client-uuid": clientUuid,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
      "x-twitter-active-user": "yes",
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/146.0",
      referer: "https://x.com/home",
      origin: "https://x.com",
    },
    body: JSON.stringify({
      queryId: HOME_LATEST_TIMELINE_QUERY_ID,
      variables,
      features: FEATURES,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(
      `HomeLatestTimeline failed (${response.status}): ${text}`
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
  }

  // 返却構造が home.home_timeline_urt.instructions なので既存パーサを流用
  return parseHomeTimelineResponse(data, opts?.count);
}

export function parseHomeTimelineResponse(
  data: any,
  count?: number,
): HomeTimelineResult {
  const instructions = data?.data?.home?.home_timeline_urt?.instructions ?? [];
  const entries: any[] = [];

  for (const ins of instructions) {
    if (ins?.type === "TimelineAddEntries" && Array.isArray(ins.entries)) {
      entries.push(...ins.entries);
    }
  }

  const tweets: Tweet[] = [];
  for (const entry of entries) {
    const entryId = entry?.entryId ?? "";
    if (entryId.startsWith("tweet-") || entryId.startsWith("promoted-tweet-")) {
      const tweetResult = entry?.content?.itemContent?.tweet_results?.result;
      const tweet = extractTweetFromResult(tweetResult);
      if (tweet) tweets.push(tweet);
      if (count && tweets.length >= count) break;
    }
  }

  // Pick up the next page cursor (best-effort as the location may change)
  const cursor = findCursor(entries);

  // Deduplication (to prevent duplicates between promoted and regular tweets, and on re-fetch)
  const uniq = new Map<string, Tweet>();
  for (const t of tweets) uniq.set(t.id, t);

  return { tweets: [...uniq.values()], cursor };
}

export function findCursor(entries: any[]): string | undefined {
  // The cursor for HomeTimeline may appear in entry.content.value / entry.content.itemContent.value, etc.
  for (const e of entries) {
    const c1 = e?.content?.value;
    if (typeof c1 === "string" && c1.length > 10) return c1;

    const c2 = e?.content?.itemContent?.value;
    if (typeof c2 === "string" && c2.length > 10) return c2;

    const c3 = e?.content?.cursorType && e?.content?.value;
    if (typeof c3 === "string" && c3.length > 10) return c3;
  }
  return undefined;
}

async function initTransactionClient(): Promise<ClientTransaction> {
  if (!transactionClient) {
    const document = await handleXMigration();
    transactionClient = await ClientTransaction.create(document);
  }
  return transactionClient;
}

export async function getTweetAsGuest(tweetId: string): Promise<Tweet> {
  // Initialize transaction client and get guest token
  const [client, guestToken] = await Promise.all([
    initTransactionClient(),
    getGuestToken(),
  ]);

  const variables = {
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(FEATURES),
    fieldToggles: JSON.stringify(FIELD_TOGGLES),
  });

  const path = `/graphql/${TWEET_BY_REST_ID_QUERY_ID}/TweetResultByRestId`;
  const transactionId = await client.generateTransactionId("GET", path);

  const url = `${GUEST_BASE_URL}/${TWEET_BY_REST_ID_QUERY_ID}/TweetResultByRestId?${params}`;

  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: `Bearer ${BEARER_TOKEN}`,
      "content-type": "application/json",
      origin: "https://x.com",
      referer: "https://x.com/",
      "x-guest-token": guestToken,
      "x-client-transaction-id": transactionId,
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Guest API request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
  }

  const result = data?.data?.tweetResult?.result;
  if (!result) {
    throw new Error("Tweet not found or not accessible");
  }

  const tweet = extractTweetFromResult(result);
  if (!tweet) {
    throw new Error("Failed to parse tweet data");
  }

  return tweet;
}

export function extractTweetId(input: string): string {
  const urlMatch = input.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^\d+$/.test(input)) {
    return input;
  }

  throw new Error(
    `Invalid tweet ID or URL: "${input}"\n` +
      "Expected a tweet ID (e.g., \"1234567890\") or URL (e.g., \"https://x.com/user/status/1234567890\")"
  );
}
