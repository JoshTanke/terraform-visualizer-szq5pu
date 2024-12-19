# Contributing to Terraform Visualization Tool

Welcome to the Terraform Visualization Tool project! We're excited that you're interested in contributing. This document provides comprehensive guidelines to help you contribute effectively to our project.

## Table of Contents
- [Project Overview](#project-overview)
- [Development Environment Setup](#development-environment-setup)
- [Development Workflow](#development-workflow)
- [Testing Requirements](#testing-requirements)
- [Performance Standards](#performance-standards)
- [Security Guidelines](#security-guidelines)
- [Documentation Standards](#documentation-standards)

## Project Overview

The Terraform Visualization Tool is a web-based application designed to provide interactive visualization and management of Terraform infrastructure code. The system helps teams understand complex infrastructure relationships and dependencies across multiple environments and modules.

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors are expected to adhere to our Code of Conduct.

### Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up your development environment
4. Create a new branch for your work
5. Make your changes
6. Submit a pull request

### Development Prerequisites

- Node.js 18.x LTS
- Git
- Docker and Docker Compose
- VS Code (recommended)

## Development Environment Setup

### Required Tools

1. **VS Code Setup**
   - Install recommended extensions:
     - ESLint
     - Prettier
     - TypeScript and JavaScript
     - Docker
     - Jest Runner
     - Cypress Helper

2. **Node.js Configuration**
   ```bash
   nvm install 18
   nvm use 18
   npm install -g yarn
   ```

3. **Docker Setup**
   ```bash
   docker-compose up -d
   ```

### IDE Configuration

Create or update the following configuration files:

1. **.vscode/settings.json**
   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

### Environment Variables

Create a `.env` file with required configurations (see `.env.example` for template).

### Local Development Server

```bash
yarn install
yarn dev
```

## Development Workflow

### Git Workflow

1. **Branch Naming Convention**
   ```
   <type>/<description>
   
   Types:
   - feature/
   - bugfix/
   - hotfix/
   - refactor/
   - docs/
   ```

2. **Commit Message Format**
   ```
   <type>(<scope>): <subject>
   
   Types:
   - feat: New feature
   - fix: Bug fix
   - docs: Documentation
   - style: Code style changes
   - refactor: Code refactoring
   - test: Testing
   - chore: Maintenance
   - perf: Performance improvements
   - security: Security fixes
   ```

### Code Style Guidelines

- Follow Airbnb TypeScript Style Guide
- Use Prettier for formatting (version 2.x)
- Use ESLint for linting (version 8.x)
- Maintain 80% or higher code coverage

### Pull Request Process

1. Update relevant documentation
2. Add/update tests as needed
3. Ensure all tests pass
4. Update the changelog
5. Request review from maintainers
6. Address review feedback

## Testing Requirements

### Unit Testing (Jest 29.x)
- Write tests for all new code
- Coverage requirements:
  - Statements: 80%
  - Branches: 80%
  - Functions: 80%
  - Lines: 80%

### Integration Testing
- Test component interactions
- Verify API integrations
- Test database operations

### E2E Testing (Cypress 12.x)
- Cover critical user flows
- Test across supported browsers
- Include mobile viewport testing

### Performance Testing
- Parse time: < 3 seconds for standard files
- Visualization response: < 1 second
- Memory usage: < 512MB
- Load testing scenarios required

## Performance Standards

### Performance Requirements
- Initial parse time: < 3 seconds
- Graph visualization response: < 1 second
- View transitions: < 500ms
- Code updates: < 200ms
- GitHub sync: < 5 seconds

### Optimization Guidelines
1. Use lazy loading where appropriate
2. Implement proper memoization
3. Optimize bundle size
4. Use efficient data structures
5. Implement caching strategies

## Security Guidelines

### Security Requirements
1. Run security scanning tools
2. Follow OWASP security guidelines
3. Implement proper input validation
4. Use secure dependency versions
5. Follow least privilege principle

### Dependency Management
- Regular dependency updates
- Security vulnerability scanning
- Lock file maintenance
- Version pinning for stability

## Documentation Standards

### Code Documentation
- Clear and concise comments
- JSDoc for functions and classes
- Type definitions
- Architecture decision records

### API Documentation
- OpenAPI/Swagger specifications
- Request/response examples
- Error handling documentation
- Rate limiting details

### Technical Writing Style
- Clear and concise language
- Code examples where appropriate
- Step-by-step instructions
- Proper formatting and structure

## Additional Resources

- [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)
- [Pull Request Template](.github/pull_request_template.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## Questions or Need Help?

Feel free to:
- Open an issue for questions
- Join our community discussions
- Reach out to maintainers

Thank you for contributing to the Terraform Visualization Tool!