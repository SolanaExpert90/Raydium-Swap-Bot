export const swapConfig = {
  executeSwap: true, // Send tx when true, simulate tx when false
  useVersionedTransaction: true,
  tokenAAmount: 0.001, // Swap 0.01 SOL for USDT in this example
  tokenAAddress: "So11111111111111111111111111111111111111112", // Token to swap for the other, SOL in this case
  tokenBAddress: "9aVMRKmN8EPjaoQorwkJJjinst4xSkHiCfRgCKWDvz4f", // token address
  poolAddress: "BhNPmUzQoNzpmijvhHmHH2HQ7dpSJh9QHBZDBuS2TE3S",
  maxLamports: 1500000, // Micro lamports for priority fee
  direction: "in" as "in" | "out", // Swap direction: 'in' or 'out'
  liquidityFile: "https://api.raydium.io/v2/sdk/liquidity/mainnet.json",
  maxRetries: 20,
};
// So11111111111111111111111111111111111111112;
