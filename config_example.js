export default {

	// there's 2 methods you can use for tx selection 
	// (use one and comment out the other one)

	// selector method #1: list of payout addresses

	selector: {
		payout_addresses: [
			"bitcoincash:qpuq03pvngt50dedz94lqwc7vfckekwwcv59g07jc7", // some guys paytaca payout address
		]
	},

	// selector method #2: directory with electron-cash history export CSV

	// selector: {
	// 	electron_cash_wallet_exports: {
	// 		directory: "/path/to/ec/wallet/export/csvs",
	// 		start_date: new Date('2022-08-01')
	// 	}
	// },

	// configuring the following is optional (if needed)

	// choose from the data you see in out.json
	csv_output_columns: [
		"payout_address",

		"derived.side",
		"derived.actualDurationInSeconds",
		
		//"derived.fundingAmountInSatoshis",
		"reformatted.fundingAmountInBCH",

		//"derived.payoutInSatoshis",
		"reformatted.payoutInBCH",

		// "prefunding_tx.hash",
		// "funding_tx.hash",
		// "payout_tx.hash",

		"prefunding_tx.time",
		"funding_tx.time",
		"payout_tx.time",

		"anyhedge.settlement.settlementType",
		// "anyhedge.settlement.hedgePayoutInSatoshis",
		// "anyhedge.settlement.longPayoutInSatoshis",

		// in case you used electron_cash_wallet_exports selector, the following columns also available for export
		// "wallet",
		// "label",
	],

	reformat_sats_2_bch: [
		{ src: "derived.fundingAmountInSatoshis", dest: "fundingAmountInBCH" },
		{ src: "derived.payoutInSatoshis", dest: "payoutInBCH" },
	]
}
