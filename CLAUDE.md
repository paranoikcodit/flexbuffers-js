# Development Guidelines for Claude

## Rust Code Validation Process

After every Rust code modification, follow this strict workflow:

1. **Run Rust validation**: Execute `cargo check` to identify any compilation errors
2. **Fix any errors**: If `cargo check` reveals issues, fix them immediately before proceeding
3. **Build the project**: After successful validation, run the build process
4. **Test the changes**: Execute `bun run test` to verify functionality

## Package Manager Requirements

**CRITICAL**: Use ONLY Bun for all JavaScript/Node.js operations:
- Package installation: `bun install` (NOT npm install)
- Script execution: `bun run <script>` (NOT npm run)
- Package management: `bun add/remove` (NOT npm add/remove)

**FORBIDDEN**: Do not use npm, yarn, pnpm, or any other package manager. Bun is the ONLY allowed JavaScript runtime and package manager for this project.

## Example Workflow

```bash
# After editing Rust code
cargo check
# Fix any errors if present
bun run build
bun run test
```