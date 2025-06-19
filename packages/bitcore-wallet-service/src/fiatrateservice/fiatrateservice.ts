#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'fiatrateservice';

import config from '../config';
import { FiatRateService } from '../lib/fiatrateservice';
import logger from '../lib/logger';

const service = new FiatRateService();
service.init(config, err => {
  if (err) {
    logger.error('Error initializing FiatRateService:', err);
    process.exit(1);
  }
  service.startCron(config, err => {
    if (err) {
      logger.error('Error starting cron job:', err);
      process.exit(1);
    }
    logger.info('Fiat rate service started');

  });
});
