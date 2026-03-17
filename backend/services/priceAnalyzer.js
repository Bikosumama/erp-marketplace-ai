function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
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
  if (ruleValue === null || ruleValue === undefined || ruleValue === '') return true;
  if (contextValue === null || contextValue === undefined || contextValue === '') return false;
  return Number(ruleValue) === Number(contextValue);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', 'yes', 'evet', 'on'].includes(lowered)) return true;
    if (['false', 'no', 'hayir', 'hayır', 'off'].includes(lowered)) return false;
  }
  return fallback;
}

function inRange(value, minValue, maxValue) {
  const current = toNumber(value, 0);
  const min = minValue == null || minValue === '' ? null : toNumber(minValue, 0);
  const max = maxValue == null || maxValue === '' ? null : toNumber(maxValue, 0);

  if (min !== null && current < min) return false;
  if (max !== null && current > max) return false;
  return true;
}

function rangeSpan(minValue, maxValue) {
  const min = minValue == null || minValue === '' ? 0 : toNumber(minValue, 0);
  const max = maxValue == null || maxValue === '' ? Number.MAX_SAFE_INTEGER : toNumber(maxValue, Number.MAX_SAFE_INTEGER);
  return Math.max(0, max - min);
}

function getScopeWeight(scope) {
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

  candidates.sort((a, b) => {
    const scopeDiff = getScopeWeight(b.scope_type) - getScopeWeight(a.scope_type);
    if (scopeDiff !== 0) return scopeDiff;

    const priorityDiff = toNumber(a.priority, 9999) - toNumber(b.priority, 9999);
    if (priorityDiff !== 0) return priorityDiff;

    const validFromA = parseDate(a.valid_from)?.getTime() || 0;
    const validFromB = parseDate(b.valid_from)?.getTime() || 0;
    if (validFromB !== validFromA) return validFromB - validFromA;

    return toNumber(b.id) - toNumber(a.id);
  });

  return candidates[0] || null;
}

