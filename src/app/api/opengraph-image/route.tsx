import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getNeynarUser } from "~/lib/neynar";
import { APP_NAME } from "~/lib/constants";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");
  const betNumber = searchParams.get("betNumber");
  const amount = searchParams.get("amount");
  const token = searchParams.get("token");
  console.log("Generating image from opengraph-image/route.tsx");

  // If we have bet details, generate bet-specific image
  if (betNumber && amount && token) {
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
      }
    );
  }

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
            left: "32px",
            right: "32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "white",
              fontSize: "20px",
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
