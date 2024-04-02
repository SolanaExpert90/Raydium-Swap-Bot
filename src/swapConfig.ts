export const swapConfig = {
  executeSwap: true, // Send tx when true, simulate tx when false
  useVersionedTransaction: true,
  tokenAAmount: 170000, // Swap 0.01 SOL for USDT in this example
  tokenAAddress: "F5azbpDtejDeG8HdYP2D4kUZjB1kcUeRJRRn2srRYfDs", // Token to swap for the other, SOL in this case
  tokenBAddress: "So11111111111111111111111111111111111111112", // token address
  maxLamports: 1500000, // Micro lamports for priority fee
  direction: "in" as "in" | "out", // Swap direction: 'in' or 'out'
  liquidityFile: "https://api.raydium.io/v2/sdk/liquidity/mainnet.json",
  maxRetries: 20,
};
