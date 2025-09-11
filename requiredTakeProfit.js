// quick JS solver (approximate) — edit the numeric rates to match your broker
function requiredTPpercent({P, Q, ATR, l = null, brokerageRate=0.0003, brokerageCap=20, sttRate=0.00025, exchRate=0.0000345, sebiRate=0.000001, gstRate=0.18, stampDutyBuyRate=0.00003}) {
  // Parameter validation
  if (!P || P <= 0) {
    throw new Error('Price (P) must be a positive number');
  }
  if (!Q || Q <= 0) {
    throw new Error('Quantity (Q) must be a positive number');
  }
  if (ATR !== undefined && ATR < 0) {
    throw new Error('ATR must be non-negative');
  }

  // Calculate stop loss percentage using ATR if provided, otherwise use passed l value
  let calculatedL;
  if (ATR !== undefined && ATR !== null) {
    // ATR-based stop loss calculation: l = (0.5 * ATR / P) * 100
    // This gives us the percentage for stop loss
    calculatedL = (0.5 * ATR / P);

    // Ensure minimum stop loss of 0.1% and maximum of 5% for safety
    calculatedL = Math.max(0.001, Math.min(0.05, calculatedL));
  } else if (l !== null && l !== undefined) {
    // Use provided l value for backward compatibility
    calculatedL = l;
  } else {
    throw new Error('Either ATR or l parameter must be provided');
  }

  // helper to compute brokerage for one side (cap applied per executed order)
  function brokeragePerSide(turn) {
    return Math.min(turn * brokerageRate, brokerageCap);
  }

  const turnBuy = P * Q;

  // compute charges when SL occurs (sell price = P*(1-calculatedL))
  const sellSl = P * (1 - calculatedL);
  const turnSellSL = sellSl * Q;

  const brokerageTotalSL = brokeragePerSide(turnBuy) + brokeragePerSide(turnSellSL);
  const sttSL = sttRate * turnSellSL;
  const exchTotalSL = exchRate * (turnBuy + turnSellSL);
  const sebiTotalSL = sebiRate * (turnBuy + turnSellSL);
  const gstSL = gstRate * (brokerageTotalSL + exchTotalSL + sebiTotalSL);
  const stampBuy = stampDutyBuyRate * turnBuy;

  const chargesSL = brokerageTotalSL + sttSL + exchTotalSL + sebiTotalSL + gstSL + stampBuy;
  const lossBefore = Q * P * calculatedL;
  const netLoss = lossBefore + chargesSL;

  // Now solve for g numerically (net_profit(g) = 2*netLoss)
  // net_profit(g) = profitBefore - chargesTP(g)
  const targetNetProfit = 2 * netLoss;

  // function netProfitForG(g)
  function netProfit(g) {
    const sellTP = P * (1 + g);
    const turnSellTP = sellTP * Q;
    const brokerageTotalTP = brokeragePerSide(turnBuy) + brokeragePerSide(turnSellTP);
    const sttTP = sttRate * turnSellTP;
    const exchTotalTP = exchRate * (turnBuy + turnSellTP);
    const sebiTotalTP = sebiRate * (turnBuy + turnSellTP);
    const gstTP = gstRate * (brokerageTotalTP + exchTotalTP + sebiTotalTP);
    const stampBuyTP = stampDutyBuyRate * turnBuy;
    const chargesTP = brokerageTotalTP + sttTP + exchTotalTP + sebiTotalTP + gstTP + stampBuyTP;
    const profitBefore = Q * P * g;
    return profitBefore - chargesTP;
  }

  // simple binary search for g in [0, 0.1] (0%..10%)
  let lo = 0, hi = 0.1, mid;
  for (let i=0;i<60;i++){
    mid = (lo+hi)/2;
    if (netProfit(mid) < targetNetProfit) lo = mid; else hi = mid;
  }
  return {
    required_g: (lo+hi)/2,
    netLoss,
    chargesSL,
    calculatedStopLossPercent: calculatedL,
    stopLossPrice: P * (1 - calculatedL),
    atrUsed: ATR !== undefined && ATR !== null
  };
}

// Example (the sample we computed manually) 374.8 1.125
// console.log(requiredTPpercent({P:122.80, Q:1000, l:0.0035}));

// Test case for ATR-based calculation
// Input: P = 376, ATR = 2.25, Q = 1000
// Expected stoploss_price = 374.875
// Expected l ≈ 0.299%
// console.log('\n--- ATR-based Test Case ---');
// const testResult = requiredTPpercent({P: 140.23, Q: 1000, ATR: 0.78});
// console.log('Test Result:', testResult);
// console.log(`Stop Loss Price: ${testResult.stopLossPrice} `);
// console.log(`Stop Loss Percentage: ${(testResult.calculatedStopLossPercent * 100).toFixed(3)}% `);
// console.log(`ATR Used: ${testResult.atrUsed}`);

