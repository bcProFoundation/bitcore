#!/usr/bin/env node

process.env.LOGGER_IDENTIFIER = 'fiatrateservice';

import config from '../config';
import { FiatRateService } from '../lib/fiatrateservice';
import logger from '../lib/logger';

console.log('🚀 Starting Fiat Rate Service...');

const service = new FiatRateService();

console.log('📡 Initializing service...');

service.init(config, err => {
  if (err) {
    console.error('❌ Error initializing FiatRateService:', err);
    logger.error('Error initializing FiatRateService:', err);
    process.exit(1);
  }

  console.log('✅ Service initialized successfully');

  service.startCron(config, err => {
    if (err) {
      logger.error('Error starting cron job:', err);
      process.exit(1);
    }

    logger.info('Fiat rate service started');

    // Give time for logs to flush before exiting
    setTimeout(() => {
      process.exit(0);
    }, 30000);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
