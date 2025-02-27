# Privy Utils

A collection of utilities for working with Privy, starting with a user export tool that exports all users from a Privy application to a CSV file. It includes rate limiting and automatic retries to handle API limitations gracefully.

## Features

- Exports all Privy users to a CSV file
- Handles pagination automatically
- Implements rate limiting to avoid API throttling
- Supports resuming from where it left off if interrupted
- Configurable output files

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your Privy credentials (see `.env.example` for reference)

## Configuration

Configure the script using environment variables in your `.env` file:

| Variable           | Description                   | Default            |
| ------------------ | ----------------------------- | ------------------ |
| `PRIVY_APP_ID`     | Your Privy App ID             | (required)         |
| `PRIVY_APP_SECRET` | Your Privy App Secret         | (required)         |
| `OUTPUT_FILE`      | Path to the output CSV file   | `users.csv`        |
| `CURSOR_FILE`      | Path to the cursor state file | `privy_cursor.txt` |

## Usage

Run the script with:

```
npm start
```

The script will:

1. Export all users from your Privy application to a CSV file
2. Apply rate limiting to avoid hitting API limits
3. Save progress as it runs, allowing you to resume if interrupted

## CSV Format

The generated CSV file contains the following columns:

- `id`: Privy user ID
- `createdAt`: User creation timestamp
- `isGuest`: Whether the user is a guest
- `email`: User's email address (if available)
- `wallet`: User's wallet address (if available)
- `linkedAccounts`: Number of linked accounts

## Development

- Build the TypeScript code: `npm run build`
- Run in development mode: `npm run dev`
- Clean build artifacts: `npm run clean`
