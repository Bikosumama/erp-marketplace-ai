function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function calculateFinancials({
  cost,
  salePrice,
  commissionRate = 18,
  fixedFee = 0,
  shippingCost = 0,
  vatRate = 20,
}) {
  const safeCost = toNumber(cost);
  const safeSalePrice = toNumber(salePrice);
  const commissionDecimal = Math.max(0, toNumber(commissionRate)) / 100;
  const vatMultiplier = 1 + Math.max(0, toNumber(vatRate)) / 100;
  const revenueExVat = safeSalePrice / vatMultiplier;
  const commissionAmount = revenueExVat * commissionDecimal;
  const netRevenue = revenueExVat - commissionAmount - toNumber(fixedFee) - toNumber(shippingCost);
  const profit = netRevenue - safeCost;
  const marginRate = safeCost > 0 ? (profit / safeCost) * 100 : 0;

  return {
    revenueExVat: round2(revenueExVat),
    commissionAmount: round2(commissionAmount),
    netRevenue: round2(netRevenue),
    profit: round2(profit),
    marginRate: round2(marginRate),
  };
}

function solveRequiredSalePrice({
  cost,
  targetProfitMargin = 10,
  commissionRate = 18,
  fixedFee = 0,
  shippingCost = 0,
  vatRate = 20,
}) {
  const safeCost = toNumber(cost);
  const requiredProfit = safeCost * (Math.max(0, toNumber(targetProfitMargin)) / 100);
  const commissionDecimal = Math.max(0, toNumber(commissionRate)) / 100;
  const vatMultiplier = 1 + Math.max(0, toNumber(vatRate)) / 100;
  const denominator = (1 - commissionDecimal) / vatMultiplier;

  if (denominator <= 0) {
    return 0;
  }

  const salePrice = (safeCost + requiredProfit + toNumber(fixedFee) + toNumber(shippingCost)) / denominator;
  return round2(salePrice);
}

function computeQualityScore(product) {
  let score = 100;
  if (!product?.name) score -= 20;
  if (!product?.stock_code) score -= 20;
  if (!toNumber(product?.cost)) score -= 30;
  if (!toNumber(product?.sale_price)) score -= 20;
  if (!product?.category_id) score -= 5;
  if (!product?.barcode) score -= 5;
  return Math.max(0, score);
}

