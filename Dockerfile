FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root and packages
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy source files
COPY server/ ./server/
COPY client/ ./client/

# Build client and server
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-slim AS runner

WORKDIR /app

# better-sqlite3 runtime support
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY server/package*.json ./server/

# Production dependencies only
RUN npm install --omit=dev
RUN cd server && npm install --omit=dev

# Copy compiled files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Persistent data and uploads folders
RUN mkdir -p /app/server/data /app/server/uploads

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server/dist/index.js"]
