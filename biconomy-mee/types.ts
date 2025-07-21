import { Address, Hex } from "viem";

export interface CustomUserOperation {
  callData: Hex;
  callGasLimit: bigint;
  factory?: Address | undefined;
  factoryData?: Hex | undefined;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  nonce: bigint;
  paymasterData?: Hex | undefined;
  paymasterPostOpGasLimit?: bigint | undefined;
  paymasterVerificationGasLimit?: bigint | undefined;
  preVerificationGas: bigint;
  sender: Address;
  verificationGasLimit: bigint;
};

export interface CustomSignedUserOperation extends CustomUserOperation {
  signature: Hex;
};