var express = require('express'),
  router = express.Router(),
  uuid = require('node-uuid'),
  sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY),
  mongoose = require('mongoose'),
  User = mongoose.model('User'),
  Order = mongoose.model('Order'),
  Address = mongoose.model('Address'),
  braintree = require('braintree'),
  gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: "nsp7gtrpf3sh3ycy",// process.env.MERCHANT_ID,
    publicKey: "qxgdv667ypkbf84q",//process.env.PUBLIC_KEY,
    privateKey: "637564e928804a1f4f5a348d5640020d"//process.env.PRIVATE_KEY
  });

module.exports = function(app) {
  app.use('/', router);
};

/* Endpoint to confirm a user's email address */
router.get('/user/confirm_email', function(req, res, next) {
  User.confirmEmail(req.query.token, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      req.flash('error', 'Invalid email confirmation token.');
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
  User.sendResetEmail(req.body.email, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      req.flash('error', 'That email address is not registered to any user.');
      res.redirect('/user/password/forgot');
    } else {
      res.redirect('/user/password/reset_instructions?email=' + encodeURIComponent(user.email));
    }
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
  User.validatePasswordResetToken(req.query.token, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      req.flash('error', 'Invalid password reset token.');
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
  if (req.body.new_password !== req.body.new_password_again) {
    req.flash('error', 'Passwords do not match.');
    res.redirect('/user/password/reset?token=' + req.body.token);
  } else {
    User.resetPassword(req.body.token, req.body.new_password, function(err, user, password_err) {
      if (err)
        return next(err);
      if (!user) {
        req.flash('error', 'Invalid password reset token.');
        res.redirect('/');
      } else if (password_err) {
        req.flash('error', 'Invalid password: ' + password_err);
        res.redirect('/');
      } else {
        req.flash('success', 'Your password has successfully been changed.');
        req.logIn(user, function(err) {
          if (err)
            return next(err);
          return res.redirect('/user/profile');
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
    req.flash('success', 'Successfully set default address.');
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
    req.flash('success', 'Successfully removed address.');
    res.redirect('/user/addresses');
  });
});

/* Endpoint to view a user's saved payment methods */
router.get('/user/payment_methods', function(req, res, next) {
  if (req.user.braintree_customer_id) {
    gateway.customer.find(req.user.braintree_customer_id,
      function(err, customer) {
        if (err)
          return next(err);
        gateway.clientToken.generate({
          customerId: customer.id
        }, function(err, response) {
          if (err)
            return next(err);
          res.render('user/payment_methods', {
            title: 'User Payment Methods',
            client_token: response.clientToken,
            payment_methods: customer.paymentMethods
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
  req.user.addPaymentMethod(req.body.payment_method_nonce, req.body.set_default_address, function(err, result) {
    if(err) {
      console.log('\nResult: ', result);
      console.log('\nError: ', err);
      return next(err);
    }
    if (result.success) {
      req.flash('success', 'Successfully added payment method.');
      res.redirect('/user/payment_methods');
    } else {
      req.flash('error', 'Could not add payment method.');
      res.redirect('/user/payment_methods');
    }
  });
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
  Order.findUserOrdersPopulated(req.user, function(err, orders) {
    console.log("\nOrders: ", orders);
    orders = orders.filter(function(o) { return o.status != 'unpaid' });
    if (err)
      return next(err);
    res.render('user/orders', {
      title: "User Orders",
      orders: orders
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
  Order.findByIdPopulated(req.params.order_id, function(err, order) {
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
