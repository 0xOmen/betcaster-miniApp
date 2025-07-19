/* eslint-disable @typescript-eslint/no-unused-vars */
import { sendNeynarMiniAppNotification } from "./neynar";
import { APP_URL } from "./constants";

export type NotificationType =
  | "bet_edited"
  | "bet_accepted"
  | "bet_rejected"
  | "bet_cancelled"
  | "arbiter_selected"
  | "winner_selected"
  | "bet_forfeited"
  | "winnings_claimed";

export interface NotificationData {
  betNumber: number;
  betAmount?: string;
  tokenName?: string;
  makerName?: string;
  takerName?: string;
  arbiterName?: string;
  betAgreement?: string;
  endTime?: string;
}

export interface NotificationConfig {
  type: NotificationType;
  targetFid: number;
  data: NotificationData;
}

type SendNotificationResult =
  | {
      state: "error";
      error: unknown;
    }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

export class NotificationService {
  private static getNotificationContent(config: NotificationConfig): {
    title: string;
    body: string;
  } {
    const { type, data } = config;

    switch (type) {
      case "bet_edited":
        return {
          title: `Bet #${data.betNumber} Updated`,
          body: `${
            data.makerName || "A user"
          } has updated the terms of your bet. Check the new details!`,
        };

      case "bet_accepted":
        return {
          title: `Bet #${data.betNumber} Accepted`,
          body: `${
            data.takerName || "A user"
          } has accepted your bet! The game is on.`,
        };

      case "bet_rejected":
        return {
          title: `Bet #${data.betNumber} Rejected`,
          body: `${data.takerName || "A user"} has rejected your bet.`,
        };

      case "bet_cancelled":
        return {
          title: `Bet #${data.betNumber} Cancelled`,
          body: `${data.makerName || "A user"} has cancelled this bet.`,
        };

      case "arbiter_selected":
        return {
          title: `Arbiter Selected for Bet #${data.betNumber}`,
          body: `${
            data.arbiterName || "An arbiter"
          } has been selected to judge this bet.`,
        };

      case "winner_selected":
        return {
          title: `Winner Selected for Bet #${data.betNumber}`,
          body: `${
            data.arbiterName || "The arbiter"
          } has selected a winner for this bet!`,
        };

      case "bet_forfeited":
        return {
          title: `Bet #${data.betNumber} Forfeited`,
          body: `${data.takerName || "A user"} has forfeited this bet.`,
        };

      case "winnings_claimed":
        return {
          title: `Winnings Claimed for Bet #${data.betNumber}`,
          body: `Congratulations! Winnings have been claimed for this bet.`,
        };

      default:
        return {
          title: "Betcaster Update",
          body: "You have a new update about your bet.",
        };
    }
  }

  static async sendNotification(
    config: NotificationConfig
  ): Promise<SendNotificationResult> {
    try {
      const { title, body } = this.getNotificationContent(config);

      // Use Neynar for sending notifications
      const result = await sendNeynarMiniAppNotification({
        fid: config.targetFid,
        title,
        body,
      });

      console.log(`Notification sent to FID ${config.targetFid}:`, {
        type: config.type,
        title,
        body,
        result: result.state,
      });

      return result;
    } catch (error) {
      console.error("Error sending notification:", error);
      return { state: "error", error };
    }
  }

  static async sendBetEditedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_edited",
      targetFid,
      data,
    });
  }

  static async sendBetAcceptedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_accepted",
      targetFid,
      data,
    });
  }

  static async sendBetRejectedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_rejected",
      targetFid,
      data,
    });
  }

  static async sendBetCancelledNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_cancelled",
      targetFid,
      data,
    });
  }

  static async sendArbiterSelectedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "arbiter_selected",
      targetFid,
      data,
    });
  }

  static async sendWinnerSelectedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "winner_selected",
      targetFid,
      data,
    });
  }

  static async sendBetForfeitedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_forfeited",
      targetFid,
      data,
    });
  }

  static async sendWinningsClaimedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "winnings_claimed",
      targetFid,
      data,
    });
  }
}
