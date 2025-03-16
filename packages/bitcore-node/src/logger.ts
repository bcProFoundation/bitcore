import * as winston from 'winston';
import parseArgv from './utils/parseArgv';
let args = parseArgv([], [{ arg: 'DEBUG', type: 'bool' }]);
const logLevel = args.DEBUG ? 'debug' : (process.env.BCN_LOG_LEVEL || 'info');


const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: logLevel,
    })
  ],
  format: winston.format.combine(
    winston.format.prettyPrint(),
    winston.format.splat(),
    winston.format.simple(),
    winston.format.printf(function(info) {
      // fallback in case the above formatters  don't work.
      // eg: logger.log({ some: 'object' })
      if (typeof info.message === 'object') {
        info.message = JSON.stringify(info.message, null, 4);
      }
      return `${info.level} :: ${new Date().toISOString()} :: ${info.message}`;
    })
  )
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

// Function to get call stack at any point
export function captureCallStack(skipFrames = 1): string {
  const stack = new Error().stack || '';
  return stack.split('\n').slice(skipFrames + 1).join('\n');
}

// Log with explicit call stack even for non-errors
export function logWithCallStack(level: string, message: string): void {
  const stack = captureCallStack(2); // Skip this function and caller
  logger.log(level, `${message}\nCall Stack:\n${stack}`);
}

// Error handler for global exceptions
process.on('uncaughtException', (error) => {
  const message = typeof error === 'string' ? error : error.message;
  logger.error({
    message: `Uncaught Exception: ${message}`,
    error,
    timestamp: timestamp()
  });
});

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.log(error);
  logger.error({
    message: 'Unhandled Promise Rejection',
    error,
    timestamp: timestamp()
  });
});

export default logger;
