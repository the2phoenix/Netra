FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/
COPY fixtures/ ./fixtures/

# Create cache directory
RUN mkdir -p /app/cache

ENV PYTHONUNBUFFERED=1
ENV CACHE_DIR=/app/cache
ENV FIXTURES_DIR=/app/fixtures

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
