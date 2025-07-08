import { NextRequest, NextResponse } from "next/server";
import {
  APP_NAME,
  APP_DESCRIPTION,
  APP_URL,
  APP_ICON_URL,
} from "~/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const fid = searchParams.get("fid");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  const embedUrl = fid ? `${APP_URL}/share/${fid}` : APP_URL;
  const title = fid ? `${APP_NAME} - Share` : APP_NAME;

  const oembedData = {
    type: "rich",
    version: "1.0",
    title: title,
    description: APP_DESCRIPTION,
    provider_name: APP_NAME,
    provider_url: APP_URL,
    url: embedUrl,
    html: `<iframe src="${embedUrl}" width="600" height="400" frameborder="0" allowfullscreen></iframe>`,
    width: 600,
    height: 400,
    thumbnail_url: APP_ICON_URL,
    thumbnail_width: 512,
    thumbnail_height: 512,
  };

  return NextResponse.json(oembedData, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
