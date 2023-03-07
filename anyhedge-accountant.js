import { AnyHedgeManager, isParsedMutualRedemptionData, isParsedPayoutData } from '@generalprotocols/anyhedge';
//const { AnyHedgeManager, isParsedMutualRedemptionData, isParsedPayoutData } = require('@generalprotocols/anyhedge');
import { ElectrumClient, ElectrumCluster } from 'electrum-cash';
import fs from 'fs';
import readline from 'readline';
import { open } from 'node:fs/promises';
import { stringify } from 'csv-stringify';
import { decodeTransaction } from '@bitauth/libauth';

import config from './config.js';

// fetches settlement tx candidates from electrum and uses general protocols anyhedge settlement transaction parser on it
const parse_anyhedge_tx = async function(data) {
	return electrum.request('blockchain.transaction.get', data.tx_hash)
	.then(hex =>  {
		// parse settlement tx
		return manager.parseSettlementTransaction(hex)
		.then(anyhedge_data => {
			data.anyhedge = anyhedge_data
			return data;
		})
		.catch(err => { }) // silently ignore non-anyhedge tx
	});

}

// fetches payout (settlement) tx
const findPayoutTx = function(data) {
	return electrum.request('blockchain.transaction.get', data.anyhedge.settlement.settlementTransactionHash, true)
	.then((tx) => {
		data.payout_tx = tx
		// when using wallet exports, find payout_address by matching delta to vout.value
		if (config.selector.electron_cash_wallet_exports) {
			data.payout_tx.vout.forEach(vout => {
				if (vout.value == Number(data.delta)) data.payout_address = vout.scriptPubKey.addresses[0];
			})
		}
		return data;
	})
	.catch((err) => { console.log(err) })
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
const findPrefundingTx = function(data) {

	// determine which side our user is 
	// and set data.derived.side and data.derived.payoutInSatoshis accordingly
	// also set user_funding_index to be able to find prefunding tx later
	var long_vout, hedge_vout = (null, null)
	data.payout_tx.vout.forEach(vout => {
		//console.log("vout.value*1E8", vout.value*1E8) 
		// TODO: this is not good way to compare
		if (Math.round(vout.value * 1E8) == data.anyhedge.settlement.hedgePayoutInSatoshis) hedge_vout = vout;
		if (Math.round(vout.value * 1E8) == data.anyhedge.settlement.longPayoutInSatoshis) long_vout = vout;
	})
	data.derived = {
		side: '<unkown>'
	}
	var user_funding_index;
	if (hedge_vout && hedge_vout.scriptPubKey.addresses.includes(data.payout_address)) {
		data.derived.side = 'hedge';
		data.derived.fundingAmountInSatoshis = Math.round(hedge_vout.value * 1E8);
		data.derived.payoutInSatoshis = data.anyhedge.settlement.hedgePayoutInSatoshis;
		user_funding_index = 0
	}
	if (long_vout && long_vout.scriptPubKey.addresses.includes(data.payout_address)) {
		data.derived.side = 'long';
		data.derived.fundingAmountInSatoshis = Math.round(long_vout.value * 1E8);
		data.derived.payoutInSatoshis = data.anyhedge.settlement.longPayoutInSatoshis;
		user_funding_index = 1
	}

	// find and retrieve prefunding tx
	if (user_funding_index) {
		var prefunding_txid = data.funding_tx.vin[user_funding_index].txid // first input of funding tx is user funding
		return electrum.request('blockchain.transaction.get', prefunding_txid, true)
		.then(tx => {
			data.prefunding_tx = tx 
			return data;
		});
	} else {
		return data;
	}
}	

// calculate more drived values
const deriveMoreData = function(data) {
	data.derived.actualDurationInSeconds = data.payout_tx.time - data.funding_tx.time;
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
	const wallet_txs = loadWallets(config.selector.electron_cash_wallet_exports.directory);

	// index wallet txs by hash (there may be duplicates, so use an [])
	const wallet_txs_by_hash = wallet_txs.reduce((o, tx) => {
		if (!o[tx.tx_hash]) {
			o[tx.tx_hash] = [];
		}
		o[tx.tx_hash].push(tx);
		return o;
	}, {})

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
const electrum = new ElectrumClient('anyhedge settlement tx parser by molec', '1.4.1', 'bch.imaginary.cash');
await electrum.connect();

// --- setup and execute promise chain(s) ---

var datas;

if (config.selector.electron_cash_wallet_exports) {

	datas = handleWalletExports()

} else if (config.selector.payout_addresses) {

	datas = Promise.all( // collect all transactions involving configured payout_addresses
		config.selector.payout_addresses.map(payout_address => 
			electrum.request('blockchain.address.get_history', payout_address)
			.then(txs => {
				txs.forEach(tx => { tx.payout_address = payout_address })
				return txs;
			})
		)
	)
	.then(flattenArrays) // flatten array of arrays => array

} else {
	console.log("you need to configure either 'selector.payout_addresses' or 'selector.electron_cash_wallet_exports' in config.js")
}

datas
//.then(console.log)
.then(datas => Promise.all(datas.map(data => parse_anyhedge_tx(data))))
.then(datas => datas.filter(data => data)) // filter out unsuccessful parse attempts
.then(datas => { // attempt to parse txs as anyhedge settlement txs
	return Promise.all(datas.map(data => {
		return findPayoutTx(data)
		.then(findFundingTx)
		.then(findPrefundingTx)
		.then(deriveMoreData)
	}));
})
//.then(console.log)
.then(writeCSV("out.csv"))
.then(writeJSON("out.json"))

//console.log("datas", datas)
// console.log("datas[0]", datas[0])
// console.log("datas[0].anyhedge", datas[0].anyhedge)

