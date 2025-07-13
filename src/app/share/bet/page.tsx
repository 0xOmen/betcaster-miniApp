import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_URL, APP_NAME } from "~/lib/constants";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ betNumber?: string }>;
}): Promise<Metadata> {
  try {
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.betNumber) {
      throw new Error("No bet number provided");
    }

    const imageUrl = `${APP_URL}/api/og?betNumber=${resolvedSearchParams.betNumber}`;
    const title = `Check out Bet #${resolvedSearchParams.betNumber} on Betcaster!`;
    const description = `View the details of this bet on Betcaster, the social betting platform for Farcaster.`;

    return {
      title,
      description,
      metadataBase: new URL(APP_URL),
      openGraph: {
        type: "website",
        title,
        description,
        url: `${APP_URL}?tab=explore&betNumber=${resolvedSearchParams.betNumber}`,
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
        "fc:frame": JSON.stringify({
          buttons: [{ label: "View Bet", action: "link" }],
          image: {
            src: imageUrl,
            aspectRatio: "1.91:1",
          },
          post: {
            title: `Betcaster Bet #${resolvedSearchParams.betNumber}`,
            description: description,
          },
        }),
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    throw error;
  }
}

export default async function ShareBetPage({
  searchParams,
}: {
  searchParams: Promise<{ betNumber?: string }>;
}) {
  try {
    const resolvedSearchParams = await searchParams;

    if (!resolvedSearchParams.betNumber) {
      redirect("/");
    }

    redirect(`/?tab=explore&betNumber=${resolvedSearchParams.betNumber}`);
  } catch (error) {
    console.error("Error redirecting in ShareBetPage:", error);
    throw error;
  }
}
