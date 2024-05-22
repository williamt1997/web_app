const crypto = require('crypto');

const generateJWTSecretKey = () => {
  return crypto.randomBytes(32).toString('hex');
}

console.log(generateJWTSecretKey());