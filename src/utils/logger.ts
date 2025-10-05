import winston from 'winston';
import 'winston-daily-rotate-file'; // For daily rotating logs

// Configure the daily rotate file transport
const dailyRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/%DATE%-combined.log',  // Files will be named like: 2022-12-30-combined.log
  datePattern: 'YYYY-MM-DD',  // Create a new log file every day
  zippedArchive: true,  // Compress the logs to save space
  maxSize: '50',  // Rotate logs when they reach 20MB
  maxFiles: '7d',  // Keep logs for the last 14 days
});

// Create a custom logger instance
const logger = winston.createLogger({
  level: 'info', // Default log level, can be changed based on the environment
  format: winston.format.combine(
    winston.format.colorize(), // Colorize the logs for easy readability
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),  // Log to the console
    dailyRotateTransport,  // Log to files with rotation
  ],
});

export default logger;
