# anyhedge-accountant

Simple tool to retrieve accounting-relevant data for settled anyhedge contracts and output as CSV file

## general mode of operation

given either a configured list of payout addresses or a directory with electron cash history export csv files, this tool collects all transactions involving those addresses and checks wether or not they are anyhedge settlement transactions. If so, 
 * prefunding tx
 * funding tx
 * payout tx

are all determined and fetched from electrum server. The users `side` is determined (hedge/long) and the data is output as csv (partial data) and json (full dump).

## preparation

 * you'll need `node` and `npm` on your system
 * install dependencies using 

   `#> npm install`

 * copy `config_example.js` to `config.js` 

   `#> edit config.js`

## running 

 * `#> node anyhedge-accountant.js`

## output

you will end up with 2 output files:

  * `out.json`: all the data that was collected
  * `out.csv`: just a subset of the data (defined in config.js) in tabular form

## CAVEAT

The tool currently relies on the following assumptions:

   * first input of funding_tx is from maker (usually the LP), last input of funding_tx is from taker (usually YOU)
   * any change outputs of funding_tx go back to the respective input addresses (puzzling, not sure about this, code removed)

to identify the prefunding_tx

This assumption will likely not hold in the future: GP said they might at some point randomize that order.

## CAVEAT2

The concept of a prefunding tx does not always make sense. For example paytaca funds the contract directly from your wallet.

I could remove the whole prefunding_tx, but it might give valuable info for BCHBull users and maybe for manually setup contracts, so I'm leaving it in there. Just be aware prefunding_tx might not always make sense.