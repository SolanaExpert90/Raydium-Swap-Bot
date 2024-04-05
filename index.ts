// 👏🙌✋👍💐🤣😎❌❎➕⚔☠☠💀🎈🏆🔑🛠⚒⛏📁📂⏰⏱⏲⭐🚩❌⭕✅❓‼⁉💯❗❕♻💲✔🎅🕵️‍♀️🥇🔔🔒⛏⚙s
import RaydiumSwap from "./RaydiumSwap";
import * as fs from "fs";
import {
  Transaction,
  VersionedTransaction,
  Keypair,
  GetProgramAccountsFilter,
  Connection,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as path from "path";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import "dotenv/config";
import { swapConfig } from "./swapConfig"; // Import the configuration
import bs58 from "bs58";
import { after } from "node:test";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";

// ========================== env variable ====================
const TRADE_SIZE = process.env.TRADE_SIZE;
const TEST_TRADE_SIZE = process.env.TEST_TRADE_SIZE;
const WSOL_ADDRESS = process.env.WSOL_ADDRESS;
const MAX_MARKETCAP = process.env.MAX_MARKETCAP;
const TRADE_WINDOW = process.env.TRADE_WINDOW;
const PROFIT_RATIO = process.env.PROFIT_RATIO;
const WALLET_SECRET_KEY = process.env.WALLET_PRIVATE_KEY;
const MAX_LAST_LOST_TRADES = process.env.MAX_LAST_LOST_TRADES;
const SELL_PERCENTAGE = process.env.SELL_PERCENTAGE;
const SIMULTANEOUS_TRADES = process.env.SIMULTANEOUS_TRADES;
const SLIPPAGE = process.env.SLIPPAGE;

const KEEP_SOME = process.env.KEEP_SOME;
const KEEP_SOME_MIN_SCORE = process.env.KEEP_SOME_MIN_SCORE;
const KEEP_SOME_LAST_SELL = process.env.KEEP_SOME_LAST_SELL;

const VOLUME_CHECKED = process.env.VOLUME_CHECKED;
const HOLDERS_SELL_CHECKED = process.env.HOLDERS_SELL_CHECKED;
const SMART_CONTRACT_CHANGED = process.env.SMART_CONTRACT_CHANGED;

// ========================== storage =========================
const rootDir = path.resolve(__dirname);

const inputTokenStorage = `${rootDir}/storage/input.txt`;
const tradeStorage = `${rootDir}/storage/trade.txt`;
const logStorage = `${rootDir}/storage/log.txt`;
const outputStorage = `${rootDir}/storage/output.csv`;
const lastLineStorage = `${rootDir}/storage/last_line.lock`;

// ========================== local variable ==================
const connection = new Connection(process.env.RPC_URL);
const logTime = `log time: ${new Date()}`;
const wallet = Keypair.fromSecretKey(bs58.decode(WALLET_SECRET_KEY));
const MSG = {
  loadInputTokenSuccess: "✅ Loaded input tokens successfully!",
  loadTradeTokenSuccess: "✅ Loaded trade tokens successfully!",
  updateTradeTokenSuccess: "✅ Updated trade tokens successfully!",
  loadLostLineSuccess: "✅ Loaded lost line successfully!",
  updateLostLineSuccess: "⭕ Updated lost line successfully!",
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
let endDate: number;
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
const checkCondition = async (token: object) => {
  const lostResult = await isLosted(token);
  console.log("condition: ", isOldToken(token), lostResult);
  if (isOldToken(token) || lostResult) return false;
  return true;
};

const checkInputTokens = (tokens: Array<object>) => {
  let result: any = [];
  if (tokens.length < Number(SIMULTANEOUS_TRADES)) {
    console.log(MSG.notEnoughToken);
    console.log("❗ Please check tokens out again!");
    updateLog(MSG.notEnoughToken);
    process.exit();
  } else {
    // while (result.length == Number(SIMULTANEOUS_TRADES)) {
    //   tokens.forEach(async (element) => {
    //     const condition = await checkCondition(element);
    //     if (condition) {
    //       result = [...result, element];
    //     }
    //   });
    // }

    for (const each of tokens) {
      // console.log("each: ", each);
      if (checkCondition(each)) {
        // console.log("push");
        result = [...result, each];
        if (result.length == Number(SIMULTANEOUS_TRADES)) {
          break;
        }
      }
    }
    if (result.length == Number(SIMULTANEOUS_TRADES)) return result;
    else {
      console.log(
        `⭕ Not enough tokens for matching trade condition! \nPlease check tokens out again!`
      );
      process.exit();
    }
  }
};

const loadTradeToken = async () => {
  try {
    const result = await JSON.parse(fs.readFileSync(tradeStorage, "utf8"));
    console.log(MSG.loadTradeTokenSuccess);
    updateLog(MSG.loadTradeTokenSuccess);
    return result;
  } catch (error) {
    console.log("❗ Failed to load trade.txt!");
    await sleepTrade(10);
    await loadTradeToken();
  }
};
const updateTradeToken = async (tokens: Array<any>) => {
  try {
    fs.writeFileSync(tradeStorage, JSON.stringify(tokens), "utf8");
    updateLog(MSG.updateTradeTokenSuccess);
    console.log(MSG.updateTradeTokenSuccess);
  } catch (error) {
    console.log("❕ Issued updating trade tokens!");
    await sleepTrade(10);
    updateTradeToken(tokens);
  }
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
  updateLog(`Swapping ${inputAmount} of ${input} for ${output}...`);

  // const poolInfo = await raydiumSwap.getPoolKeys(swapConfig.poolAddress);

  try {
    await raydiumSwap.loadPoolKeys(swapConfig.liquidityFile);

    const poolInfo = raydiumSwap.findPoolInfoForTokens(input, output);
    const tx = await raydiumSwap.getSwapTransaction(
      output,
      inputAmount,
      poolInfo,
      swapConfig.maxLamports,
      swapConfig.useVersionedTransaction,
      swapConfig.direction
    );
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
      updateLog(`https://solscan.io/tx/${txid}`);
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
  } catch (error) {
    console.log("❗ Issued some problems in swapping! \n wait 50 seconds...");
    await sleepTrade(50);
    await swap(input, output, inputAmount);
  }

  /**
   * Depending on the configuration, execute or simulate the swap.
   */
};

const sleep = async (ms: any) => {
  // console.log(`Retry after ${ms / 1000} seconds...`);
  // console.log(MSG.waiting);
  return new Promise((resolve) => setTimeout(resolve, ms * 1000));
};
const reachMarketCap = (currentMarketCap: number, changed: number) => {
  console.log("🕵️‍♀️ Comparing marketcap...");
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
  console.log("🕵️‍♀️ Comparing price...");
  return currentPrice >= profitablePrice;
};

const volumeChecked = async (tokenAddress: string) => {
  if (Number(VOLUME_CHECKED)) {
    let volume = Object();
    try {
      await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      ).then(async (res) => {
        await res.json().then((data) => {
          volume = data;
        });
      });
      return (
        Number(volume?.pairs[0].txns.h24.sells) >=
        Number(volume?.pairs[0].txns.h24.buys)
      );
    } catch (error) {
      console.log(`${error.message}`);
      return true;
    }
  } else return true;
};
const holdersChecked = async (tokenAddress: string) => {
  if (Number(holdersChecked)) {
    let volume = Object();
    try {
      await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      ).then(async (res) => {
        await res.json().then((data) => {
          volume = data;
        });
      });
      return (
        Number(volume?.pairs[0].txns.h24.sells) >=
        Number(volume?.pairs[0].txns.h24.buys) * 10
      );
    } catch (error) {
      console.log(`${error.message}`);
      return true;
    }
  } else return true;
};
const smartContractChecked = async () => {
  return true;
};

