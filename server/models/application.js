// Generated by CoffeeScript 1.6.2
var Application, americano;

americano = require('americano-cozy');

module.exports = Application = americano.getModel('Application', {
  name: String,
  displayName: String,
  description: String,
  slug: String,
  state: String,
  isStoppable: {
    type: Boolean,
    "default": false
  },
  date: {
    type: Date,
    "default": Date.now
  },
  icon: String,
  git: String,
  errormsg: String,
  branch: String,
  port: Number,
  permissions: Object,
  password: String,
  homeposition: Object,
  widget: String,
  _attachments: Object
});

Application.all = function(params, callback) {
  return Application.request("bySlug", params, callback);
};

Application.destroyAll = function(params, callback) {
  return Application.requestDestroy("all", params, callback);
};

Application.prototype.getHaibuDescriptor = function() {
  var descriptor;

  descriptor = {
    user: this.slug,
    name: this.slug,
    domain: "127.0.0.1",
    repository: {
      type: "git",
      url: this.git
    },
    scripts: {
      start: "server.coffee"
    },
    password: this.password
  };
  if ((this.branch != null) && this.branch !== "null") {
    descriptor.repository.branch = this.branch;
  }
  return descriptor;
};
