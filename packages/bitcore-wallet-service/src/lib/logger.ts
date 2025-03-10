import * as winston from 'winston';
import 'winston-daily-rotate-file';
export const transport = new winston.transports.DailyRotateFile({
  filename: 'bws-%DATE%.log',
  handleExceptions: true,
  maxSize: '40m',
  maxFiles: '14d',
  dirname: './logs',
  level: 'debug' // TODO
});

// Custom format for handling errors with stack traces
const errorStackFormat = winston.format(info => {
  if (info.error instanceof Error) {
    return {
      ...info,
      stack: info.error.stack,
      message: typeof info.message === 'string'
        ? `${info.message}: ${info.error.message}`
        : info.message
    };
  }
  return info;
});

export const logger = winston.createLogger({
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

      // Include stack trace if available
      const stack = info.stack ? `\nStack Trace:\n${info.stack}` : '';

      return `${info.level} :: ${formatTimestamp(new Date())} :: ${info.message}${stack}`;
    })
  ),
  transports: [transport],
  exceptionHandlers: [new winston.transports.File({ filename: 'exceptions.log', dirname: './logs' })],
  exitOnError: false
});

export const formatTimestamp = (date: Date): string =>
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
    // .padEnd(3, '0')} ${timezone}`;
    .padEnd(3, '0')}`;

export const timestamp = () => formatTimestamp(new Date());

// Add utility functions for error logging with stack traces
export function logError(message: string, error?: Error): void {
  logger.error({
    message,
    error: error || new Error('Unknown error'),
    timestamp: timestamp()
  });
}

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
