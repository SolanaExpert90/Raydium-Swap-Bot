import RaydiumSwap from "./RaydiumSwap";
import * as fs from "fs";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import * as path from "path";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
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
const rootDir = path.resolve(__dirname);
console.log(rootDir);
const inputTokenStorage = `${rootDir}/storage/input.txt`;
const tradeStorage = `${rootDir}/storage/trade.txt`;
const logStorage = `${rootDir}/storage/log.txt`;
const outputStorage = "./storage/output.csv";
const lastLineStorage = `${rootDir}/storage/last_line.lock`;

// ========================== local variable ==================
const logTime = `log time: ${new Date()}`;
const MSG = {
  loadInputTokenSuccess: "✅ Loaded input tokens successfully!",
  loadTradeTokenSuccess: "✅ Loaded trade tokens successfully!",
  updateTradeTokenSuccess: "✅ Updated trade tokens successfully!",
  loadLostLineSuccess: "✅ Loaded lost line successfully!",
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
  notEnoughToken: "🚩 Less than target count for trade",
};
const DURATION_WINDOW = 1; // unit second
const rugCheckTolerance = 0.00000001; // sol
const CSV_HEADER = [
  { id: "address", title: "Token Address" },
  { id: "profit", title: "Profit" },
  { id: "time", title: "Time" },
];
let timeoutId: any;
let loopIndex: number = 0;
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
const checkCondition = (token: object) => {
  console.log(isOldToken(token), isLosted(token));
  if (isOldToken(token) || isLosted(token)) return false;
  return true;
};
const checkInputTokens = (tokens: Array<object>) => {
  let result: Array<any>;
  if (tokens.length < Number(SIMULTANEOUS_TRADES)) {
    console.log(MSG.notEnoughToken);
    console.log("❗ Please check tokens out again!");
    updateLog(MSG.notEnoughToken);
    process.exit();
  } else {
    for (const each of tokens) {
      console.log("each: ", each);
      if (checkCondition(each)) {
        result.push(each);
        if (result.length == Number(SIMULTANEOUS_TRADES)) {
          break;
        }
      }
    }
    return result;
  }
};

const loadTradeToken = () => {
  console.log(MSG.loadTradeTokenSuccess);
  updateLog(MSG.loadTradeTokenSuccess);
  return JSON.parse(fs.readFileSync(tradeStorage, "utf8"));
};
const updateTradeToken = async (tokens: Array<any>) => {
  fs.writeFileSync(tradeStorage, JSON.stringify(tokens), "utf8");
  updateLog(MSG.updateTradeTokenSuccess);
  console.log(MSG.updateTradeTokenSuccess);
};
const swap = async (input: string, output: string, inputAmount: number) => {
  // /**
  //  * The RaydiumSwap instance for handling swaps.
  //  */
  const raydiumSwap = new RaydiumSwap(
    process.env.RPC_URL,
    process.env.WALLET_PRIVATE_KEY
  );
  console.log(`Raydium swap initialized`);
  console.log(`Swapping ${inputAmount} of ${input} for ${output}...`);

  // /**
  //  * Load pool keys from the Raydium API to enable finding pool information.
  //  */
  await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);
  // console.log(`Loaded pool keys`);

  // /**
  //  * Find pool information for the given token pair.
  //  */
  const poolInfo = raydiumSwap.findPoolInfoForTokens(input, output);
  // console.log("Found pool info: ", poolInfo);

  // const poolInfo = await raydiumSwap.getPoolKeys(swapConfig.poolAddress);
  // console.log(poolInfo);

  /**
   * Prepare the swap transaction with the given parameters.
   */
  const tx = await raydiumSwap.getSwapTransaction(
    output,
    inputAmount,
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
    const { amountOut } = await raydiumSwap.calcAmountOut(
      poolInfo,
      inputAmount,
      true
    );
    // console.log("swap: ", amountOut);
    return amountOut;
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

const buy = async (tokens: Array<any>, index: number) => {
  if (index < tokens.length) {
    console.log(MSG.startToBuy);
    updateLog(MSG.startToBuy);
    const token = tokens[index];
    const result = await swap(WSOL_ADDRESS, token.address, Number(TRADE_SIZE));
    let tradeTokens = await loadTradeToken();
    const tradeToken = {
      ...tokens[index],
      changed: 0,
      lastTime: 0,
      profitablePrice: tokens[index].price * Number(PROFIT_RATIO),
      initialAmount: Number(result) * 10 ** tokens[index].decimal,
      currentAmount: Number(result) * 10 ** tokens[index].decimal,
      keepAmount: Math.round(Number(KEEP_SOME) / tokens[index].priceNative),
      sold: {},
    };
    // const tradeToken = tokens.map((idx: number, el: any) => {
    //   return idx == index
    //     ? {
    //         ...el,
    //         changed: 0,
    //         lastTime: 0,
    //         profitablePrice: el.price * Number(PROFIT_RATIO),
    //         initialAmount: Number(result) * 10 ** el.decimal,
    //         currentAmount: Number(result) * 10 ** el.decimal,
    //         keepAmount: Math.round(Number(KEEP_SOME) / el.priceNative),
    //         sold: {},
    //       }
    //     : el;
    // });
    await updateTradeToken([...tradeTokens, tradeToken]);
    index += 1;
    return buy(tokens, index);
  } else {
    return true;
  }
};

const testBuy = async (tokens: Array<object>) => {};

const sell = async (token: Object, amount: number) => {};

const monitorTokens = async (index: number) => {
  const tradeTokens = await loadTradeToken();
  let updatedTokens: Array<Object>;

  if (index < Number(SIMULTANEOUS_TRADES)) {
    const tradeToken = tradeTokens[index];
    let updateToken: Object;
    const currentMarket = await fetchCurrentMarket(tradeToken.address);
    if (currentMarket.cap >= Number(KEEP_SOME_LAST_SELL)) {
      await sell(tradeToken, tradeToken.currentAmount);
      // ...logic after selling all token
      updateToken = {
        ...tradeToken,
        changed: tradeToken.changed + 1,
        lostTime: 0,
        sold: {
          ...tradeToken.sold,
          [`${currentMarket.cap / 1000}k`]: {
            amount: tradeToken.currentAmount,
            wsol: tradeToken.currentAmount * currentMarket.nativeWsol,
          },
        },
        currentAmount: 0,
      };
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
        updateToken = {
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

    updatedTokens = await tradeTokens.map((idx: number, el: Object) => {
      return idx == index ? updateToken : el;
    });

    await updateTradeToken(updatedTokens);
    timeoutId = setTimeout(
      monitorTokens,
      DURATION_WINDOW * 60 * 1000,
      index + 1
    );
  } else {
    monitorTokens(0);
  }
};

const processOutputCSV = (filePath: any, callback: any, newData: any) => {
  const result = [];
  const csvF = fs
    .createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => {
      result.push({
        [CSV_HEADER[0].id]: data[CSV_HEADER[0].title],
        [CSV_HEADER[1].id]: data[CSV_HEADER[1].title],
        [CSV_HEADER[2].id]: data[CSV_HEADER[2].title],
      });
    })
    .on("end", () => {
      callback(filePath, result, newData);
    });
};
const updateOutput = async (filePath: string, data: any, newData: any) => {
  const output = [...data, ...newData];
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: CSV_HEADER,
  });
  csvWriter.writeRecords(output).then(() => {
    MSG.updateOutputSuccess;
  });
};

