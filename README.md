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

