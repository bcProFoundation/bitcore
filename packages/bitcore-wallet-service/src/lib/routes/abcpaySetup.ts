import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import config from '../../config';
import listAccount from '../../accounts.json';
import { logger } from '../logger';
import { WalletService } from '../server';

const passport = require('passport');
const GoogleTokenStrategy = require('passport-google-id-token');
const TelegramBot = require('node-telegram-bot-api');

const allowedOrigins = config.allowedOrigins;

// AbcPay (BCPRO Foundation) app setup, moved unchanged from the former
// monolithic expressapp.ts: Google sign-in for the admin routes, CORS allow-list,
// and the Telegram bots / swap queues started once the service is initialized.

export { passport };

export function setupAbcPayMiddleware(app: express.Express) {
  const self = { app };
  // var GoogleTokenStrategy = require('passport-google-id-token');
  // self.app.use(require('serve-static')(__dirname + '/../../public'));
  // self.app.use(require('cookie-parser')());
  // Google sign-in (passport + express-session) is only used by the AbcPay admin and
  // conversion routes. Keep it off the other routes: upstream's TSS routes use req.session
  // for the TSS session object, which express-session would otherwise own.
  const onlyForAbcPayAuth = (mw: express.RequestHandler): express.RequestHandler =>
    (req, res, next) => (/\/v3\/(login|conversion|admin)(\/|$)/.test(req.path) ? mw(req, res, next) : next());
  self.app.use(require('body-parser').urlencoded({ extended: true }));
  self.app.use(onlyForAbcPayAuth(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true })));
  self.app.use(onlyForAbcPayAuth(passport.initialize()));
  self.app.use(onlyForAbcPayAuth(passport.session()));
  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  // passport.deserializeUser(function(id, done) {
  //   // User.findById(id, function(err, user) {
  //   //   done(err, id);
  //   // });
  //   done(null, id);
  // });
  passport.use(
    new GoogleTokenStrategy(
      {
        clientID: '287411092309-vovtceqbolmrn2krv8knpt0ovpa4u4ta.apps.googleusercontent.com'
      },
      function (parsedToken, googleId, done) {
        // User.findOrCreate({ googleId: googleId }, function (err, user) {
        //   return done(err, user);
        // });
        // logger.debug(parsedToken);
        // logger.debug(googleId);
        // passport.serializeUser(function(parsedToken, done) {
        return done(null, parsedToken.payload.email);
        // });
      }
    )
  );
  // CORS allow-list from config.allowedOrigins. When it is not configured, keep upstream's
  // open CORS headers instead of failing every request that carries an Origin header.
  if (Array.isArray(allowedOrigins)) self.app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  }));
  // Path kept the same as before: <package>/public/csv
  app.use(express.static(`${__dirname}/../../../../public/csv/`));
}

export function startAbcPayServices(opts) {
  if (!config.telegram?.botTokenId || !config.botNotification?.botTokenId || !config.swapTelegram?.botTokenId) {
    // Deployments set these in bws.config.js / bitcore.config.json. Without them (tests, local runs)
    // the AbcPay bots and swap/conversion queues are not started.
    logger.warn('AbcPay services not started: telegram, botNotification and swapTelegram bot tokens are not configured');
    return;
  }
  const bot = new TelegramBot(config.telegram.botTokenId, { polling: false });
  const botNotification = new TelegramBot(config.botNotification.botTokenId, { polling: false });
  const botSwap = new TelegramBot(config.swapTelegram.botTokenId, { polling: false });
  const server = WalletService.getInstance(opts);
  if (listAccount && listAccount.length > 0) {
    listAccount.forEach(account => {
      server.storage.storeUser(
        {
          email: account
        },
        (err, user) => {
          if (err) logger.debug(err);
        }
      );

      server.storage.storeUserConversion(
        {
          email: account
        },
        (err, user) => {
          if (err) logger.debug(err);
        }
      );
    });
  }

  server.createBot({ bot, botNotification, botSwap }, finish => {
    server.initializeBot();
  });
  server.initializeCoinConfig(err => {
    if (err) logger.error(err);
    // Start cron job to update daily limit usage for coin config at midnght everyday to 0
    cron.schedule('0 0 * * *', () => {
      server.storage.resetAllDailyLimitUsageInCoinConfig((err, resulst) => {
        if (err) logger.debug('reset daily limit usage for coin config got error', err);
      });
    });
  });
  setTimeout(() => {
    server.checkOrderInSwapQueue();
    server.initCheckQueue();
  }, 10000);
}
