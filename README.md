# FlexBuffers-JS

A high-performance FlexBuffers implementation for JavaScript/TypeScript using NAPI-RS.

[![CI](https://github.com/yourusername/flexbuffers-js/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/flexbuffers-js/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/flexbuffers-js.svg)](https://badge.fury.io/js/flexbuffers-js)

## Features

- 🚀 **High Performance**: Native Rust implementation with NAPI bindings
- 🌐 **Cross Platform**: Supports all major platforms and architectures
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 📦 **Zero Dependencies**: No external runtime dependencies
- 🔄 **Easy API**: Both functional and class-based APIs
- ✅ **Well Tested**: Comprehensive test suite with 100% coverage
- 📊 **Benchmarked**: Performance benchmarks included

## Supported Platforms

Pre-built binaries are available for:

### macOS
- Intel (x86_64-apple-darwin)
- Apple Silicon (aarch64-apple-darwin)

### Windows
- x64 (x86_64-pc-windows-msvc)
- x86 (i686-pc-windows-msvc)
- ARM64 (aarch64-pc-windows-msvc)

### Linux GNU
- x64 (x86_64-unknown-linux-gnu)
- ARM64 (aarch64-unknown-linux-gnu)
- ARMv7 (armv7-unknown-linux-gnueabihf)
- RISC-V 64 (riscv64gc-unknown-linux-gnu)
- s390x (s390x-unknown-linux-gnu)

### Linux MUSL
- x64 (x86_64-unknown-linux-musl)
- ARM64 (aarch64-unknown-linux-musl)
- ARMv7 (armv7-unknown-linux-musleabihf)

### Android
- ARM64 (aarch64-linux-android)
- ARMv7 (armv7-linux-androideabi)

### FreeBSD
- x64 (x86_64-unknown-freebsd)

## Installation

```bash
npm install flexbuffers-js
# or
yarn add flexbuffers-js
# or
bun add flexbuffers-js
```

## Usage

### Functional API

```javascript
import { serialize, deserialize, isValid } from 'flexbuffers-js';

// Serialize data
const data = {
  name: "John Doe",
  age: 30,
  active: true,
  scores: [85, 92, 78, 96, 88],
  metadata: {
    created: "2023-01-01",
    tags: ["user", "premium"]
  }
};

const buffer = serialize(data);
console.log('Serialized size:', buffer.length);

// Deserialize data
const decoded = deserialize(buffer);
console.log('Decoded:', decoded);

// Validate buffer
if (isValid(buffer)) {
  console.log('Buffer is valid FlexBuffer format');
}
```

### Class API

```javascript
import { FlexBuffer } from 'flexbuffers-js';

// Create new FlexBuffer instance
const fb = new FlexBuffer();

// Serialize data
fb.serialize({ message: "Hello, FlexBuffers!", count: 42 });

// Get buffer size
console.log('Buffer size:', fb.size());

// Deserialize data
const result = fb.deserialize();
console.log('Result:', result);

// Get raw buffer
const rawBuffer = fb.getBuffer();

// Create FlexBuffer from existing buffer
const fb2 = FlexBuffer.fromBuffer(rawBuffer);
const data2 = fb2.deserialize();
```

### TypeScript Support

```typescript
interface UserData {
  id: number;
  name: string;
  email: string;
  active: boolean;
  metadata?: Record<string, any>;
}

const userData: UserData = {
  id: 1,
  name: "Alice",
  email: "alice@example.com", 
  active: true,
  metadata: { role: "admin" }
};

const buffer = serialize(userData);
const decoded = deserialize(buffer) as UserData;
```

## API Reference

### Functions

#### `serialize(value: any): number[]`
Serializes a JavaScript value to FlexBuffer format.

#### `deserialize(buffer: number[]): any`
Deserializes a FlexBuffer to JavaScript value.

#### `isValid(buffer: number[]): boolean`
Checks if a buffer is a valid FlexBuffer.

### FlexBuffer Class

#### `constructor()`
Creates a new empty FlexBuffer instance.

#### `serialize(value: any): void`
Serializes a value into this FlexBuffer instance.

#### `deserialize(): any`
Deserializes the current buffer content.

#### `getBuffer(): number[]`
Returns the raw buffer as an array of bytes.

#### `static fromBuffer(buffer: number[]): FlexBuffer`
Creates a FlexBuffer instance from an existing buffer.

#### `size(): number`
Returns the size of the buffer in bytes.

## Performance

FlexBuffers provides efficient binary serialization with the following characteristics:

- **Compact**: Binary format is typically smaller than JSON
- **Fast**: Native Rust implementation with zero-copy deserialization where possible
- **Flexible**: Supports all JavaScript data types including nested objects and arrays

### Benchmarks

Run benchmarks with:

```bash
npm run bench
```

Example results on Apple M4 Max:
- Small object serialization: ~2.1 μs
- Small object deserialization: ~1.4 μs
- Medium object round-trip: ~10.3 μs

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/flexbuffers-js.git
cd flexbuffers-js

# Install dependencies
yarn install

# Build the native module
yarn build

# Run tests
yarn test

# Run benchmarks
yarn bench
```

### Building for All Platforms

The project includes comprehensive CI/CD workflows that automatically build for all supported platforms:

```bash
# Build for current platform
yarn build

# Build debug version
yarn build:debug

# Prepare npm packages for all platforms
yarn artifacts
```

## CI/CD Setup

This project includes GitHub Actions workflows for:

1. **Continuous Integration** (`.github/workflows/ci.yml`)
   - Builds and tests on all supported platforms
   - Runs on every push and pull request

2. **Release Creation** (`.github/workflows/create-release.yml`)
   - Creates GitHub releases with pre-built binaries
   - Publishes to NPM
   - Triggered by version tags

3. **NPM Publishing** (`.github/workflows/publish.yml`)
   - Publishes packages to NPM registry
   - Triggered by GitHub releases

### Required Secrets

To use the CI/CD workflows, add these secrets to your GitHub repository:

- `NPM_TOKEN`: NPM authentication token for publishing packages

### Creating a Release

1. Update version in `package.json`
2. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The release workflow will automatically:
   - Build binaries for all platforms
   - Create a GitHub release
   - Publish to NPM

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FlexBuffers](https://github.com/google/flatbuffers/tree/master/docs/FlexBuffers.md) - Google's flexible binary serialization format
- [NAPI-RS](https://github.com/napi-rs/napi-rs) - Node.js N-API bindings for Rust
- [serde](https://serde.rs/) - Rust serialization framework