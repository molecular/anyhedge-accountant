import { AnyHedgeManager, isParsedMutualRedemptionData, isParsedPayoutData } from '@generalprotocols/anyhedge';
//const { AnyHedgeManager, isParsedMutualRedemptionData, isParsedPayoutData } = require('@generalprotocols/anyhedge');
import { ElectrumClient, ElectrumCluster } from 'electrum-cash';
import fs from 'fs';
import readline from 'readline';
import { open } from 'node:fs/promises';
import { stringify } from 'csv-stringify';
import { decodeTransaction } from '@bitauth/libauth';
import { BigNumber } from 'bignumber.js';
import moment from 'moment';

import config from './config.js';

const sats_per_bch = new BigNumber("1E8");
const bch_output_decimals = 8;

// fetches settlement tx candidates from electrum and uses general protocols anyhedge settlement transaction parser on it
const parse_anyhedge_tx = async function(data) {
	return electrum.request('blockchain.transaction.get', data.tx_hash, true)
	.then(tx =>  {
		// parse settlement tx
		data.payout_tx = tx;
		return manager.parseSettlementTransaction(tx.hex)
		.then(anyhedge_data => {
			data.anyhedge = anyhedge_data
			return data;
		})
		.catch(err => { }) // silently ignore non-anyhedge tx
	});

}

// fetches funding tx mentioned in settlement data 
const findFundingTx = async function(data) {
	const funding_txid = data.anyhedge.funding.fundingTransactionHash;
	if (funding_txid !== undefined) {
		await electrum.request('blockchain.transaction.get', funding_txid, true)
		.then(tx => {
			data.funding_tx = tx
		})
		.catch((err) => { console.log(err) })
		return data;
	}
}

// finds "prefunding" tx (the parent tx that contributed users funding to "real" funding tx) 
// also determines some derived values like "side", fundingAmountInSatoshis, payoutInSatoshis
const findPrefundingTx = async function(data) {
	// determine which side our user is 
	// and set data.derived.side and data.derived.payoutInSatoshis accordingly
	// also set user_funding_index to be able to find prefunding tx later
	var long_vout, hedge_vout = (null, null)
	data.payout_tx.vout.forEach(vout => {
// console.log("vout.value*1E8", vout.value*1E8, "vs hege", data.anyhedge.settlement.hedgePayoutInSatoshis) 
		// TODO: this is not good way to compare
		if (Math.round(vout.value * 1E8) == data.anyhedge.settlement.hedgePayoutInSatoshis) hedge_vout = vout;
		if (Math.round(vout.value * 1E8) == data.anyhedge.settlement.longPayoutInSatoshis) long_vout = vout;
	})
	data.derived = {
		side: '<unkown>'
	}
	if (hedge_vout && hedge_vout.scriptPubKey.addresses.includes(data.payout_address)) {
		data.derived.side = 'hedge';
		data.derived.payoutInSatoshis = data.anyhedge.settlement.hedgePayoutInSatoshis;
	}
	if (long_vout && long_vout.scriptPubKey.addresses.includes(data.payout_address)) {
		data.derived.side = 'long';
		data.derived.payoutInSatoshis = data.anyhedge.settlement.longPayoutInSatoshis;
	}

	// locate funding_tx.vin that is "our" prefunding tx
	var vin;

	// first look for any input to funding_tx that is in our wallets
	if (wallet_txs_by_hash) {
		data.funding_tx.vin.forEach(vin_candidate => {
			if (wallet_txs_by_hash[vin_candidate.txid]) {
				vin = vin_candidate;
			}
		})
	}

	// if not found, use heuristic
	if (!vin) {
		// to actually find prefunding tx, we use the following assumption:
		// "first input of funding_tx is from taker, last input of funding_tx is from maker"
		var vin = data.funding_tx.vin.slice(data.role == 'maker' ? -1 : 0)[0];
	}

	// retrieve prefunding tx
	return electrum.request('blockchain.transaction.get', vin.txid, true)
	.then(tx => {
		data.prefunding_tx = tx 
		return data;
	})
	.then(data => {
		var vout = data.prefunding_tx.vout[vin.vout]
		data.prefunding_deposit_address = vout.scriptPubKey.addresses[0];
		data.derived.fundingAmountInSatoshis = BigNumber(vout.value).multipliedBy(sats_per_bch).toFixed(0);
		return data;
		// var prefunding_deposit_address = data.prefunding_tx.vout[vin.vout].scriptPubKey.addresses[0];
		// // sum all the values of the inputs to funding tx that match prefunding_deposit_address
		// data.prefunding_deposit_address = prefunding_deposit_address
		// var o = new BigNumber(0);
		// return Promise.all(
		// 	data.funding_tx.vin.map(vin => { 
		// 		return electrum.request('blockchain.transaction.get', vin.txid, true)
		// 		// .then(tx => {
		// 		// 	if (data.prefunding_tx.txid = 'de1e814f4e1a50e2e0d540eb25c4e0d71f08eb1fcb9718bce397678943b0a993')
		// 		// 		console.log("  tx", tx)
		// 		// 	return tx;
		// 		// })
		// 		.then(tx => tx.vout[vin.vout])
		// 	})
		// ).then(vouts => {
		// 	// sum up the prefunding_tx vouts to prefunding_deposit_address
		// 	var prefunding_value = vouts.reduce((o, vout) => {
		// 		if (vout.scriptPubKey.addresses[0] == prefunding_deposit_address) o = o.plus(vout.value)
		// 			return o;
		// 	}, new BigNumber(0));

		// 	// sum up funding_tx change outputs not to prefunding_deposit_adddress
		// 	var funding_change = data.funding_tx.vout.reduce((o, vout) => {
		// 		if (vout.scriptPubKey.addresses[0] == prefunding_deposit_address) o = o.plus(vout.value)
		// 			return o;
		// 	}, new BigNumber(0));

		// 	// calculate and store funding amount
		// 	data.derived.fundingAmountInSatoshis = prefunding_value.minus(funding_change).multipliedBy(sats_per_bch).toFixed(0);
		// 	//data.derived.fundingAmountInSatoshis = prefunding_value.multipliedBy(sats_per_bch).toFixed(0);
		// 	return data;
		// })
	})
}	

