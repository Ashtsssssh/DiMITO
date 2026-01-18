import axios from 'axios';
import { TrafficSnapshot, SignalStateResponse, RoutingTable } from '@/types/network';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getTrafficSnapshot = async (): Promise<TrafficSnapshot> => {
  const { data } = await api.get('/snapshot/');
  return data;
};

export const getSignalState = async (nodeId: string): Promise<SignalStateResponse> => {
  const { data } = await api.get(`/signal/${nodeId}/`);
  return data;
};

export const getRoutingTable = async (nodeId: string): Promise<RoutingTable> => {
  const { data } = await api.get(`/gettable/node/${nodeId}/`);
  return data;
};

export const recomputeGreen = async (nodeId: string): Promise<void> => {
  await api.post(`/admin/recompute-green/${nodeId}/`);
};

export const recomputeRouting = async (nodeId: string): Promise<void> => {
  await api.post(`/admin/recompute-routing/${nodeId}/`);
};

export const runDVUpdate = async (nodeId: string): Promise<void> => {
  await api.post(`/admin/dv-update/${nodeId}/`);
};

export const createNode = async (nodeData: any): Promise<void> => {
  await api.post('/nodes/', nodeData);
};

export const createEdge = async (edgeData: any): Promise<void> => {
  await api.post('/edges/', edgeData);
};

export const deleteNode = async (nodeId: string): Promise<void> => {
  await api.delete(`/nodes/${nodeId}/`);
};

export const deleteEdge = async (edgeId: string): Promise<void> => {
  await api.delete(`/edges/${edgeId}/`);
};

export const getNetworkStats = async (): Promise<any> => {
  const { data } = await api.get('/stats/');
  return data;
};

export default api;