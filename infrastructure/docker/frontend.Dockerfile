# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    git=2.40.1-r0 \
    python3=3.11.6-r0 \
    make=4.4.1-r1 \
    g++=12.2.1_git20220924-r10 \
    && rm -rf /var/cache/apk/*

# Copy package files for dependency installation
COPY src/web/package*.json ./

# Install dependencies with frozen lockfile for reproducible builds
RUN npm ci --only=production \
    && npm cache clean --force

# Copy source code and configuration files
COPY src/web/tsconfig*.json ./
COPY src/web/vite.config.ts ./
COPY src/web/src ./src
COPY src/web/public ./public

# Set build-time environment variables
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_APP_VERSION
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"

# Run TypeScript compilation and production build
RUN npm run typecheck \
    && npm run build

# Clean up build dependencies
RUN npm prune --production

# Stage 2: Production
FROM nginx:1.24-alpine

# Create nginx user and group for security
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx

# Copy custom nginx configuration with security headers
COPY infrastructure/docker/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid

# Configure compression and caching
RUN rm /etc/nginx/conf.d/default.conf
COPY infrastructure/docker/compression.conf /etc/nginx/conf.d/compression.conf
COPY infrastructure/docker/cache-control.conf /etc/nginx/conf.d/cache-control.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Add metadata labels
LABEL maintainer="DevOps Team" \
    version="${VITE_APP_VERSION}" \
    build_date="${BUILD_DATE}" \
    vcs_ref="${VCS_REF}"

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Security options
SECURITY_OPT ["no-new-privileges=true", "seccomp=unconfined"]
VOLUME ["/var/cache/nginx"]
WORKDIR /usr/share/nginx/html

# Read-only root filesystem
READONLY true