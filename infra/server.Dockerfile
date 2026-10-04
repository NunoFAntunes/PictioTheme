# The server image. Nothing is compiled here: CI builds the bundle (apps/server/scripts/build.mjs)
# and the production node_modules (`pnpm deploy --prod .deploy/server`) on the runner. They are
# plain JavaScript with no native modules, so the same files work on amd64 and arm64.
# Build context: the repo root (see .dockerignore).
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app
COPY .deploy/server/package.json ./
COPY .deploy/server/node_modules ./node_modules
COPY .deploy/server/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/main.js"]
