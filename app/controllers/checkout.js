var router = require('express').Router(),
  passport = require('passport'),
  mongoose = require('mongoose'),
  passport = require('passport'),
  Order = mongoose.model('Order'),
  Product = mongoose.model('Product'),
  Coupon = mongoose.model('Coupon'),
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

/* Endpoint to start the checkout process */
router.get('/checkout/account', function(req, res, next) {
  /*
   * If the user is logged in and the session checkout token is valid,
   * skip to shipping. Otherwise, render the checkout account page.
   */
  if (!req.user || !req.user.validateCheckoutToken(req.session.checkout_token)) {
    res.render('checkout/account', {
      title: 'Checkout - Account',
      cart_id: (req.user) ? req.user.cart.id : req.session.cart_id,
      user: req.user
    });
  } else {
    Order.createOrder({
      cart: req.user.cart.id,
      email: req.user.email,
      user: req.user
    }, req.user, function(err, order) {
      if (err)
        return next(err);
      if (!order) {
        req.flash('error', 'Could not create an order at this time. Try again later.');
        res.redirect('/checkout/account');
      } else {
        res.redirect('/checkout/shipping?order_id=' + order.id);
      }
    });
  }
});

/* Endpoint to post a user's order and continue checking out */
router.post('/checkout/account', function(req, res, next) {
  if (!req.body.cart_id) {
    req.flash('info', 'You cannot checkout with an empty cart.');
    return res.redirect('/');
  }
  /*
   * If the user has chosen to login, authenticate the post request and create
   * a new order. Otherwise, create a new guest order.
   */
  if (req.body.account == 'user') {
    passport.authenticate('local', function(err, user, info) {
      if (err)
        return next(err);
      if (!user) {
        req.flash('error', 'Invalid email or password.');
        req.logout();
        res.redirect('/checkout/account');
      } else {
        req.login(user, function(err) {
          if (err)
            return next(err);
          req.user.getCheckoutToken(function(err, token) {
            if (err)
              console.log('Error getting checkout token: ', err);
            if (token)
              req.session.checkout_token = token;
            Order.createOrder({
              cart: req.body.cart_id,
              email: req.body.email,
              user: req.user
            }, user, function(err, order) {
              if (err)
                return next(err);
              if (!order) {
                req.flash('error', 'Could not create an order at this time. Try again later.');
                res.redirect('/checkout/account');
              } else {
                res.redirect('/checkout/shipping?order_id=' + order.id);
              }
            });
          });
        });
      }
    })(req, res, next);
  } else {
    req.logout();
    Order.createOrder({
      cart: req.body.cart_id,
      email: req.body.email
    }, undefined, function(err, order) {
      if (err)
        return next(err);
      if (!order) {
        req.flash('error', 'Could not create an order at this time. Try again later.');
        res.redirect('/checkout/account');
      } else {
        res.redirect('/checkout/shipping?order_id=' + order.id);
      }
    });
  }
});

/* Endpoint for a user to enter a shipping address */
router.get('/checkout/shipping', function(req, res, next) {
  if (!req.user) {
    res.render('checkout/shipping', {
      title: 'Guest Checkout - Shipping',
      order_id: req.query.order_id
    });
  } else {
    res.render('checkout/shipping', {
      title: 'User Checkout - Shipping',
      order_id: req.query.order_id,
      addresses: req.user.addresses,
      default_address_id: req.user.default_address
    });
  }
});

/* Endpoint to post a user's shipping address for an order */
router.post('/checkout/shipping', function(req, res, next) {
  /*
   * If the user has chosen to ship to a new address, create a new address
   * for the user. Either way, update the order's shipping details
   * and redirect to billing.
   */
  if (req.body.address_id == 'new') {
    Address.createNewAddress(req.body, req.user, function(err, address) {
      if (err)
        return next(err);
      Order.update({
        _id: req.body.order_id
      }, {
        shipping: {
          address: address.id,
          additional_information: req.body.additional_information
        }
      }, function(err) {
        if (err)
          return next(err);
        res.redirect('/checkout/billing?order_id=' + req.body.order_id);
      });
    });
  } else {
    Order.update({
      _id: req.body.order_id
    }, {
      shipping: {
        address: req.body.address_id,
        additional_information: req.body.additional_information
      }
    }, function(err) {
      if (err)
        return next(err);
      res.redirect('/checkout/billing?order_id=' + req.body.order_id);
    });
  }
});