// calculate more drived values
const deriveMoreData = function(data) {
	data.derived.actualDurationInSeconds = data.payout_tx.time - data.funding_tx.time;
	return data;
}

const reformatSomeData = function(data) {
	const getKeyValue = (obj, path) => {
	  const keys = path.split('.')
	  while (keys.length) {
	    let loc = keys.shift()
	    if (obj.hasOwnProperty(loc)) {
	      obj = obj[loc]
	    } else {
	      obj = undefined
	      break
	    }
	  }
	  return obj
	}	

	if (!data.reformatted) data.reformatted = {};

	// reformat_sats_2_bch
	config.reformat_sats_2_bch.forEach(r => {
		data.reformatted[r.dest] = BigNumber(getKeyValue(data, r.src)).integerValue().dividedBy(sats_per_bch).toFixed(bch_output_decimals);	
	});

	// reformat_date
	config.reformat_date.forEach(r => {
		data.reformatted[r.dest] = moment(Number(getKeyValue(data, r.src))*1000).format(config.date_format)
	})

	return data;
} 

// write configured data items to CSV
const writeCSV = function(filename) {
	return (results) => {
		let file = fs.createWriteStream(filename)
		stringify(results, { 
			header: true,
			columns: config.csv_output_columns
		})
		.pipe(file);
		console.log(`wrote ${results.length} items to ${filename}`);
		file.on('close', () => process.exit(0))
		return results;
	}; 
}

var wallet_txs, wallet_txs_by_hash;

// write JSON
const writeJSON = function(filename) {
	return (results) => {
		fs.writeFile(filename, JSON.stringify(results), 'utf8', (err) => console.log);
		console.log(`wrote ${results.length} items to ${filename}`)
		return results;
	}
}

// reduce [][] => []
function flattenArrays(arrays) {
	return arrays.reduce((o, i) => { return o.concat(i); }, [])
}

