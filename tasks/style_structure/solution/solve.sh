#!/bin/bash
set -euo pipefail

cat > handler.js << 'EOF'
function calculateItemTotal(item) {
  let itemTotal = item.price * item.quantity;
  if (item.discount) {
    if (item.discount <= 0 || item.discount > 100) {
      return { error: 'Invalid discount for item ' + item.name };
    }
    const discountAmount = itemTotal * (item.discount / 100);
    return { total: itemTotal - discountAmount, discount: discountAmount };
  }
  return { total: itemTotal, discount: 0 };
}

function validateItem(item) {
  if (item.price <= 0) return 'Invalid price for item ' + item.name;
  if (item.quantity <= 0) return 'Invalid quantity for item ' + item.name;
  return null;
}

function calculateTax(total, country, state) {
  if (country === 'US') {
    if (state === 'CA') return total * 0.0725;
    if (state === 'NY') return total * 0.08;
    return total * 0.05;
  }
  if (country === 'UK') return total * 0.20;
  if (country === 'DE') return total * 0.19;
  return total * 0.10;
}

function calculateShipping(total, express) {
  let shipping = total > 100 ? 0 : total > 50 ? 5.99 : 9.99;
  if (express) shipping += 15;
  return shipping;
}

function processOrder(order) {
  if (!order) return { success: false, errors: ['No order provided'] };
  if (!order.items || order.items.length === 0) return { success: false, errors: ['No items in order'] };

  let total = 0;
  let discountedTotal = 0;
  const errors = [];

  for (const item of order.items) {
    const validationError = validateItem(item);
    if (validationError) { errors.push(validationError); continue; }
    const result = calculateItemTotal(item);
    if (result.error) { errors.push(result.error); continue; }
    total += result.total;
    discountedTotal += result.discount;
  }

  if (errors.length > 0) return { success: false, errors };

  const tax = calculateTax(total, order.country, order.state);
  const shipping = calculateShipping(total, order.express);

  return {
    success: true,
    subtotal: total,
    discount: discountedTotal,
    tax,
    shipping,
    total: total + tax + shipping,
  };
}

function formatReceipt(orderResult) {
  if (!orderResult) return 'No result to format';
  if (!orderResult.success) return formatErrors(orderResult.errors);
  return formatSuccess(orderResult);
}

function formatErrors(errors) {
  const lines = ['=== ERRORS ==='];
  for (const error of errors) lines.push('- ' + error);
  lines.push('===============');
  return lines.join('\n');
}

function formatSuccess(result) {
  const lines = ['=== RECEIPT ==='];
  lines.push('Subtotal: $' + result.subtotal.toFixed(2));
  if (result.discount > 0) lines.push('Discount: -$' + result.discount.toFixed(2));
  lines.push('Tax: $' + result.tax.toFixed(2));
  if (result.shipping > 0) lines.push('Shipping: $' + result.shipping.toFixed(2));
  lines.push('---');
  lines.push('Total: $' + result.total.toFixed(2));
  lines.push('===============');
  return lines.join('\n');
}

module.exports = { processOrder, formatReceipt };
EOF
