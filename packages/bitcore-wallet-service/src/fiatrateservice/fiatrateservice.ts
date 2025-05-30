#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'fiatrateservice';

import config from '../config';
import { FiatRateService } from '../lib/fiatrateservice';
import logger from '../lib/logger';

const service = new FiatRateService();
service.init(config, err => {
  if (err) {
    console.error('DEBUGPRINT[227]: fiatrateservice.ts:11: err=%o', err)
  };
  service.startCron(config, err => {
    console.error(`DEBUGPRINT[228]: fiatrateservice.ts:14: err=%o`, err)
    if (err) throw err;

    logger.info('Fiat rate service started');
  });
});
