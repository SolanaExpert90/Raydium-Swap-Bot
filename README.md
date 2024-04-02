# Solana Trading Bot

This is node.js bot with solana trading strategy.

## Strategy

This strategy is like:
This process should be fast and reliable, if there is a failure somewhere, the bot should throw an error and stop running.

A trading script in the Solana or eth blockchain designed to monitor every new line added to a text file. It utilizes each line as the contract address of a token intended for swapping with my Solana/Eth coins in my “Phantom” wallet .The swap used is "Jupiter". The transaction is subject to the following conditions:

0-The amount to trade per token or contract address is 3 Solanas/1 eth (One only trade per token)

1-After buying the token, the duration of the trade lasts until the price of the purchased token reaches at least 2.2 times of the original price or wait for a certain market Ex. sell_marketcap = 40000000000
Once that happens you swap the token back to Solana/Eth. Buf if the price condition wasn't satisfied {within the X-seconds window of opening the trade you just proceed with swapping back to solana/Eth regardless even with loss.}

The trading window subject to change in the config file using Trade_window and the desired profit is subject to change too from the config file using profit_ratio
If Trade_window is set, sell_marketcap will be ignored. (if Trade_window is NULL, the trigger would be sell_marketcap )

When the trade is open, the script keep analyzing the order book while the trade is open if something of the following detected, the trade should be terminated asap (all these here are variables, I can turn on the check or disable it individually in the config file) :
Bot buys and sell, same address and the same amount and keep repeating
lot of sell orders with the value of zero (if more than 10 percent after analyzing the first 30 trades in the order boot)
Every buy is followed by a sell for the last 10 trades
buy trades per second more than 10 trades per minutes (each trade should exceed 0.09 sol / eth) and its total is more than double than sell trades total in the same period this is to make sure marketcap is moving forward and there is no sideways trading (If you have a better indicator of growing marketcap add it optionally in the config)
Honeypot, the selling don’t go through (That can be checking a random sell transactions using solscan.io/Etherscan to make sure the holders are able to sell )
Every 10 second check of using BirdEye API for a probable rugpull

Also, bot end the trade if the

2-Once the transaction is completed, the profit should be recorded, including the times and the contract address of the token in a csv file that you will keep updating for each trade.

3-The script should log the number of the last processed line in 'last_line.lock.' This ensures that in case the script is restarted, it can resume from where it left off.

4-if the last 2 trades are not profitable stop the bot but of course log the last processed line so when I start it again it continue when it was left off
The number of max last lost trades are subject to change in the config file.

5-everything that is done using the script should be logged in log.txt for debugging purposes

6- the bot support more than one simultaneous trades meaning you will swap and trade 5 different token at a time, the number of simultaneous trades can be set in simultaneous_trades

7-we may need to add an indicator or two to the parameters for example indicator_RSI = 1 for enabled, 0 for disabled or something else that can be appropriate for short trading in crypto, always we use one minute candlestick

## How to use

### Enviroment && Install packages

cd to your project root and run npm install. It will install all required node modules

```
    npm install
```

### Configuration

Can change the configuration variable.

```
    // This is template .env
    ============== Main options ====================
    //sol/eth size per token
    TRADE_SIZE = 0.005 # sol
    TEST_TRADE_SIZE = 0.00001 # test sol
    TRADE_WINDOW = 40 # miuntes,  if it is set, MAX_MARKETCAP is ignored!
    MAX_MARKETCAP = 50000000
    52,039,655.82
    2.2 ~ 3.6
    PROFIT_RATIO = 1.1
    simultaneous trades 1 ~ 5
    SIMULTANEOUS_TRADES = 1 (1 ~ 5)
    MAX_LAST_LOST_TRADES = 2
    // sol or eth size to sell
    SELL_PERCENTAGE = 20 # percentage(%)
    SLIPPAGE = 12 # slippage (%)
    // Chain: SOL or ETH
    CHAIN = 'SOL'


    // keep solana or ether
    KEEP_SOME = 0.001 # sol
    KEEP_SOME_MIN_SCORE = 15 # min token score
    KEEP_SOME_LAST_SELL = 60000000

    // WSOL address
    WSOL_ADDRESS = So11111111111111111111111111111111111111112
    WALLET_SECRET_KEY = 'input your wallet secret key'

```

### input text file

This is template for input file for token

```
    {
        "name":"Duko",
        "symbol":"DUKO",
        "address": "HLptm5e6rTgh4EKgDpYFrnRHbjpkMyVdEeREEa2G7rf9",
        "decimal": 9,
        "price": 0.004,
        "ATH_price": 0.007,
        "score": 15,
        "created_date": 1711582899
    },
```

### output csv file

This is output csv template.

```
    Token Address, Profit, Time
    HLptm5e6rTgh4EKgDpYFrnRHbjpkMyVdEeREEa2G7rf9, 0.34352, Wed Mar 27 2024 18:56:24 GMT-0700 (Pacific Daylight Time)

```

### log text file

All the trade result is logged.

```
    ⏰---log time: Fri Mar 29 2024 05:01:50 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Loaded input tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:01:50 GMT-0700 (Pacific Daylight Time)---⏰
    Start to buy!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Loaded input tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    Start to buy!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    "😎 Current Market Status: \nDUKO: {\"price\":0.005036893881098129,\"cap\":48676320.79323261}"
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Updated trade tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    😎 Start trade!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Loaded trade tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    "😎 Current Market Status: \nDUKO: {\"price\":0.005025979858910395,\"cap\":48570848.16313647}"
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Updated trade tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    "😎 Current Market Status: \nDUKO: {\"price\":0.005025979858910395,\"cap\":48570848.16313647}"
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Updated trade tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    "😎 Current Market Status: \nDUKO: {\"price\":0.005025328621816478,\"cap\":48564554.6365218}"
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    ✅ Updated trade tokens successfully!
    ⏰---log time: Fri Mar 29 2024 05:02:01 GMT-0700 (Pacific Daylight Time)---⏰
    "😎 Current Market Status: \nDUKO: {\"price\":0.005007285144803157,\"cap\":48390183.26875848}"

    ................................................
```

### last_line.lock

If detected the unprofitable token, bot is stopped and that token is saved in last_line.lock.

saved type is like:

```
    [
        {
            address: HLptm5e6rTgh4EKgDpYFrnRHbjpkMyVdEeREEa2G7rf9, // token address
            time: 171158432  // lost time
        },
        {
            ...
        }
    ]
```

## Notice

### The bot use coinmarketcap.com API for fetching current market trade including price and marketcap.

### The main function, swap is executed using Jupiter DEX.
