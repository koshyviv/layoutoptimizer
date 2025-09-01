FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy only the package definitions first.  This leverages Docker
# layer caching: dependencies are installed only when they change.
COPY package.json package-lock.json* ./

RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the default Vite port
EXPOSE 5173

# Start the development server.  The --host flag allows external
# connections from the host machine into the container.
CMD ["npm", "run", "dev", "--", "--host"]