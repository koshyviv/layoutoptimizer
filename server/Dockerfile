FROM node:18

# Working directory for the API service
WORKDIR /app

# Copy package manifests first to leverage cached layers
COPY package.json package-lock.json* ./

RUN npm install

# Copy source code
COPY . .

# Expose API port
EXPOSE 3001

CMD ["npm", "start"]