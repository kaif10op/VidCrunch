"""Credits API routes — balance, transaction history."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CreditTransaction, User
from app.schemas.schemas import CreditBalanceResponse, CreditTransactionResponse
from app.services.credit_service import get_credit_balance

router = APIRouter()


@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current credit balance."""
    credit = await get_credit_balance(db, user.id)
    return CreditBalanceResponse(
        balance=credit.balance,
        total_earned=credit.total_earned,
        total_spent=credit.total_spent,
    )


@router.get("/transactions", response_model=list[CreditTransactionResponse])
async def get_transactions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """Get credit transaction history."""
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == user.id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()
