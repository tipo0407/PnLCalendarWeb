# Build the static frontend, then serve it (plus the license/checkout API and
# proxies) with the dependency-free Node server. The runtime image has no
# node_modules — server/serve.cjs and server/api.cjs are pure Node.

# Pin the base image by digest for reproducible, tamper-evident builds. The tag
# is kept for readability; Dependabot (docker ecosystem) bumps the digest.
FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173
# LICENSE_SECRET / ADMIN_TOKEN / STRIPE_SECRET_KEY are provided at runtime.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 4173
CMD ["node", "server/serve.cjs"]
