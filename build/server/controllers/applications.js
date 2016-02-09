// Generated by CoffeeScript 1.10.0
var Application, Manifest, NotificationsHelper, appHelpers, async, autostop, baseIdController, cozydb, exec, fs, icons, localizationManager, log, manager, market, request, sendError, slugify, startedApplications;

request = require('request-json');

fs = require('fs');

slugify = require('cozy-slug');

exec = require('child_process').exec;

async = require('async');

cozydb = require('cozydb');

log = require('printit')({
  date: true,
  prefix: "applications"
});

Application = require('../models/application');

NotificationsHelper = require('cozy-notifications-helper');

localizationManager = require('../helpers/localization_manager');

manager = require('../lib/paas').get();

Manifest = require('../lib/manifest').Manifest;

market = require('../lib/market');

autostop = require('../lib/autostop');

icons = require('../lib/icon');

appHelpers = require('../lib/applications');

startedApplications = {};

sendError = function(res, err, code) {
  if (code == null) {
    code = 500;
  }
  if (err == null) {
    err = {
      stack: null,
      message: localizationManager.t("server error")
    };
  }
  log.info("Sending error to client :");
  log.error(err);
  return res.send(code, {
    error: true,
    success: false,
    message: err.message || err,
    stack: err.stack
  });
};

baseIdController = new cozydb.SimpleController({
  model: Application,
  reqProp: 'application',
  reqParamID: 'id'
});

