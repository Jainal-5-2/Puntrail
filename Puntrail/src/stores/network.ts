import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  isInitialized: boolean;
  initialize: () => void;
}

let unsubscribe: (() => void) | null = null;

export const useNetwork = create<NetworkState>()((set) => ({
  isConnected: false,
  isInternetReachable: false,
  isInitialized: false,

  initialize: () => {
    if (unsubscribe) return;

    unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      set({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        isInitialized: true,
      });
    });
  },
}));

export function stopNetworkMonitoring(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}