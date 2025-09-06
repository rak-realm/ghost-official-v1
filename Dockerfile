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
    PREFIX="/" \
    LOG_LEVEL="info"

# Run as non-root user for security
RUN chown -R node:node /usr/src/ghost-official
USER node

# Start the application
CMD ["npm", "start"]