const fetchCurrentMarket = async (tokenAddress: string) => {
  let market = Object();
  try {
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
  } catch (error) {
    console.log(`${error.message} \nRetrying 10 seconds...`);
    await sleep(10);
    await fetchCurrentMarket(tokenAddress);
  }
};

const getTokenAmount = async (address: string) => {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165, //size of account (bytes)
    },
    {
      memcmp: {
        offset: 32, //location of our query in the account (bytes)
        bytes: wallet.publicKey.toString(), //our search criteria, a base58 encoded string
      },
    },
  ];
  const accounts = await connection.getParsedProgramAccounts(
    TOKEN_PROGRAM_ID, //SPL Token Program, new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    { filters: filters }
  );
  let result: number;

  accounts.map((account, i) => {
    const parsedAccountInfo: any = account.account.data;
    const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
    const tokenBalance: number =
      parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
    if (mintAddress == address) result = tokenBalance;
  });

  // console.log("result: ", result);
  return result;
};
const buy = async (tokens: Array<any>, index: number) => {
  if (index < tokens.length) {
    const token = tokens[index];
    const before = await getTokenAmount(token.address);
    console.log(MSG.startToBuy);
    updateLog(MSG.startToBuy);
    await swap(WSOL_ADDRESS, token.address, Number(TRADE_SIZE));
    await sleep(30);
    const after = await getTokenAmount(token.address);
    const result = Number(after - before);
    // const result = 67.054432;
    let tradeTokens = await loadTradeToken();
    const tradeToken = {
      ...token,
      changed: 0,
      lostTime: 0,
      profitablePrice: token.price * Number(PROFIT_RATIO),
      initialAmount: Math.round(Number(result) * 10 ** token.decimal),
      currentAmount: Math.round(Number(result) * 10 ** token.decimal),
      keepAmount: Math.round(
        (Number(KEEP_SOME) / token.priceNative) * 10 ** token.decimal
      ),
      sold: {},
    };

    await updateTradeToken([...tradeTokens, tradeToken]);
    index += 1;
    return buy(tokens, index);
  } else {
    return true;
  }
};

