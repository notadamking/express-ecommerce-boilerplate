var mongoose = require('mongoose'),
  Address = mongoose.model('Address'),
  Cart = mongoose.model('Cart'),
  Coupon = mongoose.model('Coupon');

var Order = new mongoose.Schema({
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart',
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  email: {
    type: String,
    required: true
  },
  billing: {
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address'
    },
    transaction_id: String,
    payment_type: {
      type: String,
      enum: ['credit', 'paypal', 'bitcoin']
    },
    price: {
      // all prices stored as integers ($49.00 = 4900)
      subtotal: {
        type: Number,
        default: 0
      },
      taxes: {
        type: Number,
        default: 0
      },
      shipping: {
        type: Number,
        default: 0
      },
      discount: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    }
  },
  shipping: {
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address'
    },
    additional_information: String
  },
  status: {
    type: String,
    enum: [
      'unpaid', 'paid', 'cancelled', 'shipped', 'delivered', 'expecting_return',
      'returned'
    ],
    default: 'unpaid'
  },
  date_created: {
    type: Date,
    default: Date.now
  },
  date_updated: {
    type: Date,
    default: Date.now
  }
});

Order.pre('update', function(next) {
  this.date_updated = new Date();
  next();
});

Order.statics.createOrder = function(order, user, done) {
  var self = this;
  this.model('Order').findOne({
    cart: order.cart
  }, function(err, db_order) {
    if (db_order) {
      console.log("Order with that cart_id already exists.");
      if (db_order.email != order.email || db_order.user != order.user) {
        db_order.update({
          email: (db_order.email != order.email) ? order.email : db_order.email,
          user: (db_order.user != order.user) ? order.user : db_order.user
        }, function(err) {
          if (err)
            console.log("Error updating order email: ", err);
          done(err, db_order);
        });
      } else {
        done(err, db_order);
      }
    } else {
      order = new self({
        cart: order.cart,
        email: order.email
      });
      if (user)
        order.user = user.id;
      order.save(function(err) {
        if (err)
          console.log("Error saving new order: ", err);
        if (!user) {
          done(err, order);
        } else {
          user.addOrder(order, function(err) {
            if (err)
              console.log("Error adding order to user: ", err);
            done(err, order);
          });
        }
      });
    }
  });
}

Order.statics.findUserOrdersPopulated = function(user, done) {
  this.model('Order').find({
      user: user.id
    })
    .populate({
      path: 'cart',
      populate: {
        path: 'items.product',
        model: 'Product'
      }
    })
    .populate('shipping.address')
    .populate('billing.address')
    .exec(done);
}

Order.statics.findPopulated = function(order, done) {
  this.model('Order').findOne(order)
    .populate({
      path: 'cart',
      populate: {
        path: 'items.product',
        model: 'Product'
      }
    })
    .populate('user')
    .populate('shipping.address')
    .populate('billing.address')
    .exec(done);
}

Order.statics.findByIdPopulated = function(order_id, done) {
  this.model('Order').findById(order_id)
    .populate({
      path: 'cart',
      populate: {
        path: 'items.product',
        model: 'Product'
      }
    })
    .populate('user')
    .populate('shipping.address')
    .populate('billing.address')
    .exec(done);
}

Order.methods.calculatePrice = function(coupon_code, done) {
  var price = 0;
  for (var i = 0; i < this.cart.items.length; i++) {
    price += this.cart.items[i].variant.price * this.cart.items[i].quantity;
  }
  this.billing.price.subtotal = price;
  this.billing.price.total = price;
  if (!coupon_code || coupon_code == '') {
    this.save(function(err) {
      if (err) console.log("Error saving order with empty coupon");
      done(err);
    });
  } else {
    var self = this;
    Coupon.findOne({
      public_code: coupon_code.toLowerCase()
    }, function(err, coupon) {
      if (err) done(err);
      if (!coupon) {
        self.save(function(err) {
          if (err) console.log("Error saving order invalid coupon.");
          done(err, 'Invalid coupon.');
        });
      } else {
        coupon.applyToOrder(self, function(err) {
          if (err) console.log("Error saving order after adding coupon.");
          done(err, 'Coupon successfully applied.');
        });
      }
    });
  }
}

Order.virtual('decimalTotal').get(function () {
  return (this.billing.price.total / 100).toFixed(2);
});

module.exports = mongoose.model('Order', Order);
