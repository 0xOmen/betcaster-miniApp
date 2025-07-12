import type { Metadata } from "next";

import { getSession } from "~/auth";
import "~/app/globals.css";
import { Providers } from "~/app/providers";
import {
  APP_NAME,
  APP_DESCRIPTION,
  APP_URL,
  APP_ICON_URL,
  APP_OG_IMAGE_URL,
} from "~/lib/constants";

export const generateMetadata = async ({
  searchParams,
}: {
  searchParams: { betNumber?: string };
}): Promise<Metadata> => {
  const betNumber = searchParams?.betNumber;

  const baseMetadata = {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    metadataBase: new URL(APP_URL),
    openGraph: {
      type: "website",
      title: APP_NAME,
      description: APP_DESCRIPTION,
      url: APP_URL,
      siteName: APP_NAME,
      images: [
        {
          url: betNumber
            ? `${APP_URL}/api/og?betNumber=${betNumber}`
            : APP_OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: betNumber ? `Betcaster Bet #${betNumber}` : APP_NAME,
        },
        {
          url: APP_ICON_URL,
          width: 512,
          height: 512,
          alt: `${APP_NAME} Icon`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: betNumber ? `Betcaster Bet #${betNumber}` : APP_NAME,
      description: APP_DESCRIPTION,
      images: [
        betNumber
          ? `${APP_URL}/api/og?betNumber=${betNumber}`
          : APP_OG_IMAGE_URL,
      ],
    },
    other: {
      "fc:frame": JSON.stringify({
        version: "1",
        imageUrl: betNumber
          ? `${APP_URL}/api/og?betNumber=${betNumber}`
          : APP_OG_IMAGE_URL,
        button: {
          title: betNumber ? "View Bet Details" : "Bet with Friends!",
          action: {
            type: "launch_miniapp",
            name: APP_NAME,
            url: betNumber
              ? `${APP_URL}?tab=explore&betNumber=${betNumber}`
              : APP_URL,
            splashImageUrl: APP_ICON_URL,
            iconUrl: APP_ICON_URL,
            splashBackgroundColor: "#ffc8dc",
            description: betNumber
              ? `Check out Bet #${betNumber} on Betcaster!`
              : APP_DESCRIPTION,
            primaryCategory: "social",
            tags: ["betting", "prediction", "social", "blockchain", "defi"],
          },
        },
      }),
    },
  };

  return baseMetadata;
};

export default async function RootLayout({
  children,
  searchParams,
}: {
  children: React.ReactNode;
  searchParams: { betNumber?: string };
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