const testBuy = async (tokens: Array<object>) => {};

const sell = async (token: any, amount: number) => {
  try {
    await swap(token.address, WSOL_ADDRESS, amount);
  } catch (error) {
    console.log(error.message);
    // await sleepTrade(30);
    // sell(token, amount);
  }
};
const sumObjectValues = (obj: any) => {
  let sum = 0;
  for (let key in obj) {
    if (typeof obj[key] === "object") {
      sum += obj[key].wsol;
    }
  }
  return sum;
};
const monitorTokens = async (index: number) => {
  const tradeTokens = await loadTradeToken();
  console.log("Monitor trading...");
  let updatedTokens: Object[];

  if (index < Number(SIMULTANEOUS_TRADES)) {
    const tradeToken = tradeTokens[index];
    let updateToken: Object;
    const currentMarket = await fetchCurrentMarket(tradeToken.address);
    const checkVolume = await volumeChecked(tradeToken.address);
    const checkHolders = await holdersChecked(tradeToken.address);
    const checkContract = await smartContractChecked();
    updateLog(JSON.stringify(currentMarket));
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
          ) ||
          checkVolume ||
          checkHolders ||
          checkContract) &&
        tradeToken.keepAmount < tradeToken.currentAmount &&
        tradeToken.score >= Number(KEEP_SOME_MIN_SCORE)
      ) {
        console.log("Start selling...");
        const sellAmount = Math.round(
          tradeToken.initialAmount * (Number(SELL_PERCENTAGE) / 100)
        );
        // await sell(tradeToken, sellAmount / 10 ** tradeToken.decimal);
        updateToken = {
          ...tradeToken,
          changed: tradeToken.changed + 1,
          lostTime: 0,
          sold: {
            ...tradeToken.sold,
            [`${currentMarket.cap / 1000}k`]: {
              amount: sellAmount,
              wsol:
                (sellAmount * currentMarket.nativeWsol) /
                10 ** tradeToken.decimal,
            },
          },
          currentAmount: tradeToken.currentAmount - sellAmount,
        };
      } else updateToken = tradeToken;
    }

    updatedTokens = await tradeTokens.map((el: Object, idx: number) => {
      return idx == index ? updateToken : el;
    });

    await updateTradeToken(updatedTokens);
    timeoutId = setTimeout(monitorTokens, 3, index + 1);
  } else {
    monitorTrade();
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
  console.log("Checking token age...");
  return (
    currentTimeStamp - token.token_creation_date >=
    (Number(TRADE_WINDOW) * 60 * 1000) / 2
  );
};
const isLosted = async (token: any) => {
  console.log("Checking lost tokens...");
  const detectedTokens = await loadLostLine();
  return hasSameValue(token.address, detectedTokens);
};

