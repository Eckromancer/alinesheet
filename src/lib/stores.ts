export interface StoreEntry {
  code: string;
  name: string;
  dsa: string | null;
  label: string;
}

const PILOTS: StoreEntry[] = [
  { code: "P1", name: "Pilot 1", dsa: null, label: "Pilot 1 - Leader/Partner" },
  { code: "P2", name: "Pilot 2", dsa: null, label: "Pilot 2 - Leader/Partner" },
  { code: "P3", name: "Pilot 3", dsa: null, label: "Pilot 3 - Leader/Partner" },
  { code: "P4", name: "Pilot 4", dsa: null, label: "Pilot 4 - Leader/Partner" },
  { code: "P5", name: "Pilot 5", dsa: null, label: "Pilot 5 - Leader/Partner" },
];

const RAW: Array<[string, string, string | null]> = [
  ["1001", "Downtown", null],
  ["1002", "Northpark", "Lisa Woodruff"],
  ["1003", "Ft. Worth", null],
  ["1004", "Houston", "Bruno Brady"],
  ["1005", "Bal Harbour", "Juan Rodriguez"],
  ["1006", "Atlanta", "Robert Hagins"],
  ["1009", "Northbrook", "Sheryl Salon"],
  ["1010", "Los Angeles", "Penny Rhodes"],
  ["1011", "Fashion Island", "Lesley Keys"],
  ["1012", "San Francisco", "Jonathan Gonzales"],
  ["1014", "Westchester", "Enza Witherell"],
  ["1016", "San Diego", "Jaclien Daniel"],
  ["1019", "Michigan Avenue", "Liz Eckland"],
  ["1020", "Boston", "Lisa Parslow"],
  ["1023", "Tysons", "Wendy Levine"],
  ["1025", "Short Hills", "Brian Austin"],
  ["1027", "Denver", "Sherri Carter"],
  ["1029", "Scottsdale", null],
  ["1030", "King Of Prussia", "Elizabeth McGoldrick"],
  ["1033", "Troy", "Cindy Anton"],
  ["1034", "Coral Gables", "Nisette Calderon"],
  ["1036", "Orlando", "Allyson Sahina"],
  ["1038", "Boca Raton", "Ronica Mullins"],
  ["1102", "Charlotte", "Madeline Blake"],
];

export const STORES: StoreEntry[] = [
  ...PILOTS,
  ...RAW.map(([code, name, dsa]) => ({
    code,
    name,
    dsa,
    label: `${code} ${name}`,
  })),
];

export function findStore(label: string): StoreEntry | undefined {
  return STORES.find((s) => s.label === label);
}
