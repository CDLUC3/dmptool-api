FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN dnf update -y && \
    dnf install -y nodejs20 npm && \
    dnf clean all

WORKDIR /app

# Install all deps
# Copy package.json to the /app working directory
COPY package*.json tsconfig.json .env ./

# Install dependencies in /app
RUN npm install

# Copy the rest of our Apollo Server folder into /app
COPY . .

# Ensure port 4060 is accessible to our system
EXPOSE 4060

# Command to run the Next.js app in development mode
CMD ["npm", "run", "dev"]
