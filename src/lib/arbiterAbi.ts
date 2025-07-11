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
      {
        indexed: true,
        internalType: "address",
        name: "winner",
        type: "address",
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
      { internalType: "address", name: "_winner", type: "address" },
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
  "0xE5FD58A8716854a371FA0d16DFCe4204Aca0CEA4" as const;
