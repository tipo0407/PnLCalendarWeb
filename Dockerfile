# Build the static frontend, then serve it (plus the license/checkout API and
# proxies) with the dependency-free Node server. The runtime image has no
# node_modules — server/serve.cjs and server/api.cjs are pure Node.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173
# LICENSE_SECRET / ADMIN_TOKEN / STRIPE_SECRET_KEY are provided at runtime.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 4173
CMD ["node", "server/serve.cjs"]
