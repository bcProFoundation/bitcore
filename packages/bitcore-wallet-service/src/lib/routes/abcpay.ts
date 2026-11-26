import express, { Request } from 'express';
import config from '../../config';
import type * as Types from '../../types/expressapp';
import { IUser } from '../model/user';

const csvUpload = require('../csvUpload');

// AbcPay (BCPRO Foundation) routes: eTokens, swap / conversion / merchant orders,
// devices and appreciation, admin. Moved here unchanged from the former
// monolithic expressapp.ts when upstream split its routes into ./routes/*.

interface AuthenticatedRequest extends Request {
  user?: IUser;
  // below type for build in docker
  body: any;
  params: any;
}

interface FileUploadRequest extends Request {
  files?: any;
}

interface RouteContext {
  getServer: Types.GetServerFn;
  getServerWithAuth: Types.GetServerWithAuthFn;
  returnError: Types.ReturnErrorFn;
  setPublicCache: (res: express.Response, seconds: number) => void;
  passport: any;
  /** ExpressApp.start() options; some routes pass them on to the service as before */
  opts: any;
}

export function registerAbcPayRoutes(router: express.Router, context: RouteContext) {
  const { getServer, getServerWithAuth, returnError, passport } = context;
  // Same object as ExpressApp.start()'s opts: some routes below reassign it, as before.
  let opts = context.opts;
  const ONE_MINUTE = 60;
  const SetPublicCache = context.setPublicCache;

  router.get('/v2/remaining/', (req, res) => {
    const opts: { coin?: string; network?: string } = {};
    if (req.query.coin) {
      opts.coin = req.query.coin as string;
    }
    if (req.query.network) opts.network = req.query.network as string;

    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    server.getRemainingInfo(opts, (err, balance) => {
      if (err) return returnError(err, res, req);
      res.json(balance);
    });
  });

  router.get('/v1/tokens/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getTokens(opts, (err, groupToken) => {
        if (err) return returnError(err, res, req);
        res.json(groupToken);
      });
    });
  });

  router.get('/v1/utxosToken/', (req, res) => {
    getServerWithAuth(req, res, server => {
      server.getUtxosToken(opts, (err, groupToken) => {
        if (err) return returnError(err, res, req);
        res.json(groupToken);
      });
    });
  });

  router.get('/v1/txDetail/', (req, res) => {
    const txId = req.query.txId;
    getServerWithAuth(req, res, server => {
      server.getTxDetail(txId, (err, coins) => {
        if (err) return returnError(err, res, req);
        res.json(coins);
      });
    });
  });

  router.get('/v4/allfiatrates/', async (req, res) => {
    SetPublicCache(res, 5 * ONE_MINUTE);
    let server;
    try {
      server = getServer(req, res);
      const rates = await server.getAllFiatRates();
      res.json(rates);
    } catch (ex) {
      return returnError(ex, res, req);
    }
  });

  router.get('/v3/getKeyFund/', (req, res) => {
    SetPublicCache(res, 5 * ONE_MINUTE);
    let server;
    // const opts = {
    //   code: req.query.code || null,
    //   ts: req.query.ts ? +req.query.ts : null
    // };
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getKeyFund((err, key, clients) => {
      if (err) return returnError(err, res, req);
      res.json(clients);
    });
  });

  router.get('/v3/tokenInfo/', (req, res) => {
    SetPublicCache(res, 5 * ONE_MINUTE);
    let server;
    try {
      server = getServer(req, res);
    } catch (err) {
      if (err) return returnError(err, res, req);
    }
    server.getAllTokenInfo((err, tokenInfoList) => {
      if (err) returnError(err, res, req);
      res.json(tokenInfoList);
    });
  });

  router.get('/v3/configswap/', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getConfigSwapWithNoBalance((err, config) => {
      if (err) return returnError(err, res, req);
      res.json(config);
    });
  });

  router.post('/v3/login/', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    // console.log(reqServer.user);
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        server.storage.fetchKeys((err, keys: Keys) => {
          if (err) return returnError(err, res, reqServer);
          res.json({
            isVerified: true,
            isCreatePassword: keys && keys.hashPassword && keys.hashPassword.length > 0
          });
        });
      });
    }
  });

  router.post('/v3/conversion/login/', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.storage.fetchKeysConversion((err, keys: Keys) => {
        if (err) return returnError(err, res, reqServer);
        res.json({
          isVerified: true,
          isCreatePassword: keys && keys.hashPassword && keys.hashPassword.length > 0
        });
      });
    });
  });

  router.post('/v3/admin/password', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        opts = {
          password: reqServer.body.password
        };
        server.updateKeysPassword(opts, (err, recoveryKey) => {
          if (err) return returnError(err, res, reqServer);
          res.json(recoveryKey);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.post('/v3/conversion/admin/password/renew', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      opts = {
        newPassword: reqServer.body.newPassword,
        oldPassword: reqServer.body.oldPassword,
        recoveryKey: reqServer.body.recoveryKey
      };
      server.renewPasswordConversion(opts, (err, recoveryKey) => {
        if (err) return returnError(err, res, reqServer);
        res.json(recoveryKey);
      });
    });
  });

  router.post('/v3/conversion/admin/password', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    // console.log(reqServer.user);
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      opts = {
        password: reqServer.body.password
      };
      server.updateKeysPasswordConversion(opts, (err, recoveryKey) => {
        if (err) return returnError(err, res, reqServer);
        res.json(recoveryKey);
      });
    });
  });

  router.post('/v3/admin/password/verify', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    // console.log(reqServer.user);
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        opts = {
          email: reqServer.user,
          password: reqServer.body.password
        };
        server.verifyPassword(opts, (err, result) => {
          if (err) return returnError(err, res, reqServer);
          res.json(result);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.post('/v3/conversion/admin/password/verify', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      opts = {
        email: reqServer.user,
        password: reqServer.body.password
      };
      server.verifyConversionPassword(opts, (err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.post('/v3/admin/seed/import', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    // console.log(reqServer.user);
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        opts = {
          keyFund: reqServer.body.keyFund,
          keyReceive: reqServer.body.keyReceive
        };
        server.importSeed(opts, (err, result) => {
          if (err) return returnError(err, res, reqServer);
          res.json(result);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.post('/v3/conversion/admin/seed/import', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      opts = {
        keyFund: reqServer.body.keyFund
      };
      server.importSeedConversion(opts, (err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.post('/v3/conversion/restart', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.restartHandleMerchantQueue((err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.get('/v3/device', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getAllLogDevice((err, listDevice) => {
      if (err) return returnError(err, res, req);
      res.json(listDevice);
    });
  });

  router.delete('/v3/deleteDevice/:deviceId', (req, res) => {
    const deviceId = req.params['deviceId'];
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.deleteLogDevice(deviceId, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v3/device/add', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.storeLogDevice(opts, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.put('/v3/device/update', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.updateLogDevice(opts, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v3/filterAppreciation', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.getAllAppreciation(opts, (err, listAppreciation) => {
      if (err) return returnError(err, res, req);
      res.json(listAppreciation);
    });
  });

  router.get('/v3/resendAppreciationByDeviceId/:deviceId', (req, res) => {
    let server;
    const opts = {
      id: req.params['deviceId']
    };
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.resendAppreciation(opts.id, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v3/appreciation/claim', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.updateAppreciationClaim(opts, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.get('/v3/calculateGroupWeeklyActive', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.calculateGroupWeeklyActive((err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.get('/v3/createAppreciationWeekly', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.createAppreciationWeekly((err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.get('/v3/createAppreciationMonthly', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.createAppreciationMonthly((err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v3/uploadCsvMonthly', csvUpload.uploadCsv().array('file'), (req: FileUploadRequest, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    if (req.files) {
      res.json(req.files);
    }
  });

  router.post('/v3/uploadCsvWeekly', csvUpload.uploadCsv().array('file'), (req: FileUploadRequest, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    if (req.files) {
      res.json(req.files);
    }
  });

  router.post('/v3/device/checkInUpdate', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.editLogDevice(opts?.deviceId, opts?.checkIn, (err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.post('/v3/conversion/stop', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.stopHandleMerchantQueue((err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.get('/v3/conversion/order/all', (reqServer, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    const opts = reqServer.body;
    server.getAllConversionOrderInfo(opts, (err, result) => {
      if (err) return returnError(err, res, reqServer);
      res.json(result);
    });
  });

  router.post('/v3/admin/seed/check', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        server.checkingSeedExist((err, result) => {
          if (err) return returnError(err, res, reqServer);
          res.json(result);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.post('/v3/admin/restart', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.restartHandleSwapQueue((err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.get('/v3/admin/queue/check', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.checkSwapQueue((err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.post('/v3/conversion/admin/seed/check', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    server.storage.fetchUserConversionByEmail(reqServer.user, (err, user: IUser) => {
      if (err) return returnError(err, res, reqServer);
      server.checkingSeedExist((err, result) => {
        if (err) return returnError(err, res, reqServer);
        res.json(result);
      });
    });
  });

  router.post('/v3/admin/password/renew', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        opts = {
          newPassword: reqServer.body.newPassword,
          oldPassword: reqServer.body.oldPassword,
          recoveryKey: reqServer.body.recoveryKey
        };
        server.renewPassword(opts, (err, recoveryKey) => {
          if (err) return returnError(err, res, reqServer);
          res.json(recoveryKey);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.get('/v3/order/:id', (req, res) => {
    let server;
    const opts = {
      id: req.params['id']
    };
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    server.getOrderInfo(opts, (err, orderInfo) => {
      if (err) return returnError(err, res, req);
      res.json(orderInfo);
    });
  });

  router.post('/v3/order/filter', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    const opts = req.body;
    server.getAllOrderInfo(opts, (err, orderInfo) => {
      if (err) return returnError(err, res, req);
      res.json(orderInfo);
    });
  });

  router.post('/v3/order/create', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.createOrder(req.body, (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.post('/v3/conversion/create', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    server.createConversionOrder(req.body, (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.post('/v3/merchant/create', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }

    server.createMerchantOrder(req.body, (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.post('/v3/merchant/restart', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.restartHandleMerchantQueue((err, result) => {
      if (err) return returnError(err, res, req);
      res.json(result);
    });
  });

  router.get('/v3/conversion/check', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    // passing null data => only check for fund of wallet is enough for conversion , do not need to notify to user
    server.checkConversion(null, req.params['coin'], (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.get('/v3/merchant/check/:coin', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    // passing null data => only check for fund of wallet is enough for conversion , do not need to notify to user
    server.checkMerchantConversion(null, req.params['coin'], (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.get('/v3/merchant/qpayinfo', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getQpayInfo((err, info) => {
      if (err) return returnError(err, res, req);
      res.json(info);
    });
  });

  router.put('/v3/admin/order/:id', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        server.updateOrderById({ orderId: reqServer.params['id'], order: reqServer.body }, (err, order) => {
          if (err) return returnError(err, res, reqServer);
          res.json(order);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.put('/v3/admin/order/status/:id', passport.authenticate('google-id-token'), (reqServer: AuthenticatedRequest, res) => {
    let server;
    try {
      server = getServer(reqServer, res);
    } catch (ex) {
      return returnError(ex, res, reqServer);
    }
    if (reqServer.user) {
      server.storage.fetchUserByEmail(reqServer.user, (err, user: IUser) => {
        if (err) return returnError(err, res, reqServer);
        server.updateOrderStatus({ orderId: reqServer.params['id'], status: reqServer.body.status }, (err, order) => {
          if (err) return returnError(err, res, reqServer);
          res.json(order);
        });
      });
    } else {
      return returnError(new Error('Can not find user authentication'), res, reqServer);
    }
  });

  router.put('/v3/order/:id/status', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.updateOrderById({ orderId: req.params['id'], order: req.body }, (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.post('/v3/coinconfig/update/list', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.updateListCoinConfig(req.body, (err, order) => {
      if (err) return returnError(err, res, req);
      res.json(order);
    });
  });

  router.get('/v3/coinconfig', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.getListCoinConfig((err, listCoinConfig) => {
      if (err) return returnError(err, res, req);
      res.json(listCoinConfig);
    });
  });

  router.get('/v3/coinconfig/refresh/wallet', (req, res) => {
    let server;
    try {
      server = getServer(req, res);
    } catch (ex) {
      return returnError(ex, res, req);
    }
    server.rescanWalletsInKeys((err, listCoinConfig) => {
      if (err) return returnError(err, res, req);
      res.json(listCoinConfig);
    });
  });
}
