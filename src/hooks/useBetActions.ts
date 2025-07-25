/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { type Bet } from "~/types/bet";
import {
  useAccount,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { encodeFunctionData } from "viem";
import {
  BET_MANAGEMENT_ENGINE_ABI,
  BET_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/contracts";
import {
  ARBITER_MANAGEMENT_ENGINE_ABI,
  ARBITER_MANAGEMENT_ENGINE_ADDRESS,
} from "~/lib/arbiterAbi";
import { ERC20_ABI } from "~/lib/erc20Abi";
import { BETCASTER_ADDRESS } from "~/lib/betcasterAbi";
import { amountToWei } from "~/lib/tokens";

interface UseBetActionsProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useBetActions({ onSuccess, onError }: UseBetActionsProps = {}) {
  const [isApproving, setIsApproving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isAcceptingArbiter, setIsAcceptingArbiter] = useState(false);
  const [isSelectingWinner, setIsSelectingWinner] = useState(false);

  const [approvalTxHash, setApprovalTxHash] = useState<
    `0x${string}` | undefined
  >();
  const [acceptTxHash, setAcceptTxHash] = useState<`0x${string}` | undefined>();
  const [cancelTxHash, setCancelTxHash] = useState<`0x${string}` | undefined>();
  const [forfeitTxHash, setForfeitTxHash] = useState<
    `0x${string}` | undefined
  >();
  const [claimTxHash, setClaimTxHash] = useState<`0x${string}` | undefined>();
  const [acceptArbiterTxHash, setAcceptArbiterTxHash] = useState<
    `0x${string}` | undefined
  >();
  const [selectWinnerTxHash, setSelectWinnerTxHash] = useState<
    `0x${string}` | undefined
  >();

  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const { sendTransaction } = useSendTransaction();
  const { writeContractAsync: writeApproveAsync } = useWriteContract();

  const ensureBaseChain = async () => {
    if (!isConnected) {
      throw new Error("Wallet not connected");
    }

    // Check if we're on the correct chain (Base)
    try {
      await switchChain({ chainId: base.id });
    } catch (error) {
      console.error("Failed to switch to Base network:", error);
      throw error;
    }
  };

  const handleAcceptBet = async (bet: Bet) => {
    try {
      await ensureBaseChain();

      // Check token allowance for ERC20 tokens (skip for native ETH)
      if (
        bet.bet_token_address !== "0x0000000000000000000000000000000000000000"
      ) {
        const betAmountWei = amountToWei(bet.bet_amount, bet.bet_token_address);

        setIsApproving(true);
        try {
          const hash = await writeApproveAsync({
            address: bet.bet_token_address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [BETCASTER_ADDRESS, betAmountWei],
          });

          if (hash) {
            console.log("Approval transaction sent:", hash);
            setApprovalTxHash(hash);
            return;
          }
        } catch (error) {
          console.error("Failed to approve token allowance:", error);
          setIsApproving(false);
          if (onError) onError(error as Error);
          return;
        }
      }

      setIsAccepting(true);
      console.log("Accepting bet #", bet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "acceptBet",
        args: [BigInt(bet.bet_number)],
      });

      console.log("Encoded accept transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Accept transaction sent successfully:", hash);
            setAcceptTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Accept transaction failed:", error);
            setIsAccepting(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error accepting bet:", error);
      setIsAccepting(false);
      if (onError) onError(error as Error);
    }
  };

  const handleCancelBet = async (bet: Bet) => {
    try {
      await ensureBaseChain();

      setIsCancelling(true);
      console.log("Cancelling bet #", bet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "makerCancelBet",
        args: [BigInt(bet.bet_number)],
      });

      console.log("Encoded cancel transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Cancel transaction sent successfully:", hash);
            setCancelTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Cancel transaction failed:", error);
            setIsCancelling(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error cancelling bet:", error);
      setIsCancelling(false);
      if (onError) onError(error as Error);
    }
  };

  const handleForfeitBet = async (bet: Bet) => {
    try {
      await ensureBaseChain();

      setIsForfeiting(true);
      console.log("Forfeiting bet #", bet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "forfeitBet",
        args: [BigInt(bet.bet_number)],
      });

      console.log("Encoded forfeit transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Forfeit transaction sent successfully:", hash);
            setForfeitTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Forfeit transaction failed:", error);
            setIsForfeiting(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error forfeiting bet:", error);
      setIsForfeiting(false);
      if (onError) onError(error as Error);
    }
  };

  const handleClaimWinnings = async (bet: Bet) => {
    try {
      await ensureBaseChain();

      setIsClaiming(true);
      console.log("Claiming winnings for bet #", bet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: BET_MANAGEMENT_ENGINE_ABI,
        functionName: "claimBet",
        args: [BigInt(bet.bet_number)],
      });

      console.log("Encoded claim transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: BET_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Claim transaction sent successfully:", hash);
            setClaimTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Claim transaction failed:", error);
            setIsClaiming(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error claiming winnings:", error);
      setIsClaiming(false);
      if (onError) onError(error as Error);
    }
  };

  const handleAcceptArbiterRole = async (bet: Bet) => {
    try {
      await ensureBaseChain();

      setIsAcceptingArbiter(true);
      console.log("Accepting arbiter role for bet #", bet.bet_number);

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: ARBITER_MANAGEMENT_ENGINE_ABI,
        functionName: "ArbiterAcceptRole",
        args: [BigInt(bet.bet_number)],
      });

      console.log("Encoded accept arbiter transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: ARBITER_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Accept arbiter transaction sent successfully:", hash);
            setAcceptArbiterTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Accept arbiter transaction failed:", error);
            setIsAcceptingArbiter(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error accepting arbiter role:", error);
      setIsAcceptingArbiter(false);
      if (onError) onError(error as Error);
    }
  };

  const handleSelectWinner = async (bet: Bet, betParamsTrue: boolean) => {
    try {
      await ensureBaseChain();

      setIsSelectingWinner(true);
      console.log(
        "Selecting winner for bet #",
        bet.bet_number,
        "Bet Parameters True:",
        betParamsTrue
      );

      // Encode the function call
      const encodedData = encodeFunctionData({
        abi: ARBITER_MANAGEMENT_ENGINE_ABI,
        functionName: "selectWinner",
        args: [BigInt(bet.bet_number), betParamsTrue],
      });

      console.log("Encoded select winner transaction data:", encodedData);

      // Send the transaction
      sendTransaction(
        {
          to: ARBITER_MANAGEMENT_ENGINE_ADDRESS as `0x${string}`,
          data: encodedData as `0x${string}`,
        },
        {
          onSuccess: (hash: `0x${string}`) => {
            console.log("Select winner transaction sent successfully:", hash);
            setSelectWinnerTxHash(hash);
            if (onSuccess) onSuccess();
          },
          onError: (error: Error) => {
            console.error("Select winner transaction failed:", error);
            setIsSelectingWinner(false);
            if (onError) onError(error);
          },
        }
      );
    } catch (error) {
      console.error("Error selecting winner:", error);
      setIsSelectingWinner(false);
      if (onError) onError(error as Error);
    }
  };

  return {
    isApproving,
    isAccepting,
    isCancelling,
    isForfeiting,
    isClaiming,
    isAcceptingArbiter,
    isSelectingWinner,
    approvalTxHash,
    acceptTxHash,
    cancelTxHash,
    forfeitTxHash,
    claimTxHash,
    acceptArbiterTxHash,
    selectWinnerTxHash,
    handleAcceptBet,
    handleCancelBet,
    handleForfeitBet,
    handleClaimWinnings,
    handleAcceptArbiterRole,
    handleSelectWinner,
  };
}
