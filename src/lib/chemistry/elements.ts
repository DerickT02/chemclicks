export type Element = {
  atomicNumber: number;
  name: string;
  symbol: string;
  valenceElectrons: number;
};

export const ELEMENTS: readonly Element[] = [
  { atomicNumber: 1, name: "Hydrogen", symbol: "H", valenceElectrons: 1 },
];
