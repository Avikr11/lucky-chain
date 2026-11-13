import { isAddress, type Address } from "viem";
import { lotteryAbi } from "@/src/lib/abi/lottery-abi";

export const LOTTERY_CHAIN_ID = 11155111;

const configuredAddress =
  process.env.NEXT_PUBLIC_LOTTERY_CONTRACT_ADDRESS;

export const lotteryContractAddress: Address | undefined =
  configuredAddress && isAddress(configuredAddress)
    ? configuredAddress
    : undefined;

export const lotteryContract = {
  address: lotteryContractAddress,
  abi: lotteryAbi,
  chainId: LOTTERY_CHAIN_ID,
} as const;

export const isLotteryContractConfigured =
  lotteryContractAddress !== undefined;
