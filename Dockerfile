FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data
EXPOSE 3001
CMD ["node","server/index.js"]
