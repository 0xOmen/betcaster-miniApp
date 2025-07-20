export const APP_URL = process.env.NEXT_PUBLIC_URL!;
export const APP_NAME = process.env.NEXT_PUBLIC_MINI_APP_NAME;
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_MINI_APP_DESCRIPTION;
export const APP_PRIMARY_CATEGORY =
  process.env.NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY;
export const APP_TAGS = process.env.NEXT_PUBLIC_MINI_APP_TAGS?.split(",");
export const APP_ICON_URL = `${APP_URL}/icon.png`;
export const APP_OG_IMAGE_URL = `${APP_URL}/api/opengraph-image`;
export const APP_SPLASH_URL = `${APP_URL}/icon.png`;
export const APP_SPLASH_BACKGROUND_COLOR = "#ffc8dc";
export const APP_BUTTON_TEXT = process.env.NEXT_PUBLIC_MINI_APP_BUTTON_TEXT;
export const APP_WEBHOOK_URL =
  "https://api.neynar.com/f/app/7f5c805e-47e5-4013-8888-86bed79d77fe/event";
export const USE_WALLET = process.env.NEXT_PUBLIC_USE_WALLET === "true";

export const APP_METADATA = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  url: APP_URL,
  siteName: APP_NAME,
  images: {
    og: APP_OG_IMAGE_URL,
    icon: APP_ICON_URL,
    splash: APP_SPLASH_URL,
  },
  colors: {
    splashBackground: APP_SPLASH_BACKGROUND_COLOR,
  },
  tags: APP_TAGS || ["betting", "prediction", "social", "blockchain", "defi"],
  category: APP_PRIMARY_CATEGORY || "social",
};
