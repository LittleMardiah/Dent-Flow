import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class BaseRepository {
  protected pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  protected async query<T extends QueryResultRow = any>(
    sql: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    logger.debug({ sql, params });
    return this.pool.query<T>(sql, params);
  }

  protected async getClient() {
    return this.pool.connect();
  }
}
