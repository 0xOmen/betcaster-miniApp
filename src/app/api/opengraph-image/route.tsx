/* eslint-disable @typescript-eslint/no-unused-vars */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getNeynarUser } from "~/lib/neynar";
import { APP_NAME } from "~/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");

  // If we have FID, generate user-specific image
  const user = fid ? await getNeynarUser(Number(fid)) : null;

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          position: "relative",
          background: "linear-gradient(to bottom right, #9333ea, #db2777)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.1,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 25% 25%, white 2px, transparent 2px)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              width: "166px",
              height: "166px",
              borderRadius: "24px",
              overflow: "hidden",
              marginBottom: "24px",
              border: "4px solid white",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <img
              src={`${process.env.NEXT_PUBLIC_URL}/icon.png`}
              alt="Betcaster Logo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <h1
            style={{
              fontSize: "60px",
              fontWeight: "bold",
              color: "white",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            {user?.display_name || user?.username
              ? `${user.display_name || user.username} is betting!`
              : "Join the betting fun!?!"}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              color: "white",
              fontSize: "30px",
            }}
          >
            <span style={{ fontSize: "40px" }}>💸</span>
            <span style={{ fontWeight: 600 }}>{APP_NAME}</span>
            <span style={{ fontSize: "40px" }}>💸</span>
          </div>

          <p
            style={{
              fontSize: "24px",
              marginTop: "24px",
              color: "white",
              opacity: 0.9,
              textAlign: "center",
            }}
          >
            Bet with friends on Farcaster
          </p>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            left: "48px", // Increased left padding
            right: "48px", // Increased right padding
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "calc(100% - 96px)", // Explicit width calculation
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px", // Increased gap
              color: "white",
              fontSize: "20px",
              minWidth: "200px", // Ensure minimum width for text
            }}
          >
            <span style={{ fontSize: "24px" }}>💸</span>
            <span>Powered by Neynar</span>
          </div>
          <div style={{ color: "white", fontSize: "20px", opacity: 0.8 }}>
            betcaster.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );

  // Add cache control headers
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300"
  );

  return response;
}
