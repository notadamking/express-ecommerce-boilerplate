var mongoose = require('mongoose'),
  uuid = require('node-uuid'),
  passportLocalMongoose = require('passport-local-mongoose'),
  Cart = mongoose.model('Cart'),
  Order = mongoose.model('Order'),
  Address = mongoose.model('Address'),
  braintree = require('braintree'),
  gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: "nsp7gtrpf3sh3ycy",// process.env.MERCHANT_ID,
    publicKey: "qxgdv667ypkbf84q",//process.env.PUBLIC_KEY,
    privateKey: "637564e928804a1f4f5a348d5640020d"//process.env.PRIVATE_KEY
  });

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
  confirm_email_token: {
    type: String,
    default: uuid.v4
  },
  default_address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  },
  braintree_customer_id: String,
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
  if (!user.cart) {
    var cart = new Cart({
      user: user
    });
    cart.save(function(err) {
      if (err) console.log("Error saving new cart.");
      else user.cart = cart.id;
      user.save(function(err) {
        if (err) console.log("Error saving new cart to user");
      });
    });
  }
});

User.pre('update', function(next) {
  this.date_updated = new Date();
  next();
});

User.statics.confirmEmail = function(token, done) {
  this.model('User').findOneAndUpdate({
    confirm_email_token: token
  }, {
    confirmed_email: true
  }, done);
}

User.statics.validatePasswordResetToken = function(token, done) {
  this.model('User').findOne({
    password_reset_token: token
  }, function(err, user) {
    if (err)
      console.log('Error finding user by password reset token: ', err);
    var date = new Date();
    if (!user || date > user.password_reset_expiration) {
      done(err, null);
    } else {
      done(err, user);
    }
  });
}

User.statics.resetPassword = function(token, new_password, done) {
  this.validatePasswordResetToken(req.body.token, function(err, user) {
    if (err)
      console.log('Error validating password reset token: ', err);
    if (!user) {
      return done(err, null);
    } else {
      user.setPassword(new_password, function(err, user, password_err) {
        user.password_reset_token = '';
        user.save(function(err) {
          if (err) console.log('Error saving user after updating password reset token: ', err);
          if (!password_err) {
            return done(err, user, password_err);
          } else {
            var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
            sendgrid.send({
                to: user.email,
                from: 'support@localhost',
                subject: 'Password Reset Complete',
                html: '<body><p>Your password has successfully been changed.</p></body>'
              },
              function(err) {
                if (err)
                  console.log("Error sending password reset success email. ", err);
                done(err, user, password_err);
              });
          }
        });
      });
    }
  });
}

User.methods.validateCheckoutToken = function(token) {
  var now = new Date();
  return this.checkout_token == token && now < this.checkout_expiration;
}

User.methods.setupCustomer = function(customer, done) {
  this.braintree_customer_id = customer.id;
  this.save(function(err) {
    if (err)
      console.log("Error saving BT customer id to user. ", err);
    gateway.paymentMethod.update(
      customer.paymentMethods[0].token, {
        options: {
          makeDefault: true
        }
      },
      function(err, result) {
        if (err)
          console.log("Error setting new payment method to default: ", err);
        done(err);
      });
  });
}

User.methods.getCheckoutToken = function(done) {
  var token = uuid.v4();
  this.checkout_token = token;
  var expires = new Date();
  expires.setMinutes(expires.getMinutes() + 30);
  this.checkout_expiration = expires;
  this.save(function(err) {
    if (err) console.log("Error reseting checkout expiration ", err);
    done(err, token);
  });
}

User.methods.addOrder = function(order, done) {
  this.orders.push(order);
  this.save(function(err) {
    if (err) console.log("Error saving user after adding new order: ", err);
    done(err);
  });
}

User.methods.updateOrder = function(order, done) {
  Order.update({
    _id: order.id
  }, order, function(err, order) {
    if (err) console.log("Error updating user order: ", err);
    done(err);
  });
}

