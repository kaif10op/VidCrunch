"""Documents API routes — upload and manage PDFs/docs."""

from uuid import UUID
import os
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Document, User
from app.schemas.schemas import DocumentResponse, DocumentUploadResponse, MessageResponse
from app.workers.tasks import enqueue_document_processing

router = APIRouter()
settings = get_settings()

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF, DOCX, or TXT file for processing."""
    # Validate file type
    allowed = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "txt"
    }
    
    file_ext = allowed.get(file.content_type)
    if not file_ext:
        # Fallback to extension check for some clients
        ext = file.filename.split('.')[-1].lower() if file.filename else ""
        if ext in ["pdf", "docx", "txt"]:
            file_ext = ext
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type: {file.content_type}. Only PDF, DOCX, and TXT are supported."
            )

    # Save to local storage (in production, use S3)
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, file.filename or f"upload.{file_ext}")
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create document record
    doc = Document(
        user_id=user.id,
        title=file.filename or "Untitled Document",
        file_path=file_path,
        file_type=file_ext,
        file_size_bytes=len(content),
        status="pending"
    )
    db.add(doc)
    await db.flush()

    # Enqueue processing
    await enqueue_document_processing(
        document_id=str(doc.id),
        file_path=file_path,
        file_type=file_ext
    )

    return DocumentUploadResponse(
        id=doc.id,
        title=doc.title,
        status="processing",
        message="Document uploaded. Processing started."
    )

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve document metadata."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/{doc_id}", response_model=MessageResponse)
async def delete_document(
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document and its chunks."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    await db.delete(doc)
    await db.commit()
    return MessageResponse(message="Document deleted successfully")

@router.get("/{doc_id}/download")
async def download_document(
    doc_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve the document file for download or viewing."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.exists(doc.file_path):
         raise HTTPException(status_code=404, detail="File not found on server")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=doc.file_path,
        filename=doc.title,
        media_type="application/octet-stream"
    )
