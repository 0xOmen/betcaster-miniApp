/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Bet } from "~/types/bet";
import {
  getStatusInfo,
  getTokenName,
  getUserCanAcceptBet,
  getUserCanCancelBet,
  getUserCanForfeitBet,
  getUserCanClaimWinnings,
} from "~/lib/betUtils";
import { getTokenByAddress } from "~/lib/tokens";

interface BetCardProps {
  bet: Bet;
  currentUserAddress?: string;
  currentUserFid?: number | null;
  onBetSelect: (bet: Bet) => void;
  onRejectBet?: (bet: Bet) => void;
  onEditBet?: (bet: Bet) => void;
}

export function BetCard({
  bet,
  currentUserAddress,
  currentUserFid,
  onBetSelect,
  onRejectBet,
  onEditBet,
}: BetCardProps) {
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

  return (
    <div
      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      onClick={() => onBetSelect(bet)}
    >
      <div className="flex items-center space-x-3">
        {/* Profile Pictures */}
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

        {/* Bet Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Bet #{bet.bet_number}
            </div>
            <div
              className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bgColor}`}
            >
              {statusInfo.text}
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {bet.bet_agreement && bet.bet_agreement.length > 35
              ? `${bet.bet_agreement.substring(0, 35)}...`
              : bet.bet_agreement || "No description"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            {bet.makerProfile?.display_name || "Unknown"} vs{" "}
            {bet.takerProfile?.display_name || "Unknown"}
          </div>

          {/* Token Amount */}
          <div className="flex items-center space-x-1 mt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {bet.bet_amount}
            </span>
            {(() => {
              const token = getTokenByAddress(bet.bet_token_address);
              return (
                token && (
                  <img
                    src={token.image}
                    alt={token.name}
                    className="w-4 h-4 rounded-full"
                  />
                )
              );
            })()}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {getTokenName(bet.bet_token_address)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 mt-2">
            {/* Forfeit Button */}
            {canForfeitBet && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBetSelect(bet);
                }}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                Forfeit Bet
              </button>
            )}

            {/* Cancel and Edit Buttons */}
            {canCancelBet && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBetSelect(bet);
                  }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  Cancel
                </button>
                {onEditBet && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditBet(bet);
                    }}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </>
            )}

            {/* Accept/Reject Buttons */}
            {canAcceptBet && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBetSelect(bet);
                  }}
                  className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                >
                  Accept Bet
                </button>
                {onRejectBet && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRejectBet(bet);
                    }}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    Reject
                  </button>
                )}
              </>
            )}

            {/* Claim Winnings Button */}
            {canClaimWinnings && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBetSelect(bet);
                }}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              >
                Claim Winnings!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
