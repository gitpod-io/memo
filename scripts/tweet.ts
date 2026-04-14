/**
 * Post a tweet to @swfactory_dev via Twitter API v2.
 *
 * Usage: npx tsx scripts/tweet.ts "Your tweet text here"
 *
 * Required env vars (OAuth 1.0a User Context):
 *   TWITTER_CONSUMER_KEY
 *   TWITTER_SECRET_KEY
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_TOKEN_SECRET
 */

import { TwitterApi } from "twitter-api-v2";

const text = process.argv[2];

if (!text) {
  console.error("Usage: npx tsx scripts/tweet.ts <text>");
  process.exit(1);
}

if (text.length > 280) {
  console.error(`Tweet is ${text.length} chars (max 280). Trim it first.`);
  process.exit(1);
}

const required = [
  "TWITTER_CONSUMER_KEY",
  "TWITTER_SECRET_KEY",
  "TWITTER_ACCESS_TOKEN",
  "TWITTER_ACCESS_TOKEN_SECRET",
] as const;

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new TwitterApi({
  appKey: process.env.TWITTER_CONSUMER_KEY!,
  appSecret: process.env.TWITTER_SECRET_KEY!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
});

async function main() {
  try {
    const { data } = await client.v2.tweet(text);
    const url = `https://x.com/swfactory_dev/status/${data.id}`;
    console.log(`Posted: ${url}`);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`Failed to post tweet: ${err.message}`);
    } else {
      console.error("Failed to post tweet:", err);
    }
    process.exit(1);
  }
}

main();
