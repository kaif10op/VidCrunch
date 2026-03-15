"""Payment API routes — Razorpay integration."""

import hmac
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Payment, User
from app.schemas.schemas import (
    CreateOrderRequest,
    CreateOrderResponse,
    MessageResponse,
    PaymentResponse,
    VerifyPaymentRequest,
)
from app.services.credit_service import add_credits

router = APIRouter()
settings = get_settings()

# Plan → (amount_paise, credits)
PLANS = {
    "starter": (49900, 500),    # ₹499 → 500 credits
    "pro": (149900, 2000),      # ₹1499 → 2000 credits
}


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    req: CreateOrderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Razorpay payment order."""
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    amount_paise, credits = PLANS[req.plan]

    # Create Razorpay order
    import razorpay

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"order_{user.id}_{req.plan}",
        "notes": {"user_id": str(user.id), "plan": req.plan},
    })

    # Save payment record
    payment = Payment(
        user_id=user.id,
        razorpay_order_id=order["id"],
        amount_paise=amount_paise,
        plan=req.plan,
        credits_purchased=credits,
        status="created",
    )
    db.add(payment)

    return CreateOrderResponse(
        order_id=order["id"],
        amount=amount_paise,
        currency="INR",
        key_id=settings.RAZORPAY_KEY_ID,
        plan=req.plan,
        credits=credits,
    )


@router.post("/verify", response_model=MessageResponse)
async def verify_payment(
    req: VerifyPaymentRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify Razorpay payment signature and add credits."""
    # Find payment
    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == req.razorpay_order_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Order not found")

    if payment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Order does not belong to user")

    if payment.status == "captured":
        raise HTTPException(status_code=400, detail="Payment already verified")

    # Verify signature
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if expected_sig != req.razorpay_signature:
        payment.status = "failed"
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # Mark payment as captured
    payment.razorpay_payment_id = req.razorpay_payment_id
    payment.razorpay_signature = req.razorpay_signature
    payment.status = "captured"

    # Add credits
    await add_credits(
        db, user.id, payment.credits_purchased, "purchase", str(payment.id)
    )

    return MessageResponse(
        message=f"Payment verified! {payment.credits_purchased} credits added."
    )


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Razorpay webhook events."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify webhook signature
    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if expected != signature:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json

    payload = json.loads(body)
    event = payload.get("event")

    if event == "payment.captured":
        payment_entity = payload["payload"]["payment"]["entity"]
        order_id = payment_entity.get("order_id")

        result = await db.execute(
            select(Payment).where(Payment.razorpay_order_id == order_id)
        )
        payment = result.scalar_one_or_none()

        if payment and payment.status != "captured":
            payment.status = "captured"
            payment.razorpay_payment_id = payment_entity["id"]
            await add_credits(
                db, payment.user_id, payment.credits_purchased, "purchase", str(payment.id)
            )

    return {"status": "ok"}


@router.get("/history", response_model=list[PaymentResponse])
async def payment_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
    )
    return result.scalars().all()
