/* eslint-disable @typescript-eslint/no-unused-vars */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabase } from "~/lib/supabase";
import { getTokenName } from "~/lib/betUtils";

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

    // Validate required parameters
    if (!betNumber) {
      return new Response("Missing bet number", { status: 400 });
    }

    // Fetch bet details from database
    const { data: bet, error } = await supabase
      .from("bets")
      .select("*")
      .eq("bet_number", parseInt(betNumber))
      .single();

    if (error || !bet) {
      console.error("Error fetching bet:", error);
      return new Response("Bet not found", { status: 404 });
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
            backgroundColor: "#ffc8dc",
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
              border: "2px solid #ffc8dc",
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
                fontSize: "28px",
                color: "#9CA3AF",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              {bet.makerProfile?.username || "Maker"} vs{" "}
              {bet.taker_address ===
              "0x0000000000000000000000000000000000000000"
                ? "Anyone"
                : bet.takerProfile?.username || "Taker"}
            </div>
            <div
              style={{
                fontSize: "40px",
                color: "#10B981",
                fontWeight: "bold",
                textAlign: "center",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span>{formatAmount(bet.bet_amount.toString())}</span>
              <span>{getTokenName(bet.bet_token_address)}</span>
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
    console.error("Error generating OG image:", e);
    return new Response(
      `Failed to generate image: ${
        e instanceof Error ? e.message : "Unknown error"
      }`,
      { status: 500 }
    );
  }
}
