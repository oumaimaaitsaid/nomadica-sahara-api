const test = require('node:test');
const assert = require('node:assert/strict');
const { registerPartnerSchema, loginPartnerSchema } = require('../src/schemas/authSchema');

test('registerPartnerSchema trims and lowercases email', () => {
  const result = registerPartnerSchema.parse({
    firstName: '  Amina  ',
    lastName: '  Sahara  ',
    email: ' PARTNER@EXAMPLE.COM ',
    password: 'supersecret123',
  });

  assert.equal(result.email, 'partner@example.com');
  assert.equal(result.firstName, 'Amina');
  assert.equal(result.lastName, 'Sahara');
});

test('loginPartnerSchema trims and lowercases email', () => {
  const result = loginPartnerSchema.parse({
    email: ' PARTNER@EXAMPLE.COM ',
    password: 'supersecret123',
  });

  assert.equal(result.email, 'partner@example.com');
});
