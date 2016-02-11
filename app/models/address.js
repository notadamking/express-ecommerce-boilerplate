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
      type: Number,
      required: true
    },
    country: {
      type: String,
      required: true
    }
});

Address.virtual('displayAddress').get(function () {
    if(this.street_line_2)
      return this.first_name + ' ' + this.last_name + ' ' + this.street_line_1
        + ' ' + this.street_line_2 + ' ' + this.city + ', ' + this.state
        + ' ' + this.zip_code + ' ' + this.country;
    return this.first_name + ' ' + this.last_name + ' ' + this.street_line_1
      + ' ' + this.city + ', ' + this.state + ' ' + this.zip_code + ' '
      + this.country;
});

module.exports = mongoose.model('Address', Address);
