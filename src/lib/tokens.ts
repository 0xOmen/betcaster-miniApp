export interface Token {
  name: string;
  address: string;
  symbol: string;
  decimals: number;
  image: string;
  chainId: number;
}

// Base tokens available on Base network
export const BASE_TOKENS: Token[] = [
    {
        name: "Bracky",
        address: "0x06f71fb90f84b35302d132322a3c90e4477333b0",
        symbol: "BRACKY",
        decimals: 18,
        image:
          "https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/c58cb239-9e92-4fb5-d982-50fd5b903800/anim=false,fit=contain,f=auto,w=576",
        chainId: 8453,
      },
      {
        name: "Degen",
        address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
        symbol: "DEGEN",
        decimals: 18,
        image:
          "https://assets.coingecko.com/coins/images/34515/standard/android-chrome-512x512.png?1706198225",
        chainId: 8453,
      },
      {
        name: "Clanker",
        address: "0x1bc0c42215582d5a085795f4badbac3ff36d1bcb",
        symbol: "CLANKER",
        decimals: 18,
        image:
          "https://assets.coingecko.com/coins/images/51440/standard/CLANKER.png?1731232869",
        chainId: 8453,
      },
  {
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
    image: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    chainId: 8453,
  },
  {
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    decimals: 18,
    image: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    chainId: 8453,
  },
  {
    name: "Dai",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    decimals: 18,
    image: "https://assets.coingecko.com/coins/images/9956/small/4943.png",
    chainId: 8453,
  },
  {
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    decimals: 6,
    image: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    chainId: 8453,
  },
];

// Helper function to get token by address
export const getTokenByAddress = (address: string): Token | undefined => {
  return BASE_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());
};

// Helper function to get token decimals
export const getTokenDecimals = (address: string): number => {
  const token = getTokenByAddress(address);
  return token?.decimals || 18; // Default to 18 if token not found
};

// Helper function to convert amount to wei based on token decimals
export const amountToWei = (amount: number, tokenAddress: string): bigint => {
  const decimals = getTokenDecimals(tokenAddress);
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
};

// Helper function to convert wei to amount based on token decimals
export const weiToAmount = (wei: bigint, tokenAddress: string): number => {
  const decimals = getTokenDecimals(tokenAddress);
  return Number(wei) / Math.pow(10, decimals);
}; 