const hasSameValue = (address: string, arr2: any) => {
  const tokenAddresses = arr2.map((obj: any) => obj.address);
  return tokenAddresses.includes(address);
};
const loadLostLine = async () => {
  try {
    console.log(MSG.loadLostLineSuccess);
    updateLog(MSG.loadLostLineSuccess);
    return JSON.parse(fs.readFileSync(lastLineStorage, "utf8"));
  } catch (error) {
    console.log(`❌ ${error.message}`);
    await sleepTrade(40);
    loadLostLine();
  }
};
const sleepTrade = async (sec: number) => {
  console.log(`waiting...`);
  return new Promise((resolve) => setTimeout(resolve, sec * 1000));
};
const processLastLine = async (lostTokens: any) => {
  console.log("lost: ", lostTokens);
  try {
    const lines = lostTokens.map((each: any) => {
      return { address: each.address, time: new Date() };
    });
    console.log("lines: ", lines);
    const oldLines = await loadLostLine();
    console.log("oldLines: ", oldLines);
    fs.writeFileSync(
      lastLineStorage,
      JSON.stringify([...oldLines, ...lines]),
      "utf8"
    );
    updateLog(MSG.updateLostLineSuccess);
    console.log(MSG.updateLostLineSuccess);
  } catch (error) {
    console.log(`❗ ${error.message}`);
  }
};
const confirmTrade = async () => {
  const tokens = await loadTradeToken();
  try {
    let tempTokens = [];
    await Promise.all(
      tokens.map(async (token: any) => {
        if (token?.changed == 0) {
          await swap(
            token.address,
            WSOL_ADDRESS,
            Number(token.initialAmount) / 10 ** token.decimal
          );
          token = { ...token, lostTime: token?.lostTime + 1 };
        }
        return token;
      })
    ).then((result) => {
      tempTokens = result;
    });
    await updateTradeToken(tempTokens);

    const outputData = tempTokens.map((each) => {
      const profit = sumObjectValues(each.sold);
      return {
        address: each.address,
        profit: profit - Number(TRADE_SIZE),
        time: new Date(),
      };
    });
    processOutputCSV(outputStorage, updateOutput, outputData);

    const tradeTokens = await loadTradeToken();
    const isLostTokens = tradeTokens
      ? tradeTokens.filter(
          (el: any) => el.lostTime == Number(MAX_LAST_LOST_TRADES)
        )
      : [];
    console.log("*** tradeTokens: ", tradeTokens);
    console.log("*** islostTokens: ", isLostTokens);
    if (isLostTokens.length > 0) stopTrade(isLostTokens);
    else return true;
  } catch (error) {
    console.log(`❓ ${error.message}`);
    await sleepTrade(10);
    startTrade();
  }
};
// ========================== *start ==========================
const monitorTrade = async () => {
  const currentDate = Date.now();
  if (currentDate < endDate)
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
      await sleepTrade(120);
      startTrade();
    }
  else {
    await confirmTrade();
    await sleepTrade(60);
    bot();
  }
};
const startTrade = async () => {
  console.log(MSG.startTrade);
  updateLog(MSG.startTrade);
  setTimeout(async () => {
    endDate = Date.now() + Number(TRADE_WINDOW) * 60 * 1000;
    await monitorTrade();
    setInterval(() => {
      monitorTrade();
      endDate = Date.now() + Number(TRADE_WINDOW) * 60 * 1000;
    }, Number(TRADE_WINDOW) * 60 * 1000);
  }, 1 * 1000);
};
const beforeTrade = async () => {
  const tokens = await loadInputToken();
  await updateTradeToken([]);
  const checkTokens = await checkInputTokens(tokens);
  buy(checkTokens, 0);
  // await buy(tokens, 0);
};
const checkTrade = async () => {
  if (loopIndex == 0) {
    console.log("Restart monitoring after 60 seconds...");
    await sleepTrade(60);
    monitorTrade();
  } else {
    await sleepTrade(10);
    return true;
  }
};
const stopTrade = async (lostTokens: any) => {
  console.log("Saving lost token...");
  await processLastLine(lostTokens);
  bot();
};
// ============================================================
const bot = async () => {
  await beforeTrade();
  await startTrade();
  // swap("HDspTZ66xuhmRfeb6bQpmftcRsmQsNYcxVPXBZj8bmPX", WSOL_ADDRESS, 1800);
};

bot();