function buildRecommendation({
  product,
  marketplaceRule = {},
  shippingRule = {},
  profitTarget = {},
  competitorPrice = null,
}) {
  const cost = toNumber(product?.cost);
  const currentPrice = toNumber(product?.sale_price || product?.list_price);
  const commissionRate = toNumber(marketplaceRule?.commission_rate, 18);
  const fixedFee = toNumber(marketplaceRule?.fixed_fee, 0);
  const vatRate = toNumber(product?.vat_rate ?? marketplaceRule?.vat_rate, 20);
  const shippingCost = toNumber(shippingRule?.shipping_cost, 0);
  const minProfitMargin = toNumber(profitTarget?.min_profit_margin ?? marketplaceRule?.minimum_profit_margin, 10);
  const targetProfitMargin = toNumber(profitTarget?.target_profit_margin ?? marketplaceRule?.target_profit_margin, Math.max(minProfitMargin + 5, 15));
  const qualityScore = computeQualityScore(product);

  const reasons = [];
  const alerts = [];

  if (!cost) {
    alerts.push({
      type: 'missing_cost',
      severity: 'high',
      title: 'Maliyet eksik',
      message: 'Üründe maliyet bilgisi olmadığı için güvenilir fiyat önerisi üretilemedi.',
    });
  }

  if (!currentPrice) {
    alerts.push({
      type: 'missing_price',
      severity: 'high',
      title: 'Satış fiyatı eksik',
      message: 'Üründe mevcut satış fiyatı olmadığı için öneri kıyaslaması sınırlı yapıldı.',
    });
  }

  const floorPrice = solveRequiredSalePrice({
    cost,
    targetProfitMargin: minProfitMargin,
    commissionRate,
    fixedFee,
    shippingCost,
    vatRate,
  });

  const targetPrice = solveRequiredSalePrice({
    cost,
    targetProfitMargin,
    commissionRate,
    fixedFee,
    shippingCost,
    vatRate,
  });

  const currentMetrics = calculateFinancials({
    cost,
    salePrice: currentPrice || targetPrice,
    commissionRate,
    fixedFee,
    shippingCost,
    vatRate,
  });

  let suggestedPrice = targetPrice || currentPrice;
  const safeCompetitor = competitorPrice == null ? null : toNumber(competitorPrice);

  if (safeCompetitor && safeCompetitor > 0) {
    if (safeCompetitor < floorPrice) {
      suggestedPrice = floorPrice;
      reasons.push('Rakip fiyatı taban kârlılık seviyesinin altına düştüğü için taban fiyat korundu.');
    } else {
      suggestedPrice = Math.min(targetPrice || safeCompetitor, Math.max(floorPrice, safeCompetitor - 0.1));
      reasons.push('Rakip fiyatı dikkate alınarak hedef fiyat rekabetçi seviyeye çekildi.');
    }
  } else {
    reasons.push('Rakip fiyatı bulunmadığı için öneri yalnızca maliyet ve kâr hedeflerine göre üretildi.');
  }

  if (currentPrice > 0 && Math.abs(currentPrice - suggestedPrice) < 0.05) {
    suggestedPrice = currentPrice;
  }

  const projectedMetrics = calculateFinancials({
    cost,
    salePrice: suggestedPrice,
    commissionRate,
    fixedFee,
    shippingCost,
    vatRate,
  });

  let recommendationType = 'hold';
  if (suggestedPrice > currentPrice + 0.05) recommendationType = 'increase';
  if (currentPrice > 0 && suggestedPrice < currentPrice - 0.05) recommendationType = 'decrease';
  if (!currentPrice || !cost) recommendationType = 'manual_review';

  let riskLevel = 'low';
  if (!cost || currentMetrics.marginRate < minProfitMargin || qualityScore < 70) {
    riskLevel = 'high';
  } else if (safeCompetitor && safeCompetitor < targetPrice) {
    riskLevel = 'medium';
  }

  if (currentMetrics.marginRate < minProfitMargin) {
    alerts.push({
      type: 'margin_drop',
      severity: 'high',
      title: 'Marj hedef altına düştü',
      message: `Mevcut marj %${currentMetrics.marginRate}, minimum hedef %${round2(minProfitMargin)}.`,
    });
    reasons.push('Mevcut fiyat minimum kâr marjı hedefinin altında kalıyor.');
  }

  if (recommendationType === 'hold') {
    reasons.push('Mevcut fiyat zaten güvenli bantta olduğu için değişiklik önerilmedi.');
  } else if (recommendationType === 'increase') {
    reasons.push('Kârlılık hedefini yakalamak için fiyat artışı önerildi.');
  } else if (recommendationType === 'decrease') {
    reasons.push('Rekabette kalmak için kontrollü fiyat indirimi önerildi.');
  }

  const confidence = Math.max(0.3, Math.min(0.96, (qualityScore / 100) * (riskLevel === 'high' ? 0.75 : riskLevel === 'medium' ? 0.88 : 0.96)));

  return {
    currentPrice: round2(currentPrice),
    recommendedPrice: round2(suggestedPrice),
    floorPrice: round2(floorPrice),
    targetPrice: round2(targetPrice),
    competitorPrice: safeCompetitor != null ? round2(safeCompetitor) : null,
    currentMarginRate: round2(currentMetrics.marginRate),
    projectedMarginRate: round2(projectedMetrics.marginRate),
    profitMargin: round2(projectedMetrics.marginRate),
    recommendationType,
    riskLevel,
    confidence: round2(confidence),
    reasonText: reasons.join(' '),
    reasons,
    alerts,
    qualityScore,
    metadata: {
      commissionRate: round2(commissionRate),
      fixedFee: round2(fixedFee),
      shippingCost: round2(shippingCost),
      vatRate: round2(vatRate),
      minProfitMargin: round2(minProfitMargin),
      targetProfitMargin: round2(targetProfitMargin),
    },
  };
}

module.exports = {
  toNumber,
  round2,
  calculateFinancials,
  solveRequiredSalePrice,
  buildRecommendation,
};
