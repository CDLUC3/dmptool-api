FROM public.ecr.aws/docker/library/node:lts-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    nodejs \
    npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all deps
# Copy package.json to the /app working directory
COPY package*.json tsconfig.json .env ./

# Install dependencies in /app
RUN npm ci

# Copy the rest of our Apollo Server folder into /app
COPY ./src .

# Ensure port 3000 is accessible to our system
EXPOSE 4000

# Command to run the Next.js app in development mode
CMD ["npm", "run", "dev"]
