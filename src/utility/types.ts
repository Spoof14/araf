export type Champion = {
  id: string;
  /**
   * Numeric champion key string from Data Dragon (e.g. "266"), used to map
   * Riot mastery `championId` -> champion.
   */
  key?: string;
  name: string;
  image: string;
};

