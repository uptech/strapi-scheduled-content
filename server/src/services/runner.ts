import type { Core, UID } from '@strapi/strapi';
import { ACTION_UID, LOG_PREFIX } from '../pluginId';
import { isLocalized } from '../utils';

// A row stuck in "processing" longer than this is assumed to belong to an
// instance that died mid-run and is handed back to the queue.
const STALE_CLAIM_MS = 10 * 60 * 1000;
const BATCH_SIZE = 50;

type ScheduledAction = {
  id: number;
  contentType: string;
  targetDocumentId: string;
  targetLocale: string | null;
  action: 'publish' | 'unpublish';
  executeAt: string;
};

const execute = async (strapi: Core.Strapi, action: ScheduledAction) => {
  const uid = action.contentType as UID.ContentType;
  if (!strapi.contentType(uid)?.options?.draftAndPublish) {
    return { status: 'skipped', error: `"${uid}" is not a draft & publish content type` };
  }

  const params = {
    documentId: action.targetDocumentId,
    ...(isLocalized(strapi, uid) && action.targetLocale ? { locale: action.targetLocale } : {}),
  };

  // Narrowed to a single draft & publish type above; the generic UID union is too wide for TS.
  const documents = strapi.documents(uid) as any;
  const draft = await documents.findOne({ ...params, status: 'draft' });
  if (!draft) {
    return { status: 'skipped', error: 'Document no longer exists' };
  }

  if (action.action === 'publish') {
    await documents.publish(params);
  } else {
    await documents.unpublish(params);
  }

  return { status: 'done', error: null };
};

/**
 * Polls for due actions with a plain interval rather than `strapi.cron`:
 * Strapi Cloud swaps the cron service for its own runner, which neither accepts
 * one-off Date jobs nor reliably fires jobs registered at runtime. An interval
 * behaves identically locally and on Cloud.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  let stop: (() => void) | null = null;

  return {
    /**
     * Executes every pending action whose time has come. Safe to run concurrently
     * from several instances: each row is claimed with a conditional UPDATE, so
     * only the instance that flips it from "pending" to "processing" executes it.
     */
    async runDueActions() {
      const query = strapi.db.query(ACTION_UID);
      const now = new Date();

      await query.updateMany({
        where: { status: 'processing', claimedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
        data: { status: 'pending', claimedAt: null },
      });

      const due: ScheduledAction[] = await query.findMany({
        where: { status: 'pending', executeAt: { $lte: now } },
        orderBy: { executeAt: 'asc' },
        limit: BATCH_SIZE,
      });

      for (const action of due) {
        const { count } = await query.updateMany({
          where: { id: action.id, status: 'pending' },
          data: { status: 'processing', claimedAt: new Date() },
        });
        if (count !== 1) continue;

        const label = `${action.action} ${action.contentType} ${action.targetDocumentId}${action.targetLocale ? ` (${action.targetLocale})` : ''}`;
        try {
          const result = await execute(strapi, action);
          await query.update({
            where: { id: action.id },
            data: { ...result, executedAt: new Date() },
          });
          strapi.log.info(`${LOG_PREFIX} ${result.status}: ${label}${result.error ? ` – ${result.error}` : ''}`);
        } catch (error) {
          await query.update({
            where: { id: action.id },
            data: { status: 'failed', error: String(error?.message ?? error), executedAt: new Date() },
          });
          strapi.log.error(`${LOG_PREFIX} failed: ${label} – ${error?.message ?? error}`);
        }
      }
    },

    start(intervalMs: number) {
      if (stop) return;

      let running = false;
      const tick = async () => {
        if (running) return;
        running = true;
        try {
          await this.runDueActions();
        } catch (error) {
          strapi.log.error(`${LOG_PREFIX} tick failed: ${error?.message ?? error}`);
        } finally {
          running = false;
        }
      };

      // Catch up on anything that came due while the server was down.
      const kickoff = setTimeout(tick, 5000);
      const interval = setInterval(tick, intervalMs);
      strapi.log.info(`${LOG_PREFIX} polling every ${intervalMs / 1000}s`);

      stop = () => {
        clearTimeout(kickoff);
        clearInterval(interval);
        stop = null;
      };
    },

    stop() {
      stop?.();
    },
  };
};
