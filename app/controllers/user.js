var express = require('express'),
  router = express.Router(),
  uuid = require('node-uuid'),
  sendgrid = require('sendgrid')(process.env.SENGRID_API_KEY),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Order = mongoose.model('Order'),
  Address = mongoose.model('Address'),
  braintree = require('braintree'),
  gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.MERCHANT_ID,
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY
  });

module.exports = function(app) {
  app.use('/', router);
};

/* Endpoint to confirm a user's email address */
router.get('/user/confirm_email', function(req, res, next) {
  var token = req.query.token;
  if (!token) {
    res.redirect('/');
  }
  User.findOneAndUpdate({
      confirm_email_token: token
    }, {
      confirmed_email: true
    },
    function(err, user) {
      if (err)
        return next(err);
      if (!user) {
        req.flash('info', 'Invalid email confirmation token.');
        res.redirect('/');
      } else {
        res.render('user/confirmed_email', {
          title: 'Email Confirmed'
        });
      }
    });
});

/* Endpoint to request a user's password to be reset */
router.get('/user/password/forgot', function(req, res, next) {
  res.render(
    'user/password/forgot', {
      title: 'Reset Password',
      email: decodeURIComponent(req.query.email)
    });
});

/* Endpoint to post a user's password reset request */
router.post('/user/password/forgot', function(req, res, next) {
  var email = req.body.email;
  var expires = new Date();
  expires.setDate(expires.getDate() + 1);
  var token = uuid.v4();
  User.findOneAndUpdate({
      email: email
    }, {
      password_reset_token: token,
      password_reset_expiration: expires
    },
    function(err, user) {
      if (err)
        return next(err);
      if (!user) {
        req.flash('info',
          'That email address is not registered to any user.');
        return res.redirect('/user/password/forgot');
      }
      var reset_link =
        'http://localhost:3000/user/password/reset?token=' + token;
      sendgrid.send({
          to: email,
          from: 'support@localhost',
          subject: 'Password Reset Request',
          html: '<body><a href="' + reset_link +
            '">Reset your password</a></body>'
        },
        function(err) {
          if (err)
            return next(err);
          res.redirect(
            '/user/password/reset_instructions?email=' +
            encodeURIComponent(email));
        });
    });
});

/* Endpoint to instruct a user on how to finish resetting their password */
router.get('/user/password/reset_instructions', function(req, res, next) {
  res.render('user/password/reset_instructions', {
    title: 'Reset Instructions',
    email: decodeURIComponent(req.query.email)
  });
});

/* Endpoint to instruct a user on how to finish resetting their password */
router.get('/user/password/reset', function(req, res, next) {
  var token = req.query.token;
  if (!token) {
    res.redirect('/');
  }
  User.findOne({
    password_reset_token: token
  }, function(err, user) {
    if (err)
      return next(err);
    var date = new Date();
    if (!user) {
      req.flash('info', 'Invalid password reset token.');
      res.redirect('/');
    } else if (date > user.password_reset_expiration) {
      req.flash('info', 'Password reset token has expired.');
      res.redirect('/');
    } else {
      res.render('user/password/reset', {
        title: 'Reset Password',
        token: token
      });
    }
  });
});

/* Endpoint to post a user's new password for reset */
router.post('/user/password/reset', function(req, res, next) {
  var token = req.body.token;
  var new_password = req.body.new_password;
  var new_password_again = req.body.new_password_again;
  if (new_password !== new_password_again) {
    req.flash('info', 'Passwords do not match.');
    res.redirect('/user/password/reset?token=' + token);
  } else {
    User.findOne({
      password_reset_token: token
    }, function(err, user) {
      if (err)
        return next(err);
      var date = new Date();
      if (!user) {
        req.flash('info', 'Invalid password reset token.');
        res.redirect('/');
      } else if (date > user.password_reset_expiration) {
        req.flash('info', 'Password reset token has expired.');
        res.redirect('/');
      } else {
        user.setPassword(new_password, function(err, user, password_err) {
          user.password_reset_token = '';
          user.save(function(err) {
            req.flash('info', 'Your password has successfully been changed.');
            sendgrid.send({
                to: user.email,
                from: 'support@localhost',
                subject: 'Password Reset Complete',
                html: '<body><p>Your password has successfully been changed.</p></body>'
              },
              function(err) {
                if (err)
                  console.log(
                    "Error sending password reset success email. ",
                    err);
              });
            req.logIn(user, function(err) {
              if (err)
                return next(err);
              return res.redirect('/user/profile');
            });
          });
        });
      }
    });
  }
});

