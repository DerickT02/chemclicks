"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import {
  MAX_ELECTRON_COUNT,
  MAX_PROTON_COUNT,
  MIN_ELECTRON_COUNT,
  MIN_PROTON_COUNT,
  calculateIonicCharge,
  clampElectronCount,
  clampProtonCount,
  describeIonicCharge,
  describeNeutralChargeStability,
  describeNobleGasStability,
  describeProtonElectronDifference,
  chargeFromParticlesPanelText,
  evaluateNobleGasRule,
  isPlausibleIonicCharge,
  neutralChargeStabilityPanelText,
  nobleGasStabilityPanelText,
  outerShellRulePanelText,
} from "@/lib/chemistry/bohr-explorer";
import { BOHR_ION_INFO } from "@/lib/chemistry/bohr-ions";
import { ELEMENTS } from "@/lib/chemistry/elements";
import { getElectronShells } from "@/lib/chemistry/lewis";

// ─── Constants ────────────────────────────────────────────────────────────────

const SHELL_LABELS     = ["K", "L", "M", "N"] as const;
// Actual shell capacities; the first 20 elements occupy at most 2, 8, 8, 2 electrons in these shells.
const SHELL_CAPACITIES = [2, 8, 18, 32] as const;

// SVG dimensions — same proportional approach as LewisDotExplorer's BohrModel
const BOHR_SIZE   = 500;
const BOHR_CENTER = BOHR_SIZE / 2;

// Shell radii scaled up from Lewis (30 + i*17 @ 180px → 83 + i*47 @ 500px)
function shellRadius(shellIndex: number): number {
  return 83 + shellIndex * 47;
}

// Orbit duration per shell (inner shells spin faster)
const ORBIT_DURATIONS = [4, 8, 13, 18] as const;

// ─── Bohr Model SVG ───────────────────────────────────────────────────────────

