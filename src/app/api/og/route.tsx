import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const formatAmount = (amount: string) => {
  try {
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;

    // If the number is very small (scientific notation)
    if (num < 0.0001) {
      return num.toExponential(4);
    }

    // Otherwise format with up to 4 decimal places
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  } catch {
    return amount;
  }
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const betNumber = searchParams.get("betNumber");
    const amount = searchParams.get("amount");
    const token = searchParams.get("token");

    // Validate required parameters
    if (!betNumber) {
      return new Response("Missing bet number", { status: 400 });
    }
    if (!amount) {
      return new Response("Missing amount", { status: 400 });
    }
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    // Load Inter font
    const interFont = await fetch(
      new URL(
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
      )
    ).then((res) => res.arrayBuffer());

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
            fontFamily: "Inter",
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
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h1
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "#F3F4F6",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              Betcaster
            </h1>
            <h2
              style={{
                fontSize: "32px",
                color: "#9CA3AF",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              Bet #{betNumber}
            </h2>
            <div
              style={{
                fontSize: "40px",
                color: "#10B981",
                fontWeight: "bold",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>{formatAmount(amount)}</span>
              <span>{token}</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: interFont,
            weight: 400,
            style: "normal",
          },
          {
            name: "Inter",
            data: interFont,
            weight: 700,
            style: "normal",
          },
        ],
      }
    );
  } catch (e) {
    console.error("Error generating OG image:", e);
    return new Response(
      `Failed to generate image: ${
        e instanceof Error ? e.message : "Unknown error"
      }`,
      { status: 500 }
    );
  }
}
