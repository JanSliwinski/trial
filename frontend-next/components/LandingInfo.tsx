export default function LandingInfo() {
  const layers = [
    ["Data", "Historical 15-min Greek DAM prices from pre-cached parquet"],
    ["Forecast", "Ridge regression on calendar + lag features → median price path"],
    ["Monte Carlo", "100 correlated price scenarios around the median"],
    ["Scenario LPs", "scipy HiGHS LP per scenario → optimal schedule + dual variables"],
    ["Water Values", "Dual variables averaged → w(t, SoC) surface"],
    ["Bid Curves", "Water values → HEnEx-formatted stepwise price–quantity bids"],
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="card border-primary/20 bg-primary/5">
        <p className="text-sm text-subtle">
          Configure battery specifications in the sidebar, select a delivery date, and click{" "}
          <strong className="text-text">Run Optimisation</strong> to start.
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text mb-4">How it works</h3>
        <div className="space-y-3">
          {layers.map(([name, desc], i) => (
            <div key={name} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-mono">
                {i + 1}
              </div>
              <div>
                <span className="text-xs font-semibold text-subtle">{name}</span>
                <span className="text-xs text-muted"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4 pt-4 border-t border-border">
          The output is a <strong className="text-subtle">policy</strong> (bid curves), not a fixed schedule —
          the battery executes optimally whatever price the market actually clears.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-sm">
          <h4 className="text-xs font-semibold text-subtle mb-3">Default Battery Specs</h4>
          <ul className="space-y-1.5 text-xs text-muted">
            {[
              ["Capacity", "10 MWh"],
              ["Power", "5 MW (2-hour)"],
              ["Round-trip efficiency", "88%"],
              ["Usable SoC", "10% – 90%"],
              ["Degradation cost", "€5/MWh"],
              ["Max cycles/day", "2"],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-subtle font-mono">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-sm">
          <h4 className="text-xs font-semibold text-subtle mb-3">Available Date Range</h4>
          <ul className="space-y-1.5 text-xs text-muted">
            {[
              ["Start", "2024-01-15"],
              ["End", "2025-12-30"],
              ["Resolution", "15 min (96/day)"],
              ["Scenarios", "100 Monte Carlo"],
              ["Negative prices", "~3% of intervals"],
              ["Source", "Synthetic Greek DAM"],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-subtle font-mono">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
