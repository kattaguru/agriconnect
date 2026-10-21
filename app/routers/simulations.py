from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import current_user, require_role
from ..services import record_audit

router = APIRouter(prefix="/api/simulations", tags=["simulations"])
farmer_only = require_role(models.Role.FARMER.value, models.Role.HYBRID.value)

DISCLAIMER_TEXT = (
    "Agricultural and economic estimates only based on user inputs. "
    "Actual yields, market prices, and labor rates depend on real-time weather, pests, "
    "and market demand. Always consult local Agricultural Extension Officers (ADA/KVK) before making major investments."
)


def compute_simulation(data: schemas.SimulationInput) -> schemas.SimulationOutput:
    # 1. Determine labour cost
    labour = data.labour_cost
    if data.workers_count and data.work_days and data.wage_per_day:
        labour = data.workers_count * data.work_days * data.wage_per_day

    # 2. Total cost
    cost_items = {
        "Seed": round(data.seed_cost, 2),
        "Fertilizer": round(data.fertilizer_cost, 2),
        "Pesticide / Crop Protection": round(data.pesticide_cost, 2),
        "Irrigation / Water": round(data.irrigation_cost, 2),
        "Labour": round(labour, 2),
        "Machinery / Rental": round(data.machinery_cost, 2),
        "Transport": round(data.transport_cost, 2),
        "Other / Contingency": round(data.other_cost, 2),
    }
    total_cost = sum(cost_items.values())

    # 3. Base calculations
    gross_revenue = data.expected_yield_qtl * data.selling_price_per_qtl
    net_profit = gross_revenue - total_cost
    profit_per_acre = net_profit / data.area_acres if data.area_acres > 0 else 0.0

    break_even_price = (total_cost / data.expected_yield_qtl) if data.expected_yield_qtl > 0 else 0.0
    break_even_yield = (total_cost / data.selling_price_per_qtl) if data.selling_price_per_qtl > 0 else 0.0

    # 4. Scenarios: Low (-20%), Base, High (+20%)
    scenarios = []
    for label, y_mult, p_mult in [
        ("Low Case (-20% Yield & Price)", 0.8, 0.8),
        ("Base Case", 1.0, 1.0),
        ("High Case (+20% Yield & Price)", 1.2, 1.2),
    ]:
        s_yield = data.expected_yield_qtl * y_mult
        s_price = data.selling_price_per_qtl * p_mult
        s_rev = s_yield * s_price
        s_profit = s_rev - total_cost
        s_ppa = s_profit / data.area_acres if data.area_acres > 0 else 0.0
        roi = (s_profit / total_cost * 100) if total_cost > 0 else 0.0
        scenarios.append(schemas.ScenarioRow(
            scenario=label,
            yield_qtl=round(s_yield, 2),
            selling_price=round(s_price, 2),
            gross_revenue=round(s_rev, 2),
            total_cost=round(total_cost, 2),
            net_profit=round(s_profit, 2),
            profit_per_acre=round(s_ppa, 2),
            roi_percent=round(roi, 1),
        ))

    # 5. Sensitivity (+/- 10%)
    sensitivity = {
        "profit_price_minus_10": round((data.expected_yield_qtl * data.selling_price_per_qtl * 0.9) - total_cost, 2),
        "profit_price_plus_10": round((data.expected_yield_qtl * data.selling_price_per_qtl * 1.1) - total_cost, 2),
        "profit_yield_minus_10": round((data.expected_yield_qtl * 0.9 * data.selling_price_per_qtl) - total_cost, 2),
        "profit_yield_plus_10": round((data.expected_yield_qtl * 1.1 * data.selling_price_per_qtl) - total_cost, 2),
    }

    # 6. Selling options
    selling_inputs = data.selling_options
    if not selling_inputs:
        base_p = data.selling_price_per_qtl
        selling_inputs = [
            schemas.SellingOptionInput(
                name="Local Village Trader / Mandi (Immediate)",
                market_price=base_p,
                transport_per_qtl=15.0,
                commission_per_qtl=base_p * 0.02,
                storage_cost_per_day_per_qtl=0.0,
                days_stored=0,
                shrinkage_percent=0.0,
            ),
            schemas.SellingOptionInput(
                name="District APMC Market Hub (Direct Sale)",
                market_price=round(base_p * 1.08, 2),
                transport_per_qtl=55.0,
                commission_per_qtl=base_p * 0.015,
                storage_cost_per_day_per_qtl=0.0,
                days_stored=0,
                shrinkage_percent=0.5,
            ),
            schemas.SellingOptionInput(
                name="Cold Storage / Warehouse (Hold 30 Days)",
                market_price=round(base_p * 1.22, 2),
                transport_per_qtl=40.0,
                commission_per_qtl=base_p * 0.02,
                storage_cost_per_day_per_qtl=1.5,
                days_stored=30,
                shrinkage_percent=2.0,
            ),
        ]

    selling_outputs = []
    base_prod_cost_without_transport = total_cost - data.transport_cost
    for opt in selling_inputs:
        storage_total = opt.storage_cost_per_day_per_qtl * opt.days_stored
        deductions = opt.transport_per_qtl + opt.commission_per_qtl + storage_total
        net_p = max(0.0, (opt.market_price - deductions) * (1 - opt.shrinkage_percent / 100))
        tot_gross = net_p * data.expected_yield_qtl
        tot_opt_cost = base_prod_cost_without_transport + (opt.transport_per_qtl * data.expected_yield_qtl) + (storage_total * data.expected_yield_qtl)
        net_prof = (net_p * data.expected_yield_qtl) - base_prod_cost_without_transport
        extra_ts = (opt.transport_per_qtl + storage_total) * data.expected_yield_qtl

        selling_outputs.append(schemas.SellingOptionOut(
            name=opt.name,
            market_price=round(opt.market_price, 2),
            net_price_per_qtl=round(net_p, 2),
            total_gross=round(tot_gross, 2),
            net_profit=round(net_prof, 2),
            extra_transport_and_storage=round(extra_ts, 2),
            notes=f"Net realized ₹{net_p:.1f}/qtl after transport & fees",
        ))

    # Mark the option with highest net profit
    if selling_outputs:
        best_opt = max(selling_outputs, key=lambda x: x.net_profit)
        best_opt.is_best = True

    return schemas.SimulationOutput(
        crop_name=data.crop_name,
        area_acres=round(data.area_acres, 2),
        gross_revenue=round(gross_revenue, 2),
        total_cost=round(total_cost, 2),
        net_profit=round(net_profit, 2),
        profit_per_acre=round(profit_per_acre, 2),
        break_even_price=round(break_even_price, 2),
        break_even_yield=round(break_even_yield, 2),
        cost_breakdown=cost_items,
        scenarios=scenarios,
        selling_options=selling_outputs,
        sensitivity=sensitivity,
        disclaimer=DISCLAIMER_TEXT,
    )


