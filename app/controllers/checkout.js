var router = require('express').Router(),
  passport = require('passport'),
  mongoose = require('mongoose'),
  passport = require('passport'),
  braintree = require('braintree'),
  Order = mongoose.model('Order'),
  Product = mongoose.model('Product'),
  Coupon = mongoose.model('Coupon'),
  gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: '37rkyn2n5tszjskc', //sandbox
    publicKey: 'kqdb8hgwrh6xt582', //sandbox
    privateKey: '1bd6b731bf7a3d8d79dfd97455c8aa95' //sandbox
  });

module.exports = function (app) {
  app.use('/', router);
};

/* Endpoint to start the checkout process */
router.get('/checkout/account', function(req, res, next) {
  var cart_id = req.session.cart_id;
  if(req.user) {
    cart_id = req.user.cart.id;
    var now = new Date();
    if(req.session.checkout_token == req.user.checkout_token &&
        now < req.user.checkout_expiration) {
      Order.findOne({ cart: cart_id }, function(err, order) {
        if(err) return next(err);
        if(order) {
          return res.redirect('/checkout/shipping?order_id=' + order.id);
        } else {
          order = new Order({
            cart: req.user.cart.id,
            user: req.user.id,
            email: req.user.email,
            currency: 'USD',
            status: 'unpaid'
          });
          order.save(function(err) {
            if(err) console.log("Error saving new order: ", err);
            req.user.addOrder(order, function(err) {
              if(err) return next(err);
              res.redirect('/checkout/shipping?order_id=' + order.id);
            });
          });
        }
      });
    } else {
      res.render('checkout/account', {
        title: 'Checkout - Account',
        cart_id: cart_id
      });
    }
  } else {
    res.render('checkout/account', {
      title: 'Checkout - Account',
      cart_id: cart_id
    });
  }
});

/* Endpoint to post a user's order and continue checking out */
router.post('/checkout/account', function(req, res, next) {
  if(!req.body.cart_id) {
    req.flash('info', 'You cannot checkout with an empty cart.');
    res.redirect('/');
  }

  if(req.body.account == 'user') {
    console.log("\nAUTHENTICATING USER");
    passport.authenticate('local', function(err, user, info) {
      if(err) return next(err);
      if(!user) {
        console.log("\nCould not authenticate user.");
        req.flash('error', 'Invalid email or password.');
        req.logout();
        return res.redirect('/checkout/account');
      } else {
        console.log("\nSuccessfully authenticated user.");
        req.login(user, function(err) {
          req.user.getCheckoutToken(function(err, token) {
            if(err) return next(err);
            if(token) req.session.checkout_token = token;
          });
          Order.findOne({ cart: req.body.cart_id }, function(err, order) {
            if(err) return next(err);
            if(order) {
              console.log("Order with that cart_id already exists.");
              res.redirect('/checkout/shipping?order_id=' + order.id);
            } else {
              order = new Order({
                cart: req.body.cart_id,
                email: req.body.email,
                user: user.id,
                currency: 'USD',
                status: 'unpaid'
              });
              order.save(function(err) {
                if(err) console.log("Error saving new order: ", err);
                req.user.addOrder(order, function(err) {
                  if(err) return next(err);
                  res.redirect('/checkout/shipping?order_id=' + order.id);
                })
              });
            }
          });
        });
      }
    })(req, res, next);
  } else {
    Order.findOne({ cart: req.body.cart_id }, function(err, order) {
      if(err) return next(err);
      if(order) {
        console.log("Order with that cart_id already exists.");
        if(order.email != req.body.email) {
          Order.update({ cart: req.body.cart_id }, {
            email: req.body.email
          }, function(err) {
            res.redirect('/checkout/shipping?order_id=' + order.id);
          });
        } else {
          res.redirect('/checkout/shipping?order_id=' + order.id);
        }
      } else {
        order = new Order({
          cart: req.body.cart_id,
          email: req.body.email,
          currency: 'USD',
          status: 'unpaid'
        });
        order.save(function(err) {
          if(err) console.log("Error saving new order: ", err);
          res.redirect('/checkout/shipping?order_id=' + order.id);
        });
      }
    });
  }
});

/* Endpoint for a user to enter a shipping address */
router.get('/checkout/shipping', function(req, res, next) {
  if(!req.user) {
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
  if(req.body.address_id && req.body.address_id != 'new') {
    Order.update({ _id: req.body.order_id }, {
      shipping: {
        address: req.body.address_id,
        additional_information: req.body.additional_information
      }
    }, function(err) {
      if(err) return next(err);
      res.redirect('/checkout/billing?order_id=' + req.body.order_id);
    });
  } else {
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
      if(req.user) {
        req.user.addAddress(address, req.body.set_default_address, function(err) {
          if(err) return next(err);
        });
      }
      Order.update({ _id: req.body.order_id }, {
        shipping: {
          address: address.id,
          additional_information: req.body.additional_information
        }
      }, function(err) {
        if(err) return next(err);
        res.redirect('/checkout/billing?order_id=' + req.body.order_id);
      });
    });
  }
});

