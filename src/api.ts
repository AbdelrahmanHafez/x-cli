import { AuthConfig, buildCookieHeader } from "./auth.js";

const TWEET_DETAIL_QUERY_ID = "97JF30KziU00483E_8elBA";
const BASE_URL = "https://x.com/i/api/graphql";

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
    with_rux_injections: false,
    rankingMode: "Relevance",
    includePromotedContent: false,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(FEATURES),
    fieldToggles: JSON.stringify(FIELD_TOGGLES),
  });

  const url = `${BASE_URL}/${TWEET_DETAIL_QUERY_ID}/TweetDetail?${params}`;

  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: `Bearer ${BEARER_TOKEN}`,
      "content-type": "application/json",
      cookie: buildCookieHeader(auth),
      "x-csrf-token": auth.csrfToken,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-client-language": "en",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
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

  for (const entry of entries) {
    const entryId = entry.entryId || "";
    const content = entry.content;

    if (entryId.startsWith("tweet-")) {
      const tweetResult = content?.itemContent?.tweet_results?.result;
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
    throw new Error("Could not find the requested tweet");
  }

  return {
    mainTweet,
    parentTweets,
    replies,
  };
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
