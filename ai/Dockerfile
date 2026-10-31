FROM node:20-slim

WORKDIR /app

# Install runtime dependencies required for node-canvas / PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure non-root node user owns the app directory
RUN chown -R node:node /app

USER node

# Expose AI microservice port
EXPOSE 5001

# Set production environment defaults
ENV NODE_ENV=production
ENV AI_PORT=5001

# Start AI service
CMD ["node", "server.js"]
