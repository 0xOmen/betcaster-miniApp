/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Bet } from "~/types/bet";
import { getTokenByAddress } from "~/lib/tokens";
import { getTimeRemaining } from "./utils";

export function getStatusInfo(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
) {
  const now = Math.floor(Date.now() / 1000);
  const { status, end_time, makerProfile, takerProfile, arbiterProfile } = bet;

  // Check if current user is the maker or taker
  const isMaker =
    (currentUserAddress &&
      currentUserAddress.toLowerCase() === bet.maker_address.toLowerCase()) ||
    (currentUserFid && currentUserFid === bet.maker_fid);
  const isTaker =
    (currentUserAddress &&
      currentUserAddress.toLowerCase() === bet.taker_address.toLowerCase()) ||
    (currentUserFid && currentUserFid === bet.taker_fid);

  switch (status) {
    case 0:
      // Check if end time has passed and current user is the maker or taker
      if (now > end_time && (isMaker || isTaker)) {
        return {
          text: "Bet timed out",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      }

      // Check if current user is the taker
      if (isTaker) {
        return {
          text: "Accept Bet?",
          bgColor:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      }
      return {
        text: `${takerProfile?.username || "Taker"} hasn't accepted`,
        bgColor:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      };
    case 9:
      // Rejected bet - show who rejected it
      if (isMaker) {
        return {
          text: `${takerProfile?.username || "Taker"} Rejected Bet`,
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      }
      return {
        text: "Bet Rejected",
        bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    case 1:
      // Check if current user is the arbiter
      const isArbiter =
        (currentUserAddress &&
          currentUserAddress.toLowerCase() ===
            bet.arbiter_address?.toLowerCase()) ||
        (currentUserFid && currentUserFid === bet.arbiter_fid);

      if (isArbiter) {
        return {
          text: "Accept Arbiter Role?",
          bgColor:
            "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        };
      }
      return {
        text: `${arbiterProfile?.username || "Arbiter"} needs to accept`,
        bgColor:
          "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      };
    case 2:
      const isEndTimePassed = now > end_time;
      if (isEndTimePassed) {
        return {
          text: `Awaiting ${arbiterProfile?.username || "Arbiter"}'s ruling`,
          bgColor:
            "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        };
      } else {
        const timeRemaining = getTimeRemaining(end_time);
        return {
          text: `${timeRemaining} left`,
          bgColor:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      }
    case 4:
      // Maker won
      if (isMaker) {
        return {
          text: "You Won!",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      } else if (isTaker) {
        return {
          text: "You Lost",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      } else {
        return {
          text: `${makerProfile?.username || "Maker"} Won`,
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      }
    case 5:
      // Taker won
      if (isTaker) {
        return {
          text: "You Won!",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      } else if (isMaker) {
        return {
          text: "You Lost",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      } else {
        return {
          text: `${takerProfile?.username || "Taker"} Won`,
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      }
    case 6:
      // Maker claimed winnings
      if (isMaker) {
        return {
          text: "You Won!",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      } else if (isTaker) {
        return {
          text: "You Lost",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      } else {
        return {
          text: `${makerProfile?.username || "Maker"} Won`,
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      }
    case 7:
      // Taker claimed winnings
      if (isTaker) {
        return {
          text: "You Won!",
          bgColor:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      } else if (isMaker) {
        return {
          text: "You Lost",
          bgColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        };
      } else {
        return {
          text: `${takerProfile?.username || "Taker"} Won`,
          bgColor:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
      }
    case 8:
      return {
        text: "Cancelled/Refunded",
        bgColor:
          "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      };
    default:
      return {
        text: "Unknown",
        bgColor:
          "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      };
  }
}

export function formatEndTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date
    .toLocaleString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

export function getTokenName(tokenAddress: string): string {
  const token = getTokenByAddress(tokenAddress);
  return token ? token.name : "Unknown Token";
}

export function getUserCanAcceptBet(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
): boolean {
  return (
    bet.status === 0 &&
    (currentUserAddress?.toLowerCase() === bet.taker_address.toLowerCase() ||
      currentUserFid === bet.taker_fid) &&
    Math.floor(Date.now() / 1000) <= bet.end_time
  );
}

export function getUserCanCancelBet(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
): boolean {
  return (
    bet.status === 0 &&
    (currentUserAddress?.toLowerCase() === bet.maker_address.toLowerCase() ||
      currentUserFid === bet.maker_fid)
  );
}

export function getUserCanForfeitBet(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
): boolean {
  return (
    bet.status === 2 &&
    (currentUserAddress?.toLowerCase() === bet.maker_address.toLowerCase() ||
      currentUserFid === bet.maker_fid ||
      currentUserAddress?.toLowerCase() === bet.taker_address.toLowerCase() ||
      currentUserFid === bet.taker_fid)
  );
}

export function getUserCanClaimWinnings(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
): boolean {
  const isMaker =
    currentUserAddress?.toLowerCase() === bet.maker_address.toLowerCase() ||
    currentUserFid === bet.maker_fid;
  const isTaker =
    currentUserAddress?.toLowerCase() === bet.taker_address.toLowerCase() ||
    currentUserFid === bet.taker_fid;

  return (
    (bet.status === 4 && isMaker) || // Maker won
    (bet.status === 5 && isTaker) // Taker won
  );
}

export function getUserCanSelectWinner(
  bet: Bet,
  currentUserAddress?: string,
  currentUserFid?: number
): boolean {
  return (
    bet.status === 2 &&
    Math.floor(Date.now() / 1000) > bet.end_time &&
    (currentUserAddress?.toLowerCase() === bet.arbiter_address?.toLowerCase() ||
      currentUserFid === bet.arbiter_fid)
  );
}
