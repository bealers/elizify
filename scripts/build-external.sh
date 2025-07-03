#!/bin/bash
set -e

# Build script for external hosting variant of ElizaOS
# This creates a production-optimized image suitable for Docker Hub, GitHub Container Registry, etc.

echo "🚀 Building ElizaOS for External Hosting..."

# Default values
REGISTRY_PREFIX=""
TAG="latest"
IMAGE_NAME="elizaos"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --registry)
      REGISTRY_PREFIX="$2/"
      shift
      shift
      ;;
    --tag)
      TAG="$2"
      shift
      shift
      ;;
    --name)
      IMAGE_NAME="$2"
      shift
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --registry REGISTRY    Registry prefix (e.g., ghcr.io/username)"
      echo "  --tag TAG             Image tag (default: latest)"
      echo "  --name NAME           Image name (default: elizaos)"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

FULL_IMAGE_NAME="${REGISTRY_PREFIX}${IMAGE_NAME}:${TAG}"

echo "📦 Building external hosting image: ${FULL_IMAGE_NAME}"

# Build the external variant
docker build \
  --target external \
  --tag "${FULL_IMAGE_NAME}" \
  --platform linux/amd64 \
  --no-cache \
  .

echo "✅ Build complete!"
echo "📏 Image size:"
docker images "${FULL_IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "🔧 Ready for:"
echo "  • Testing: docker run -p 3000:3000 ${FULL_IMAGE_NAME}"
echo "  • Publishing: docker push ${FULL_IMAGE_NAME}"
echo "  • Multi-arch: docker buildx build --platform linux/amd64,linux/arm64 ..."

echo ""
echo "📝 Sample docker run command:"
echo "docker run -d \\"
echo "  --name elizaos \\"
echo "  -p 3000:3000 \\"
echo "  -e OPENAI_API_KEY=your-key-here \\"
echo "  -e CHARACTER_FILE=/app/config/characters/server-bod.character.json \\"
echo "  -v eliza_data:/app/data \\"
echo "  ${FULL_IMAGE_NAME}" 