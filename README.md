# Privy Utils

A collection of utilities for working with Privy, starting with a user export tool that exports all users from a Privy application to a CSV file. It includes rate limiting and automatic retries to handle API limitations gracefully.

## Features

- Exports all Privy users to a CSV file
- Handles pagination automatically
- Implements rate limiting to avoid API throttling
- Supports resuming from where it left off if interrupted
- Configurable output files
- Incremental export mode to only fetch new users since last run
- PM2 integration for scheduled runs and process management
- Duplicate detection to avoid adding the same user multiple times

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your Privy credentials (see `.env.example` for reference)

## Configuration

Configure the script using environment variables in your `.env` file:

| Variable           | Description                             | Default                    |
| ------------------ | --------------------------------------- | -------------------------- |
| `PRIVY_APP_ID`     | Your Privy App ID                       | (required)                 |
| `PRIVY_APP_SECRET` | Your Privy App Secret                   | (required)                 |
| `OUTPUT_FILE`      | Path to the output CSV file             | `users.csv`                |
| `CURSOR_FILE`      | Path to the cursor state file           | `privy_cursor.txt`         |
| `TIMESTAMP_FILE`   | Path to the timestamp state file        | `last_fetch_timestamp.txt` |
| `FETCH_NEW_ONLY`   | Only fetch users created since last run | `false`                    |
| `UNIQUE_FILES`     | Add timestamp to output filename        | `false`                    |

## Usage

### Basic Usage

Run the script with:

```
npm run start:dev
```

The script will:

1. Export all users from your Privy application to a CSV file
2. Apply rate limiting to avoid hitting API limits
3. Save progress as it runs, allowing you to resume if interrupted

### Using PM2 for Process Management

This utility includes PM2 configuration for better process management:

```
# Start the export process
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Stop the process
npm run pm2:stop

# Restart the process
npm run pm2:restart

# Remove from PM2
npm run pm2:delete
```

The PM2 configuration automatically enables incremental mode (`FETCH_NEW_ONLY=true`) and unique filenames (`UNIQUE_FILES=true`).

## CSV Format

The generated CSV file contains the following columns:

- `id`: Privy user ID
- `createdAt`: User creation timestamp
- `isGuest`: Whether the user is a guest
- `email`: User's email address (if available)
- `wallet`: User's wallet address (if available)
- `linkedAccounts`: Number of linked accounts

## Rate Limiting and Performance

The tool implements several strategies to handle Privy API rate limits:

- Respects the 30 requests per minute limit
- Implements exponential backoff with jitter for 429 responses
- Takes periodic breaks after processing batches of users
- Automatically retries on network errors

## Development

- Build the TypeScript code: `npm run build`
- Run in development mode: `npm run start:dev`
- Watch mode for development: `npm run dev`
- Clean build artifacts: `npm run clean`
