import pino, { Logger as PinoLogger } from 'pino';
import { config } from '../config';

// Konfigurasi Pino
const pinoConfig = {
  level: config.logging.level || 'info',
  // Di development, pakai pretty print. Di production, output JSON murni.
  ...(config.server.nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
};

export const logger: PinoLogger = pino(pinoConfig);

// Helper untuk logging request
export const logRequest = (req: any) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId,
  });
};

// Helper untuk logging error
export const logError = (error: any, context: string) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    context,
  });
};
