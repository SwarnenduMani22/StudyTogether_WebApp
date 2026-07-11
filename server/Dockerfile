FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (needed for pdf-img-convert canvas compiling or OCR tools if compiled)
RUN apk add --no-cache python3 make g++ gcc pixman-dev cairo-dev pango-dev libjpeg-turbo-dev giflib-dev

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
