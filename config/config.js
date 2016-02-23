var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development',
    secret_token = '13b8bfa3-925e-42f9-bbaf-a28f0448c0dd',
    braintree_merchant_id = '37rkyn2n5tszjskc', //sandbox
    braintree_public_key = 'kqdb8hgwrh6xt582', //sandbox
    braintree_private_key = '1bd6b731bf7a3d8d79dfd97455c8aa95', //sandbox
    sendgrid_api_key = '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';

var config = {
  development: {
    root: rootPath,
    secret: secret_token,
    braintree_merchant_id: braintree_merchant_id,
    braintree_public_key: braintree_public_key,
    braintree_private_key: braintree_private_key,
    sendgrid_api_key: sendgrid_api_key,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-development'
  },

  test: {
    root: rootPath,
    secret: secret_token,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-test'
  },

  production: {
    root: rootPath,
    secret: secret_token,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-production'
  }
};

module.exports = config[env];
