import RaydiumSwap from "./RaydiumSwap";
import fs from "fs";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import "dotenv/config";
import { swapConfig } from "./swapConfig"; // Import the configuration
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

// ========================== env variable ====================
const TRADE_SIZE = process.env.TRADE_SIZE;
const TEST_TRADE_SIZE = process.env.TEST_TRADE_SIZE;
const WSOL_ADDRESS = process.env.WSOL_ADDRESS;
const MAX_MARKETCAP = process.env.MAX_MARKETCAP;
const TRADE_WINDOW = process.env.TRADE_WINDOW;
const PROFIT_RATIO = process.env.PROFIT_RATIO;
const WALLET_SECRET_KEY = process.env.WALLET_SECRET_KEY;
const MAX_LAST_LOST_TRADES = process.env.MAX_LAST_LOST_TRADES;
const SELL_PERCENTAGE = process.env.SELL_PERCENTAGE;
const SIMULTANEOUS_TRADES = process.env.SIMULTANEOUS_TRADES;
const SLIPPAGE = process.env.SLIPPAGE;

const KEEP_SOME = process.env.KEEP_SOME;
const KEEP_SOME_MIN_SCORE = process.env.KEEP_SOME_MIN_SCORE;
const KEEP_SOME_LAST_SELL = process.env.KEEP_SOME_LAST_SELL;

// ========================== storage =========================
const inputTokenStorage = "./storage/input.txt";
const tradeStorage = "./storage/trade.txt";
const logStorage = "./storage/log.txt";
const outputStorage = "./storage/output.csv";
const lastLineStorage = "./storage/last_line.lock";

