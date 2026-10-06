# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

ARG VITE_ENABLE_HILL=false
ARG VITE_ENABLE_DES=false
ARG VITE_ENABLE_RSA=false
RUN VITE_ENABLE_HILL="${VITE_ENABLE_HILL}" VITE_ENABLE_DES="${VITE_ENABLE_DES}" VITE_ENABLE_RSA="${VITE_ENABLE_RSA}" npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

ARG FRONTEND_REVISION=unknown
LABEL org.opencontainers.image.title="Cipher Workbench Frontend" \
      org.opencontainers.image.source="https://github.com/quanh712/caesar-cipher-fe" \
      org.opencontainers.image.revision="${FRONTEND_REVISION}"

COPY nginx/production.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
