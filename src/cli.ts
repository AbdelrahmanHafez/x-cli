#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getAuth } from "./auth.js";
import { getTweetDetail, extractTweetId } from "./api.js";
import { formatThreadPretty, formatThreadJson } from "./format.js";
import { getCompletionScript } from "./completions.js";
import { installCompletions } from "./setup.js";

const cli = yargs(hideBin(process.argv))
  .scriptName("x")
  .usage("$0 <command> [options]")
  .command(
    "tweet <url>",
    "View a tweet and its replies",
    (yargs) => {
      return yargs
        .positional("url", {
          describe: "Tweet URL or ID",
          type: "string",
          demandOption: true,
        })
        .option("pretty", {
          alias: "p",
          describe: "Pretty print output with colors",
          type: "boolean",
          default: false,
        });
    },
    async (argv) => {
      try {
        const tweetId = extractTweetId(argv.url);
        const auth = await getAuth();
        const thread = await getTweetDetail(tweetId, auth);

        if (argv.pretty) {
          console.log(formatThreadPretty(thread));
        } else {
          console.log(formatThreadJson(thread));
        }
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    }
  )
  .command(
    "completion [shell]",
    "Output shell completion script",
    (yargs) => {
      return yargs.positional("shell", {
        describe: "Shell type",
        type: "string",
        choices: ["bash", "zsh", "fish"],
        default: "bash",
      });
    },
    (argv) => {
      try {
        console.log(getCompletionScript(argv.shell));
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    }
  )
  .command(
    "setup",
    "Install shell completions (auto-detects shell)",
    (yargs) => {
      return yargs.option("shell", {
        alias: "s",
        describe: "Override shell detection",
        type: "string",
        choices: ["bash", "zsh", "fish"] as const,
      });
    },
    (argv) => {
      try {
        const shell = argv.shell as "bash" | "zsh" | "fish" | undefined;
        const result = installCompletions(shell);

        if (result.action === "already_installed") {
          console.log(`Completions for ${result.shell} already installed at ${result.completionPath}`);
        } else {
          console.log(`Installed ${result.shell} completions to ${result.completionPath}`);
          console.log(`\nTo activate, run:\n  ${result.reloadCommand}\n\nOr restart your terminal.`);
        }
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    }
  )
  .demandCommand(1, "You need to specify a command")
  .strict()
  .help()
  .alias("h", "help")
  .version()
  .alias("v", "version");

cli.parse();