module.exports = {
  loadApplicationById: baseIdController.find,
  loadApplication: function(req, res, next, slug) {
    return Application.all({
      key: req.params.slug
    }, function(err, apps) {
      if (err) {
        return next(err);
      } else if (apps === null || apps.length === 0) {
        return res.send(404, {
          error: localizationManager.t('app not found')
        });
      } else {
        req.application = apps[0];
        return next();
      }
    });
  },
  applications: function(req, res, next) {
    return Application.all(function(err, apps) {
      if (err) {
        return next(err);
      } else {
        return res.send({
          rows: apps
        });
      }
    });
  },
  getPermissions: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var app;
      if (err) {
        return next(err);
      }
      app = {
        permissions: manifest.getPermissions()
      };
      return res.send({
        success: true,
        app: app
      });
    });
  },
  getDescription: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var app;
      if (err) {
        return next(err);
      }
      app = {
        description: manifest.getDescription()
      };
      return res.send({
        success: true,
        app: app
      });
    });
  },
  getMetaData: function(req, res, next) {
    var manifest;
    manifest = new Manifest();
    return manifest.download(req.body, function(err) {
      var metaData;
      if (err) {
        return next(err);
      }
      metaData = manifest.getMetaData();
      return res.send({
        success: true,
        app: metaData
      }, 200);
    });
  },
  read: function(req, res, next) {
    return Application.find(req.params.id, function(err, app) {
      if (err) {
        return sendError(res, err);
      } else if (app === null) {
        err = new Error(localizationManager.t('app not found'));
        return sendError(res, err, 404);
      } else {
        return res.send(app);
      }
    });
  },
  icon: function(req, res, next) {
    var iconPath, ref, ref1, ref2, ref3, stream;
    if ((ref = req.application) != null ? (ref1 = ref._attachments) != null ? ref1['icon.svg'] : void 0 : void 0) {
      stream = req.application.getFile('icon.svg', function() {});
      stream.pipefilter = function(res, dest) {
        return dest.set('Content-Type', 'image/svg+xml');
      };
      return stream.pipe(res);
    } else if ((ref2 = req.application) != null ? (ref3 = ref2._attachments) != null ? ref3['icon.png'] : void 0 : void 0) {
      res.type('png');
      stream = req.application.getFile('icon.png', function() {});
      return stream.pipe(res);
    } else {
      iconPath = './client/app/assets/img/default.svg';
      stream = fs.createReadStream(iconPath);
      stream.pipefilter = function(res, dest) {
        return dest.set('Content-Type', 'image/svg+xml');
      };
      return stream.pipe(res);
    }
  },
  updateData: function(req, res, next) {
    var Stoppable, app, changes;
    app = req.application;
    if ((req.body.isStoppable != null) && req.body.isStoppable !== app.isStoppable) {
      Stoppable = req.body.isStoppable;
      Stoppable = Stoppable != null ? Stoppable : app.isStoppable;
      changes = {
        homeposition: req.body.homeposition || app.homeposition,
        isStoppable: Stoppable
      };
      return app.updateAttributes(changes, function(err, app) {
        autostop.restartTimeout(app.name);
        if (err) {
          return sendError(res, err);
        }
        return res.send(app);
      });
    } else if ((req.body.favorite != null) && req.body.favorite !== app.favorite) {
      changes = {
        favorite: req.body.favorite
      };
      return app.updateAttributes(changes, function(err, app) {
        if (err) {
          return next(err);
        }
        return res.send(app);
      });
    } else {
      return res.send(app);
    }
  },
  install: function(req, res, next) {
    var access;
    req.body.slug = req.body.slug || slugify(req.body.name);
    req.body.state = "installing";
    access = {
      password: appHelpers.newAccessToken()
    };
    return Application.all({
      key: req.body.slug
    }, function(err, apps) {
      var manifest;
      if (err) {
        return sendError(res, err);
      }
      if (apps.length > 0 || req.body.slug === "proxy" || req.body.slug === "home" || req.body.slug === "data-system") {
        err = new Error(localizationManager.t("similarly named app"));
        return sendError(res, err, 400);
      }
      manifest = new Manifest();
      return manifest.download(req.body, function(err) {
        if (err) {
          return sendError(res, err);
        }
        access.permissions = manifest.getPermissions();
        access.slug = req.body.slug;
        req.body.widget = manifest.getWidget();
        req.body.version = manifest.getVersion();
        req.body.color = manifest.getColor();
        req.body.state = 'installing';
        req.body.type = manifest.getType();
        return Application.create(req.body, function(err, appli) {
          if (err) {
            return sendError(res, err);
          }
          access.app = appli.id;
          return Application.createAccess(access, function(err, app) {
            if (err) {
              return sendError(res, err);
            }
            res.send({
              success: true,
              app: appli
            }, 201);
            return appHelpers.install(appli, manifest, access);
          });
        });
      });
    });
  },
  uninstall: function(req, res, next) {
    var removeMetadata;
    req.body.slug = req.params.slug;
    removeMetadata = function(result) {
      return req.application.destroyAccess(function(err) {
        if (err) {
          log.warn(err);
        }
        return req.application.destroy(function(err) {
          if (err) {
            return sendError(res, err);
          }
          manager.resetProxy(function(err) {
            if (err) {
              return sendError(res, err);
            }
          });
          return res.send({
            success: true,
            msg: localizationManager.t('successfuly uninstalled')
          });
        });
      });
    };
    return manager.uninstallApp(req.application, function(err, result) {
      if (err) {
        return manager.uninstallApp(req.application, function(err, result) {
          return removeMetadata(result);
        });
      } else {
        return removeMetadata(result);
      }
    });
  },
  update: function(req, res, next) {
    return appHelpers.update(req.application, function(err) {
      if (err != null) {
        return appHelpers.markBroken(req.application, err);
      }
      return res.send({
        success: true,
        msg: localizationManager.t('successfuly updated')
      });
    });
  },
  updateAll: function(req, res, next) {
    var broken, error, updateApps;
    error = {};
    broken = function(app, err, cb) {
      var data;
      log.warn("Marking app " + app.name + " as broken because");
      log.raw(err);
      data = {
        state: 'broken',
        password: null
      };
      if (err.result != null) {
        data.errormsg = err.message + ' :\n' + err.result;
      } else {
        data.errormsg = err.message + ' :\n' + err.stack;
      }
      return app.updateAttributes(data, function(saveErr) {
        if (saveErr != null) {
          log.error(saveErr);
        }
        return cb();
      });
    };
    updateApps = function(app, callback) {
      var manifest;
      manifest = new Manifest();
      return manifest.download(app, function(err) {
        if (err != null) {
          return sendError(res, {
            message: err
          });
        } else {
          return app.getAccess(function(err, access) {
            var ref;
            if (err != null) {
              return sendError(res, {
                message: err
              });
            } else {
              if (JSON.stringify(access.permissions) !== JSON.stringify(manifest.getPermissions())) {
                return callback();
              }
              if ((app.needsUpdate != null) && app.needsUpdate || app.version !== manifest.getVersion()) {
                if ((ref = app.state) === "installed" || ref === "stopped") {
                  log.info("Update " + app.name + " (" + app.state + ")");
                  return appHelpers.update(app, function(err) {
                    if (err != null) {
                      error[app.name] = err;
                      return broken(app, err, callback);
                    } else {
                      return callback();
                    }
                  });
                } else {
                  return callback();
                }
              } else {
                return callback();
              }
            }
          });
        }
      });
    };
    return Application.all(function(err, apps) {
      return async.forEachSeries(apps, updateApps, function() {
        if (Object.keys(error).length > 0) {
          return sendError(res, {
            message: error
          });
        } else {
          return res.send({
            success: true,
            msg: localizationManager.t('successfuly updated')
          });
        }
      });
    });
  },
  start: function(req, res, next) {
    var data;
    setTimeout(function() {
      if (startedApplications[req.application.id] != null) {
        delete startedApplications[req.application.id];
        return appHelpers.markBroken(req.application, {
          stack: "Installation timeout",
          message: "Installation timeout"
        });
      }
    }, 45 * 1000);
    if (startedApplications[req.application.id] == null) {
      startedApplications[req.application.id] = true;
      req.application.password = appHelpers.newAccessToken();
      data = {
        password: req.application.password
      };
      return req.application.updateAccess(data, function(err) {
        return manager.start(req.application, function(err, result) {
          if (err && err !== localizationManager.t("not enough memory")) {
            delete startedApplications[req.application.id];
            return appHelpers.markBroken(req.application, err);
          } else if (err) {
            delete startedApplications[req.application.id];
            data = {
              errormsg: err,
              state: 'stopped'
            };
            return req.application.updateAttributes(data, function(saveErr) {
              if (saveErr) {
                return sendError(res, saveErr);
              }
              return res.send({
                app: req.application,
                error: true,
                success: false,
                message: err.message,
                stack: err.stack
              }, 500);
            });
          } else {
            data = {
              state: 'installed',
              port: result.drone.port
            };
            return req.application.updateAttributes(data, function(err) {
              if (err) {
                delete startedApplications[req.application.id];
                return appHelpers.markBroken(req.application, err);
              }
              return manager.resetProxy(function(err) {
                delete startedApplications[req.application.id];
                if (err) {
                  return appHelpers.markBroken(req.application, err);
                } else {
                  return res.send({
                    success: true,
                    msg: localizationManager.t('running'),
                    app: req.application
                  });
                }
              });
            });
          }
        });
      });
    } else {
      return res.send({
        error: true,
        msg: localizationManager.t('application is already starting'),
        app: req.application
      });
    }
  },
  stop: function(req, res, next) {
    return manager.stop(req.application, function(err, result) {
      var data;
      if (err) {
        return appHelpers.markBroken(req.application, err);
      }
      data = {
        state: 'stopped',
        port: 0
      };
      return req.application.updateAttributes(data, function(err) {
        if (err) {
          return sendError(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return appHelpers.markBroken(req.application, err);
          }
          return res.send({
            success: true,
            msg: localizationManager.t('application stopped'),
            app: req.application
          });
        });
      });
    });
  },
  changeBranch: function(req, res, next) {
    var app, branch, err, manifest;
    branch = req.params.branch;
    manifest = new Manifest();
    app = req.application;
    if (app.branch === branch) {
      err = new Error("This application is already on branch " + branch);
      return sendError(res, err);
    }
    app.branch = branch;
    return manifest.download(app, (function(_this) {
      return function(err) {
        var access, data, error1, iconInfos, infos;
        if (err != null) {
          return callback(err);
        } else {
          app.password = app.helpers.newAccessToken();
          access = {
            permissions: manifest.getPermissions(),
            slug: app.slug,
            password: app.password
          };
          data = {
            widget: manifest.getWidget(),
            version: manifest.getVersion(),
            iconPath: manifest.getIconPath(),
            color: manifest.getColor(),
            needsUpdate: false
          };
          try {
            infos = {
              git: app.git,
              name: app.name,
              icon: app.icon,
              iconPath: data.iconPath,
              slug: app.slug
            };
            iconInfos = icons.getIconInfos(infos);
          } catch (error1) {
            err = error1;
            iconInfos = null;
          }
          data.iconType = (iconInfos != null ? iconInfos.extension : void 0) || null;
          return app.updateAccess(access, function(err) {
            if (err != null) {
              return callback(err);
            }
            return manager.changeBranch(app, branch, function(err, result) {
              if (err) {
                return sendError(res, err);
              }
              data.branch = branch;
              return app.updateAttributes(data, function(err) {
                return icons.save(app, iconInfos, function(err) {
                  if (err) {
                    log.error(err);
                  } else {
                    log.info('icon attached');
                  }
                  return manager.resetProxy(function() {
                    return res.send({
                      success: true,
                      msg: 'Branch succesfuly changed'
                    });
                  });
                });
              });
            });
          });
        }
      };
    })(this));
  },
  fetchMarket: function(req, res, next) {
    return market.getApps(function(err, data) {
      if (err != null) {
        return res.send({
          error: true,
          success: false,
          message: err
        }, 500);
      } else {
        return res.send(200, data);
      }
    });
  },
  getToken: function(req, res, next) {
    return Application.all({
      key: req.params.name
    }, function(err, apps) {
      if (err) {
        return sendError(res, err);
      }
      return Application.getToken(apps[0]._id, function(err, access) {
        if (err != null) {
          return res.send({
            error: true,
            success: false,
            message: err
          }, 500);
        } else {
          return res.send(200, access.token);
        }
      });
    });
  }
};
