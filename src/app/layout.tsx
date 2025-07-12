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

export const metadata: Metadata = {
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
        url: APP_OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: APP_NAME,
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
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [APP_OG_IMAGE_URL],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "1",
      imageUrl: APP_OG_IMAGE_URL,
      button: {
        title: "Bet with Friends!",
        action: {
          type: "launch_miniapp",
          name: APP_NAME,
          url: APP_URL,
          splashImageUrl: APP_ICON_URL,
          iconUrl: APP_ICON_URL,
          splashBackgroundColor: "#ffc8dc",
          description: APP_DESCRIPTION,
          primaryCategory: "social",
          tags: ["betting", "prediction", "social", "blockchain", "defi"],
        },
      },
    }),
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
