/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Bet } from "~/types/bet";
import { getStatusInfo, formatEndTime, getTokenName } from "~/lib/betUtils";
import { getTokenByAddress } from "~/lib/tokens";

// Helper function to check if an address is in an array
function isAddressInArray(
  address: string,
  addressArray: string[] | null
): boolean {
  if (!addressArray || addressArray.length === 0) return false;
  return addressArray.some(
    (addr) => addr.toLowerCase() === address.toLowerCase()
  );
}

interface BetDetailsModalProps {
  bet: Bet;
  currentUserAddress?: string;
  currentUserFid?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (bet: Bet) => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onForfeit?: () => void;
  onClaimWinnings?: () => void;
  onAcceptArbiter?: () => void;
  onSelectWinner?: () => void;
  onRefreshFromChain?: () => void;
  isApproving?: boolean;
  isAccepting?: boolean;
  isCancelling?: boolean;
  isForfeiting?: boolean;
  isClaiming?: boolean;
  isAcceptingArbiter?: boolean;
  isSelectingWinner?: boolean;
  isRefreshingFromChain?: boolean;
  showApprovalSuccess?: boolean;
}

export function BetDetailsModal({
  bet,
  currentUserAddress,
  currentUserFid,
  isOpen,
  onClose,
  onShare,
  onCancel,
  onAccept,
  onForfeit,
  onClaimWinnings,
  onAcceptArbiter,
  onSelectWinner,
  onRefreshFromChain,
  isApproving,
  isAccepting,
  isCancelling,
  isForfeiting,
  isClaiming,
  isAcceptingArbiter,
  isSelectingWinner,
  isRefreshingFromChain,
  showApprovalSuccess,
}: BetDetailsModalProps) {
  if (!isOpen) return null;

  const effectiveFid = currentUserFid ?? undefined;
  const statusInfo = getStatusInfo(bet, currentUserAddress, effectiveFid);
  const isMaker =
    currentUserAddress?.toLowerCase() === bet.maker_address.toLowerCase() ||
    currentUserFid === bet.maker_fid;
  const isTaker =
    (currentUserAddress &&
      isAddressInArray(currentUserAddress, bet.taker_address)) ||
    currentUserFid === bet.taker_fid;
  const isArbiter =
    (currentUserAddress &&
      isAddressInArray(currentUserAddress, bet.arbiter_address)) ||
    currentUserFid === bet.arbiter_fid;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* Approval Success Message */}
          {showApprovalSuccess && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
              ✅ Token approval successful! You can now accept the bet.
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Bet #{bet.bet_number}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Status Badge */}
          <div className="mb-4">
            <div
              className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${statusInfo.bgColor}`}
            >
              {statusInfo.text}
            </div>
          </div>

          {/* Warning Messages */}
          {bet.status === 2 && (isMaker || isTaker) && onForfeit && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Warning: You will lose your tokens
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>
                      By forfeiting this bet, you will permanently lose the
                      tokens you wagered. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isTaker && bet.status === 0 && onAccept && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Important: You will lose if the bet agreement is true
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <p>
                      By accepting this bet, you agree that you will lose your
                      tokens if the bet agreement is determined to be true by
                      the arbiter. Make sure you understand the bet conditions
                      before proceeding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isMaker && bet.status === 0 && onCancel && (
            <div className="mb-4">
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Cancelling..." : "Cancel Bet"}
              </button>
            </div>
          )}

          {isTaker && bet.status === 0 && onAccept && (
            <div className="mb-4">
              <button
                onClick={onAccept}
                disabled={isAccepting || isApproving}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving
                  ? "Approving..."
                  : isAccepting
                    ? "Accepting..."
                    : "Accept Bet"}
              </button>
            </div>
          )}

          {(isArbiter ||
            (bet.arbiter_address?.[0] ===
              "0x0000000000000000000000000000000000000000" &&
              !isMaker &&
              !isArbiter)) &&
            bet.status === 1 &&
            onAcceptArbiter && (
              <div className="mb-4">
                <button
                  onClick={onAcceptArbiter}
                  disabled={isAcceptingArbiter}
                  className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAcceptingArbiter ? "Accepting..." : "Accept Arbiter Role"}
                </button>
              </div>
            )}

          {bet.status === 2 && (isMaker || isTaker) && onForfeit && (
            <div className="mb-4">
              <button
                onClick={onForfeit}
                disabled={isForfeiting}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isForfeiting ? "Forfeiting..." : "Forfeit Bet"}
              </button>
            </div>
          )}

          {/* Arbiter Select Winner Actions for Status 2 */}
          {bet.status === 2 &&
            isArbiter &&
            onSelectWinner &&
            (bet.can_settle_early ||
              Math.floor(Date.now() / 1000) > bet.end_time) && (
              <div className="mb-4">
                <button
                  onClick={onSelectWinner}
                  disabled={isSelectingWinner}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSelectingWinner ? "Selecting Winner..." : "Select Winner"}
                </button>
              </div>
            )}

          {((bet.status === 4 && isMaker) || (bet.status === 5 && isTaker)) &&
            onClaimWinnings && (
              <div className="mb-4">
                <button
                  onClick={onClaimWinnings}
                  disabled={isClaiming}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? "Claiming..." : "Claim Winnings!"}
                </button>
              </div>
            )}

          {/* Cancel Bet Button for status 9 and Maker */}
          {isMaker && bet.status === 9 && onCancel && (
            <div className="mb-4">
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Cancelling..." : "Cancel Bet"}
              </button>
            </div>
          )}

          {/* Bet Agreement */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Maker will win if:
            </h3>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {bet.bet_agreement || "No description provided"}
              </p>
            </div>
          </div>

          {/* Participants */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Participants
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Maker:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {bet.makerProfile
                    ? bet.makerProfile.display_name || bet.makerProfile.username
                    : bet.maker_address}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Taker:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {bet.takerProfile
                    ? bet.takerProfile.display_name || bet.takerProfile.username
                    : bet.taker_address}
                </span>
              </div>
              {bet.arbiterProfile && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Arbiter:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {bet.arbiterProfile.display_name ||
                      bet.arbiterProfile.username}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bet Details */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bet Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Wager:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {bet.bet_amount}
                </span>
                <div className="flex items-center space-x-2">
                  {(() => {
                    const token = getTokenByAddress(bet.bet_token_address);
                    return (
                      <>
                        {token && (
                          <img
                            src={token.image}
                            alt={token.name}
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {getTokenName(bet.bet_token_address)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Arbiter Fee - added between Wager and End Time */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Arbiter Fee:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {bet.arbiter_fee}%
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  End Time:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatEndTime(bet.end_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Refresh from Chain Button */}
          {onRefreshFromChain && (
            <div className="mt-4">
              <button
                onClick={onRefreshFromChain}
                disabled={isRefreshingFromChain}
                className={`w-full px-4 py-2 bg-blue-500 text-white rounded-lg transition-colors ${
                  isRefreshingFromChain
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-600"
                }`}
              >
                {isRefreshingFromChain ? "Refreshing..." : "Refresh from Chain"}
              </button>
            </div>
          )}

          {/* Share Button */}
          {onShare && (
            <div className="mt-4">
              <button
                onClick={() => onShare(bet)}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Share on Farcaster
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
