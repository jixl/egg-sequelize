'use strict';

const path = require('path');
const Sequelize = require('sequelize');
const MODELS = Symbol('loadedModels');
const chalk = require('chalk');

Sequelize.prototype.log = function() {
  if (this.options.logging === false) { return; }
  const args = Array.prototype.slice.call(arguments);
  const sql = args[0].replace(/Executed \(.+?\):\s{0,1}/, '');
  this.options.logging.info('[model]', chalk.magenta(sql), `(${args[1]}ms)`);
};

module.exports = app => {
  const defaultConfig = {
    logging: app.logger,
    host: 'localhost',
    port: 3306,
    username: 'root',
    benchmark: true,
    define: {
      freezeTableName: false,
      underscored: true,
    },
    domain: {
      model: 'model',
      dir: 'app/model',
    },
  };
  const config = Object.assign(defaultConfig, app.config.sequelize);

  app.Sequelize = Sequelize;

  // app.createSequelizeInstance
  Object.defineProperty(app, 'createSequelizeInstance', {
    value(seqConfig) {
      const newConfig = Object.assign({}, config, seqConfig);
      return createInstance(app, newConfig);
    },
    writable: false,
    configurable: false,
  });
  app.logger.debug('load egg-sequelize plug and add method createSequelizeInstance to app');

  createInstance(app, config);

  app.beforeStart(function* () {
    yield app[config.domain.model].authenticate();
  });
};

function createInstance(app, config) {
  const domain = config.domain;
  const sequelize = new Sequelize(config.database, config.username, config.password, config);

  // app.sequelize
  Object.defineProperty(app, domain.model, {
    value: sequelize,
    writable: false,
    configurable: false,
  });
  app.logger.debug(`egg-sequelize define domain model ${domain}`);

  loadModel(app, domain);
}

function loadModel(app, { model, dir }) {
  const modelDir = path.join(app.baseDir, dir);

  app.loader.loadToApp(modelDir, MODELS, {
    inject: app,
    caseStyle: 'upper',
    ignore: 'index.js',
    initializer(exports, opt) {
      app.logger.debug(`egg-sequelize initializer load model toApp ${opt}`);
      if (exports instanceof Function) {
        exports = exports(app, app[model]);
      }
      return exports;
    },
  });

  for (const name of Object.keys(app[MODELS])) {
    const klass = app[MODELS][name];

    // only this Sequelize Model class
    if ('sequelize' in klass) {
      app[model][name] = klass;

      if ('classMethods' in klass.options || 'instanceMethods' in klass.options) {
        app.logger.error(`${name} model has classMethods/instanceMethods, but it was removed supports in Sequelize V4.\
            see: http://docs.sequelizejs.com/manual/tutorial/models-definition.html#expansion-of-models`);
      }
    }
  }

  for (const name of Object.keys(app[model])) {
    const klass = app[model][name];

    if ('associate' in klass) {
      klass.associate();
    }
  }
}
