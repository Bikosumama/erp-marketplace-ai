'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../context/AuthContext';
import { downloadExcelFile } from '../../lib/downloadExcel';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const emptyMarketplaceRule = {
  scope_type: 'general',
  marketplace_id: '',
  category_id: '',
  product_id: '',
  priority: 0,
  commission_rate: 18,
  commission_base: 'net_ex_vat',
  vat_rate: 20,
  fixed_fee: 0,
  marketplace_discount_rate: 0,
  marketplace_discount_funded: false,
  rounding_ending: 0.9,
  min_margin_rate: 10,
  target_margin_rate: 18,
  is_active: true,
  notes: '',
};

const emptyShippingRule = {
  marketplace_id: '',
  min_price: '',
  max_price: '',
  min_desi: '',
  max_desi: '',
  shipping_cost: '',
  is_active: true,
  notes: '',
};

const emptyProfitTarget = {
  scope_type: 'general',
  marketplace_id: '',
  category_id: '',
  product_id: '',
  priority: 0,
  min_margin_rate: 10,
  target_margin_rate: 18,
  is_active: true,
  notes: '',
};

const emptyExtraDeduction = {
  marketplace_rule_id: '',
  name: 'Stopaj',
  deduction_type: 'withholding',
  calculation_type: 'percentage',
  base_amount_type: 'net_ex_vat',
  rate: 1,
  fixed_amount: 0,
  priority: 0,
  is_active: true,
  notes: '',
};

function createEmptySimulatorForm() {
  return {
    marketplace_id: '',
    product_id: '',
    cost: '',
    current_price: '',
    desi: '',
    competitor_price: '',
    brand_min_price: '',
    commission_rate: '',
    vat_rate: 20,
    fixed_fee: '',
    marketplace_discount_rate: '',
    marketplace_discount_funded: false,
    rounding_ending: 0.9,
    min_margin_rate: 10,
    target_margin_rate: 18,
    shipping_cost: '',
    shipping_cost_manual: false,
  };
}

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatBool(value) {
  return value ? 'Evet' : 'Hayır';
}

