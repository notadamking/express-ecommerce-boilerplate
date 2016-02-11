var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Category = new Schema({
  _id: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  parent: {
    type: String,
    ref: 'Category'
  },
  ancestors: [{
    type: String,
    ref: 'Category'
  }]
});

module.exports = mongoose.model('Category', Category);