/* Endpoint for a user to enter billing information */
router.get('/checkout/billing', function(req, res, next) {
  Order.findByIdPopulated(req.query.order_id, function(err, order) {
    if (err)
      return next(err);
    if (!order) {
      req.flash('error', 'Invalid order.');
      res.redirect('/cart');
    }
    /*
     * Generate a client token -- using braintree customer id if it exists --
     * then render the billing options for the user.
     */
    if (!req.user || !req.user.braintree_customer_id) {
      gateway.clientToken.generate({},
        function(err, response) {
          if (err)
            return next(err);
          res.render('checkout/billing', {
            title: 'Checkout - Payment',
            order: order,
            client_token: response.clientToken,
            user: req.user
          });
        });
    } else {
      gateway.customer.find(req.user.braintree_customer_id,
        function(err, customer) {
          if (err)
            return next(err);
          gateway.clientToken.generate({
            customerId: customer.id
          }, function(err, response) {
            if (err)
              return next(err);
            res.render('checkout/billing', {
              title: 'Checkout - Payment',
              order: order,
              client_token: response.clientToken,
              user: req.user,
              customer_id: customer.id
            });
          });
        });
    }
  });
});

/* Endpoint to post a user's billing information for an order */
router.post('/checkout/billing', function(req, res, next) {
  /*
   * If the user has chosen to bill to a new address, create a new address
   * for the user. Either way, update the order's billing details
   * and redirect to order review.
   */
  if (!req.body.use_shipping_address && req.body.address_id == 'new') {
    Address.createNewAddress(req.body, req.user, function(err, address) {
      if (err)
        return next(err);
      Order.findByIdAndUpdate(req.body.order_id, {
        billing: {
          address: address.id
        }
      }, function(err, order) {
        if (err)
          return next(err);
        if (!order) {
          req.flash('error', 'Invalid order.');
          res.redirect('/');
        }
        /*
         * If the user does not have a braintree customer id, create one.
         * Either way, get the payment method token and redirect to
         * checkout review.
         */
        if (!req.user || !req.user.braintree_customer_id) {
          gateway.customer.create({
            paymentMethodNonce: req.body.payment_method_nonce
          }, function(err, result) {
            if (result.success) {
              if (req.user) {
                req.user.setupCustomer(result.customer, function(err) {
                  if (err)
                    return next(err);
                });
              }
              var token = result.customer.paymentMethods[0].token;
              res.redirect('/checkout/review?order_id=' +
                req.body.order_id + '&token=' + token);
            } else {
              req.flash('error', 'Payment method could not be added to customer.');
              res.redirect('/checkout/billing?order_id=' +
                req.body.order_id);
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
          }, function(err, result) {
            if (result.success) {
              var token = result.paymentMethod.token;
              res.redirect('/checkout/review?order_id=' +
                req.body.order_id + '&token=' + token);
            } else {
              req.flash('error', 'Payment method could not be added to customer.');
              res.redirect('/checkout/billing?order_id=' +
                req.body.order_id);
            }
          });
        }
      });
    });
  } else {
    var address_id = req.body.shipping_address_id;
    if (!req.body.use_shipping_address)
      address_id = req.body.address_id;
    Order.findByIdAndUpdate(req.body.order_id, {
      billing: {
        address: address_id
      }
    }, function(err, order) {
      if (err)
        return next(err);
      if (!order) {
        req.flash('error', 'Invalid order.');
        res.redirect('/');
      }
      /*
       * If the user does not have a braintree customer id, create one.
       * Either way, get the payment method token and redirect to
       * checkout review.
       */
      if (!req.user || !req.user.braintree_customer_id) {
        gateway.customer.create({
          paymentMethodNonce: req.body.payment_method_nonce
        }, function(err, result) {
          if (result.success) {
            if (req.user) {
              req.user.setupCustomer(result.customer, function(err) {
                if (err)
                  return next(err);
              });
            }
            var token = result.customer.paymentMethods[0].token;
            res.redirect('/checkout/review?order_id=' +
              req.body.order_id + '&token=' + token);
          } else {
            req.flash('error', 'Customer could not be created for user.');
            res.redirect('/checkout/billing?order_id=' +
              req.body.order_id);
          }
        });
      } else {
        gateway.paymentMethod.create({
          customerId: req.user.braintree_customer_id,
          paymentMethodNonce: req.body.payment_method_nonce,
          options: {
            makeDefault: req.body.make_default_payment
          }
        }, function(err, result) {
          if (result.success) {
            var token = result.paymentMethod.token;
            res.redirect('/checkout/review?order_id=' +
              req.body.order_id + '&token=' + token);
          } else {
            req.flash('error', 'Payment method could not be added to customer.');
            res.redirect('/checkout/billing?order_id=' + req.body.order_id);
          }
        });
      }
    });
  }
});

/* Endpoint for a user to review their purchase before making a purchase */
router.get('/checkout/review', function(req, res, next) {
  Order.findByIdPopulated(req.query.order_id, function(err, order) {
    if (err)
      return next(err);
    if (!order || !order.cart) {
      console.log("\nOrder: ", order);
      req.flash('error', 'Invalid order.');
      res.redirect('/');
    } else {
      order.calculatePrice(req.query.coupon_code, function(err, info) {
        if (err)
          return next(err);
        if (info == 'Invalid coupon.')
          req.flash('error', 'Invalid Coupon: ' + req.body.coupon_code);
        res.render('checkout/review', {
          title: 'Checkout - Review Order',
          order: order,
          token: req.query.token,
          coupon_code: req.query.coupon_code
        });
      });
    }
  });
});

/* Endpoint to post a purchase */
router.post('/checkout/review', function(req, res, next) {
  Order.findByIdPopulated(req.body.order_id, function(err, order) {
    if (err)
      return next(err);
    if (!order) {
      req.flash('error', 'Invalid order.');
      res.redirect('/');
    } else {
      // order.applyCoupon saves the order
      order.calculatePrice(req.body.coupon_code, function(err, info) {
        if (err)
          return next(err);
        if (info == 'Invalid coupon.')
          req.flash('error', 'Invalid Coupon: ' + req.body.coupon_code);
        gateway.transaction.sale({
          paymentMethodToken: req.body.token,
          amount: order.decimalTotal,
          options: {
            submitForSettlement: true
          }
        }, function(err, result) {
          if (err)
            return next(err);
          if (!result.success) {
            req.flash('error', 'Transaction could not be completed.');
            console.log("\nResult: ", result);
            return res.redirect('/');
          } else {
            order.status = 'paid';
            order.billing.transaction_id = result.transaction.id;
            order.save(function(err) {
              if (err)
                return next(err);
              req.session.cart_id = undefined;
              if (req.user) {
                req.user.cart = undefined;
                req.user.save(function(err) {
                  res.redirect('/checkout/complete?order_id=' + order.id);
                });
              } else {
                res.redirect('/checkout/complete?order_id=' + order.id);
              }
            });
          }
        });
      });
    }
  });
});

router.get('/checkout/complete', function(req, res, next) {
  Order.findByIdPopulated(req.query.order_id, function(err, order) {
    if (err)
      return next(err);
    if (!order) {
      req.flash('error', 'Invalid order.');
      res.redirect('/');
    } else {
      res.render('checkout/complete', {
        title: 'Completed Checkout',
        order: order
      });
    }
  });
});
