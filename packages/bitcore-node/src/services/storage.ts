import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { FindCursor, ObjectId } from 'mongodb-legacy';
import { Db, MongoClient } from 'mongodb-legacy';
import { Readable, Transform } from 'stream';
import { LoggifyClass } from '../decorators/Loggify';
import logger from '../logger';
import '../models';
import { MongoBound } from '../models/base';
import { ConfigType } from '../types/Config';
import { StreamingFindOptions } from '../types/Query';
import { TransformableModel } from '../types/TransformableModel';
import { wait } from '../utils';
import { Config, ConfigService } from './config';

export { StreamingFindOptions };

@LoggifyClass
export class StorageService {
  client?: MongoClient;
  db?: Db;
  connected: boolean = false;
  connection = new EventEmitter();
  configService: ConfigService;
  modelsConnected = new Array<Promise<any>>();

  constructor({ configService = Config } = {}) {
    this.configService = configService;
    this.connection.setMaxListeners(30);
  }

  start(args: Partial<ConfigType> = {}): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      let options = Object.assign({}, this.configService.get(), args);
      let { dbUrl, dbName, dbHost, dbPort, dbUser, dbPass, dbReadPreference } = options;
      let auth = dbUser !== '' && dbPass !== '' ? `${dbUser}:${dbPass}@` : '';
      const connectUrl = dbUrl
        ? dbUrl
        : `mongodb://${auth}${dbHost}:${dbPort}/${dbName}?socketTimeoutMS=3600000&noDelay=true${dbReadPreference ? `?readPreference=${dbReadPreference}` : ''}`;
      let attemptConnect = async () => {
        return MongoClient.connect(connectUrl, {
          maxPoolSize: options.maxPoolSize || 50,
          minPoolSize: 1,
          maxIdleTimeMS: 30000,
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 30000,
          connectTimeoutMS: 10000,
          heartbeatFrequencyMS: 10000,
          retryWrites: true
        });
      };
      let attempted = 0;
      let attemptConnectId = setInterval(async () => {
        try {
          this.client = await attemptConnect();

          // Add connection pool monitoring
          this.client.on('connectionPoolCreated', (event) => {
            logger.info('Connection pool created:', event);
          });

          this.client.on('connectionPoolClosed', (event) => {
            logger.warn('Connection pool closed:', event);
          });

          this.client.on('connectionCreated', (event) => {
            logger.debug('Connection created:', { connectionId: event.connectionId });
          });

          this.client.on('connectionClosed', (event) => {
            logger.warn('Connection closed:', {
              connectionId: event.connectionId,
              reason: event.reason
            });
          });

          this.client.on('connectionPoolCleared', (event) => {
            logger.error('Connection pool cleared:', event);
          });


          this.db = this.client.db(dbName);
          this.connected = true;
          clearInterval(attemptConnectId);
          this.connection.emit('CONNECTED');
          resolve(this.client);
        } catch (err: any) {
          logger.error('%o', err);
          attempted++;
          if (attempted > 5) {
            clearInterval(attemptConnectId);
            reject(new Error('Failed to connect to database'));
          }
        }
      }, 5000);
    });
  }

  async stop() {
    if (this.client) {
      logger.info('Stopping Storage Service');
      await wait(5000);
      this.connected = false;
      await Promise.all(this.modelsConnected);
      await this.client.close();
      this.connection.emit('DISCONNECTED');
    }
  }

  validPagingProperty<T>(model: TransformableModel<T>, property: keyof MongoBound<T>) {
    const defaultCase = property === '_id';
    return defaultCase || model.allowedPaging.some(prop => prop.key === property);
  }

  /**
   * castForDb
   *
   * For a given model, return the typecasted value based on a key and the type associated with that key
   */
  typecastForDb<T>(model: TransformableModel<T>, modelKey: keyof MongoBound<T>, modelValue: T[keyof T] | ObjectId) {
    let typecastedValue = modelValue;
    if (modelKey) {
      let oldValue = modelValue as any;
      let optionsType = model.allowedPaging.find(prop => prop.key === modelKey);
      if (optionsType) {
        switch (optionsType.type) {
          case 'number':
            typecastedValue = Number(oldValue) as any;
            break;
          case 'string':
            typecastedValue = (oldValue || '').toString() as any;
            break;
          case 'date':
            typecastedValue = new Date(oldValue) as any;
            break;
        }
      } else if (modelKey == '_id') {
        typecastedValue = new ObjectId(oldValue) as any;
      }
    }
    return typecastedValue;
  }

  stream(input: Readable, req: Request, res: Response) {
    let closed = false;
    req.on('close', function () {
      closed = true;
    });
    res.on('close', function () {
      closed = true;
    });
    input.on('error', function (err) {
      if (!closed) {
        closed = true;
        return res.status(500).end(err.message);
      }
      return;
    });
    let isFirst = true;
    res.type('json');
    input.on('data', function (data) {
      if (!closed) {
        if (isFirst) {
          res.write('[\n');
          isFirst = false;
        } else {
          res.write(',\n');
        }
        res.write(JSON.stringify(data));
      }
    });
    input.on('end', function () {
      if (!closed) {
        if (isFirst) {
          // there was no data
          res.write('[]');
        } else {
          res.write('\n]');
        }
        res.end();
      }
    });
  }

  apiStream(cursor: Readable, req: Request, res: Response) {
    let closed = false;
    req.on('close', function () {
      closed = true;
      cursor.destroy();
    });
    res.on('close', function () {
      closed = true;
      cursor.destroy();
    });
    cursor.on('error', function (err) {
      if (!closed) {
        closed = true;
        return res.status(500).end(err.message);
      }
      return;
    });
    let isFirst = true;
    res.type('json');
    cursor.on('data', function (data) {
      if (!closed) {
        if (isFirst) {
          res.write('[\n');
          isFirst = false;
        } else {
          res.write(',\n');
        }
        res.write(data);
      } else {
        cursor.destroy();
      }
    });
    cursor.on('end', function () {
      if (!closed) {
        if (isFirst) {
          // there was no data
          res.write('[]');
        } else {
          res.write('\n]');
        }
        res.end();
      }
    });
  }
  getFindOptions<T>(model: TransformableModel<T>, originalOptions: StreamingFindOptions<T>) {
    let query: any = {};
    let since: any = null;
    let options: StreamingFindOptions<T> = {};

    if (originalOptions.sort) {
      options.sort = originalOptions.sort;
    }
    if (originalOptions.paging && this.validPagingProperty(model, originalOptions.paging)) {
      if (originalOptions.since !== undefined) {
        since = this.typecastForDb(model, originalOptions.paging, originalOptions.since);
      }
      if (originalOptions.direction && Number(originalOptions.direction) === 1) {
        if (since) {
          query[originalOptions.paging] = { $gt: since };
        }
        options.sort = Object.assign({}, originalOptions.sort, { [originalOptions.paging]: 1 });
      } else {
        if (since) {
          query[originalOptions.paging] = { $lt: since };
        }
        options.sort = Object.assign({}, originalOptions.sort, { [originalOptions.paging]: -1 });
      }
    }
    if (originalOptions.limit) {
      options.limit = Number(originalOptions.limit);
    }
    return { query, options };
  }

  apiStreamingFind<T>(
    model: TransformableModel<T>,
    originalQuery: any,
    originalOptions: StreamingFindOptions<T>,
    req: Request,
    res: Response,
    transform?: (data: T) => string | Buffer
  ) {
    const { query, options } = this.getFindOptions(model, originalOptions);
    const finalQuery = Object.assign({}, originalQuery, query);
    let cursor = model.collection
      .find(finalQuery, options)
      .addCursorFlag('noCursorTimeout', true) as FindCursor<any>;

    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }

    const stream = cursor.stream();

    const transformStream = new Transform({
      objectMode: true,
      transform: (doc, _, callback) => {
        try {
          const transformed = (transform || model._apiTransform.bind(model))(doc);
          callback(null, transformed);
        } catch (err) {
          callback(err as Error);
        }
      }
    });

    return this.apiStream(stream.pipe(transformStream), req, res);
  }
}

export let Storage = new StorageService();