// ========================== local variable ==================
const logTime = `log time: ${new Date()}`;
const MSG = {
  loadInputTokenSuccess: "✅ Loaded input tokens successfully!",
  loadTradeTokenSuccess: "✅ Loaded trade tokens successfully!",
  updateTradeTokenSuccess: "✅ Updated trade tokens successfully!",
  buySuccess: "🏆 Bought Successfully!",
  sellSucess: "💲 Sold Successfully. Congratulation!👏👏👏",
  detectedRugpull: "🤣 Detected rug pull!",
  currentMarketStatus: "😎 Current Market Status: \n",
  swapError: "❗ Issued some problems while swapping! \nRetry...",
  confirmTransactionFailed: "🚩 Transaction is not confirmed!",
  startTrade: "😎 Start trade!",
  updateOutputSuccess: "🤣🤣🤣🤣 Save profit successfully!",
  startToBuy: "Start to buy!",
  waiting: "waiting...",
};
const DURATION_WINDOW = 40000; // 40s
const rugCheckTolerance = 0.00000001;
const CSV_HEADER = [
  { id: "address", title: "Token Address" },
  { id: "profit", title: "Profit" },
  { id: "time", title: "Time" },
];
// ========================== *element ========================
const updateLog = (logTxt: string) => {
  let log = fs.readFileSync(logStorage, "utf8");
  log += `⏰---${logTime}---⏰ \n${logTxt}`;
  fs.writeFileSync(logStorage, log, "utf8");
};
const loadInputToken = () => {
  console.log(MSG.loadInputTokenSuccess);
  updateLog(MSG.loadInputTokenSuccess);
  return JSON.parse(fs.readFileSync(inputTokenStorage, "utf8"));
};
const checkInputTokens = (tokens: Array<object>) => {
  return tokens;
};
const loadTradeToken = () => {
  console.log(MSG.loadTradeTokenSuccess);
  updateLog(MSG.loadTradeTokenSuccess);
  const tokens = JSON.parse(fs.readFileSync(tradeStorage, "utf8"));
  return tokens;
};
const updateTradeToken = async (tokens: Array<object>) => {
  fs.writeFileSync(tradeStorage, JSON.stringify(tokens), "utf8");
  updateLog(MSG.updateTradeTokenSuccess);
  console.log(MSG.updateTradeTokenSuccess);
};
const swap = async () => {
  // /**
  //  * The RaydiumSwap instance for handling swaps.
  //  */
  const raydiumSwap = new RaydiumSwap(
    process.env.RPC_URL,
    process.env.WALLET_PRIVATE_KEY
  );
  console.log(`Raydium swap initialized`);
  console.log(
    `Swapping ${swapConfig.tokenAAmount} of ${swapConfig.tokenAAddress} for ${swapConfig.tokenBAddress}...`
  );

  // /**
  //  * Load pool keys from the Raydium API to enable finding pool information.
  //  */
  // await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  // console.log(`Loaded pool keys`);

  // /**
  //  * Find pool information for the given token pair.
  //  */
  // const poolInfo = raydiumSwap.findPoolInfoForTokens(
  //   swapConfig.tokenAAddress,
  //   swapConfig.tokenBAddress
  // );
  // console.log("Found pool info: ", poolInfo);

  const poolInfo = await raydiumSwap.getPoolKeys(swapConfig.poolAddress);
  console.log(poolInfo);

  /**
   * Prepare the swap transaction with the given parameters.
   */
  const tx = await raydiumSwap.getSwapTransaction(
    swapConfig.tokenBAddress,
    swapConfig.tokenAAmount,
    poolInfo,
    swapConfig.maxLamports,
    swapConfig.useVersionedTransaction,
    swapConfig.direction
  );

  /**
   * Depending on the configuration, execute or simulate the swap.
   */
  if (swapConfig.executeSwap) {
    /**
     * Send the transaction to the network and log the transaction ID.
     */
    const txid = swapConfig.useVersionedTransaction
      ? await raydiumSwap.sendVersionedTransaction(
          tx as VersionedTransaction,
          swapConfig.maxRetries
        )
      : await raydiumSwap.sendLegacyTransaction(
          tx as Transaction,
          swapConfig.maxRetries
        );

    console.log(`https://solscan.io/tx/${txid}`);
  } else {
    /**
     * Simulate the transaction and log the result.
     */
    const simRes = swapConfig.useVersionedTransaction
      ? await raydiumSwap.simulateVersionedTransaction(
          tx as VersionedTransaction
        )
      : await raydiumSwap.simulateLegacyTransaction(tx as Transaction);

    console.log(simRes);
  }
};
const sleep = async (ms: any) => {
  console.log(`Retry after ${ms / 1000} seconds...`);
  console.log(MSG.waiting);
  return new Promise((resolve) => setTimeout(resolve, ms));
};
const reachMarketCap = (currentMarketCap: number, changed: number) => {
  const step = 100 / Number(SELL_PERCENTAGE);
  const compareMC =
    JSON.parse(MAX_MARKETCAP) / 2 +
    (JSON.parse(MAX_MARKETCAP) / 2) * ((changed + 1) / step);
  return currentMarketCap >= compareMC;
};
const reachProfitablePrice = (
  currentPrice: number,
  profitablePrice: number
) => {
  return currentPrice >= profitablePrice;
};
const fetchCurrentMarket = async (tokenAddress: string) => {
  let market = Object();
  await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  ).then(async (res) => {
    await res.json().then((data) => {
      market = data;
    });
  });
  return {
    cap: market?.pairs[0].fdv || 0,
    price: Number(market?.pairs[0].priceUsd) || 0,
    nativeWsol: Number(market?.pairs[0].priceNative) || 0,
  };
};
const buy = async (tokens: Array<object>) => {};
const testBuy = async (tokens: Array<object>) => {};
const sell = async (token: Object, amount: number) => {};
const monitorTokens = async (index: number) => {
  const tradeTokens = await loadTradeToken();
  if (index < Number(SIMULTANEOUS_TRADES)) {
    const tradeToken = tradeTokens[index];
    const currentMarket = await fetchCurrentMarket(tradeToken.address);
    if (currentMarket.cap >= Number(KEEP_SOME_LAST_SELL)) {
      await sell(tradeToken, tradeToken.currentAmount);
      // ...logic after selling all token
    } else {
      if (
        (reachMarketCap(currentMarket.cap, tradeToken.changed) ||
          reachProfitablePrice(
            currentMarket.price,
            tradeToken.profitablePrice
          )) &&
        tradeToken.keepAmount < tradeToken.currentAmount &&
        tradeToken.score >= Number(KEEP_SOME_MIN_SCORE)
      ) {
        const sellAmount = Math.round(
          tradeToken.initialAmount * (Number(SELL_PERCENTAGE) / 100)
        );
        await sell(tradeToken, sellAmount);
        const updateToken = {
          ...tradeToken,
          changed: tradeToken.changed + 1,
          lostTime: 0,
          sold: {
            ...tradeToken.sold,
            [`${currentMarket.cap / 1000}k`]: {
              amount: sellAmount,
              wsol: sellAmount * currentMarket.nativeWsol,
            },
          },
          currentAmount: tradeToken.currentAmount - sellAmount,
        };
      }
    }
  } else {
  }
};
// ========================== *start ==========================
const startTrade = async () => {
  setInterval(async () => {
    try {
      monitorTokens(0);
    } catch (error) {
      console.log("Issued some problems!");
    }
  }, Number(TRADE_WINDOW) * 60 * 1000);
};
const beforeTrade = async () => {
  const tokens = await loadInputToken();
  const checkTokens = checkInputTokens(tokens);
  await buy(checkTokens);
};
const stopTrade = async () => {};
// ============================================================
const bot = async () => {
  // await beforeTrade();
  // await startTrade();
  const result = await fetchCurrentMarket(
    "7dr2iYb1Xq29H13RXW1wHhrAqbYF39SDXAU5nGFTpNmU"
  );
  console.log(result);
};

bot();
// swap();
