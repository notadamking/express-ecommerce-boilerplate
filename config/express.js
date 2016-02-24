var express = require('express'),
    glob = require('glob'),

    favicon = require('serve-favicon'),
    logger = require('morgan'),
    dotenv = require('dotenv').config(),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    compress = require('compression'),
    methodOverride = require('method-override'),
    passport = require('passport'),
    helmet = require('helmet'),
    moment = require('moment'),
    session = require('express-session'),
    exphbs = require('express-handlebars'),
    MongoStore = require('connect-mongo')(session),
    flash = require('connect-flash'),
    path = require('path'),
    User = require('../app/models/user');

module.exports = function(app, config) {
  var env = process.env.NODE_ENV || 'development';
  app.locals.ENV = env;
  app.locals.ENV_DEVELOPMENT = env == 'development';

  var hbs = exphbs.create({
    extname: '.hbs',
    layoutsDir: config.root + '/app/views/layouts/',
    defaultLayout: 'main',
    partialsDir: [config.root + '/app/views/partials/'],
    helpers: {
      exists: function(variable, options) {
        if (typeof variable != 'undefined' && variable != 'undefined') {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
      },
      ifCond: function (v1, operator, v2, options) {
        switch (operator) {
            case '!=':
              return (v1 != v2) ? options.fn(this) : options.inverse(this);
            case '!==':
              return (v1 !== v2) ? options.fn(this) : options.inverse(this);
            case '==':
                return (v1 == v2) ? options.fn(this) : options.inverse(this);
            case '===':
                return (v1 === v2) ? options.fn(this) : options.inverse(this);
            case '<':
                return (v1 < v2) ? options.fn(this) : options.inverse(this);
            case '<=':
                return (v1 <= v2) ? options.fn(this) : options.inverse(this);
            case '>':
                return (v1 > v2) ? options.fn(this) : options.inverse(this);
            case '>=':
                return (v1 >= v2) ? options.fn(this) : options.inverse(this);
            case '&&':
                return (v1 && v2) ? options.fn(this) : options.inverse(this);
            case '||':
                return (v1 || v2) ? options.fn(this) : options.inverse(this);
            default:
                return options.inverse(this);
          }
      },
      encode: function(string) {
        return encodeURIComponent(string);
      },
      fmt_price: function(price) {
        return '$' + (price / 100).toFixed(2);
      },
      fmt_date: function(date) {
        return moment(date).format('MM-DD-YYYY');
      }
    }
  });

  // view engine setup
  app.engine('.hbs', hbs.engine);
  app.set('views', path.join(config.root + '/app/views'));
  app.set('view engine', '.hbs');

  //app.use(favicon(config.root + '/public/img/favicon.ico'));
  app.use(logger('dev'));

  //implement necessary security features
  app.use(helmet());

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(methodOverride('_method'));
  app.use(compress());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    store: new MongoStore({
      url: config.db
    }),
    resave: false,
    saveUninitialized: true
  }));
  app.use(flash());

  app.use(express.static(config.root + '/public'));

  // Configure passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  require('./passport')(app, passport);

  app.use(function(req, res, next) {
    res.locals.messages = req.flash();
    res.locals.user = req.user;
    next();
  });

  var controllers = glob.sync(config.root + '/app/controllers/*.js');
  controllers.forEach(function (controller) {
    require(controller)(app);
  });

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  if(app.get('env') === 'development'){
    app.use(function (err, req, res, next) {
      res.status(err.status || 500);
      res.render({
        message: err.message,
        error: err,
        title: 'error'
      });
    });
  }

  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
      res.render({
        message: err.message,
        error: {},
        title: 'error'
      });
  });
};
