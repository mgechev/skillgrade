#!/bin/bash
set -euo pipefail

cat > service.js << 'EOF'
function getUserDisplayName(user) {
  if (!user) return null;
  return (user.firstName ?? '') + ' ' + (user.lastName ?? '');
}

function getShippingCity(order) {
  return order?.shipping?.address?.city ?? undefined;
}

function getActiveUserEmail(users, userId) {
  const user = users.find(u => u.id === userId);
  return user?.email;
}

function getFeatureFlag(config, flagName) {
  return config?.features?.flags?.[flagName]?.enabled;
}

function processItems(items) {
  const categories = new Map();
  for (const item of items) {
    if (!categories.has(item.category)) {
      categories.set(item.category, []);
    }
    categories.get(item.category).push(item);
  }
  return categories;
}

function formatPrice(amount, currency, locale) {
  return new Intl.NumberFormat(locale ?? 'en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format(amount);
}

function getLatestEntry(entries) {
  if (!entries || entries.length === 0) return undefined;
  entries.sort((a, b) => b.date - a.date);
  return entries[0].value;
}

function parseConfig(jsonString) {
  const config = JSON.parse(jsonString);
  return {
    host: config?.database?.host,
    port: config?.database?.port,
    name: config?.database?.name,
  };
}

module.exports = {
  getUserDisplayName,
  getShippingCity,
  getActiveUserEmail,
  getFeatureFlag,
  processItems,
  formatPrice,
  getLatestEntry,
  parseConfig,
};
EOF
