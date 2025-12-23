# x-cli

A command-line tool for viewing X (Twitter) posts and their replies.

## Installation

```bash
npm install -g x-cli
```

Or clone and link locally:

```bash
git clone https://github.com/yourusername/x-cli.git
cd x-cli
npm install
npm run build
npm link
```

## Authentication

The CLI requires your X session cookies. To set up:

1. Open [x.com](https://x.com) in your browser and log in
2. Open DevTools (F12) → Application → Cookies → x.com
3. Copy the values for `auth_token` and `ct0`
4. Create the config file:

```bash
mkdir -p ~/.config/x-cli
cat > ~/.config/x-cli/cookies.txt << EOF
auth_token=YOUR_AUTH_TOKEN
ct0=YOUR_CT0_TOKEN
EOF
```

## Usage

```bash
# View a tweet (JSON output)
x tweet https://x.com/user/status/1234567890

# View with pretty formatting
x tweet https://x.com/user/status/1234567890 --pretty

# Also works with just the tweet ID
x tweet 1234567890
```

## Output

### JSON (default)

```json
{
  "mainTweet": {
    "id": "1234567890",
    "text": "Hello world!",
    "author": { "name": "User", "username": "user" },
    "metrics": { "likes": 10, "retweets": 5, "replies": 2 }
  },
  "parentTweets": [],
  "replies": [...]
}
```

### Pretty (`--pretty`)

```
User @username 2h ago
Hello world!
2 replies  5 retweets  10 likes  1.2K views

--- Replies (2) ---

  Reply Author @reply_user 1h ago
  Nice post!
```

## Shell Completions

The easiest way to install shell completions is to run:

```bash
x setup
```

This auto-detects your shell and installs completions to the appropriate location.

### Manual Installation

If you prefer to install manually:

```bash
# Bash
x completion bash >> ~/.bashrc

# Zsh
mkdir -p ~/.zsh/completions
x completion zsh > ~/.zsh/completions/_x
# Add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)

# Fish
x completion fish > ~/.config/fish/completions/x.fish
```

## License

MIT
