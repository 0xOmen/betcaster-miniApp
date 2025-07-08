import Head from "next/head";
import { APP_METADATA } from "~/lib/constants";

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function MetaTags({
  title = APP_METADATA.title,
  description = APP_METADATA.description,
  image = APP_METADATA.images.og,
  url = APP_METADATA.url,
  type = "website",
}: MetaTagsProps) {
  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={APP_METADATA.siteName} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Farcaster Frame */}
      <meta
        property="fc:frame"
        content={JSON.stringify({
          version: "1",
          imageUrl: image,
          button: {
            title: "Bet with Friends!",
            action: {
              type: "launch_miniapp",
              name: APP_METADATA.title,
              url: APP_METADATA.url,
              splashImageUrl: APP_METADATA.images.splash,
              iconUrl: APP_METADATA.images.icon,
              splashBackgroundColor: APP_METADATA.colors.splashBackground,
              description: APP_METADATA.description,
              primaryCategory: APP_METADATA.category,
              tags: APP_METADATA.tags,
            },
          },
        })}
      />

      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#ffc8dc" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={APP_METADATA.title} />

      {/* Icons */}
      <link rel="icon" href={APP_METADATA.images.icon} />
      <link rel="apple-touch-icon" href={APP_METADATA.images.icon} />
    </Head>
  );
}
