FROM public.ecr.aws/docker/library/node:lts-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    nodejs \
    npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all deps
COPY package*.json ./
RUN npm ci

# Expose API port
EXPOSE 4060

CMD ["npm", "run", "dev"]
