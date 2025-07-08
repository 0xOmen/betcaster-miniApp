import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { mnemonicToAccount } from "viem/accounts";
import {
  APP_BUTTON_TEXT,
  APP_DESCRIPTION,
  APP_ICON_URL,
  APP_NAME,
  APP_OG_IMAGE_URL,
  APP_PRIMARY_CATEGORY,
  APP_SPLASH_BACKGROUND_COLOR,
  APP_TAGS,
  APP_URL,
  APP_WEBHOOK_URL,
} from "./constants";
import { APP_SPLASH_URL } from "./constants";

interface MiniAppMetadata {
  version: string;
  name: string;
  iconUrl: string;
  homeUrl: string;
  imageUrl?: string;
  buttonTitle?: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  webhookUrl?: string;
  description?: string;
  primaryCategory?: string;
  tags?: string[];
}

interface MiniAppManifest {
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };
  miniapp: MiniAppMetadata;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSecretEnvVars() {
  const seedPhrase = process.env.SEED_PHRASE;
  const fid = process.env.FID;

  if (!seedPhrase || !fid) {
    return null;
  }

  return { seedPhrase, fid };
}

export function getMiniAppEmbedMetadata(ogImageUrl?: string) {
  return {
    version: "1",
    imageUrl: ogImageUrl ?? APP_OG_IMAGE_URL,
    button: {
      title: APP_BUTTON_TEXT ?? "Bet with Friends!",
      action: {
        type: "launch_miniapp",
        name: APP_NAME ?? "Betcaster",
        url: APP_URL,
        splashImageUrl: APP_SPLASH_URL,
        iconUrl: APP_ICON_URL,
        splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
        description: APP_DESCRIPTION,
        primaryCategory: APP_PRIMARY_CATEGORY || "social",
        tags: APP_TAGS || [
          "betting",
          "prediction",
          "social",
          "blockchain",
          "defi",
        ],
        requiredChains: ["eip155:8453"], // Base chain
        noindex: false,
      },
    },
  };
}

export async function getFarcasterMetadata(): Promise<MiniAppManifest> {
  // First check for MINI_APP_METADATA in .env and use that if it exists
  if (process.env.MINI_APP_METADATA) {
    try {
      const metadata = JSON.parse(process.env.MINI_APP_METADATA);
      console.log("Using pre-signed mini app metadata from environment");
      return metadata;
    } catch (error) {
      console.warn(
        "Failed to parse MINI_APP_METADATA from environment:",
        error
      );
    }
  }

  if (!APP_URL) {
    throw new Error("NEXT_PUBLIC_URL not configured");
  }

  // Get the domain from the URL (without https:// prefix)
  const domain = new URL(APP_URL).hostname;
  console.log("Using domain for manifest:", domain);

  const secretEnvVars = getSecretEnvVars();
  if (!secretEnvVars) {
    console.warn(
      "No seed phrase or FID found in environment variables -- generating unsigned metadata"
    );
  }

  let accountAssociation;
  if (secretEnvVars) {
    // Generate account from seed phrase
    const account = mnemonicToAccount(secretEnvVars.seedPhrase);
    const custodyAddress = account.address;

    const header = {
      fid: parseInt(secretEnvVars.fid),
      type: "custody",
      key: custodyAddress,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), "utf-8").toString(
      "base64"
    );

    const payload = {
      domain,
    };
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      "utf-8"
    ).toString("base64url");

    const signature = await account.signMessage({
      message: `${encodedHeader}.${encodedPayload}`,
    });
    const encodedSignature = Buffer.from(signature, "utf-8").toString(
      "base64url"
    );

    accountAssociation = {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature,
    };
  }

  return {
    accountAssociation,
    miniapp: {
      version: "1",
      name: APP_NAME ?? "Betcaster",
      iconUrl: APP_ICON_URL,
      homeUrl: APP_URL,
      splashImageUrl: APP_SPLASH_URL,
      splashBackgroundColor: APP_SPLASH_BACKGROUND_COLOR,
      webhookUrl: APP_WEBHOOK_URL,
      description: APP_DESCRIPTION,
      primaryCategory: APP_PRIMARY_CATEGORY,
      tags: APP_TAGS,
      buttonTitle: APP_BUTTON_TEXT ?? "Bet with Friends!",
    },
  };
}

/**
 * Converts a timestamp to human-readable time remaining
 * @param endTime - Unix timestamp in seconds
 * @returns Human-readable string like "5 minutes", "2 hours", "3 days"
 */
export function getTimeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = endTime - now;

  if (timeLeft <= 0) {
    return "Time expired";
  }

  const minutes = Math.floor(timeLeft / 60);
  const hours = Math.floor(timeLeft / 3600);
  const days = Math.floor(timeLeft / 86400);

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
}