function BohrModelDiagram({
  shells,
  symbol,
  atomicNumber,
  electronCount,
  chargeDescription,
  stabilitySummary,
  activeShell,
  onShellClick,
  stretchVertical = false,
}: {
  shells: readonly number[];
  symbol: string;
  atomicNumber: number;
  electronCount: number;
  chargeDescription: string;
  stabilitySummary: string;
  activeShell: number | null;
  onShellClick: (idx: number) => void;
  stretchVertical?: boolean;
}) {
  return (
    <div
      className={`relative w-full shrink-0 select-none ${
        stretchVertical
          ? "min-h-[20rem] flex-1 md:min-h-[24rem]"
          : "my-auto aspect-square"
      }`}
    >
      {/* Single keyframe shared by all orbiting groups */}
      <style>{`@keyframes bohr-orbit { to { transform: rotate(360deg); } }`}</style>
      <svg
        viewBox={`0 0 ${BOHR_SIZE} ${BOHR_SIZE}`}
        className="w-full h-full"
        role="img"
        aria-label={`Bohr model for ${symbol} (atomic number ${atomicNumber}): nucleus shows p+ ${atomicNumber}, ${atomicNumber} ${atomicNumber === 1 ? "proton" : "protons"}, ${electronCount} ${electronCount === 1 ? "electron" : "electrons"}, ionic charge ${chargeDescription}; ${stabilitySummary}`}
      >
        {/* ── Orbit rings — same style as LewisDotExplorer ── */}
        {shells.map((_, shellIdx) => {
          const active = activeShell === shellIdx;
          const r = shellRadius(shellIdx);
          return (
            <circle
              key={`ring-${shellIdx}`}
              cx={BOHR_CENTER}
              cy={BOHR_CENTER}
              r={r}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={active ? 2 : 1.5}
              strokeOpacity={active ? 0.7 : 0.35}
              strokeDasharray={active ? "0" : "4 4"}
              style={{ cursor: "pointer", transition: "stroke-opacity 0.2s, stroke-width 0.2s" }}
              onClick={() => onShellClick(shellIdx)}
            />
          );
        })}

        {/* ── Shell labels ── */}
        {shells.map((_, shellIdx) => {
          const active = activeShell === shellIdx;
          const r = shellRadius(shellIdx);
          const a = -Math.PI * 0.78;
          return (
            <text
              key={`lbl-${shellIdx}`}
              x={(BOHR_CENTER + r * Math.cos(a)).toFixed(3)}
              y={(BOHR_CENTER + r * Math.sin(a)).toFixed(3)}
              fontSize="14"
              fontFamily="monospace"
              fontWeight={active ? "bold" : "normal"}
              fill={active ? "#60a5fa" : "#94a3b8"}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ pointerEvents: "none", transition: "fill 0.2s" }}
            >
              {SHELL_LABELS[shellIdx]}
            </text>
          );
        })}

        {/* ── Electrons — orbiting groups, rounded initial coords (hydration-safe) ── */}
        {shells.map((electronCount, shellIdx) => {
          const active   = activeShell === shellIdx;
          const r        = shellRadius(shellIdx);
          const duration = ORBIT_DURATIONS[shellIdx];

          return (
            <g
              key={`shell-${shellIdx}`}
              style={{
                // transform-box: view-box makes transform-origin 50% 50%
                // resolve to the SVG viewport centre — correct pivot for orbits
                transformBox: "view-box" as React.CSSProperties["transformBox"],
                transformOrigin: "center",
                animation: `bohr-orbit ${duration}s linear infinite`,
              }}
            >
              {Array.from({ length: electronCount }, (_, eIdx) => {
                const angle = (2 * Math.PI * eIdx) / electronCount - Math.PI / 2;
                // Round to 3 dp — same hydration fix as LewisDotExplorer
                const cx = (BOHR_CENTER + r * Math.cos(angle)).toFixed(3);
                const cy = (BOHR_CENTER + r * Math.sin(angle)).toFixed(3);
                return (
                  <circle
                    key={eIdx}
                    cx={cx}
                    cy={cy}
                    r={active ? 9 : 7}
                    fill="#60a5fa"
                    fillOpacity={active ? 1 : 0.85}
                  />
                );
              })}
            </g>
          );
        })}

        {/* ── Nucleus — element symbol (primary) and p⁺ Z on one line (charter) ── */}
        <circle cx={BOHR_CENTER} cy={BOHR_CENTER} r={36} fill="#f87171" />
        <text
          x={BOHR_CENTER}
          y={BOHR_CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontFamily="sans-serif"
          aria-hidden="true"
        >
          <tspan x={BOHR_CENTER} dy="-0.35em" fontSize="19" fontWeight="bold">
            {symbol}
          </tspan>
          <tspan x={BOHR_CENTER} dy="1.15em" fontSize="13" fontWeight="600">
            p
            <tspan dy="-0.45em" fontSize="9" fontWeight="700">
              +
            </tspan>
            <tspan dy="0.45em"> </tspan>
            <tspan>{atomicNumber}</tspan>
          </tspan>
        </text>
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ParticleControlProps = {
  label: string;
  particle: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function StabilityInsight({
  title,
  met,
  headline,
  hint,
}: {
  title: string;
  met?: boolean;
  headline: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {met !== undefined ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              met ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
            }`}
          >
            {met ? "Met" : "Not met"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{headline}</p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ParticleControl({ label, particle, value, min, max, onChange }: ParticleControlProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Remove ${particle}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="h-9 w-9 rounded-lg border border-border bg-card text-foreground hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
        >
          −
        </button>
        <output className="min-w-6 text-center font-semibold text-foreground" aria-label={`${label}: ${value}`}>
          {value}
        </output>
        <button
          type="button"
          aria-label={`Add ${particle}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-lg border border-border bg-card text-foreground hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}

type ElementStat = { label: string; value: ReactNode };

function ElementSummaryCard({
  symbol,
  name,
  atomicNumber,
  stats,
}: {
  symbol: string;
  name: string;
  atomicNumber: number;
  stats: readonly ElementStat[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-foreground">{symbol}</span>
        <div>
          <p className="text-lg font-semibold text-foreground leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground">Atomic number: {atomicNumber}</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-muted/50 divide-y divide-border">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{stat.label}</span>
            {stat.value}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Diagram card. On small screens it is shown first so the diagram stays next to the controls that change it. */
function BohrDiagramCard(props: ComponentProps<typeof BohrModelDiagram>) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 md:order-last">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Bohr Diagram</h2>
        <span className="text-xs text-muted-foreground">click a shell ring to highlight</span>
      </div>
      <BohrModelDiagram {...props} />
      <div className="mt-auto flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#60a5fa]" />
          <span className="text-xs text-muted-foreground">Electron (e⁻)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#f87171]" />
          <span className="text-xs text-muted-foreground">Nucleus</span>
        </div>
      </div>
    </div>
  );
}

const SHELL_CAPACITIES_MAP = SHELL_CAPACITIES;

export type BohrLessonMode = "intro" | "stability";

type BohrModelViewerProps = {
  /** The lesson focus. */
  mode: BohrLessonMode;
};

export default function BohrModelViewer({ mode }: BohrModelViewerProps) {
  const showIntroContent = mode === "intro";
  const showStabilityContent = mode === "stability";
  const [selectedElement, setSelectedElement] = useState(ELEMENTS[0]);
  const [protonCount, setProtonCount] = useState(ELEMENTS[0].atomicNumber);
  const [electronCount, setElectronCount] = useState(ELEMENTS[0].atomicNumber);
  const [activeShell, setActiveShell] = useState<number | null>(null);

  const element = ELEMENTS[protonCount - 1];
  const shells = getElectronShells(electronCount);
  const ionInfo = BOHR_ION_INFO[protonCount];
  const selectedIon = ionInfo.ions.find((ion) => protonCount - ion.charge === electronCount);
  const isNeutral = protonCount === electronCount;

  const handleElementSelect = (el: typeof ELEMENTS[number]) => {
    setSelectedElement(el);
    setProtonCount(el.atomicNumber);
    setElectronCount(el.atomicNumber);
    setActiveShell(null);
  };

  const handleProtonChange = (count: number) => {
    setProtonCount(clampProtonCount(count));
    setActiveShell(null);
  };

  const handleElectronChange = (count: number) => {
    setElectronCount(clampElectronCount(count));
    setActiveShell(null);
  };

  const handleShellToggle = (idx: number) => {
    setActiveShell((prev) => (prev === idx ? null : idx));
  };

  const valenceCount      = shells[shells.length - 1] ?? 0;
  const totalElectrons    = shells.reduce((a, b) => a + b, 0);
  const protons = protonCount;
  const charge = calculateIonicCharge(protons, electronCount);
  const chargeDescription = charge === null ? "unavailable" : describeIonicCharge(charge);
  const chargeDifference = describeProtonElectronDifference(protons, electronCount);
  const nobleGasStability = describeNobleGasStability(electronCount, protons);
  const neutralChargeStability = describeNeutralChargeStability(protons, electronCount);
  const shellRule = evaluateNobleGasRule(electronCount);
  const outerShellRuleMeetsStability = shellRule?.meetsRule === true && isPlausibleIonicCharge(charge);
  const chargePanelText = chargeFromParticlesPanelText(protons, electronCount, charge);
  const accessibilitySummary = `${nobleGasStability.label}; ${neutralChargeStability.label}; ${chargeDifference ?? "charge unavailable"}`;
  const ionContextHeading = selectedIon
    ? "Common ion example"
    : isNeutral
      ? "Neutral atom"
      : "Exploration (not a listed common ion)";
  const ionContextBody = selectedIon
    ? `${selectedIon.name}: ${selectedIon.note}`
    : isNeutral
      ? ionInfo.neutralNote
      : "Charge and shells still update as you explore. This configuration is not one of the common ions highlighted in class.";

  const statValue = (value: ReactNode) => <span className="font-semibold text-foreground">{value}</span>;
  const elementStats: ElementStat[] = [
    { label: "Protons", value: statValue(protons) },
    { label: "Valence electrons", value: statValue(valenceCount) },
    { label: "Total electrons", value: statValue(totalElectrons) },
    { label: "Occupied shells", value: statValue(shells.length) },
  ];
  const diagramProps = {
    shells,
    symbol: element.symbol,
    atomicNumber: element.atomicNumber,
    electronCount,
    chargeDescription,
    stabilitySummary: accessibilitySummary,
    activeShell,
    onShellClick: handleShellToggle,
  };

  return (
    <div className="flex flex-col gap-8">

      {/* ── Key Concepts ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Key Concepts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: "🔵", title: "Electron (e⁻)",    body: "In the Bohr model, negatively charged particles are shown in fixed shells around the nucleus. Neutral atoms have as many electrons as protons; changing electrons creates an ion." },
            { icon: "⚡", title: "Valence Electrons", body: "Electrons in the outermost shell. They determine how an element bonds and reacts with other elements." },
            { icon: "🏠", title: "Shell Capacity",    body: "K, L, M, and N can hold up to 2, 8, 18, and 32 electrons. For the first 20 elements, their electron counts go up to 2, 8, 8, and 2." },
            { icon: "🛡️", title: "Ions and Stability",  body: "Common ions occur in compounds, but a full electron shell alone cannot tell us whether an isolated ion is stable." },
          ].map((c) => (
            <div key={c.title} className="flex gap-3 rounded-xl bg-muted/40 border border-border p-4">
              <span className="text-xl shrink-0">{c.icon}</span>
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">{c.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Element Selector ───────────────────────────────────────────── */}
      {mode === "intro" && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Introduction concepts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-sm font-semibold text-foreground mb-0.5">The nucleus</p>
              <p className="text-xs text-muted-foreground leading-relaxed">The nucleus contains protons. An element&apos;s atomic number tells you how many protons are in its nucleus.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-sm font-semibold text-foreground mb-0.5">Neutral atoms</p>
              <p className="text-xs text-muted-foreground leading-relaxed">A neutral atom has the same number of electrons as protons. Select an element to see its neutral Bohr model.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-sm font-semibold text-foreground mb-0.5">Electron shells</p>
              <p className="text-xs text-muted-foreground leading-relaxed">For the first 20 elements, electrons fill shells in a 2, 8, 8, 2 pattern.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              <p className="text-sm font-semibold text-foreground mb-0.5">The first 20 elements</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Choose an element from hydrogen through calcium, then inspect its nucleus, electrons, and occupied shells.</p>
            </div>
          </div>
        </section>
      )}

      {showIntroContent && <div>
        <div
          role="group"
          aria-label="Choose an element"
          className="grid grid-cols-5 sm:grid-cols-10 gap-1.5"
        >
          {ELEMENTS.map((el) => {
            const isResetAnchor = el.atomicNumber === selectedElement.atomicNumber;
            const isProtonCount = el.atomicNumber === protonCount;
            const elementLabel =
              isResetAnchor && isProtonCount
                ? `${el.name}, ${el.symbol}, reset target and protons in this model`
                : isResetAnchor
                  ? `${el.name}, ${el.symbol}, reset target`
                  : isProtonCount
                    ? `${el.name}, ${el.symbol}, protons in this model`
                    : `${el.name}, ${el.symbol}`;
            return (
              <button
                key={el.atomicNumber}
                type="button"
                aria-pressed={isResetAnchor}
                aria-label={elementLabel}
                onClick={() => handleElementSelect(el)}
                className={`min-h-9 rounded-md border bg-muted px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  isResetAnchor && isProtonCount
                    ? "border-green-500 ring-2 ring-green-500/70 hover:border-green-500"
                    : isResetAnchor
                      ? "border-green-500/80 ring-2 ring-green-500 hover:border-green-500"
                      : isProtonCount
                        ? "border-[#60a5fa] ring-2 ring-[#60a5fa]/55 hover:border-[#60a5fa]"
                        : "border-border hover:border-accent"
                }`}
              >
                {el.symbol}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Green ring: reset target.
          <br />
          Blue ring: element matching the current proton count.
        </p>
      </div>}

      {mode === "stability" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Explore stability</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Adjust protons and electrons in Build an atom. Compare noble-gas electron counts,
            neutral charge, the resulting ionic charge, and common-ion examples. A noble-gas
            electron count alone does not prove that an ion is stable.
          </p>
        </section>
      )}

      {/* ── Bohr Diagram + Info ────────────────────────────────────────── */}
      {showStabilityContent ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
            <BohrDiagramCard {...diagramProps} stretchVertical />

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Build an atom</h2>
                <div className="flex flex-col gap-3">
                  <ParticleControl
                    label="Protons"
                    particle="a proton"
                    value={protonCount}
                    min={MIN_PROTON_COUNT}
                    max={MAX_PROTON_COUNT}
                    onChange={handleProtonChange}
                  />
                  <ParticleControl
                    label="Electrons"
                    particle="an electron"
                    value={electronCount}
                    min={MIN_ELECTRON_COUNT}
                    max={MAX_ELECTRON_COUNT}
                    onChange={handleElectronChange}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Use protons to change the element and electrons to model ions.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4" role="status" aria-live="polite">
                <h3 className="text-sm font-semibold text-foreground">{ionContextHeading}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{ionContextBody}</p>
              </div>

              <ElementSummaryCard
                symbol={element.symbol}
                name={element.name}
                atomicNumber={element.atomicNumber}
                stats={[
                  ...elementStats,
                  { label: "Protons − electrons", value: statValue(chargeDifference ?? "—") },
                  {
                    label: "Ionic charge",
                    value: (
                      <output
                        aria-label={`Ionic charge: ${chargeDescription}`}
                        aria-live="polite"
                        className="font-semibold text-foreground"
                      >
                        {chargeDescription}
                      </output>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4" aria-live="polite" aria-atomic="true">
            <h3 className="text-sm font-semibold text-foreground">Charge and stability</h3>
            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <StabilityInsight
                title="Noble-gas electron stability"
                met={nobleGasStability.met}
                {...nobleGasStabilityPanelText(electronCount, nobleGasStability)}
              />
              <StabilityInsight
                title="Neutral charge stability"
                met={neutralChargeStability.met}
                {...neutralChargeStabilityPanelText(protons, electronCount, neutralChargeStability)}
              />
              <StabilityInsight
                title="Charge from protons and electrons"
                headline={chargePanelText.headline}
                hint={chargePanelText.hint}
              />
              <StabilityInsight
                title="Outer-shell rule (duet/octet)"
                met={outerShellRuleMeetsStability}
                {...outerShellRulePanelText(electronCount, charge)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <BohrDiagramCard {...diagramProps} />
          <ElementSummaryCard
            symbol={element.symbol}
            name={element.name}
            atomicNumber={element.atomicNumber}
            stats={elementStats}
          />
        </div>
      )}

      {/* ── Electron Shell Reference ───────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Electron Shell Reference</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Click a card or a shell ring in the diagram to highlight that shell. Capacities shown are the
          full shell limits. Argon has a filled outer 3s/3p configuration, even though M can hold more
          electrons in higher-energy orbitals.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SHELL_LABELS.map((label, idx) => {
            const capacity = SHELL_CAPACITIES_MAP[idx];
            const inUse    = idx < shells.length;
            const count    = inUse ? shells[idx] : 0;
            const isFull   = inUse && count === capacity;
            const isActive = activeShell === idx && inUse;

            return (
              <button
                key={label}
                type="button"
                disabled={!inUse}
                onClick={() => inUse && handleShellToggle(idx)}
                className={`rounded-xl border p-4 text-left transition-all duration-150 ${
                  !inUse
                    ? "border-border opacity-30 cursor-default"
                    : isActive
                    ? "border-accent bg-accent/10"
                    : "border-border bg-muted/30 hover:border-accent/40 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xl font-bold font-mono ${isActive ? "text-accent" : "text-foreground"}`}>
                    {label}
                  </span>
                  {inUse && isFull && (
                    <span className="text-[10px] font-semibold text-accent bg-accent/10 rounded-full px-1.5 py-0.5">
                      FULL
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">Shell {idx + 1} · capacity {capacity}e⁻</p>
                {inUse ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">{count} / {capacity}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${(count / capacity) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Not used</p>
                )}
              </button>
            );
          })}
        </div>
      </section>


    </div>
  );
}