// Short sell version of the required TP calculator
function requiredTPpercentShort({P, Q, ATR, l = null, brokerageRate=0.0003, brokerageCap=20, sttRate=0.00025, exchRate=0.0000345, sebiRate=0.000001, gstRate=0.18, stampDutyBuyRate=0.00003}) {
  // Parameter validation
  if (!P || P <= 0) {
    throw new Error('Price (P) must be a positive number');
  }
  if (!Q || Q <= 0) {
    throw new Error('Quantity (Q) must be a positive number');
  }
  if (ATR !== undefined && ATR < 0) {
    throw new Error('ATR must be non-negative');
  }

  // Calculate stop loss percentage using ATR if provided, otherwise use passed l value
  // For short selling: stop loss is ABOVE entry price (price increases = loss)
  let calculatedL;
  if (ATR !== undefined && ATR !== null) {
    // ATR-based stop loss calculation for SHORT: l = (0.5 * ATR / P) * 100
    // This gives us the percentage for stop loss ABOVE the entry price
    calculatedL = (0.5 * ATR / P);

    // Ensure minimum stop loss of 0.1% and maximum of 5% for safety
    calculatedL = Math.max(0.001, Math.min(0.05, calculatedL));
  } else if (l !== null && l !== undefined) {
    // Use provided l value for backward compatibility
    calculatedL = l;
  } else {
    throw new Error('Either ATR or l parameter must be provided');
  }

  // helper to compute brokerage for one side (cap applied per executed order)
  function brokeragePerSide(turn) {
    return Math.min(turn * brokerageRate, brokerageCap);
  }

  const turnSell = P * Q; // Initial short sell

  // compute charges when SL occurs (buy price = P*(1+calculatedL)) - buying back at higher price
  const buySl = P * (1 + calculatedL);
  const turnBuySL = buySl * Q;

  const brokerageTotalSL = brokeragePerSide(turnSell) + brokeragePerSide(turnBuySL);
  const sttSL = sttRate * turnSell; // STT only on sell side for equity
  const exchTotalSL = exchRate * (turnSell + turnBuySL);
  const sebiTotalSL = sebiRate * (turnSell + turnBuySL);
  const gstSL = gstRate * (brokerageTotalSL + exchTotalSL + sebiTotalSL);
  const stampSell = stampDutyBuyRate * turnSell;

  const chargesSL = brokerageTotalSL + sttSL + exchTotalSL + sebiTotalSL + gstSL + stampSell;
  const lossBefore = Q * P * calculatedL; // Loss from price increase
  const netLoss = lossBefore + chargesSL;

  // Now solve for g numerically (net_profit(g) = 2*netLoss)
  // For short selling: profit comes from price decrease
  const targetNetProfit = 2 * netLoss;

  // function netProfitForG(g) for short selling
  function netProfit(g) {
    const buyTP = P * (1 - g); // Buy back at lower price for profit
    const turnBuyTP = buyTP * Q;
    const brokerageTotalTP = brokeragePerSide(turnSell) + brokeragePerSide(turnBuyTP);
    const sttTP = sttRate * turnSell; // STT only on sell side
    const exchTotalTP = exchRate * (turnSell + turnBuyTP);
    const sebiTotalTP = sebiRate * (turnSell + turnBuyTP);
    const gstTP = gstRate * (brokerageTotalTP + exchTotalTP + sebiTotalTP);
    const stampSellTP = stampDutyBuyRate * turnSell;
    const chargesTP = brokerageTotalTP + sttTP + exchTotalTP + sebiTotalTP + gstTP + stampSellTP;
    const profitBefore = Q * P * g; // Profit from price decrease
    return profitBefore - chargesTP;
  }

  // simple binary search for g in [0, 0.1] (0%..10%)
  let lo = 0, hi = 0.1, mid;
  for (let i=0;i<60;i++){
    mid = (lo+hi)/2;
    if (netProfit(mid) < targetNetProfit) lo = mid; else hi = mid;
  }

  return {
    required_g: (lo+hi)/2,
    netLoss,
    chargesSL,
    calculatedStopLossPercent: calculatedL,
    stopLossPrice: P * (1 + calculatedL), // Stop loss ABOVE entry price for short
    takeProfitPrice: P * (1 - (lo+hi)/2), // Take profit BELOW entry price for short
    atrUsed: ATR !== undefined && ATR !== null
  };
}

module.exports = { requiredTPpercent, requiredTPpercentShort };