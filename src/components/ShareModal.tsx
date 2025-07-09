import { Dialog } from "~/components/ui/Dialog";
import { Button } from "~/components/ui/Button";
import { APP_URL } from "~/lib/constants";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  betDetails: {
    amount: string;
    token: string;
    taker: string;
    arbiter?: string;
  };
  userFid?: number | null;
}

export function ShareModal({
  isOpen,
  onClose,
  betDetails,
  userFid,
}: ShareModalProps) {
  const handleShare = async () => {
    if (!userFid) return;

    const shareUrl = `${APP_URL}/share/${userFid}`;
    const text = `I just created a ${betDetails.amount} ${betDetails.token} bet with @${betDetails.taker} on @betcaster\n\nCome bet with friends on Betcaster!`;

    // Open Warpcast with pre-filled cast
    window.open(
      `https://warpcast.com/~/compose?text=${encodeURIComponent(
        text
      )}&embeds[]=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Share Your Bet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Share this bet with {betDetails.taker}
            {betDetails.arbiter ? ` and ${betDetails.arbiter}` : ""} on
            Farcaster!
          </p>
          <div className="flex justify-end space-x-3">
            <Button className="bg-gray-100 hover:bg-gray-200" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-purple-500 hover:bg-purple-600 text-white"
              onClick={handleShare}
            >
              Share on Farcaster
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
