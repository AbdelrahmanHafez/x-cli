import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { getCompletionScript } from "./completions.js";

type Shell = "bash" | "zsh" | "fish";

interface SetupResult {
  shell: Shell;
  completionPath: string;
  action: "installed" | "already_installed";
  reloadCommand: string;
}

export function detectShell(): Shell {
  const shell = process.env.SHELL || "";
  const shellName = basename(shell);

  if (shellName === "fish") return "fish";
  if (shellName === "zsh") return "zsh";
  return "bash";
}

function getCompletionPaths(shell: Shell): { dir: string; file: string; rcFile?: string } {
  const home = homedir();

  switch (shell) {
    case "fish":
      return {
        dir: join(home, ".config", "fish", "completions"),
        file: join(home, ".config", "fish", "completions", "x.fish"),
      };
    case "zsh":
      return {
        dir: join(home, ".zsh", "completions"),
        file: join(home, ".zsh", "completions", "_x"),
        rcFile: join(home, ".zshrc"),
      };
    case "bash":
      return {
        dir: home,
        file: join(home, ".bashrc"),
        rcFile: join(home, ".bashrc"),
      };
  }
}

function bashCompletionInstalled(rcFile: string): boolean {
  if (!existsSync(rcFile)) return false;
  const content = readFileSync(rcFile, "utf-8");
  return content.includes("###-begin-x-completions-###");
}

function zshFpathConfigured(rcFile: string): boolean {
  if (!existsSync(rcFile)) return false;
  const content = readFileSync(rcFile, "utf-8");
  return content.includes(".zsh/completions");
}

export function installCompletions(shell?: Shell): SetupResult {
  const detectedShell = shell || detectShell();
  const paths = getCompletionPaths(detectedShell);
  const completionScript = getCompletionScript(detectedShell);

  // Ensure directory exists
  if (!existsSync(paths.dir)) {
    mkdirSync(paths.dir, { recursive: true });
  }

  let action: "installed" | "already_installed" = "installed";
  let reloadCommand = "";

  switch (detectedShell) {
    case "fish":
      if (existsSync(paths.file)) {
        const existing = readFileSync(paths.file, "utf-8");
        if (existing.includes("x CLI completion")) {
          action = "already_installed";
        }
      }
      // Always write latest completions
      writeFileSync(paths.file, completionScript);
      reloadCommand = "source ~/.config/fish/completions/x.fish";
      break;

    case "zsh":
      if (existsSync(paths.file)) {
        action = "already_installed";
      }
      // Always write latest completions
      writeFileSync(paths.file, completionScript);
      // Add fpath to .zshrc if not present
      if (paths.rcFile && !zshFpathConfigured(paths.rcFile)) {
        const fpathLine = "\n# x-cli completions\nfpath=(~/.zsh/completions $fpath)\nautoload -Uz compinit && compinit\n";
        appendFileSync(paths.rcFile, fpathLine);
      }
      reloadCommand = "source ~/.zshrc";
      break;

    case "bash":
      if (paths.rcFile) {
        if (bashCompletionInstalled(paths.rcFile)) {
          // Replace existing completions
          action = "already_installed";
          const content = readFileSync(paths.rcFile, "utf-8");
          const updated = content.replace(
            /###-begin-x-completions-###[\s\S]*?###-end-x-completions-###/,
            completionScript
          );
          writeFileSync(paths.rcFile, updated);
        } else {
          appendFileSync(paths.rcFile, `\n${completionScript}\n`);
        }
      }
      reloadCommand = "source ~/.bashrc";
      break;
  }

  return {
    shell: detectedShell,
    completionPath: paths.file,
    action,
    reloadCommand,
  };
}
