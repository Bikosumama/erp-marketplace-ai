const DEFAULT_VAT_RATE = 20;
const DEFAULT_ROUNDING_ENDING = 0.90;

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toRate(value) {
  return toNumber(value, 0) / 100;
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function roundUpToEnding(price, ending = DEFAULT_ROUNDING_ENDING) {
  const safePrice = toNumber(price, 0);
  const safeEnding = toNumber(ending, DEFAULT_ROUNDING_ENDING);
  const whole = Math.floor(safePrice);
  const candidate = whole + safeEnding;
  if (safePrice <= candidate) return round2(candidate);
  return round2(whole + 1 + safeEnding);
}

function isRowActive(row) {
  if (!row) return false;
  if (row.is_active === 0 || row.is_active === false) return false;
  const now = new Date();
  if (row.valid_from && new Date(row.valid_from) > now) return false;
  if (row.valid_to && new Date(row.valid_to) < now) return false;
  return true;
}

function resolveScopedRule(rows = [], context = {}) {
  const { marketplaceId = null, categoryId = null, productId = null } = context;

  const scored = rows
    .filter(isRowActive)
    .map((row) => {
      let score = -1;
      if (row.scope_type === 'product' && String(row.product_id) === String(productId)) score = 400;
      else if (row.scope_type === 'category' && String(row.category_id) === String(categoryId)) score = 300;
      else if (row.scope_type === 'marketplace' && String(row.marketplace_id) === String(marketplaceId)) score = 200;
      else if (row.scope_type === 'general' || row.marketplace_id == null) score = 100;

      return {
        row,
        score,
        priority: toNumber(row.priority, 0),
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : 0,
      };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.updatedAt - a.updatedAt;
    });

  return scored.length ? scored[0].row : null;
}

function resolveShippingRuleByPrice(rows = [], context = {}) {
  const { marketplaceId = null, listingPrice = 0 } = context;

  const scored = rows
    .filter(isRowActive)
    .filter((row) => {
      const minPrice = toNumber(row.min_price, 0);
      const maxPrice = row.max_price == null ? Number.MAX_SAFE_INTEGER : toNumber(row.max_price, Number.MAX_SAFE_INTEGER);
      return toNumber(listingPrice, 0) >= minPrice && toNumber(listingPrice, 0) <= maxPrice;
    })
    .map((row) => {
      let score = -1;
      if (row.scope_type === 'marketplace' && String(row.marketplace_id) === String(marketplaceId)) score = 200;
      else if (row.scope_type === 'general' || row.marketplace_id == null) score = 100;
      return { row, score, priority: toNumber(row.priority, 0) };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });

  return scored.length ? scored[0].row : null;
}

function getBaseAmount(baseAmountType, ctx) {
  switch (baseAmountType) {
    case 'gross_price':
      return ctx.grossPrice;
    case 'net_after_commission':
      return Math.max(0, ctx.netExVat - ctx.commissionAmount - ctx.fixedFeeAmount);
    case 'net_ex_vat':
    default:
      return ctx.netExVat;
  }
}

function calculateExtraDeductions(extraDeductions = [], ctx) {
  const items = [...extraDeductions]
    .filter(isRowActive)
    .sort((a, b) => toNumber(a.priority, 0) - toNumber(b.priority, 0))
    .map((item) => {
      const calculationType = item.calculation_type || 'percentage';
      const baseAmountType = item.base_amount_type || 'net_ex_vat';
      const baseAmount = getBaseAmount(baseAmountType, ctx);
      const amount = calculationType === 'fixed'
        ? toNumber(item.fixed_amount, 0)
        : baseAmount * toRate(item.rate);

      return {
        id: item.id || null,
        name: item.name || 'Ek Kesinti',
        deduction_type: item.deduction_type || 'other',
        calculation_type: calculationType,
        base_amount_type: baseAmountType,
        base_amount: round2(baseAmount),
        amount: round2(amount),
      };
    });

  return {
    items,
    total: round2(items.reduce((sum, item) => sum + item.amount, 0)),
  };
}

function calculateBreakdown({
  listingPrice,
  product,
  marketplaceRule,
  shippingRule = null,
  extraDeductions = [],
}) {
  const grossPrice = toNumber(listingPrice, 0);
  const purchasePrice = toNumber(
    product.purchase_price ?? product.cost ?? product.cost_price ?? product.buying_price,
    0
  );
  const vatRate = toRate(marketplaceRule?.vat_rate ?? product?.vat_rate ?? DEFAULT_VAT_RATE);
  const commissionRate = toRate(marketplaceRule?.commission_rate);
  const commissionBase = marketplaceRule?.commission_base || 'net_ex_vat';
  const fixedFeeAmount = toNumber(marketplaceRule?.fixed_fee, 0);
  const shippingCost = toNumber(shippingRule?.shipping_cost ?? shippingRule?.shipping_fee ?? 0, 0);
  const netExVat = grossPrice / (1 + vatRate);

  const commissionBaseAmount = getBaseAmount(commissionBase, {
    grossPrice,
    netExVat,
    commissionAmount: 0,
    fixedFeeAmount,
  });
  const commissionAmount = round2(commissionBaseAmount * commissionRate);

  const extra = calculateExtraDeductions(extraDeductions, {
    grossPrice,
    netExVat,
    commissionAmount,
    fixedFeeAmount,
  });

  const totalDeductions = round2(commissionAmount + fixedFeeAmount + shippingCost + extra.total);
  const profit = round2(netExVat - purchasePrice - totalDeductions);
  const marginRate = netExVat > 0 ? round2((profit / netExVat) * 100) : 0;

  return {
    listing_price: round2(grossPrice),
    net_ex_vat: round2(netExVat),
    purchase_price: round2(purchasePrice),
    commission_amount: round2(commissionAmount),
    fixed_fee_amount: round2(fixedFeeAmount),
    shipping_cost: round2(shippingCost),
    shipping_rule_id: shippingRule?.id || null,
    shipping_rule_scope: shippingRule?.scope_type || null,
    extra_deductions: extra.items,
    extra_deductions_total: round2(extra.total),
    total_deductions: round2(totalDeductions),
    profit: round2(profit),
    margin_rate: round2(marginRate),
  };
}

function calculateBreakdownWithDynamicShipping({ listingPrice, product, marketplaceRule, shippingRules = [], extraDeductions = [] }) {
  const shippingRule = resolveShippingRuleByPrice(shippingRules, {
    marketplaceId: marketplaceRule?.marketplace_id || null,
    listingPrice,
  });

  return {
    breakdown: calculateBreakdown({ listingPrice, product, marketplaceRule, shippingRule, extraDeductions }),
    shippingRule,
  };
}

function findListingPriceForMargin({ product, marketplaceRule, shippingRules = [], extraDeductions = [], requiredMarginRate = 0, startPrice = 1 }) {
  const targetMargin = toNumber(requiredMarginRate, 0);

  let low = Math.max(toNumber(startPrice, 1), 1);
  let high = Math.max(low, 100);

  let { breakdown: highBreakdown } = calculateBreakdownWithDynamicShipping({
    listingPrice: high,
    product,
    marketplaceRule,
    shippingRules,
    extraDeductions,
  });

  let guard = 0;
  while (highBreakdown.margin_rate < targetMargin && guard < 40) {
    high = high * 1.25;
    ({ breakdown: highBreakdown } = calculateBreakdownWithDynamicShipping({
      listingPrice: high,
      product,
      marketplaceRule,
      shippingRules,
      extraDeductions,
    }));
    guard += 1;
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const { breakdown: midBreakdown } = calculateBreakdownWithDynamicShipping({
      listingPrice: mid,
      product,
      marketplaceRule,
      shippingRules,
      extraDeductions,
    });

    if (midBreakdown.margin_rate >= targetMargin) high = mid;
    else low = mid;
  }

  return round2(high);
}

function buildRecommendation({
  product,
  marketplaceRule,
  shippingRules = [],
  extraDeductions = [],
  brandMinPrice = 0,
  minMarginRate = 0,
  targetMarginRate = 0,
  competitorPrice = null,
}) {
  const currentPrice = toNumber(product.sale_price ?? product.price, 0);
  const safeBrandMinPrice = toNumber(brandMinPrice || product.brand_min_price || product.minimum_allowed_price, 0);
  const marketplaceDiscountRate = toRate(marketplaceRule?.marketplace_discount_rate);
  const marketplaceDiscountFunded = marketplaceRule?.marketplace_discount_funded === 1 || marketplaceRule?.marketplace_discount_funded === true;
  const roundingEnding = toNumber(marketplaceRule?.rounding_ending, DEFAULT_ROUNDING_ENDING);

  const profitFloor = findListingPriceForMargin({
    product,
    marketplaceRule,
    shippingRules,
    extraDeductions,
    requiredMarginRate: minMarginRate,
    startPrice: Math.max(currentPrice, toNumber(product.cost, 0), safeBrandMinPrice, 1),
  });

  const targetProfitPrice = findListingPriceForMargin({
    product,
    marketplaceRule,
    shippingRules,
    extraDeductions,
    requiredMarginRate: targetMarginRate,
    startPrice: Math.max(profitFloor, safeBrandMinPrice, currentPrice, 1),
  });

  const protectedFloor = round2(Math.max(profitFloor, safeBrandMinPrice));
  const discountAdjustedProtectedPrice = marketplaceDiscountFunded && marketplaceDiscountRate > 0
    ? round2(protectedFloor / (1 - marketplaceDiscountRate))
    : protectedFloor;

  const rawFinalListingPrice = round2(Math.max(discountAdjustedProtectedPrice, targetProfitPrice));
  const finalListingPrice = roundUpToEnding(rawFinalListingPrice, roundingEnding);

  const { breakdown: currentBreakdown } = calculateBreakdownWithDynamicShipping({
    listingPrice: currentPrice || finalListingPrice,
    product,
    marketplaceRule,
    shippingRules,
    extraDeductions,
  });

  const { breakdown: finalBreakdown, shippingRule } = calculateBreakdownWithDynamicShipping({
    listingPrice: finalListingPrice,
    product,
    marketplaceRule,
    shippingRules,
    extraDeductions,
  });

  const customerSeenPrice = marketplaceDiscountFunded && marketplaceDiscountRate > 0
    ? round2(finalListingPrice * (1 - marketplaceDiscountRate))
    : finalListingPrice;

  let recommendationType = 'hold';
  if (currentPrice > 0) {
    if (finalListingPrice > currentPrice) recommendationType = 'increase';
    else if (finalListingPrice < currentPrice) recommendationType = 'decrease';
  }

  const competitorNumber = competitorPrice == null ? null : toNumber(competitorPrice, null);
  let riskLevel = 'low';
  const alerts = [];

  if (finalBreakdown.margin_rate < toNumber(minMarginRate, 0) + 2) riskLevel = 'medium';
  if (finalBreakdown.margin_rate < toNumber(minMarginRate, 0)) riskLevel = 'high';
  if (safeBrandMinPrice > 0 && customerSeenPrice < safeBrandMinPrice) {
    riskLevel = 'high';
    alerts.push({ type: 'brand_min_violation', severity: 'high', title: 'Firma alt fiyat koruması', message: 'Hesaplanan müşteri fiyatı firma minimum fiyatının altına düşüyor.' });
  }
  if (competitorNumber != null && competitorNumber < protectedFloor) {
    alerts.push({ type: 'competitor_below_floor', severity: 'medium', title: 'Rakip fiyat baskısı', message: 'Rakip fiyatı korunacak tabanın altında görünüyor.' });
  }

  const reasons = [
    `Karlılık tabanı: ${profitFloor.toFixed(2)} TL`,
    `Firma minimum fiyatı: ${safeBrandMinPrice.toFixed(2)} TL`,
    `Korunan taban: ${protectedFloor.toFixed(2)} TL`,
    marketplaceDiscountFunded && marketplaceDiscountRate > 0
      ? `Pazaryeri indirimi: %${(marketplaceDiscountRate * 100).toFixed(2)}`
      : 'Pazaryeri indirimi uygulanmıyor',
    `İndirim düzeltilmiş gönderim fiyatı: ${discountAdjustedProtectedPrice.toFixed(2)} TL`,
    `Hedef karlılık fiyatı: ${targetProfitPrice.toFixed(2)} TL`,
    `Yuvarlanmış nihai gönderim fiyatı: ${finalListingPrice.toFixed(2)} TL`,
    `Müşteri fiyatı: ${customerSeenPrice.toFixed(2)} TL`,
    `Kargo kuralı: ${shippingRule?.scope_type || 'yok'} / ${shippingRule?.shipping_cost != null ? `${round2(shippingRule.shipping_cost).toFixed(2)} TL` : '0.00 TL'}`,
  ];

  const qualityScore = Math.max(
    0,
    100
      - (product.cost ? 0 : 20)
      - (marketplaceRule ? 0 : 20)
      - (shippingRule ? 0 : 10)
      - (safeBrandMinPrice > 0 ? 0 : 5)
  );

  return {
    currentPrice: round2(currentPrice),
    recommendedPrice: round2(finalListingPrice),
    floorPrice: round2(profitFloor),
    targetPrice: round2(targetProfitPrice),
    currentMarginRate: currentBreakdown.margin_rate,
    projectedMarginRate: finalBreakdown.margin_rate,
    profitMargin: finalBreakdown.profit,
    recommendationType,
    riskLevel,
    confidence: riskLevel === 'high' ? 0.72 : riskLevel === 'medium' ? 0.84 : 0.93,
    qualityScore,
    competitorPrice: competitorNumber,
    reasonText: reasons.join(' | '),
    reasons,
    alerts,
    metadata: {
      brand_min_price: round2(safeBrandMinPrice),
      protected_floor: round2(protectedFloor),
      marketplace_discount_rate: round2(marketplaceDiscountRate * 100),
      discount_adjusted_protected_price: round2(discountAdjustedProtectedPrice),
      raw_final_listing_price: round2(rawFinalListingPrice),
      final_listing_price: round2(finalListingPrice),
      customer_seen_price: round2(customerSeenPrice),
      shipping_cost: finalBreakdown.shipping_cost,
      shipping_rule_id: shippingRule?.id || null,
      shipping_rule_scope: shippingRule?.scope_type || null,
      shipping_min_price: shippingRule?.min_price == null ? null : round2(shippingRule.min_price),
      shipping_max_price: shippingRule?.max_price == null ? null : round2(shippingRule.max_price),
      commission_amount: finalBreakdown.commission_amount,
      extra_deductions_total: finalBreakdown.extra_deductions_total,
      extra_deductions: finalBreakdown.extra_deductions,
      breakdown: finalBreakdown,
    },

    recommendation_type: recommendationType,
    current_price: round2(currentPrice),
    profit_floor: round2(profitFloor),
    target_profit_price: round2(targetProfitPrice),
    brand_min_price: round2(safeBrandMinPrice),
    protected_floor: round2(protectedFloor),
    marketplace_discount_rate: round2(marketplaceDiscountRate * 100),
    discount_adjusted_protected_price: round2(discountAdjustedProtectedPrice),
    raw_final_listing_price: round2(rawFinalListingPrice),
    final_listing_price: round2(finalListingPrice),
    customer_seen_price: round2(customerSeenPrice),
    projected_profit: finalBreakdown.profit,
    projected_margin_rate: finalBreakdown.margin_rate,
  };
}

module.exports = {
  toNumber,
  toRate,
  round2,
  roundUpToEnding,
  resolveScopedRule,
  resolveShippingRuleByPrice,
  calculateExtraDeductions,
  calculateBreakdown,
  buildRecommendation,
};
