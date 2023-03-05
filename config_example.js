export default {
	payout_addresses: [
		"bitcoincash:qpuq03pvngt50dedz94lqwc7vfckekwwcv59g07jc7", // example paytaca payout address
	],
	// configuring the following is optional (if needed)

	// choose from the data you see in out.json
	csv_output_columns: [
		"derived.side",
		"derived.actualDurationInSeconds",
		"derived.fundingAmountInSatoshis",
		"derived.payoutInSatoshis",

		// "prefunding_tx.hash",
		// "funding_tx.hash",
		// "payout_tx.hash",

		"prefunding_tx.time",
		"funding_tx.time",
		"payout_tx.time",

		"anyhedge.settlement.settlementType",
		// "anyhedge.settlement.hedgePayoutInSatoshis",
		// "anyhedge.settlement.longPayoutInSatoshis",
	]
}
