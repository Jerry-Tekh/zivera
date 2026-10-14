import { http } from './api';

export const getHealth = () => http.get('/health', { validateStatus: () => true });
