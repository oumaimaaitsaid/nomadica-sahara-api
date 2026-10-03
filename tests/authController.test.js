const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const mockAuthService = {
  loginWithEmail: async () => ({ data: {}, error: null }),
  registerPartner: async () => ({ data: {}, error: null }),
  getGoogleAuthUrl: async () => ({
    url: 'https://syzkdilyxjojxklchicj.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback',
  }),
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === '../services/authService' ||
    request === './src/services/authService' ||
    request === path.resolve(__dirname, '../src/services/authService')
  ) {
    return mockAuthService;
  }

  return originalLoad.apply(this, arguments);
};

try {
  test('googleLogin returns the Google OAuth URL', async () => {
    delete require.cache[require.resolve('../src/controllers/authController')];
    const { googleLogin } = require('../src/controllers/authController');

    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    await googleLogin({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.match(res.payload.url, /provider=google/);
    assert.match(res.payload.url, /redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback/);
  });
} finally {
  Module._load = originalLoad;
}
