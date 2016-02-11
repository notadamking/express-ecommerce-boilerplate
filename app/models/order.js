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
    payment_method: {
      type: String,
      enum: [
        'credit_card',
        'paypal',
        'bitcoin'
      ]
    },
    price: { // all prices stored as integers ($49.00 = 4900)
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
      'unpaid',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
      'returned'
    ]
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

Order.methods.calculatePrice = function(coupon_code, done) {
  var price = 0;
  for(var i = 0; i < this.cart.items.length; i++) {
    price += this.cart.items[i].product.price * this.cart.items[i].quantity;
  }
  this.billing.price.subtotal = price;
  this.billing.price.total = price;
  if(!coupon_code || coupon_code == '') {
    this.save(function(err) {
      if(err) console.log("Error saving order with empty coupon");
      done(err);
    });
  } else {
    var self = this;
    Coupon.findOne({ public_code: coupon_code.toLowerCase() }, function(err, coupon) {
      if(err) done(err);
      if(!coupon) {
        self.save(function(err) {
          if(err) console.log("Error saving order invalid coupon.");
          done(err, 'Invalid coupon.');
        });
      } else {
        coupon.applyToOrder(self, function(err) {
          if(err) console.log("Error saving order after adding coupon.");
          done(err, 'Coupon successfully applied.');
        });
      }
    });
  }
}

function getDecimalPrice(price) {
  return (price / 100).toFixed(2);
}

Order.virtual('displaySubtotal').get(function() {
  //TODO add currency support
  return '$' + getDecimalPrice(this.billing.price.subtotal);
});

Order.virtual('displayTaxes').get(function() {
  //TODO add currency support
  return '$' + getDecimalPrice(this.billing.price.taxes);
});

Order.virtual('displayShipping').get(function() {
  //TODO add currency support
  return '$' + getDecimalPrice(this.billing.price.shipping);
});

Order.virtual('displayDiscount').get(function() {
  //TODO add currency support
  return '$' + getDecimalPrice(this.billing.price.discount);
});

Order.virtual('displayTotal').get(function() {
  //TODO add currency support
  return '$' + getDecimalPrice(this.billing.price.total);
});

Order.virtual('decimalTotal').get(function() {
  return getDecimalPrice(this.billing.price.total);
})

module.exports = mongoose.model('Order', Order);
