# GHOST-OFFICIAL-V1 Dockerfile
# RAK Realm - Exclusive Copyright RAK

# Use official Node.js runtime as a base image for security
FROM node:18-bullseye-slim

# Set maintainer label
LABEL maintainer="RAK" \
      description="GHOST-OFFICIAL-V1 WhatsApp Bot" \
      version="1.0.0"

# Create and set working directory
WORKDIR /usr/src/ghost-official

# Install system dependencies including essential build tools
RUN apt-get update && \
    apt-get install -y \
    curl \
    git \
    python3 \
    make \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./
COPY yarn.lock ./

# Install Node.js dependencies
RUN npm install --production --silent

# Copy application source code
COPY . .

# Create necessary directories
RUN mkdir -p \
    session \
    logs \
    plugins \
    assets \
    languages

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    PREFIX="/" \
    LOG_LEVEL="info"

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run as non-root user for security
RUN chown -R node:node /usr/src/ghost-official
USER node

# Start the application
CMD ["npm", "start"]