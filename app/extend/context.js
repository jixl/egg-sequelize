'use strict';

module.exports = {
  get model() {
    const model = this.app.config.sequelize.domain.model;
    return this.app[model];
  },
};
