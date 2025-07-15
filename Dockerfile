# Use Node.js base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript configuration and source files
COPY tsconfig.json ./
COPY src ./src

# Install devDependencies for building
RUN npm ci

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Copy any additional files that might be needed
COPY LICENSE ./
COPY README.md ./

# The entry point will be specified in smithery.yaml 