const isOldToken = (token: any) => {
  const currentTimeStamp = Date.now();
  return (
    currentTimeStamp - token.created_date >=
    (Number(TRADE_WINDOW) * 60 * 1000) / 2
  );
};
const isLosted = (token: any) => {
  const detectedTokens = loadLostLine();
  return hasSameValue(token.address, detectedTokens);
};

const hasSameValue = (address: string, arr2: any) => {
  const tokenAddresses = arr2.map((obj: any) => obj.address);
  return tokenAddresses.includes(address);
};
const loadLostLine = () => {
  console.log(MSG.loadLostLineSuccess);
  updateLog(MSG.loadLostLineSuccess);
  return JSON.parse(fs.readFileSync(lastLineStorage, "utf8"));
};
const sleepTrade = async (ms: number) => {
  console.log(`Restart after ${ms / 1000} seconds...`);
  return new Promise((resolve) => setTimeout(resolve, ms * 60 * 1000));
};
// ========================== *start ==========================
const startTrade = async () => {
  console.log(MSG.startTrade);
  updateLog(MSG.startTrade);
  setInterval(async () => {
    try {
      if (loopIndex < 2) {
        loopIndex++;
        await checkTrade();
        await monitorTokens(0);
      } else {
        loopIndex = 0;
        await checkTrade();
      }
    } catch (error) {
      console.log("Issued some problems!");
      await sleep(120);
      startTrade();
    }
  }, Number(TRADE_WINDOW) * 60 * 1000);
};
const beforeTrade = async () => {
  const tokens = await loadInputToken();
  // const checkTokens = checkInputTokens(tokens);
  // await buy(checkTokens);
  await buy(tokens, 0);
};
const checkTrade = async () => {
  const tradeTokens = await loadTradeToken();
  const isLostTokens = tradeTokens.filter(
    (el: any) => el.lostTime == Number(MAX_LAST_LOST_TRADES)
  );
  if (isLostTokens.length > 0) await stopTrade();
  else return true;
};
const stopTrade = async () => {
  // const tradeTokens = await loadTradeToken();
  await sleepTrade(100);
  bot();
};
// ============================================================
const bot = async () => {
  await beforeTrade();
  await startTrade();
  // swap("HDspTZ66xuhmRfeb6bQpmftcRsmQsNYcxVPXBZj8bmPX", WSOL_ADDRESS, 1800);
};

bot();
// swap();
