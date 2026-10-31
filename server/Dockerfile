FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy server code
COPY . .

# Expose server port
EXPOSE 5000

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["node", "server.js"]
