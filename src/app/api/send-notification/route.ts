/* eslint-disable @typescript-eslint/no-unused-vars */
import { notificationDetailsSchema } from "@farcaster/frame-sdk";
import { NextRequest } from "next/server";
import { z } from "zod";
import { setUserNotificationDetails } from "~/lib/kv";
import { sendMiniAppNotification } from "~/lib/notifs";
import { sendNeynarMiniAppNotification } from "~/lib/neynar";
import {
  NotificationService,
  NotificationType,
  NotificationData,
} from "~/lib/notificationService";

const requestSchema = z.object({
  fid: z.number(),
  notificationDetails: notificationDetailsSchema,
});

const betNotificationSchema = z.object({
  type: z.enum([
    "bet_edited",
    "bet_accepted",
    "bet_rejected",
    "bet_cancelled",
    "arbiter_selected",
    "winner_selected",
    "bet_forfeited",
    "winnings_claimed",
  ] as const),
  targetFid: z.number(),
  data: z.object({
    betNumber: z.number(),
    betAmount: z.string().optional(),
    tokenName: z.string().optional(),
    makerName: z.string().optional(),
    takerName: z.string().optional(),
    arbiterName: z.string().optional(),
    betAgreement: z.string().optional(),
    endTime: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  const neynarEnabled =
    process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID;

  try {
    const requestJson = await request.json();

    // Try to parse as bet notification first
    const betNotificationBody = betNotificationSchema.safeParse(requestJson);

    if (betNotificationBody.success) {
      // This is a bet notification using our new service
      const { type, targetFid, data } = betNotificationBody.data;

      const result = await NotificationService.sendNotification({
        type,
        targetFid,
        data,
      });

      if (result.state === "error") {
        return Response.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      } else if (result.state === "rate_limit") {
        return Response.json(
          { success: false, error: "Rate limited" },
          { status: 429 }
        );
      }

      return Response.json({ success: true, result: result.state });
    }

    // Fall back to legacy notification format
    const requestBody = requestSchema.safeParse(requestJson);

    if (requestBody.success === false) {
      return Response.json(
        { success: false, errors: requestBody.error.errors },
        { status: 400 }
      );
    }

    // Only store notification details if not using Neynar
    if (!neynarEnabled) {
      await setUserNotificationDetails(
        Number(requestBody.data.fid),
        requestBody.data.notificationDetails
      );
    }

    // Use appropriate notification function based on Neynar status
    const sendNotification = neynarEnabled
      ? sendNeynarMiniAppNotification
      : sendMiniAppNotification;
    const sendResult = await sendNotification({
      fid: Number(requestBody.data.fid),
      title: "Test notification",
      body: "Sent at " + new Date().toISOString(),
    });

    if (sendResult.state === "error") {
      return Response.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    } else if (sendResult.state === "rate_limit") {
      return Response.json(
        { success: false, error: "Rate limited" },
        { status: 429 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error in notification API:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
