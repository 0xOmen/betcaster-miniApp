export const ARBITER_MANAGEMENT_ENGINE_ABI = [
  {
    inputs: [{ internalType: "address", name: "_betcaster", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ArbiterManagementEngine__BetNotInProcess",
    type: "error",
  },
  {
    inputs: [],
    name: "ArbiterManagementEngine__BetNotWaitingForArbiter",
    type: "error",
  },
  {
    inputs: [],
    name: "ArbiterManagementEngine__EndTimeNotReached",
    type: "error",
  },
  { inputs: [], name: "ArbiterManagementEngine__NotArbiter", type: "error" },
  {
    inputs: [],
    name: "ArbiterManagementEngine__NotOnAllowList",
    type: "error",
  },
  {
    inputs: [],
    name: "ArbiterManagementEngine__TakerCannotBeArbiter",
    type: "error",
  },
  {
    inputs: [],
    name: "ArbiterManagementEngine__WinnerNotValid",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  { inputs: [], name: "ReentrancyGuardReentrantCall", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bool", name: "enforced", type: "bool" },
    ],
    name: "AllowListEnforcementUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "address_",
        type: "address",
      },
      { indexed: true, internalType: "bool", name: "allowed", type: "bool" },
    ],
    name: "AllowListUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "betNumber",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "arbiter",
        type: "address",
      },
    ],
    name: "ArbiterAcceptedRole",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "betNumber",
        type: "uint256",
      },
      { indexed: true, internalType: "bool", name: "winner", type: "bool" },
      {
        components: [
          { internalType: "address", name: "maker", type: "address" },
          { internalType: "address[]", name: "taker", type: "address[]" },
          { internalType: "address[]", name: "arbiter", type: "address[]" },
          { internalType: "address", name: "betTokenAddress", type: "address" },
          { internalType: "uint256", name: "betAmount", type: "uint256" },
          {
            internalType: "address",
            name: "takerBetTokenAddress",
            type: "address",
          },
          { internalType: "uint256", name: "takerBetAmount", type: "uint256" },
          { internalType: "bool", name: "canSettleEarly", type: "bool" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "uint256", name: "takerDeadline", type: "uint256" },
          { internalType: "uint256", name: "endTime", type: "uint256" },
          {
            internalType: "enum BetTypes.Status",
            name: "status",
            type: "uint8",
          },
          { internalType: "uint256", name: "protocolFee", type: "uint256" },
          { internalType: "uint256", name: "arbiterFee", type: "uint256" },
          { internalType: "string", name: "betAgreement", type: "string" },
        ],
        indexed: false,
        internalType: "struct BetTypes.Bet",
        name: "bet",
        type: "tuple",
      },
    ],
    name: "WinnerSelected",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "_betNumber", type: "uint256" }],
    name: "ArbiterAcceptRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "isAllowListEnforced",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_address", type: "address" }],
    name: "isOnAllowList",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_betNumber", type: "uint256" },
      { internalType: "bool", name: "_betParamsTrue", type: "bool" },
    ],
    name: "selectWinner",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bool", name: "_enforced", type: "bool" }],
    name: "setAllowListEnforcement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_address", type: "address" },
      { internalType: "bool", name: "_allowed", type: "bool" },
    ],
    name: "setAllowListStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Contract address on Base blockchain
export const ARBITER_MANAGEMENT_ENGINE_ADDRESS =
  "0x1001EBFB2142ccCeB330ffF1F4778091B7115D17" as const;
