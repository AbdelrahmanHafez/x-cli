import type { Tweet, TweetThread } from "./api.js";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatTweet(tweet: Tweet, indent: string = ""): string {
  const { author, text, metrics, createdAt } = tweet;

  const header = `${COLORS.bold}${author.name}${COLORS.reset} ${COLORS.gray}@${author.username}${COLORS.reset} ${COLORS.dim}${formatDate(createdAt)}${COLORS.reset}`;

  const stats = [
    metrics.replies > 0 ? `${COLORS.cyan}${formatNumber(metrics.replies)} replies${COLORS.reset}` : null,
    metrics.retweets > 0 ? `${COLORS.green}${formatNumber(metrics.retweets)} retweets${COLORS.reset}` : null,
    metrics.likes > 0 ? `${COLORS.yellow}${formatNumber(metrics.likes)} likes${COLORS.reset}` : null,
    metrics.views > 0 ? `${COLORS.gray}${formatNumber(metrics.views)} views${COLORS.reset}` : null,
  ]
    .filter(Boolean)
    .join("  ");

  const textLines = text.split("\n").map((line) => indent + line).join("\n");

  return [
    indent + header,
    textLines,
    stats ? indent + stats : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatThreadPretty(thread: TweetThread): string {
  const lines: string[] = [];

  if (thread.parentTweets.length > 0) {
    lines.push(`${COLORS.dim}--- Parent tweets ---${COLORS.reset}`);
    for (const tweet of thread.parentTweets) {
      lines.push(formatTweet(tweet));
      lines.push(`${COLORS.dim}  |${COLORS.reset}`);
    }
    lines.push(`${COLORS.dim}  v${COLORS.reset}`);
    lines.push("");
  }

  lines.push(formatTweet(thread.mainTweet));

  if (thread.replies.length > 0) {
    lines.push("");
    lines.push(`${COLORS.dim}--- Replies (${thread.replies.length}) ---${COLORS.reset}`);
    for (const reply of thread.replies) {
      lines.push("");
      lines.push(formatTweet(reply, "  "));
    }
  }

  return lines.join("\n");
}

function highlightJson(json: string): string {
  return json
    // Strings (keys and values) - must do keys first
    .replace(/"([^"]+)":/g, `${COLORS.cyan}"$1"${COLORS.reset}:`)
    // String values
    .replace(/: "([^"]*)"/g, `: ${COLORS.green}"$1"${COLORS.reset}`)
    // Numbers
    .replace(/: (\d+)/g, `: ${COLORS.yellow}$1${COLORS.reset}`)
    // Booleans and null
    .replace(/: (true|false|null)/g, `: ${COLORS.blue}$1${COLORS.reset}`);
}

export function formatThreadJson(thread: TweetThread, options?: { color?: boolean }): string {
  const json = JSON.stringify(thread, null, 2);
  const useColor = options?.color ?? process.stdout.isTTY;
  return useColor ? highlightJson(json) : json;
}
