import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const betNumber = searchParams.get("betNumber");
    const amount = searchParams.get("amount");
    const token = searchParams.get("token");

    // Validate required parameters
    if (!betNumber || !amount || !token) {
      return new Response("Missing required parameters", { status: 400 });
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1F2937",
            padding: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #4B5563",
              borderRadius: "16px",
              padding: "32px",
              backgroundColor: "#111827",
            }}
          >
            <h1
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "#F3F4F6",
                marginBottom: "16px",
              }}
            >
              Betcaster
            </h1>
            <h2
              style={{
                fontSize: "32px",
                color: "#9CA3AF",
                marginBottom: "24px",
              }}
            >
              Bet #{betNumber}
            </h2>
            <div
              style={{
                fontSize: "40px",
                color: "#10B981",
                fontWeight: "bold",
              }}
            >
              {amount} {token}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error(e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
