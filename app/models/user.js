var mongoose = require('mongoose'),
    uuid = require('node-uuid'),
    passportLocalMongoose = require('passport-local-mongoose');
    Cart = mongoose.model('Cart'),
    Order = mongoose.model('Order'),
    Address = mongoose.model('Address');

var User = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    required: true
  },
  confirmed_email: {
    type: Boolean,
    default: false
  },
  default_address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  },
  braintree_customer_id: Number,
  password_reset_token: String,
  password_reset_expiration: Date,
  checkout_token: String,
  checkout_expiration: {
    type: Date,
    default: Date.now
  },
  admin: {
    type: Boolean,
    default: false
  },
  roles: [{
    type: String
  }],
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  },
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  }],
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  facebook: {
    oauth_id: Number,
    token: String
  },
  twitter: {
    oauth_id: Number,
    token: String
  },
  google: {
    oauth_id: Number,
    token: String
  },
  date_created: {
    type: Date,
    default: Date.now
  },
  date_updated: {
    type: Date,
    default: Date.now
  },
  date_last_login: {
    type: Date,
    default: Date.now
  }
});

User.post('init', function(user) {
  if(!user.cart) {
    var cart = new Cart({user: user});
    cart.save(function(err) {
      if(err) console.log("Error saving new cart.");
      else user.cart = cart.id;
      user.save(function(err) {
        if(err) console.log("Error saving new cart to user");
      });
    });
  }
});

User.pre('update', function(next) {
  this.date_updated = new Date();
  next();
});

User.methods.getCheckoutToken = function(done) {
  var token = uuid.v4();
  this.checkout_token = token;
  var expires = new Date();
  expires.setMinutes(expires.getMinutes() + 30);
  this.checkout_expiration = expires;
  this.save(function(err) {
    if(err) console.log("Error reseting checkout expiration ", err);
    done(err, token);
  });
}

User.methods.addOrder = function(order, done) {
  this.orders.push(order);
  this.save(function(err) {
    if(err) console.log("Error saving user after adding new order: ", err);
    done(err);
  });
}

User.methods.updateOrder = function(order, done) {
  Order.update({ _id: order.id }, order, function(err, order) {
    if(err) console.log("Error updating user order: ", err);
    done(err);
  });
}

User.methods.removeOrder = function(order_id, done) {
  this.update({ $pull: { 'orders': { _id: order_id } } }, function(err) {
    if(err) console.log("Error removing order for user: ", err);
    done(err);
  });
}

User.methods.addAddress = function(address, default_address, done) {
  this.addresses.push(address);

  if(default_address)
    this.default_address = address.id;

  this.save(function(err) {
    if(err) console.log("Error saving user after adding new address: ", err);
    done(err);
  });
}

User.methods.updateAddress = function(address, default_address, done) {
  var arr = this.addresses.filter(function(v) { return v['_id'] == address.id });
  if(arr.length < 1) {
    console.log("Tried to update non-existant address.");
    done();
  } else {
    arr[0].nickname = address.nickname;
    arr[0].first_name = address.first_name;
    arr[0].last_name = address.last_name;
    arr[0].street_line_1 = address.street_line_1;
    arr[0].street_line_2 = address.street_line_2;
    arr[0].city = address.city;
    arr[0].zip_code = address.zip_code;
    arr[0].state = address.state;
    arr[0].country = address.country;

    if(default_address) {
      this.default_address = address.id;
      this.save(function(err) {
        if(err) console.log("Error updating default address for user.");
      });
    }

    arr[0].save(function(err) {
      if(err) console.log("Error saving address after update.");
      done(err);
    });
  }
}

User.methods.removeAddress = function(address_id, done) {
  if(this.default_address == address_id) {
    this.default_address = undefined;
    this.save(function(err) {
      if(err) console.log("Error saving user after removing address: ", err);
    });
  }
  this.update({ $pull: { addresses: address_id } }, function(err) {
    if(err) console.log("Error removing address for user: ", err);
    done(err);
  });
}

User.methods.isAdmin = function() {
  return this.roles.indexOf('admin') >= 0;
}

User.plugin(passportLocalMongoose, {
  usernameField: 'email',
  lastLoginField: 'date_last_login',
  populateFields: 'cart addresses'
});

module.exports = mongoose.model('User', User);
