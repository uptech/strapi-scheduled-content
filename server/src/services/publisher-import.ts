import type { Core } from '@strapi/strapi';
import { ACTION_UID, LOG_PREFIX, PLUGIN_ID } from '../pluginId';

const LEGACY_TABLE = 'actions';
const STAGING = 'scheduled_content_publisher_import';
const DONE_KEY = 'publisherImportDone';

/**
 * Carries schedules over from strapi-plugin-publisher.
 *
 * Once that plugin is uninstalled, Strapi drops its `actions` table during
 * schema sync, before any plugin bootstrap runs. `stage` runs earlier, on the
 * `strapi::content-types.beforeSync` hook, and copies the rows into a table
 * Strapi never managed (and so leaves alone). `importStaged` then turns them
 * into scheduled actions on bootstrap.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  const store = strapi.store({ type: 'plugin', name: PLUGIN_ID });

  return {
    async stage() {
      // While the publisher is still installed its table is not dropped, and
      // importing would leave both plugins executing the same schedules.
      if (strapi.plugin('publisher')) return;
      // Only ever import once per database, even if an `actions` table lingers.
      if (await store.get({ key: DONE_KEY })) return;

      const knex = strapi.db.connection;
      if (!(await knex.schema.hasTable(LEGACY_TABLE))) return;
      if (!(await knex.schema.hasColumn(LEGACY_TABLE, 'entity_slug'))) return;
      if (await knex.schema.hasTable(STAGING)) return;

      const hasLocale = await knex.schema.hasColumn(LEGACY_TABLE, 'locale');

      await knex.schema.createTable(STAGING, (t) => {
        t.string('entity_slug');
        t.string('entity_id');
        t.string('mode');
        t.string('locale');
        t.datetime('execute_at', { useTz: true });
      });

      const rows = await knex(LEGACY_TABLE).select(
        'entity_slug',
        'entity_id',
        'mode',
        'execute_at',
        ...(hasLocale ? ['locale'] : [])
      );
      if (rows.length) {
        await knex.batchInsert(STAGING, rows, 100);
      }
    },

    /**
     * Overdue rows are recorded as "skipped" instead of executed: publishing or
     * unpublishing something long after its time would surprise editors.
     */
    async importStaged() {
      const knex = strapi.db.connection;
      if (!(await knex.schema.hasTable(STAGING))) return;

      const rows = await knex(STAGING).select('*');
      const now = Date.now();
      let imported = 0;

      for (const row of rows) {
        if (!['publish', 'unpublish'].includes(row.mode) || !row.entity_slug || !row.entity_id) continue;

        const executeAt = new Date(row.execute_at);
        const overdue = executeAt.getTime() < now;

        await strapi.db.query(ACTION_UID).create({
          data: {
            contentType: row.entity_slug,
            targetDocumentId: row.entity_id,
            targetLocale: row.locale ?? null,
            action: row.mode,
            executeAt,
            status: overdue ? 'skipped' : 'pending',
            error: overdue ? 'Imported from strapi-plugin-publisher after its scheduled time' : null,
          },
        });
        imported += 1;
      }

      await knex.schema.dropTable(STAGING);
      await store.set({ key: DONE_KEY, value: true });
      strapi.log.info(`${LOG_PREFIX} imported ${imported} action(s) from strapi-plugin-publisher`);
    },
  };
};
