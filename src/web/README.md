# Terraform Visualizer Frontend

[![Build Status](https://github.com/your-repo/terraform-visualizer/workflows/CI/badge.svg)](https://github.com/your-repo/terraform-visualizer/actions)
[![Dependencies](https://img.shields.io/david/your-repo/terraform-visualizer)](https://david-dm.org/your-repo/terraform-visualizer)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Coverage](https://codecov.io/gh/your-repo/terraform-visualizer/branch/main/graph/badge.svg)](https://codecov.io/gh/your-repo/terraform-visualizer)

Interactive web application for visualizing and managing Terraform infrastructure code. Transform complex Terraform configurations into intuitive, interactive graphs that reveal relationships between resources, modules, and environments.

## Technology Stack

- **React** (v18.x) - Modern UI framework with TypeScript support
- **Material-UI** (v5.x) - Comprehensive UI component library
- **React Flow** (v11.x) - Powerful library for interactive node-based graphs
- **Monaco Editor** (v0.36.x) - VS Code-based editor for code manipulation
- **Redux Toolkit** (v1.9.x) - State management with modern Redux best practices
- **Socket.io Client** (v4.6.x) - Real-time updates and collaboration
- **Jest** (v29.x) & **Cypress** (v12.x) - Comprehensive testing suite

## Getting Started

### System Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0
- Supported Browsers:
  - Chrome 90+
  - Firefox 88+
  - Safari 14+
  - Edge 90+

### Development Tools Setup

1. Install VS Code with recommended extensions:
   - ESLint
   - Prettier
   - TypeScript
   - React Developer Tools

2. Configure IDE settings:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

### Environment Configuration

1. Create `.env.local` file in the project root:
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_WS_URL=ws://localhost:3001
   VITE_GITHUB_CLIENT_ID=your_github_client_id
   VITE_APP_ENV=development
   ```

### Installation Steps

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run test` - Run Jest unit tests
- `npm run test:e2e` - Run Cypress E2E tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run analyze` - Analyze bundle size

### Code Style Guide

- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Follow Material-UI theming system
- Document components with JSDoc
- Write meaningful test descriptions

### Testing Strategy

- **Unit Tests**: Components, hooks, and utilities
- **Integration Tests**: Component interactions
- **E2E Tests**: Critical user flows
- **Performance Tests**: Load times and interactions
- **Accessibility Tests**: WCAG 2.1 compliance

### Performance Optimization

Target metrics:
- Initial Load: < 2s
- Graph Render: < 1s
- Code Update: < 200ms
- View Transition: < 500ms

Optimization techniques:
- Code splitting
- Lazy loading
- Memoization
- Virtual scrolling
- Asset optimization

## Architecture

### Component Structure

```text
src/
├── components/
│   ├── common/         # Reusable components
│   ├── graph/          # Visualization components
│   ├── editor/         # Code editor components
│   └── layout/         # Layout components
├── hooks/              # Custom React hooks
├── services/           # API and WebSocket services
├── store/              # Redux store configuration
├── types/              # TypeScript definitions
└── utils/              # Utility functions
```

### State Management

- **Global State**: Redux Toolkit for application-wide state
- **Local State**: React hooks for component-level state
- **Server State**: RTK Query for API data management
- **Real-time State**: Socket.io for live updates

### Visualization Engine

- Graph rendering with React Flow
- Custom node types for Terraform resources
- Interactive zoom and pan controls
- Auto-layout algorithms
- Real-time graph updates

### Error Handling

- Global error boundary
- API error interceptors
- Validation error display
- Graceful degradation
- Error tracking and reporting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.