FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Module with naming convention violations
RUN cat > utils.js << 'EOF'
const max_retry_count = 3;
const api_base_url = 'https://api.example.com';
const Default_Timeout = 5000;

class user_manager {
  constructor() {
    this.User_List = [];
    this.active_count = 0;
  }

  Add_User(user_name, user_email) {
    const New_User = {
      user_name: user_name,
      user_email: user_email,
      Is_Active: true,
    };
    this.User_List.push(New_User);
    this.active_count++;
    return New_User;
  }

  get_user_by_name(Target_Name) {
    return this.User_List.find(u => u.user_name === Target_Name);
  }

  Remove_User(user_name) {
    const user_index = this.User_List.findIndex(u => u.user_name === user_name);
    if (user_index !== -1) {
      if (this.User_List[user_index].Is_Active) {
        this.active_count--;
      }
      this.User_List.splice(user_index, 1);
      return true;
    }
    return false;
  }

  get_Active_Users() {
    return this.User_List.filter(u => u.Is_Active);
  }
}

function Calculate_Average(number_array) {
  if (number_array.length === 0) return 0;
  const Total_Sum = number_array.reduce((acc, val) => acc + val, 0);
  return Total_Sum / number_array.length;
}

function format_user_name(First_Name, Last_Name) {
  return `${First_Name} ${Last_Name}`;
}

const is_valid_email = (email_string) => {
  return email_string.includes('@') && email_string.includes('.');
};

module.exports = {
  max_retry_count,
  api_base_url,
  Default_Timeout,
  user_manager,
  Calculate_Average,
  format_user_name,
  is_valid_email,
};
EOF

# Tests
RUN cat > test_check.js << 'TESTEOF'
const fs = require('fs');
const source = fs.readFileSync('utils.js', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Constants should be UPPER_SNAKE_CASE
assert(source.includes('MAX_RETRY_COUNT') || source.includes('MAX_RETRIES'), 'max_retry_count -> UPPER_SNAKE_CASE');
assert(source.includes('API_BASE_URL'), 'api_base_url -> UPPER_SNAKE_CASE');
assert(source.includes('DEFAULT_TIMEOUT'), 'Default_Timeout -> UPPER_SNAKE_CASE');

// Class should be PascalCase
assert(source.includes('class UserManager') || source.includes('class UserManager '), 'user_manager -> UserManager');

// Methods should be camelCase
assert(source.includes('addUser'), 'Add_User -> addUser');
assert(source.includes('getUserByName'), 'get_user_by_name -> getUserByName');
assert(source.includes('removeUser'), 'Remove_User -> removeUser');
assert(source.includes('getActiveUsers'), 'get_Active_Users -> getActiveUsers');

// Functions should be camelCase
assert(source.includes('calculateAverage'), 'Calculate_Average -> calculateAverage');
assert(source.includes('formatUserName'), 'format_user_name -> formatUserName');
assert(source.includes('isValidEmail'), 'is_valid_email -> isValidEmail');

// Variables inside functions should be camelCase
assert(!source.includes('Total_Sum'), 'Total_Sum -> totalSum');
assert(!source.includes('New_User'), 'New_User -> newUser');
assert(!source.includes('Target_Name'), 'Target_Name -> targetName');
assert(!source.includes('First_Name'), 'First_Name -> firstName');
assert(!source.includes('user_index'), 'user_index -> userIndex');

// Properties should be camelCase
assert(!source.includes('User_List'), 'User_List -> userList or users');
assert(!source.includes('Is_Active'), 'Is_Active -> isActive');
assert(!source.includes('user_name') || source.match(/user_name/g).length <= 0, 'user_name -> userName or name');

// Module still exports correctly
try {
  const mod = require('./utils');
  assert(typeof mod.calculateAverage === 'function' || typeof mod.Calculate_Average === 'function', 'calculateAverage is exported');
  assert(typeof mod.formatUserName === 'function' || typeof mod.format_user_name === 'function', 'formatUserName is exported');
} catch (e) {
  assert(false, 'Module loads without error: ' + e.message);
}

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
