function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', 'yes', 'evet', 'on'].includes(lowered)) return true;
    if (['false', 'no', 'hayır', 'hayir', 'off'].includes(lowered)) return false;
  }
  return fallback;
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

function inRange(value, minValue, maxValue) {
  const current = toNumber(value, 0);
  const min = minValue === null || minValue === undefined || minValue === '' ? null : toNumber(minValue, 0);
  const max = maxValue === null || maxValue === undefined || maxValue === '' ? null : toNumber(maxValue, 0);

  if (min !== null && current < min) return false;
  if (max !== null && current > max) return false;
  return true;
}

function rangeSpan(minValue, maxValue) {
  const min = minValue === null || minValue === undefined || minValue === '' ? 0 : toNumber(minValue, 0);
  const max =
    maxValue === null || maxValue === undefined || maxValue === ''
      ? Number.MAX_SAFE_INTEGER
      : toNumber(maxValue, Number.MAX_SAFE_INTEGER);
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

function getScopeLabel(scope) {
  switch (String(scope || 'general').toLowerCase()) {
    case 'product':
      return 'Ürün';
    case 'category':
      return 'Kategori';
    case 'marketplace':
      return 'Pazaryeri';
    case 'general':
    default:
      return 'Genel';
  }
}

function resolveScopedRule(rules = [], context = {}) {
  const now = new Date();

  const candidates = (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && normalizeBoolean(rule.is_active, true))
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

function resolveBaseMarketplaceRule(rules = [], marketplaceId) {
  return resolveScopedRule(
    (rules || []).filter((rule) => {
      const scope = String(rule?.scope_type || 'general').toLowerCase();
      return scope === 'general' || scope === 'marketplace';
    }),
    {
      marketplaceId,
      categoryId: '',
      productId: '',
    }
  );
}

function resolveShippingRule(shippingRules = [], context = {}) {
  const now = new Date();
  const currentPrice = toNumber(context.price ?? context.customerSeenPrice ?? context.listingPrice, 0);
  const currentDesi = toNumber(context.desi ?? context.totalDesi, 0);

  const candidates = (Array.isArray(shippingRules) ? shippingRules : [])
    .filter((rule) => rule && normalizeBoolean(rule.is_active, true))
    .filter((rule) => isRuleCurrentlyValid(rule, now))
    .filter((rule) => {
      const scope = String(rule.scope_type || (rule.marketplace_id ? 'marketplace' : 'general')).toLowerCase();

      if (scope === 'marketplace' && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
        return false;
      }

      if (scope === 'general' && rule.marketplace_id && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
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
    const scopeDiff =
      getScopeWeight(b.scope_type || (b.marketplace_id ? 'marketplace' : 'general')) -
      getScopeWeight(a.scope_type || (a.marketplace_id ? 'marketplace' : 'general'));
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

  const attrs = product.attributes || {};
  if (attrs && typeof attrs === 'object') {
    const attrDesi = attrs.desi ?? attrs.shipping_desi ?? attrs.desi_value ?? attrs.kargo_desi;
    const value = Number(attrDesi);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return 0;
}

function getExtraDeductionsForRule(extraDeductions = [], marketplaceRuleId) {
  return (Array.isArray(extraDeductions) ? extraDeductions : [])
    .filter((item) => item && normalizeBoolean(item.is_active, true))
    .filter((item) => {
      if (!marketplaceRuleId) return false;
      return Number(item.marketplace_rule_id) === Number(marketplaceRuleId);
    })
    .filter((item) => isRuleCurrentlyValid(item))
    .sort((a, b) => {
      const priorityDiff = toNumber(a.priority, 9999) - toNumber(b.priority, 9999);
      if (priorityDiff !== 0) return priorityDiff;
      return toNumber(a.id) - toNumber(b.id);
    });
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
  const breakdown = [];

  for (const item of Array.isArray(extraDeductions) ? extraDeductions : []) {
    if (!item || !normalizeBoolean(item.is_active, true)) continue;

    const calculationType = String(item.calculation_type || 'percentage').toLowerCase();
    const baseAmount = getExtraDeductionBaseAmount({
      baseAmountType: item.base_amount_type,
      grossPrice: values.grossPrice,
      netExVat: values.netExVat,
      netAfterCommission: values.netAfterCommission,
    });

    let amount = 0;

    if (calculationType === 'fixed') {
      amount = toNumber(item.fixed_amount);
    } else {
      amount = baseAmount * (toNumber(item.rate) / 100);
    }

    amount = Number(amount.toFixed(2));
    total += amount;
    breakdown.push({
      ...item,
      amount,
    });
  }

  return {
    total: Number(total.toFixed(2)),
    breakdown,
  };
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

  const extraDeductionResult = calculateExtraDeductions(options.extraDeductions || [], {
    grossPrice,
    netExVat,
    netAfterCommission,
  });

  const profit = netExVat - commissionAmount - fixedFee - shippingCost - extraDeductionResult.total - cost;
  const marginRate = grossPrice > 0 ? (profit / grossPrice) * 100 : 0;

  return {
    grossPrice: Number(grossPrice.toFixed(2)),
    netExVat: Number(netExVat.toFixed(2)),
    commissionAmount: Number(commissionAmount.toFixed(2)),
    shippingCost: Number(shippingCost.toFixed(2)),
    extraDeductionsTotal: Number(extraDeductionResult.total.toFixed(2)),
    extraDeductionBreakdown: extraDeductionResult.breakdown,
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

function describeMarketplaceRule(rule) {
  if (!rule) return null;
  return `#${rule.id} • ${rule.marketplace_name || 'Genel'} • ${getScopeLabel(rule.scope_type)}`;
}

function describeShippingRule(rule) {
  if (!rule) return null;
  if (String(rule.scope_type || '').toLowerCase() === 'manual') {
    return `Elle girilen kargo • ${Number(toNumber(rule.shipping_cost)).toFixed(2)} TL`;
  }

  const marketplaceLabel = rule.marketplace_name || 'Genel';
  const minPrice = rule.min_price ?? 0;
  const maxPrice = rule.max_price ?? '∞';
  const minDesi = rule.min_desi ?? 0;
  const maxDesi = rule.max_desi ?? '∞';

  return `#${rule.id} • ${marketplaceLabel} • ${minPrice}-${maxPrice} TL • ${minDesi}-${maxDesi} desi`;
}

function buildSimulationResult({
  product,
  marketplaceId,
  marketplace,
  marketplaceRules = [],
  shippingRules = [],
  profitTargets = [],
  extraDeductions = [],
  overrides = {},
}) {
  if (!product) {
    throw new Error('Ürün bulunamadı');
  }

  if (!marketplaceId) {
    throw new Error('Pazaryeri seçilmedi');
  }

  const context = {
    marketplaceId,
    categoryId: product.category_id,
    productId: product.id,
  };

  const appliedMarketplaceRule = resolveScopedRule(marketplaceRules, context);
  const baseMarketplaceRule = resolveBaseMarketplaceRule(marketplaceRules, marketplaceId);
  const appliedProfitTarget = resolveScopedRule(profitTargets, context);

  const rawCurrentPrice = overrides.currentPrice ?? product.sale_price ?? product.list_price ?? product.price ?? 0;
  const rawDesi = overrides.desi ?? getProductDesi(product);
  const autoShippingRule = resolveShippingRule(shippingRules, {
    marketplaceId,
    price: toNumber(rawCurrentPrice),
    desi: toNumber(rawDesi),
  });

  const manualShippingRule =
    overrides.shippingCost !== undefined && overrides.shippingCost !== null && overrides.shippingCost !== ''
      ? {
          id: null,
          scope_type: 'manual',
          shipping_cost: toNumber(overrides.shippingCost),
          marketplace_name: marketplace?.marketplace_name || 'Seçilen Pazaryeri',
        }
      : null;

  const deductionList = getExtraDeductionsForRule(extraDeductions, appliedMarketplaceRule?.id);

  const commissionBase = overrides.commissionBase || appliedMarketplaceRule?.commission_base || 'net_ex_vat';
  const marketplaceDiscountRate = clamp(
    toNumber(
      overrides.marketplaceDiscountRate ?? appliedMarketplaceRule?.marketplace_discount_rate,
      0
    ),
    0,
    95
  );

  const marketplaceDiscountFunded = normalizeBoolean(
    overrides.marketplaceDiscountFunded ?? appliedMarketplaceRule?.marketplace_discount_funded,
    false
  );

  const discountRateDecimal = marketplaceDiscountRate / 100;

  const brandMinPrice = toNumber(
    overrides.brandMinPrice ?? product.brand_min_price ?? 0,
    0
  );

  const cost = toNumber(overrides.cost ?? product.cost ?? product.purchase_price ?? 0, 0);
  const currentPrice = toNumber(rawCurrentPrice, 0);
  const desi = toNumber(rawDesi, 0);

  const competitorPrice =
    overrides.competitorPrice === undefined || overrides.competitorPrice === null || overrides.competitorPrice === ''
      ? null
      : toNumber(overrides.competitorPrice, 0);

  const minMarginRate = toNumber(
    overrides.minMarginRate ??
      appliedProfitTarget?.min_margin_rate ??
      appliedProfitTarget?.min_profit_margin ??
      appliedMarketplaceRule?.min_margin_rate ??
      appliedMarketplaceRule?.minimum_profit_margin ??
      10,
    10
  );

  const targetMarginRate = toNumber(
    overrides.targetMarginRate ??
      appliedProfitTarget?.target_margin_rate ??
      appliedProfitTarget?.target_profit_margin ??
      appliedMarketplaceRule?.target_margin_rate ??
      appliedMarketplaceRule?.target_profit_margin ??
      18,
    18
  );

  const roundingEnding = toNumber(
    overrides.roundingEnding ?? appliedMarketplaceRule?.rounding_ending ?? 0.9,
    0.9
  );

  const commonOptions = {
    cost,
    vatRate: toNumber(overrides.vatRate ?? appliedMarketplaceRule?.vat_rate ?? product.vat_rate ?? 20, 20),
    commissionRate: toNumber(overrides.commissionRate ?? appliedMarketplaceRule?.commission_rate ?? 0, 0),
    commissionBase,
    fixedFee: toNumber(overrides.fixedFee ?? appliedMarketplaceRule?.fixed_fee ?? 0, 0),
    shippingRule: manualShippingRule,
    shippingRules,
    extraDeductions: deductionList,
    marketplaceId,
    currentPrice,
    competitorPrice,
    brandMinPrice,
    desi,
  };

  const currentFinancials = computeFinancials(currentPrice, commonOptions);
  const profitFloor = findMinimumPriceForMargin(minMarginRate, commonOptions);
  const targetPrice = findMinimumPriceForMargin(targetMarginRate, commonOptions);
  const protectedFloor = Math.max(profitFloor, brandMinPrice);

  const discountAdjustedProtectedFloor =
    marketplaceDiscountFunded && discountRateDecimal > 0
      ? protectedFloor / (1 - discountRateDecimal)
      : protectedFloor;

  const rawRecommendedPrice = Math.max(targetPrice, discountAdjustedProtectedFloor);
  const recommendedPrice = roundUpToEnding(rawRecommendedPrice, roundingEnding);

  const projectedFinancials = computeFinancials(recommendedPrice, commonOptions);

  const customerSeenPrice =
    marketplaceDiscountFunded && discountRateDecimal > 0
      ? Number((recommendedPrice * (1 - discountRateDecimal)).toFixed(2))
      : recommendedPrice;

  let recommendationType = 'keep';
  if (!currentPrice) recommendationType = 'set';
  else if (recommendedPrice > currentPrice + 0.01) recommendationType = 'increase';
  else if (recommendedPrice < currentPrice - 0.01) recommendationType = 'decrease';

  const reasons = [];
  if (baseMarketplaceRule) {
    reasons.push(`Genel baz kural: ${describeMarketplaceRule(baseMarketplaceRule)}`);
  }
  if (appliedMarketplaceRule) {
    reasons.push(`Uygulanan kural: ${describeMarketplaceRule(appliedMarketplaceRule)}`);
  }
  if (appliedProfitTarget) {
    reasons.push(
      `Kâr hedefi: min %${toNumber(
        appliedProfitTarget.min_margin_rate ?? appliedProfitTarget.min_profit_margin ?? minMarginRate
      ).toFixed(2)} / hedef %${toNumber(
        appliedProfitTarget.target_margin_rate ?? appliedProfitTarget.target_profit_margin ?? targetMarginRate
      ).toFixed(2)}`
    );
  }
  if (brandMinPrice > 0) {
    reasons.push(`Firma minimum fiyat korundu: ${brandMinPrice.toFixed(2)} TL`);
  }
  if (marketplaceDiscountFunded && marketplaceDiscountRate > 0) {
    reasons.push(`Pazaryeri indirimi nedeniyle liste fiyatı yukarı taşındı: %${marketplaceDiscountRate.toFixed(2)}`);
  }
  if (manualShippingRule) {
    reasons.push(`Kargo elle override edildi: ${toNumber(manualShippingRule.shipping_cost).toFixed(2)} TL`);
  } else if (projectedFinancials.shippingRule) {
    reasons.push(`Kargo eşleşmesi: ${describeShippingRule(projectedFinancials.shippingRule)}`);
  }

  const alerts = [];
  if (currentPrice > 0 && currentPrice < protectedFloor) {
    alerts.push({
      type: 'protected_floor_breach',
      severity: 'high',
      title: 'Korunan taban altında fiyat',
      message: `Mevcut fiyat ${currentPrice.toFixed(2)} TL protected floor ${protectedFloor.toFixed(2)} TL altında kalıyor.`,
    });
  }

  if (competitorPrice !== null && recommendedPrice > competitorPrice * 1.15) {
    alerts.push({
      type: 'competitor_gap',
      severity: 'medium',
      title: 'Rakip fiyat farkı yüksek',
      message: 'Önerilen fiyat rakip fiyata göre belirgin şekilde yukarıda kaldı.',
    });
  }

  if (marketplaceDiscountFunded && customerSeenPrice < protectedFloor) {
    alerts.push({
      type: 'discount_floor_warning',
      severity: 'high',
      title: 'İndirim sonrası koruma kontrolü',
      message: 'İndirimli müşteri fiyatı protected floor seviyesine çok yaklaştı.',
    });
  }

  let riskLevel = 'low';
  if (alerts.some((item) => item.severity === 'high')) riskLevel = 'high';
  else if (alerts.length > 0) riskLevel = 'medium';

  return {
    product: {
      id: product.id,
      name: product.name || product.product_name || '',
      stockCode: product.stock_code || '',
      barcode: product.barcode || '',
      brand: product.brand || product.brand_name || '',
      categoryId: product.category_id || null,
      categoryName: product.category_name || '',
      cost,
      currentPrice,
      desi,
      brandMinPrice,
    },
    marketplace: marketplace
      ? {
          id: marketplace.id,
          marketplace_name: marketplace.marketplace_name,
        }
      : null,
    matchedRules: {
      marketplaceGeneralRule: baseMarketplaceRule
        ? {
            id: baseMarketplaceRule.id,
            name: describeMarketplaceRule(baseMarketplaceRule),
            source: String(baseMarketplaceRule.scope_type || 'general').toLowerCase(),
          }
        : null,
      marketplaceSpecialRule: appliedMarketplaceRule
        ? {
            id: appliedMarketplaceRule.id,
            name: describeMarketplaceRule(appliedMarketplaceRule),
            source: String(appliedMarketplaceRule.scope_type || 'general').toLowerCase(),
          }
        : null,
      shippingRule: (projectedFinancials.shippingRule || autoShippingRule || manualShippingRule)
        ? {
            id: projectedFinancials.shippingRule?.id || autoShippingRule?.id || null,
            name: describeShippingRule(projectedFinancials.shippingRule || autoShippingRule || manualShippingRule),
            shippingCost: toNumber(
              projectedFinancials.shippingRule?.shipping_cost ??
                autoShippingRule?.shipping_cost ??
                manualShippingRule?.shipping_cost,
              0
            ),
          }
        : null,
      profitRule: appliedProfitTarget
        ? {
            id: appliedProfitTarget.id,
            minMarginRate: toNumber(
              appliedProfitTarget.min_margin_rate ?? appliedProfitTarget.min_profit_margin ?? minMarginRate
            ),
            targetMarginRate: toNumber(
              appliedProfitTarget.target_margin_rate ?? appliedProfitTarget.target_profit_margin ?? targetMarginRate
            ),
          }
        : null,
      extraDeductions: deductionList.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.calculation_type,
        rate: item.rate,
        fixedAmount: item.fixed_amount,
      })),
    },
    calculation: {
      grossPrice: projectedFinancials.grossPrice,
      customerSeenPrice,
      netExVat: projectedFinancials.netExVat,
      commissionAmount: projectedFinancials.commissionAmount,
      platformServiceFee: projectedFinancials.fixedFee,
      shippingCost: projectedFinancials.shippingCost,
      extraDeductionsTotal: projectedFinancials.extraDeductionsTotal,
      extraDeductionBreakdown: projectedFinancials.extraDeductionBreakdown,
      totalDeductions: Number(
        (
          projectedFinancials.commissionAmount +
          projectedFinancials.fixedFee +
          projectedFinancials.shippingCost +
          projectedFinancials.extraDeductionsTotal
        ).toFixed(2)
      ),
      profit: projectedFinancials.profit,
      marginRate: projectedFinancials.marginRate,
    },
    floors: {
      profitFloor: Number(profitFloor.toFixed(2)),
      targetPrice: Number(targetPrice.toFixed(2)),
      brandMinFloor: Number(brandMinPrice.toFixed(2)),
      protectedFloor: Number(protectedFloor.toFixed(2)),
      discountAdjustedProtectedFloor: Number(discountAdjustedProtectedFloor.toFixed(2)),
      roundedFinalPrice: Number(recommendedPrice.toFixed(2)),
    },
    decision: {
      recommendationType,
      recommendedPrice: Number(recommendedPrice.toFixed(2)),
      confidence: 85,
      riskLevel,
      reasons,
      alerts,
    },
  };
}

module.exports = {
  toNumber,
  resolveScopedRule,
  resolveShippingRule,
  computeFinancials,
  buildSimulationResult,
};