function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isRuleCurrentlyValid(rule, now = new Date()) {
  const validFrom = parseDate(rule?.valid_from);
  const validTo = parseDate(rule?.valid_to);

  if (validFrom && now < validFrom) return false;
  if (validTo && now > validTo) return false;

  return true;
}

function matchesOptionalId(ruleValue, contextValue) {
  if (ruleValue === null || ruleValue === undefined) return true;
  if (ruleValue === '') return true;
  if (contextValue === null || contextValue === undefined) return false;

  return Number(ruleValue) === Number(contextValue);
}

function resolveScopedRule(rules = [], context = {}) {
  const now = new Date();

  const candidates = (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.is_active !== false)
    .filter((rule) => isRuleCurrentlyValid(rule, now))
    .filter((rule) => {
      const scope = String(rule.scope_type || 'general').toLowerCase();

      if (!matchesOptionalId(rule.marketplace_id, context.marketplaceId)) return false;
      if (!matchesOptionalId(rule.category_id, context.categoryId)) return false;
      if (!matchesOptionalId(rule.product_id, context.productId)) return false;

      if (scope === 'product') {
        return Number(rule.product_id) === Number(context.productId);
      }

      if (scope === 'category') {
        return Number(rule.category_id) === Number(context.categoryId);
      }

      if (scope === 'marketplace') {
        return Number(rule.marketplace_id) === Number(context.marketplaceId);
      }

      return true;
    });

  const scopeWeight = (scope) => {
    switch (String(scope || 'general').toLowerCase()) {
      case 'product':
        return 400;
      case 'category':
        return 300;
      case 'marketplace':
        return 200;
      case 'general':
      default:
        return 100;
    }
  };

  candidates.sort((a, b) => {
    const scopeDiff = scopeWeight(b.scope_type) - scopeWeight(a.scope_type);
    if (scopeDiff !== 0) return scopeDiff;

    const priorityDiff = toNumber(b.priority) - toNumber(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const validFromA = parseDate(a.valid_from)?.getTime() || 0;
    const validFromB = parseDate(b.valid_from)?.getTime() || 0;
    if (validFromB !== validFromA) return validFromB - validFromA;

    return toNumber(b.id) - toNumber(a.id);
  });

  return candidates[0] || null;
}

function resolveShippingRule(shippingRules = [], context = {}) {
  const now = new Date();
  const currentPrice = toNumber(context.price);

  const candidates = (Array.isArray(shippingRules) ? shippingRules : [])
    .filter((rule) => rule && rule.is_active !== false)
    .filter((rule) => isRuleCurrentlyValid(rule, now))
    .filter((rule) => {
      const scope = String(rule.scope_type || 'general').toLowerCase();

      if (scope === 'marketplace' && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
        return false;
      }

      if (scope === 'general') {
        // general fallback
      }

      const minPrice = toNumber(rule.min_price, 0);
      const maxPrice = rule.max_price == null || rule.max_price === '' ? null : toNumber(rule.max_price);

      if (currentPrice < minPrice) return false;
      if (maxPrice !== null && currentPrice > maxPrice) return false;

      return true;
    });

  const scopeWeight = (scope) => {
    switch (String(scope || 'general').toLowerCase()) {
      case 'marketplace':
        return 200;
      case 'general':
      default:
        return 100;
    }
  };

  candidates.sort((a, b) => {
    const scopeDiff = scopeWeight(b.scope_type) - scopeWeight(a.scope_type);
    if (scopeDiff !== 0) return scopeDiff;

    const priorityDiff = toNumber(b.priority) - toNumber(a.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const minPriceDiff = toNumber(b.min_price) - toNumber(a.min_price);
    if (minPriceDiff !== 0) return minPriceDiff;

    return toNumber(b.id) - toNumber(a.id);
  });

  return candidates[0] || null;
}

function roundUpToEnding(value, ending = 0.9) {
  const number = toNumber(value, 0);
  const normalizedEnding = clamp(toNumber(ending, 0.9), 0, 0.99);

  const integerPart = Math.floor(number);
  const candidate = integerPart + normalizedEnding;

  if (candidate >= number) {
    return Number(candidate.toFixed(2));
  }

  return Number((integerPart + 1 + normalizedEnding).toFixed(2));
}

function getCommissionBaseAmount({ grossPrice, netExVat, commissionBase }) {
  const base = String(commissionBase || 'net_ex_vat').toLowerCase();

  if (base === 'gross_price') return grossPrice;
  return netExVat;
}

function getExtraDeductionBaseAmount({ baseAmountType, grossPrice, netExVat, netAfterCommission }) {
  const type = String(baseAmountType || 'net_ex_vat').toLowerCase();

  if (type === 'gross_price') return grossPrice;
  if (type === 'net_after_commission') return netAfterCommission;
  return netExVat;
}

function calculateExtraDeductions(extraDeductions = [], values = {}) {
  let total = 0;

  for (const item of Array.isArray(extraDeductions) ? extraDeductions : []) {
    if (!item || item.is_active === false) continue;

    const calculationType = String(item.calculation_type || 'percentage').toLowerCase();
    const baseAmount = getExtraDeductionBaseAmount({
      baseAmountType: item.base_amount_type,
      grossPrice: values.grossPrice,
      netExVat: values.netExVat,
      netAfterCommission: values.netAfterCommission,
    });

    if (calculationType === 'fixed') {
      total += toNumber(item.fixed_amount);
      continue;
    }

    total += baseAmount * (toNumber(item.rate) / 100);
  }

  return Number(total.toFixed(2));
}

function computeFinancials(price, options = {}) {
  const grossPrice = toNumber(price, 0);
  const cost = toNumber(options.cost, 0);
  const vatRate = toNumber(options.vatRate, 20);
  const commissionRate = toNumber(options.commissionRate, 0);
  const commissionBase = options.commissionBase || 'net_ex_vat';
  const fixedFee = toNumber(options.fixedFee, 0);

  const shippingRule =
    options.shippingRule ||
    resolveShippingRule(options.shippingRules || [], {
      marketplaceId: options.marketplaceId,
      price: grossPrice,
    });

  const shippingCost = toNumber(shippingRule?.shipping_cost, 0);

  const vatMultiplier = 1 + vatRate / 100;
  const netExVat = vatMultiplier > 0 ? grossPrice / vatMultiplier : grossPrice;

  const commissionBaseAmount = getCommissionBaseAmount({
    grossPrice,
    netExVat,
    commissionBase,
  });

  const commissionAmount = commissionBaseAmount * (commissionRate / 100);
  const netAfterCommission = netExVat - commissionAmount;

  const extraDeductionsTotal = calculateExtraDeductions(options.extraDeductions || [], {
    grossPrice,
    netExVat,
    netAfterCommission,
  });

  const profit =
    netExVat -
    commissionAmount -
    fixedFee -
    shippingCost -
    extraDeductionsTotal -
    cost;

  const marginRate = grossPrice > 0 ? (profit / grossPrice) * 100 : 0;

  return {
    grossPrice: Number(grossPrice.toFixed(2)),
    netExVat: Number(netExVat.toFixed(2)),
    commissionAmount: Number(commissionAmount.toFixed(2)),
    shippingCost: Number(shippingCost.toFixed(2)),
    extraDeductionsTotal: Number(extraDeductionsTotal.toFixed(2)),
    fixedFee: Number(fixedFee.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    marginRate: Number(marginRate.toFixed(2)),
    shippingRule,
  };
}

function findMinimumPriceForMargin(targetMarginRate, options = {}) {
  const target = toNumber(targetMarginRate, 0);

  let low = 0;
  let high = Math.max(
    100,
    toNumber(options.cost) * 3,
    toNumber(options.currentPrice) * 2,
    toNumber(options.brandMinPrice) * 2,
    toNumber(options.competitorPrice) * 2
  );

  let probe = computeFinancials(high, options);
  let guard = 0;

  while (probe.marginRate < target && guard < 30) {
    high *= 2;
    probe = computeFinancials(high, options);
    guard += 1;
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const result = computeFinancials(mid, options);

    if (result.marginRate >= target) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Number(high.toFixed(2));
}

function buildRecommendation(input = {}) {
  const product = input.product || {};
  const marketplaceRule = input.marketplaceRule || null;
  const profitTarget = input.profitTarget || null;
  const shippingRule = input.shippingRule || null;
  const shippingRules = input.shippingRules || [];
  const extraDeductions = input.extraDeductions || [];

  const currentPrice = toNumber(product.sale_price || product.list_price || 0);
  const cost = toNumber(product.cost || product.purchase_price || 0);
  const brandMinPrice = toNumber(
    input.brandMinPrice != null ? input.brandMinPrice : product.brand_min_price,
    0
  );

  const vatRate = toNumber(marketplaceRule?.vat_rate || product.vat_rate || 20, 20);
  const commissionRate = toNumber(marketplaceRule?.commission_rate, 0);
  const commissionBase = marketplaceRule?.commission_base || 'net_ex_vat';
  const fixedFee = toNumber(marketplaceRule?.fixed_fee, 0);
  const marketplaceDiscountRate = clamp(
    toNumber(marketplaceRule?.marketplace_discount_rate, 0),
    0,
    95
  );
  const marketplaceDiscountFunded = Boolean(marketplaceRule?.marketplace_discount_funded);
  const roundingEnding = toNumber(marketplaceRule?.rounding_ending, 0.9);

  const minMarginRate = toNumber(
    input.minMarginRate != null
      ? input.minMarginRate
      : profitTarget?.min_margin_rate ??
          profitTarget?.min_profit_margin ??
          marketplaceRule?.min_margin_rate ??
          marketplaceRule?.minimum_profit_margin ??
          10,
    10
  );

  const targetMarginRate = toNumber(
    input.targetMarginRate != null
      ? input.targetMarginRate
      : profitTarget?.target_margin_rate ??
          profitTarget?.target_profit_margin ??
          marketplaceRule?.target_margin_rate ??
          marketplaceRule?.target_profit_margin ??
          18,
    18
  );

  const competitorPrice =
    input.competitorPrice == null ? null : toNumber(input.competitorPrice);

  const commonOptions = {
    cost,
    vatRate,
    commissionRate,
    commissionBase,
    fixedFee,
    shippingRule,
    shippingRules,
    extraDeductions,
    marketplaceId: input.marketplaceId || product.marketplace_id || marketplaceRule?.marketplace_id,
    currentPrice,
    competitorPrice,
    brandMinPrice,
  };

  const currentFinancials = computeFinancials(currentPrice, commonOptions);

  const profitFloor = findMinimumPriceForMargin(minMarginRate, commonOptions);
  const targetPrice = findMinimumPriceForMargin(targetMarginRate, commonOptions);
  const protectedFloor = Math.max(profitFloor, brandMinPrice);

  const discountRateDecimal = marketplaceDiscountRate / 100;
  const discountAdjustedProtectedPrice =
    marketplaceDiscountFunded && discountRateDecimal > 0
      ? protectedFloor / (1 - discountRateDecimal)
      : protectedFloor;

  const rawRecommendedPrice = Math.max(targetPrice, discountAdjustedProtectedPrice);
  const recommendedPrice = roundUpToEnding(rawRecommendedPrice, roundingEnding);

  const projectedFinancials = computeFinancials(recommendedPrice, commonOptions);
  const customerSeenPrice =
    marketplaceDiscountFunded && discountRateDecimal > 0
      ? Number((recommendedPrice * (1 - discountRateDecimal)).toFixed(2))
      : recommendedPrice;

  let recommendationType = 'keep';
  if (recommendedPrice > currentPrice + 0.01) recommendationType = 'increase';
  if (recommendedPrice < currentPrice - 0.01) recommendationType = 'decrease';
  if (!currentPrice) recommendationType = 'set';

  const reasons = [];
  if (brandMinPrice > 0) reasons.push(`Marka minimum fiyatı korundu: ${brandMinPrice}`);
  reasons.push(`Minimum marj hedefi: %${minMarginRate}`);
  reasons.push(`Hedef marj: %${targetMarginRate}`);

  if (marketplaceDiscountFunded && marketplaceDiscountRate > 0) {
    reasons.push(`Pazaryeri indirimi uygulandı: %${marketplaceDiscountRate}`);
  }

  if (competitorPrice != null) {
    reasons.push(`Rakip fiyatı dikkate alındı: ${competitorPrice}`);
  }

  const alerts = [];
  if (currentPrice > 0 && currentPrice < protectedFloor) {
    alerts.push({
      type: 'protected_floor_breach',
      severity: 'high',
      title: 'Korunan taban altında fiyat',
      message: `Mevcut fiyat (${currentPrice}) protected floor (${protectedFloor}) altında.`,
    });
  }

  if (competitorPrice != null && recommendedPrice > competitorPrice * 1.15) {
    alerts.push({
      type: 'competitor_gap',
      severity: 'medium',
      title: 'Rakip fiyat farkı yüksek',
      message: `Önerilen fiyat rakip fiyatın belirgin şekilde üzerinde.`,
    });
  }

  let riskLevel = 'low';
  if (alerts.some((a) => a.severity === 'high')) riskLevel = 'high';
  else if (alerts.length > 0) riskLevel = 'medium';

  let confidence = 60;
  if (marketplaceRule) confidence += 10;
  if (profitTarget) confidence += 10;
  if (projectedFinancials.shippingRule) confidence += 10;
  if (competitorPrice != null) confidence += 10;
  confidence = clamp(confidence, 0, 100);

  const metadata = {
    product_name: product.name || '',
    stock_code: product.stock_code || '',
    category_id: product.category_id || null,
    category_name: product.category_name || '',
    marketplace_rule_id: marketplaceRule?.id || null,
    marketplace_rule_scope: marketplaceRule?.scope_type || '',
    shipping_rule_id: projectedFinancials.shippingRule?.id || shippingRule?.id || null,
    shipping_rule_scope:
      projectedFinancials.shippingRule?.scope_type || shippingRule?.scope_type || '',
    profit_target_id: profitTarget?.id || null,
    brand_min_price: brandMinPrice,
    protected_floor: Number(protectedFloor.toFixed(2)),
    marketplace_discount_rate: marketplaceDiscountRate,
    discount_adjusted_protected_price: Number(
      discountAdjustedProtectedPrice.toFixed(2)
    ),
    customer_seen_price: customerSeenPrice,
    shipping_cost: projectedFinancials.shippingCost,
    commission_amount: projectedFinancials.commissionAmount,
    extra_deductions_total: projectedFinancials.extraDeductionsTotal,
    reasons,
  };

  return {
    currentPrice: Number(currentPrice.toFixed(2)),
    recommendedPrice,
    floorPrice: Number(profitFloor.toFixed(2)),
    targetPrice: Number(targetPrice.toFixed(2)),
    competitorPrice,
    currentMarginRate: currentFinancials.marginRate,
    projectedMarginRate: projectedFinancials.marginRate,
    profitMargin: projectedFinancials.profit,
    recommendationType,
    riskLevel,
    confidence,
    qualityScore: confidence,
    reasonText: reasons.join(' | '),
    alerts,
    reasons,
    metadata,
  };
}

module.exports = {
  toNumber,
  roundUpToEnding,
  resolveScopedRule,
  resolveShippingRule,
  computeFinancials,
  buildRecommendation,
};
