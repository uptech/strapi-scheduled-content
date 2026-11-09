export type PluginConfig = {
  /** Run the poller on this instance. */
  enabled: boolean;
  /** How often to look for due actions, in milliseconds. */
  intervalMs: number;
  /** Import pending schedules left behind by strapi-plugin-publisher. */
  importPublisherActions: boolean;
};

export default {
  default: {
    enabled: true,
    intervalMs: 60_000,
    importPublisherActions: true,
  } satisfies PluginConfig,
  validator(config: PluginConfig) {
    if (typeof config.enabled !== 'boolean') {
      throw new Error('scheduled-content: `enabled` must be a boolean');
    }
    if (!Number.isInteger(config.intervalMs) || config.intervalMs < 5_000) {
      throw new Error('scheduled-content: `intervalMs` must be an integer of at least 5000');
    }
    if (typeof config.importPublisherActions !== 'boolean') {
      throw new Error('scheduled-content: `importPublisherActions` must be a boolean');
    }
  },
};
