import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLoggerMiddleware } from './middleware/requestLogger';
import walkInRoutes from './routes/walkIn.routes';
import { walkInRateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/authMiddleware';
import { tenantMiddleware } from './middleware/tenant.middleware';

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
import invoiceWebRoutes from './routes/invoiceWeb.routes';
import auditRoutes from './routes/audit.routes';
import paymentReconciliationRoutes from './routes/paymentReconciliation.routes';
import adminWebhookRoutes from './routes/adminWebhook.routes'; // 👈 TAMBAHKAN
import patientsRoutes from './routes/patients.routes';

// Import job scheduler
import { jobScheduler } from './jobs/jobScheduler';

// Realtime WebSocket (socket.io)
import { initSocketIo, dropAllSockets } from './websocket';

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
app.use('/api/auth', authRoutes);
// Tenant isolation: semua route /api/* (selain /api/auth) wajib auth + tenant check
app.use('/api', authMiddleware, tenantMiddleware);
app.use('/api/patients', patientsRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/doctors', doctorSlotRoutes);
app.use('/api', bookingRoutes);
app.use('/api', doctorQueueRoutes);
app.use('/api', patientHistoryRoutes);
app.use('/api/no-shows', noShowRoutes);
app.use('/api', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/walk-in', walkInRateLimiter, walkInRoutes);
app.use('/api/admin/invoices', invoiceRoutes);
app.use('/api/invoices', invoiceWebRoutes);
app.use('/api/admin', auditRoutes);
app.use('/api/payments', paymentReconciliationRoutes);
app.use('/api/admin', adminWebhookRoutes); 

// Global error handler
app.use(errorHandler);

// ================================================================
// START SERVER (ALWAYS LISTEN, EVEN IN TEST)
// ================================================================
console.log('🔍 [DEBUG] About to call app.listen()...');

const server = app.listen(PORT, () => {
  console.log('🔍 [DEBUG] Callback entered - server listening!');
  logger.info(`✅ DentFlow API starting on port ${PORT}`);
  logger.info(`   Environment: ${config.server.nodeEnv}`);
  
  // Only initialize job scheduler in production/development
  if (process.env.NODE_ENV !== 'test') {
    jobScheduler.initialize();
  }
});

console.log('🔍 [DEBUG] app.listen() called, server object created');

// Attach Socket.IO ke HTTP server (real-time queue/TV display)
initSocketIo(server);

// ================================================================
// [TEST/DEV ONLY] Endpoint untuk drop semua koneksi WebSocket
// Dipakai Cypress E2E: verifikasi polling fallback + auto-reconnect.
// ================================================================
if (config.server.nodeEnv !== 'production') {
  app.post('/__ws/drop', (_req, res) => {
    const dropped = dropAllSockets();
    res.status(200).json({ success: true, dropped });
  });
}

// ================================================================
// EXPORT APP & SERVER UNTUK TESTING
// ================================================================
export { app, server };