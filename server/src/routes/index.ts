const policies = ['admin::isAuthenticatedAdmin'];

export default {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/actions',
        handler: 'scheduled-action.list',
        config: { policies },
      },
      {
        method: 'PUT',
        path: '/actions',
        handler: 'scheduled-action.update',
        config: { policies },
      },
    ],
  },
};
