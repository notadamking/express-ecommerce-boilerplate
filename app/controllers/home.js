var router = require('express').Router(),
  passport = require('passport'),
  sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY),
  mongoose = require('mongoose'),
  User = mongoose.model('User');

module.exports = function (app) {
  app.use('/', router);
};

router.get('/', function (req, res, next) {
  User.find(function (err, users) {
    if (err) return next(err);
    res.render('index', {
      title: 'Home',
      users: users
    });
  });
});

router.get('/register', function(req, res, next) {
  res.render('register', {
    title: 'Register'
  });
});

router.post('/register', function(req, res, next) {
  User.register(new User({
    username: req.body.username,
    email: req.body.email,
    admin: req.body.admin
  }), req.body.password, function(err, user) {
    if(err && err.name != 'UserExistsError') {
      console.log('Error while registering new user: ', err);
      return next(err);
    } else if(err) {
      req.flash('error', 'An account has already been registered with that email address.');
      return res.redirect('/register');
    }
    var confirm_email_link = 'http://localhost:3000/user/confirm_email?token=' + user.confirm_email_token;
    sendgrid.send({
      to: user.email,
      from: 'support@localhost',
      subject: 'Confirm Email Address',
      html: '<body><a href="' + confirm_email_link + '">Confirm Email Address</a></body>'
    }, function(err) {
      if(err) console.log("Error sending account activation email. ", err);
    });
    // log the user in after successful registration
    passport.authenticate('local')(req, res, function() {
      req.user.getCheckoutToken(function(err, token) {
        if(err) return next(err);
        if(token) req.session.checkout_token = token;
        req.flash('success', 'Successfully registered a new account. A confirmation email has been sent to ' + user.email + '.');
        res.redirect('/');
      });
    });
  });
});

router.get('/login', function(req, res, next) {
  if(req.user) {
    res.redirect('/');
  } else {
    res.render('login', {
      title: 'Login',
      save_cart_id: req.query.save_cart_id
    });
  }
});

router.post('/login', passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res, next) {
  req.user.getCheckoutToken(function(err, token) {
    if(err) return next(err);
    if(token) req.session.checkout_token = token;
  });
  if(req.query.save_cart_id && req.query.save_cart_id != '') {
    req.user.cart.addGuestCart(req.query.save_cart_id, function(err) {
      if(err) return next(err);
      req.session.cart_id = undefined;
      res.redirect('/cart');
    });
  } else {
    res.redirect('/');
  }
});

router.get('/auth/facebook', function(req, res, next) {
  req.session.return_to = req.query.return_to;
  console.log("in /auth/facebook, returnTo = " + req.session.return_to);
  passport.authenticate('facebook')(req, res, next);
});

router.get('/auth/facebook/callback', passport.authenticate('facebook', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res, next) {
  req.user.getCheckoutToken(function(err, token) {
    if(err) return next(err);
    console.log("\nToken: ", token);
    if(token) req.session.checkout_token = token;
    var redirect = req.session.redirect_to || '/';
    delete req.session.redirect_to;
    res.redirect(redirect);
  });
});

router.get('/auth/twitter', function(req, res, next) {
  req.session.return_to = req.query.return_to;
  console.log("in /auth/twitter, returnTo = " + req.session.return_to);
  passport.authenticate('twitter')(req, res, next);
});

router.get('/auth/twitter/callback', passport.authenticate('twitter', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res, next) {
  req.user.getCheckoutToken(function(err, token) {
    if(err) return next(err);
    if(token) req.session.checkout_token = token;
    res.redirect(req.session.redirect_to || '/');
    delete req.session.redirect_to;
  });
});

router.get('/auth/google', function(req, res, next) {
    req.session.return_to = req.query.return_to;
    console.log("in /auth/google, returnTo = " + req.session.return_to);
    passport.authenticate('google', {
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    })(req, res, next);
});

router.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res, next) {
  req.user.getCheckoutToken(function(err, token) {
    if(err) return next(err);
    if(token) req.session.checkout_token = token;
    res.redirect(req.session.redirect_to || '/');
    delete req.session.redirect_to;
  });
});

router.get('/logout', function(req, res, next) {
  if(req.isAuthenticated()) {
    req.logout();
    req.flash('info', 'You have been logged out successfully.');
  }
  res.redirect('/');
});

router.get('/admin', function(req, res, next) {
  if(!req.user || !req.user.admin) {
    res.redirect('/');
  }
  res.render('admin/dashboard', {
    title: 'Admin Dashboard'
  });
});

router.get('/orders', function(req, res, next) {
  Order
    .findById(req.query.order_id)
    .populate('shipping.address')
    .populate('billing.address')
    .exec(function(err, order) {
      res.render('user/order', {
        title: 'Order - ' + order.id,
        order: order
      });
    });
});
