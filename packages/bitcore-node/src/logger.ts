import * as winston from 'winston';
import 'winston-daily-rotate-file';
import parseArgv from './utils/parseArgv';
let args = parseArgv([], ['DEBUG']);
const logLevel = args.DEBUG ? 'debug' : 'info';
const logger = winston.createLogger({
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'bitcore-node-%DATE%.log',
      handleExceptions: true,
      level: logLevel,
      maxSize: '40m',
      maxFiles: '14d',
      dirname: './logs'
    })
  ],
  exceptionHandlers: [new winston.transports.File({ filename: 'exceptions.log', dirname: './logs' })],
  exitOnError: false
});

const timezone = new Date()
  .toLocaleString('en-US', { timeZoneName: 'short' })
  .split(' ')
  .pop();

export const formatTimestamp = (date: Date) =>
  `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
    .getDate()
    .toString()
    .padStart(2, '0')} ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}.${date
    .getMilliseconds()
    .toString()
    .padEnd(3, '0')} ${timezone}`;

export const timestamp = () => formatTimestamp(new Date());

export default logger;
