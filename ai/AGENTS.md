# AGENTS.md
## Development Constitutional Principles

---

### Document Metadata

**Spec ID:** SDD-ARTICLES-001  
**Version:** 1.0  
**Last Updated:** 2026-01-04  
**Status:** Active  

---

## Overview

### Description
This document defines the selected constitutional principles for the agent-driven development process, ensuring spec-driven code generation maintains consistency, modularity, and quality across all deliverables.

### Scope
Applies to all libraries, applications, and tests in agent development, including:
- Core libraries and utilities
- Application code and integrations
- Test suites and validation frameworks
- Documentation and specifications

### Enforcement
Constitutional principles are enforced through:
- **Templates:** Standardized project and code templates
- **Pre-implementation Gates:** Validation checkpoints before code generation
- **AI Prompts:** Integration into AI agent instructions and workflows
- **Code Review:** Manual and automated validation processes

---

## Constitutional Articles

### Article I: Library-First Principle

**Principle:** Every feature must begin as an independent library, without exceptions.

#### Requirements
1. **Modular Design Enforcement**
   - All functionality must be implemented as standalone library modules
   - Direct implementation in application code is prohibited
   - Libraries must have clear boundaries and single responsibilities

2. **Spec-to-Library Workflow**
   - Generate reusable library components from specifications before integration
   - Libraries must be independently testable and deployable
   - Integration into agents occurs only after library validation

3. **Dependency Management**
   - Libraries should minimize external dependencies
   - Clear dependency trees must be maintained
   - Circular dependencies are strictly prohibited

#### Rationale
Promotes code modularity and reusability, preventing monolithic architectures and enabling independent evolution of components.

#### Enforcement Gate
**Library-First Gate** - Validates that:
- Feature implementation starts with library creation
- Library has defined API boundaries
- Library exists independently of consuming applications

---

### Article II: CLI Interface Mandate

**Principle:** Every library must expose functionality via a Command-Line Interface (CLI).

#### Requirements
1. **Input Specifications**
   - Accept text input via stdin, command-line arguments, or files
   - Support JSON-structured data for complex inputs
   - Provide clear parameter documentation via `--help`

2. **Output Specifications**
   - Produce text output via stdout
   - Support JSON-structured data for complex outputs
   - Use stderr for errors and diagnostic messages
   - Return appropriate exit codes (0 for success, non-zero for errors)

3. **Interface Standards**
   - Follow POSIX conventions for argument parsing
   - Support common flags: `--help`, `--version`, `--verbose`
   - Enable piping and composition with other CLI tools

#### Rationale
Enhances observability, testability, and debuggability of agent interactions. CLI interfaces provide universal access patterns and facilitate integration testing.

#### Enforcement Gate
**CLI Interface Validation** - Validates that:
- CLI entry point exists and is executable
- Input/output contracts are documented
- Help documentation is complete
- Interface passes basic smoke tests

---

### Article III: Test-First Imperative

**Principle:** Tests must be created before writing implementation code (strict Test-Driven Development).

#### Requirements
1. **Test Creation Workflow**
   - Write comprehensive unit tests based on specifications
   - Submit tests for user approval before implementation
   - Validate that tests fail appropriately (Red phase of TDD)

2. **Test Coverage Standards**
   - Unit tests for all public APIs
   - Integration tests for CLI interfaces
   - Edge case and error condition coverage
   - Performance benchmarks where applicable

3. **Test-First Validation**
   - Confirm tests execute and fail with expected messages
   - Document test scenarios and expected behaviors
   - Obtain explicit approval before proceeding to implementation

#### Rationale
Defines behavior through tests first, inverting traditional code generation flows. This approach ensures specifications are testable and provides immediate validation of implementation correctness.

#### Enforcement Gate
**Test-First Gate** - Validates that:
- Test suite exists and is runnable
- Tests fail before implementation (Red phase confirmed)
- Test coverage meets minimum thresholds
- User has approved test scenarios

---

## Implementation Workflow

### Standard Development Flow

```
1. Specification Review
   ↓
2. Library-First Gate ← Article I Enforcement
   ↓
3. Test Creation (Red Phase)
   ↓
4. Test-First Gate ← Article III Enforcement
   ↓
5. Implementation (Green Phase)
   ↓
6. CLI Interface Creation
   ↓
7. CLI Interface Validation ← Article II Enforcement
   ↓
8. Refactoring (Blue Phase)
   ↓
9. Integration & Deployment
```

### Gate Checklist

Before proceeding past each gate, ensure:

**Library-First Gate:**
- [ ] Library structure created
- [ ] API boundaries defined
- [ ] Dependencies documented
- [ ] Library independence verified

**Test-First Gate:**
- [ ] Test suite written
- [ ] Tests reviewed and approved
- [ ] Red phase confirmed
- [ ] Coverage validated

**CLI Interface Validation:**
- [ ] CLI entry point implemented
- [ ] Input/output contracts met
- [ ] Help documentation complete
- [ ] Basic smoke tests passed

