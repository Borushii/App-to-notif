/** Un rappel récurrent : une fréquence, une plage horaire et des jours actifs. */
export type Reminder = {
  id: string;
  title: string;
  body: string;
  /** Intervalle entre deux notifications, en minutes. */
  intervalMinutes: number;
  /** Début de la plage horaire, en minutes depuis minuit (0 - 1439). */
  startMinutes: number;
  /** Fin de la plage horaire, en minutes depuis minuit (0 - 1439). */
  endMinutes: number;
  /** Jours actifs au format `Date#getDay()` : 0 = dimanche ... 6 = samedi. */
  days: number[];
  enabled: boolean;
  createdAt: number;
};

export type PermissionState = 'granted' | 'denied' | 'undetermined';
