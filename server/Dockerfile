# eSamithi API — one container serves all samithis (DB-per-tenant)
FROM node:20-alpine

WORKDIR /app

# Dependencies first so source edits don't bust the npm layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# uploads/ and tenants.json are volumes; .env comes from compose env_file
CMD ["node", "server.js"]
