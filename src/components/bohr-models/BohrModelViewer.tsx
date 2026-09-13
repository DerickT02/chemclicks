"use client";

import { useState } from "react";
import { ELEMENTS } from "@/lib/chemistry/elements";
import { getElectronShells } from "@/lib/chemistry/lewis";

// ─── Constants ────────────────────────────────────────────────────────────────

const SHELL_LABELS     = ["K", "L", "M", "N"] as const;
const SHELL_CAPACITIES = [2, 8, 8, 2] as const;

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
  activeShell,
  onShellClick,
}: {
  shells: readonly number[];
  symbol: string;
  atomicNumber: number;
  activeShell: number | null;
  onShellClick: (idx: number) => void;
}) {
  return (
    <div className="relative w-full aspect-square select-none">
      {/* Single keyframe shared by all orbiting groups */}
      <style>{`@keyframes bohr-orbit { to { transform: rotate(360deg); } }`}</style>
      <svg
        viewBox={`0 0 ${BOHR_SIZE} ${BOHR_SIZE}`}
        className="w-full h-full"
        role="img"
        aria-label={`Bohr model for ${symbol} (atomic number ${atomicNumber})`}
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

        {/* ── Nucleus — same red fill as LewisDotExplorer ── */}
        <circle cx={BOHR_CENTER} cy={BOHR_CENTER} r={32} fill="#f87171" />
        <text
          x={BOHR_CENTER}
          y={BOHR_CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="20"
          fontWeight="bold"
          fontFamily="sans-serif"
        >
          {symbol}
        </text>
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SHELL_CAPACITIES_MAP = SHELL_CAPACITIES;

export default function BohrModelViewer() {
  const [element, setElement] = useState(ELEMENTS[0]);
  const [activeShell, setActiveShell] = useState<number | null>(null);

  const shells = getElectronShells(element.atomicNumber);

  const handleElementSelect = (el: typeof ELEMENTS[number]) => {
    setElement(el);
    setActiveShell(null);
  };

  const handleShellToggle = (idx: number) => {
    setActiveShell((prev) => (prev === idx ? null : idx));
  };

  const valenceCount      = shells[shells.length - 1];
  const totalElectrons    = shells.reduce((a, b) => a + b, 0);
  const outerCapacity     = SHELL_CAPACITIES[shells.length - 1];
  const isStable          = valenceCount === outerCapacity;
  const electronsNeeded   = outerCapacity - valenceCount;

  return (
    <div className="flex flex-col gap-8">

      {/* ── Key Concepts ──────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Key Concepts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: "🔵", title: "Electron (e⁻)",    body: "Negatively charged particles that orbit the nucleus in fixed shells. Each element has as many electrons as protons." },
            { icon: "⚡", title: "Valence Electrons", body: "Electrons in the outermost shell. They determine how an element bonds and reacts with other elements." },
            { icon: "🏠", title: "Shell Capacity",    body: "The K shell holds up to 2 electrons. The L and M shells hold up to 8. The N shell holds 2 for elements 1–20." },
            { icon: "🛡️", title: "Stability",         body: "Noble gases (He, Ne, Ar) have completely full outer shells — they are the most chemically stable elements." },
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
      <div
        role="group"
        aria-label="Choose an element"
        className="grid grid-cols-5 sm:grid-cols-10 gap-1.5"
      >
        {ELEMENTS.map((el) => {
          const isSelected = el.atomicNumber === element.atomicNumber;
          return (
            <button
              key={el.atomicNumber}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${el.name}, ${el.symbol}`}
              onClick={() => handleElementSelect(el)}
              className={`min-h-9 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-muted text-foreground hover:border-accent"
              }`}
            >
              {el.symbol}
            </button>
          );
        })}
      </div>

      {/* ── Bohr Diagram + Info ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Diagram */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">Bohr Diagram</h2>
            <span className="text-xs text-muted-foreground">click a shell ring to highlight</span>
          </div>
          <BohrModelDiagram
            shells={shells}
            symbol={element.symbol}
            atomicNumber={element.atomicNumber}
            activeShell={activeShell}
            onShellClick={handleShellToggle}
          />
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#60a5fa]" />
              <span className="text-xs text-muted-foreground">Electron (e⁻)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#f87171]" />
              <span className="text-xs text-muted-foreground">Nucleus</span>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">{element.symbol}</span>
                <div>
                  <p className="text-lg font-semibold text-foreground leading-tight">{element.name}</p>
                  <p className="text-xs text-muted-foreground">Atomic number: {element.atomicNumber}</p>
                </div>
              </div>
              {isStable ? (
                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30">
                  ✓ Stable
                </span>
              ) : (
                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                  Unstable
                </span>
              )}
            </div>

            {/* Config chips */}
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Electron configuration</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {shells.map((count, idx) => {
                  const isActive = activeShell === idx;
                  const isFull   = count === SHELL_CAPACITIES_MAP[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleShellToggle(idx)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-mono transition-all duration-150 ${
                        isActive
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-muted text-foreground hover:border-accent/40"
                      }`}
                    >
                      <span className="font-bold">{SHELL_LABELS[idx]}:</span>
                      <span>{count}</span>
                      {isFull && <span className="text-accent text-xs ml-0.5">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-xl bg-muted/50 border border-border divide-y divide-border">
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Valence electrons</span>
                <span className="font-semibold text-foreground">{valenceCount}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Total electrons</span>
                <span className="font-semibold text-foreground">{totalElectrons}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Occupied shells</span>
                <span className="font-semibold text-foreground">{shells.length}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Stability</span>
                {isStable ? (
                  <span className="font-semibold text-accent">Stable — outer shell full</span>
                ) : (
                  <span className="font-semibold text-foreground">
                    Needs {electronsNeeded} more e⁻
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Electron Shell Reference ───────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Electron Shell Reference</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Click a card or a shell ring in the diagram to highlight that shell.
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
                <p className="text-xs text-muted-foreground mb-2">Shell {idx + 1} · max {capacity}e⁻</p>
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
