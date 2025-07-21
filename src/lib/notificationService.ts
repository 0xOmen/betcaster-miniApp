/* eslint-disable @typescript-eslint/no-unused-vars */
import { sendNeynarMiniAppNotification } from "./neynar";
import { APP_URL } from "./constants";

export type NotificationType =
  | "bet_created"
  | "bet_edited"
  | "bet_accepted"
  | "bet_rejected"
  | "bet_cancelled"
  | "bet_cancelled_by_taker"
  | "arbiter_accepted"
  | "arbiter_rejected"
  | "invite_arbiter"
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
      case "bet_created":
        return {
          title: `Bet #${data.betNumber} Created`,
          body: `${data.makerName || "A user"} created a bet with you.`,
        };

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
          } has accepted your bet! Awaiting arbiter acceptance.`,
        };

      case "bet_rejected":
        return {
          title: `Bet #${data.betNumber} Rejected`,
          body: `${
            data.takerName || "A user"
          } rejected your bet.  Edit or cancel now.`,
        };

      case "bet_cancelled":
        return {
          title: `Bet #${data.betNumber} Cancelled`,
          body: `${
            data.makerName || "A user"
          } cancelled this bet. User funds returned.`,
        };

      case "bet_cancelled_by_taker":
        return {
          title: `Bet #${data.betNumber} Cancelled`,
          body: `${
            data.takerName || "A user"
          } cancelled the bet. All funds returned.`,
        };

      case "arbiter_accepted":
        return {
          title: `Arbiter Accepted the Bet #${data.betNumber}`,
          body: `${
            data.arbiterName || "An arbiter"
          } agreed to judge this bet.  It's on!`,
        };

      case "arbiter_rejected":
        return {
          title: `Arbiter Rejected the Bet #${data.betNumber}`,
          body: `${
            data.arbiterName || "An arbiter"
          } rejected this bet. Cancel to reclaim funds`,
        };

      case "invite_arbiter":
        return {
          title: `Arbiter Invitation for Bet #${data.betNumber}`,
          body: `You have been invited to be the arbiter for a bet between ${
            data.makerName || "a user"
          } and ${data.takerName || "a user"}. Accept or decline the role.`,
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

  static async sendBetCreatedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_created",
      targetFid,
      data,
    });
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

  static async sendBetCancelledByTakerNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "bet_cancelled_by_taker",
      targetFid,
      data,
    });
  }

  static async sendArbiterSelectedNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "arbiter_accepted",
      targetFid,
      data,
    });
  }

  static async sendInviteArbiterNotification(
    targetFid: number,
    data: NotificationData
  ): Promise<SendNotificationResult> {
    return this.sendNotification({
      type: "invite_arbiter",
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
