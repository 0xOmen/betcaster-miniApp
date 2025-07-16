/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { RedirectType } from "next/navigation";
import {
  APP_URL,
  APP_NAME,
  APP_DESCRIPTION,
  APP_ICON_URL,
} from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import { getNeynarUser } from "~/lib/neynar";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fid: string }>;
}) {
  try {
    const { fid } = await params;

    // Check if this is a bet number (starts with 'B')
    if (fid.startsWith("B")) {
      const betNumber = fid.substring(1); // Remove the 'B' prefix
      const imageUrl = `${APP_URL}/api/og?betNumber=${betNumber}`;
      const title = `Check out Bet #${betNumber} on Betcaster!`;
      const description = `View the details of this bet on Betcaster, the social betting platform for Farcaster.`;

      return {
        title,
        description,
        metadataBase: new URL(APP_URL),
        openGraph: {
          type: "website",
          title,
          description,
          url: `${APP_URL}?tab=explore&betNumber=${betNumber}`,
          siteName: APP_NAME,
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
        other: {
          "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(imageUrl)),
        },
      };
    } else {
      // Handle FID case (original functionality)
      const imageUrl = `${APP_URL}/api/opengraph-image?fid=${fid}`;
      const user = await getNeynarUser(Number(fid));
      const title = user
        ? `${user.display_name || user.username} is betting on Betcaster!`
        : `${APP_NAME} - Share`;
      const description = user
        ? `${
            user.display_name || user.username
          } is using Betcaster to bet with friends on Farcaster! Join them and start betting.`
        : APP_DESCRIPTION;

      return {
        title,
        description,
        metadataBase: new URL(APP_URL),
        openGraph: {
          type: "website",
          title,
          description,
          url: `${APP_URL}/share/${fid}`,
          siteName: APP_NAME,
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
        other: {
          "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(imageUrl)),
        },
      };
    }
  } catch (error) {
    console.error("Error generating metadata:", error);
    throw error;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ fid: string }>;
}) {
  try {
    console.log("SharePage: Received params", params);
    const { fid } = await params;
    console.log("SharePage: Processing fid", fid);

    // Redirect to the appropriate page based on whether we have a bet number
    if (fid.toLowerCase().startsWith("b")) {
      const betNumber = fid.substring(1); // Remove the 'B' prefix
      console.log("SharePage: Redirecting to bet", betNumber);
      // Validate betNumber is numeric
      if (!betNumber || isNaN(Number(betNumber))) {
        console.error("SharePage: Invalid bet number", betNumber);
        return redirect("/", "replace" as RedirectType);
      }
      const redirectUrl = `${APP_URL}/?betNumber=${betNumber}`;
      console.log("SharePage: Redirect URL", redirectUrl);
      return redirect(redirectUrl, "replace" as RedirectType);
    }
    console.log("SharePage: Redirecting to home");
    return redirect("/", "replace" as RedirectType);
  } catch (error) {
    console.error("Error in SharePage:", error);
    throw error;
  }
}
