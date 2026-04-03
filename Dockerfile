FROM python:3.12-slim

WORKDIR /app

# System dependencies for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Copy backend files
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source
COPY backend/ .

# Ensure start.sh is executable
RUN chmod +x start.sh

EXPOSE 8000

# Start both API and Worker
CMD ["./start.sh"]
