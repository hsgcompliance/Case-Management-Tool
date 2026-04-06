//client/misc.ts
import api from './api';

export const Misc = {
  createSession: (body: any) => api.post('createSession', body),
  health: () => api.get('health'),
};

export default Misc;
