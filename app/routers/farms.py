from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import require_role

router = APIRouter(prefix="/api/farms", tags=["farms"])
farmer_only = require_role(models.Role.FARMER.value, models.Role.HYBRID.value)


@router.post("", response_model=schemas.FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(body: schemas.FarmRequest, user: models.User = Depends(farmer_only),
                db: Session = Depends(get_db)):
    farm = models.Farm(owner_id=user.id, **body.model_dump())
    db.add(farm)
    db.commit()
    return farm


@router.get("/mine", response_model=list[schemas.FarmOut])
def my_farms(user: models.User = Depends(farmer_only), db: Session = Depends(get_db)):
    return db.scalars(select(models.Farm).where(models.Farm.owner_id == user.id)).all()
