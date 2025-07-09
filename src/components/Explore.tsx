import { useState } from "react";
import { Button } from "~/components/ui/Button";

interface ExploreProps {
  userFid: number | null;
}

export default function Explore({ userFid }: ExploreProps) {
  const [betNumber, setBetNumber] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic will be added later
    console.log("Exploring bet number:", betNumber);
  };

  return (
    <div className="space-y-6 px-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-center">Explore Bets</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter Bet Number
          </label>
          <input
            type="number"
            value={betNumber}
            onChange={(e) => setBetNumber(e.target.value)}
            placeholder="Enter bet number..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        <Button type="submit" disabled={!betNumber} className="w-full">
          Explore Bet
        </Button>
      </form>
    </div>
  );
}
