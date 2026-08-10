import { cleanupTempPatientsJob } from './cleanupTempPatients.job';

(async () => {
  console.log('🧪 Running cleanup job manually...');
  await cleanupTempPatientsJob.execute();
  console.log('✅ Done');
  process.exit(0);
})();