/* Endpoint for a user to enter billing information */
router.get('/checkout/billing', function(req, res, next) {
  Order
    .findById(req.query.order_id)
    .populate('shipping.address')
    .exec(function(err, order) {
      if(err) return next(err);
      if(!order) {
        req.flash('error', 'Invalid order.');
        res.redirect('/');
      } else if(!req.user) {
        gateway.clientToken.generate({}, function (err, response) {
          if(err) return next(err);
          res.render('checkout/billing', {
            title: 'Checkout - Payment',
            order: order,
            client_token: response.clientToken
          });
        });
      } else {
        gateway.clientToken.generate({}, function (err, response) {
          if(err) return next(err);
          res.render('checkout/billing', {
            title: 'Checkout - Payment',
            order: order,
            addresses: req.user.addresses,
            default_address_id: req.user.default_address,
            client_token: response.clientToken
          });
        });
      }
    });
});

/* Endpoint to post a user's billing information for an order */
router.post('/checkout/billing', function(req, res, next) {
  var address_id = req.body.shipping_address_id;
  if(address_id || req.body.address_id != 'new') {
    if(!address_id)
      address_id = req.body.address_id;
    Order.findByIdAndUpdate(req.body.order_id, {
      billing: {
        address: address_id
      }
    }, function(err, order) {
      if(err) return next(err);
      if(!order) {
        req.flash('error', 'Invalid order.');
        res.redirect('/');
      } else {
        gateway.customer.create({
          paymentMethodNonce: req.body.payment_method_nonce
        }, function (err, result) {
          if (result.success) {
            var token = result.customer.paymentMethods[0].token;
            res.redirect('/checkout/review?order_id=' + req.body.order_id
                          + '&token=' + token);
          }
        });
      }
    });
  } else {
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
      if(req.user) {
        req.user.addAddress(address, req.body.set_default_address, function(err) {
          if(err) return next(err);
        });
      }
      Order.findByIdAndUpdate(req.body.order_id, {
        billing: {
          address: address.id
        }
      }, function(err, order) {
        if(err) return next(err);
        if(!order) {
          req.flash('error', 'Invalid order.');
          res.redirect('/');
        } else {
          gateway.customer.create({
            paymentMethodNonce: req.body.payment_method_nonce
          }, function (err, result) {
            if (result.success) {
              var token = result.customer.paymentMethods[0].token;
              res.redirect('/checkout/review?order_id=' + req.body.order_id
                            + '&token=' + token);
            }
          });
        }
      });
    });
  }
});

/* Endpoint for a user to review their purchase before making a purchase */
router.get('/checkout/review', function(req, res, next) {
  Order
    .findById(req.query.order_id)
    .populate({
      path: 'cart',
      populate: {
        path: 'items.product',
        model: 'Product'
      }
    })
    .populate('shipping.address')
    .populate('billing.address')
    .exec(function(err, order) {
      if(err) return next(err);
      if(!order || !order.cart) {
        req.flash('error', 'Invalid order.');
        res.redirect('/');
      } else {
        order.calculatePrice(req.query.coupon_code, function(err, info) {
          if(err) return next(err);
          if(info == 'Invalid coupon.') console.log('\nINVALID COUPON: ', req.body.coupon_code);
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
  Order
    .findById(req.body.order_id)
    .populate({
      path: 'cart',
      populate: {
        path: 'items.product',
        model: 'Product'
      }
    })
    .populate('shipping.address')
    .populate('billing.address')
    .exec(function(err, order) {
      if(err) return next(err);
      if(!order) {
        req.flash('error', 'Invalid order.');
        res.redirect('/');
      } else {
        console.log("\nORDER: ", order);
        // order.applyCoupon saves the order
        order.calculatePrice(req.body.coupon_code, function(err, info) {
          if(err) return next(err);
          if(info == 'Invalid coupon.') console.log('\nINVALID: ', req.body.coupon_code);
          gateway.transaction.sale({
            paymentMethodToken: req.body.token,
            amount: order.decimalTotal
          }, function(err, result) {
            console.log("\nERR: %s\nResult: %j", err, result);
            if(err) return next(err);
            if(!result.success) {
              console.log("\nUNSUCCESS");
              req.flash('error', 'Transaction could not be completed.');
              return res.redirect('/');
            } else {
              order.status = 'paid';
              order.save(function(err) {
                if(err) return next(err);
                req.session.cart_id = undefined;
                if(req.user) {
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
  Order
  .findById(req.query.order_id)
  .populate({
    path: 'cart',
    populate: {
      path: 'items.product',
      model: 'Product'
    }
  })
  .populate('shipping.address')
  .populate('billing.address')
  .exec(function(err, order) {
    if(err) return next(err);
    if(!order) {
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
