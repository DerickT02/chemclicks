export type BohrIon = {
  charge: number;
  name: string;
  note: string;
};

type ElementIonInfo = {
  neutralNote: string;
  ions: readonly BohrIon[];
};

export const BOHR_ION_INFO: Readonly<Record<number, ElementIonInfo>> = {
  1: {
    neutralNote: "Hydrogen often shares electrons in bonds. H+ is a proton in acids; H− occurs in metal hydrides.",
    ions: [
      { charge: 1, name: "Proton (H+)", note: "H+ has no electrons. In water it is associated with water molecules as hydronium (H3O+)." },
      { charge: -1, name: "Hydride (H−)", note: "H− occurs in ionic metal hydrides; it reacts strongly with water." },
    ],
  },
  2: { neutralNote: "Helium is a largely unreactive noble gas; it has no common simple ion.", ions: [] },
  3: { neutralNote: "Lithium commonly forms Li+ in ionic compounds.", ions: [
    { charge: 1, name: "Lithium ion (Li+)", note: "Li+ occurs in lithium salts." },
  ] },
  4: { neutralNote: "Beryllium occurs in compounds with a +2 charge.", ions: [
    { charge: 2, name: "Beryllium ion (Be2+)", note: "Be2+ is found in beryllium compounds; bonding can have covalent character." },
  ] },
  5: { neutralNote: "Boron generally bonds covalently; no common simple monatomic ion is modeled.", ions: [] },
  6: { neutralNote: "Carbon usually shares electrons in covalent bonds. C4− occurs in certain carbides, but is not stable as a free ion.", ions: [
    { charge: -4, name: "Carbide (C4−)", note: "C4− is found in some carbides; it is not stable as an isolated ion." },
  ] },
  7: { neutralNote: "Nitrogen usually bonds covalently; N3− occurs in metal nitrides.", ions: [
    { charge: -3, name: "Nitride (N3−)", note: "N3− occurs in ionic metal nitrides, such as magnesium nitride." },
  ] },
  8: { neutralNote: "Oxygen often bonds covalently; O2− occurs in metal oxides.", ions: [
    { charge: -2, name: "Oxide (O2−)", note: "O2− occurs in metal oxides; it is not stable as a free ion." },
  ] },
  9: { neutralNote: "Fluorine often forms F− in fluoride compounds.", ions: [
    { charge: -1, name: "Fluoride (F−)", note: "F− occurs in fluorides such as calcium fluoride." },
  ] },
  10: { neutralNote: "Neon is a largely unreactive noble gas; it has no common simple ion.", ions: [] },
  11: { neutralNote: "Sodium commonly forms Na+ in salts.", ions: [
    { charge: 1, name: "Sodium ion (Na+)", note: "Na+ occurs in ionic compounds such as sodium chloride." },
  ] },
  12: { neutralNote: "Magnesium commonly forms Mg2+ in compounds.", ions: [
    { charge: 2, name: "Magnesium ion (Mg2+)", note: "Mg2+ occurs in compounds such as magnesium oxide." },
  ] },
  13: { neutralNote: "Aluminum commonly forms Al3+ in compounds.", ions: [
    { charge: 3, name: "Aluminum ion (Al3+)", note: "Al3+ occurs in compounds such as aluminum oxide." },
  ] },
  14: { neutralNote: "Silicon usually bonds covalently. Si4− occurs in some metal silicides, but is not a free ion.", ions: [
    { charge: -4, name: "Silicide (Si4−)", note: "Si4− occurs in certain ionic silicides such as Mg2Si, not as a free ion." },
  ] },
  15: { neutralNote: "Phosphorus often bonds covalently; P3− occurs in metal phosphides.", ions: [
    { charge: -3, name: "Phosphide (P3−)", note: "P3− occurs in compounds such as aluminum phosphide." },
  ] },
  16: { neutralNote: "Sulfur often bonds covalently; S2− occurs in metal sulfides.", ions: [
    { charge: -2, name: "Sulfide (S2−)", note: "S2− occurs in ionic sulfides; it reacts with water." },
  ] },
  17: { neutralNote: "Chlorine often forms Cl− in chloride compounds.", ions: [
    { charge: -1, name: "Chloride (Cl−)", note: "Cl− occurs in compounds such as sodium chloride." },
  ] },
  18: { neutralNote: "Argon is a largely unreactive noble gas; it has no common simple ion.", ions: [] },
  19: { neutralNote: "Potassium commonly forms K+ in ionic compounds.", ions: [
    { charge: 1, name: "Potassium ion (K+)", note: "K+ occurs in compounds such as potassium chloride." },
  ] },
  20: { neutralNote: "Calcium commonly forms Ca2+ in ionic compounds.", ions: [
    { charge: 2, name: "Calcium ion (Ca2+)", note: "Ca2+ occurs in compounds such as calcium chloride." },
  ] },
};
