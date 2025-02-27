import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Ensure environment is properly set up
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

// Get configurable file paths from environment variables or use defaults
const CURSOR_FILE = process.env.CURSOR_FILE || "privy_cursor.txt";
const USERS_FILE = process.env.OUTPUT_FILE || "users.csv";

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error("Missing required Privy credentials");
  process.exit(1);
}

// Configuration
const CONFIG = {
  // Default to 1 request per second (1000ms between requests)
  rateLimitMs: 1000,
  // Number of users to process before taking a longer break
  usersBatchSize: 2500,
  // How long to pause after hitting the batch size (10 seconds instead of 5 minutes)
  batchCooldownMs: 10 * 1000,
  // Rate limit configuration (30 requests per minute)
  rateLimit: {
    maxRequestsPerMinute: 30,
    // Exponential backoff parameters
    initialBackoffMs: 1000,
    maxBackoffMs: 60000,
    backoffFactor: 2,
    jitterFactor: 0.1,
  },
};

interface PrivyUser {
  id: string;
  created_at: number;
  is_guest: boolean;
  linked_accounts: Array<{
    type: string;
    address?: string;
    verified_at?: number;
  }>;
}

interface PrivyResponse {
  data: PrivyUser[];
  next_cursor: string | null;
}

// Add sleep utility function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatUserToCsvRow(user: PrivyUser): string {
  const emailAccount = user.linked_accounts.find((acc) => acc.type === "email");
  const walletAccount = user.linked_accounts.find(
    (acc) => acc.type === "wallet"
  );

  const row = [
    user.id || "",
    user.created_at || "",
    user.is_guest || false,
    emailAccount?.address || "",
    walletAccount?.address || "",
    user.linked_accounts.length,
  ]
    .map((value) => `"${value}"`)
    .join(",");

  return row;
}

function appendUsersToFile(users: PrivyUser[], isFirstBatch: boolean = false) {
  const csv: string[] = [];

  // Add header if this is the first batch
  if (isFirstBatch) {
    csv.push("id,createdAt,isGuest,email,wallet,linkedAccounts");
  }

  users.forEach((user) => {
    csv.push(formatUserToCsvRow(user));
  });

  fs.appendFileSync(USERS_FILE, csv.join("\n") + "\n");
}

function saveCursor(cursor: string | null) {
  fs.writeFileSync(CURSOR_FILE, cursor || "");
}

function loadSavedCursor(): string | null {
  try {
    if (fs.existsSync(CURSOR_FILE)) {
      const cursor = fs.readFileSync(CURSOR_FILE, "utf-8").trim();
      return cursor || null;
    }
  } catch (error) {
    console.warn("Error reading cursor file:", error);
  }
  return null;
}

const fetchPageOfUsers = async (cursor?: string): Promise<PrivyResponse> => {
  const url =
    "https://auth.privy.io/api/v1/users" + (cursor ? `?cursor=${cursor}` : "");

  let retries = 0;
  let backoffMs = CONFIG.rateLimit.initialBackoffMs;

  while (true) {
    try {
      console.log(`Fetching users from ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`
          ).toString("base64")}`,
          "privy-app-id": PRIVY_APP_ID,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit - apply exponential backoff
          retries++;
          // Add jitter to avoid thundering herd problem
          const jitter =
            1 + (Math.random() * 2 - 1) * CONFIG.rateLimit.jitterFactor;
          backoffMs = Math.min(
            backoffMs * CONFIG.rateLimit.backoffFactor * jitter,
            CONFIG.rateLimit.maxBackoffMs
          );

          console.log(
            `Rate limit exceeded. Retrying in ${Math.round(
              backoffMs / 1000
            )} seconds... (Retry ${retries})`
          );
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Apply standard rate limiting delay after successful request
      // Ensure we don't exceed 30 requests per minute
      await sleep(
        Math.max(
          CONFIG.rateLimitMs,
          60000 / CONFIG.rateLimit.maxRequestsPerMinute
        )
      );

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes("HTTP error")) {
        throw error; // Don't retry on HTTP errors other than 429
      }

      // For network errors, also apply exponential backoff
      retries++;
      if (retries > 5) {
        throw new Error(
          `Failed after ${retries} retries: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Add jitter to avoid thundering herd problem
      const jitter =
        1 + (Math.random() * 2 - 1) * CONFIG.rateLimit.jitterFactor;
      backoffMs = Math.min(
        backoffMs * CONFIG.rateLimit.backoffFactor * jitter,
        CONFIG.rateLimit.maxBackoffMs
      );

      console.log(
        `Network error. Retrying in ${Math.round(
          backoffMs / 1000
        )} seconds... (Retry ${retries})`
      );
      await sleep(backoffMs);
    }
  }
};

async function getAllUsers(): Promise<void> {
  let cursor = loadSavedCursor();
  let isFirstBatch = !cursor; // If no cursor, this is the first batch
  let totalUsers = 0;

  try {
    do {
      // Add cooldown period after every batch of users
      if (totalUsers > 0 && totalUsers % CONFIG.usersBatchSize === 0) {
        console.log(
          `Reached ${totalUsers} users. Taking a ${
            CONFIG.batchCooldownMs / 1000
          } second break to avoid rate limits...`
        );
        await sleep(CONFIG.batchCooldownMs);
      }

      const query = await fetchPageOfUsers(cursor || undefined);

      if (!query.data || !Array.isArray(query.data)) {
        throw new Error("Invalid response format from Privy API");
      }

      if (query.data.length > 0) {
        appendUsersToFile(query.data, isFirstBatch);
        totalUsers += query.data.length;
        console.log(
          `Processed ${query.data.length} users (total: ${totalUsers})`
        );
        isFirstBatch = false;
      }

      cursor = query.next_cursor;
      saveCursor(cursor);

      // If we got an empty array and no next cursor, we're done
      if (query.data.length === 0 && !cursor) {
        break;
      }
    } while (cursor !== null);

    // Clear cursor file when done
    fs.unlinkSync(CURSOR_FILE);
    console.log(`Successfully exported ${totalUsers} users to ${USERS_FILE}`);
  } catch (error) {
    console.error("Error during user fetching:", error);
    console.log(
      "Current cursor saved. Run the script again to resume from where it left off."
    );
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const savedCursor = loadSavedCursor();
    console.log(
      savedCursor
        ? `Resuming user fetch from saved cursor: ${savedCursor}`
        : "Starting fresh user fetch from Privy..."
    );

    await getAllUsers();
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && error.cause) {
      console.error("Cause:", error.cause);
    }
    process.exit(1);
  }
}

main();
