var mongoose = require('mongoose');

var Address = new mongoose.Schema({
  nickname: String,
  first_name: {
    type: String,
    required: true
  },
  last_name: {
    type: String,
    required: true
  },
  street_line_1: {
    type: String,
    required: true
  },
  street_line_2: String,
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zip_code: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  }
});

Address.statics.createNewAddress = function(address, user, done) {
  var new_address = new this({
    nickname: address.nickname,
    first_name: address.first_name,
    last_name: address.last_name,
    street_line_1: address.street_line_1,
    street_line_2: address.street_line_2,
    city: address.city,
    state: address.state,
    zip_code: address.zip_code,
    country: address.country
  });
  new_address.save(function(err) {
    if (err)
      console.log("Error saving new address: ", err);
    if (!user) {
      done(err, new_address);
    } else {
      user.addAddress(new_address, address.set_default_address, function(err) {
        if (err)
          return next(err);
        done(err, new_address);
      });
    }
  });
}

Address.virtual('displayAddress').get(function() {
  if (this.street_line_2)
    return this.first_name + ' ' + this.last_name + ' ' + this.street_line_1 + ' ' + this.street_line_2 + ' ' + this.city + ', ' + this.state + ' ' + this.zip_code + ' ' + this.country;
  return this.first_name + ' ' + this.last_name + ' ' + this.street_line_1 + ' ' + this.city + ', ' + this.state + ' ' + this.zip_code + ' ' + this.country;
});

module.exports = mongoose.model('Address', Address);
