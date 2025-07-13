/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  params: { fid: string };
}): Promise<Metadata> {
  try {
    const { fid } = params;
    console.log("Generating image from [fid]/page.tsx");

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
    }

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
  } catch (error) {
    console.error("Error generating metadata:", error);
    throw error;
  }
}

export default async function SharePage({
  params,
}: {
  params: { fid: string };
}) {
  try {
    const { fid } = params;

    // Check if this is a bet number (starts with 'B')
    if (fid.startsWith("B")) {
      const betNumber = fid.substring(1); // Remove the 'B' prefix
      redirect(`/?tab=explore&betNumber=${betNumber}`);
    }

    // Otherwise redirect to home (FID case)
    redirect("/");
  } catch (error) {
    console.error("Error redirecting in SharePage:", error);
    throw error;
  }
}
