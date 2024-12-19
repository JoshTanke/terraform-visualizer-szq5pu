# Build stage
FROM node:18-alpine AS builder
LABEL maintainer="DevOps Team"
LABEL version="1.0"
LABEL description="Terraform Parser Service"

# Set build arguments
ARG NODE_ENV=production
ARG PORT=3001

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY src/backend/package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy TypeScript configuration
COPY src/backend/tsconfig.json ./

# Copy source code directories
COPY src/backend/src/parser ./src/parser
COPY src/backend/src/interfaces ./src/interfaces

# Build TypeScript code
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine
LABEL maintainer="DevOps Team"
LABEL version="1.0"
LABEL description="Terraform Parser Service"

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV USER=nodejs
ENV WORKDIR=/app

# Create non-root user
RUN addgroup -S nodejs && \
    adduser -S nodejs -G nodejs && \
    mkdir -p ${WORKDIR} && \
    chown -R nodejs:nodejs ${WORKDIR}

# Set working directory
WORKDIR ${WORKDIR}

# Copy production dependencies and built code from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Install production-only system dependencies
RUN apk add --no-cache tini

# Security hardening
RUN chmod -R 550 ${WORKDIR} && \
    chmod -R 550 ${WORKDIR}/node_modules && \
    chmod -R 550 ${WORKDIR}/dist

# Switch to non-root user
USER nodejs

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set the application startup command
CMD ["node", "dist/parser/TerraformParser.js"]

# Expose port
EXPOSE ${PORT}