@router.post("/calculate", response_model=schemas.SimulationOutput)
def calculate_profit(body: schemas.SimulationInput, _: models.User = Depends(current_user)):
    return compute_simulation(body)


@router.get("/average-wage")
def get_average_wage(db: Session = Depends(get_db), _: models.User = Depends(current_user)):
    avg_wage = db.scalar(select(func.avg(models.Job.wage_per_day)))
    return {
        "average_wage_per_day": round(float(avg_wage), 2) if avg_wage else 450.0,
        "sample_count": db.scalar(select(func.count(models.Job.id))) or 0,
        "recommended_days_groundnut": 12,
        "recommended_workers_per_acre": 4,
    }


@router.post("/save", response_model=schemas.ProfitSimulationOut, status_code=status.HTTP_201_CREATED)
def save_simulation(
    body: schemas.SaveSimulationRequest,
    user: models.User = Depends(farmer_only),
    db: Session = Depends(get_db),
):
    sim = models.ProfitSimulation(
        user_id=user.id,
        farm_id=body.farm_id,
        crop_name=body.crop_name,
        area_acres=body.area_acres,
        inputs=body.inputs,
        results=body.results,
    )
    db.add(sim)
    db.flush()
    record_audit(db, user_id=user.id, action="SAVE_SIMULATION", resource=f"simulation:{sim.id}")
    db.commit()
    return sim


@router.get("/mine", response_model=list[schemas.ProfitSimulationOut])
def get_my_simulations(user: models.User = Depends(farmer_only), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.ProfitSimulation)
        .where(models.ProfitSimulation.user_id == user.id)
        .order_by(models.ProfitSimulation.created_at.desc())
    ).all()


@router.delete("/{sim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_simulation(sim_id: int, user: models.User = Depends(farmer_only), db: Session = Depends(get_db)):
    sim = db.get(models.ProfitSimulation, sim_id)
    if sim is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation not found")
    if sim.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your simulation")
    db.delete(sim)
    db.commit()
