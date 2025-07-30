import { useReadContract } from "wagmi";

// Function to calculate USD value of a bet amount
export const calculateUSDValue = (
  betAmount: number,
  tokenPrice: number | null
): number | null => {
  if (!tokenPrice || betAmount <= 0) {
    return null;
  }

  // The price is in floating point format, convert to actual USD (6 decimals)
  const priceInUSD = tokenPrice / Math.pow(10, 6);
  return betAmount * priceInUSD;
};

// Stablecoin addresses that should have price = 1
const STABLECOIN_ADDRESSES = [
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
];

// Hook to fetch token price using checkTheChainAbi
export const useTokenPrice = (tokenAddress: string | undefined) => {
  const isStablecoin =
    tokenAddress && STABLECOIN_ADDRESSES.includes(tokenAddress);

  const contractResult = useReadContract({
    address: "0x0000000000cDC1F8d393415455E382c30FBc0a84" as `0x${string}`,
    abi: [
      {
        inputs: [{ internalType: "address", name: "token", type: "address" }],
        name: "checkPriceInETHToUSDC",
        outputs: [
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "string", name: "priceStr", type: "string" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "checkPriceInETHToUSDC",
    args: [tokenAddress as `0x${string}`],
    query: {
      enabled:
        !!tokenAddress &&
        tokenAddress !== "0x0000000000000000000000000000000000000000" &&
        !isStablecoin,
    },
  });

  // For stablecoins, return price = 1
  if (isStablecoin) {
    return {
      ...contractResult,
      data: [BigInt(1000000), "1000000"] as [bigint, string],
      isLoading: false,
      error: null,
    };
  }

  return contractResult;
};
