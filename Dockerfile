FROM node:20 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build both frontend and backend
RUN npm run build

FROM node:20-slim

WORKDIR /app

# Install dependencies needed for node-pty (if required by agents) and concurrently
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install production dependencies
COPY package*.json ./
# Install concurrently explicitly so we can use npm run start:all
RUN npm ci --omit=dev && npm install concurrently

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Create the data directory
RUN mkdir -p /root/.conduit

# Expose only the web UI port (daemon port 3210 remains internal)
EXPOSE 3200

# Start both daemon and server using the existing script
CMD ["npm", "run", "start:all"]
