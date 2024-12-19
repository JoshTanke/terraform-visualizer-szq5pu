# Terraform Visualizer Backend

## Overview

The Terraform Visualizer Backend is a robust, scalable service architecture built with Node.js 18.x LTS and TypeScript 4.9.x, designed to power the Terraform Visualization Tool. The backend consists of three main components:

- **Parser Service**: High-performance HCL2 parser for Terraform configurations
- **API Gateway**: RESTful service handling external communications
- **WebSocket Server**: Real-time updates and bi-directional communication

### Key Features

- Fast Terraform configuration parsing (< 3s for standard files)
- Real-time visualization updates via WebSocket
- Secure GitHub integration
- Scalable microservices architecture
- Comprehensive caching strategy with Redis
- MongoDB-based persistent storage

## Prerequisites

### Required Software

- Node.js 18.x LTS
- MongoDB 6.0.x
- Redis 7.0.x
- Git 2.x+
- Docker & Docker Compose (for containerized development)

### Recommended IDE Setup

- Visual Studio Code with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Docker
  - MongoDB for VS Code

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd src/backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development services:
```bash
docker-compose up -d  # Starts MongoDB and Redis
npm run dev          # Starts backend services in development mode
```

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_VERSION=v1

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/terraform-visualizer
REDIS_URL=redis://localhost:6379

# GitHub Integration
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Security
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=1h
CORS_ORIGIN=http://localhost:3000

# Performance
PARSER_TIMEOUT=5000
CACHE_TTL=3600
MAX_FILE_SIZE=5mb
```

### Service-Specific Settings

- Parser Service: `config/parser.config.ts`
- API Gateway: `config/api.config.ts`
- WebSocket Server: `config/websocket.config.ts`

## Development

### Available Scripts

```bash
npm run dev           # Start development server
npm run build         # Build production bundle
npm run start         # Start production server
npm run test          # Run test suite
npm run test:watch    # Run tests in watch mode
npm run lint          # Lint code
npm run lint:fix      # Fix linting issues
npm run format        # Format code with Prettier
```

### Code Structure

```
src/backend/
├── src/
│   ├── api/           # API Gateway implementation
│   ├── parser/        # Terraform Parser Service
│   ├── websocket/     # WebSocket Server
│   ├── models/        # Database models
│   ├── services/      # Shared services
│   ├── utils/         # Utility functions
│   └── config/        # Configuration files
├── tests/             # Test files
├── docs/              # Additional documentation
└── scripts/           # Utility scripts
```

## API Documentation

### REST Endpoints

```typescript
// Projects
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id

// Environments
GET    /api/v1/environments
POST   /api/v1/environments
GET    /api/v1/environments/:id

// Visualization
GET    /api/v1/graph/:projectId
GET    /api/v1/graph/:projectId/environment/:envId
```

### WebSocket Events

```typescript
// Client -> Server
'code.update'    // Code changes
'graph.request'  // Request visualization update
'sync.start'     // Start GitHub sync

// Server -> Client
'graph.update'   // Graph data updates
'parser.status'  // Parser status updates
'error'          // Error notifications
```

## Performance

### Benchmarks

| Operation | Target Time | Load | Status |
|-----------|------------|------|---------|
| Parse Configuration | < 3s | 1MB file | ✅ |
| Graph Generation | < 1s | 100 nodes | ✅ |
| API Response | < 200ms | Standard payload | ✅ |
| WebSocket Latency | < 100ms | Real-time updates | ✅ |

### Monitoring

- Performance metrics via DataDog
- Request tracing with OpenTelemetry
- Custom performance dashboards
- Automated alerting for SLA violations

## Security

### Implementation

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting and request throttling
- Input validation and sanitization
- Secure session management
- CORS configuration
- Data encryption at rest and in transit

### Best Practices

- Regular security audits
- Dependency vulnerability scanning
- Secure coding guidelines
- Access token rotation
- Audit logging
- OWASP compliance

## Deployment

### Production Setup

1. Build the application:
```bash
npm run build
```

2. Deploy using Docker:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Configuration

- Production-ready MongoDB cluster
- Redis cluster with replication
- Load balancer configuration
- SSL/TLS setup
- Monitoring and logging
- Backup strategy

## Troubleshooting

### Common Issues

1. Parser Service Issues
   - Check input file size
   - Verify HCL syntax
   - Monitor memory usage
   - Check parser logs

2. API Gateway Issues
   - Verify authentication
   - Check rate limits
   - Monitor request logs
   - Validate request payload

3. WebSocket Issues
   - Check connection status
   - Verify client compatibility
   - Monitor event queue
   - Check network latency

### Logging

```typescript
// Log Levels
ERROR   // Critical errors requiring immediate attention
WARN    // Warning conditions
INFO    // General information about system operation
DEBUG   // Detailed debugging information
TRACE   // Very detailed debugging information
```

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Implement changes
4. Write/update tests
5. Submit pull request

### Code Standards

- Follow TypeScript best practices
- Maintain test coverage > 80%
- Document all public APIs
- Follow semantic versioning
- Keep commits atomic and well-documented

### Review Process

1. Code review by team members
2. Automated CI checks
3. Performance impact assessment
4. Security review
5. Documentation review

For detailed contribution guidelines, see CONTRIBUTING.md