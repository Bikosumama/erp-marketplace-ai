function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isSameText(a, b) {
  return normalizeText(a) === normalizeText(b);
}

function inRange(value, minValue, maxValue) {
  const val = toNumber(value, 0);
  const min = hasValue(minValue) ? toNumber(minValue, 0) : 0;
  const max = hasValue(maxValue) ? toNumber(maxValue, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  return val >= min && val <= max;
}

function isRuleActive(rule) {
  if (!rule) return false;
  const raw = rule.is_active;
  if (raw === true || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 0 || raw === '0') return false;
  return true;
}

function pickOverrideValue(specialValue, generalValue) {
  return hasValue(specialValue) ? specialValue : generalValue;
}

function mergeMarketplaceRule(generalRule, specialRule) {
  if (!generalRule && !specialRule) return null;
  if (!generalRule) return { ...specialRule };
  if (!specialRule) return { ...generalRule };

  return {
    ...generalRule,

    commission_rate: pickOverrideValue(specialRule.commission_rate, generalRule.commission_rate),
    platform_service_fee: pickOverrideValue(specialRule.platform_service_fee, generalRule.platform_service_fee),
    transaction_fee_rate: pickOverrideValue(specialRule.transaction_fee_rate, generalRule.transaction_fee_rate),
    other_cost_rate: pickOverrideValue(specialRule.other_cost_rate, generalRule.other_cost_rate),
    withholding_tax_rate: pickOverrideValue(specialRule.withholding_tax_rate, generalRule.withholding_tax_rate),
    free_shipping_threshold: pickOverrideValue(specialRule.free_shipping_threshold, generalRule.free_shipping_threshold),

    special_rule_id: specialRule.id || null,
    general_rule_id: generalRule.id || null,
  };
}

function resolveMarketplaceRule(product, generalRules = [], specialRules = []) {
  const marketplaceName = String(product?.marketplace_name || product?.marketplace || '').trim();
  const brand = String(product?.brand || '').trim();
  const category = String(product?.category || product?.category_name || '').trim();

  const activeGeneralRules = (Array.isArray(generalRules) ? generalRules : []).filter(
    (rule) => isRuleActive(rule) && isSameText(rule.marketplace_name, marketplaceName)
  );

  const generalRule = activeGeneralRules[0] || null;

  const activeSpecialRules = (Array.isArray(specialRules) ? specialRules : []).filter(
    (rule) => isRuleActive(rule) && isSameText(rule.marketplace_name, marketplaceName)
  );

  const exactBrandCategory = activeSpecialRules.find(
    (rule) => isSameText(rule.brand, brand) && isSameText(rule.category, category)
  );
  if (exactBrandCategory) {
    return mergeMarketplaceRule(generalRule, exactBrandCategory);
  }

  const brandOnly = activeSpecialRules.find(
    (rule) => isSameText(rule.brand, brand) && !hasValue(rule.category)
  );
  if (brandOnly) {
    return mergeMarketplaceRule(generalRule, brandOnly);
  }

  const categoryOnly = activeSpecialRules.find(
    (rule) => !hasValue(rule.brand) && isSameText(rule.category, category)
  );
  if (categoryOnly) {
    return mergeMarketplaceRule(generalRule, categoryOnly);
  }

  return generalRule ? { ...generalRule } : null;
}

function ensureSingleMatch(matches, sourceName) {
  if (!Array.isArray(matches) || matches.length === 0) return null;

  if (matches.length > 1) {
    const details = matches.map((item) => {
      return `#${item.id || 'new'} [${item.marketplace_name || 'GENEL'} | ${item.min_price ?? ''}-${item.max_price ?? ''} | ${item.min_desi ?? ''}-${item.max_desi ?? ''}]`;
    }).join(', ');

    throw new Error(`${sourceName} için birden fazla kural eşleşti: ${details}`);
  }

  return matches[0];
}

function resolveShippingRule(product, shippingRules = []) {
  const marketplaceName = String(product?.marketplace_name || product?.marketplace || '').trim();

  const price = toNumber(
    product?.final_listing_price ??
    product?.sale_price ??
    product?.price ??
    0,
    0
  );

  const desi = toNumber(
    product?.desi ??
    product?.shipping_desi ??
    product?.package_desi ??
    0,
    0
  );

  const activeRules = (Array.isArray(shippingRules) ? shippingRules : []).filter(isRuleActive);

  const marketplaceSpecificMatches = activeRules.filter((rule) => {
    return (
      hasValue(rule.marketplace_name) &&
      isSameText(rule.marketplace_name, marketplaceName) &&
      inRange(price, rule.min_price, rule.max_price) &&
      inRange(desi, rule.min_desi, rule.max_desi)
    );
  });

  const specificRule = ensureSingleMatch(
    marketplaceSpecificMatches,
    'Pazaryeri özel kargo kuralları'
  );
  if (specificRule) return specificRule;

  const generalMatches = activeRules.filter((rule) => {
    return (
      !hasValue(rule.marketplace_name) &&
      inRange(price, rule.min_price, rule.max_price) &&
      inRange(desi, rule.min_desi, rule.max_desi)
    );
  });

  const generalRule = ensureSingleMatch(
    generalMatches,
    'Genel kargo kuralları'
  );
  if (generalRule) return generalRule;

  return null;
}

function buildResolvedRuleContext(product, rules = {}) {
  const marketplaceRule = resolveMarketplaceRule(
    product,
    rules.generalMarketplaceRules || [],
    rules.specialMarketplaceRules || []
  );

  const shippingRule = resolveShippingRule(
    product,
    rules.shippingRules || []
  );

  return {
    marketplaceRule,
    shippingRule,
  };
}

module.exports = {
  hasValue,
  toNumber,
  inRange,
  mergeMarketplaceRule,
  resolveMarketplaceRule,
  resolveShippingRule,
  buildResolvedRuleContext,
};