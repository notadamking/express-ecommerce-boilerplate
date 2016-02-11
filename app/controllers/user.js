var express = require('express'),
    router = express.Router(),
    uuid = require('node-uuid'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Order = mongoose.model('Order'),
    Address = mongoose.model('Address');

module.exports = function (app) {
  app.use('/', router);
};

/* Endpoint to request a user's password to be reset */
router.get('/user/forgotten_password', function(req, res, next) {
  res.render('user/forgotten_password', {
    title: 'Reset Password',
    email: decodeURIComponent(req.query.email)
  });
});

/* Endpoint to post a user's password reset request */
router.post('/user/forgotten_password', function(req, res, next) {
  var email = req.body.email;
  var expires = new Date();
  expires.setDate(expires.getDate() + 1);
  var token = uuid.v4();
  User.findOneAndUpdate({ email: email }, {
    password_reset_token: token,
    password_reset_expiration: expires
  }, function(err, user) {
    if(err) return next(err);
    if(!user) {
      req.flash('info', 'That email address is not registered to any user.');
      return res.redirect('/user/forgotten_password');
    }
    var temp_link = '/user/reset_password?token=' + token;
    var link = '/user/reset_instructions?email=' + encodeURIComponent(email)
                + '&temp_link=' + temp_link;
    res.redirect(link);
  });
});

/* Endpoint to instruct a user on how to finish resetting their password */
router.get('/user/reset_instructions', function(req, res, next) {
  res.render('user/reset_instructions', {
    title: 'Reset Instructions',
    email: decodeURIComponent(req.query.email),
    temp_reset_link: req.query.temp_link // TODO REMOVE FOR PRODUCTION
  });
});

/* Endpoint to instruct a user on how to finish resetting their password */
router.get('/user/reset_password', function(req, res, next) {
  var token = req.query.token;
  if(!token) {
    res.redirect('/');
  }
  User.findOne({ password_reset_token: token }, function (err, user) {
    if(err) return next(err);
    var date = new Date();
    if(!user) {
      req.flash('info', 'Invalid password reset token.');
      res.redirect('/');
    } else if(date > user.password_reset_expiration) {
      req.flash('info', 'Password reset token has expired.');
      res.redirect('/');
    } else {
      res.render('user/reset_password', {
        title: 'Reset Password',
        token: token
      });
    }
  });
});

router.post('/user/reset_password', function(req, res, next) {
  var token = req.body.token;
  var new_password = req.body.new_password;
  var new_password_again = req.body.new_password_again;
  if(new_password !== new_password_again) {
    req.flash('info', 'Passwords do not match.');
    res.redirect('/user/reset_password?token=' + token);
  } else {
    User.findOne({ password_reset_token: token }, function (err, user) {
      if(err) return next(err);
      var date = new Date();
      if(!user) {
        req.flash('info', 'Invalid password reset token.');
        res.redirect('/');
      } else if(date > user.password_reset_expiration) {
        req.flash('info', 'Password reset token has expired.');
        res.redirect('/');
      } else {
        user.setPassword(new_password, function(err, user, password_err) {
          user.password_reset_token = '';
          user.save(function(err) {
            req.flash('info', 'Your password has successfully been changed.');
            req.logIn(user, function(err) {
              if (err) return next(err);
              return res.redirect('/user/profile');
            });
          });
        });
      }
    });
  }
});

/* Require user session to access all /user/ routes */
router.all('/user/*', function(req, res, next) {
  if(!req.user) {
    req.flash('info', 'You are not logged in.');
    return res.redirect('/');
  }
  next();
});

/* Endpoint to view a user's profile */
router.get('/user/profile', function(req, res, next) {
  res.render('user/profile', {
    title: 'User Profile'
  });
});

/* Endpoint to post a new user profile */
router.post('/user/profile', function(req, res, next) {

});

/* Endpoint to edit a user's profile */
router.put('/user/profile', function(req, res, next) {
  var email = req.body.email;
  req.user.email = email;
  req.user.save(function(err) {
    if(err) return next(err);
    req.login(req.user, function(err) {
      if(err) return next(err);
      req.flash('info', 'Successfully updated user profile.');
      res.redirect('/user/profile');
    });
  });
});

/* Endpoint to view a user's saved addresses */
router.get('/user/addresses', function(req, res, next) {
  res.render('user/addresses', {
    title: "User Addresses",
    addresses: req.user.addresses
  });
});

/* Endpoint to post a new address for a user */
router.post('/user/addresses', function(req, res, next) {
  var address = new Address({
    nickname: req.body.nickname,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    street_line_1: req.body.street_line_1,
    street_line_2: req.body.street_line_2,
    city: req.body.city,
    state: req.body.state,
    zip_code: req.body.zip_code,
    country: req.body.country
  });
  address.save(function(err) {
    if(err) return next(err);
    req.user.addAddress(address, req.body.default_address, function(err) {
      if(err) return next(err);
      res.redirect('/user/addresses');
    });
  });
});

/* Endpoint to edit an address for a user */
router.put('/user/addresses/:address_id', function(req, res, next) {
  var address = {
    id: req.params.address_id,
    nickname: req.body.nickname,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    street_line_1: req.body.street_line_1,
    street_line_2: req.body.street_line_2,
    city: req.body.city,
    state: req.body.state,
    zip_code: req.body.zip_code,
    country: req.body.country
  };
  req.user.updateAddress(address, req.body.default_address, function(err) {
    if(err) return next(err);
    res.redirect('/user/addresses');
  });
});

/* Endpoint to delete an address for a user */
router.delete('/user/addresses/:address_id', function(req, res, next) {
  req.user.removeAddress(req.params.address_id, function(err) {
    if(err) return next(err);
    res.redirect('/user/addresses');
  });
});

/* Endpoint to view a user's orders */
router.get('/user/orders', function(req, res, next) {
  User
    .findById(req.user.id)
    .populate({
      path: 'orders',
      match: {
        status: {
          $ne: 'unpaid' // Only select orders if status != 'unpaid'
        }
      }
    })
    .exec(function(err, user) {
      res.render('user/orders', {
        title: "User Orders",
        orders: user.orders
      });
    });
});

/* Endpoint to post a new order */
router.post('/user/orders', function(req, res, next) {
  var order = new Order({
    cart: req.body.cart_id,
    user: req.user.id,
    email: req.user.email,
    currency: req.body.currency || 'USD',
    status: req.body.status || 'unpaid'
  });
  order.save(function(err) {
    if(err) return next(err);
    user.addOrder(order, function(err) {
      if(err) return next(err);
    });
  });
});

/* Endpoint to view an order by order id */
router.get('/user/orders/:order_id', function(req, res, next) {
  Order.findOne({ user: req.user.id, _id: req.params.order_id }, function(err, order) {
    if(err) return next(err);
    if(!order) {
      req.flash('error', 'No order with that order id found for that user.');
      res.redirect('/user/orders');
    } else {
      res.render('user/order', {
        title: 'Order #' + req.params.order_id,
        order: order
      });
    }
  });
});

/* Endpoint to edit an order */
router.put('/user/orders/:order_id', function(req, res, next) {
  var order = {
    id: req.params.order_id,
    cart: req.body.cart_id,
    user: req.user.id,
    email: req.body.email,
    currency: req.body.currency || 'USD',
    status: req.body.status || 'unpaid'
  };
  req.user.updateOrder(order, function(err) {
    if(err) return next(err);
    res.redirect('/user/orders');
  });
});

/* Endpoint to remove order (should not be used normally) */
router.delete('/user/orders/:order_id', function(req, res, next) {
  req.user.removeOrder(req.params.order_id, function(err) {
    res.redirect('/user/orders');
  });
});

/* Endpoint for a user to change their password */
router.get('/user/change_password', function(req, res, next) {
  res.render('user/change_password', {
    title: 'Change Password'
  });
});

/* Endpoint to post a user's password change */
router.post('/user/change_password', function(req, res, next) {
  var current_password = req.body.current_password;
  var new_password = req.body.new_password;
  var new_password_again = req.body.new_password_again;
  if(new_password !== new_password_again) {
    req.flash('info', 'Passwords do not match.');
    res.redirect('/user/change_password');
  }
  req.user.authenticate(current_password, function(err, user, password_err) {
    if(err) return next(err);
    if(!user) {
      req.flash('info', 'Incorrect password.');
      res.redirect('/user/change_password');
    } else {
      user.setPassword(new_password, function(err, user, password_err) {
        user.save(function(err) {
          if(err) return next(err);
          req.flash('info', 'Your password has successfully been changed.');
          res.redirect('/user/change_password');
        });
      });
    }
  });
});
