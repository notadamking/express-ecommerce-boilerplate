var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env = process.env.NODE_ENV || 'development';

var config = {
  development: {
    root: rootPath,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-development'
  },

  test: {
    root: rootPath,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-test'
  },

  production: {
    root: rootPath,
    app: {
      name: 'usersystem'
    },
    port: 3000,
    db: 'mongodb://localhost/usersystem-production'
  }
};

module.exports = config[env];
