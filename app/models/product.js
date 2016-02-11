var mongoose = require('mongoose'),
    shortid = require('shortid'),
    Schema = mongoose.Schema,
    Category = mongoose.model('Category');

var Product = new Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number, // floating point price * 100 ($49.00 = 4900)
    required: true
  },
  SKU: {
    type: String,
    default: shortid.generate
  },
  pictures: [String],
  category: {
    type: String,
    ref: 'Category',
    trim: true,
    lowercase: true,
    required: true
  },
  description: String,
  thumbnail_image_url: String,
  active: Boolean,
  date_created: {
    type: Date,
    default: Date.now
  },
  date_updated: {
    type: Date,
    default: Date.now
  }
});

Product.post('init', function(product) {
  Category.findById(product.category, function(err, category) {
    if(err) console.log("Error finding category: ", err);
    if(!category) {
      var category = new Category({
        _id: product.category
      });
      category.save(function(err) {
        if(err) console.log("Error saving category: ", err);
      });
    }
  });
});

Product.pre('update', function(next) {
  this.date_updated = new Date();
  next();
});

Product.virtual('realPrice').get(function() {
  return (this.price / 100).toFixed(2);
});

// Human-readable string form of price (e.g. "$25.00")
Product.virtual('displayPrice').get(function () {
  // TODO add currency support
  return '$' + (this.price / 100).toFixed(2);
});

module.exports = mongoose.model('Product', Product);
