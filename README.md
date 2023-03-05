# anyhedge-accountant

Simple tool to retrieve accounting-relevant data for settled anyhedge contracts and output as CSV file

# preparation

  * install dependencies

    `#> npm install`

  * copy `config_example.js` to `config.js` and edit it

  * apply the following patch. let me know if you find a better way:

    `#> patch -s -p0 < json-arraybuffer-reviver.patch`

# running 

  `#> node anyhedge-accountant.js`
