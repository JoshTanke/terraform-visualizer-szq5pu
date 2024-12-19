---
name: Bug Report
about: Create a detailed report to help us resolve the issue
title: '[BUG] '
labels: ['bug', 'triage', 'needs-validation', 'pending-reproduction']
assignees: ['triage-team']
---

## Bug Description
<!-- Please provide a clear and concise description of the bug -->

### What happened?
<!-- Describe what actually happened -->

### Expected Behavior
<!-- Describe what you expected to happen -->

### Actual Behavior
<!-- Describe what actually occurred -->

### Impact and Severity
<!-- Select one of: Low/Medium/High/Critical -->
**Severity:** 

### Bug Category
<!-- Select one of: UI/Parser/Performance/Integration -->
**Category:** 

## Environment
<!-- Please complete all the following information -->

- Browser & Version: 
- Operating System: 
- Application Version: 
- Environment: <!-- production/staging/development -->
- Terraform Version: 
- Node.js Version (if local development): 
- Screen Resolution (for UI issues): 
- Network Connection Type: 

## Reproduction Steps
<!-- Please provide detailed steps to reproduce the issue -->

1. 
2. 
3. 

### Sample Terraform Configuration
<!-- If applicable, include the relevant Terraform configuration -->
```hcl
# Insert your Terraform configuration here
```

### Current Visualization State
<!-- Describe the state of the visualization when the bug occurs -->

### Error Messages/Logs
<!-- Include any error messages or logs -->
```
# Insert error messages or logs here
```

### Reproduction Rate
- [ ] Always
- [ ] Intermittent
<!-- If intermittent, please specify frequency -->

### User Actions
<!-- Describe the sequence of user actions leading to the issue -->

## Performance Data
<!-- Complete this section for performance-related issues -->

### Timing Metrics
<!-- Flag any metrics exceeding thresholds -->
- Parse Time: <!-- Flag if >3s -->
- Graph Render Time: <!-- Flag if >1s -->
- View Transition Time: <!-- Flag if >500ms -->
- Code Update Response Time: <!-- Flag if >200ms -->
- GitHub Sync Time: <!-- Flag if >5s -->

### Debug Information
- Browser Console Errors: 
- Network Request Logs: 
- Memory Usage Statistics: 

## Additional Context
<!-- Add any other relevant context about the problem here -->

### Screenshots/Recordings
<!-- If applicable, add screenshots or recordings to help explain your problem -->

### Related Issues
<!-- Link any related issues here -->

### Recent Changes
<!-- Describe any recent changes that might be relevant -->

### Attempted Workarounds
<!-- Describe any workarounds you've tried -->

### Technical Details
<!-- Include any additional technical details -->

- Browser Developer Tools Console Output:
```
# Insert console output here
```

- Network Tab HAR Export (if relevant):
<!-- Attach HAR file or relevant network logs -->

- System Resource Utilization:
```
# Insert resource usage statistics here
```

<!-- 
Validation Checklist:
- [ ] Reproduction steps are complete and clear
- [ ] Environment details are fully specified
- [ ] Error messages are included (if applicable)
- [ ] Impact and severity are specified
-->