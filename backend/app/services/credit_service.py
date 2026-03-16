"""Credit management service."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import Credit, CreditTransaction

settings = get_settings()


async def get_credit_balance(db: AsyncSession, user_id: UUID) -> Credit:
    """Get or create credit record for user."""
    result = await db.execute(select(Credit).where(Credit.user_id == user_id))
    credit = result.scalar_one_or_none()

    if not credit:
        credit = Credit(
            user_id=user_id,
            balance=settings.FREE_CREDITS,
            total_earned=settings.FREE_CREDITS,
            total_spent=0,
        )
        db.add(credit)
        # Log the signup bonus
        tx = CreditTransaction(
            user_id=user_id,
            amount=settings.FREE_CREDITS,
            operation="signup_bonus",
            balance_after=settings.FREE_CREDITS,
        )
        db.add(tx)
        await db.flush()

    return credit


async def check_and_deduct(
    db: AsyncSession, user_id: UUID, cost: int, operation: str, reference_id: str = None
) -> Credit:
    """Check if user has enough credits, deduct if so, raise 402 if not."""
    credit = await get_credit_balance(db, user_id)

    if credit.balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Need {cost}, have {credit.balance}.",
        )

    credit.balance -= cost
    credit.total_spent += cost

    tx = CreditTransaction(
        user_id=user_id,
        amount=-cost,
        operation=operation,
        reference_id=reference_id,
        balance_after=credit.balance,
    )
    db.add(tx)
    await db.flush()

    return credit


async def add_credits(
    db: AsyncSession, user_id: UUID, amount: int, operation: str, reference_id: str = None
) -> Credit:
    """Add credits to user's balance (after purchase, etc.)."""
    credit = await get_credit_balance(db, user_id)

    credit.balance += amount
    credit.total_earned += amount

    tx = CreditTransaction(
        user_id=user_id,
        amount=amount,
        operation=operation,
        reference_id=reference_id,
        balance_after=credit.balance,
    )
    db.add(tx)
    await db.flush()

    return credit
