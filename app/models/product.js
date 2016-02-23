var mongoose = require('mongoose'),
    shortid = require('shortid'),
    mime = require('mime'),
    fs = require('fs'),
    Category = mongoose.model('Category');

var Variant = new mongoose.Schema({
  title: String,
  price: {
    type: Number, // floating point price * 100 ($49.00 = 4900)
    required: true
  },
  SKU: {
    type: String,
    default: shortid.generate
  },
  description: String,
  image_urls: [ String ],
  thumbnail_image_url: String,
  active: {
    type: Boolean,
    default: true
  },
  attributes: mongoose.Schema.Types.Mixed
});

var Product = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    ref: 'Category',
    trim: true,
    lowercase: true,
    required: true
  },
  variants: [ Variant ],
  active: {
    type: Boolean,
    default: true
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

Product.methods.changeThumbnail = function(variant_SKU, image_url, done) {
  if(variant_SKU == undefined)
    variant_SKU = this.variants[0].SKU;

  var arr = this.variants.filter(function(v) { return v['SKU'] == variant_SKU });
  if(arr.length < 1) {
    return done('No variant found with SKU ', variant_SKU);
  } else {
    arr[0].thumbnail_image_url = image_url;
    this.save(function(err) {
      if(err) console.log("Error changing thumbnail: ", err);
      done(err);
    });
  }
}

/* Uploads a req.file object and returns the absolute URL as a string */
function uploadImage(file) {
  var file_ext = mime.extension(file.mimetype);
  var relative_url = 'img/' + shortid.generate() + '.' + file_ext;
  var target_path = './public/' + relative_url;
  fs.renameSync(file.path, target_path);
  return 'http://localhost:3000/' + relative_url;
}

Product.methods.addImageFromFile = function(variant_SKU, file, make_thumbnail, done) {
  var absolute_url = uploadImage(file);
  if(variant_SKU == undefined) {
    if(make_thumbnail) {
      this.variants[0].thumbnail_image_url = absolute_url;
    }
    this.variants[0].image_urls.push(absolute_url);
  } else {
    var arr = this.variants.filter(function(v) { return v['SKU'] == variant_SKU });
    if(arr.length < 1) {
      return done('No variant found with SKU ', variant_SKU);
    } else {
      if(make_thumbnail) {
        arr[0].thumbnail_image_url = absolute_url;
      }
      arr[0].image_urls.push(absolute_url);
    }
  }
  this.save(function(err) {
    if(err) console.log("Error adding image from file ", err);
    done(err);
  });
}

Product.methods.removeImage = function(variant_SKU, image_url, done) {
  if(variant_SKU == undefined) {
    variant_SKU = this.variants[0].SKU;
  }

  var arr = this.variants.filter(function(v) { return v['SKU'] == variant_SKU });
  if(arr.length < 1) {
    return done('No variant found with SKU ', variant_SKU);
  } else {
    var index = arr[0].image_urls.indexOf(image_url);
    if(index >= 0) {
      arr[0].image_urls.splice(index, 1);
    }
    this.save(function(err) {
      if(err) console.log("Error removing image for product ", err);
      done(err);
    });
  }
}

Product.methods.addVariant = function(variant, image_file, done) {
  if(variant.SKU == '')
    variant.SKU = shortid.generate();
  var absolute_url = uploadImage(image_file);
  variant.image_urls = [ absolute_url ];
  variant.thumbnail_image_url = absolute_url;
  this.variants.push(variant);
  this.save(function(err) {
    if(err) console.log("Error adding variant to product ", err);
    done(err);
  });
}

Product.methods.updateVariant = function(variant, done) {
  this.update({ $pull: { variants: { SKU: variant.SKU } } }, function(err) {
    if(err) console.log("Error pulling variant from product ", err);
    this.variants.push(variant);
    done(err);
  });
}

Product.methods.removeVariant = function(variant_SKU, done) {
  this.update({ $pull: { variants: { SKU: variant_SKU } } }, function(err) {
    if(err) console.log("Error removing variant for product ", err);
    done(err);
  });
}

Product.methods.getVariant = function(variant_SKU) {
  var arr = this.variants.filter(function(v) { return v['SKU'] == variant_SKU });
  if(arr.length < 1) {
    return undefined;
  }
  return arr[0];
}

Product.virtual('realPrice').get(function() {
  return (this.variants[0].price / 100).toFixed(2);
});

// Human-readable string form of price (e.g. "$25.00")
Product.virtual('displayPrice').get(function () {
  // TODO add currency support
  return '$' + (this.variants[0].price / 100).toFixed(2);
});

module.exports = mongoose.model('Product', Product);