User.methods.removeOrder = function(order_id, done) {
  this.update({
    $pull: {
      'orders': {
        _id: order_id
      }
    }
  }, function(err) {
    if (err) console.log("Error removing order for user: ", err);
    done(err);
  });
}

User.methods.cancelOrder = function(order_id, done) {
  var self = this;
  Order.findById(order_id, function(err, order) {
    if (err) console.log("Error finding order by id: ", err);
    if (!order) {
      done(err, {
        type: 'error',
        message: 'No order exists with that id.'
      });
    } else if (order.status != 'paid') {
      done(err, {
        type: 'error',
        message: 'You cannot cancel an order with status ' + order.status
      });
    } else {
      gateway.transaction.find(order.billing.transaction_id, function(err, transaction) {
        if (err) console.log("Error finding transaction: ", err);
        if (!transaction) {
          done(err, {
            type: 'error',
            message: 'Error processing refund.'
          });
        } else {
          if (transaction.status == 'settled' || transaction.status == 'settling') {
            gateway.transaction.refund(order.billing.transaction_id, function(err, result) {
              if (err) console.log("Error refunding order: ", err);
              if (result && result.success) {
                order.status = 'cancelled';
                order.save(function(err) {
                  if (err) console.log('Error saving order after refund: ', err);
                  var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
                  sendgrid.send({
                    to: self.email,
                    from: 'support@localhost',
                    subject: 'Order Cancellation',
                    html: '<body><p>Your order has been cancelled and your money refunded.</p></body>'
                  }, function(err) {
                    if (err) console.log('Error sending email for order cancellation: ', err);
                    done(err, {
                      type: 'success',
                      message: 'Successfully cancelled and refunded order. You should receive an email shortly.'
                    });
                  });
                });
              } else {
                console.log("Error refunding order: ", result);
                done(err, {
                  type: 'error',
                  message: 'Error processing refund.'
                });
              }
            });
          } else {
            gateway.transaction.void(order.billing.transaction_id, function(err, result) {
              if (err) console.log("Error refunding order: ", err);
              if (result && result.success) {
                order.status = 'cancelled';
                order.save(function(err) {
                  if (err) console.log('Error saving order after refund: ', err);
                  var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
                  sendgrid.send({
                    to: self.email,
                    from: 'support@localhost',
                    subject: 'Order Cancellation',
                    html: '<body><p>Your order has been cancelled and your money refunded.</p></body>'
                  }, function(err) {
                    if (err) console.log('Error sending email for order cancellation: ', err);
                    done(err, {
                      type: 'success',
                      message: 'Successfully cancelled and refunded order. You should receive an email shortly.'
                    });
                  });
                });
              } else {
                console.log("Error refunding order: ", result);
                done(err, {
                  type: 'error',
                  message: 'Error processing refund.'
                });
              }
            });
          }
        }
      });
    }
  })
}

User.methods.requestOrderReturn = function(order_id, done) {
  var self = this;
  Order.findById(order_id, function(err, order) {
    if (err) console.log("Error finding order by id: ", err);
    if (!order) {
      done(err, {
        type: 'error',
        message: 'No order exists with that id.'
      });
    } else if (order.status != 'shipped' && order.status != 'delivered') {
      done(err, {
        type: 'error',
        message: 'You cannot request a refund for an order with status ' + order.status
      });
    } else {
      order.status = 'expecting_return';
      var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
      sendgrid.send({
        to: self.email,
        from: 'support@localhost',
        subject: 'Order Return',
        html: '<body><p>Return the items with the return label and packing slip provided.</p></body>'
      }, function(err) {
        if (err) {
          console.log('Error sending email for order return request');
          done(err, {
            type: 'error',
            message: 'Could not request a return at this time. Try again later.'
          });
        } else {
          order.save(function(err) {
            if (err) console.log('Error saving order after requesting return: ', err);
            done(err, {
              type: 'success',
              message: 'Successfully requested a return. You should receive an email shortly.'
            });
          });
        }
      });
    }
  });
}

