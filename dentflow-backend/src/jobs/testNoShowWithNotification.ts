import { noShowDetectionJob } from './noShowDetection.job';

(async () => {
  console.log('🧪 Running NO-SHOW detection with notification...');
  await noShowDetectionJob.execute();
  console.log('✅ Done');
  process.exit(0);
})();
