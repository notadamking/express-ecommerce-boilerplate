var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Cart = mongoose.model('Cart'),
    Order = mongoose.model('Order');

module.exports = function (app) {
  app.use('/', router);
};

/* Endpoint to view cart */
router.get('/cart', function(req, res, next) {
  if(req.user) {
    User
      .findById(req.user.id)
      .populate({
        path: 'cart',
        populate: {
          path: 'items.product',
          model: 'Product'
        }
      })
      .exec(function(err, user) {
        if(err) return next(err);
        res.render('cart', {
          title: 'User Cart',
          cart: user.cart
        });
      });
  } else if(req.session.cart_id) {
    Cart
      .findById(req.session.cart_id)
      .populate('items.product')
      .exec(function(err, cart) {
        if(err) return next(err);
        res.render('cart', {
          title: 'Guest Cart',
          cart: cart
        });
      });
  } else {
    res.render('cart', {
      title: 'Guest Cart (New)',
      cart: {}
    });
  }
});

/* Endpoint to add item to cart */
router.post('/cart', function(req, res, next) {
  var product_id = req.body.product_id;
  var variant_SKU = req.body.variant_SKU;
  var quantity = parseInt(req.body.quantity);

  if(req.user) {
    req.user.cart.addItem(product_id, variant_SKU, quantity, function(err) {
      res.redirect('/cart');
    });
  } else if(req.session.cart_id) {
    Cart.findById(req.session.cart_id, function(err, cart) {
      cart.addItem(product_id, variant_SKU, quantity, function(err) {
        res.redirect('/cart');
      });
    });
  } else {
    var cart = new Cart();
    cart.addItem(product_id, variant_SKU, quantity, function(err) {
      req.session.cart_id = cart.id;
      res.redirect('/cart');
    });
  }
});

/* Endpoint to edit cart item */
router.put('/cart/:product_id', function(req, res, next) {
  var product_id = req.params.product_id;
  var variant_SKU = req.body.variant_SKU;
  var quantity = parseInt(req.body.quantity);

  if(req.user) {
    req.user.cart.updateItem(product_id, variant_SKU, quantity, function(err) {
      res.redirect('/cart');
    });
  } else if(req.session.cart_id) {
    Cart.findById(req.session.cart_id, function(err, cart) {
      cart.updateItem(product_id, variant_SKU, quantity, function(err) {
        res.redirect('/cart');
      });
    });
  } else {
    var cart = new Cart();
    cart.addItem(product_id, variant_SKU, quantity, function(err) {
      req.session.cart_id = cart.id;
      res.redirect('/cart');
    });
  }
});

/* Endpoint to remove cart item */
router.delete('/cart/:product_id', function(req, res, next) {
  var product_id = req.params.product_id;
  var variant_SKU = req.body.variant_SKU;

  if(req.user) {
    req.user.cart.removeItem(product_id, variant_SKU, function(err) {
      res.redirect('/cart');
    });
  } else if(req.session.cart_id) {
    Cart.findById(req.session.cart_id, function(err, cart) {
      cart.removeItem(product_id, variant_SKU, function(err) {
        res.redirect('/cart');
      });
    });
  } else {
    res.redirect('/');
  }
});
