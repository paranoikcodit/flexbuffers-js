# Private Repository Setup

## GitHub CLI Support (Recommended)

The post-install script now supports GitHub CLI (`gh`) for better authentication and faster downloads, especially for private repositories.

## GitHub Actions Workflow

The `.github/workflows/release.yml` workflow automatically builds and releases your package when you push a tag starting with `v` (e.g., `v0.1.0`).

### Triggering a Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or manually trigger via GitHub Actions UI using the "workflow_dispatch" event.

## Post-Install Script Configuration

The post-install script automatically downloads pre-built binaries from your GitHub releases. For private repositories, you need to configure authentication.

### Environment Variables

Set these environment variables before installing the package:

```bash
# Required for private repositories
export GITHUB_TOKEN=your_github_personal_access_token

# Optional: Override repository details
export FLEXBUFFERS_REPO_OWNER=your-username
export FLEXBUFFERS_REPO_NAME=your-repo-name
```

### Method 1: Using GitHub CLI (Recommended)

1. Install GitHub CLI:
   ```bash
   # macOS
   brew install gh
   
   # Windows
   winget install --id GitHub.cli
   
   # Linux
   sudo apt install gh  # Debian/Ubuntu
   ```

2. Authenticate with GitHub:
   ```bash
   gh auth login
   ```

3. The post-install script will automatically use gh CLI for downloads.

### Method 2: Using GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Give it a descriptive name
4. Select the `repo` scope (full control of private repositories)
5. Click "Generate token"
6. Copy the token and save it securely

### Installing from Private Repository

#### Option 1: Direct Installation
```bash
GITHUB_TOKEN=your_token bun install github:your-username/flexbuffers-js
```

#### Option 2: In package.json
```json
{
  "dependencies": {
    "flexbuffers-js": "github:your-username/flexbuffers-js#v0.1.0"
  }
}
```

Then install with:
```bash
GITHUB_TOKEN=your_token bun install
```

#### Option 3: Using .npmrc
Create a `.npmrc` file in your project:
```
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
@your-username:registry=https://npm.pkg.github.com
```

### CI/CD Integration

For CI/CD environments, add the GitHub token as a secret:

#### GitHub Actions
```yaml
- name: Install dependencies
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: bun install
```

#### Other CI Systems
Add `GITHUB_TOKEN` as an environment variable in your CI configuration.

## Fallback Behavior

If the post-install script fails to download the binary (e.g., no internet, auth issues), it will automatically fall back to building from source using:
```bash
bun run build
```

This requires Rust to be installed on the system.

## Environment Variables

### Post-Install Configuration

- `FLEXBUFFERS_USE_GH_CLI`: Set to `false` to disable gh CLI usage (defaults to `true`)
- `FLEXBUFFERS_SKIP_DOWNLOAD`: Set to `true` to skip downloading binaries
- `FLEXBUFFERS_FORCE_BUILD`: Set to `true` to force building from source
- `FLEXBUFFERS_CACHE_DIR`: Custom cache directory (defaults to `~/.cache/flexbuffers-js`)

### Examples

```bash
# Use gh CLI (default)
bun install

# Force HTTPS downloads (disable gh CLI)
FLEXBUFFERS_USE_GH_CLI=false bun install

# Force build from source
FLEXBUFFERS_FORCE_BUILD=true bun install
```

## Troubleshooting

### Authentication Failed
- Ensure your GitHub token has the `repo` scope
- Check that the token hasn't expired
- Verify the repository owner and name are correct

### No Binary for Platform
The script will list available binaries and fall back to local build. Supported platforms:
- macOS: x64, arm64
- Windows: x64, ia32, arm64
- Linux: x64, arm64 (both gnu and musl)

### Build Failures
If both download and local build fail:
1. Ensure Rust is installed: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Ensure Bun is installed: `curl -fsSL https://bun.sh/install | bash`
3. Try building manually: `bun run build`