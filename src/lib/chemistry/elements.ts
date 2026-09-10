export type Element = {
  atomicNumber: number;
  name: string;
  symbol: string;
  valenceElectrons: number;
};

export const ELEMENTS: readonly Element[] = [
  { atomicNumber: 1, name: "Hydrogen", symbol: "H", valenceElectrons: 1 },
  { atomicNumber: 2, name: "Helium", symbol: "He", valenceElectrons: 2 },
  { atomicNumber: 3, name: "Lithium", symbol: "Li", valenceElectrons: 1 },
  { atomicNumber: 4, name: "Beryllium", symbol: "Be", valenceElectrons: 2 },
  { atomicNumber: 5, name: "Boron", symbol: "B", valenceElectrons: 3 },
  { atomicNumber: 6, name: "Carbon", symbol: "C", valenceElectrons: 4 },
  { atomicNumber: 7, name: "Nitrogen", symbol: "N", valenceElectrons: 5 },
  { atomicNumber: 8, name: "Oxygen", symbol: "O", valenceElectrons: 6 },
  { atomicNumber: 9, name: "Fluorine", symbol: "F", valenceElectrons: 7 },
  { atomicNumber: 10, name: "Neon", symbol: "Ne", valenceElectrons: 8 },
  { atomicNumber: 11, name: "Sodium", symbol: "Na", valenceElectrons: 1 },
  { atomicNumber: 12, name: "Magnesium", symbol: "Mg", valenceElectrons: 2 },
  { atomicNumber: 13, name: "Aluminum", symbol: "Al", valenceElectrons: 3 },
  { atomicNumber: 14, name: "Silicon", symbol: "Si", valenceElectrons: 4 },
  { atomicNumber: 15, name: "Phosphorus", symbol: "P", valenceElectrons: 5 },
  { atomicNumber: 16, name: "Sulfur", symbol: "S", valenceElectrons: 6 },
  { atomicNumber: 17, name: "Chlorine", symbol: "Cl", valenceElectrons: 7 },
  { atomicNumber: 18, name: "Argon", symbol: "Ar", valenceElectrons: 8 },
  { atomicNumber: 19, name: "Potassium", symbol: "K", valenceElectrons: 1 },
  { atomicNumber: 20, name: "Calcium", symbol: "Ca", valenceElectrons: 2 },
];