User.methods.addAddress = function(address, make_default, done) {
  this.addresses.push(address);

  if (make_default)
    this.default_address = address.id;

  this.save(function(err) {
    if (err) console.log("Error saving user after adding new address: ", err);
    done(err);
  });
}

User.methods.updateAddress = function(address, make_default, done) {
  var arr = this.addresses.filter(function(v) {
    return v['_id'] == address.id
  });
  if (arr.length < 1) {
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

    if (make_default) {
      this.default_address = address.id;
      this.save(function(err) {
        if (err) console.log("Error updating default address for user.");
      });
    }

    arr[0].save(function(err) {
      if (err) console.log("Error saving address after update.");
      done(err);
    });
  }
}

User.methods.setDefaultAddress = function(address_id, done) {
  this.default_address = address_id;
  this.save(function(err) {
    if (err) console.log("Error changing default address: ", err);
    done(err);
  });
}

User.methods.removeAddress = function(address_id, done) {
  if (this.default_address == address_id) {
    this.default_address = undefined;
    this.save(function(err) {
      if (err) console.log("Error saving user after removing address: ", err);
    });
  }
  this.update({
    $pull: {
      addresses: address_id
    }
  }, function(err) {
    if (err) console.log("Error removing address for user: ", err);
    done(err);
  });
}

User.methods.addPaymentMethod = function(nonce, make_default, done) {
  if (!this.braintree_customer_id) {
    gateway.customer.create({
        paymentMethodNonce: nonce
      },
      function(err, result) {
        if(err)
          console.log("Error creating customer for user: ", err);
        if (result.success) {
          this.braintree_customer_id = result.customer.id;
          this.save(function(err) {
            if (err)
              console.log("Error saving BT customer id to user. ", err);
          });
          gateway.paymentMethod.update(
            result.customer.paymentMethods[0].token, {
              options: {
                makeDefault: true
              }
            }, done);
        } else {
          console.log('Could not create customer for user: ', result);
          done(err, result);
        }
      });
  } else {
    gateway.paymentMethod.create({
        customerId: this.braintree_customer_id,
        paymentMethodNonce: nonce,
        options: {
          makeDefault: make_default,
          failOnDuplicatePaymentMethod: true
        }
      }, done);
  }
}

User.methods.removePaymentMethod = function(token, done) {
  gateway.paymentMethod.delete(token, function(err) {
    if (err) console.log("Error removing payment method for user: ", err);
    done(err);
  });
}

User.methods.displayPaymentMethod = function(payment_method) {
  if (payment_method.cardType) {
    return this.cardType + ' : ' + this.maskedNumber;
  } else {
    return 'PayPal : ' + this.email;
  }
}

User.statics.sendResetEmail = function(email, done) {
  var token = uuid.v4();
  var expires = new Date();
  expires.setDate(expires.getDate() + 1);
  this.model('User').findOneAndUpdate({
    email: email
  }, {
    password_reset_token: token,
    password_reset_expiration: expires
  }, function(err, user) {
    if (err) console.log('Error updating user password reset token: ', err);
    if (!user) {
      return done(err, null);
    }
    var reset_link =
      'http://localhost:3000/user/password/reset?token=' + token;
    var sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);
    sendgrid.send({
        to: email,
        from: 'support@localhost',
        subject: 'Password Reset Request',
        html: '<body><a href="' + reset_link + '">Reset your password</a></body>'
      },
      function(err) {
        if (err)
          console.log('Error sending password reset email: ', err);
        done(err, user);
      });
  });
}

User.plugin(passportLocalMongoose, {
  usernameField: 'email',
  lastLoginField: 'date_last_login',
  populateFields: 'cart addresses'
});

module.exports = mongoose.model('User', User);
