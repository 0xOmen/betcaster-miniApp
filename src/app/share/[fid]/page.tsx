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
  params: Promise<{ fid: string }>;
}): Promise<Metadata> {
  const { fid } = await params;
  const imageUrl = `${APP_URL}/api/opengraph-image?fid=${fid}`;

  // Fetch user data for personalized metadata
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

export default function SharePage() {
  redirect("/");
}
