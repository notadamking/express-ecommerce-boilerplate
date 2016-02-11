var mongoose = require('mongoose');

var Coupon = new mongoose.Schema({
  public_code: {
    type: String,
    required: true
  },
  discount: {
    percent: {
      type: Number,
      default: 0
    },
    straight: {
      type: Number, // ($49.00 = 4900)
      default: 0
    },
    freeShipping: {
      type: Boolean,
      default: false
    }
  }
});

Coupon.methods.applyToOrder = function (order, done) {
  var total = order.billing.price.subtotal - this.discount.straight;
  total *= (1 - (this.discount.percent / 100));
  if(total < 0) total = 0;
  order.billing.price.discount = order.billing.price.total - total;
  if(this.freeShipping) {
    order.billing.price.discount += order.billing.price.shipping;
    order.billing.price.shipping = 0;
  }
  order.billing.price.total = total + order.billing.price.taxes + order.billing.price.shipping;
  order.save(function(err) {
    if(err) console.log('Error saving order after applying coupon');
    done(err);
  });
}

module.exports = mongoose.model('Coupon', Coupon);