// ec wallet export handling
function handleWalletExports() {

	function loadWallet(path, filename, wallet_txs) {
		console.log("loading wallet", filename)
		const data = fs.readFileSync(path + "/" + filename, 'UTF-8').split(/\r?\n/)
		const valuesRegExp = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^\",]+)/g;
		const names = ["tx_hash", "label", "delta", "date"];
		data.forEach((d) => {
			let i = 0, key = null, matches = null, entry = {wallet: filename};
			while (matches = valuesRegExp.exec(d)) {
				let v = matches[1] || matches[2] || ""
				v = v.replace(/\"\"/g, "\"");
				if ( names[i] == "date" ) {
					v = new Date(v * 1000)
				} 
				entry[names[i]] = v;
				i += 1;
			}
			wallet_txs.push(entry)
		})
	}

	function loadWallets(path) {
		let wallet_txs = []
		fs
		.readdirSync(path)
		.filter(fn => fn.endsWith(".csv"))
		.forEach((filename) => {
			loadWallet(path, filename, wallet_txs)
		})
		return wallet_txs;
	}

	// load wallet txs from csv files (exported from EC)
	wallet_txs = loadWallets(config.selector.electron_cash_wallet_exports.directory);

	// index wallet txs by hash (there may be duplicates, so use an [])
	wallet_txs_by_hash = wallet_txs.reduce((o, tx) => {
		if (!o[tx.tx_hash]) {
			o[tx.tx_hash] = [];
		}
		o[tx.tx_hash].push(tx);
		return o;
	}, {})
}

function getCandidateTxsFromWallets() {
	// return promise of list of candidate txs
	return Promise.all(
		// filter wallet txs for settlement tx candidates,...
		wallet_txs.filter(tx => ( true
				&& tx.date >= config.selector.electron_cash_wallet_exports.start_date
				&& tx.delta > 0.00001 // <- TODO: think about this one
				&& wallet_txs_by_hash[tx.tx_hash].length == 1
			)
		)
	)
}

// --- main -----------------------------------------------------------------------------------------------

// instantiate AnyHedgeManager and ElectrumClient
const manager = new AnyHedgeManager();
const electrum = new ElectrumClient('anyhedge settlement tx parser by molec', '1.4.1', config.electrum_server);
await electrum.connect();

// --- setup and execute promise chain(s) ---

var datas;

if (config.selector.electron_cash_wallet_exports) {
	handleWalletExports()
}

if (config.selector.payout_addresses) {
	handleWalletExports()

	datas = Promise.all( // collect all transactions involving configured payout_addresses
		config.selector.payout_addresses.map(payout_address => 
			electrum.request('blockchain.address.get_history', payout_address.address)
			.then(txs => {
				//txs = txs.filter(tx => tx.tx_hash == '<insert hash>' )
				//txs = txs.slice(1,10) // temp
				txs.forEach(tx => { tx.payout_address = payout_address.address; tx.role = payout_address.role })
				return txs;
			})
		)
	)
	.then(flattenArrays) // flatten array of arrays => array

} else if (config.selector.electron_cash_wallet_exports) {

	datas = getCandidateTxsFromWallets()

} else {
	console.log("you need to configure either 'selector.payout_addresses' or 'selector.electron_cash_wallet_exports' in config.js")
}

datas
//.then(console.log)
.then(datas => Promise.all(datas.map(data => parse_anyhedge_tx(data))))
.then(datas => datas.filter(data => data)) // filter out unsuccessful parse attempts
.then(datas => { // attempt to parse txs as anyhedge settlement txs
	return Promise.all(datas.map(data => {
		return findFundingTx(data)
		.then(findPrefundingTx)
		.then(deriveMoreData)
		.then(reformatSomeData)
	}));
})
//.then(console.log)
.then(writeCSV(config.output_filename + ".csv"))
.then(writeJSON(config.output_filename + ".json"))

//console.log("datas", datas)
// console.log("datas[0]", datas[0])
// console.log("datas[0].anyhedge", datas[0].anyhedge)

