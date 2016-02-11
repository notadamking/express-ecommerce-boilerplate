var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;

var Cart = new Schema({
  items: [{
    product: {
      type: ObjectId,
      ref: 'Product'
    },
    quantity: Number
  }],
  user: {
    type: ObjectId,
    ref: 'User'
  },
  purchased: {
    type: Boolean,
    default: false
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

Cart.methods.addGuestCart = function(guest_cart_id, done) {
  var self = this;
  this.model('Cart').findById(guest_cart_id, function(err, cart) {
    if(err) console.log("Error finding guest cart to add to user cart.");
    if(cart) {
      for(var i = 0; i < cart.items.length; i++) {
        var arr = self.items.filter(function(item) {
          return item['product'].equals(cart.items[i].product);
        });
        if(arr.length > 0) {
          arr[0].quantity += cart.items[i].quantity;
        } else {
          self.items.push({product: cart.items[i].product, quantity: cart.items[i].quantity});
        }
      }
      self.save(function(err) {
        if(err) {
          console.log("Error saving user after adding guest cart");
          done(err);
        } else {
          cart.remove(function(err) {
            if(err) console.log("Error removing old guest cart.");
            done(err);
          });
        }
      });
    } else {
      done(err);
    }
  });
}

Cart.methods.addItem = function(product_id, quantity, done) {
  var arr = this.items.filter(function(v) { return v['product'] == product_id });
  if(arr.length > 0) {
    arr[0].quantity += quantity;
  } else {
    this.items.push({product: product_id, quantity: quantity});
  }
  this.save(function(err) {
    if(err) console.log("Error adding item to cart: ", err);
    done(err);
  });
}

Cart.methods.updateItem = function(product_id, quantity, done) {
  var arr = this.items.filter(function(v) { return v['product'] == product_id });
  if(arr.length > 0) {
    arr[0].quantity = quantity;
    this.save(function(err) {
      if(err) console.log("Error updating item quantity in cart: ", err);
      done(err);
    });
  } else {
    done();
  }
}

Cart.methods.removeItem = function(product_id, done) {
  this.update({ $pull: { 'items': { product: product_id } } }, function(err) {
    if(err) console.log("Error deleteing item in cart: ", err);
    done(err);
  });
}

Cart.pre('update', function(next) {
  this.date_updated = new Date();
  next();
});

module.exports = mongoose.model('Cart', Cart);
