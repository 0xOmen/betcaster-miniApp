/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Bet } from "~/types/bet";
import {
  getStatusInfo,
  getTokenName,
  getUserCanAcceptBet,
  getUserCanCancelBet,
  getUserCanForfeitBet,
  getUserCanClaimWinnings,
  getUserCanSelectWinner,
} from "~/lib/betUtils";
import { getTokenByAddress } from "~/lib/tokens";

interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  primaryEthAddress?: string;
  primarySolanaAddress?: string;
}

interface BetTileProps {
  bet: Bet;
  currentUserAddress?: string;
  currentUserFid?: number | null;
  onBetSelect: (bet: Bet) => void;
  onRejectBet?: (bet: Bet) => void;
  onEditBet?: (bet: Bet) => void;
  onSelectWinner?: (bet: Bet) => void;
  onForfeit?: (bet: Bet) => void;
  onCancel?: (bet: Bet) => void;
  onAccept?: (bet: Bet) => void;
  onAcceptArbiter?: (bet: Bet) => void;
  onClaimWinnings?: (bet: Bet) => void;
}

export function BetTile({
  bet,
  currentUserAddress,
  currentUserFid,
  onBetSelect,
  onRejectBet,
  onEditBet,
  onSelectWinner,
  onForfeit,
  onCancel,
  onAccept,
  onAcceptArbiter,
  onClaimWinnings,
}: BetTileProps) {
  const effectiveFid = currentUserFid ?? undefined;
  const statusInfo = getStatusInfo(bet, currentUserAddress, effectiveFid);
  const canAcceptBet = getUserCanAcceptBet(
    bet,
    currentUserAddress,
    effectiveFid
  );
  const canCancelBet = getUserCanCancelBet(
    bet,
    currentUserAddress,
    effectiveFid
  );
  const canForfeitBet = getUserCanForfeitBet(
    bet,
    currentUserAddress,
    effectiveFid
  );
  const canClaimWinnings = getUserCanClaimWinnings(
    bet,
    currentUserAddress,
    effectiveFid
  );
  const canSelectWinner = getUserCanSelectWinner(
    bet,
    currentUserAddress,
    effectiveFid
  );

  // Helper function to check if user is arbiter
  const isArbiter = () => {
    return (
      (currentUserAddress &&
        bet.arbiter_address?.includes(currentUserAddress)) ||
      currentUserFid === bet.arbiter_fid
    );
  };

  // Helper function to check if user is maker
  const isMaker = () => {
    return (
      currentUserAddress === bet.maker_address ||
      currentUserFid === bet.maker_fid
    );
  };

  // Helper function to check if user is taker
  const isTaker = () => {
    return (
      (currentUserAddress && bet.taker_address.includes(currentUserAddress)) ||
      currentUserFid === bet.taker_fid
    );
  };

  return (
    <div
      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      onClick={() => onBetSelect(bet)}
    >
      <div className="flex items-start space-x-3">
        {/* Left column: Bet Number and Profile Pictures */}
        <div className="flex flex-col items-center space-y-2 flex-shrink-0">
          {/* Bet Number - top left */}
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Bet #{bet.bet_number}
          </div>

          {/* Profile Pictures - below bet number */}
          <div className="flex -space-x-2">
            {bet.makerProfile && (
              <img
                src={bet.makerProfile.pfp_url || ""}
                alt={bet.makerProfile.display_name || "Maker"}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            )}
            {bet.takerProfile && (
              <img
                src={bet.takerProfile.pfp_url || ""}
                alt={bet.takerProfile.display_name || "Taker"}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            )}
          </div>
        </div>

        {/* Bet Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-end mb-1">
            <div
              className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bgColor}`}
            >
              {statusInfo.text}
            </div>
          </div>

          {/* Bet Description - allow up to 2 lines */}
          <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
            {bet.bet_agreement || "No description"}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-500">
            {bet.makerProfile?.display_name || "Unknown"} vs{" "}
            {bet.takerProfile?.display_name || "Unknown"}
          </div>

          {/* Arbiter Actions for Status 2 */}
          {bet.status === 2 && (
            <>
              {/* Arbiter Select Winner Actions for Status 2 */}
              {isArbiter() &&
                (bet.can_settle_early ||
                  Math.floor(Date.now() / 1000) > bet.end_time) && (
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWinner?.(bet);
                      }}
                      className="px-2 py-1 text-xs bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
                    >
                      Select Winner
                    </button>
                  </div>
                )}

              {/* Maker/Taker Forfeit Actions for Status 2 */}
              {(isMaker() || isTaker()) && (
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onForfeit?.(bet);
                    }}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    Forfeit
                  </button>
                </div>
              )}
            </>
          )}

          {/* Maker Actions for Status 0 */}
          {isMaker() && bet.status === 0 && (
            <div className="flex space-x-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(bet);
                }}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBet?.(bet);
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              >
                Edit
              </button>
            </div>
          )}

          {/* Maker Actions for Status 9 (Rejected) */}
          {isMaker() && bet.status === 9 && (
            <div className="mb-4">
              <div className="flex space-x-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel?.(bet);
                  }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBet?.(bet);
                  }}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* Taker Actions for Status 0 */}
          {isTaker() &&
            bet.status === 0 &&
            Math.floor(Date.now() / 1000) <= bet.end_time && (
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept?.(bet);
                  }}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                >
                  Accept Bet
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRejectBet?.(bet);
                  }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}

          {/* Arbiter Actions for Status 1 */}
          {isArbiter() && bet.status === 1 && (
            <div className="flex space-x-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAcceptArbiter?.(bet);
                }}
                className="px-2 py-1 text-xs bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
              >
                Accept Arbiter Role
              </button>
              {/* Reject Arbiter Role Button */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  onRejectBet?.(bet);
                }}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                Reject Arbiter Role
              </button>
            </div>
          )}

          {/* Claim Winnings Actions for Status 4 and 5 */}
          {bet.status === 4 && isMaker() && (
            <div className="flex space-x-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimWinnings?.(bet);
                }}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              >
                Claim Winnings!
              </button>
            </div>
          )}

          {bet.status === 5 && isTaker() && (
            <div className="flex space-x-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimWinnings?.(bet);
                }}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              >
                Claim Winnings!
              </button>
            </div>
          )}

          {/* Arbiter Declined - Cancel option for maker/taker after 24h */}
          {(bet.status === 10 || bet.status === 1) &&
            (isMaker() || isTaker()) &&
            Math.floor(Date.now() / 1000) - bet.timestamp > 24 * 60 * 60 && (
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel?.(bet);
                  }}
                  className="px-2 py-1 text-xs bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