/*
  ALL ROUTES AFTER THIS POINT REQUIRE THE USER TO BE LOGGED IN TO ACCESS.
  IF THE USER IS NOT LOGGED IN, THEY WILL BE REDIRECTED TO '/'.
*/

/* Require user session to access all /user/ routes */
router.all('/user/*', function(req, res, next) {
  if (!req.user) {
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
    if (err)
      return next(err);
    req.login(req.user, function(err) {
      if (err)
        return next(err);
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
  Address.createNewAddress(req.body, function(err, address) {
    if (err)
      return next(err);
    req.user.addAddress(address, req.body.default_address, function(err) {
      if (err)
        return next(err);
      res.redirect('/user/addresses');
    });
  });
});

/* Endpoint to post a new payment method as default for a user */
router.post('/user/addresses/default', function(req, res, next) {
  req.user.setDefaultAddress(req.body.address_id, function(err) {
    if (err)
      return next(err);
    req.flash('info', 'Successfully set default address.');
    res.redirect('/user/addresses');
  });
});

/* Endpoint to edit an address for a user */
router.put('/user/addresses/:address_id', function(req, res, next) {
  req.body.address_id = req.params.address_id;
  req.user.updateAddress(req.body, req.body.default_address, function(err) {
    if (err)
      return next(err);
    res.redirect('/user/addresses');
  });
});

/* Endpoint to delete an address for a user */
router.delete('/user/addresses/:address_id', function(req, res, next) {
  req.user.removeAddress(req.params.address_id, function(err) {
    if (err)
      return next(err);
    res.redirect('/user/addresses');
  });
});

/* Endpoint to view a user's saved payment methods */
router.get('/user/payment_methods', function(req, res, next) {
  if (req.user.braintree_customer_id) {
    gateway.clientToken.generate({},
      function(err, response) {
        if (err)
          return next(err);
        gateway.customer.find(
          req.user.braintree_customer_id,
          function(err, customer) {
            console.log('\nCustomer: ', customer);
            var default_payment = '';
            for (var i = 0; i < customer.paymentMethods.length; i++) {
              if (customer.paymentMethods[i].default) {
                if (customer.paymentMethods[i].cardType) {
                  default_payment = customer.paymentMethods[i].cardType +
                    ' : ' +
                    customer.paymentMethods[i].maskedNumber;
                } else {
                  default_payment =
                    'PayPal : ' + customer.paymentMethods[i].email;
                }
              }
            }
            res.render('user/payment_methods', {
              title: 'User Payment Methods',
              payment_methods: customer.paymentMethods,
              default_payment: default_payment,
              client_token: response.clientToken
            });
          });
      });
  } else {
    res.render('user/payment_methods', {
      title: 'User Payment Methods'
    });
  }
});

/* Endpoint to post a new payment method as default for a user */
router.post('/user/payment_methods/default', function(req, res, next) {
  gateway.paymentMethod.update(
    req.body.token, {
      options: {
        makeDefault: true
      }
    },
    function(err, result) {
      if (err)
        return next(err);
      if (result.success) {
        req.flash('info', 'Successfully set default payment method.');
        res.redirect('/user/payment_methods');
      } else {
        console.log('\nResult: ', result);
        req.flash('error', 'Could not set default payment method.');
        res.redirect('/user/payment_methods');
      }
    });
});

/* Endpoint to post a new payment method for a user */
router.post('/user/payment_methods', function(req, res, next) {
  if (!req.user.braintree_customer_id) {
    gateway.customer.create({
        paymentMethodNonce: req.body.payment_method_nonce
      },
      function(err, result) {
        if (result.success) {
          req.user.braintree_customer_id = result.customer.id;
          req.user.save(function(err) {
            if (err)
              console.log("Error saving BT customer id to user. ", err);
          });
          gateway.paymentMethod.update(
            result.customer.paymentMethods[0].token, {
              options: {
                makeDefault: true
              }
            },
            function(err, result) {
              if (result.success) {
                req.flash('info', 'Successfully added payment method.');
                res.redirect('/user/payment_methods');
              } else {
                req.flash('error',
                  'Payment method could not be added to customer.');
                res.redirect('/user/payment_methods');
              }
            });
        } else {
          req.flash('error', 'Customer could not be created for user.');
          res.redirect('/user/payment_methods');
        }
      });
  } else {
    gateway.paymentMethod.create({
        customerId: req.user.braintree_customer_id,
        paymentMethodNonce: req.body.payment_method_nonce,
        options: {
          makeDefault: req.body.make_default_payment,
          failOnDuplicatePaymentMethod: true
        }
      },
      function(err, result) {
        if (result.success) {
          req.flash('info', 'Successfully added payment method.');
          res.redirect('/user/payment_methods');
        } else {
          req.flash('error',
            'Payment method could not be added to customer.');
          res.redirect('/user/payment_methods');
        }
      });
  }
});

/* Endpoint to delete a payment method for a user */
router.delete('/user/payment_methods/:token', function(req, res, next) {
  req.user.removePaymentMethod(req.params.token, function(err) {
    if (err)
      return next(err);
    res.redirect('/user/payment_methods');
  });
});

/* Endpoint to view a user's orders */
router.get('/user/orders', function(req, res, next) {
  User.findById(req.user.id)
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
    currency: req.body.currency || 'USD'
  });
  order.save(function(err) {
    if (err)
      return next(err);
    user.addOrder(order, function(err) {
      if (err)
        return next(err);
    });
  });
});

/* Endpoint to view an order by order id */
router.get('/user/orders/:order_id', function(req, res, next) {
  Order.findOne({
    user: req.user.id,
    _id: req.params.order_id
  }, function(err, order) {
    if (err)
      return next(err);
    if (!order) {
      req.flash('error',
        'No order with that order id found for that user.');
      res.redirect('/user/orders');
    } else {
      res.render('user/order', {
        title: 'Order #' + req.params.order_id,
        order: order,
        addresses: req.user.addresses,
        default_address_id: req.user.default_address,
        change_shipping: req.query.change_shipping || undefined
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
    if (err)
      return next(err);
    res.redirect('/user/orders');
  });
});

/* Endpoint to remove order (should almost never be used) */
router.delete('/user/orders/:order_id', function(req, res, next) {
  req.user.removeOrder(req.params.order_id, function(err) {
    if (err)
      return next(err);
    res.redirect('/user/orders');
  });
});

/* Endpoint to post the new address for a user's order */
router.post('/user/orders/:order_id/shipping', function(req, res, next) {
  if (req.body.address_id && req.body.address_id != 'new') {
    Order.update({
      _id: req.params.order_id
    }, {
      shipping: {
        address: req.body.address_id,
        additional_information: req.body.additional_information
      }
    }, function(err) {
      if (err)
        return next(err);
      req.flash('success', 'Successfully changed the shipping address for order #' + req.params.order_id)
      res.redirect('/user/orders/' + req.params.order_id);
    });
  } else {
    Address.createNewAddress(req.body, req.user, function(err, address) {
      if (err)
        return next(err);
      Order.update({
        _id: req.params.order_id
      }, {
        shipping: {
          address: address.id,
          additional_information: req.body.additional_information
        }
      }, function(err) {
        if (err)
          return next(err);
        req.flash('success', 'Successfully changed the shipping address for order #' + req.params.order_id)
        res.redirect('/user/orders/' + req.params.order_id);
      });
    });
  }
});

/* Endpoint for a user to cancel an order */
router.get('/user/orders/:order_id/cancel', function(req, res, next) {
  req.user.cancelOrder(req.params.order_id, function(err, status) {
    if (err)
      return next(err);
    if (status) {
      req.flash(status.type, status.message);
    }
    res.redirect('/user/orders');
  });
});

/* Endpoint for a user to request to return an order */
router.get('/user/orders/:order_id/return', function(req, res, next) {
  req.user.requestOrderReturn(req.params.order_id, function(err, status) {
    if (err)
      return next(err);
    if (status) {
      req.flash(status.type, status.message);
    }
    res.redirect('/user/orders');
  })
});

/* Endpoint for a user to change their password */
router.get('/user/password/change', function(req, res, next) {
  res.render('user/password/change', {
    title: 'Change Password'
  });
});

/* Endpoint to post a user's password change */
router.post('/user/password/change', function(req, res, next) {
  var current_password = req.body.current_password;
  var new_password = req.body.new_password;
  var new_password_again = req.body.new_password_again;
  if (new_password !== new_password_again) {
    req.flash('info', 'Passwords do not match.');
    res.redirect('/user/password/change');
  }
  req.user.authenticate(current_password, function(err, user, password_err) {
    if (err)
      return next(err);
    if (!user) {
      req.flash('info', 'Incorrect password.');
      res.redirect('/user/password/change');
    } else {
      user.setPassword(new_password, function(err, user, password_err) {
        user.save(function(err) {
          if (err)
            return next(err);
          req.flash('info', 'Your password has successfully been changed.');
          res.redirect('/user/profile');
        });
      });
    }
  });
});
