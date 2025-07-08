import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getNeynarUser } from "~/lib/neynar";
import { APP_NAME } from "~/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get("fid");

  const user = fid ? await getNeynarUser(Number(fid)) : null;

  return new ImageResponse(
    (
      <div tw="flex h-full w-full flex-col justify-center items-center relative bg-gradient-to-br from-purple-600 to-pink-600">
        {/* Background pattern */}
        <div tw="absolute inset-0 opacity-10">
          <div
            tw="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25% 25%, white 2px, transparent 2px)",
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        {/* Main content */}
        <div tw="flex flex-col items-center justify-center relative z-10">
          {user?.pfp_url && (
            <div tw="flex w-32 h-32 rounded-full overflow-hidden mb-6 border-4 border-white shadow-lg">
              <img
                src={user.pfp_url}
                alt="Profile"
                tw="w-full h-full object-cover"
              />
            </div>
          )}

          <h1 tw="text-6xl font-bold text-white text-center mb-4">
            {user?.display_name || user?.username
              ? `${user.display_name || user.username} is betting!`
              : "Join the betting fun!"}
          </h1>

          <div tw="flex items-center space-x-4 text-white text-3xl">
            <span tw="text-4xl">💸</span>
            <span tw="font-semibold">{APP_NAME}</span>
            <span tw="text-4xl">💸</span>
          </div>

          <p tw="text-2xl mt-6 text-white opacity-90 text-center">
            Bet with friends on Farcaster
          </p>
        </div>

        {/* Bottom branding */}
        <div tw="absolute bottom-8 left-8 right-8 flex justify-between items-center">
          <div tw="flex items-center space-x-2 text-white text-xl">
            <span tw="text-2xl">💸</span>
            <span>Powered by Neynar</span>
          </div>
          <div tw="text-white text-xl opacity-80">betcaster.vercel.app</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
