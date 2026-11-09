import { SchedulePanel } from './components/SchedulePanel';
import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: 'Scheduled Content',
    });
  },

  bootstrap(app: any) {
    app.getPlugin('content-manager').apis.addEditViewSidePanel([SchedulePanel]);
  },
};
