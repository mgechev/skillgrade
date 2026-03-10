FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Poorly structured code
RUN cat > handler.js << 'EOF'
function processOrder(order) {
  if (order) {
    if (order.items && order.items.length > 0) {
      let total = 0;
      let discountedTotal = 0;
      let errors = [];
      for (let i = 0; i < order.items.length; i++) {
        if (order.items[i].price > 0) {
          if (order.items[i].quantity > 0) {
            let itemTotal = order.items[i].price * order.items[i].quantity;
            if (order.items[i].discount) {
              if (order.items[i].discount > 0 && order.items[i].discount <= 100) {
                let discountAmount = itemTotal * (order.items[i].discount / 100);
                itemTotal = itemTotal - discountAmount;
                discountedTotal += discountAmount;
              } else {
                errors.push('Invalid discount for item ' + order.items[i].name);
              }
            }
            total += itemTotal;
          } else {
            errors.push('Invalid quantity for item ' + order.items[i].name);
          }
        } else {
          errors.push('Invalid price for item ' + order.items[i].name);
        }
      }
      if (errors.length > 0) {
        return { success: false, errors: errors };
      }
      let tax = 0;
      if (order.country === 'US') {
        if (order.state === 'CA') {
          tax = total * 0.0725;
        } else if (order.state === 'NY') {
          tax = total * 0.08;
        } else {
          tax = total * 0.05;
        }
      } else if (order.country === 'UK') {
        tax = total * 0.20;
      } else if (order.country === 'DE') {
        tax = total * 0.19;
      } else {
        tax = total * 0.10;
      }
      let shipping = 0;
      if (total > 100) {
        shipping = 0;
      } else if (total > 50) {
        shipping = 5.99;
      } else {
        shipping = 9.99;
      }
      if (order.express) {
        shipping += 15;
      }
      return {
        success: true,
        subtotal: total,
        discount: discountedTotal,
        tax: tax,
        shipping: shipping,
        total: total + tax + shipping,
      };
    } else {
      return { success: false, errors: ['No items in order'] };
    }
  } else {
    return { success: false, errors: ['No order provided'] };
  }
}

function formatReceipt(orderResult) {
  if (orderResult) {
    if (orderResult.success) {
      let lines = [];
      lines.push('=== RECEIPT ===');
      lines.push('Subtotal: $' + orderResult.subtotal.toFixed(2));
      if (orderResult.discount > 0) {
        lines.push('Discount: -$' + orderResult.discount.toFixed(2));
      }
      lines.push('Tax: $' + orderResult.tax.toFixed(2));
      if (orderResult.shipping > 0) {
        lines.push('Shipping: $' + orderResult.shipping.toFixed(2));
      }
      lines.push('---');
      lines.push('Total: $' + orderResult.total.toFixed(2));
      lines.push('===============');
      return lines.join('\n');
    } else {
      let errorLines = ['=== ERRORS ==='];
      for (let i = 0; i < orderResult.errors.length; i++) {
        errorLines.push('- ' + orderResult.errors[i]);
      }
      errorLines.push('===============');
      return errorLines.join('\n');
    }
  } else {
    return 'No result to format';
  }
}

module.exports = { processOrder, formatReceipt };
EOF

# Tests
RUN cat > test_check.js << 'TESTEOF'
const fs = require('fs');
const source = fs.readFileSync('handler.js', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Correctness: processOrder should produce same results
const { processOrder, formatReceipt } = require('./handler');

const order1 = {
  items: [{ name: 'A', price: 10, quantity: 2, discount: 10 }, { name: 'B', price: 20, quantity: 1 }],
  country: 'US', state: 'CA'
};
const r1 = processOrder(order1);
assert(r1.success === true, 'Order 1 succeeds');
assert(Math.abs(r1.subtotal - 38) < 0.01, 'Order 1 subtotal = 38');
assert(Math.abs(r1.tax - 2.755) < 0.01, 'Order 1 tax correct');
assert(r1.shipping === 9.99, 'Order 1 shipping = 9.99');

const r2 = processOrder(null);
assert(r2.success === false, 'Null order fails');

const r3 = processOrder({ items: [] });
assert(r3.success === false, 'Empty items fails');

const r4 = processOrder({ items: [{ name: 'X', price: -1, quantity: 1 }], country: 'US', state: 'NY' });
assert(r4.success === false && r4.errors.length > 0, 'Invalid price caught');

// Formatting
const receipt = formatReceipt(r1);
assert(receipt.includes('RECEIPT'), 'Receipt has header');
assert(receipt.includes('Total: $'), 'Receipt has total');

// Structure checks
const functions = source.match(/function\s+\w+/g) || [];
assert(functions.length >= 4, 'At least 4 named functions (code was split)');

// Check nesting depth - count max consecutive indentation
const lines = source.split('\n');
let maxIndent = 0;
for (const line of lines) {
  const match = line.match(/^(\s*)/);
  if (match) {
    const indent = match[1].replace(/\t/g, '  ').length / 2;
    if (indent > maxIndent) maxIndent = indent;
  }
}
assert(maxIndent <= 5, 'Max nesting depth <= 5 levels');

// Check no single function is too long
const funcBodies = source.split(/\nfunction |\nconst \w+ = /);
let maxFuncLength = 0;
for (const body of funcBodies) {
  const bodyLines = body.split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  if (bodyLines.length > maxFuncLength) maxFuncLength = bodyLines.length;
}
assert(maxFuncLength <= 30, 'No function exceeds 30 lines');

// Exports still work
assert(typeof processOrder === 'function', 'processOrder exported');
assert(typeof formatReceipt === 'function', 'formatReceipt exported');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
