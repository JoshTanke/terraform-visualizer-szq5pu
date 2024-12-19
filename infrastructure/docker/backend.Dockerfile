# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY src/backend/package*.json ./

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code and TypeScript config
COPY src/backend/tsconfig.json ./
COPY src/backend/src ./src

# Build TypeScript code to JavaScript
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Copy built artifacts and dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Set production environment
ENV NODE_ENV=production

# Security hardening
RUN chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod 550 /app/package*.json

# Expose API port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set security options
LABEL security.noprofile=true \
      security.nocaps=true \
      security.noroot=true

# Define entrypoint
ENTRYPOINT ["node", "dist/server.js"]

# Default command (can be overridden)
CMD ["--max-old-space-size=2048"]