function getErrorMessage(err) {
  return err?.message || 'İşlem sırasında hata oluştu';
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

function buildCategoryOptions(categories = []) {
  return (categories || [])
    .map((item) => ({
      id: item.id,
      label: item.name || item.category_name || `Kategori #${item.id}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function buildProductOptions(products = []) {
  return (products || [])
    .map((item) => ({
      id: item.id,
      label: item.stock_code
        ? `${item.stock_code} - ${item.name || item.product_name || `Ürün #${item.id}`}`
        : item.name || item.product_name || `Ürün #${item.id}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
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
    .filter((rule) => rule && rule.is_active !== false)
    .filter((rule) => isRuleCurrentlyValid(rule, now))
    .filter((rule) => {
      const scope = String(rule.scope_type || (rule.marketplace_id ? 'marketplace' : 'general')).toLowerCase();

      if (scope === 'marketplace' && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
        return false;
      }

      if (scope === 'general' && rule.marketplace_id && Number(rule.marketplace_id) !== Number(context.marketplaceId)) {
        return false;
      }

      if (!inRange(currentPrice, rule.min_price, rule.max_price)) return false;
      if (!inRange(currentDesi, rule.min_desi, rule.max_desi)) return false;

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

  return 0;
}

function buildSimulatorDefaults({
  marketplaceId,
  productId,
  products,
  marketplaceRules,
  shippingRules,
  profitTargets,
}) {
  const product = (products || []).find((item) => String(item.id) === String(productId));
  if (!product || !marketplaceId) return null;

  const context = {
    marketplaceId,
    categoryId: product.category_id,
    productId: product.id,
  };

  const marketplaceRule = resolveScopedRule(marketplaceRules, context);
  const profitTarget = resolveScopedRule(profitTargets, context);

  const currentPrice = toNumber(product.sale_price ?? product.list_price ?? product.price, 0);
  const desi = getProductDesi(product);
  const shippingRule = resolveShippingRule(shippingRules, {
    marketplaceId,
    price: currentPrice,
    desi,
  });

  return {
    cost: normalizeNumber(product.cost ?? product.purchase_price ?? 0),
    current_price: normalizeNumber(currentPrice),
    desi: normalizeNumber(desi),
    competitor_price: '',
    brand_min_price: normalizeNumber(product.brand_min_price ?? 0),
    commission_rate: normalizeNumber(marketplaceRule?.commission_rate ?? 0),
    vat_rate: normalizeNumber(marketplaceRule?.vat_rate ?? product.vat_rate ?? 20),
    fixed_fee: normalizeNumber(marketplaceRule?.fixed_fee ?? 0),
    marketplace_discount_rate: normalizeNumber(marketplaceRule?.marketplace_discount_rate ?? 0),
    marketplace_discount_funded: Boolean(marketplaceRule?.marketplace_discount_funded),
    rounding_ending: normalizeNumber(marketplaceRule?.rounding_ending ?? 0.9),
    min_margin_rate: normalizeNumber(
      profitTarget?.min_margin_rate ??
        profitTarget?.min_profit_margin ??
        marketplaceRule?.min_margin_rate ??
        marketplaceRule?.minimum_profit_margin ??
        10
    ),
    target_margin_rate: normalizeNumber(
      profitTarget?.target_margin_rate ??
        profitTarget?.target_profit_margin ??
        marketplaceRule?.target_margin_rate ??
        marketplaceRule?.target_profit_margin ??
        18
    ),
    shipping_cost: normalizeNumber(shippingRule?.shipping_cost ?? ''),
    shipping_cost_manual: false,
  };
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `%${Number(value).toFixed(2)}`;
}

function roundUpPriceToEnding(value, ending = 0.9) {
  const numericValue = Math.max(0, toNumber(value, 0));
  const decimal = Math.abs(toNumber(ending, 0.9)) % 1;

  let rounded = Math.floor(numericValue) + decimal;
  if (rounded < numericValue) {
    rounded += 1;
  }

  return Number(rounded.toFixed(2));
}

function buildRuleDisplayName(rule, fallback = 'Henüz hesaplanmadı') {
  if (!rule) return fallback;
  return `#${rule.id || '—'} • ${getScopeLabel(rule.scope_type)} • ${rule.marketplace_name || 'General'}`;
}

function buildShippingRuleDisplayName(rule, fallback = 'Henüz hesaplanmadı') {
  if (!rule) return fallback;

  return `#${rule.id || '—'} • ${rule.marketplace_name || 'Genel'} • ${
    rule.min_price ?? 0
  }-${rule.max_price ?? '∞'} TL • ${rule.min_desi ?? 0}-${rule.max_desi ?? '∞'} desi`;
}

function buildLocalSimulationResult({
  simulatorForm,
  products,
  marketplaces,
  marketplaceRules,
  shippingRules,
  profitTargets,
  extraDeductions,
}) {
  const product = (products || []).find(
    (item) => String(item.id) === String(simulatorForm.product_id)
  );
  const marketplace = (marketplaces || []).find(
    (item) => String(item.id) === String(simulatorForm.marketplace_id)
  );

  if (!product || !marketplace) {
    throw new Error('Simülasyon için ürün veya pazaryeri bulunamadı');
  }

  const context = {
    marketplaceId: simulatorForm.marketplace_id,
    categoryId: product.category_id,
    productId: product.id,
  };

  const marketplaceGeneralRule = resolveBaseMarketplaceRule(
    marketplaceRules,
    simulatorForm.marketplace_id
  );

  const marketplaceSpecialRule = resolveScopedRule(marketplaceRules, context);
  const activeMarketplaceRule = marketplaceSpecialRule || marketplaceGeneralRule;
  const profitRule = resolveScopedRule(profitTargets, context);

  const currentPrice = toNumber(simulatorForm.current_price, 0);
  const desi = toNumber(simulatorForm.desi || getProductDesi(product), 0);

  const shippingRule = resolveShippingRule(shippingRules, {
    marketplaceId: simulatorForm.marketplace_id,
    price: currentPrice,
    desi,
  });

  const shippingCost = simulatorForm.shipping_cost_manual
    ? toNumber(simulatorForm.shipping_cost, 0)
    : simulatorForm.shipping_cost !== ''
      ? toNumber(simulatorForm.shipping_cost, 0)
      : toNumber(shippingRule?.shipping_cost, 0);

  const cost = toNumber(simulatorForm.cost, 0);
  const brandMinFloor = toNumber(simulatorForm.brand_min_price, 0);
  const competitorPrice =
    simulatorForm.competitor_price === '' ? 0 : toNumber(simulatorForm.competitor_price, 0);

  const commissionRate =
    simulatorForm.commission_rate === ''
      ? toNumber(activeMarketplaceRule?.commission_rate, 0)
      : toNumber(simulatorForm.commission_rate, 0);

  const vatRate =
    simulatorForm.vat_rate === ''
      ? toNumber(activeMarketplaceRule?.vat_rate, 20)
      : toNumber(simulatorForm.vat_rate, 20);

  const fixedFee =
    simulatorForm.fixed_fee === ''
      ? toNumber(activeMarketplaceRule?.fixed_fee, 0)
      : toNumber(simulatorForm.fixed_fee, 0);

  const discountRate =
    simulatorForm.marketplace_discount_rate === ''
      ? toNumber(activeMarketplaceRule?.marketplace_discount_rate, 0)
      : toNumber(simulatorForm.marketplace_discount_rate, 0);

  const discountFunded = Boolean(simulatorForm.marketplace_discount_funded);

  const minMarginRate =
    simulatorForm.min_margin_rate === ''
      ? toNumber(
          profitRule?.min_margin_rate ??
            profitRule?.min_profit_margin ??
            activeMarketplaceRule?.min_margin_rate ??
            10,
          10
        )
      : toNumber(simulatorForm.min_margin_rate, 10);

  const targetMarginRate =
    simulatorForm.target_margin_rate === ''
      ? toNumber(
          profitRule?.target_margin_rate ??
            profitRule?.target_profit_margin ??
            activeMarketplaceRule?.target_margin_rate ??
            18,
          18
        )
      : toNumber(simulatorForm.target_margin_rate, 18);

  const roundingEnding =
    simulatorForm.rounding_ending === ''
      ? toNumber(activeMarketplaceRule?.rounding_ending, 0.9)
      : toNumber(simulatorForm.rounding_ending, 0.9);

  const commissionBase = activeMarketplaceRule?.commission_base || 'net_ex_vat';

  const matchedExtraDeductions = (Array.isArray(extraDeductions) ? extraDeductions : [])
    .filter((item) => item && item.is_active !== false)
    .filter((item) => String(item.marketplace_rule_id || '') === String(activeMarketplaceRule?.id || ''))
    .map((item) => ({
      name: item.name || 'Ek Kesinti',
      type: item.calculation_type === 'fixed' ? 'fixed' : 'percentage',
      rate: toNumber(item.rate, 0),
      fixedAmount: toNumber(item.fixed_amount, 0),
      baseAmountType: item.base_amount_type || 'net_ex_vat',
    }));

  function calculateFinancials(listPrice) {
    const grossPrice = toNumber(listPrice, 0);
    const customerSeenPrice =
      discountFunded && discountRate > 0
        ? grossPrice * (1 - discountRate / 100)
        : grossPrice;

    const netExVat = grossPrice / (1 + vatRate / 100);

    const commissionBaseAmount =
      commissionBase === 'gross_price' ? grossPrice : netExVat;

    const commissionAmount = commissionBaseAmount * (commissionRate / 100);
    const netAfterCommission = Math.max(0, netExVat - commissionAmount);

    const extraDeductionsTotal = matchedExtraDeductions.reduce((sum, item) => {
      if (item.type === 'fixed') {
        return sum + item.fixedAmount;
      }

      let baseAmount = netExVat;
      if (item.baseAmountType === 'gross_price') {
        baseAmount = grossPrice;
      } else if (item.baseAmountType === 'net_after_commission') {
        baseAmount = netAfterCommission;
      }

      return sum + baseAmount * (item.rate / 100);
    }, 0);

    const profit =
      netExVat - cost - shippingCost - fixedFee - commissionAmount - extraDeductionsTotal;

    const marginRate = grossPrice > 0 ? (profit / grossPrice) * 100 : 0;

    return {
      grossPrice,
      customerSeenPrice,
      netExVat,
      commissionAmount,
      shippingCost,
      platformServiceFee: fixedFee,
      extraDeductionsTotal,
      profit,
      marginRate,
    };
  }

  function solveListPriceForMargin(targetMargin) {
    let low = Math.max(0.01, currentPrice, brandMinFloor);

    if (discountFunded && discountRate > 0 && brandMinFloor > 0) {
      low = Math.max(low, brandMinFloor / (1 - discountRate / 100));
    }

    let high = Math.max(low, cost * 3 + shippingCost + fixedFee + 100);
    let highCalc = calculateFinancials(high);
    let guard = 0;

    while (highCalc.marginRate < targetMargin && guard < 25) {
      high = high * 1.35 + 5;
      highCalc = calculateFinancials(high);
      guard += 1;
    }

    for (let i = 0; i < 40; i += 1) {
      const mid = (low + high) / 2;
      const calc = calculateFinancials(mid);

      if (calc.marginRate >= targetMargin) {
        high = mid;
      } else {
        low = mid;
      }
    }

    return Number(high.toFixed(2));
  }

  const profitFloor = solveListPriceForMargin(minMarginRate);
  const targetPrice = solveListPriceForMargin(targetMarginRate);

  const protectedFloor = Math.max(currentPrice, brandMinFloor, profitFloor);

  const discountAdjustedProtectedFloor =
    discountFunded && discountRate > 0
      ? protectedFloor / (1 - discountRate / 100)
      : protectedFloor;

  const recommendedPrice = roundUpPriceToEnding(
    Math.max(protectedFloor, discountAdjustedProtectedFloor, targetPrice),
    roundingEnding
  );

  const finalCalc = calculateFinancials(recommendedPrice);

  const reasons = [];
  const alerts = [];

  if (marketplaceSpecialRule) {
    reasons.push('Ürüne/kategoriye/pazaryerine en uygun özel kural uygulandı.');
  } else if (marketplaceGeneralRule) {
    reasons.push('Özel kural bulunamadı, fallback kural uygulandı.');
  }

  if (shippingRule) {
    reasons.push('Fiyat ve desiye göre kargo kuralı eşleşti.');
  }

  if (profitRule) {
    reasons.push('Kâr hedefi kuralı hesaplamaya dahil edildi.');
  }

  if (matchedExtraDeductions.length) {
    reasons.push('Bağlı ek kesintiler finansal kırılıma dahil edildi.');
  }

  if (brandMinFloor > 0) {
    alerts.push({
      title: 'Minimum fiyat koruması',
      message: `Firma minimum fiyatı ${formatCurrency(brandMinFloor)} olarak dikkate alındı.`,
    });
  }

  if (discountFunded && discountRate > 0) {
    alerts.push({
      title: 'Pazaryeri indirimi etkisi',
      message: `Fonlu indirim nedeniyle liste fiyatı yukarı taşındı. Müşteri fiyatı ${formatCurrency(
        finalCalc.customerSeenPrice
      )}.`,
    });
  }

  if (competitorPrice > 0) {
    alerts.push({
      title: 'Rakip fiyat farkı',
      message:
        recommendedPrice > competitorPrice
          ? `Önerilen fiyat rakip fiyatın üstünde (${formatCurrency(competitorPrice)}).`
          : `Önerilen fiyat rakip fiyatın altında/eşit (${formatCurrency(competitorPrice)}).`,
    });
  }

  let riskLevel = 'low';
  if (
    finalCalc.marginRate < minMarginRate ||
    (competitorPrice > 0 && recommendedPrice > competitorPrice * 1.15)
  ) {
    riskLevel = 'high';
  } else if (alerts.length >= 2 || finalCalc.marginRate < targetMarginRate) {
    riskLevel = 'medium';
  }

  return {
    source: 'frontend-fallback',
    product: {
      id: product.id,
      stockCode: product.stock_code || '',
      name: product.name || product.product_name || `Ürün #${product.id}`,
      categoryName: product.category_name || '—',
    },
    marketplace: {
      id: marketplace.id,
      marketplace_name: marketplace.marketplace_name || '—',
    },
    matchedRules: {
      marketplaceGeneralRule: marketplaceGeneralRule
        ? {
            id: marketplaceGeneralRule.id,
            name: buildRuleDisplayName(marketplaceGeneralRule),
          }
        : null,
      marketplaceSpecialRule: marketplaceSpecialRule
        ? {
            id: marketplaceSpecialRule.id,
            name: buildRuleDisplayName(marketplaceSpecialRule),
          }
        : null,
      profitRule: profitRule
        ? {
            id: profitRule.id,
            minMarginRate: toNumber(
              profitRule.min_margin_rate ?? profitRule.min_profit_margin,
              minMarginRate
            ),
            targetMarginRate: toNumber(
              profitRule.target_margin_rate ?? profitRule.target_profit_margin,
              targetMarginRate
            ),
          }
        : null,
      shippingRule: shippingRule
        ? {
            id: shippingRule.id,
            name: buildShippingRuleDisplayName(shippingRule),
          }
        : null,
      extraDeductions: matchedExtraDeductions,
    },
    floors: {
      protectedFloor,
      profitFloor,
      targetPrice,
      brandMinFloor,
      discountAdjustedProtectedFloor,
    },
    calculation: {
      grossPrice: finalCalc.grossPrice,
      customerSeenPrice: finalCalc.customerSeenPrice,
      netExVat: finalCalc.netExVat,
      commissionAmount: finalCalc.commissionAmount,
      shippingCost: finalCalc.shippingCost,
      platformServiceFee: finalCalc.platformServiceFee,
      extraDeductionsTotal: finalCalc.extraDeductionsTotal,
      profit: finalCalc.profit,
      marginRate: finalCalc.marginRate,
    },
    decision: {
      recommendedPrice,
      riskLevel,
      reasons,
      alerts,
    },
  };
}

function Field({ label, children, hint }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <span style={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

function TextInput(props) {
  return <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}

function SelectInput({ children, ...props }) {
  return (
    <select {...props} style={{ ...styles.input, ...(props.style || {}) }}>
      {children}
    </select>
  );
}

function TextArea(props) {
  return <textarea {...props} style={{ ...styles.textarea, ...(props.style || {}) }} />;
}

function SectionCard({ title, children, right }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function SimulatorValueRow({ label, value, strong = false }) {
  return (
    <div
      style={{
        ...styles.simulatorValueRow,
        ...(strong ? styles.simulatorValueRowStrong : {}),
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function RulesSimulatorModal({
  open,
  onClose,
  marketplaces,
  products,
  simulatorForm,
  setSimulatorForm,
  onApplyDefaults,
  onCalculate,
  result,
  calculating,
  infoMessage,
  errorMessage,
}) {

  if (!open) return null;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>Kurallar Simülatörü</h2>
            <p style={styles.modalSubtitle}>
              Ürün bazlı kural çıktısını test et. Varsayılanlar otomatik gelir, istersen alanları
              değiştirip tekrar hesaplayabilirsin.
            </p>
          </div>

          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Kapat
          </button>
        </div>

        <div style={styles.modalBody}>
          {infoMessage ? <div style={styles.infoAlert}>{infoMessage}</div> : null}
          {errorMessage ? <div style={styles.errorAlert}>{errorMessage}</div> : null}

          <div style={styles.modalGrid} className="rules-simulator-responsive">
            <section style={styles.simulatorSection}>
              <div style={styles.simulatorSectionHeader}>
                <h3 style={styles.simulatorSectionTitle}>Girdi Alanı</h3>
                <p style={styles.simulatorSectionText}>
                  Önce pazaryeri ve ürün seç. Alış, satış, desi, komisyon ve kargo otomatik dolacak.
                </p>
              </div>

              <div style={styles.formGrid}>
                <Field label="Pazaryeri">
                  <SelectInput
                    value={simulatorForm.marketplace_id}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        marketplace_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Seçiniz</option>
                    {marketplaces.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.marketplace_name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Ürün">
                  <SelectInput
                    value={simulatorForm.product_id}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        product_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Seçiniz</option>
                    {products.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.stock_code
                          ? `${item.stock_code} - ${item.name || item.product_name || `Ürün #${item.id}`}`
                          : item.name || item.product_name || `Ürün #${item.id}`}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Alış Fiyatı">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.cost}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        cost: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Mevcut Satış Fiyatı">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.current_price}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        current_price: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Desi">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.desi}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        desi: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Firma Minimum Fiyatı">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.brand_min_price}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        brand_min_price: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Rakip Fiyatı">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.competitor_price}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        competitor_price: normalizeNumber(e.target.value),
                      }))
                    }
                    placeholder="Opsiyonel"
                  />
                </Field>

                <Field label="Komisyon Oranı (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.commission_rate}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        commission_rate: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="KDV Oranı (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.vat_rate}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        vat_rate: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Sabit Ücret (TL)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.fixed_fee}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        fixed_fee: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Kargo Ücreti (TL)" hint="Değiştirirsen manuel override edilir.">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.shipping_cost}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        shipping_cost: normalizeNumber(e.target.value),
                        shipping_cost_manual: true,
                      }))
                    }
                  />
                </Field>

                <Field label="Pazaryeri İndirim Oranı (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.marketplace_discount_rate}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        marketplace_discount_rate: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="İndirimi Pazaryeri Fonluyor mu?">
                  <SelectInput
                    value={simulatorForm.marketplace_discount_funded ? '1' : '0'}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        marketplace_discount_funded: e.target.value === '1',
                      }))
                    }
                  >
                    <option value="0">Hayır</option>
                    <option value="1">Evet</option>
                  </SelectInput>
                </Field>

                <Field label="Min Marj (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.min_margin_rate}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        min_margin_rate: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Hedef Marj (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.target_margin_rate}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        target_margin_rate: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Yuvarlama Sonu">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={simulatorForm.rounding_ending}
                    onChange={(e) =>
                      setSimulatorForm((prev) => ({
                        ...prev,
                        rounding_ending: normalizeNumber(e.target.value),
                      }))
                    }
                  />
                </Field>

                <div style={styles.simulatorActionRow}>
                  <button type="button" onClick={onApplyDefaults} style={styles.secondaryButton}>
                    Varsayılanları Yükle
                  </button>
                  <button
                    type="button"
                    onClick={onCalculate}
                    style={styles.primaryButton}
                    disabled={calculating}
                  >
                    {calculating ? 'Hesaplanıyor...' : 'Simülasyonu Hesapla'}
                  </button>
                </div>
              </div>
            </section>

            <section style={styles.simulatorSection}>
              <div style={styles.simulatorSectionHeader}>
                <h3 style={styles.simulatorSectionTitle}>Uygulanan Kurallar</h3>
                <p style={styles.simulatorSectionText}>
                  Bu blokta hangi kuralın ve hangi kargo bareminin devreye girdiği görünür.
                </p>
              </div>

              <div style={styles.simulatorStack}>
                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Genel / Fallback Kural</div>
                  <div style={styles.simulatorInfoValue}>
                    {result?.matchedRules?.marketplaceGeneralRule?.name || 'Henüz hesaplanmadı'}
                  </div>
                </div>

                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Uygulanan Pazaryeri Kuralı</div>
                  <div style={styles.simulatorInfoValue}>
                    {result?.matchedRules?.marketplaceSpecialRule?.name || 'Henüz hesaplanmadı'}
                  </div>
                </div>

                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Uygulanan Kâr Hedefi</div>
                  <div style={styles.simulatorInfoValue}>
                    {result?.matchedRules?.profitRule
                      ? `#${result.matchedRules.profitRule.id} • min ${formatPercent(
                          result.matchedRules.profitRule.minMarginRate
                        )} / hedef ${formatPercent(result.matchedRules.profitRule.targetMarginRate)}`
                      : 'Henüz hesaplanmadı'}
                  </div>
                </div>

                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Uygulanan Kargo Kuralı</div>
                  <div style={styles.simulatorInfoValue}>
                    {result?.matchedRules?.shippingRule?.name || 'Henüz hesaplanmadı'}
                  </div>
                </div>

                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Ek Kesintiler</div>
                  <div style={styles.simulatorInfoText}>
                    {result?.matchedRules?.extraDeductions?.length
                      ? result.matchedRules.extraDeductions
                          .map((item) =>
                            item.type === 'fixed'
                              ? `${item.name}: ${formatCurrency(item.fixedAmount)}`
                              : `${item.name}: ${formatPercent(item.rate)}`
                          )
                          .join(' • ')
                      : 'Ek kesinti eşleşmedi'}
                  </div>
                </div>

                <div style={styles.simulatorInfoCard}>
                  <div style={styles.simulatorInfoLabel}>Açıklama</div>
                  <div style={styles.simulatorInfoText}>
                    {result?.decision?.reasons?.length
                      ? result.decision.reasons.join(' | ')
                      : 'Pazaryeri ve ürün seçildikten sonra kural özeti burada gösterilecek.'}
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.simulatorSection}>
              <div style={styles.simulatorSectionHeader}>
                <h3 style={styles.simulatorSectionTitle}>Sonuç</h3>
                <p style={styles.simulatorSectionText}>
                  Nihai önerilen fiyat, müşterinin göreceği fiyat ve finansal kırılım burada oluşur.
                </p>
              </div>

              <div style={styles.simulatorSummaryGrid}>
                <div style={styles.simulatorSummaryCard}>
                  <div style={styles.simulatorInfoLabel}>Önerilen Liste Fiyatı</div>
                  <div style={styles.simulatorBigValue}>
                    {result ? formatCurrency(result.decision?.recommendedPrice) : '—'}
                  </div>
                </div>

                <div style={styles.simulatorSummaryCard}>
                  <div style={styles.simulatorInfoLabel}>Müşterinin Gördüğü Fiyat</div>
                  <div style={styles.simulatorBigValue}>
                    {result ? formatCurrency(result.calculation?.customerSeenPrice) : '—'}
                  </div>
                </div>

                <div style={styles.simulatorSummaryCard}>
                  <div style={styles.simulatorInfoLabel}>Protected Floor</div>
                  <div style={styles.simulatorBigValue}>
                    {result ? formatCurrency(result.floors?.protectedFloor) : '—'}
                  </div>
                </div>

                <div style={styles.simulatorSummaryCard}>
                  <div style={styles.simulatorInfoLabel}>Net Kâr Marjı</div>
                  <div style={styles.simulatorBigValue}>
                    {result ? formatPercent(result.calculation?.marginRate) : '—'}
                  </div>
                </div>
              </div>

              <div style={styles.simulatorBreakdownCard}>
                <div style={styles.simulatorBreakdownTitle}>Temel Bilgiler</div>
                <div style={styles.simulatorBreakdownBody}>
                  <SimulatorValueRow
                    label="Ürün"
                    value={
                      result?.product
                        ? `${result.product.stockCode || '—'} • ${result.product.name || 'Ürün'}`
                        : '—'
                    }
                  />
                  <SimulatorValueRow
                    label="Kategori"
                    value={result?.product?.categoryName || '—'}
                  />
                  <SimulatorValueRow
                    label="Pazaryeri"
                    value={result?.marketplace?.marketplace_name || '—'}
                  />
                  <SimulatorValueRow
                    label="Risk Seviyesi"
                    value={result?.decision?.riskLevel ? result.decision.riskLevel.toUpperCase() : '—'}
                    strong
                  />
                </div>
              </div>

              <div style={styles.simulatorBreakdownCard}>
                <div style={styles.simulatorBreakdownTitle}>Tabanlar ve Hedefler</div>
                <div style={styles.simulatorBreakdownBody}>
                  <SimulatorValueRow
                    label="Min Marj Tabanı"
                    value={result ? formatCurrency(result.floors?.profitFloor) : '—'}
                  />
                  <SimulatorValueRow
                    label="Hedef Marj Fiyatı"
                    value={result ? formatCurrency(result.floors?.targetPrice) : '—'}
                  />
                  <SimulatorValueRow
                    label="Firma Minimum Fiyatı"
                    value={result ? formatCurrency(result.floors?.brandMinFloor) : '—'}
                  />
                  <SimulatorValueRow
                    label="İndirim Sonrası Korunan Taban"
                    value={result ? formatCurrency(result.floors?.discountAdjustedProtectedFloor) : '—'}
                    strong
                  />
                </div>
              </div>

              <div style={styles.simulatorBreakdownCard}>
                <div style={styles.simulatorBreakdownTitle}>Finansal Kırılım</div>
                <div style={styles.simulatorBreakdownBody}>
                  <SimulatorValueRow
                    label="Brüt Satış"
                    value={result ? formatCurrency(result.calculation?.grossPrice) : '—'}
                  />
                  <SimulatorValueRow
                    label="KDV Hariç Net"
                    value={result ? formatCurrency(result.calculation?.netExVat) : '—'}
                  />
                  <SimulatorValueRow
                    label="Komisyon"
                    value={result ? formatCurrency(result.calculation?.commissionAmount) : '—'}
                  />
                  <SimulatorValueRow
                    label="Kargo"
                    value={result ? formatCurrency(result.calculation?.shippingCost) : '—'}
                  />
                  <SimulatorValueRow
                    label="Platform Hizmet Bedeli"
                    value={result ? formatCurrency(result.calculation?.platformServiceFee) : '—'}
                  />
                  <SimulatorValueRow
                    label="Ek Kesintiler"
                    value={result ? formatCurrency(result.calculation?.extraDeductionsTotal) : '—'}
                  />
                  <SimulatorValueRow
                    label="Net Kâr"
                    value={result ? formatCurrency(result.calculation?.profit) : '—'}
                    strong
                  />
                </div>
              </div>

              <div style={styles.simulatorWarningCard}>
                <div style={styles.simulatorWarningTitle}>Uyarılar</div>
                <div style={styles.simulatorWarningText}>
                  {result?.decision?.alerts?.length
                    ? result.decision.alerts.map((item) => `${item.title}: ${item.message}`).join(' | ')
                    : 'Şimdilik uyarı yok.'}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RulesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [showShippingHelp, setShowShippingHelp] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorCalculating, setSimulatorCalculating] = useState(false);
  const [simulatorInfo, setSimulatorInfo] = useState('');
  const [simulatorError, setSimulatorError] = useState('');
  const [simulatorForm, setSimulatorForm] = useState(createEmptySimulatorForm());
  const [simulatorResult, setSimulatorResult] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [marketplaces, setMarketplaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [marketplaceRules, setMarketplaceRules] = useState([]);
  const [shippingRules, setShippingRules] = useState([]);
  const [profitTargets, setProfitTargets] = useState([]);
  const [extraDeductions, setExtraDeductions] = useState([]);

  const [editingMarketplaceRuleId, setEditingMarketplaceRuleId] = useState(null);
  const [editingShippingRuleId, setEditingShippingRuleId] = useState(null);
  const [editingProfitTargetId, setEditingProfitTargetId] = useState(null);
  const [editingExtraDeductionId, setEditingExtraDeductionId] = useState(null);

  const [marketplaceForm, setMarketplaceForm] = useState(emptyMarketplaceRule);
  const [shippingForm, setShippingForm] = useState(emptyShippingRule);
  const [profitForm, setProfitForm] = useState(emptyProfitTarget);
  const [extraForm, setExtraForm] = useState(emptyExtraDeduction);

  const [simulatorForm, setSimulatorForm] = useState(createEmptySimulatorForm());
  const [simulatorResult, setSimulatorResult] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const authHeader = useCallback(() => {
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);
  const productOptions = useMemo(() => buildProductOptions(products), [products]);

  const marketplaceRuleOptions = useMemo(() => {
    return marketplaceRules.map((rule) => ({
      id: rule.id,
      label: `#${rule.id} | ${rule.marketplace_name || 'General'} | ${getScopeLabel(rule.scope_type)}`,
    }));
  }, [marketplaceRules]);

  const fetchAll = useCallback(async () => {
    if (!token) return;

    setLoadingData(true);
    setError('');

    try {
      const [
        marketplacesRes,
        categoriesRes,
        productsRes,
        marketplaceRulesRes,
        shippingRulesRes,
        profitTargetsRes,
        extraDeductionsRes,
      ] = await Promise.all([
        fetch(`${API_URL}/api/marketplaces`, { headers: authHeader() }),
        fetch(`${API_URL}/api/categories`, { headers: authHeader() }),
        fetch(`${API_URL}/api/products`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/marketplace`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/shipping`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/profit-targets`, { headers: authHeader() }),
        fetch(`${API_URL}/api/rules/extra-deductions`, { headers: authHeader() }),
      ]);

      const [
        marketplacesData,
        categoriesData,
        productsData,
        marketplaceRulesData,
        shippingRulesData,
        profitTargetsData,
        extraDeductionsData,
      ] = await Promise.all([
        marketplacesRes.json(),
        categoriesRes.json(),
        productsRes.json(),
        marketplaceRulesRes.json(),
        shippingRulesRes.json(),
        profitTargetsRes.json(),
        extraDeductionsRes.json(),
      ]);

      if (!marketplacesRes.ok) throw new Error(marketplacesData.error || 'Pazaryerleri yüklenemedi');
      if (!categoriesRes.ok) throw new Error(categoriesData.error || 'Kategoriler yüklenemedi');
      if (!productsRes.ok) throw new Error(productsData.error || 'Ürünler yüklenemedi');
      if (!marketplaceRulesRes.ok) throw new Error(marketplaceRulesData.error || 'Pazaryeri kuralları yüklenemedi');
      if (!shippingRulesRes.ok) throw new Error(shippingRulesData.error || 'Kargo kuralları yüklenemedi');
      if (!profitTargetsRes.ok) throw new Error(profitTargetsData.error || 'Kâr hedefleri yüklenemedi');
      if (!extraDeductionsRes.ok) throw new Error(extraDeductionsData.error || 'Ek kesintiler yüklenemedi');

      setMarketplaces(marketplacesData.marketplaces || []);
      setCategories(categoriesData.categories || []);
      setProducts(productsData.products || []);
      setMarketplaceRules(marketplaceRulesData.rules || []);
      setShippingRules(shippingRulesData.rules || []);
      setProfitTargets(profitTargetsData.rules || []);
      setExtraDeductions(extraDeductionsData.rules || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingData(false);
    }
  }, [authHeader, token]);

  useEffect(() => {
    if (user && token) {
      fetchAll();
    }
  }, [user, token, fetchAll]);

  const applySimulatorDefaults = useCallback(() => {
    if (!simulatorForm.marketplace_id || !simulatorForm.product_id) return;

    const defaults = buildSimulatorDefaults({
      marketplaceId: simulatorForm.marketplace_id,
      productId: simulatorForm.product_id,
      products,
      marketplaceRules,
      shippingRules,
      profitTargets,
    });

    if (!defaults) return;

    setSimulatorForm((prev) => ({
      ...prev,
      ...defaults,
    }));
    setSimulatorResult(null);
  }, [
    simulatorForm.marketplace_id,
    simulatorForm.product_id,
    products,
    marketplaceRules,
    shippingRules,
    profitTargets,
  ]);

  useEffect(() => {
    if (isSimulatorOpen && simulatorForm.marketplace_id && simulatorForm.product_id) {
      applySimulatorDefaults();
    }
  }, [
    isSimulatorOpen,
    simulatorForm.marketplace_id,
    simulatorForm.product_id,
    applySimulatorDefaults,
  ]);

  async function submitForm(url, method, payload, successMessage) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'İşlem başarısız');
      }

      setSuccess(successMessage);
      await fetchAll();
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(url, successMessage) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: authHeader(),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Silme başarısız');
      }

      setSuccess(successMessage);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/rules/export`,
        token,
        method: 'GET',
        defaultFilename: 'rules-export.xlsx',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleTemplateDownload() {
    try {
      await downloadExcelFile({
        url: `${API_URL}/api/rules/template`,
        token,
        method: 'GET',
        defaultFilename: 'rules-template.xlsx',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleImport(file) {
    if (!file) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/rules/import`, {
        method: 'POST',
        headers: {
          ...authHeader(),
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Excel içe aktarma başarısız');
      }

      setSuccess('Rules Excel içe aktarma tamamlandı');
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetMarketplaceForm() {
    setMarketplaceForm(emptyMarketplaceRule);
    setEditingMarketplaceRuleId(null);
  }

  function resetShippingForm() {
    setShippingForm(emptyShippingRule);
    setEditingShippingRuleId(null);
  }

  function resetProfitForm() {
    setProfitForm(emptyProfitTarget);
    setEditingProfitTargetId(null);
  }

  function resetExtraForm() {
    setExtraForm(emptyExtraDeduction);
    setEditingExtraDeductionId(null);
  }

  function startEditMarketplaceRule(rule) {
    setEditingMarketplaceRuleId(rule.id);
    setMarketplaceForm({
      scope_type: rule.scope_type || 'general',
      marketplace_id: rule.marketplace_id ?? '',
      category_id: rule.category_id ?? '',
      product_id: rule.product_id ?? '',
      priority: normalizeNumber(rule.priority) || 0,
      commission_rate: normalizeNumber(rule.commission_rate) || 0,
      commission_base: rule.commission_base || 'net_ex_vat',
      vat_rate: normalizeNumber(rule.vat_rate) || 20,
      fixed_fee: normalizeNumber(rule.fixed_fee) || 0,
      marketplace_discount_rate: normalizeNumber(rule.marketplace_discount_rate) || 0,
      marketplace_discount_funded: Boolean(rule.marketplace_discount_funded),
      rounding_ending: normalizeNumber(rule.rounding_ending) || 0.9,
      min_margin_rate: normalizeNumber(rule.min_margin_rate ?? rule.minimum_profit_margin) || 10,
      target_margin_rate: normalizeNumber(rule.target_margin_rate ?? rule.target_profit_margin) || 18,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('marketplace');
  }

  function startEditShippingRule(rule) {
    setEditingShippingRuleId(rule.id);
    setShippingForm({
      marketplace_id: rule.marketplace_id ?? '',
      min_price: normalizeNumber(rule.min_price),
      max_price: rule.max_price ?? '',
      min_desi: normalizeNumber(rule.min_desi),
      max_desi: rule.max_desi ?? '',
      shipping_cost: normalizeNumber(rule.shipping_cost),
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('shipping');
  }

  function startEditProfitTarget(rule) {
    setEditingProfitTargetId(rule.id);
    setProfitForm({
      scope_type: rule.scope_type || 'general',
      marketplace_id: rule.marketplace_id ?? '',
      category_id: rule.category_id ?? '',
      product_id: rule.product_id ?? '',
      priority: normalizeNumber(rule.priority) || 0,
      min_margin_rate: normalizeNumber(rule.min_margin_rate ?? rule.min_profit_margin) || 10,
      target_margin_rate: normalizeNumber(rule.target_margin_rate ?? rule.target_profit_margin) || 18,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('profit');
  }

  function startEditExtraDeduction(rule) {
    setEditingExtraDeductionId(rule.id);
    setExtraForm({
      marketplace_rule_id: rule.marketplace_rule_id ?? '',
      name: rule.name || 'Ek Kesinti',
      deduction_type: rule.deduction_type || 'other',
      calculation_type: rule.calculation_type || 'percentage',
      base_amount_type: rule.base_amount_type || 'net_ex_vat',
      rate: normalizeNumber(rule.rate) || 0,
      fixed_amount: normalizeNumber(rule.fixed_amount) || 0,
      priority: normalizeNumber(rule.priority) || 0,
      is_active: Boolean(rule.is_active),
      notes: rule.notes || '',
    });
    setActiveTab('deductions');
  }

  async function handleMarketplaceSubmit(e) {
    e.preventDefault();

    try {
      await submitForm(
        `${API_URL}/api/rules/marketplace${editingMarketplaceRuleId ? `/${editingMarketplaceRuleId}` : ''}`,
        editingMarketplaceRuleId ? 'PUT' : 'POST',
        marketplaceForm,
        editingMarketplaceRuleId ? 'Pazaryeri kuralı güncellendi' : 'Pazaryeri kuralı eklendi'
      );
      resetMarketplaceForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleShippingSubmit(e) {
    e.preventDefault();

    try {
      await submitForm(
        `${API_URL}/api/rules/shipping${editingShippingRuleId ? `/${editingShippingRuleId}` : ''}`,
        editingShippingRuleId ? 'PUT' : 'POST',
        shippingForm,
        editingShippingRuleId ? 'Kargo kuralı güncellendi' : 'Kargo kuralı eklendi'
      );
      resetShippingForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleProfitSubmit(e) {
    e.preventDefault();

    try {
      await submitForm(
        `${API_URL}/api/rules/profit-targets${editingProfitTargetId ? `/${editingProfitTargetId}` : ''}`,
        editingProfitTargetId ? 'PUT' : 'POST',
        profitForm,
        editingProfitTargetId ? 'Kâr hedefi güncellendi' : 'Kâr hedefi eklendi'
      );
      resetProfitForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleExtraSubmit(e) {
    e.preventDefault();

    try {
      await submitForm(
        `${API_URL}/api/rules/extra-deductions${editingExtraDeductionId ? `/${editingExtraDeductionId}` : ''}`,
        editingExtraDeductionId ? 'PUT' : 'POST',
        extraForm,
        editingExtraDeductionId ? 'Ek kesinti güncellendi' : 'Ek kesinti eklendi'
      );
      resetExtraForm();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleSimulatorCalculate() {
  setSimulatorError('');
  setSimulatorInfo('');
  setError('');

  if (!simulatorForm.marketplace_id) {
    setSimulatorError('Simülasyon için pazaryeri seçmelisin');
    return;
  }

  if (!simulatorForm.product_id) {
    setSimulatorError('Simülasyon için ürün seçmelisin');
    return;
  }

  setSimulatorCalculating(true);

  try {
    const overrides = {
      cost: simulatorForm.cost === '' ? undefined : toNumber(simulatorForm.cost),
      currentPrice: simulatorForm.current_price === '' ? undefined : toNumber(simulatorForm.current_price),
      desi: simulatorForm.desi === '' ? undefined : toNumber(simulatorForm.desi),
      competitorPrice:
        simulatorForm.competitor_price === '' ? undefined : toNumber(simulatorForm.competitor_price),
      brandMinPrice:
        simulatorForm.brand_min_price === '' ? undefined : toNumber(simulatorForm.brand_min_price),
      commissionRate:
        simulatorForm.commission_rate === '' ? undefined : toNumber(simulatorForm.commission_rate),
      vatRate:
        simulatorForm.vat_rate === '' ? undefined : toNumber(simulatorForm.vat_rate),
      fixedFee:
        simulatorForm.fixed_fee === '' ? undefined : toNumber(simulatorForm.fixed_fee),
      marketplaceDiscountRate:
        simulatorForm.marketplace_discount_rate === ''
          ? undefined
          : toNumber(simulatorForm.marketplace_discount_rate),
      marketplaceDiscountFunded: Boolean(simulatorForm.marketplace_discount_funded),
      minMarginRate:
        simulatorForm.min_margin_rate === '' ? undefined : toNumber(simulatorForm.min_margin_rate),
      targetMarginRate:
        simulatorForm.target_margin_rate === '' ? undefined : toNumber(simulatorForm.target_margin_rate),
      roundingEnding:
        simulatorForm.rounding_ending === '' ? undefined : toNumber(simulatorForm.rounding_ending),
    };

    if (simulatorForm.shipping_cost_manual && simulatorForm.shipping_cost !== '') {
      overrides.shippingCost = toNumber(simulatorForm.shipping_cost);
    }

    const payload = {
      productId: Number(simulatorForm.product_id),
      marketplaceId: Number(simulatorForm.marketplace_id),
      overrides,
    };

    try {
      const data = await postSimulatorRequest({
        token,
        payload,
      });

      setSimulatorResult(data);
      setSimulatorInfo('');
      return;
    } catch (err) {
      if (!isMissingSimulateEndpointError(err)) {
        throw err;
      }
    }

    const localResult = buildLocalSimulationResult({
      simulatorForm,
      products,
      marketplaces,
      marketplaceRules,
      shippingRules,
      profitTargets,
      extraDeductions,
    });

    setSimulatorResult(localResult);
    setSimulatorInfo(
      'Simulate endpoint henüz backend tarafında yok. Geçici olarak frontend fallback sonucu gösteriliyor.'
    );
  } catch (err) {
    setSimulatorError(getErrorMessage(err));
  } finally {
    setSimulatorCalculating(false);
  }
}


      if (simulatorForm.shipping_cost_manual && simulatorForm.shipping_cost !== '') {
        overrides.shippingCost = toNumber(simulatorForm.shipping_cost);
      }

      const response = await fetch(`${API_URL}/api/rules/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({
          productId: Number(simulatorForm.product_id),
          marketplaceId: Number(simulatorForm.marketplace_id),
          overrides,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Simülasyon başarısız');
      }

      setSimulatorResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSimulatorCalculating(false);
    }
  }

  function handleCloseSimulator() {
    setIsSimulatorOpen(false);
  }

  if (loading) {
    return <div style={styles.centered}>Yükleniyor...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Navigation />

      <div style={styles.page}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>Kurallar Merkezi</h1>
            <p style={styles.pageSubtitle}>
              Genel fallback, pazaryeri bazlı istisnalar, kargo baremleri, kâr hedefleri ve ek
              kesintiler bu ekrandan yönetilir.
            </p>
          </div>

          <div style={styles.toolbar}>
            <button
              type="button"
              onClick={fetchAll}
              style={styles.secondaryButton}
              disabled={loadingData || saving}
            >
              Yenile
            </button>

            <button
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              style={styles.secondaryButton}
              disabled={loadingData || saving}
            >
              Simülatörü Aç
            </button>

            <button
              type="button"
              onClick={handleExport}
              style={styles.secondaryButton}
              disabled={loadingData || saving}
            >
              Excel Dışa Aktar
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.secondaryButton}
              disabled={loadingData || saving}
            >
              Excel İçe Aktar
            </button>

            <button
              type="button"
              onClick={handleTemplateDownload}
              style={styles.primaryButton}
              disabled={loadingData || saving}
            >
              Şablon İndir
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                handleImport(file);
              }}
            />
          </div>
        </div>

        {error ? <div style={styles.errorBox}>{error}</div> : null}
        {success ? <div style={styles.successBox}>{success}</div> : null}

        <div style={styles.tabs}>
          {[
            ['marketplace', 'Pazaryeri Kuralları'],
            ['shipping', 'Kargo Kuralları'],
            ['profit', 'Kâr Hedefleri'],
            ['deductions', 'Ek Kesintiler'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                ...styles.tabButton,
                ...(activeTab === key ? styles.tabButtonActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingData ? (
          <div style={styles.centered}>Kurallar yükleniyor...</div>
        ) : (
          <>
            {activeTab === 'marketplace' && (
              <div style={styles.grid} className="rules-grid-responsive">
                <SectionCard title="Pazaryeri Kural Formu">
                  <form onSubmit={handleMarketplaceSubmit} style={styles.formGrid}>
                    <Field label="Kapsam">
                      <SelectInput
                        value={marketplaceForm.scope_type}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({ ...prev, scope_type: e.target.value }))
                        }
                      >
                        <option value="general">General</option>
                        <option value="marketplace">Pazaryeri</option>
                        <option value="category">Kategori</option>
                        <option value="product">Ürün</option>
                      </SelectInput>
                    </Field>

                    <Field label="Pazaryeri">
                      <SelectInput
                        value={marketplaceForm.marketplace_id}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            marketplace_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Kategori">
                      <SelectInput
                        value={marketplaceForm.category_id}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({ ...prev, category_id: e.target.value }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {categoryOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ürün">
                      <SelectInput
                        value={marketplaceForm.product_id}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({ ...prev, product_id: e.target.value }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {productOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={marketplaceForm.priority}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            priority: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Komisyon Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.commission_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            commission_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Komisyon Bazı">
                      <SelectInput
                        value={marketplaceForm.commission_base}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            commission_base: e.target.value,
                          }))
                        }
                      >
                        <option value="net_ex_vat">KDV Hariç Net</option>
                        <option value="gross_price">Brüt Fiyat</option>
                      </SelectInput>
                    </Field>

                    <Field label="KDV Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.vat_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            vat_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Sabit Ücret">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.fixed_fee}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            fixed_fee: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Pazaryeri İndirim Oranı (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.marketplace_discount_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            marketplace_discount_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Pazaryeri İndirimi Fonluyor mu?">
                      <SelectInput
                        value={marketplaceForm.marketplace_discount_funded ? '1' : '0'}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            marketplace_discount_funded: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="0">Hayır</option>
                        <option value="1">Evet</option>
                      </SelectInput>
                    </Field>

                    <Field label="Yuvarlama Sonu">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.rounding_ending}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            rounding_ending: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Min Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.min_margin_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            min_margin_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Hedef Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={marketplaceForm.target_margin_rate}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            target_margin_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={marketplaceForm.is_active ? '1' : '0'}
                        onChange={(e) =>
                          setMarketplaceForm((prev) => ({
                            ...prev,
                            is_active: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={marketplaceForm.notes}
                          onChange={(e) =>
                            setMarketplaceForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingMarketplaceRuleId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={resetMarketplaceForm}
                        disabled={saving}
                      >
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Pazaryeri Kuralları Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Kapsam</th>
                          <th>Pazaryeri</th>
                          <th>Kategori</th>
                          <th>Ürün</th>
                          <th>Komisyon</th>
                          <th>Min Marj</th>
                          <th>Hedef Marj</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marketplaceRules.map((rule) => (
                          <tr key={rule.id}>
                            <td>{getScopeLabel(rule.scope_type)}</td>
                            <td>{rule.marketplace_name || 'General'}</td>
                            <td>{rule.category_name || '—'}</td>
                            <td>
                              {rule.product_stock_code
                                ? `${rule.product_stock_code} - ${rule.product_name || ''}`
                                : rule.product_name || '—'}
                            </td>
                            <td>{rule.commission_rate ?? 0}</td>
                            <td>{rule.min_margin_rate ?? rule.minimum_profit_margin ?? 0}</td>
                            <td>{rule.target_margin_rate ?? rule.target_profit_margin ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button
                                  type="button"
                                  style={styles.linkButton}
                                  onClick={() => startEditMarketplaceRule(rule)}
                                >
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(
                                      `${API_URL}/api/rules/marketplace/${rule.id}`,
                                      'Pazaryeri kuralı silindi'
                                    ).catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {marketplaceRules.length === 0 && (
                          <tr>
                            <td colSpan={9} style={styles.emptyCell}>
                              Kayıt yok
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div style={styles.grid} className="rules-grid-responsive">
                <SectionCard
                  title="Kargo Kural Formu"
                  right={
                    <div
                      style={styles.infoWrap}
                      onMouseEnter={() => setShowShippingHelp(true)}
                      onMouseLeave={() => setShowShippingHelp(false)}
                    >
                      <button
                        type="button"
                        style={styles.infoButton}
                        onClick={() => setShowShippingHelp((prev) => !prev)}
                      >
                        i
                      </button>
                      {showShippingHelp && (
                        <div style={styles.infoPopover}>
                          Sistem önce pazaryerine özel kargo kurallarını kontrol eder. Uygun kayıt
                          bulunamazsa genel kuralları uygular. Eşleşme hem fiyat aralığına hem desi
                          aralığına göre yapılır. Pazaryeri boş bırakılırsa kayıt genel kural kabul
                          edilir.
                        </div>
                      )}
                    </div>
                  }
                >
                  <form onSubmit={handleShippingSubmit} style={styles.formGrid}>
                    <Field
                      label="Pazaryeri"
                      hint="Boş bırakılırsa genel kural olarak değerlendirilir."
                    >
                      <SelectInput
                        value={shippingForm.marketplace_id}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            marketplace_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Genel</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Min Tutar (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.min_price}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            min_price: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Max Tutar (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.max_price}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            max_price: normalizeNumber(e.target.value),
                          }))
                        }
                        placeholder="Boş = üst sınır yok"
                      />
                    </Field>

                    <Field label="Min Desi">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.min_desi}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            min_desi: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Max Desi">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.max_desi}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            max_desi: normalizeNumber(e.target.value),
                          }))
                        }
                        placeholder="Boş = üst sınır yok"
                      />
                    </Field>

                    <Field label="Kargo Ücreti (TL)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={shippingForm.shipping_cost}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            shipping_cost: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={shippingForm.is_active ? '1' : '0'}
                        onChange={(e) =>
                          setShippingForm((prev) => ({
                            ...prev,
                            is_active: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={shippingForm.notes}
                          onChange={(e) =>
                            setShippingForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingShippingRuleId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={resetShippingForm}
                        disabled={saving}
                      >
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Kargo Kuralları Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Pazaryeri</th>
                          <th>Min Tutar</th>
                          <th>Max Tutar</th>
                          <th>Min Desi</th>
                          <th>Max Desi</th>
                          <th>Kargo Ücreti</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shippingRules.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.marketplace_name || 'Genel'}</td>
                            <td>{rule.min_price ?? '—'}</td>
                            <td>{rule.max_price ?? '—'}</td>
                            <td>{rule.min_desi ?? '—'}</td>
                            <td>{rule.max_desi ?? '—'}</td>
                            <td>{rule.shipping_cost ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button
                                  type="button"
                                  style={styles.linkButton}
                                  onClick={() => startEditShippingRule(rule)}
                                >
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(
                                      `${API_URL}/api/rules/shipping/${rule.id}`,
                                      'Kargo kuralı silindi'
                                    ).catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {shippingRules.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>
                              Kayıt yok
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'profit' && (
              <div style={styles.grid} className="rules-grid-responsive">
                <SectionCard title="Kâr Hedefi Formu">
                  <form onSubmit={handleProfitSubmit} style={styles.formGrid}>
                    <Field label="Kapsam">
                      <SelectInput
                        value={profitForm.scope_type}
                        onChange={(e) =>
                          setProfitForm((prev) => ({ ...prev, scope_type: e.target.value }))
                        }
                      >
                        <option value="general">General</option>
                        <option value="marketplace">Pazaryeri</option>
                        <option value="category">Kategori</option>
                        <option value="product">Ürün</option>
                      </SelectInput>
                    </Field>

                    <Field label="Pazaryeri">
                      <SelectInput
                        value={profitForm.marketplace_id}
                        onChange={(e) =>
                          setProfitForm((prev) => ({ ...prev, marketplace_id: e.target.value }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {marketplaces.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.marketplace_name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Kategori">
                      <SelectInput
                        value={profitForm.category_id}
                        onChange={(e) =>
                          setProfitForm((prev) => ({ ...prev, category_id: e.target.value }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {categoryOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ürün">
                      <SelectInput
                        value={profitForm.product_id}
                        onChange={(e) =>
                          setProfitForm((prev) => ({ ...prev, product_id: e.target.value }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {productOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={profitForm.priority}
                        onChange={(e) =>
                          setProfitForm((prev) => ({
                            ...prev,
                            priority: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Min Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={profitForm.min_margin_rate}
                        onChange={(e) =>
                          setProfitForm((prev) => ({
                            ...prev,
                            min_margin_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Hedef Marj (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={profitForm.target_margin_rate}
                        onChange={(e) =>
                          setProfitForm((prev) => ({
                            ...prev,
                            target_margin_rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={profitForm.is_active ? '1' : '0'}
                        onChange={(e) =>
                          setProfitForm((prev) => ({
                            ...prev,
                            is_active: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={profitForm.notes}
                          onChange={(e) =>
                            setProfitForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingProfitTargetId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={resetProfitForm}
                        disabled={saving}
                      >
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Kâr Hedefleri Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Kapsam</th>
                          <th>Pazaryeri</th>
                          <th>Kategori</th>
                          <th>Ürün</th>
                          <th>Min Marj</th>
                          <th>Hedef Marj</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitTargets.map((rule) => (
                          <tr key={rule.id}>
                            <td>{getScopeLabel(rule.scope_type)}</td>
                            <td>{rule.marketplace_name || 'General'}</td>
                            <td>{rule.category_name || '—'}</td>
                            <td>
                              {rule.product_stock_code
                                ? `${rule.product_stock_code} - ${rule.product_name || ''}`
                                : rule.product_name || '—'}
                            </td>
                            <td>{rule.min_margin_rate ?? rule.min_profit_margin ?? 0}</td>
                            <td>{rule.target_margin_rate ?? rule.target_profit_margin ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button
                                  type="button"
                                  style={styles.linkButton}
                                  onClick={() => startEditProfitTarget(rule)}
                                >
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(
                                      `${API_URL}/api/rules/profit-targets/${rule.id}`,
                                      'Kâr hedefi silindi'
                                    ).catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {profitTargets.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>
                              Kayıt yok
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'deductions' && (
              <div style={styles.grid} className="rules-grid-responsive">
                <SectionCard title="Ek Kesinti Formu">
                  <form onSubmit={handleExtraSubmit} style={styles.formGrid}>
                    <Field label="Pazaryeri Kuralı">
                      <SelectInput
                        value={extraForm.marketplace_rule_id}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            marketplace_rule_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seçiniz</option>
                        {marketplaceRuleOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>

                    <Field label="Ad">
                      <TextInput
                        value={extraForm.name}
                        onChange={(e) =>
                          setExtraForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </Field>

                    <Field label="Kesinti Tipi">
                      <SelectInput
                        value={extraForm.deduction_type}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            deduction_type: e.target.value,
                          }))
                        }
                      >
                        <option value="withholding">Stopaj</option>
                        <option value="other">Diğer</option>
                        <option value="service">Hizmet</option>
                      </SelectInput>
                    </Field>

                    <Field label="Hesaplama Tipi">
                      <SelectInput
                        value={extraForm.calculation_type}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            calculation_type: e.target.value,
                          }))
                        }
                      >
                        <option value="percentage">Yüzde</option>
                        <option value="fixed">Sabit</option>
                      </SelectInput>
                    </Field>

                    <Field label="Baz Tutar Tipi">
                      <SelectInput
                        value={extraForm.base_amount_type}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            base_amount_type: e.target.value,
                          }))
                        }
                      >
                        <option value="net_ex_vat">Net (KDV Hariç)</option>
                        <option value="gross_price">Brüt Fiyat</option>
                        <option value="net_after_commission">Komisyon Sonrası Net</option>
                      </SelectInput>
                    </Field>

                    <Field label="Oran (%)">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={extraForm.rate}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            rate: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Sabit Tutar">
                      <TextInput
                        type="number"
                        step="0.01"
                        value={extraForm.fixed_amount}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            fixed_amount: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Öncelik">
                      <TextInput
                        type="number"
                        value={extraForm.priority}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            priority: normalizeNumber(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label="Aktif mi">
                      <SelectInput
                        value={extraForm.is_active ? '1' : '0'}
                        onChange={(e) =>
                          setExtraForm((prev) => ({
                            ...prev,
                            is_active: e.target.value === '1',
                          }))
                        }
                      >
                        <option value="1">Evet</option>
                        <option value="0">Hayır</option>
                      </SelectInput>
                    </Field>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <Field label="Not">
                        <TextArea
                          rows={3}
                          value={extraForm.notes}
                          onChange={(e) =>
                            setExtraForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                        />
                      </Field>
                    </div>

                    <div style={styles.formActions}>
                      <button type="submit" style={styles.primaryButton} disabled={saving}>
                        {editingExtraDeductionId ? 'Güncelle' : 'Kaydet'}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={resetExtraForm}
                        disabled={saving}
                      >
                        Temizle
                      </button>
                    </div>
                  </form>
                </SectionCard>

                <SectionCard title="Ek Kesintiler Listesi">
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Ad</th>
                          <th>Kural</th>
                          <th>Tip</th>
                          <th>Hesaplama</th>
                          <th>Oran</th>
                          <th>Sabit</th>
                          <th>Aktif</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraDeductions.map((rule) => (
                          <tr key={rule.id}>
                            <td>{rule.name || '—'}</td>
                            <td>{rule.marketplace_name || rule.marketplace_rule_scope || '—'}</td>
                            <td>{rule.deduction_type || '—'}</td>
                            <td>{rule.calculation_type || '—'}</td>
                            <td>{rule.rate ?? 0}</td>
                            <td>{rule.fixed_amount ?? 0}</td>
                            <td>{formatBool(rule.is_active)}</td>
                            <td>
                              <div style={styles.rowActions}>
                                <button
                                  type="button"
                                  style={styles.linkButton}
                                  onClick={() => startEditExtraDeduction(rule)}
                                >
                                  Düzenle
                                </button>
                                <button
                                  type="button"
                                  style={styles.linkDangerButton}
                                  onClick={() =>
                                    deleteRule(
                                      `${API_URL}/api/rules/extra-deductions/${rule.id}`,
                                      'Ek kesinti silindi'
                                    ).catch((err) => setError(getErrorMessage(err)))
                                  }
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {extraDeductions.length === 0 && (
                          <tr>
                            <td colSpan={8} style={styles.emptyCell}>
                              Kayıt yok
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}
          </>
        )}
      </div>

     <RulesSimulatorModal
       open={isSimulatorOpen}
       onClose={handleCloseSimulator}
       marketplaces={marketplaces}
       products={products}
       simulatorForm={simulatorForm}
       setSimulatorForm={setSimulatorForm}
       onApplyDefaults={applySimulatorDefaults}
       onCalculate={handleSimulatorCalculate}
       result={simulatorResult}
       calculating={simulatorCalculating}
       infoMessage={simulatorInfo}
       errorMessage={simulatorError}
     />
      />
    </>
  );
}
const ENDPOINT_MISSING_MESSAGES = [
  'Cannot POST /api/rules/simulate',
  'Cannot POST /rules/simulate',
  '404',
  'Not Found',
  'endpoint_missing',
];

function isMissingSimulateEndpointError(error) {
  const message = String(error?.message || error || '');
  return ENDPOINT_MISSING_MESSAGES.some((item) => message.includes(item));
}

async function postSimulatorRequest({ token, payload }) {
  const response = await fetch(`${API_URL}/api/rules/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 404) {
    throw new Error('endpoint_missing');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Simülatör isteği başarısız (${response.status})`);
  }

  return data;
}
const styles = {
  page: {
    padding: '28px 32px',
    maxWidth: 1600,
    margin: '0 auto',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    background: '#f0f4f8',
    minHeight: '100vh',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    borderRadius: 20,
    padding: '24px 28px',
    boxShadow: '0 8px 32px rgba(37,99,235,0.18)',
  },
  pageTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  pageSubtitle: {
    margin: '6px 0 0',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
    fontSize: 14,
  },
  toolbar: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  primaryButton: {
    height: 40,
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#1e3a5f',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'transform 0.1s',
  },
  secondaryButton: {
    height: 40,
    padding: '0 16px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 13,
    backdropFilter: 'blur(4px)',
  },
  errorBox: {
    padding: '12px 16px',
    borderRadius: 12,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    marginBottom: 16,
    fontWeight: 500,
    fontSize: 14,
  },
  successBox: {
    padding: '12px 16px',
    borderRadius: 12,
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
    marginBottom: 16,
    fontWeight: 500,
    fontSize: 14,
  },
infoAlert: {
  padding: '12px 16px',
  borderRadius: 12,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
  marginBottom: 16,
  fontWeight: 500,
  fontSize: 14,
},
errorAlert: {
  padding: '12px 16px',
  borderRadius: 12,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  marginBottom: 16,
  fontWeight: 500,
  fontSize: 14,
},

  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
    background: '#fff',
    padding: '8px',
    borderRadius: 14,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
  },
  tabButton: {
    height: 38,
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    transition: 'all 0.15s',
  },
  tabButtonActive: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
  },
  centered: {
    padding: 40,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 15,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(360px, 460px) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
  },
  card: {
    background: '#fff',
    border: '1px solid #e8eef4',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 4px 20px rgba(15,23,42,0.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '2px solid #f1f5f9',
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#1e3a5f',
    letterSpacing: '-0.3px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  input: {
    height: 38,
    borderRadius: 9,
    border: '1.5px solid #e2e8f0',
    padding: '0 12px',
    outline: 'none',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 13,
    transition: 'border-color 0.15s',
  },
  textarea: {
    minHeight: 80,
    borderRadius: 9,
    border: '1.5px solid #e2e8f0',
    padding: '10px 12px',
    outline: 'none',
    resize: 'vertical',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 13,
  },
  formActions: {
    display: 'flex',
    gap: 10,
    gridColumn: '1 / -1',
    marginTop: 6,
    paddingTop: 14,
    borderTop: '1px solid #f1f5f9',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid #e8eef4',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  emptyCell: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 24,
    fontStyle: 'italic',
  },
  rowActions: {
    display: 'flex',
    gap: 10,
  },
  linkButton: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 700,
    fontSize: 13,
  },
  linkDangerButton: {
    border: 'none',
    background: 'transparent',
    color: '#dc2626',
    cursor: 'pointer',
    padding: 0,
    fontWeight: 700,
    fontSize: 13,
  },
  infoWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
  },
  infoPopover: {
    position: 'absolute',
    top: 34,
    right: 0,
    width: 300,
    padding: 14,
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#334155',
    fontSize: 13,
    lineHeight: 1.6,
    boxShadow: '0 16px 40px rgba(15,23,42,0.12)',
    zIndex: 20,
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
    backdropFilter: 'blur(3px)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 1520,
    maxHeight: '92vh',
    overflow: 'hidden',
    background: '#f0f4f8',
    borderRadius: 24,
    border: '1px solid #e2e8f0',
    boxShadow: '0 40px 80px rgba(15,23,42,0.28)',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '20px 28px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    borderRadius: '24px 24px 0 0',
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  modalSubtitle: {
    margin: '6px 0 0',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.5,
    fontSize: 13,
  },
  modalBody: {
    padding: 24,
    overflowY: 'auto',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr',
    gap: 18,
    alignItems: 'start',
  },
  // Simulator
  simulatorSection: {
    border: '1px solid #e8eef4',
    borderRadius: 18,
    padding: 18,
    background: '#fff',
    boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
  },
  simulatorSectionHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '2px solid #f1f5f9',
  },
  simulatorSectionTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: '#1e3a5f',
    letterSpacing: '-0.3px',
  },
  simulatorSectionText: {
    margin: '5px 0 0',
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
  simulatorStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  simulatorInfoCard: {
    border: '1px solid #e8eef4',
    borderRadius: 12,
    padding: 12,
    background: '#f8fafc',
  },
  simulatorInfoLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#64748b',
  },
  simulatorInfoValue: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  simulatorInfoText: {
    marginTop: 6,
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.6,
  },
  simulatorSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 14,
  },
  simulatorSummaryCard: {
    border: '1px solid #e8eef4',
    borderRadius: 14,
    padding: 14,
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e8eef4 100%)',
  },
  simulatorBigValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: 800,
    color: '#1e3a5f',
    letterSpacing: '-0.5px',
  },
  simulatorBreakdownCard: {
    border: '1px solid #e8eef4',
    borderRadius: 14,
    padding: 14,
    background: '#fff',
    marginBottom: 12,
  },
  simulatorBreakdownTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#1e3a5f',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid #f1f5f9',
  },
  simulatorBreakdownBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  simulatorValueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '6px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 13,
    color: '#475569',
  },
  simulatorValueRowStrong: {
    color: '#1e3a5f',
    fontWeight: 800,
    fontSize: 14,
  },
  simulatorWarningCard: {
    border: '1px solid #fde68a',
    borderRadius: 14,
    padding: 14,
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
  },
  simulatorWarningTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: '#92400e',
    marginBottom: 8,
  },
  simulatorWarningText: {
    fontSize: 13,
    color: '#b45309',
    lineHeight: 1.6,
  },
  simulatorActionRow: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: 10,
    marginTop: 8,
    paddingTop: 14,
    borderTop: '1px solid #f1f5f9',
  },
};

if (typeof window !== 'undefined') {
  const styleId = 'rules-page-table-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

      table th, table td {
        border-bottom: 1px solid #e8eef4;
        padding: 10px 14px;
        text-align: left;
        vertical-align: middle;
        white-space: nowrap;
      }
      table thead th {
        background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        position: sticky;
        top: 0;
      }
      table tbody tr:hover {
        background: #f8fafc;
      }
      table tbody tr:last-child td {
        border-bottom: none;
      }
      input:focus, select:focus, textarea:focus {
        border-color: #2563eb !important;
        background: #fff !important;
        box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
      }
      button:hover {
        opacity: 0.88;
      }
      @media (max-width: 1200px) {
        .rules-grid-responsive {
          grid-template-columns: 1fr !important;
        }
      }
      @media (max-width: 1400px) {
        .rules-simulator-responsive {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}