#!/bin/bash
set -euo pipefail

cat > utils.js << 'EOF'
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT = 5000;

class UserManager {
  constructor() {
    this.userList = [];
    this.activeCount = 0;
  }

  addUser(userName, userEmail) {
    const newUser = {
      userName: userName,
      userEmail: userEmail,
      isActive: true,
    };
    this.userList.push(newUser);
    this.activeCount++;
    return newUser;
  }

  getUserByName(targetName) {
    return this.userList.find(u => u.userName === targetName);
  }

  removeUser(userName) {
    const userIndex = this.userList.findIndex(u => u.userName === userName);
    if (userIndex !== -1) {
      if (this.userList[userIndex].isActive) {
        this.activeCount--;
      }
      this.userList.splice(userIndex, 1);
      return true;
    }
    return false;
  }

  getActiveUsers() {
    return this.userList.filter(u => u.isActive);
  }
}

function calculateAverage(numberArray) {
  if (numberArray.length === 0) return 0;
  const totalSum = numberArray.reduce((acc, val) => acc + val, 0);
  return totalSum / numberArray.length;
}

function formatUserName(firstName, lastName) {
  return `${firstName} ${lastName}`;
}

const isValidEmail = (emailString) => {
  return emailString.includes('@') && emailString.includes('.');
};

module.exports = {
  MAX_RETRY_COUNT,
  API_BASE_URL,
  DEFAULT_TIMEOUT,
  UserManager,
  calculateAverage,
  formatUserName,
  isValidEmail,
};
EOF
