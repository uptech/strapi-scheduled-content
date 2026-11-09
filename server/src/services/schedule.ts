import type { Core } from '@strapi/strapi';
import { ACTION_UID } from '../pluginId';

export type Target = {
  contentType: string;
  targetDocumentId: string;
  targetLocale: string | null;
};

export type Action = 'publish' | 'unpublish';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  list(target: Target) {
    return strapi.db.query(ACTION_UID).findMany({
      where: target,
      orderBy: { executeAt: 'desc' },
      limit: 10,
    });
  },

  /**
   * Replaces the pending action of each given kind. `null` clears it; kinds
   * left out of `dates` are untouched.
   */
  async set(target: Target, dates: Partial<Record<Action, Date | null>>) {
    const query = strapi.db.query(ACTION_UID);
    for (const [action, date] of Object.entries(dates)) {
      await query.deleteMany({ where: { ...target, action, status: 'pending' } });
      if (date) {
        await query.create({ data: { ...target, action, executeAt: date, status: 'pending' } });
      }
    }
    return this.list(target);
  },
});
