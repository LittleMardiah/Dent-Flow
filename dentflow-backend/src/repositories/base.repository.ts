import { Pool, QueryResult, QueryResultRow } from 'pg';

import { logger } from '../utils/logger';
import { pool } from '../config/database';

export class BaseRepository {
  protected pool: Pool;

  constructor() {
    this.pool = pool;
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