function getProductDesi(product = {}) {
  const candidates = [
    product.desi,
    product.shipping_desi,
    product.shipment_desi,
    product.package_desi,
    product.volumetric_desi,
    product.volume_desi,
    product.dimensional_weight,
    product.dimension_weight,
  ];

  for (const item of candidates) {
    const value = Number(item);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function resolveShippingRule(shippingRules = [], context = {}) {
  const now = new Date();
  const currentPrice = toNumber(context.price ?? context.customerSeenPrice ?? context.listingPrice, 0);
  const currentDesi = toNumber(context.desi ?? context.totalDesi, 0);

  const candidates = (Array.isArray(shippingRules) ? shippingRules : [])
    .filter((rule) => rule && rule.is_active !== false)
    .filter((rule) => isRuleCurrentlyValid(rule, now))
    .filter((rule) => {
      const scope = String(rule.scope_type || 'general').toLowerCase();

      if (scope === 'marketplace' && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
        return false;
      }

      if (!inRange(currentPrice, rule.min_price, rule.max_price)) {
        return false;
      }

      if (!inRange(currentDesi, rule.min_desi, rule.max_desi)) {
        return false;
      }

      return true;
    });

  candidates.sort((a, b) => {
    const scopeDiff = getScopeWeight(b.scope_type) - getScopeWeight(a.scope_type);
    if (scopeDiff !== 0) return scopeDiff;

    const priorityDiff = toNumber(a.priority, 9999) - toNumber(b.priority, 9999);
    if (priorityDiff !== 0) return priorityDiff;

    const priceSpanDiff = rangeSpan(a.min_price, a.max_price) - rangeSpan(b.min_price, b.max_price);
    if (priceSpanDiff !== 0) return priceSpanDiff;

    const desiSpanDiff = rangeSpan(a.min_desi, a.max_desi) - rangeSpan(b.min_desi, b.max_desi);
    if (desiSpanDiff !== 0) return desiSpanDiff;

    const minPriceDiff = toNumber(b.min_price, 0) - toNumber(a.min_price, 0);
    if (minPriceDiff !== 0) return minPriceDiff;

    const minDesiDiff = toNumber(b.min_desi, 0) - toNumber(a.min_desi, 0);
    if (minDesiDiff !== 0) return minDesiDiff;

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
      price: options.shippingPrice != null ? toNumber(options.shippingPrice) : grossPrice,
      desi: options.desi != null ? toNumber(options.desi) : 0,
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

  const profit = netExVat - commissionAmount - fixedFee - shippingCost - extraDeductionsTotal - cost;
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

function parseQuantities(value) {
  const source = String(value || '1,2')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);

  const unique = [...new Set(source)];
  return unique.length > 0 ? unique : [1, 2];
}

function getSafetyBufferAmount(bufferType, bufferValue, orderRevenue) {
  const value = toNumber(bufferValue, 0);
  if (String(bufferType || 'fixed').toLowerCase() === 'percent') {
    return Number(((toNumber(orderRevenue, 0) * value) / 100).toFixed(2));
  }
  return Number(value.toFixed(2));
}

function adjustProfitForFreeShippingFunding(baseProfit, shippingCost, shippingRule, isTriggered) {
  if (!isTriggered) {
    return Number(baseProfit.toFixed(2));
  }

  const fundingType = String(shippingRule?.free_shipping_funding_type || 'seller').toLowerCase();
  const marketplaceSupport = toNumber(shippingRule?.free_shipping_marketplace_support, 0);

  if (fundingType === 'marketplace') {
    return Number((baseProfit + shippingCost).toFixed(2));
  }

  if (fundingType === 'shared') {
    const sellerBurden = Math.max(0, shippingCost - marketplaceSupport);
    return Number((baseProfit + shippingCost - sellerBurden).toFixed(2));
  }

  return Number(baseProfit.toFixed(2));
}

function getSellerShippingBurden(shippingCost, shippingRule, isTriggered) {
  if (!isTriggered) return 0;

  const fundingType = String(shippingRule?.free_shipping_funding_type || 'seller').toLowerCase();
  const marketplaceSupport = toNumber(shippingRule?.free_shipping_marketplace_support, 0);

  if (fundingType === 'marketplace') return 0;
  if (fundingType === 'shared') return Number(Math.max(0, shippingCost - marketplaceSupport).toFixed(2));

  return Number(toNumber(shippingCost, 0).toFixed(2));
}

function simulateMultiQuantityScenario(unitListingPrice, quantity, options = {}) {
  const shippingRuleConfig = options.shippingRule || null;
  const marketplaceDiscountRate = clamp(toNumber(options.marketplaceDiscountRate, 0), 0, 95);
  const marketplaceDiscountFunded = normalizeBoolean(options.marketplaceDiscountFunded, false);
  const discountRateDecimal = marketplaceDiscountRate / 100;

  const customerSeenUnitPrice =
    marketplaceDiscountFunded && discountRateDecimal > 0
      ? Number((unitListingPrice * (1 - discountRateDecimal)).toFixed(2))
      : Number(unitListingPrice.toFixed(2));

  const orderCustomerSeenPrice = Number((customerSeenUnitPrice * quantity).toFixed(2));
  const orderListingPrice = Number((unitListingPrice * quantity).toFixed(2));
  const totalDesi = Number((toNumber(options.unitDesi, 0) * quantity).toFixed(2));

  const threshold = toNumber(shippingRuleConfig?.free_shipping_threshold, 0);
  const protectionEnabled =
    normalizeBoolean(shippingRuleConfig?.free_shipping_enabled, false) &&
    normalizeBoolean(shippingRuleConfig?.multi_qty_profit_protection, true);

  const freeShippingTriggered = protectionEnabled && threshold > 0 && orderCustomerSeenPrice >= threshold;

  const orderFinancials = computeFinancials(orderListingPrice, {
    ...options,
    cost: toNumber(options.cost, 0) * quantity,
    shippingRule: null,
    shippingPrice: orderCustomerSeenPrice,
    desi: totalDesi,
  });

  const adjustedProfit = adjustProfitForFreeShippingFunding(
    orderFinancials.profit,
    orderFinancials.shippingCost,
    shippingRuleConfig,
    freeShippingTriggered
  );

  const sellerShippingBurden = getSellerShippingBurden(
    orderFinancials.shippingCost,
    shippingRuleConfig,
    freeShippingTriggered
  );

  const requiredProfit = freeShippingTriggered
    ? getSafetyBufferAmount(
        shippingRuleConfig?.profit_safety_buffer_type,
        shippingRuleConfig?.profit_safety_buffer_value,
        orderCustomerSeenPrice
      )
    : 0;

  const risk =
    freeShippingTriggered &&
    String(shippingRuleConfig?.loss_prevention_mode || 'block_loss').toLowerCase() !== 'ignore' &&
    adjustedProfit < requiredProfit;

  return {
    quantity,
    customerSeenUnitPrice,
    orderCustomerSeenPrice,
    orderListingPrice,
    totalDesi,
    freeShippingTriggered,
    orderFinancials,
    adjustedProfit: Number(adjustedProfit.toFixed(2)),
    requiredProfit: Number(requiredProfit.toFixed(2)),
    sellerShippingBurden,
    risk,
  };
}

function findProtectedUnitPriceForScenario(baseUnitPrice, quantity, options = {}) {
  const baseScenario = simulateMultiQuantityScenario(baseUnitPrice, quantity, options);

  if (!baseScenario.freeShippingTriggered || !baseScenario.risk) {
    return Number(baseUnitPrice.toFixed(2));
  }

  let low = baseUnitPrice;
  let high = Math.max(baseUnitPrice, 1);
  let guard = 0;

  while (guard < 30) {
    const scenario = simulateMultiQuantityScenario(high, quantity, options);
    if (!scenario.freeShippingTriggered || scenario.adjustedProfit >= scenario.requiredProfit) {
      break;
    }
    high *= 1.2;
    guard += 1;
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const scenario = simulateMultiQuantityScenario(mid, quantity, options);

    if (!scenario.freeShippingTriggered || scenario.adjustedProfit >= scenario.requiredProfit) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Number(high.toFixed(2));
}

function buildFreeShippingProtection(baseUnitPrice, options = {}) {
  const shippingRule = options.shippingRule || null;

  if (!shippingRule || !normalizeBoolean(shippingRule.free_shipping_enabled, false)) {
    return {
      protectedUnitPrice: Number(baseUnitPrice.toFixed(2)),
      scenarios: [],
      riskFlag: false,
    };
  }

  const quantities = parseQuantities(shippingRule.profit_check_quantities);
  const mode = String(shippingRule.loss_prevention_mode || 'block_loss').toLowerCase();

  let protectedUnitPrice = Number(baseUnitPrice.toFixed(2));
  const scenarios = [];
  let riskFlag = false;

  for (const quantity of quantities) {
    const scenario = simulateMultiQuantityScenario(protectedUnitPrice, quantity, options);
    scenarios.push(scenario);

    if (!scenario.freeShippingTriggered || !scenario.risk) {
      continue;
    }

    riskFlag = true;

    if (mode === 'warn_only' || mode === 'ignore') {
      continue;
    }

    const corrected = findProtectedUnitPriceForScenario(protectedUnitPrice, quantity, options);
    protectedUnitPrice = Math.max(protectedUnitPrice, corrected);
  }

  const finalScenarios = quantities.map((quantity) =>
    simulateMultiQuantityScenario(protectedUnitPrice, quantity, options)
  );

  return {
    protectedUnitPrice: Number(protectedUnitPrice.toFixed(2)),
    scenarios: finalScenarios,
    riskFlag,
  };
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
  const unitDesi = toNumber(input.unitDesi != null ? input.unitDesi : getProductDesi(product), 0);

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

  const marketplaceDiscountFunded = normalizeBoolean(
    marketplaceRule?.marketplace_discount_funded,
    false
  );

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

  const competitorPrice = input.competitorPrice == null ? null : toNumber(input.competitorPrice);

  const commonOptions = {
    cost,
    unitDesi,
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
    desi: unitDesi,
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

  const freeShippingProtection = buildFreeShippingProtection(discountAdjustedProtectedPrice, {
    ...commonOptions,
    shippingRule: shippingRule || currentFinancials.shippingRule,
    marketplaceDiscountRate,
    marketplaceDiscountFunded,
  });

  const freeShippingProtectedPrice = Number(
    freeShippingProtection.protectedUnitPrice.toFixed(2)
  );

  const rawRecommendedPrice = Math.max(
    targetPrice,
    discountAdjustedProtectedPrice,
    freeShippingProtectedPrice
  );

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
  if (freeShippingProtectedPrice > discountAdjustedProtectedPrice + 0.01) {
    reasons.push(`Ücretsiz kargo koruması fiyatı yükseltti: ${freeShippingProtectedPrice}`);
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
      message: 'Önerilen fiyat rakip fiyatın belirgin şekilde üzerinde.',
    });
  }

  if (freeShippingProtection.riskFlag) {
    alerts.push({
      type: 'free_shipping_risk',
      severity: 'medium',
      title: 'Ücretsiz kargo riski',
      message: 'Çoklu adet senaryosunda ücretsiz kargo nedeniyle kârlılık baskılandı.',
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

  const qty1 = freeShippingProtection.scenarios.find((item) => item.quantity === 1) || null;
  const qty2 = freeShippingProtection.scenarios.find((item) => item.quantity === 2) || null;

  const metadata = {
    product_name: product.name || '',
    stock_code: product.stock_code || '',
    category_id: product.category_id || null,
    category_name: product.category_name || '',
    marketplace_rule_id: marketplaceRule?.id || null,
    marketplace_rule_scope: marketplaceRule?.scope_type || '',
    shipping_rule_id: projectedFinancials.shippingRule?.id || shippingRule?.id || null,
    shipping_rule_scope: projectedFinancials.shippingRule?.scope_type || shippingRule?.scope_type || '',
    profit_target_id: profitTarget?.id || null,
    brand_min_price: brandMinPrice,
    protected_floor: Number(protectedFloor.toFixed(2)),
    profit_floor: Number(profitFloor.toFixed(2)),
    final_listing_price: Number(recommendedPrice.toFixed(2)),
    marketplace_discount_rate: marketplaceDiscountRate,
    discount_adjusted_protected_price: Number(discountAdjustedProtectedPrice.toFixed(2)),
    customer_seen_price: customerSeenPrice,
    shipping_cost: projectedFinancials.shippingCost,
    commission_amount: projectedFinancials.commissionAmount,
    extra_deductions_total: projectedFinancials.extraDeductionsTotal,
    projected_profit: projectedFinancials.profit,
    projected_margin_rate: projectedFinancials.marginRate,
    unit_desi: unitDesi,
    free_shipping_enabled: normalizeBoolean(
      (shippingRule || currentFinancials.shippingRule)?.free_shipping_enabled,
      false
    ),
    free_shipping_threshold: toNumber(
      (shippingRule || currentFinancials.shippingRule)?.free_shipping_threshold,
      0
    ),
    free_shipping_funding_type:
      (shippingRule || currentFinancials.shippingRule)?.free_shipping_funding_type || 'seller',
    free_shipping_protected_price: freeShippingProtectedPrice,
    free_shipping_risk_flag: freeShippingProtection.riskFlag ? 1 : 0,
    seller_shipping_burden_1_qty: qty1?.sellerShippingBurden ?? 0,
    seller_shipping_burden_2_qty: qty2?.sellerShippingBurden ?? 0,
    projected_profit_1_qty: qty1?.adjustedProfit ?? null,
    projected_profit_2_qty: qty2?.adjustedProfit ?? null,
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
