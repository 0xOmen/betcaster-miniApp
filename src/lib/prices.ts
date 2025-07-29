// Function to calculate USD value of a bet amount
export const calculateUSDValue = (
  betAmount: number,
  tokenPrice: number | null
): number | null => {
  if (!tokenPrice || betAmount <= 0) {
    return null;
  }

  // The price is already in USDC format (6 decimals), convert to actual USD
  const priceInUSD = tokenPrice / Math.pow(10, 6);
  return betAmount * priceInUSD;
};
