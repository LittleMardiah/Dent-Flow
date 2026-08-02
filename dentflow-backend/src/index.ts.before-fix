import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLoggerMiddleware } from './middleware/requestLogger';

// Import routes
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';
import webhookRoutes from './routes/webhook.routes';
import bookingRoutes from './routes/booking.routes';
import doctorQueueRoutes from './routes/doctorQueue.routes';
import patientHistoryRoutes from './routes/patientHistory.routes';
import noShowRoutes from './routes/noShow.routes';
import attendanceRoutes from './routes/attendance.routes';
import doctorSlotRoutes from './routes/doctorSlot.routes';
import adminRoutes from './routes/admin.routes';
import encounterRoutes from './routes/encounter.routes';
import invoiceRoutes from './routes/invoice.routes';
import auditRoutes from './routes/audit.routes';

// Import job scheduler
import { jobScheduler } from './jobs/jobScheduler';

const app: Express = express();
const PORT = config.server.port;

// Middleware global
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
// app.use(rateLimiter); // DISABLED FOR TESTING
app.use(requestLoggerMiddleware);

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/doctors', doctorSlotRoutes);
app.use('/api', bookingRoutes);
app.use('/api', doctorQueueRoutes);
app.use('/api', patientHistoryRoutes);
app.use('/api/no-shows', noShowRoutes);
app.use('/api', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/invoices', invoiceRoutes);
app.use('/api/admin', auditRoutes);

// Global error handler
app.use(errorHandler);

// ================================================================
// EXPORT APP UNTUK TESTING
// ================================================================
export { app };

// ================================================================
// START SERVER HANYA JIKA BUKAN TEST
// ================================================================
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`✅ DentFlow API starting on port ${PORT}`);
    logger.info(`   Environment: ${config.server.nodeEnv}`);
    jobScheduler.initialize();
  });
}
