import winston from "winston";
import "winston-daily-rotate-file"; // For daily rotating logs

// Configure the daily rotate file transport
const dailyRotateTransport = new winston.transports.DailyRotateFile({
  filename: "logs/%DATE%-game.log",  // Log files will be named like: 2022-12-30-game.log
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "2m",
  maxFiles: "7d",
});

// Create a custom logger instance
const gameLogger = winston.createLogger({
  level: "info", // Default log level
  format: winston.format.combine(
    winston.format.colorize(), // Colorized log output for better readability
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

export default gameLogger;
