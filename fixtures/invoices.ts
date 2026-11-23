export const order = {
  id: 'PO-1042', vendor: 'Alder Systems', currency: 'USD',
  lines: [
    { id: '01', label: 'setup', name: 'Account setup', cents: 80000 },
    { id: '02', label: 'migration', name: 'Data migration', cents: 120000 },
  ],
} as const;

export const cases = [
  { id: 'INV-2084', name: 'Matching services', phrases: ['Setup', 'Data import'], balances: [80000, 120000] },
] as const;
export type Invoice = typeof cases[number];
