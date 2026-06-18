FROM node:18-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max_old_space_size=2048
ENV CI=false
ENV DISABLE_ESLINT_PLUGIN=true
COPY package.json ./
RUN npm install --legacy-peer-deps && \
    npm install ajv@^8.0.0 --legacy-peer-deps
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
