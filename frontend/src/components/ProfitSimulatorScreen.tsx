import React, { useEffect, useState } from 'react';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Percent,
  Layers,
  Scale,
  Sparkles,
  Trash2,
  Printer,
  FileText,
} from 'lucide-react';
import { api } from '../api';
import { SimulationOutput } from '../types';

export const ProfitSimulatorScreen: React.FC = () => {
  // Input fields
  const [cropName, setCropName] = useState('Groundnut');
  const [areaAcres, setAreaAcres] = useState('3.5');
  const [expectedYield, setExpectedYield] = useState('35'); // total quintals
  const [sellingPrice, setSellingPrice] = useState('7000'); // ₹/quintal

  // Cost inputs
  const [seedCost, setSeedCost] = useState('14000');
  const [fertilizerCost, setFertilizerCost] = useState('8500');
  const [pesticideCost, setPesticideCost] = useState('4500');
  const [irrigationCost, setIrrigationCost] = useState('3000');
  const [labourCost, setLabourCost] = useState('22000');
  const [machineryCost, setMachineryCost] = useState('7500');
  const [transportCost, setTransportCost] = useState('2500');
  const [otherCost, setOtherCost] = useState('1500');

  // Simulation Results
  const [results, setResults] = useState<SimulationOutput | null>(null);
  const [savedList, setSavedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const runCalculation = async () => {
    setLoading(true);
    try {
      const payload = {
        crop_name: cropName,
        area_acres: parseFloat(areaAcres) || 1,
        expected_yield_qtl: parseFloat(expectedYield) || 0,
        selling_price_per_qtl: parseFloat(sellingPrice) || 0,
        seed_cost: parseFloat(seedCost) || 0,
        fertilizer_cost: parseFloat(fertilizerCost) || 0,
        pesticide_cost: parseFloat(pesticideCost) || 0,
        irrigation_cost: parseFloat(irrigationCost) || 0,
        labour_cost: parseFloat(labourCost) || 0,
        machinery_cost: parseFloat(machineryCost) || 0,
        transport_cost: parseFloat(transportCost) || 0,
        other_cost: parseFloat(otherCost) || 0,
      };
      const res = await api.simulations.calculate(payload);
      setResults(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedSimulations = async () => {
    try {
      const data = await api.simulations.getMine();
      setSavedList(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    runCalculation();
    fetchSavedSimulations();
  }, [cropName, areaAcres, expectedYield, sellingPrice, seedCost, fertilizerCost, pesticideCost, irrigationCost, labourCost, machineryCost, transportCost, otherCost]);

  const handleAutofillWage = async () => {
    try {
      const wageData = await api.simulations.getAverageWage();
      const avg = wageData.average_wage_per_day || 450;
      // standard benchmark: 4 workers/acre * 12 days * avg wage
      const benchmarkLabour = Math.round(4 * parseFloat(areaAcres || '1') * 12 * avg);
      setLabourCost(String(benchmarkLabour));
      setSaveMsg(`Labour auto-filled: ₹${benchmarkLabour} (based on ₹${avg}/day from AgriConnect jobs)`);
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSimulation = async () => {
    if (!results) return;
    try {
      await api.simulations.save({
        crop_name: cropName,
        area_acres: parseFloat(areaAcres),
        inputs: {
          yield_qtl: expectedYield,
          price_per_qtl: sellingPrice,
          seedCost,
          fertilizerCost,
          labourCost,
        },
        results: {
          net_profit: results.net_profit,
          profit_per_acre: results.profit_per_acre,
          break_even_price: results.break_even_price,
        },
      });
      fetchSavedSimulations();
      setSaveMsg('Simulation saved to your farm portfolio!');
      setTimeout(() => setSaveMsg(''), 3500);
    } catch (err: any) {
      setSaveMsg('Could not save simulation (requires Farmer login).');
      setTimeout(() => setSaveMsg(''), 3500);
    }
  };

  const handleDeleteSaved = async (id: number) => {
    try {
      await api.simulations.delete(id);
      fetchSavedSimulations();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={26} color="#22c55e" /> Farmer Profit & Economics Simulator
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Interactive scenario analysis, break-even thresholds, and net-realization selling option comparisons
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleAutofillWage} className="btn-secondary btn-sm" style={{ gap: 6 }}>
            <Sparkles size={15} color="#fbbf24" /> Auto-fill AgriConnect Wages
          </button>
          <button onClick={() => window.print()} className="btn-secondary btn-sm" style={{ gap: 6 }}>
            <Printer size={15} color="#38bdf8" /> Print / Export Advisory
          </button>
          <button onClick={handleSaveSimulation} className="btn-primary btn-sm" style={{ gap: 6 }}>
            <Bookmark size={15} /> Save Portfolio
          </button>
        </div>
      </div>

      {saveMsg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            color: '#86efac',
            fontSize: '0.88rem',
          }}
        >
          {saveMsg}
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.9fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Input Form */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: 16, color: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            1. Crop & Production Parameters
          </h3>

          <div className="form-group">
            <label className="form-label">Crop Name</label>
            <select
              className="form-select"
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
            >
              <option value="Groundnut">Groundnut (వేరుశనగ)</option>
              <option value="Paddy (Rice)">Paddy (వరి)</option>
              <option value="Cotton">Cotton (ప్రత్తి)</option>
              <option value="Tomato">Tomato (టమాటా)</option>
              <option value="Maize">Maize (మొక్కజొన్న)</option>
              <option value="Red Gram">Red Gram / Toor (కంది)</option>
            </select>
          </div>

          <div className="grid-cols-3">
            <div className="form-group">
              <label className="form-label">Area (Acres)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                className="form-input"
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Yield (Qtl)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={expectedYield}
                onChange={(e) => setExpectedYield(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (₹/Qtl)</label>
              <input
                type="number"
                min="500"
                step="50"
                className="form-input"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>
          </div>

          <h3 style={{ fontSize: '1.15rem', margin: '20px 0 14px', color: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            2. Itemized Cost Breakdown (₹)
          </h3>

          <div className="grid-cols-2">
            <div className="form-group">
              <label className="form-label">Seed Cost (₹)</label>
              <input
                type="number"
                className="form-input"
                value={seedCost}
                onChange={(e) => setSeedCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fertilizer (DAP/Urea) (₹)</label>
              <input
                type="number"
                className="form-input"
                value={fertilizerCost}
                onChange={(e) => setFertilizerCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pesticides & Bio (₹)</label>
              <input
                type="number"
                className="form-input"
                value={pesticideCost}
                onChange={(e) => setPesticideCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Irrigation / Diesel (₹)</label>
              <input
                type="number"
                className="form-input"
                value={irrigationCost}
                onChange={(e) => setIrrigationCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Labour Cost (₹)</span>
                <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>Auto-fillable</span>
              </label>
              <input
                type="number"
                className="form-input"
                value={labourCost}
                onChange={(e) => setLabourCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tractor & Machinery (₹)</label>
              <input
                type="number"
                className="form-input"
                value={machineryCost}
                onChange={(e) => setMachineryCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Transport to Mandi (₹)</label>
              <input
                type="number"
                className="form-input"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contingency / Other (₹)</label>
              <input
                type="number"
                className="form-input"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic KPIs, Scenarios & Selling Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {results && (
            <>
              {/* Top KPI Cards */}
              <div className="grid-cols-3">
                <div
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Gross Revenue</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
                    ₹{results.gross_revenue.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#4ade80' }}>
                    {results.area_acres} Acres @ {results.break_even_yield.toFixed(1)} qtl breakeven
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Production Cost</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: 4 }}>
                    ₹{results.total_cost.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
                    ₹{(results.total_cost / results.area_acres).toFixed(0)} / acre
                  </span>
                </div>

                <div
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    background: results.net_profit >= 0
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)'
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
                    border: `1px solid ${results.net_profit >= 0 ? '#22c55e' : '#ef4444'}`,
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase' }}>Net Expected Profit</span>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: results.net_profit >= 0 ? '#4ade80' : '#f87171',
                      marginTop: 4,
                    }}
                  >
                    ₹{results.net_profit.toLocaleString()}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: results.net_profit >= 0 ? '#86efac' : '#fca5a5' }}>
                    ₹{results.profit_per_acre.toFixed(0)} per acre
                  </span>
                </div>
              </div>

              {/* Break-Even Callouts */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Scale size={24} color="#f59e0b" />
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Break-Even Price</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24' }}>
                      ₹{results.break_even_price.toFixed(1)} / qtl
                    </div>
                  </div>
                </div>

                <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.1)' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingUp size={24} color="#22c55e" />
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Break-Even Yield</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>
                      {results.break_even_yield.toFixed(1)} Quintals
                    </div>
                  </div>
                </div>

                <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.1)' }} />

                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Return on Investment</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
                    {((results.net_profit / (results.total_cost || 1)) * 100).toFixed(1)}% ROI
                  </div>
                </div>
              </div>

              {/* Scenarios Table: Low (-20%), Base, High (+20%) */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} color="#38bdf8" /> Risk Scenarios (Low / Base / High)
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Scenario</th>
                        <th style={{ padding: '8px 10px' }}>Yield (qtl)</th>
                        <th style={{ padding: '8px 10px' }}>Price (₹/qtl)</th>
                        <th style={{ padding: '8px 10px' }}>Gross Rev (₹)</th>
                        <th style={{ padding: '8px 10px' }}>Net Profit (₹)</th>
                        <th style={{ padding: '8px 10px' }}>Profit/Ac (₹)</th>
                        <th style={{ padding: '8px 10px' }}>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.scenarios.map((s, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: idx === 1 ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px', fontWeight: idx === 1 ? 700 : 500 }}>
                            {s.scenario}
                          </td>
                          <td style={{ padding: '10px' }}>{s.yield_qtl}</td>
                          <td style={{ padding: '10px' }}>₹{s.selling_price}</td>
                          <td style={{ padding: '10px' }}>₹{s.gross_revenue.toLocaleString()}</td>
                          <td
                            style={{
                              padding: '10px',
                              fontWeight: 700,
                              color: s.net_profit >= 0 ? '#4ade80' : '#f87171',
                            }}
                          >
                            ₹{s.net_profit.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px' }}>₹{s.profit_per_acre.toFixed(0)}</td>
                          <td style={{ padding: '10px', color: s.roi_percent >= 0 ? '#38bdf8' : '#f87171' }}>
                            {s.roi_percent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selling Options Comparison */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={18} color="#22c55e" /> Selling Channel Net Realization Comparison
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {results.selling_options.map((opt, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: opt.is_best ? 'rgba(34, 197, 94, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                        border: opt.is_best ? '1px solid #22c55e' : '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: '0.98rem', color: '#f8fafc' }}>{opt.name}</strong>
                          {opt.is_best && (
                            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                              ★ Optimal Return
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 4 }}>
                          {opt.notes} | Market rate: ₹{opt.market_price}/qtl
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: opt.is_best ? '#4ade80' : '#cbd5e1' }}>
                          Net ₹{opt.net_profit.toLocaleString()}
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          ₹{opt.net_price_per_qtl.toFixed(1)}/qtl net price
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#f59e0b' }} />
                <span>{results.disclaimer}</span>
              </div>
            </>
          )}

          {/* Saved Portfolios Accordion */}
          {savedList.length > 0 && (
            <div className="glass-panel" style={{ padding: '18px 20px' }}>
              <h4 style={{ fontSize: '1.02rem', marginBottom: 10, color: '#f8fafc' }}>
                Saved Farm Portfolios ({savedList.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedList.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#4ade80' }}>{s.crop_name}</strong> ({s.area_acres} ac) — Net Profit ₹{Number(s.results?.net_profit || 0).toLocaleString()}
                      <span style={{ color: '#64748b', marginLeft: 8 }}>
                        ({new Date(s.created_at).toLocaleDateString()})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteSaved(s.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
