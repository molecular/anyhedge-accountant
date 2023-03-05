# anyhedge-accountant

Simple tool to retrieve accounting-relevant data for settled anyhedge contracts and output as CSV file

## preparation

  * install dependencies

    `#> npm install`

  * copy `config_example.js` to `config.js` and edit it

## running 

  `#> node anyhedge-accountant.js`

## output

you will end up with 2 output files:

  * `out.json`: all the data that was collected
  * `out.csv`: just a subset of the data (defined in config.js) in tabular form

