"""Credit management service with race condition protection."""

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import Credit, CreditTransaction

logger = logging.getLogger(__name__)
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
    """Check if user has enough credits, deduct if so, raise 402 if not.
    
    Uses atomic UPDATE with WHERE clause to prevent race conditions.
    """
    # First, get current credit to check balance
    credit = await get_credit_balance(db, user_id)

    if credit.balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits. Need {cost}, have {credit.balance}.",
        )

    # Atomic update: only deduct if balance >= cost (prevents race condition)
    # Using raw UPDATE with WHERE clause ensures atomicity
    result = await db.execute(
        update(Credit)
        .where(
            Credit.user_id == user_id,
            Credit.balance >= cost  # Double-check in the query itself
        )
        .values(
            balance=Credit.balance - cost,
            total_spent=Credit.total_spent + cost
        )
        .returning(Credit.balance)
    )
    
    updated_row = result.fetchone()
    
    if updated_row is None:
        # Race condition: another request consumed the credits
        logger.warning(f"Race condition detected for user {user_id}, operation {operation}")
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Insufficient credits. Please try again.",
        )

    new_balance = updated_row[0]

    # Log the transaction
    tx = CreditTransaction(
        user_id=user_id,
        amount=-cost,
        operation=operation,
        reference_id=reference_id,
        balance_after=new_balance,
    )
    db.add(tx)
    await db.flush()

    # Refresh credit object for return
    await db.refresh(credit)
    return credit


async def add_credits(
    db: AsyncSession, user_id: UUID, amount: int, operation: str, reference_id: str = None
) -> Credit:
    """Add credits to user's balance (after purchase, etc.).
    
    Uses atomic UPDATE to prevent race conditions.
    """
    # Ensure credit record exists
    credit = await get_credit_balance(db, user_id)

    # Atomic update
    result = await db.execute(
        update(Credit)
        .where(Credit.user_id == user_id)
        .values(
            balance=Credit.balance + amount,
            total_earned=Credit.total_earned + amount
        )
        .returning(Credit.balance)
    )
    
    updated_row = result.fetchone()
    
    if updated_row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add credits.",
        )

    new_balance = updated_row[0]

    # Log the transaction
    tx = CreditTransaction(
        user_id=user_id,
        amount=amount,
        operation=operation,
        reference_id=reference_id,
        balance_after=new_balance,
    )
    db.add(tx)
    await db.flush()

    # Refresh credit object for return
    await db.refresh(credit)
    return credit
