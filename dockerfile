FROM node:22-alpine AS web-build
WORKDIR /app/app/web
COPY app/web/package.json app/web/package-lock.json ./
RUN npm install
COPY app/web/ ./
RUN npm run build

FROM golang:1.24-alpine AS api-build
WORKDIR /app/app/api
COPY app/api/go.mod app/api/go.sum ./
RUN go mod download
COPY app/api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /whoofolio ./cmd/server

FROM alpine:3.21
WORKDIR /app
COPY --from=api-build /whoofolio /usr/local/bin/whoofolio
COPY --from=web-build /app/app/web/dist ./public
ENV PORT=8080
EXPOSE 8080
CMD ["whoofolio"]
