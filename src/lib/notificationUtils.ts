/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotificationService, NotificationData } from "./notificationService";

export const sendBetNotification = async (
  type:
    | "bet_edited"
    | "bet_accepted"
    | "bet_rejected"
    | "bet_cancelled"
    | "arbiter_selected"
    | "winner_selected"
    | "bet_forfeited"
    | "winnings_claimed",
  targetFid: number,
  data: NotificationData
) => {
  try {
    const response = await fetch("/api/send-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        targetFid,
        data,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Notification sent successfully:`, {
        type,
        targetFid,
        result,
      });
      return { success: true, result };
    } else {
      console.error(
        "Failed to send notification:",
        response.status,
        response.statusText
      );
      return { success: false, error: response.statusText };
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    return { success: false, error };
  }
};

// Convenience functions for common notification types
export const notifyBetEdited = (targetFid: number, data: NotificationData) =>
  sendBetNotification("bet_edited", targetFid, data);

export const notifyBetAccepted = (targetFid: number, data: NotificationData) =>
  sendBetNotification("bet_accepted", targetFid, data);

export const notifyBetRejected = (targetFid: number, data: NotificationData) =>
  sendBetNotification("bet_rejected", targetFid, data);

export const notifyBetCancelled = (targetFid: number, data: NotificationData) =>
  sendBetNotification("bet_cancelled", targetFid, data);

export const notifyArbiterSelected = (
  targetFid: number,
  data: NotificationData
) => sendBetNotification("arbiter_selected", targetFid, data);

export const notifyWinnerSelected = (
  targetFid: number,
  data: NotificationData
) => sendBetNotification("winner_selected", targetFid, data);

export const notifyBetForfeited = (targetFid: number, data: NotificationData) =>
  sendBetNotification("bet_forfeited", targetFid, data);

export const notifyWinningsClaimed = (
  targetFid: number,
  data: NotificationData
) => sendBetNotification("winnings_claimed", targetFid, data);
