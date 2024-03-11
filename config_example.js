export default {

	// there's 2 methods you can use for tx selection 
	// (use one and comment out the other one)

	// selector method #1: list of payout addresses plus role (ususuall "taker" unless you want to take the view of the market maker bot)

	selector: {
		payout_addresses: [
			{ address: "bitcoincash:qpuq03pvngt50dedz94lqwc7vfckekwwcv59g07jc7", role: "maker" }, // some guys paytaca payout address
			// { address: "bitcoincash:qq2qjesqhy78k5xznl39tqkyjphegmn5hum4sckvhp", role: "maker" } // General Protocols market maker bot (liquidity provider)
		]
		// additionally you can supply wallet exports to make prefunding_tx selection more reliable in some cases
		electron_cash_wallet_exports: [{
			directories: ["/path/to/ec/wallet/export/csvs"],
			start_date: new Date('2022-08-01')
		}]
	},

	// selector method #2: directory with electron-cash history export CSV

	// selector: {
	// 	electron_cash_wallet_exports: [{
	// 		directories: ["/path/to/ec/wallet/export/csvs"],
	// 		start_date: new Date('2022-08-01')
	// 	}]
	// },

	// configuring the following is optional (if needed)
	output_filename: "out",

	// choose from the data you see in out.json
	csv_output_columns: [
		"payout_address",

		"derived.side",
		"derived.actualDurationInSeconds",
		
		//"derived.fundingAmountInSatoshis",
		"reformatted.fundingAmountInBCH",

		//"derived.payoutInSatoshis",
		"reformatted.payoutInBCH",

		"prefunding_tx.time",
		"funding_tx.time",
		"payout_tx.time",

		"reformatted.prefunding_tx_time",
		"reformatted.funding_tx_time",
		"reformatted.payout_tx_time",

		"anyhedge.settlement.settlementType",
		"anyhedge.settlement.hedgePayoutInSatoshis",
		"anyhedge.settlement.longPayoutInSatoshis",

		// in case you used electron_cash_wallet_exports selector, the following columns also available for export
		"wallet",
		"label",

		"prefunding_tx.hash",
		"funding_tx.hash",
		"payout_tx.hash",

	],

	electrum_server: "fulcrum.criptolayer.net",

	reformat_sats_2_bch: [
		{ src: "derived.fundingAmountInSatoshis", dest: "fundingAmountInBCH" },
		{ src: "derived.payoutInSatoshis", dest: "payoutInBCH" },
	],

	date_format: "YYYY-MM-DD HH:mm:ss",
	reformat_date: [
		{ src: "prefunding_tx.time", dest: "prefunding_tx_time" },
		{ src: "funding_tx.time", dest: "funding_tx_time" },
		{ src: "payout_tx.time", dest: "payout_tx_time" }
	]
}
